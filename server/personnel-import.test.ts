import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { PersonnelImportPayload } from "../shared/personnelImport";
import { personnelImportPayloadSchema } from "../shared/personnelImport";

const mocks = vi.hoisted(() => ({
  listPersonnelImportBatches: vi.fn(),
  getPersonnelImportBatch: vi.fn(),
  upsertPersonnelImportBatch: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...mocks };
});

import * as db from "./db";
import { appRouter } from "./routers";

const payload: PersonnelImportPayload = {
  fileName: "importacao-ficticia.xlsx",
  fileSha256: "a".repeat(64),
  summary: { sourceEmployees: 2, created: 1, updated: 0, pending: 1, warnings: 0, unlinkedContacts: 1, freelancersImported: 0, freelancersPending: 0 },
  sheets: [{
    name: "PRIMEIRO PEDIDO",
    headerRow: 1,
    rows: [
      { row: 2, status: "IMPORTED", employeeId: 12, reasons: [], cells: [{ column: "A", header: "Nome", value: "Registro ficticio" }] },
      { row: 3, status: "PENDING", reasons: ["Conferencia manual"], cells: [{ column: "B", header: "Contato", value: "Contato sem identificador" }] },
      { row: 4, status: "REFERENCE", reasons: [], cells: [{ column: "C", header: "Referencia", value: "Registro de referencia ficticio" }] },
    ],
  }],
};

const metadata = {
  id: 7,
  fileName: payload.fileName,
  fileSha256: payload.fileSha256,
  summary: payload.summary,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

function contextFor(user: Record<string, unknown> | null): TrpcContext {
  return {
    user: user as TrpcContext["user"],
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function userFor(personnelRole: "SUPERVISOR" | "RH" | "FINANCEIRO" | "ADM") {
  return {
    id: personnelRole === "SUPERVISOR" ? 17 : 23,
    openId: `fixture:${personnelRole.toLowerCase()}`,
    name: `${personnelRole} ficticio`,
    username: null,
    email: null,
    loginMethod: "local",
    role: personnelRole === "ADM" ? "admin" : "user",
    personnelRole: personnelRole === "ADM" ? "ADM" : personnelRole,
    isOperational: true,
    defaultShift: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
  } as Record<string, unknown>;
}

describe("personnelImportPayloadSchema", () => {
  it("aceita payload tipado e preserva valores textuais, formulas, status e rows sem associacao inventada", () => {
    const parsed = personnelImportPayloadSchema.parse(payload);
    expect(parsed).toEqual(payload);
    expect(parsed.sheets[0]?.rows[1]?.employeeId).toBeUndefined();
    expect(parsed.sheets[0]?.rows[1]?.cells[0]?.value).toBe("Contato sem identificador");
  });

  it("rejeita objetos desconhecidos em todos os niveis do contrato", () => {
    const cases = [
      { ...payload, extra: true },
      { ...payload, summary: { ...payload.summary, extra: 1 } },
      { ...payload, sheets: [{ ...payload.sheets[0]!, extra: true }] },
      { ...payload, sheets: [{ ...payload.sheets[0]!, rows: [{ ...payload.sheets[0]!.rows[0]!, extra: true }] }] },
      { ...payload, sheets: [{ ...payload.sheets[0]!, rows: [{ ...payload.sheets[0]!.rows[0]!, cells: [{ ...payload.sheets[0]!.rows[0]!.cells[0]!, extra: true }] }] }] },
    ];
    for (const candidate of cases) expect(personnelImportPayloadSchema.safeParse(candidate).success).toBe(false);
  });

  it("distingue freelancerId em Planilha2 de employeeId e preserva notas como pendentes", () => {
    const freelancerPayload: PersonnelImportPayload = {
      ...payload,
      summary: { ...payload.summary, freelancersImported: 1, freelancersPending: 0 },
      sheets: [{ name: "Planilha2", headerRow: 3, rows: [
        { row: 5, status: "IMPORTED", freelancerId: 44, reasons: ["Lista separada"], cells: [{ column: "A", header: "Colaborador", value: "Texto bruto fictício" }] },
        { row: 51, status: "PENDING", reasons: ["Nota preservada"], cells: [{ column: "F", header: "Obs.", value: "Nota fictícia sem vínculo" }] },
      ] }],
    };
    const parsed = personnelImportPayloadSchema.parse(freelancerPayload);
    expect(parsed.sheets[0]?.rows[0]?.freelancerId).toBe(44);
    expect(parsed.sheets[0]?.rows[0]?.employeeId).toBeUndefined();
    expect(parsed.sheets[0]?.rows[1]?.status).toBe("PENDING");
    expect(personnelImportPayloadSchema.safeParse({ ...freelancerPayload, sheets: [{ ...freelancerPayload.sheets[0]!, rows: [{ ...freelancerPayload.sheets[0]!.rows[0]!, employeeId: 44 }] }] }).success).toBe(false);
    expect(personnelImportPayloadSchema.safeParse({ ...freelancerPayload, sheets: [{ ...freelancerPayload.sheets[0]!, rows: [{ ...freelancerPayload.sheets[0]!.rows[0]!, row: 51 }] }] }).success).toBe(false);
  });

  it("aplica limites de contagens, texto de celula e razoes", () => {
    expect(personnelImportPayloadSchema.safeParse({ ...payload, sheets: Array.from({ length: 11 }, () => payload.sheets[0]) }).success).toBe(false);
    expect(personnelImportPayloadSchema.safeParse({ ...payload, sheets: [{ ...payload.sheets[0]!, rows: Array.from({ length: 5_001 }, () => payload.sheets[0]!.rows[0]) }] }).success).toBe(false);
    expect(personnelImportPayloadSchema.safeParse({ ...payload, sheets: [{ ...payload.sheets[0]!, rows: [{ ...payload.sheets[0]!.rows[0]!, cells: Array.from({ length: 101 }, () => payload.sheets[0]!.rows[0]!.cells[0]) }] }] }).success).toBe(false);
    expect(personnelImportPayloadSchema.safeParse({ ...payload, sheets: [{ ...payload.sheets[0]!, rows: [{ ...payload.sheets[0]!.rows[0]!, cells: [{ column: "A", header: "h", value: "x".repeat(4_001) }] }] }] }).success).toBe(false);
    expect(personnelImportPayloadSchema.safeParse({ ...payload, sheets: [{ ...payload.sheets[0]!, rows: [{ ...payload.sheets[0]!.rows[0]!, reasons: Array.from({ length: 31 }, () => "motivo") }] }] }).success).toBe(false);
    expect(personnelImportPayloadSchema.safeParse({ ...payload, sheets: [{ ...payload.sheets[0]!, rows: [{ ...payload.sheets[0]!.rows[0]!, reasons: ["x".repeat(301)] }] }] }).success).toBe(false);
  });

  it("rejeita payload total acima de 8 MiB", () => {
    const oversized = { ...payload, sheets: [{ ...payload.sheets[0]!, name: "x".repeat(8 * 1024 * 1024) }] };
    expect(personnelImportPayloadSchema.safeParse(oversized).success).toBe(false);
  });
});

describe("API privada de historico de importacao", () => {
  afterEach(() => vi.clearAllMocks());

  it.each(["SUPERVISOR", "FINANCEIRO"] as const)("nega listagem, detalhe e registro para %s", async (role) => {
    const caller = appRouter.createCaller(contextFor(userFor(role)));
    await expect(caller.personnel.importBatches()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.personnel.importBatch({ id: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.personnel.recordImportBatch(payload)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.listPersonnelImportBatches).not.toHaveBeenCalled();
    expect(db.getPersonnelImportBatch).not.toHaveBeenCalled();
    expect(db.upsertPersonnelImportBatch).not.toHaveBeenCalled();
  });

  it.each(["RH", "ADM"] as const)("restringe metadata e permite detalhe completo somente a %s", async (role) => {
    const fullRecord = { ...metadata, createdBy: 23, sourceData: payload };
    vi.mocked(db.listPersonnelImportBatches).mockResolvedValue([metadata] as never);
    vi.mocked(db.getPersonnelImportBatch).mockResolvedValue(fullRecord as never);
    vi.mocked(db.upsertPersonnelImportBatch).mockResolvedValue(metadata as never);
    const caller = appRouter.createCaller(contextFor(userFor(role)));

    const listed = await caller.personnel.importBatches();
    expect(listed).toEqual([metadata]);
    expect(listed[0]).not.toHaveProperty("sourceData");
    expect(listed[0]).not.toHaveProperty("createdBy");

    const detailed = await caller.personnel.importBatch({ id: 7 });
    expect(detailed).toEqual(fullRecord);
    expect(detailed?.sourceData).toEqual(payload);

    const recorded = await caller.personnel.recordImportBatch(payload);
    expect(recorded).toEqual(metadata);
    expect(recorded).not.toHaveProperty("sourceData");
    expect(db.upsertPersonnelImportBatch).toHaveBeenCalledWith(payload, userFor(role).id);
  });

  it("rejeita input detalhado com campos adicionais", async () => {
    const caller = appRouter.createCaller(contextFor(userFor("RH")));
    await expect(caller.personnel.importBatch({ id: 7, extra: true } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.getPersonnelImportBatch).not.toHaveBeenCalled();
  });
});
