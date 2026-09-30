import { describe, expect, it } from "vitest";
import { supervisorRoutes, users, vehicles } from "../drizzle/schema";
import { RouteClosureError } from "./route-closure";
import {
  lockSupervisorRouteOperations,
  withLockedSupervisorRoute,
} from "./route-checklist-lock";
import { startSupervisorRouteInTransaction } from "./supervisor-route-start";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

class RowMutex {
  private tail = Promise.resolve();
  private held = false;
  readonly waiterQueued = deferred();

  async acquire() {
    const predecessor = this.tail;
    let releaseNext!: () => void;
    this.tail = new Promise<void>(resolve => {
      releaseNext = resolve;
    });
    if (this.held) this.waiterQueued.resolve();
    this.held = true;
    await predecessor;
    return () => {
      this.held = false;
      releaseNext();
    };
  }
}

function createRouteHarness() {
  const route: any = {
    id: 13,
    supervisorId: 7,
    routeId: 3,
    status: "pending",
    kmInitial: null,
    vehicleId: null,
    startedAt: null,
    completedAt: null,
  };
  const userMutex = new RowMutex();
  const routeMutex = new RowMutex();
  const vehicle = { id: 2, isActive: true };
  const writes: Array<Record<string, unknown>> = [];

  const runTransaction = async <T>(
    operation: (transaction: any) => Promise<T>
  ) => {
    const releases: Array<() => void> = [];
    const transaction: any = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            for: (mode: string) => ({
              limit: async () => {
                if (mode !== "update")
                  throw new Error("Esperado lock de linha FOR UPDATE");
                const release = await (
                  table === users ? userMutex : routeMutex
                ).acquire();
                releases.push(release);
                return table === users ? [{ id: 7 }] : [{ ...route }];
              },
            }),
            limit: async () => (table === vehicles ? [vehicle] : []),
          }),
        }),
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => {
              writes.push({ ...values });
              Object.assign(route, values);
              return [{ id: route.id }];
            },
          }),
        }),
      }),
    };
    try {
      return await operation(transaction);
    } finally {
      releases.reverse().forEach(release => release());
    }
  };
  return { route, runTransaction, userMutex, writes };
}

describe("startSupervisorRouteInTransaction", () => {
  it("serializa uma tentativa de início concorrente e não ressuscita a rota após o fechamento", async () => {
    const fixture = createRouteHarness();
    await expect(
      fixture.runTransaction(transaction =>
        startSupervisorRouteInTransaction(transaction, {
          supervisorRouteId: 13,
          supervisorId: 7,
          vehicleId: 2,
          kmInitial: 340091,
        })
      )
    ).resolves.toEqual({ started: true, supervisorRouteId: 13 });
    expect(fixture.route.status).toBe("in_progress");

    const closureHasLock = deferred();
    const permitClosureCommit = deferred();
    const close = fixture.runTransaction(async transaction => {
      await lockSupervisorRouteOperations(transaction, 7);
      return withLockedSupervisorRoute(
        transaction,
        {
          supervisorRouteId: 13,
          supervisorId: 7,
          allowedStatuses: ["in_progress"],
        },
        async () => {
          closureHasLock.resolve();
          await permitClosureCommit.promise;
          fixture.route.status = "completed";
          fixture.route.kmFinal = "340226.00";
          fixture.route.completedAt = new Date("2026-09-30T20:00:00.000Z");
          return { closed: true };
        }
      );
    });
    await closureHasLock.promise;

    const staleStart = fixture.runTransaction(transaction =>
      startSupervisorRouteInTransaction(transaction, {
        supervisorRouteId: 13,
        supervisorId: 7,
        vehicleId: 2,
        kmInitial: 340091,
      })
    );
    await fixture.userMutex.waiterQueued.promise;
    expect(fixture.route.status).toBe("in_progress");
    expect(fixture.writes).toHaveLength(1);

    permitClosureCommit.resolve();
    await expect(close).resolves.toMatchObject({ closed: true });
    await expect(staleStart).rejects.toMatchObject({ code: "CONFLICT" });
    expect(fixture.route).toMatchObject({
      status: "completed",
      kmInitial: "340091.00",
      kmFinal: "340226.00",
    });
    expect(fixture.writes).toHaveLength(1);
  });

  it("rejeita iniciar rota sem viatura ativa", async () => {
    const fixture = createRouteHarness();
    await expect(
      fixture.runTransaction(async transaction => {
        transaction.select = () => ({
          from: (table: unknown) => ({
            where: () => ({
              for: () => ({
                limit: async () =>
                  table === users ? [{ id: 7 }] : [{ ...fixture.route }],
              }),
              limit: async () => [],
            }),
          }),
        });
        return startSupervisorRouteInTransaction(transaction, {
          supervisorRouteId: 13,
          supervisorId: 7,
          vehicleId: 999,
          kmInitial: 340091,
        });
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fixture.route.status).toBe("pending");
  });
});
