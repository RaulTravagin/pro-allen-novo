import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getSupervisorRouteById: vi.fn(),
  getVehicleById: vi.fn(),
  updateSupervisorRoute: vi.fn(),
  createFuelLog: vi.fn(),
  listActiveVehicles: vi.fn(),
  getVehicleFuelSummary: vi.fn(),
  upsertVehicle: vi.fn(),
}));

import * as db from "./db";
import { appRouter } from "./routers";

const context: TrpcContext = {
  user: {
    id: 17,
    openId: "local:supervisor",
    name: "Supervisor",
    email: null,
    loginMethod: "local",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("controle de frota", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exige viatura ativa antes de iniciar uma rota", async () => {
    vi.mocked(db.getSupervisorRouteById).mockResolvedValue({ id: 31, supervisorId: 17, status: "pending" } as never);
    const caller = appRouter.createCaller(context);

    await expect(caller.supervisorRoutes.updateKm({ id: 31, kmInitial: 15000 })).rejects.toMatchObject({ message: "Selecione a viatura antes de registrar o KM inicial" });
    expect(db.updateSupervisorRoute).not.toHaveBeenCalled();
  });

  it("vincula a viatura selecionada ao registrar o KM inicial", async () => {
    vi.mocked(db.getSupervisorRouteById).mockResolvedValue({ id: 31, supervisorId: 17, status: "pending" } as never);
    vi.mocked(db.getVehicleById).mockResolvedValue({ id: 8, isActive: true, plate: "ABC1D23" } as never);
    vi.mocked(db.updateSupervisorRoute).mockResolvedValue({} as never);
    const caller = appRouter.createCaller(context);

    await caller.supervisorRoutes.updateKm({ id: 31, vehicleId: 8, kmInitial: 15000 });
    expect(db.updateSupervisorRoute).toHaveBeenCalledWith(31, expect.objectContaining({ vehicleId: 8, kmInitial: 15000, status: "in_progress" }));
  });

  it("registra abastecimento somente para rota ativa vinculada à viatura", async () => {
    vi.mocked(db.getSupervisorRouteById).mockResolvedValue({ id: 31, supervisorId: 17, status: "in_progress", vehicleId: 8, kmInitial: "15000.00" } as never);
    vi.mocked(db.createFuelLog).mockResolvedValue({ id: 70, summary: {} } as never);
    const caller = appRouter.createCaller(context);

    await caller.fleet.registerFuel({ supervisorRouteId: 31, odometerKm: 15120, amount: 150, liters: 28.5, fuelType: "gasoline" });
    expect(db.createFuelLog).toHaveBeenCalledWith(expect.objectContaining({ vehicleId: 8, supervisorRouteId: 31, supervisorId: 17, odometerKm: 15120, amount: 150, liters: 28.5 }));
  });
});
