import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getRouteById: vi.fn(),
  getSupervisorRoutesToday: vi.fn(),
  createSupervisorRoute: vi.fn(),
  getSupervisorRouteById: vi.fn(),
  getVisitChecklistsByRoute: vi.fn(),
  getPostsByRouteId: vi.fn(),
  createVisitChecklist: vi.fn(),
  createChecklistItem: vi.fn(),
}));

import * as db from "./db";
import { appRouter } from "./routers";

const localSupervisorContext: TrpcContext = {
  user: {
    id: 3_270_009,
    openId: "local:paulo.murashita",
    name: "Paulo Murashita",
    email: null,
    loginMethod: "local",
    username: "paulo.murashita",
    passwordHash: "hash-de-teste",
    mustChangePassword: true,
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("preparação de rota para supervisor local", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getRouteById).mockResolvedValue({ id: 1, name: "Rota 1" } as never);
    vi.mocked(db.getSupervisorRoutesToday).mockResolvedValue([] as never);
    vi.mocked(db.createSupervisorRoute).mockResolvedValue(30_001);
    vi.mocked(db.getSupervisorRouteById).mockResolvedValue({ id: 30_001, supervisorId: 3_270_009, routeId: 1 } as never);
    vi.mocked(db.getVisitChecklistsByRoute).mockResolvedValue([] as never);
    vi.mocked(db.getPostsByRouteId).mockResolvedValue([{ id: 11, name: "Kelvion" }] as never);
    vi.mocked(db.createVisitChecklist).mockResolvedValue(701);
    vi.mocked(db.createChecklistItem).mockResolvedValue(1);
  });

  it("cria uma rota com id válido e prepara seus checklists sem NOT_FOUND", async () => {
    const caller = appRouter.createCaller(localSupervisorContext);

    const supervisorRouteId = await caller.supervisorRoutes.create({ routeId: 1, date: new Date() });
    await expect(caller.checklists.createForRoute({ supervisorRouteId })).resolves.toEqual([701]);

    expect(supervisorRouteId).toBe(30_001);
    expect(db.getSupervisorRouteById).toHaveBeenCalledWith(30_001);
    expect(db.createVisitChecklist).toHaveBeenCalledWith(30_001, 11);
  });

  it("prepara a Base Operacional sem gerar postos ou checklists fictícios", async () => {
    vi.mocked(db.getRouteById).mockResolvedValue({ id: 50_001, name: "Base Operacional", activityType: "operational_base" } as never);
    vi.mocked(db.createSupervisorRoute).mockResolvedValue(50_101);
    vi.mocked(db.getSupervisorRouteById).mockResolvedValue({ id: 50_101, supervisorId: 3_270_009, routeId: 50_001, routeActivityType: "operational_base" } as never);
    vi.mocked(db.getPostsByRouteId).mockResolvedValue([] as never);

    const caller = appRouter.createCaller(localSupervisorContext);
    const supervisorRouteId = await caller.supervisorRoutes.create({ routeId: 50_001, date: new Date() });

    await expect(caller.checklists.createForRoute({ supervisorRouteId })).resolves.toEqual([]);
    expect(supervisorRouteId).toBe(50_101);
    expect(db.createVisitChecklist).not.toHaveBeenCalled();
  });

  it("permite iniciar uma rota de campo após a Base Operacional concluída no mesmo dia", async () => {
    const completedBase = { id: 50_101, supervisorId: 3_270_009, routeId: 50_001, routeActivityType: "operational_base", status: "completed" };
    vi.mocked(db.getSupervisorRoutesToday).mockResolvedValue([completedBase] as never);
    vi.mocked(db.getRouteById).mockResolvedValue({ id: 1, name: "Rota 1", activityType: "field_route" } as never);
    vi.mocked(db.createSupervisorRoute).mockResolvedValue(30_002);

    const caller = appRouter.createCaller(localSupervisorContext);
    await expect(caller.supervisorRoutes.getTodayRoute()).resolves.toBeNull();
    await expect(caller.supervisorRoutes.getTodayHistory()).resolves.toEqual([completedBase]);
    await expect(caller.supervisorRoutes.create({ routeId: 1, date: new Date() })).resolves.toBe(30_002);
    expect(db.createSupervisorRoute).toHaveBeenCalledWith(3_270_009, 1, expect.any(Date));
  });
});
