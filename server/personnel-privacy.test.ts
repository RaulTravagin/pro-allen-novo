import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getPersonnelDashboardData: vi.fn(),
  listPersonnelEmployees: vi.fn(),
  getGestorPersonnelOverview: vi.fn(),
  uploadPersonnelDocument: vi.fn(),
  createPersonnelOccurrence: vi.fn(),
  reviewPersonnelOccurrence: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...mocks };
});

import { GESTOR_COOKIE_NAME, createGestorSession } from "./gestor-access";
import * as db from "./db";
import { appRouter } from "./routers";

const employeeFixture = {
  id: 81,
  name: "Funcionária de teste",
  cpf: "CPF-FICTICIO-0001",
  pixKey: "PIX-FICTICIO-0001",
  position: "Função fictícia",
  postId: 4,
  post: "Posto fictício",
  isActive: true,
};
const occurrenceFixture = {
  id: 91,
  employeeId: employeeFixture.id,
  employeeName: employeeFixture.name,
  supervisorId: 17,
  supervisorName: "Supervisor fictício",
  type: "ATESTADO",
  date: new Date("2026-01-15T12:00:00Z"),
  documentKey: "personnel/occurrences/17/fake-medical-file.pdf",
  documentUrl: "/manus-storage/personnel/occurrences/17/fake-medical-file.pdf",
  documentName: "atestado-ficticio.pdf",
  observation: "OBSERVACAO-MEDICA-FICTICIA",
  status: "PENDING",
  rejectionReason: null,
  reviewedAt: null,
  createdAt: new Date("2026-01-15T12:00:00Z"),
};
const dashboardFixture = {
  employees: [employeeFixture],
  posts: [{ id: 4, name: "Posto fictício", address: "Rua fictícia", region: "Região fictícia" }],
  fts: [{ id: 1, employeeId: 81, employeeName: employeeFixture.name, employeePixKey: "PIX-FICTICIO-0001", amount: "10.00", status: "PENDING" }],
  occurrences: [occurrenceFixture],
  extras: [{ id: 2, employeeId: 81, employeeName: employeeFixture.name, employeePixKey: "PIX-FICTICIO-0001", amount: "20.00", status: "PENDING" }],
  summary: { pendingCount: 3, pendingFinancialCount: 0, approvedAmount: 0, paidAmount: 0, employeesCount: 1 },
};
const gestorFixture = {
  employees: [employeeFixture],
  users: [{ id: 17, username: "login-ficticio" }],
  fts: dashboardFixture.fts,
  extras: dashboardFixture.extras,
  occurrences: [occurrenceFixture],
  summary: { employees: 1, activeEmployees: 1, users: 1, pending: 3, approved: 0, paid: 0 },
};

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

describe("proteção de dados pessoais nas APIs de pessoal", () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "fixture-only-secret-do-not-use-in-production";
    vi.mocked(db.getPersonnelDashboardData).mockResolvedValue(dashboardFixture as never);
    vi.mocked(db.listPersonnelEmployees).mockResolvedValue([employeeFixture] as never);
    vi.mocked(db.getGestorPersonnelOverview).mockResolvedValue(gestorFixture as never);
    vi.mocked(db.uploadPersonnelDocument).mockResolvedValue({
      key: "personnel/occurrences/17/new-fake-file.pdf",
      url: "/manus-storage/personnel/occurrences/17/new-fake-file.pdf",
      name: "novo-atestado-ficticio.pdf",
    } as never);
    vi.mocked(db.createPersonnelOccurrence).mockResolvedValue(occurrenceFixture as never);
    vi.mocked(db.reviewPersonnelOccurrence).mockResolvedValue({ ...occurrenceFixture, status: "APPROVED" } as never);
  });

  afterEach(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  it("remove CPF, PIX e documentos das respostas do Supervisor e preserva somente seu uso operacional", async () => {
    const caller = appRouter.createCaller(contextFor(userFor("SUPERVISOR")));
    const dashboard = await caller.personnel.dashboard();
    const employees = await caller.personnel.employees();

    expect(dashboard.employees?.[0]).not.toHaveProperty("cpf");
    expect(dashboard.employees?.[0]).not.toHaveProperty("pixKey");
    expect(dashboard.occurrences?.[0]).not.toHaveProperty("documentUrl");
    expect(dashboard.occurrences?.[0]).not.toHaveProperty("documentName");
    expect(dashboard.occurrences?.[0]).not.toHaveProperty("documentKey");
    expect(dashboard.fts?.[0]).not.toHaveProperty("employeePixKey");
    expect(employees[0]).not.toHaveProperty("cpf");
    expect(employees[0]).not.toHaveProperty("pixKey");

    const created = await caller.personnel.createOccurrence({
      employeeId: 81,
      type: "ATESTADO",
      date: new Date("2026-01-15T12:00:00Z"),
      document: { name: "atestado-ficticio.pdf", mimeType: "application/pdf", base64: "ZmljdGljaW8=" },
    });
    expect(created).not.toHaveProperty("documentUrl");
    expect(created).not.toHaveProperty("documentName");
    expect(created).not.toHaveProperty("documentKey");
  });

  it("não entrega roster nem ocorrências ao Financeiro e bloqueia sua rota de listagem", async () => {
    const caller = appRouter.createCaller(contextFor(userFor("FINANCEIRO")));
    const dashboard = await caller.personnel.dashboard();

    expect(dashboard.employees).toEqual([]);
    expect(dashboard.occurrences).toEqual([]);
    expect(dashboard.summary.pendingCount).toBe(2);
    expect(dashboard.fts?.[0]).not.toHaveProperty("employeePixKey");
    expect(dashboard.extras?.[0]).not.toHaveProperty("employeePixKey");
    await expect(caller.personnel.employees()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.personnel.reviewOccurrence({ id: 91, status: "APPROVED" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("preserva o acesso explícito do ADM a cadastros e revisão, sem expor a chave interna do storage", async () => {
    const caller = appRouter.createCaller(contextFor(userFor("ADM")));
    const dashboard = await caller.personnel.dashboard();
    const employees = await caller.personnel.employees();

    expect(dashboard.employees?.[0]).toMatchObject({ cpf: "CPF-FICTICIO-0001", pixKey: "PIX-FICTICIO-0001" });
    expect(dashboard.occurrences?.[0]).toHaveProperty("documentUrl", occurrenceFixture.documentUrl);
    expect(dashboard.occurrences?.[0]).not.toHaveProperty("documentKey");
    expect(employees[0]).toMatchObject({ cpf: "CPF-FICTICIO-0001", pixKey: "PIX-FICTICIO-0001" });
  });

  it("limita o endpoint de pessoal do Gestor a contagens agregadas", async () => {
    const token = await createGestorSession();
    const caller = appRouter.createCaller(contextFor(null, `${GESTOR_COOKIE_NAME}=${token}`));
    const overview = await caller.gestor.personnelOverview();

    expect(overview).toEqual({ summary: gestorFixture.summary });
    expect(overview).not.toHaveProperty("employees");
    expect(overview).not.toHaveProperty("occurrences");
    expect(JSON.stringify(overview)).not.toContain("CPF-FICTICIO-0001");
    expect(JSON.stringify(overview)).not.toContain("PIX-FICTICIO-0001");
    expect(JSON.stringify(overview)).not.toContain("fake-medical-file.pdf");
    await expect(caller.personnel.dashboard()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("mantém CPF/PIX no cadastro RH e o link do atestado na fila RH, sem expor a chave interna", async () => {
    const caller = appRouter.createCaller(contextFor(userFor("RH")));
    const dashboard = await caller.personnel.dashboard();
    const employees = await caller.personnel.employees();
    const reviewed = await caller.personnel.reviewOccurrence({ id: 91, status: "APPROVED" });

    expect(dashboard.employees?.[0]).toMatchObject({ cpf: "CPF-FICTICIO-0001", pixKey: "PIX-FICTICIO-0001" });
    expect(employees[0]).toMatchObject({ cpf: "CPF-FICTICIO-0001", pixKey: "PIX-FICTICIO-0001" });
    expect(dashboard.occurrences?.[0]).toHaveProperty("documentUrl", occurrenceFixture.documentUrl);
    expect(dashboard.occurrences?.[0]).toHaveProperty("documentName", occurrenceFixture.documentName);
    expect(dashboard.occurrences?.[0]).not.toHaveProperty("documentKey");
    expect(reviewed).toHaveProperty("documentUrl", occurrenceFixture.documentUrl);
    expect(reviewed).not.toHaveProperty("documentKey");
    expect(dashboard.fts?.[0]).not.toHaveProperty("employeePixKey");
  });
});
