import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  createVisitChecklist: vi.fn(),
  createChecklistItem: vi.fn(),
  getVisitChecklistById: vi.fn(),
  getSupervisorRouteById: vi.fn(),
  getVisitChecklistsByRoute: vi.fn(),
  updateVisitChecklist: vi.fn(),
  recordPostVisit: vi.fn(),
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
    vi.mocked(db.getVisitChecklistById).mockResolvedValue({
      id: 22,
      supervisorRouteId: 11,
      postId: 3,
      status: "pending",
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

  it("executa chegada, saída e disponibiliza uma nova chegada no mesmo posto", async () => {
    const caller = appRouter.createCaller(ownerContext);

    await expect(caller.checklists.checkIn({ checklistId: 22, latitude: -23.5, longitude: -46.6 })).resolves.toMatchObject({
      success: true,
      checklistId: 22,
    });
    expect(db.updateVisitChecklist).toHaveBeenNthCalledWith(1, 22, expect.objectContaining({
      status: "in_progress",
      arrivalLatitude: -23.5,
      arrivalLongitude: -46.6,
    }));

    vi.mocked(db.getVisitChecklistById).mockResolvedValue({
      id: 22,
      supervisorRouteId: 11,
      postId: 3,
      status: "in_progress",
    } as never);
    await expect(caller.checklists.checkOut({ checklistId: 22, latitude: -23.5, longitude: -46.6 })).resolves.toMatchObject({
      success: true,
    });
    expect(db.updateVisitChecklist).toHaveBeenNthCalledWith(2, 22, expect.objectContaining({
      status: "visited",
      departureLatitude: -23.5,
      departureLongitude: -46.6,
    }));

    vi.mocked(db.getVisitChecklistById).mockResolvedValue({
      id: 22,
      supervisorRouteId: 11,
      postId: 3,
      status: "visited",
    } as never);
    await expect(caller.checklists.checkIn({ checklistId: 22 })).resolves.toMatchObject({
      success: true,
      checklistId: 99,
    });
    expect(db.createVisitChecklist).toHaveBeenCalledWith(11, 3);
    expect(db.createChecklistItem).toHaveBeenCalledTimes(9);
    expect(db.updateVisitChecklist).toHaveBeenNthCalledWith(3, 99, expect.objectContaining({ status: "in_progress" }));
  });

  it("impede uma chegada quando outro posto estiver em atendimento", async () => {
    vi.mocked(db.getVisitChecklistById).mockResolvedValue({
      id: 22,
      supervisorRouteId: 11,
      postId: 3,
      status: "visited",
    } as never);
    vi.mocked(db.getVisitChecklistsByRoute).mockResolvedValue([
      { id: 22, status: "visited" },
      { id: 23, status: "in_progress" },
    ] as never);
    const caller = appRouter.createCaller(ownerContext);

    await expect(caller.checklists.checkIn({ checklistId: 22 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.createVisitChecklist).not.toHaveBeenCalled();
  });
});
