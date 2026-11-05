import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { personnelFreelancerFieldsSchema, type PersonnelFreelancerFields } from "../shared/personnelFreelancer";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  importRows: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    listPersonnelFreelancers: mocks.list,
    createPersonnelFreelancer: mocks.create,
    updatePersonnelFreelancer: mocks.update,
    importPersonnelFreelancers: mocks.importRows,
  };
});

import * as db from "./db";
import { appRouter } from "./routers";

const fields: PersonnelFreelancerFields = {
  collaboratorRaw: "CONTATO FICTICIO | email@exemplo.test | (11) 90000-0000",
  jobFunction: "Posto ficticio",
  situation: "Ativo conforme texto da origem",
  hours: "07:00 às 19:00",
  posts: "0007; 0012",
  coverage: "Cobertura ficticia",
  pix: "PIX-TEXTO-FICTICIO",
  value: "R$ 1.250,00",
  supervision: "Supervisor ficticio",
  observations: "Texto bruto de teste",
};
const sourceFileSha256 = "a".repeat(64);
const importRow = {
  sourceFileSha256,
  sourceSheet: "Planilha2" as const,
  sourceRow: 5,
  fields,
  sourceData: { cells: [{ column: "A", header: "Colaborador", value: fields.collaboratorRaw, kind: "s" }] },
};

function contextFor(personnelRole: "SUPERVISOR" | "RH" | "FINANCEIRO" | "ADM"): TrpcContext {
  return {
    user: {
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
    } as TrpcContext["user"],
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

afterEach(() => vi.clearAllMocks());

describe("lista independente de freelancers", () => {
  it("mantem Colaborador integral como texto e preserva zeros/valores sem conversao", () => {
    const parsed = personnelFreelancerFieldsSchema.parse(fields);
    expect(parsed).toEqual(fields);
    expect(parsed.collaboratorRaw).toBe("CONTATO FICTICIO | email@exemplo.test | (11) 90000-0000");
    expect(parsed.posts).toBe("0007; 0012");
    expect(parsed.value).toBe("R$ 1.250,00");
    expect(personnelFreelancerFieldsSchema.safeParse({ ...fields, employeeId: 77 }).success).toBe(false);
  });

  it.each(["SUPERVISOR", "FINANCEIRO"] as const)("nega listagem, criação, edição e importação para %s", async (role) => {
    const caller = appRouter.createCaller(contextFor(role));
    await expect(caller.personnel.freelancers({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.personnel.createFreelancer(fields)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.personnel.updateFreelancer({ id: 5, ...fields })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.personnel.importFreelancers({ sourceFileSha256, rows: [importRow] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.listPersonnelFreelancers).not.toHaveBeenCalled();
    expect(db.createPersonnelFreelancer).not.toHaveBeenCalled();
    expect(db.updatePersonnelFreelancer).not.toHaveBeenCalled();
    expect(db.importPersonnelFreelancers).not.toHaveBeenCalled();
  });

  it.each(["RH", "ADM"] as const)("permite CRUD e importação idempotente por chave de origem somente a %s", async (role) => {
    const record = { id: 9, ...fields, sourceFileSha256, sourceSheet: "Planilha2", sourceRow: 5, sourceData: importRow.sourceData };
    vi.mocked(db.listPersonnelFreelancers).mockResolvedValue([record] as never);
    vi.mocked(db.createPersonnelFreelancer).mockResolvedValue(record as never);
    vi.mocked(db.updatePersonnelFreelancer).mockResolvedValue(record as never);
    vi.mocked(db.importPersonnelFreelancers).mockResolvedValue([{ sourceRow: 5, freelancerId: 9, created: false }] as never);
    const caller = appRouter.createCaller(contextFor(role));

    expect(await caller.personnel.freelancers({ sourceFileSha256 })).toEqual([record]);
    expect(await caller.personnel.createFreelancer(fields)).toEqual(record);
    expect(await caller.personnel.updateFreelancer({ id: 9, ...fields })).toEqual(record);
    expect(await caller.personnel.importFreelancers({ sourceFileSha256, rows: [importRow] })).toEqual([{ sourceRow: 5, freelancerId: 9, created: false }]);
    expect(db.createPersonnelFreelancer).toHaveBeenCalledWith(fields);
    expect(db.updatePersonnelFreelancer).toHaveBeenCalledWith(9, fields);
    expect(db.importPersonnelFreelancers).toHaveBeenCalledWith([importRow]);
  });

  it("rejeita tentativa de anexar employeeId ou linha de outro arquivo ao lote", async () => {
    const caller = appRouter.createCaller(contextFor("RH"));
    await expect(caller.personnel.createFreelancer({ ...fields, employeeId: 1 } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.personnel.importFreelancers({ sourceFileSha256, rows: [{ ...importRow, sourceFileSha256: "b".repeat(64) }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.personnel.importFreelancers({ sourceFileSha256, rows: [{ ...importRow, sourceRow: 51 }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.personnel.importFreelancers({ sourceFileSha256, rows: [importRow, importRow] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.createPersonnelFreelancer).not.toHaveBeenCalled();
    expect(db.importPersonnelFreelancers).not.toHaveBeenCalled();
  });
});
