import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  checkInVisitForRoute: vi.fn(),
  checkOutVisitForRoute: vi.fn(),
  saveSupervisorLocation: vi.fn(),
}));

import * as db from "./db";
import { appRouter } from "./routers";

const ownerContext: TrpcContext = {
  user: {
    id: 7,
    openId: "supervisor-7",
    email: "supervisor@example.com",
    name: "Supervisor",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("checklists.checkIn e checkOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delega chegada, saída e nova visita à camada transacional com o supervisor autenticado", async () => {
    const arrivalTime = new Date("2026-09-29T10:00:00.000Z");
    const departureTime = new Date("2026-09-29T11:00:00.000Z");
    vi.mocked(db.checkInVisitForRoute).mockResolvedValue({ success: true, checklistId: 22, arrivalTime } as never);
    vi.mocked(db.checkOutVisitForRoute).mockResolvedValue({ success: true, departureTime } as never);
    const caller = appRouter.createCaller(ownerContext);

    await expect(caller.checklists.checkIn({ checklistId: 22, latitude: -23.5, longitude: -46.6 })).resolves.toMatchObject({ success: true, checklistId: 22 });
    expect(db.checkInVisitForRoute).toHaveBeenCalledWith({ checklistId: 22, supervisorId: 7, latitude: -23.5, longitude: -46.6 });

    await expect(caller.checklists.checkOut({ checklistId: 22, latitude: -23.5, longitude: -46.6 })).resolves.toMatchObject({ success: true, departureTime });
    expect(db.checkOutVisitForRoute).toHaveBeenCalledWith({ checklistId: 22, supervisorId: 7, latitude: -23.5, longitude: -46.6 });
  });

  it("traduz conflito devolvido pela transação sem repetir uma verificação vulnerável no router", async () => {
    const { RouteClosureError } = await import("./route-closure");
    vi.mocked(db.checkInVisitForRoute).mockRejectedValue(new RouteClosureError("CONFLICT", "A rota foi encerrada antes da chegada"));
    const caller = appRouter.createCaller(ownerContext);

    await expect(caller.checklists.checkIn({ checklistId: 22 })).rejects.toMatchObject({ code: "CONFLICT", message: "A rota foi encerrada antes da chegada" });
    expect(db.checkInVisitForRoute).toHaveBeenCalledWith({ checklistId: 22, supervisorId: 7, latitude: undefined, longitude: undefined });
  });

  it("rejeita pares incompletos e coordenadas fora da faixa antes da persistência", async () => {
    const caller = appRouter.createCaller(ownerContext);

    await expect(caller.checklists.checkIn({ checklistId: 22, latitude: -23.5 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.checklists.checkIn({ checklistId: 22, latitude: 90.01, longitude: 0 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.checklists.checkOut({ checklistId: 22, latitude: 0, longitude: -180.01 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.checkInVisitForRoute).not.toHaveBeenCalled();
    expect(db.checkOutVisitForRoute).not.toHaveBeenCalled();
  });

  it("nega operações checklist/visita para RH mesmo autenticado", async () => {
    const rhContext: TrpcContext = {
      ...ownerContext,
      user: { ...ownerContext.user!, personnelRole: "RH" },
    };
    const caller = appRouter.createCaller(rhContext);

    await expect(caller.checklists.checkIn({ checklistId: 22 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.checklists.checkOut({ checklistId: 22 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.checklists.createForRoute({ supervisorRouteId: 31 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.checkInVisitForRoute).not.toHaveBeenCalled();
    expect(db.checkOutVisitForRoute).not.toHaveBeenCalled();
  });

  it("nega mutations de visita/localização para Admin mesmo com personnelRole Supervisor", async () => {
    const adminContext: TrpcContext = {
      ...ownerContext,
      user: { ...ownerContext.user!, role: "admin", personnelRole: "SUPERVISOR" },
    };
    const caller = appRouter.createCaller(adminContext);

    await expect(caller.checklists.checkIn({ checklistId: 22 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.checklists.checkOut({ checklistId: 22 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.checklists.createForRoute({ supervisorRouteId: 31 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.locations.record({ latitude: -23.5, longitude: -46.6 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.checkInVisitForRoute).not.toHaveBeenCalled();
    expect(db.checkOutVisitForRoute).not.toHaveBeenCalled();
    expect(db.saveSupervisorLocation).not.toHaveBeenCalled();
  });

  it("rejeita latitude ou longitude fora da faixa no endpoint de localização", async () => {
    const caller = appRouter.createCaller(ownerContext);

    await expect(caller.locations.record({ latitude: 91, longitude: 0 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.locations.record({ latitude: 0, longitude: -181 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.saveSupervisorLocation).not.toHaveBeenCalled();
  });

  it("preserva o registro sem accuracy e rejeita accuracy inválida antes da persistência", async () => {
    vi.mocked(db.saveSupervisorLocation).mockResolvedValue({ success: true } as never);
    const caller = appRouter.createCaller(ownerContext);

    await expect(caller.locations.record({ latitude: -23.5, longitude: -46.6 }))
      .resolves.toMatchObject({ success: true });
    expect(db.saveSupervisorLocation).toHaveBeenCalledWith(7, null, -23.5, -46.6, undefined);
    vi.mocked(db.saveSupervisorLocation).mockClear();

    for (const accuracy of [-1, Number.POSITIVE_INFINITY, Number.NaN]) {
      await expect(caller.locations.record({ latitude: -23.5, longitude: -46.6, accuracy }))
        .rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(db.saveSupervisorLocation).not.toHaveBeenCalled();
  });
});
