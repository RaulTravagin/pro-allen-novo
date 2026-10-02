import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getSupervisorRouteById: vi.fn(),
  getPersonnelRole: vi.fn((user: { role?: string; personnelRole?: string | null }) => user.role === "admin" ? "ADM" : (user.personnelRole ?? "SUPERVISOR")),
  getAdminSupervisorRouteStatusById: vi.fn(),
  getAdminOperationalLiveSnapshot: vi.fn(),
  getSupervisorShiftReport: vi.fn(),
  getVisitChecklistsByRoute: vi.fn(),
  getAdminVisitChecklistsByRoute: vi.fn(),
  getVisitChecklistById: vi.fn(),
  getAdminVisitChecklistById: vi.fn(),
  getCoveragePostsBySupervisorRoute: vi.fn(),
  getAdminRoutesWithoutPostCoordinates: vi.fn(),
  getAdminPostsByRouteId: vi.fn(),
  getAdminPostByIdWithoutCoordinates: vi.fn(),
  getAllRoutes: vi.fn(),
  getRouteById: vi.fn(),
  getPostById: vi.fn(),
  getPostsByRouteId: vi.fn(),
  getLastPostVisit: vi.fn(),
  calculateVisitPriority: vi.fn(() => ({ priority: "green", daysSinceVisit: 0 })),
  getLatestSupervisorLocation: vi.fn(),
  getAllSupervisorsLatestLocations: vi.fn(),
  listActiveVehicles: vi.fn(),
  getVehicleFuelSummary: vi.fn(),
  getGestorOperationalSnapshot: vi.fn(),
  getGestorOperationalKpis: vi.fn(),
  getOperationalManagementReport: vi.fn(),
  updateFuelLogAmount: vi.fn(),
  supervisorRouteCanAccessPost: vi.fn(),
  listPostPopDocuments: vi.fn(),
}));

import * as db from "./db";
import { createGestorSession } from "./gestor-access";
import { appRouter } from "./routers";

const supervisorUser: NonNullable<TrpcContext["user"]> = {
  id: 17,
  openId: "local:supervisor",
  name: "Supervisor",
  email: null,
  loginMethod: "local",
  role: "user",
  personnelRole: "SUPERVISOR",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createContext(user: TrpcContext["user"], cookie?: string): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: cookie ? { cookie } : {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const route = {
  id: 31,
  supervisorId: 17,
  routeId: 4,
  routeName: "Rota de teste",
  status: "in_progress",
  vehicleId: 8,
};

const rawVisit = {
  id: 501,
  supervisorRouteId: 31,
  postId: 14,
  status: "in_progress",
  arrivalTime: new Date("2026-10-01T09:00:00Z"),
  departureTime: null,
  occurrenceReport: "Relato de teste para consulta.",
  arrivalLatitude: "-23.5",
  arrivalLongitude: "-46.6",
  departureLatitude: null,
  departureLongitude: null,
};

const adminVisit = {
  id: rawVisit.id,
  supervisorRouteId: rawVisit.supervisorRouteId,
  postId: rawVisit.postId,
  status: rawVisit.status,
  postName: "Posto Alfa",
  arrivalTime: rawVisit.arrivalTime,
  departureTime: rawVisit.departureTime,
  occurrenceReport: "Relato de teste que não deve sair na resposta Admin.",
  observations: "Observação de teste que não deve sair na resposta Admin.",
  coverageReason: "Motivo de teste que não deve sair na resposta Admin.",
  arrivalLatitude: rawVisit.arrivalLatitude,
  arrivalLongitude: rawVisit.arrivalLongitude,
};

function createAdminContext(): TrpcContext {
  return createContext({ ...supervisorUser, id: 99, role: "admin", personnelRole: "SUPERVISOR", name: "Admin" });
}

describe("leitura operacional segmentada por perfil", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it("mantém no Admin status/horários, sem coordenadas, GPS, frota, combustível ou KM", async () => {
    vi.mocked(db.getAdminSupervisorRouteStatusById).mockResolvedValue({ ...route, kmInitial: 99999, kmFinal: 100001, vehiclePlate: "TEST-1" } as never);
    vi.mocked(db.getAdminOperationalLiveSnapshot).mockResolvedValue({
      visits: [{ postName: "Posto Alfa", status: "in_progress", arrivalTime: rawVisit.arrivalTime, departureTime: null, supervisorName: "Nome extra", routeName: "Rota extra", occurrenceReport: "Texto extra" }],
    } as never);
    vi.mocked(db.getAdminVisitChecklistsByRoute).mockResolvedValue([adminVisit] as never);
    vi.mocked(db.getAdminVisitChecklistById).mockResolvedValue(adminVisit as never);
    vi.mocked(db.getAdminRoutesWithoutPostCoordinates).mockResolvedValue([{ id: 4, name: "Rota de teste", posts: [{ id: 14, name: "Posto Alfa" }], postCount: 1 }] as never);
    vi.mocked(db.getAdminPostsByRouteId).mockResolvedValue([{ id: 14, routeId: 4, name: "Posto Alfa", address: "Rua de teste", region: "Jundiaí", order: 1, isActive: true }] as never);
    vi.mocked(db.getAdminPostByIdWithoutCoordinates).mockResolvedValue({ id: 14, routeId: 4, name: "Posto Alfa", address: "Rua de teste" } as never);
    vi.mocked(db.getLastPostVisit).mockResolvedValue(null as never);
    vi.mocked(db.getVisitChecklistsByRoute).mockResolvedValue([rawVisit] as never);
    vi.mocked(db.getVisitChecklistById).mockResolvedValue(rawVisit as never);
    vi.mocked(db.getPostsByRouteId).mockResolvedValue([{ id: 14, routeId: 4, name: "Posto Alfa", latitude: "-23.5", longitude: "-46.6" }] as never);

    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.adminOperations.liveSnapshot()).resolves.toEqual({ visits: [{ postName: "Posto Alfa", status: "in_progress", arrivalTime: rawVisit.arrivalTime, departureTime: null }] });
    await expect(caller.supervisorRoutes.getById({ id: 31 })).resolves.toEqual({ id: 31, status: "in_progress" });
    const checklistRows = await caller.checklists.getByRoute({ supervisorRouteId: 31 });
    expect(checklistRows).toEqual([{ postName: "Posto Alfa", status: "in_progress", arrivalTime: rawVisit.arrivalTime, departureTime: null }]);
    expect(Object.keys(checklistRows[0]).sort()).toEqual(["arrivalTime", "departureTime", "postName", "status"]);
    expect(checklistRows[0]).not.toHaveProperty("id");
    expect(checklistRows[0]).not.toHaveProperty("postId");
    expect(checklistRows[0]).not.toHaveProperty("arrivalLatitude");
    expect(checklistRows[0]).not.toHaveProperty("arrivalLongitude");
    expect(checklistRows[0]).not.toHaveProperty("departureLatitude");
    expect(checklistRows[0]).not.toHaveProperty("departureLongitude");
    expect(checklistRows[0]).not.toHaveProperty("occurrenceReport");
    expect(checklistRows[0]).not.toHaveProperty("observations");
    expect(checklistRows[0]).not.toHaveProperty("coverageReason");
    const visit = await caller.checklists.getById({ id: 501 });
    expect(visit).toEqual({ postName: "Posto Alfa", status: "in_progress", arrivalTime: rawVisit.arrivalTime, departureTime: null });
    expect(Object.keys(visit ?? {}).sort()).toEqual(["arrivalTime", "departureTime", "postName", "status"]);
    expect(visit).not.toHaveProperty("id");
    expect(visit).not.toHaveProperty("postId");
    expect(visit).not.toHaveProperty("arrivalLatitude");
    expect(visit).not.toHaveProperty("departureLongitude");
    expect(visit).not.toHaveProperty("occurrenceReport");
    expect(visit).not.toHaveProperty("observations");
    expect(visit).not.toHaveProperty("coverageReason");
    const posts = await caller.routes.getPostsByRoute({ routeId: 4 });
    expect(posts).toMatchObject([{ id: 14, name: "Posto Alfa" }]);
    expect(posts[0]).not.toHaveProperty("latitude");
    expect(posts[0]).not.toHaveProperty("longitude");
    const adminRoutes = await caller.routes.list();
    await expect(caller.routes.getById({ id: 4 })).resolves.toBeUndefined();
    expect(adminRoutes).toMatchObject([{ id: 4, posts: [{ id: 14, name: "Posto Alfa" }] }]);
    expect(adminRoutes[0].posts[0]).not.toHaveProperty("latitude");
    const priorityPosts = await caller.routes.getPostsWithPriority({ routeId: 4 });
    expect(priorityPosts).toMatchObject([{ id: 14, priority: "green" }]);
    expect(priorityPosts[0]).not.toHaveProperty("latitude");
    const post = await caller.posts.getById({ id: 14 });
    expect(post).toMatchObject({ id: 14, name: "Posto Alfa" });
    expect(post).not.toHaveProperty("longitude");

    await expect(caller.checklists.getCoveragePosts({ supervisorRouteId: 31 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.supervisorRoutes.getShiftReport({ supervisorRouteId: 31 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.locations.getLatest({ supervisorId: 17 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.locations.getAllLatest()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.fleet.listVehicles()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.fleet.getFuelSummary({ vehicleId: 8 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.gestor.operationalReport({ startDate: new Date("2026-10-01"), endDate: new Date("2026-10-02") })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.gestor.updateFuelAmount({ id: 70, amount: 120 })).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(db.getAdminOperationalLiveSnapshot).toHaveBeenCalledTimes(1);
    expect(db.getAdminVisitChecklistsByRoute).toHaveBeenCalledWith(31);
    expect(db.getAdminVisitChecklistById).toHaveBeenCalledWith(501);
    expect(db.getAdminPostsByRouteId).toHaveBeenCalledWith(4);
    expect(db.getAdminRoutesWithoutPostCoordinates).toHaveBeenCalledTimes(1);
    expect(db.getAdminPostByIdWithoutCoordinates).toHaveBeenCalledWith(14);
    expect(db.getVisitChecklistsByRoute).not.toHaveBeenCalled();
    expect(db.getVisitChecklistById).not.toHaveBeenCalled();
    expect(db.getPostsByRouteId).not.toHaveBeenCalled();
    expect(db.getAllRoutes).not.toHaveBeenCalled();
    expect(db.getPostById).not.toHaveBeenCalled();
    expect(db.getLatestSupervisorLocation).not.toHaveBeenCalled();
    expect(db.getAllSupervisorsLatestLocations).not.toHaveBeenCalled();
    expect(db.listActiveVehicles).not.toHaveBeenCalled();
    expect(db.getVehicleFuelSummary).not.toHaveBeenCalled();
    expect(db.getSupervisorShiftReport).not.toHaveBeenCalled();
    expect(db.getOperationalManagementReport).not.toHaveBeenCalled();
    expect(db.updateFuelLogAmount).not.toHaveBeenCalled();
  });

  it("permite ao Supervisor ler a própria posição e suas visitas completas, mas não o GPS de terceiros", async () => {
    vi.mocked(db.getSupervisorRouteById).mockResolvedValue(route as never);
    vi.mocked(db.getVisitChecklistsByRoute).mockResolvedValue([rawVisit] as never);
    vi.mocked(db.getVisitChecklistById).mockResolvedValue(rawVisit as never);
    vi.mocked(db.getLatestSupervisorLocation).mockResolvedValue({ supervisorId: 17, latitude: "-23.5", longitude: "-46.6" } as never);
    vi.mocked(db.getAllRoutes).mockResolvedValue([{ id: 4, name: "Rota de teste", posts: [{ id: 14, latitude: "-23.5", longitude: "-46.6" }] }] as never);
    vi.mocked(db.getPostsByRouteId).mockResolvedValue([{ id: 14, routeId: 4, name: "Posto Alfa", latitude: "-23.5", longitude: "-46.6" }] as never);
    vi.mocked(db.getPostById).mockResolvedValue({ id: 14, name: "Posto Alfa", latitude: "-23.5", longitude: "-46.6" } as never);
    const caller = appRouter.createCaller(createContext(supervisorUser));

    await expect(caller.checklists.getByRoute({ supervisorRouteId: 31 })).resolves.toEqual([rawVisit]);
    await expect(caller.checklists.getById({ id: 501 })).resolves.toEqual(rawVisit);
    await expect(caller.locations.getLatest({ supervisorId: 17 })).resolves.toMatchObject({ supervisorId: 17, latitude: "-23.5" });
    await expect(caller.locations.getLatest({ supervisorId: 18 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.locations.getAllLatest()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.routes.getPostsByRoute({ routeId: 4 })).resolves.toMatchObject([{ latitude: "-23.5", longitude: "-46.6" }]);
    await expect(caller.routes.list()).resolves.toMatchObject([{ posts: [{ latitude: "-23.5", longitude: "-46.6" }] }]);
    await expect(caller.routes.getById({ id: 4 })).resolves.toBeUndefined();
    await expect(caller.posts.getById({ id: 14 })).resolves.toMatchObject({ latitude: "-23.5", longitude: "-46.6" });

    expect(db.getLatestSupervisorLocation).toHaveBeenCalledTimes(1);
    expect(db.getVisitChecklistsByRoute).toHaveBeenCalledWith(31);
    expect(db.getVisitChecklistById).toHaveBeenCalledWith(501);
    expect(db.getPostsByRouteId).toHaveBeenCalledWith(4);
    expect(db.getAllRoutes).toHaveBeenCalledTimes(1);
    expect(db.getPostById).toHaveBeenCalledWith(14);
    expect(db.getAllSupervisorsLatestLocations).not.toHaveBeenCalled();
  });

  it("permite GPS agregado e consultas Gestor pela sessão Gestor, mas não libera a API Admin", async () => {
    vi.stubEnv("JWT_SECRET", "read-access-test-only-secret");
    const token = await createGestorSession();
    const caller = appRouter.createCaller(createContext(null, `gestor_access=${token}`));
    const location = { supervisorId: 17, latitude: "-23.5", longitude: "-46.6", recordedAt: new Date() };
    const snapshot = { operationalSupervisors: [{ supervisorId: 17, latestLocation: location }], activeRoutes: [], metrics: {} };
    vi.mocked(db.getLatestSupervisorLocation).mockResolvedValue(location as never);
    vi.mocked(db.getAllSupervisorsLatestLocations).mockResolvedValue([location] as never);
    vi.mocked(db.getGestorOperationalSnapshot).mockResolvedValue(snapshot as never);
    vi.mocked(db.getGestorOperationalKpis).mockResolvedValue({ inspections: {}, auditDuration: {}, fleet: {}, compliance: {} } as never);
    vi.mocked(db.listActiveVehicles).mockResolvedValue([{ id: 8, plate: "TEST123" }] as never);
    vi.mocked(db.getVehicleFuelSummary).mockResolvedValue({ latestFuelAt: null, latestMetrics: null } as never);
    vi.mocked(db.getAdminRoutesWithoutPostCoordinates).mockResolvedValue([{ id: 4, name: "Rota Gestor", posts: [{ id: 14, name: "Posto Alfa" }] }] as never);
    vi.mocked(db.getAdminPostsByRouteId).mockResolvedValue([{ id: 14, routeId: 4, name: "Posto Alfa" }] as never);
    vi.mocked(db.getAdminPostByIdWithoutCoordinates).mockResolvedValue({ id: 14, routeId: 4, name: "Posto Alfa" } as never);

    await expect(caller.locations.getLatest({ supervisorId: 17 })).resolves.toMatchObject({ latitude: "-23.5" });
    await expect(caller.locations.getAllLatest()).resolves.toMatchObject([{ supervisorId: 17, longitude: "-46.6" }]);
    await expect(caller.fleet.listVehicles()).resolves.toMatchObject([{ id: 8 }]);
    await expect(caller.fleet.getFuelSummary({ vehicleId: 8 })).resolves.toMatchObject({ latestFuelAt: null });
    await expect(caller.gestor.dashboard()).resolves.toMatchObject({ operationalSupervisors: [{ latestLocation: { latitude: "-23.5" } }] });
    await expect(caller.routes.list()).resolves.toEqual([{ id: 4, name: "Rota Gestor", posts: [{ id: 14, name: "Posto Alfa" }] }]);
    await expect(caller.routes.getById({ id: 4 })).resolves.toBeUndefined();
    const routePosts = await caller.routes.getPostsByRoute({ routeId: 4 });
    expect(routePosts).toEqual([{ id: 14, routeId: 4, name: "Posto Alfa" }]);
    expect(routePosts[0]).not.toHaveProperty("latitude");
    const catalogPost = await caller.posts.getById({ id: 14 });
    expect(catalogPost).toEqual({ id: 14, routeId: 4, name: "Posto Alfa" });
    await expect(caller.adminOperations.liveSnapshot()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.checklists.getByRoute({ supervisorRouteId: 31 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(db.getLatestSupervisorLocation).toHaveBeenCalledWith(17);
    expect(db.getAllSupervisorsLatestLocations).toHaveBeenCalledTimes(1);
    expect(db.getGestorOperationalSnapshot).toHaveBeenCalledTimes(1);
    expect(db.listActiveVehicles).toHaveBeenCalledTimes(1);
    expect(db.getVehicleFuelSummary).toHaveBeenCalledWith(8);
    expect(db.getAdminRoutesWithoutPostCoordinates).toHaveBeenCalledTimes(1);
    expect(db.getAdminPostsByRouteId).toHaveBeenCalledWith(4);
    expect(db.getAdminPostByIdWithoutCoordinates).toHaveBeenCalledWith(14);
  });

  it("nega leitura operacional a RH sem consultar GPS, frota ou dados da rota", async () => {
    const rhContext = createContext({ ...supervisorUser, id: 50, personnelRole: "RH" });
    const caller = appRouter.createCaller(rhContext);

    await expect(caller.supervisorRoutes.getById({ id: 31 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.adminOperations.liveSnapshot()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.checklists.getByRoute({ supervisorRouteId: 31 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.locations.getLatest({ supervisorId: 17 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.fleet.listVehicles()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.routes.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.routes.getById({ id: 4 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.routes.getPostsByRoute({ routeId: 4 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.posts.getById({ id: 14 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getSupervisorRouteById).not.toHaveBeenCalled();
    expect(db.getAdminOperationalLiveSnapshot).not.toHaveBeenCalled();
    expect(db.getLatestSupervisorLocation).not.toHaveBeenCalled();
    expect(db.listActiveVehicles).not.toHaveBeenCalled();
  });

  it.each(["RH", "FINANCEIRO"] as const)("nega o catálogo e monitor para o perfil %s", async (personnelRole) => {
    const user = { ...supervisorUser, id: 52, personnelRole };
    const caller = appRouter.createCaller(createContext(user));
    await expect(caller.adminOperations.liveSnapshot()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.routes.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.routes.getById({ id: 4 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.routes.getPostsByRoute({ routeId: 4 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.posts.getById({ id: 14 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getAdminOperationalLiveSnapshot).not.toHaveBeenCalled();
    expect(db.getAdminRoutesWithoutPostCoordinates).not.toHaveBeenCalled();
  });

  it("nega catálogo a chamadas anônimas", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.routes.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.routes.getById({ id: 4 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.routes.getPostsByRoute({ routeId: 4 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.posts.getById({ id: 14 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(db.getAllRoutes).not.toHaveBeenCalled();
    expect(db.getPostsByRouteId).not.toHaveBeenCalled();
    expect(db.getPostById).not.toHaveBeenCalled();
    expect(db.getRouteById).not.toHaveBeenCalled();
  });

  it("nega monitor a role=user/personnelRole=ADM, mantendo catálogo autorizado", async () => {
    const caller = appRouter.createCaller(createContext({ ...supervisorUser, id: 53, personnelRole: "ADM" }));
    vi.mocked(db.getAdminRoutesWithoutPostCoordinates).mockResolvedValue([{ id: 4, name: "Rota segura", posts: [] }] as never);
    vi.mocked(db.getAdminPostByIdWithoutCoordinates).mockResolvedValue({ id: 14, name: "Posto seguro" } as never);

    await expect(caller.adminOperations.liveSnapshot()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.routes.list()).resolves.toEqual([{ id: 4, name: "Rota segura", posts: [] }]);
    const post = await caller.posts.getById({ id: 14 });
    expect(post).toEqual({ id: 14, name: "Posto seguro" });
    expect(db.getAdminOperationalLiveSnapshot).not.toHaveBeenCalled();
    expect(db.getAllRoutes).not.toHaveBeenCalled();
    expect(db.getPostById).not.toHaveBeenCalled();
  });
});
