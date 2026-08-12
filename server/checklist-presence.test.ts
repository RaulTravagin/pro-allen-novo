import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  createVisitChecklist: vi.fn(),
  createChecklistItem: vi.fn(),
  getVisitChecklistById: vi.fn(),
  getSupervisorRouteById: vi.fn(),
  getVisitChecklistsByRoute: vi.fn(),
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

describe("checklists.startNewVisit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getVisitChecklistById).mockResolvedValue({
      id: 22,
      supervisorRouteId: 11,
      postId: 3,
      status: "visited",
    } as never);
    vi.mocked(db.getSupervisorRouteById).mockResolvedValue({
      id: 11,
      supervisorId: 7,
      routeId: 1,
      status: "in_progress",
    } as never);
    vi.mocked(db.getVisitChecklistsByRoute).mockResolvedValue([
      { id: 22, status: "visited" },
    ] as never);
    vi.mocked(db.createVisitChecklist).mockResolvedValue(99);
  });

  it("prepara uma nova visita com os nove itens padrão quando a anterior foi concluída", async () => {
    const caller = appRouter.createCaller(ownerContext);

    await expect(caller.checklists.startNewVisit({ checklistId: 22 })).resolves.toEqual({ checklistId: 99 });
    expect(db.createVisitChecklist).toHaveBeenCalledWith(11, 3);
    expect(db.createChecklistItem).toHaveBeenCalledTimes(9);
  });

  it("impede nova visita enquanto houver outro posto em atendimento", async () => {
    vi.mocked(db.getVisitChecklistsByRoute).mockResolvedValue([
      { id: 22, status: "visited" },
      { id: 23, status: "in_progress" },
    ] as never);
    const caller = appRouter.createCaller(ownerContext);

    await expect(caller.checklists.startNewVisit({ checklistId: 22 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.createVisitChecklist).not.toHaveBeenCalled();
  });
});
