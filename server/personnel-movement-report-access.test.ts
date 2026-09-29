import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getPersonnelMovementReport: vi.fn(),
  getGestorPersonnelMovementReport: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...mocks };
});

import { GESTOR_COOKIE_NAME, createGestorSession } from "./gestor-access";
import * as db from "./db";
import { appRouter } from "./routers";

function contextFor(user: Record<string, unknown> | null, cookie = ""): TrpcContext {
  return {
    user: user as TrpcContext["user"],
    req: { protocol: "https", headers: { cookie } } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function userFor(personnelRole: "SUPERVISOR" | "RH" | "FINANCEIRO" | "ADM") {
  return {
    id: personnelRole === "SUPERVISOR" ? 17 : 23,
    openId: `fixture:${personnelRole.toLowerCase()}`,
    name: `${personnelRole} fictício`,
    username: null,
    email: null,
    loginMethod: "local",
    role: personnelRole === "ADM" ? "admin" : "user",
    personnelRole: personnelRole === "ADM" ? "ADM" : personnelRole,
    isOperational: true,
    defaultShift: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    lastSignedIn: new Date("2026-01-01T00:00:00Z"),
  } as Record<string, unknown>;
}

const privateFixture = {
  window: { month: "2026-09", period: "FIRST_HALF", startDate: "2026-09-01", endDate: "2026-09-15", label: "01–15 · 09/2026" },
  rows: [{
    kind: "FT", civilDate: "2026-09-15", employeeName: "Funcionário Fictício", position: "Vigilante", post: "Posto Centro",
    status: "APPROVED", amount: "100.00", paymentDate: new Date("2026-09-20T12:00:00Z"), reason: "Cobertura operacional",
    hoursOrDaily: "8", description: "Texto operacional", employeeId: 41, cpf: "CPF-SENSIVEL", pixKey: "PIX-SENSIVEL",
    employeePixKey: "PIX-SENSIVEL", documentUrl: "/manus-storage/private/medical.pdf", documentKey: "private/medical.pdf",
  }],
};

describe("acesso ao relatório de movimentações", () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "fixture-only-secret-do-not-use-in-production";
    vi.mocked(db.getPersonnelMovementReport).mockResolvedValue(privateFixture as never);
    vi.mocked(db.getGestorPersonnelMovementReport).mockResolvedValue({
      window: privateFixture.window,
      rows: [{ civilDate: "2026-09-15", kind: "FT", count: 1, employeeName: "Não permitido", amount: "100.00", status: "APPROVED", cpf: "CPF-SENSIVEL" }],
    } as never);
  });

  afterEach(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  it("permite ao RH consultar a janela pedida e retorna somente os campos operacionais autorizados", async () => {
    const caller = appRouter.createCaller(contextFor(userFor("RH")));
    const result = await caller.personnel.movementReport({ month: "2026-09", period: "FIRST_HALF" });
    expect(db.getPersonnelMovementReport).toHaveBeenCalledWith("2026-09", "FIRST_HALF", "RH");
    expect(result.window).toMatchObject({ startDate: "2026-09-01", endDate: "2026-09-15" });
    expect(result.rows[0]).toEqual({
      kind: "FT", civilDate: "2026-09-15", employeeName: "Funcionário Fictício", position: "Vigilante", post: "Posto Centro",
      status: "APPROVED", amount: "100.00", reason: "Cobertura operacional",
    });
    expect(JSON.stringify(result)).not.toContain("CPF-SENSIVEL");
    expect(JSON.stringify(result)).not.toContain("PIX-SENSIVEL");
    expect(JSON.stringify(result)).not.toContain("medical.pdf");
    expect(JSON.stringify(result)).not.toContain("employeeId");
  });

  it("limita o Financeiro à identificação, data, status e valores necessários ao pagamento", async () => {
    const caller = appRouter.createCaller(contextFor(userFor("FINANCEIRO")));
    const result = await caller.personnel.movementReport({ month: "2026-09", period: "SECOND_HALF" });
    expect(db.getPersonnelMovementReport).toHaveBeenCalledWith("2026-09", "SECOND_HALF", "FINANCEIRO");
    expect(result.rows[0]).toEqual({
      kind: "FT", civilDate: "2026-09-15", employeeName: "Funcionário Fictício", status: "APPROVED",
      amount: "100.00", paymentDate: new Date("2026-09-20T12:00:00Z"),
    });
    expect(result.rows[0]).not.toHaveProperty("reason");
    expect(result.rows[0]).not.toHaveProperty("post");
    expect(result.rows[0]).not.toHaveProperty("cpf");
    expect(result.rows[0]).not.toHaveProperty("pixKey");
  });

  it("nega o relatório interno de pessoal ao Supervisor, preservando o acesso separado do Gestor", async () => {
    const caller = appRouter.createCaller(contextFor(userFor("SUPERVISOR")));
    await expect(caller.personnel.movementReport({ month: "2026-09", period: "ALL" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getPersonnelMovementReport).not.toHaveBeenCalled();
  });

  it("exige a sessão exclusiva do Gestor e deixa passar apenas contagens por data/tipo", async () => {
    const token = await createGestorSession();
    const caller = appRouter.createCaller(contextFor(null, `${GESTOR_COOKIE_NAME}=${token}`));
    const result = await caller.gestor.personnelMovementReport({ month: "2026-09", period: "ALL" });
    expect(db.getGestorPersonnelMovementReport).toHaveBeenCalledWith("2026-09", "ALL");
    expect(result.rows).toEqual([{ civilDate: "2026-09-15", kind: "FT", count: 1 }]);
    expect(JSON.stringify(result)).not.toContain("amount");
    expect(JSON.stringify(result)).not.toContain("APPROVED");
    expect(JSON.stringify(result)).not.toContain("employeeName");
    expect(JSON.stringify(result)).not.toContain("CPF-SENSIVEL");

    const unauthenticated = appRouter.createCaller(contextFor(null));
    await expect(unauthenticated.gestor.personnelMovementReport({ month: "2026-09", period: "ALL" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
