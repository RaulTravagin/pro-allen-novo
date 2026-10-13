import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getAdminCancelableSupervisorRoutes: vi.fn(),
  cancelActiveSupervisorRoute: vi.fn(),
}));

import * as db from "./db";
import { RouteClosureError } from "./route-closure";
import { appRouter } from "./routers";

const routeFixture = {
  id: 731,
  routeName: "Rota Sintética A",
  routeActivityType: "field_route" as const,
  supervisorName: "Supervisor Fixture",
  status: "in_progress" as const,
  shiftType: "day" as const,
  shiftStartedAt: new Date("2026-10-13T11:00:00.000Z"),
  startedAt: new Date("2026-10-13T12:00:00.000Z"),
};

function contextFor(
  input: {
    id?: number;
    role?: "user" | "admin";
    personnelRole?: "SUPERVISOR" | "ADM" | "RH" | "FINANCEIRO";
  } = {}
): TrpcContext {
  const role = input.role ?? "user";
  return {
    user: {
      id: input.id ?? 19,
      openId: "synthetic-route-cancellation-user",
      name: "Usuário de fixture",
      email: null,
      loginMethod: "local",
      role,
      personnelRole: input.personnelRole ?? "SUPERVISOR",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const reason = "Reiniciar a operação após revisão administrativa.";

describe("adminOperations.cancelActiveRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminCancelableSupervisorRoutes).mockResolvedValue([
      routeFixture,
    ] as never);
    vi.mocked(db.cancelActiveSupervisorRoute).mockResolvedValue({
      cancelled: true,
      supervisorRouteId: 731,
      auditId: 4401,
      cancelledAt: new Date("2026-10-13T13:00:00.000Z"),
    } as never);
  });

  it("permite somente role=admin global e devolve identificação operacional mínima", async () => {
    const caller = appRouter.createCaller(
      contextFor({ role: "admin", personnelRole: "SUPERVISOR" })
    );

    await expect(
      caller.adminOperations.listCancelableRoutes()
    ).resolves.toEqual([routeFixture]);
    expect(db.getAdminCancelableSupervisorRoutes).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "Supervisor",
      { role: "user" as const, personnelRole: "SUPERVISOR" as const },
    ],
    [
      "personnelRole=ADM",
      { role: "user" as const, personnelRole: "ADM" as const },
    ],
    ["RH", { role: "user" as const, personnelRole: "RH" as const }],
  ])("nega listagem e cancelamento para %s", async (_label, profile) => {
    const caller = appRouter.createCaller(contextFor(profile));

    await expect(
      caller.adminOperations.listCancelableRoutes()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.adminOperations.cancelActiveRoute({
        supervisorRouteId: 731,
        reason,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getAdminCancelableSupervisorRoutes).not.toHaveBeenCalled();
    expect(db.cancelActiveSupervisorRoute).not.toHaveBeenCalled();
  });

  it("usa o ator autenticado e normaliza o motivo antes de chamar a transação", async () => {
    const caller = appRouter.createCaller(
      contextFor({ id: 91, role: "admin", personnelRole: "SUPERVISOR" })
    );
    const paddedReason = `  ${reason}  `;

    await expect(
      caller.adminOperations.cancelActiveRoute({
        supervisorRouteId: 731,
        reason: paddedReason,
      })
    ).resolves.toMatchObject({
      cancelled: true,
      supervisorRouteId: 731,
      auditId: 4401,
    });
    expect(db.cancelActiveSupervisorRoute).toHaveBeenCalledWith({
      supervisorRouteId: 731,
      cancelledByUserId: 91,
      reason,
    });
  });

  it.each([
    ["ausente", undefined],
    ["vazio", ""],
    ["somente espaços", "         "],
    ["curto", "erro"],
  ])(
    "rejeita motivo %s antes de chamar o banco",
    async (_label, invalidReason) => {
      const caller = appRouter.createCaller(contextFor({ role: "admin" }));
      const input =
        invalidReason === undefined
          ? { supervisorRouteId: 731 }
          : { supervisorRouteId: 731, reason: invalidReason };

      await expect(
        caller.adminOperations.cancelActiveRoute(input as never)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(db.cancelActiveSupervisorRoute).not.toHaveBeenCalled();
    }
  );

  it("propaga conflito de estado atual sem reabrir ou repetir o cancelamento", async () => {
    vi.mocked(db.cancelActiveSupervisorRoute).mockRejectedValue(
      new RouteClosureError(
        "CONFLICT",
        "Somente uma rota iniciada e ainda ativa pode ser cancelada"
      )
    );
    const caller = appRouter.createCaller(contextFor({ role: "admin" }));

    await expect(
      caller.adminOperations.cancelActiveRoute({
        supervisorRouteId: 731,
        reason,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.cancelActiveSupervisorRoute).toHaveBeenCalledTimes(1);
  });
});
