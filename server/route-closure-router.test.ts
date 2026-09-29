import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { RouteClosureError } from "./route-closure";

vi.mock("./db", () => ({
  closeSupervisorRoute: vi.fn(),
  getSupervisorRouteById: vi.fn(),
  getSupervisorShiftReport: vi.fn(),
  updateSupervisorRoute: vi.fn(),
  markVisitVisitedForActiveRoute: vi.fn(),
}));

import * as db from "./db";
import { appRouter } from "./routers";

const userContext: TrpcContext = {
  user: {
    id: 7,
    openId: "supervisor-7",
    email: "supervisor@example.com",
    name: "Supervisor 7",
    loginMethod: "local",
    role: "user",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
  },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

const pendingSummary = {
  routeStatus: "in_progress",
  totalPlannedPosts: 1,
  pendingPosts: [{ postId: 4, postName: "Posto Norte", status: "pending" }],
  pendingVisits: [{ checklistId: 10, postId: 4, postName: "Posto Norte", status: "pending", isCoverage: false }],
  activeVisits: [],
  unsentReports: [],
  counts: { pendingPosts: 1, pendingVisits: 1, activeVisits: 0, unsentReports: 0 },
};

describe("supervisorRoutes.finishShift", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não fecha com pendências sem justificativa e devolve snapshot para solicitar exceção", async () => {
    vi.mocked(db.closeSupervisorRoute).mockResolvedValue({
      closed: false,
      requiresExceptionJustification: true,
      pendingSummary,
    } as never);
    const caller = appRouter.createCaller(userContext);

    await expect(caller.supervisorRoutes.finishShift({ supervisorRouteId: 11, kmFinal: 140 })).resolves.toEqual({
      closed: false,
      requiresExceptionJustification: true,
      pendingSummary,
    });
    expect(db.closeSupervisorRoute).toHaveBeenCalledWith({
      supervisorRouteId: 11,
      supervisorId: 7,
      kmFinal: 140,
      exceptionJustification: undefined,
    });
    expect(db.getSupervisorShiftReport).not.toHaveBeenCalled();
  });

  it("usa o ID autenticado (nunca um supervisor informado pelo cliente) e oculta rota de outro supervisor", async () => {
    vi.mocked(db.closeSupervisorRoute).mockRejectedValue(new RouteClosureError("NOT_FOUND", "Rota não encontrada para este supervisor"));
    const caller = appRouter.createCaller(userContext);

    await expect(caller.supervisorRoutes.finishShift({ supervisorRouteId: 22, kmFinal: 140 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.closeSupervisorRoute).toHaveBeenCalledWith(expect.objectContaining({ supervisorRouteId: 22, supervisorId: 7 }));
    expect(db.getSupervisorShiftReport).not.toHaveBeenCalled();
  });

  it("encaminha justificativa exigida ao caminho canônico e retorna a auditoria após encerrar", async () => {
    const closedAt = new Date("2026-09-28T16:30:00.000Z");
    const exceptionAudit = { supervisorRouteId: 11, supervisorId: 7, closedAt, justification: "Encerramento solicitado por pane do veículo.", pendingSummary };
    vi.mocked(db.closeSupervisorRoute).mockResolvedValue({ closed: true, exceptionAudit } as never);
    vi.mocked(db.getSupervisorShiftReport).mockResolvedValue({ status: "completed", metrics: { kmFinal: 140 } } as never);
    const caller = appRouter.createCaller(userContext);

    await expect(caller.supervisorRoutes.finishShift({
      supervisorRouteId: 11,
      kmFinal: 140,
      exceptionJustification: exceptionAudit.justification,
    })).resolves.toEqual({ closed: true, exceptionAudit, report: { status: "completed", metrics: { kmFinal: 140 } } });
    expect(db.closeSupervisorRoute).toHaveBeenCalledWith(expect.objectContaining({ supervisorId: 7, exceptionJustification: exceptionAudit.justification }));
  });

  it("rejeita justificativa insuficiente antes de chegar ao serviço de encerramento", async () => {
    const caller = appRouter.createCaller(userContext);
    await expect(caller.supervisorRoutes.finishShift({ supervisorRouteId: 11, kmFinal: 140, exceptionJustification: "curta" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.closeSupervisorRoute).not.toHaveBeenCalled();
  });

  it("rejeita tentativas de encerrar por updateKm", async () => {
    vi.mocked(db.getSupervisorRouteById).mockResolvedValue({ id: 11, supervisorId: 7, status: "in_progress", kmInitial: 100 } as never);
    const caller = appRouter.createCaller(userContext);

    await expect(caller.supervisorRoutes.updateKm({ id: 11, kmFinal: 140 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.updateSupervisorRoute).not.toHaveBeenCalled();
  });

  it("não permite alterar quilometragem nem viatura após a rota concluída", async () => {
    vi.mocked(db.getSupervisorRouteById).mockResolvedValue({ id: 11, supervisorId: 7, status: "completed", kmInitial: "100" } as never);
    const caller = appRouter.createCaller(userContext);

    await expect(caller.supervisorRoutes.updateKm({ id: 11, kmInitial: 120, vehicleId: 5 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.updateSupervisorRoute).not.toHaveBeenCalled();
  });
});

describe("checklists.markVisited legado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não altera registro quando a rota já foi concluída", async () => {
    vi.mocked(db.markVisitVisitedForActiveRoute).mockRejectedValue(new RouteClosureError("CONFLICT", "Não é possível alterar visitas depois do encerramento da rota"));
    const caller = appRouter.createCaller(userContext);

    await expect(caller.checklists.markVisited({ checklistId: 10, occurrenceReport: "Registro de visita concluído." })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.markVisitVisitedForActiveRoute).toHaveBeenCalledWith({ checklistId: 10, supervisorId: 7, occurrenceReport: "Registro de visita concluído." });
  });

  it("não repassa timestamps adulterados do cliente e usa somente identidade autenticada", async () => {
    const serverNow = new Date("2026-09-29T12:00:00.000Z");
    const forgedTime = new Date("2001-01-01T00:00:00.000Z");
    vi.mocked(db.markVisitVisitedForActiveRoute).mockResolvedValue({ success: true, completedAt: serverNow } as never);
    const caller = appRouter.createCaller(userContext);

    await caller.checklists.markVisited({ checklistId: 10, occurrenceReport: "Visita conferida e relatório enviado.", arrivalTime: forgedTime, departureTime: forgedTime } as any);

    expect(db.markVisitVisitedForActiveRoute).toHaveBeenCalledWith({
      checklistId: 10,
      supervisorId: 7,
      occurrenceReport: "Visita conferida e relatório enviado.",
    });
    expect(db.markVisitVisitedForActiveRoute).not.toHaveBeenCalledWith(expect.objectContaining({ arrivalTime: forgedTime, departureTime: forgedTime }));
  });

  it("não permite que um Supervisor registre visita de rota de outra pessoa", async () => {
    vi.mocked(db.markVisitVisitedForActiveRoute).mockRejectedValue(new RouteClosureError("NOT_FOUND", "Rota não encontrada para este supervisor"));
    const caller = appRouter.createCaller(userContext);

    await expect(caller.checklists.markVisited({ checklistId: 10, occurrenceReport: "Relato suficiente para teste." })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.markVisitVisitedForActiveRoute).toHaveBeenCalledWith({ checklistId: 10, supervisorId: 7, occurrenceReport: "Relato suficiente para teste." });
  });
});
