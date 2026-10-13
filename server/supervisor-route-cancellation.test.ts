import { describe, expect, it } from "vitest";
import { RouteClosureError } from "./route-closure";
import { cancelActiveSupervisorRouteInTransaction } from "./supervisor-route-cancellation";

const routeFixture = () => ({
  id: 731,
  status: "in_progress" as const,
  kmInitial: "15324.50",
  startedAt: new Date("2026-10-13T12:00:00.000Z"),
  completedAt: null,
});

const linkedDataFixture = () => ({
  fuelLogs: [{ id: 901, odometerKm: "15380.00", amount: "210.00" }],
  checklists: [
    { id: 902, status: "in_progress", observations: "fixture sintética" },
  ],
  gps: [{ id: 903, latitude: "-23.50000000", longitude: "-46.60000000" }],
  personnel: [{ id: 904, status: "APPROVED", amount: "10.00" }],
  finance: [{ id: 905, status: "PAID", amount: "10.00" }],
});

function createTransactionalFixture(
  options: {
    route?: ReturnType<typeof routeFixture> | null;
    auditFailure?: boolean;
  } = {}
) {
  const state = {
    route: options.route === undefined ? routeFixture() : options.route,
    audits: [] as Array<Record<string, unknown>>,
    linkedData: linkedDataFixture(),
    updatedFields: [] as Array<Record<string, unknown>>,
    rowLockCount: 0,
    transactionCount: 0,
  };
  let transactionTail = Promise.resolve();
  const transaction = {
    select: () => ({
      from: () => ({
        where: () => ({
          for: (mode: string) => {
            expect(mode).toBe("update");
            state.rowLockCount += 1;
            return {
              limit: async () => (state.route ? [{ ...state.route }] : []),
            };
          },
        }),
      }),
    }),
    update: () => ({
      set: (fields: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            state.updatedFields.push(fields);
            if (
              !state.route ||
              state.route.status !== "in_progress" ||
              !state.route.kmInitial ||
              !state.route.startedAt ||
              state.route.completedAt
            ) {
              return [];
            }
            state.route = { ...state.route, status: "cancelled" as const };
            return [{ id: state.route.id }];
          },
        }),
      }),
    }),
    insert: () => ({
      values: (record: Record<string, unknown>) => ({
        returning: async () => {
          if (options.auditFailure) throw new Error("fixture failure");
          const audit = { id: 4401 + state.audits.length, ...record };
          state.audits.push(audit);
          return [{ id: audit.id }];
        },
      }),
    }),
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      let release!: () => void;
      const previous = transactionTail;
      transactionTail = new Promise<void>(resolve => {
        release = resolve;
      });
      await previous;
      const before = structuredClone({
        route: state.route,
        audits: state.audits,
      });
      state.transactionCount += 1;
      try {
        return await callback(transaction);
      } catch (error) {
        state.route = before.route;
        state.audits = before.audits;
        throw error;
      } finally {
        release();
      }
    },
  };
  return { transaction, state };
}

const cancellationInput = {
  supervisorRouteId: 731,
  cancelledByUserId: 19,
  reason: "Encerramento administrativo da operação para reinício controlado.",
};

describe("cancelamento auditável de rota ativa", () => {
  it("muda somente status e grava ator, timestamp, motivo e estado anterior na mesma transação", async () => {
    const fixture = createTransactionalFixture();
    const linkedDataBefore = structuredClone(fixture.state.linkedData);
    let auditTransaction: unknown;

    const result = await fixture.transaction.transaction(async tx => {
      auditTransaction = tx;
      return cancelActiveSupervisorRouteInTransaction(tx, cancellationInput);
    });

    expect(result).toMatchObject({
      cancelled: true,
      supervisorRouteId: 731,
      auditId: 4401,
    });
    expect(result.cancelledAt).toBeInstanceOf(Date);
    expect(fixture.state.route).toMatchObject({
      id: 731,
      status: "cancelled",
      kmInitial: "15324.50",
    });
    expect(fixture.state.updatedFields).toEqual([{ status: "cancelled" }]);
    expect(fixture.state.audits).toHaveLength(1);
    expect(fixture.state.audits[0]).toMatchObject({
      supervisorRouteId: 731,
      cancelledByUserId: 19,
      previousStatus: "in_progress",
      reason: cancellationInput.reason,
      cancelledAt: result.cancelledAt,
    });
    expect(auditTransaction).toBe(fixture.transaction);
    expect(fixture.state.linkedData).toEqual(linkedDataBefore);
    expect(fixture.state.transactionCount).toBe(1);
  });

  it.each([
    [
      "pending",
      {
        status: "pending",
        kmInitial: null,
        startedAt: null,
        completedAt: null,
      },
    ],
    [
      "concluída",
      {
        status: "completed",
        kmInitial: "15324.50",
        startedAt: new Date(),
        completedAt: new Date(),
      },
    ],
    [
      "sem KM inicial",
      {
        status: "in_progress",
        kmInitial: null,
        startedAt: new Date(),
        completedAt: null,
      },
    ],
    [
      "sem início",
      {
        status: "in_progress",
        kmInitial: "15324.50",
        startedAt: null,
        completedAt: null,
      },
    ],
    [
      "já cancelada",
      {
        status: "cancelled",
        kmInitial: "15324.50",
        startedAt: new Date(),
        completedAt: null,
      },
    ],
  ] as const)(
    "rejeita rota %s sem mudar auditoria ou dados vinculados",
    async (_label, state) => {
      const fixture = createTransactionalFixture({
        route: { id: 731, ...state } as ReturnType<typeof routeFixture>,
      });
      const before = structuredClone(fixture.state);

      await expect(
        cancelActiveSupervisorRouteInTransaction(
          fixture.transaction,
          cancellationInput
        )
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(fixture.state.route).toEqual(before.route);
      expect(fixture.state.audits).toEqual([]);
      expect(fixture.state.linkedData).toEqual(before.linkedData);
      expect(fixture.state.updatedFields).toEqual([]);
    }
  );

  it("retorna conflito se outro fluxo altera o status entre leitura e update condicional", async () => {
    const fixture = createTransactionalFixture();
    const firstRead = routeFixture();
    fixture.transaction.select = () => ({
      from: () => ({
        where: () => ({
          for: () => ({ limit: async () => [{ ...firstRead }] }),
        }),
      }),
    });
    fixture.transaction.update = () => ({
      set: (fields: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            fixture.state.updatedFields.push(fields);
            fixture.state.route = {
              ...routeFixture(),
              status: "completed" as const,
              completedAt: new Date(),
            } as ReturnType<typeof routeFixture>;
            return [];
          },
        }),
      }),
    });

    await expect(
      cancelActiveSupervisorRouteInTransaction(
        fixture.transaction,
        cancellationInput
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(fixture.state.audits).toEqual([]);
    expect(fixture.state.route?.status).toBe("completed");
  });

  it("serializa duas tentativas simultâneas: apenas a primeira cancela e audita", async () => {
    const fixture = createTransactionalFixture();
    const results = await Promise.allSettled([
      fixture.transaction.transaction(tx =>
        cancelActiveSupervisorRouteInTransaction(tx, cancellationInput)
      ),
      fixture.transaction.transaction(tx =>
        cancelActiveSupervisorRouteInTransaction(tx, {
          ...cancellationInput,
          reason: "Segunda tentativa concorrente de cancelamento.",
        })
      ),
    ]);

    expect(
      results.filter(result => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(
      1
    );
    expect(fixture.state.audits).toHaveLength(1);
    expect(fixture.state.rowLockCount).toBe(2);
    expect(fixture.state.route?.status).toBe("cancelled");
  });

  it("exige motivo explícito mesmo quando o serviço é chamado fora do router", async () => {
    const fixture = createTransactionalFixture();
    await expect(
      cancelActiveSupervisorRouteInTransaction(fixture.transaction, {
        ...cancellationInput,
        reason: "   ",
      })
    ).rejects.toBeInstanceOf(RouteClosureError);
    expect(fixture.state.updatedFields).toEqual([]);
    expect(fixture.state.audits).toEqual([]);
  });

  it("reverte a mudança do status se a gravação da auditoria falhar na transação", async () => {
    const fixture = createTransactionalFixture({ auditFailure: true });
    const before = structuredClone(fixture.state.route);

    await expect(
      fixture.transaction.transaction(tx =>
        cancelActiveSupervisorRouteInTransaction(tx, cancellationInput)
      )
    ).rejects.toThrow("fixture failure");
    expect(fixture.state.route).toEqual(before);
    expect(fixture.state.audits).toEqual([]);
  });
});
