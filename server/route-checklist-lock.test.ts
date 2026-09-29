import { describe, expect, it } from "vitest";
import { RouteClosureError } from "./route-closure";
import { withLockedSupervisorRoute } from "./route-checklist-lock";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

class RouteRowMutex {
  private tail = Promise.resolve();
  private held = false;
  readonly secondMutationQueued = deferred();

  async acquire() {
    const predecessor = this.tail;
    let releaseNext!: () => void;
    this.tail = new Promise<void>((resolve) => { releaseNext = resolve; });
    if (this.held) this.secondMutationQueued.resolve();
    this.held = true;
    await predecessor;
    return () => {
      this.held = false;
      releaseNext();
    };
  }
}

describe("withLockedSupervisorRoute", () => {
  it("serializa checklist mutation com fechamento e reavalia status depois do lock", async () => {
    const mutex = new RouteRowMutex();
    const routeState: { id: number; supervisorId: number; status: "in_progress" | "completed" } = {
      id: 11,
      supervisorId: 7,
      status: "in_progress",
    };

    const runTransaction = async <T>(operation: (transaction: any) => Promise<T>) => {
      let release: (() => void) | undefined;
      const transaction = {
        select: () => ({
          from: () => ({
            where: () => ({
              for: (_mode: string) => ({
                limit: async () => {
                  release = await mutex.acquire();
                  // READ COMMITTED + FOR UPDATE returns the row after any prior holder commits.
                  return [{ ...routeState }];
                },
              }),
            }),
          }),
        }),
      };
      try {
        return await operation(transaction);
      } finally {
        release?.();
      }
    };

    const closureHasLock = deferred();
    const permitClosureCommit = deferred();
    const close = runTransaction((transaction) => withLockedSupervisorRoute(transaction, {
      supervisorRouteId: 11,
      supervisorId: 7,
      allowedStatuses: ["in_progress"],
      statusMessage: "Somente rota ativa pode ser encerrada",
    }, async () => {
      closureHasLock.resolve();
      await permitClosureCommit.promise;
      routeState.status = "completed";
      return "closed";
    }));
    await closureHasLock.promise;

    let checklistInsertAttempted = false;
    const checklistMutation = runTransaction((transaction) => withLockedSupervisorRoute(transaction, {
      supervisorRouteId: 11,
      supervisorId: 7,
      allowedStatuses: ["in_progress"],
    }, async () => {
      checklistInsertAttempted = true;
      return "inserted";
    }));
    await mutex.secondMutationQueued.promise;
    expect(checklistInsertAttempted).toBe(false);

    permitClosureCommit.resolve();
    await expect(close).resolves.toBe("closed");
    await expect(checklistMutation).rejects.toMatchObject({
      code: "CONFLICT",
      message: "A rota não está em um estado que permita alterar checklists",
    });
    expect(checklistInsertAttempted).toBe(false);
  });

  it("oculta uma rota cujo proprietário não corresponde à identidade autenticada", async () => {
    const transaction = {
      select: () => ({
        from: () => ({
          where: () => ({
            for: () => ({ limit: async () => [] }),
          }),
        }),
      }),
    };

    await expect(withLockedSupervisorRoute(transaction, {
      supervisorRouteId: 11,
      supervisorId: 99,
      allowedStatuses: ["in_progress"],
    }, async () => "must-not-run")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
