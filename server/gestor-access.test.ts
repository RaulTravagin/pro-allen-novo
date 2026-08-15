import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getGestorOperationalSnapshot: vi.fn(),
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
  });
});
