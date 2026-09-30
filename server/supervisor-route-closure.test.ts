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

function createTransactionFixture(options: { hasPendingVisits?: boolean } = {}) {
  const route = { ...routeFixture };
  const auditRows: Array<Record<string, unknown>> = [];
  const deleteCalls: unknown[] = [];
  const checklists = Array.from({ length: 9 }, (_, index) => {
    const pending = Boolean(options.hasPendingVisits && index >= 7);
    return {
      id: index + 1,
      postId: index + 1,
      postName: `Posto fictício ${index + 1}`,
      status: pending ? "pending" : "visited",
      isCoverage: false,
      arrivalTime: pending
        ? null
        : new Date(`2026-09-30T${String(8 + index).padStart(2, "0")}:00:00.000Z`),
      departureTime: pending
        ? null
        : new Date(`2026-09-30T${String(8 + index).padStart(2, "0")}:30:00.000Z`),
      occurrenceReport: pending ? null : `Relato fictício ${index + 1}`,
      occurrenceSubmittedAt: pending
        ? null
        : new Date(`2026-09-30T${String(8 + index).padStart(2, "0")}:35:00.000Z`),
    };
  });
  const plannedPosts = checklists.map(item => ({
    id: item.postId,
    name: item.postName,
  }));
  const transaction: any = {
    select: () => ({
      from: (table: unknown) => ({
        leftJoin: () => ({
          where: async () => (table === visitChecklists ? checklists : []),
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
            if (route.status !== "in_progress") return [];
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
  return { transaction, route, checklists, auditRows, deleteCalls };
}

describe("closeSupervisorRouteInTransaction", () => {
  beforeEach(() => vi.useRealTimers());

  it("encerra sem pendências e grava auditoria estruturada com KM e resumo zerado", async () => {
    const fixture = createTransactionFixture();
    const statusesBefore = fixture.checklists.map(item => item.status);
    const result = await closeSupervisorRouteInTransaction(fixture.transaction, {
      supervisorRouteId,
      supervisorId,
      kmFinal: 340226,
    });

    expect(result).toMatchObject({
      closed: true,
      closureAudit: {
        supervisorRouteId,
        supervisorId,
        routeId: 3,
        kmFinal: 340226,
        justification: null,
        pendingSummary: {
          closureStatus: "completed",
          counts: {
            pendingPosts: 0,
            pendingVisits: 0,
            activeVisits: 0,
            unsentReports: 0,
          },
        },
      },
    });
    expect(fixture.route).toMatchObject({
      status: "completed",
      kmFinal: "340226.00",
      completedAt: expect.any(Date),
    });
    expect(fixture.auditRows).toHaveLength(1);
    expect(fixture.auditRows[0]).toMatchObject({
      supervisorRouteId,
      supervisorId,
      closedAt: expect.any(Date),
      justification: null,
      pendingSummary: { routeId: 3, kmFinal: 340226, closureStatus: "completed" },
    });
    expect(fixture.checklists.map(item => item.status)).toEqual(statusesBefore);
    expect(fixture.deleteCalls).toEqual([]);
  });

  it("encerra com visitas pendentes sem justificativa e preserva o estado e o histórico", async () => {
    const fixture = createTransactionFixture({ hasPendingVisits: true });
    const statusesBefore = fixture.checklists.map(item => item.status);
    const result = await closeSupervisorRouteInTransaction(fixture.transaction, {
      supervisorRouteId,
      supervisorId,
      kmFinal: 340226,
    });

    expect(result).toMatchObject({
      closed: true,
      closureAudit: {
        supervisorRouteId,
        supervisorId,
        routeId: 3,
        kmFinal: 340226,
        justification: null,
        pendingSummary: {
          counts: { pendingPosts: 2, pendingVisits: 2, activeVisits: 0, unsentReports: 0 },
          pendingPosts: [
            { postId: 8, postName: "Posto fictício 8", status: "pending" },
            { postId: 9, postName: "Posto fictício 9", status: "pending" },
          ],
          pendingVisits: [
            { checklistId: 8, postId: 8, postName: "Posto fictício 8", status: "pending", isCoverage: false },
            { checklistId: 9, postId: 9, postName: "Posto fictício 9", status: "pending", isCoverage: false },
          ],
        },
      },
    });
    expect(fixture.route).toMatchObject({ status: "completed", kmFinal: "340226.00" });
    expect(fixture.auditRows).toHaveLength(1);
    expect(fixture.auditRows[0]).toMatchObject({
      supervisorRouteId,
      supervisorId,
      closedAt: expect.any(Date),
      justification: null,
      pendingSummary: {
        routeId: 3,
        kmFinal: 340226,
        closureStatus: "completed",
        counts: { pendingPosts: 2, pendingVisits: 2 },
      },
    });
    expect(fixture.checklists.map(item => item.status)).toEqual(statusesBefore);
    expect(fixture.checklists.slice(-2).every(item => item.occurrenceReport === null)).toBe(true);
    expect(fixture.deleteCalls).toEqual([]);
  });

  it("rejeita KM final menor que o inicial sem concluir nem auditar", async () => {
    const fixture = createTransactionFixture({ hasPendingVisits: true });
    await expect(
      closeSupervisorRouteInTransaction(fixture.transaction, {
        supervisorRouteId,
        supervisorId,
        kmFinal: 340090,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fixture.route.status).toBe("in_progress");
    expect(fixture.auditRows).toEqual([]);
  });

  it("rejeita uma tentativa concorrente atrasada sem duplicar a auditoria", async () => {
    const fixture = createTransactionFixture();
    const input = { supervisorRouteId, supervisorId, kmFinal: 340226 };
    await expect(
      closeSupervisorRouteInTransaction(fixture.transaction, input)
    ).resolves.toMatchObject({ closed: true });

    await expect(
      closeSupervisorRouteInTransaction(fixture.transaction, input)
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(fixture.auditRows).toHaveLength(1);
    expect(fixture.route.status).toBe("completed");
  });
});
