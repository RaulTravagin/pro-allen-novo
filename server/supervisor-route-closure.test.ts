import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  posts,
  routes,
  supervisorRouteClosureExceptions,
  supervisorRoutes,
  users,
  visitChecklists,
} from "../drizzle/schema";
import { closeSupervisorRouteInTransaction } from "./supervisor-route-closure";
import type { CloseSupervisorRouteInput } from "./supervisor-route-closure";

const supervisorId = 7;
const supervisorRouteId = 13;
const routeFixture = {
  id: supervisorRouteId,
  supervisorId,
  routeId: 3,
  status: "in_progress" as const,
  kmInitial: "340091",
  kmFinal: null,
  startedAt: new Date("2026-09-30T08:00:00.000Z"),
  completedAt: null,
};

function createTransactionFixture(options: { hasPendingVisit?: boolean } = {}) {
  const route = { ...routeFixture };
  const auditRows: Array<Record<string, unknown>> = [];
  const deleteCalls: unknown[] = [];
  const occurrences = Array.from({ length: 7 }, (_, index) => ({
    id: index + 1,
    postId: index + 1,
    postName: `Posto fictício ${index + 1}`,
    status: options.hasPendingVisit && index === 6 ? "pending" : "visited",
    isCoverage: false,
    arrivalTime: new Date(
      `2026-09-30T${String(8 + index).padStart(2, "0")}:00:00.000Z`
    ),
    departureTime: new Date(
      `2026-09-30T${String(8 + index).padStart(2, "0")}:30:00.000Z`
    ),
    occurrenceReport:
      options.hasPendingVisit && index === 6
        ? null
        : `Relato fictício ${index + 1}`,
    occurrenceSubmittedAt:
      options.hasPendingVisit && index === 6
        ? null
        : new Date(
            `2026-09-30T${String(8 + index).padStart(2, "0")}:35:00.000Z`
          ),
  }));
  const plannedPosts = occurrences.map(item => ({
    id: item.postId,
    name: item.postName,
  }));
  const transaction: any = {
    select: () => ({
      from: (table: unknown) => ({
        leftJoin: () => ({
          where: async () => (table === visitChecklists ? occurrences : []),
        }),
        where: () => {
          if (table === users)
            return {
              for: () => ({ limit: async () => [{ id: supervisorId }] }),
            };
          if (table === supervisorRoutes)
            return { for: () => ({ limit: async () => [route] }) };
          if (table === routes)
            return { limit: async () => [{ activityType: "field_route" }] };
          if (table === posts) return Promise.resolve(plannedPosts);
          return Promise.resolve([]);
        },
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            Object.assign(route, values);
            return [{ id: supervisorRouteId }];
          },
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        if (table === supervisorRouteClosureExceptions)
          auditRows.push({ ...values });
        return [];
      },
    }),
    delete: (...args: unknown[]) => {
      deleteCalls.push(args);
      throw new Error("O fechamento não pode apagar registros operacionais");
    },
  };
  return { transaction, route, auditRows, deleteCalls };
}

describe("closeSupervisorRouteInTransaction", () => {
  beforeEach(() => vi.useRealTimers());

  it("fecha normalmente com 7 registros completos, KM final 340226 e sem apagar dados", async () => {
    const fixture = createTransactionFixture();
    const result = await closeSupervisorRouteInTransaction(
      fixture.transaction,
      {
        supervisorRouteId,
        supervisorId,
        kmFinal: 340226,
      }
    );

    expect(result).toMatchObject({ closed: true, exceptionAudit: null });
    expect(fixture.route).toMatchObject({
      status: "completed",
      kmFinal: "340226.00",
      completedAt: expect.any(Date),
    });
    expect(fixture.auditRows).toEqual([]);
    expect(fixture.deleteCalls).toEqual([]);
  });

  it("não fecha sem motivo quando há pendência e persiste snapshot auditável com justificativa", async () => {
    const fixture = createTransactionFixture({ hasPendingVisit: true });
    const firstAttempt = await closeSupervisorRouteInTransaction(
      fixture.transaction,
      {
        supervisorRouteId,
        supervisorId,
        kmFinal: 340226,
      }
    );
    expect(firstAttempt).toMatchObject({
      closed: false,
      requiresExceptionJustification: true,
      pendingSummary: { counts: { pendingPosts: 1, pendingVisits: 1 } },
    });
    expect(fixture.route.status).toBe("in_progress");
    expect(fixture.auditRows).toEqual([]);

    const result = await closeSupervisorRouteInTransaction(
      fixture.transaction,
      {
        supervisorRouteId,
        supervisorId,
        kmFinal: 340226,
        exceptionJustification:
          "Encerramento por indisponibilidade do posto fictício.",
      }
    );
    expect(result).toMatchObject({
      closed: true,
      exceptionAudit: {
        justification: "Encerramento por indisponibilidade do posto fictício.",
        pendingSummary: { counts: { pendingPosts: 1, pendingVisits: 1 } },
      },
    });
    expect(fixture.route.status).toBe("completed");
    expect(fixture.auditRows).toHaveLength(1);
    expect(fixture.auditRows[0]).toMatchObject({
      supervisorRouteId,
      supervisorId,
      justification: "Encerramento por indisponibilidade do posto fictício.",
      pendingSummary: { counts: { pendingPosts: 1, pendingVisits: 1 } },
    });
    expect(fixture.deleteCalls).toEqual([]);
  });

  it("rejeita justificativa vazia em uma tentativa excepcional", async () => {
    const fixture = createTransactionFixture({ hasPendingVisit: true });
    const input: CloseSupervisorRouteInput = {
      supervisorRouteId,
      supervisorId,
      kmFinal: 340226,
      exceptionJustification: "   ",
    };
    await expect(
      closeSupervisorRouteInTransaction(fixture.transaction, input)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fixture.route.status).toBe("in_progress");
    expect(fixture.auditRows).toEqual([]);
  });
});
