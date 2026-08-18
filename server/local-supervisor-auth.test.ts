import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getUserByUsername: vi.fn(),
}));

import * as db from "./db";
import { hashSupervisorPassword } from "./local-supervisor-auth";
import { appRouter } from "./routers";

const configuredInitialPassword = process.env.INITIAL_SUPERVISOR_PASSWORD;
const raultravaginInitialPassword = process.env.RAULTRAVAGIN_INITIAL_PASSWORD;

function createContext() {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];
  const context: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }),
      clearCookie: (name: string, options: Record<string, unknown>) => clearedCookies.push({ name, options }),
    } as TrpcContext["res"],
  };
  return { context, cookies, clearedCookies };
}

describe("localAuth.login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("valida a senha inicial configurada e cria uma sessão segura para o supervisor", async () => {
    expect(configuredInitialPassword).toBeTruthy();
    const passwordHash = await hashSupervisorPassword(configuredInitialPassword!);
    vi.mocked(db.getUserByUsername).mockResolvedValue({
      id: 41,
      openId: "local:paulo.murashita",
      name: "Paulo Murashita",
      email: null,
      loginMethod: "local",
      username: "paulo.murashita",
      passwordHash,
      mustChangePassword: true,
      isOperational: true,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as never);

    const { context, cookies } = createContext();
    const result = await appRouter.createCaller(context).localAuth.login({
      username: "paulo.murashita",
      password: configuredInitialPassword!,
    });

    expect(result).toMatchObject({ success: true, user: { id: 41, username: "paulo.murashita" } });
    expect(cookies[0]).toMatchObject({
      name: "supervisor_access",
      options: expect.objectContaining({ httpOnly: true, maxAge: 43_200_000 }),
    });
  });

  it("valida a senha protegida configurada para a conta raultravagin", async () => {
    expect(raultravaginInitialPassword).toBeTruthy();
    const passwordHash = await hashSupervisorPassword(raultravaginInitialPassword!);
    vi.mocked(db.getUserByUsername).mockResolvedValue({
      id: 68,
      openId: "local:raultravagin",
      name: "Raul Travagin",
      email: null,
      loginMethod: "local",
      username: "raultravagin",
      passwordHash,
      mustChangePassword: true,
      isOperational: true,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as never);

    const { context, cookies } = createContext();
    const result = await appRouter.createCaller(context).localAuth.login({
      username: "raultravagin",
      password: raultravaginInitialPassword!,
    });

    expect(result).toMatchObject({ success: true, user: { id: 68, username: "raultravagin" } });
    expect(cookies[0]?.name).toBe("supervisor_access");
  });

  it("recusa senha incorreta", async () => {
    vi.mocked(db.getUserByUsername).mockResolvedValue(undefined);
    await expect(appRouter.createCaller(createContext().context).localAuth.login({
      username: "paulo.murashita",
      password: "senha-incorreta",
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("recusa uma conta desativada na operação mesmo com senha válida", async () => {
    const passwordHash = await hashSupervisorPassword(configuredInitialPassword!);
    vi.mocked(db.getUserByUsername).mockResolvedValue({
      id: 52,
      openId: "local:raul.travagin",
      name: "Raul Travagin",
      email: null,
      loginMethod: "local",
      username: "raul.travagin",
      passwordHash,
      mustChangePassword: true,
      isOperational: false,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as never);

    await expect(appRouter.createCaller(createContext().context).localAuth.login({
      username: "raul.travagin",
      password: configuredInitialPassword!,
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("encerra a sessão local removendo o cookie do supervisor", async () => {
    const { context, clearedCookies } = createContext();
    await expect(appRouter.createCaller(context).localAuth.logout()).resolves.toEqual({ success: true });
    expect(clearedCookies[0]).toMatchObject({
      name: "supervisor_access",
      options: expect.objectContaining({ httpOnly: true, maxAge: -1 }),
    });
  });
});
