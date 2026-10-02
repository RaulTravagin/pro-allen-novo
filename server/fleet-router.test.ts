import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { RouteClosureError } from "./route-closure";

vi.mock("./db", () => ({
  getSupervisorRouteById: vi.fn(),
  getVehicleById: vi.fn(),
  updateSupervisorRoute: vi.fn(),
  startSupervisorRoute: vi.fn(),
  createFuelLog: vi.fn(),
  listActiveVehicles: vi.fn(),
  getVehicleFuelSummary: vi.fn(),
  upsertVehicle: vi.fn(),
  updateSupervisorFuelLog: vi.fn(),
}));

import * as db from "./db";
import { createGestorSession } from "./gestor-access";
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
  afterEach(() => vi.unstubAllEnvs());

  it("libera consultas de viaturas e resumo de combustível ao Supervisor", async () => {
    vi.mocked(db.listActiveVehicles).mockResolvedValue([{ id: 8, plate: "TEST123", model: "Veículo de teste" }] as never);
    vi.mocked(db.getVehicleFuelSummary).mockResolvedValue({ latestFuelAt: null, latestMetrics: null } as never);
    const caller = appRouter.createCaller(context);

    await expect(caller.fleet.listVehicles()).resolves.toMatchObject([{ id: 8, plate: "TEST123" }]);
    await expect(caller.fleet.getFuelSummary({ vehicleId: 8 })).resolves.toMatchObject({ latestFuelAt: null });
    expect(db.listActiveVehicles).toHaveBeenCalledTimes(1);
    expect(db.getVehicleFuelSummary).toHaveBeenCalledWith(8);
  });

  it("nega leituras de frota a Admin e RH antes do banco", async () => {
    const adminContext: TrpcContext = { ...context, user: { ...context.user!, role: "admin", personnelRole: "SUPERVISOR" } };
    const rhContext: TrpcContext = { ...context, user: { ...context.user!, personnelRole: "RH" } };

    for (const deniedContext of [adminContext, rhContext]) {
      const caller = appRouter.createCaller(deniedContext);
      await expect(caller.fleet.listVehicles()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.fleet.getFuelSummary({ vehicleId: 8 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(db.listActiveVehicles).not.toHaveBeenCalled();
    expect(db.getVehicleFuelSummary).not.toHaveBeenCalled();
  });

  it("mantém consultas explícitas de frota disponíveis à sessão Gestor", async () => {
    vi.stubEnv("JWT_SECRET", "fleet-read-test-only-secret");
    const token = await createGestorSession();
    const gestorContext: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: { cookie: `gestor_access=${token}` } } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    vi.mocked(db.listActiveVehicles).mockResolvedValue([{ id: 8, plate: "TEST123" }] as never);
    vi.mocked(db.getVehicleFuelSummary).mockResolvedValue({ latestFuelAt: null } as never);
    const caller = appRouter.createCaller(gestorContext);

    await expect(caller.fleet.listVehicles()).resolves.toMatchObject([{ id: 8 }]);
    await expect(caller.fleet.getFuelSummary({ vehicleId: 8 })).resolves.toMatchObject({ latestFuelAt: null });
  });

  it("delega a validação da viatura ativa à transação canônica", async () => {
    vi.mocked(db.startSupervisorRoute).mockRejectedValue(new RouteClosureError("BAD_REQUEST", "Viatura inválida ou indisponível"));
    const caller = appRouter.createCaller(context);

    await expect(caller.supervisorRoutes.updateKm({ id: 31, vehicleId: 8, kmInitial: 15000 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST", message: "Viatura inválida ou indisponível" });
    expect(db.startSupervisorRoute).toHaveBeenCalledWith({ supervisorRouteId: 31, supervisorId: 17, vehicleId: 8, kmInitial: 15000 });
    expect(db.updateSupervisorRoute).not.toHaveBeenCalled();
  });

  it("vincula a viatura selecionada ao registrar o KM inicial", async () => {
    vi.mocked(db.getSupervisorRouteById).mockResolvedValue({ id: 31, supervisorId: 17, status: "pending" } as never);
    vi.mocked(db.startSupervisorRoute).mockResolvedValue({ started: true, supervisorRouteId: 31 } as never);
    const caller = appRouter.createCaller(context);

    await expect(caller.supervisorRoutes.updateKm({ id: 31, vehicleId: 8, kmInitial: 15000 }))
      .resolves.toEqual({ started: true, supervisorRouteId: 31 });
    expect(db.startSupervisorRoute).toHaveBeenCalledWith({ supervisorRouteId: 31, supervisorId: 17, vehicleId: 8, kmInitial: 15000 });
    expect(db.updateSupervisorRoute).not.toHaveBeenCalled();
  });

  it("exige veículo para registrar KM inicial com a mensagem atual do servidor", async () => {
    const caller = appRouter.createCaller(context);

    await expect(caller.supervisorRoutes.updateKm({ id: 31, kmInitial: 15000 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST", message: "Informe o KM inicial e selecione a viatura para iniciar a rota" });
    expect(db.startSupervisorRoute).not.toHaveBeenCalled();
    expect(db.updateSupervisorRoute).not.toHaveBeenCalled();
  });

  it("permite editar os dados do próprio abastecimento e encaminha a confirmação de preço", async () => {
    vi.mocked(db.updateSupervisorFuelLog).mockResolvedValue({ updated: true, requiresConfirmation: false, id: 70, summary: {} } as never);
    const caller = appRouter.createCaller(context);

    await caller.fleet.updateFuel({ id: 70, odometerKm: 15180, amount: 155.89, liters: 39.071, fuelType: "gasoline", confirmPriceVariation: true });
    expect(db.updateSupervisorFuelLog).toHaveBeenCalledWith({ id: 70, odometerKm: 15180, amount: 155.89, liters: 39.071, fuelType: "gasoline", confirmPriceVariation: true, supervisorId: 17 });
  });

  it("registra abastecimento somente para rota ativa vinculada à viatura", async () => {
    vi.mocked(db.getSupervisorRouteById).mockResolvedValue({ id: 31, supervisorId: 17, status: "in_progress", vehicleId: 8, kmInitial: "15000.00" } as never);
    vi.mocked(db.createFuelLog).mockResolvedValue({ id: 70, summary: {} } as never);
    const caller = appRouter.createCaller(context);

    await caller.fleet.registerFuel({ supervisorRouteId: 31, odometerKm: 15120, amount: 150, liters: 28.5, fuelType: "gasoline" });
    expect(db.createFuelLog).toHaveBeenCalledWith(expect.objectContaining({ vehicleId: 8, supervisorRouteId: 31, supervisorId: 17, odometerKm: 15120, amount: 150, liters: 28.5 }));
  });

  it("permite cadastro de veículo pelo Supervisor", async () => {
    vi.mocked(db.upsertVehicle).mockResolvedValue({ id: 8, plate: "ABC1D23", model: "Fiat Mobi" } as never);
    const caller = appRouter.createCaller(context);

    await expect(caller.fleet.saveVehicle({ plate: "ABC1D23", model: "Fiat Mobi" }))
      .resolves.toMatchObject({ id: 8, plate: "ABC1D23" });
    expect(db.upsertVehicle).toHaveBeenCalledWith({ plate: "ABC1D23", model: "Fiat Mobi" });
  });

  it("nega cadastro de veículo a RH no servidor", async () => {
    const rhContext: TrpcContext = {
      ...context,
      user: { ...context.user!, personnelRole: "RH" },
    };
    const caller = appRouter.createCaller(rhContext);

    await expect(caller.fleet.saveVehicle({ plate: "ABC1D23", model: "Fiat Mobi" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.upsertVehicle).not.toHaveBeenCalled();
  });

  it("nega ao Admin as mutations operacionais da rota sem chamar serviços", async () => {
    const adminContext: TrpcContext = {
      ...context,
      user: { ...context.user!, role: "admin", personnelRole: "SUPERVISOR" },
    };
    const caller = appRouter.createCaller(adminContext);

    await expect(caller.fleet.saveVehicle({ plate: "ABC1D23", model: "Fiat Mobi" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.fleet.registerFuel({ supervisorRouteId: 31, odometerKm: 15120, amount: 150, liters: 28.5, fuelType: "gasoline" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.fleet.updateFuel({ id: 70, odometerKm: 15180, amount: 155.89, liters: 39.071, fuelType: "gasoline" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(db.upsertVehicle).not.toHaveBeenCalled();
    expect(db.createFuelLog).not.toHaveBeenCalled();
    expect(db.updateSupervisorFuelLog).not.toHaveBeenCalled();
  });
});
