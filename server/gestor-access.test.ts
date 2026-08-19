import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getGestorOperationalSnapshot: vi.fn(),
  getGestorSchedule: vi.fn(),
  replaceGestorSchedule: vi.fn(),
  getGestorPostsManagement: vi.fn(),
  createGestorPost: vi.fn(),
  getOperationalManagementReport: vi.fn(),
}));

import * as db from "./db";
import { appRouter } from "./routers";

const configuredGestorPassword = process.env.GESTOR_ACCESS_PASSWORD;

function createContext(cookie?: string) {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const context: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: cookie ? { cookie } : {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
      clearCookie: vi.fn(),
    } as TrpcContext["res"],
  };
  return { context, cookies };
}

describe("gestorAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("valida a senha única e emite uma sessão segura para o Painel do Gestor", async () => {
    expect(configuredGestorPassword).toBeTruthy();
    const { context, cookies } = createContext();
    const caller = appRouter.createCaller(context);

    await expect(caller.gestorAccess.login({ password: configuredGestorPassword! })).resolves.toEqual({ success: true });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({
      name: "gestor_access",
      options: expect.objectContaining({ httpOnly: true, maxAge: 28_800_000 }),
    });
  });

  it("bloqueia senha incorreta e libera o resumo apenas com sessão válida", async () => {
    const invalid = createContext();
    await expect(appRouter.createCaller(invalid.context).gestorAccess.login({ password: "senha-incorreta" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(appRouter.createCaller(invalid.context).gestor.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(invalid.context).gestor.dailyReport()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(invalid.context).gestor.operationalReport({ startDate: new Date("2026-08-01"), endDate: new Date("2026-08-15") })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(invalid.context).gestor.schedule()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(invalid.context).gestor.updateSchedule({ scheduleDate: new Date("2026-08-15T12:00:00"), entries: [{ supervisorId: 1, assignment: "day" }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(invalid.context).gestor.postsManagement()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(invalid.context).gestor.createPost({ routeId: 1, name: "Novo posto", region: "Jundiaí", address: "Rua das Flores, 100" })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const login = createContext();
    await appRouter.createCaller(login.context).gestorAccess.login({ password: configuredGestorPassword! });
    vi.mocked(db.getGestorOperationalSnapshot).mockResolvedValue({ activeRoutes: [], recentVisits: [], metrics: {} } as never);

    const sessionCookie = `gestor_access=${login.cookies[0]?.value}`;
    const authorizedCaller = appRouter.createCaller(createContext(sessionCookie).context);
    await expect(authorizedCaller.gestorAccess.session()).resolves.toEqual({ authenticated: true });
    await expect(authorizedCaller.gestor.dashboard()).resolves.toMatchObject({ activeRoutes: [] });
    const historicalDate = new Date("2026-08-14T12:00:00");
    await expect(authorizedCaller.gestor.dailyReport({ reportDate: historicalDate })).resolves.toMatchObject({ summary: { supervisors: 0 } });
    expect(db.getGestorOperationalSnapshot).toHaveBeenLastCalledWith(historicalDate, { includeHistoricalUsers: true });
    vi.mocked(db.getOperationalManagementReport).mockResolvedValue({ summary: { totalKm: 0 }, filterOptions: { supervisors: [], vehicles: [] }, routes: [], fuelLogs: [], visits: [] } as never);
    await expect(authorizedCaller.gestor.operationalReport({ startDate: new Date("2026-08-01"), endDate: historicalDate, supervisorId: 1, vehicleId: 8 })).resolves.toMatchObject({ summary: { totalKm: 0 } });
    expect(db.getOperationalManagementReport).toHaveBeenCalledWith(expect.objectContaining({ supervisorId: 1, vehicleId: 8 }));
    vi.mocked(db.getGestorSchedule).mockResolvedValue({ scheduleDate: historicalDate, supervisors: [] } as never);
    vi.mocked(db.replaceGestorSchedule).mockResolvedValue({ scheduleDate: historicalDate, supervisors: [] } as never);
    await expect(authorizedCaller.gestor.schedule({ scheduleDate: historicalDate })).resolves.toMatchObject({ supervisors: [] });
    await expect(authorizedCaller.gestor.updateSchedule({ scheduleDate: historicalDate, entries: [{ supervisorId: 1, assignment: "day", note: "Plantão" }] })).resolves.toMatchObject({ supervisors: [] });
    expect(db.replaceGestorSchedule).toHaveBeenCalledWith(expect.objectContaining({ entries: [expect.objectContaining({ assignment: "day" })] }));
    vi.mocked(db.getGestorPostsManagement).mockResolvedValue({ routes: [] } as never);
    vi.mocked(db.createGestorPost).mockResolvedValue({ id: 99, routeId: 1, name: "Novo posto" } as never);
    await expect(authorizedCaller.gestor.postsManagement()).resolves.toEqual({ routes: [] });
    await expect(authorizedCaller.gestor.createPost({ routeId: 1, name: "Novo posto", region: "Jundiaí", address: "Rua das Flores, 100" })).resolves.toMatchObject({ id: 99 });
  });
});
