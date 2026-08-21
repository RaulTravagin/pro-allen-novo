import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getVisitChecklistById: vi.fn(),
  getSupervisorRouteById: vi.fn(),
  updateVisitChecklist: vi.fn(),
  touchSupervisorRouteFromChecklist: vi.fn(),
}));

import * as db from "./db";
import { appRouter } from "./routers";

function supervisorContext(supervisorId = 17): TrpcContext {
  return {
    user: { id: supervisorId, role: "user" } as TrpcContext["user"],
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as TrpcContext["res"],
  };
}

describe("sincronização imediata de auditoria", () => {
  it("persiste a auditoria do posto e toca a rota em andamento sem exigir KM final", async () => {
    vi.mocked(db.getVisitChecklistById).mockResolvedValue({ id: 33, supervisorRouteId: 71 } as never);
    vi.mocked(db.getSupervisorRouteById).mockResolvedValue({ id: 71, supervisorId: 17, status: "in_progress", kmFinal: null } as never);
    vi.mocked(db.updateVisitChecklist).mockResolvedValue({} as never);
    vi.mocked(db.touchSupervisorRouteFromChecklist).mockResolvedValue(undefined as never);

    const caller = appRouter.createCaller(supervisorContext());
    await expect(caller.checklists.updateDetails({ checklistId: 33, observations: "Auditoria concluída durante a rota" })).resolves.toBeDefined();

    expect(db.updateVisitChecklist).toHaveBeenCalledWith(33, expect.objectContaining({
      observations: "Auditoria concluída durante a rota",
      auditSubmittedAt: expect.any(Date),
    }));
    expect(db.touchSupervisorRouteFromChecklist).toHaveBeenCalledWith(33);
  });
});
