import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  personnelEmployeeProfileSchema,
  personnelProfileFields,
} from "../shared/personnelEmployeeProfile";

const sourceFixture = {
  fileName: "rh-ficticio.xlsx",
  fileSha256: "a".repeat(64),
  sheet: "Funcionarios",
  row: 2,
  importedAt: "2026-11-05T18:00:00.000Z",
  cells: [{ column: "A", header: "Matrícula", value: "000123", kind: "string", formula: "=TEXT(A1,\"000000\")", cachedValue: "000123" }],
};

describe("personnelEmployeeProfileSchema", () => {
  it("expõe os campos declarados e preserva zeros à esquerda e identificadores imperfeitos como texto", () => {
    const parsed = personnelEmployeeProfileSchema.parse({
      fields: {
        registrationNumber: "000123",
        documentCpf: "CPF-FICTICIO-IMPERFEITO",
      },
      sources: [sourceFixture],
    });

    expect(personnelProfileFields.map(({ key }) => key)).toContain("reviewNotes");
    expect(parsed.fields.registrationNumber).toBe("000123");
    expect(parsed.fields.documentCpf).toBe("CPF-FICTICIO-IMPERFEITO");
    expect(parsed.sources?.[0]?.cells[0]?.cachedValue).toBe("000123");
  });

  it.each([
    ["data comum", "2025-02-29", false],
    ["data bissexta", "2024-02-29", true],
    ["século não bissexto", "1900-02-29", false],
    ["século bissexto", "2000-02-29", true],
    ["mês inválido", "2026-13-01", false],
    ["formato não ISO", "05/11/2026", false],
  ])("valida data civil real (%s)", (_label, date, valid) => {
    const result = personnelEmployeeProfileSchema.safeParse({ fields: { birthDate: date } });
    expect(result.success).toBe(valid);
  });

  it("limita fontes, células e tamanhos de strings", () => {
    expect(personnelEmployeeProfileSchema.safeParse({
      fields: {},
      sources: Array.from({ length: 21 }, () => sourceFixture),
    }).success).toBe(false);
    expect(personnelEmployeeProfileSchema.safeParse({
      fields: {},
      sources: [{ ...sourceFixture, cells: Array.from({ length: 101 }, () => ({ column: "A", header: "h", value: "v" })) }],
    }).success).toBe(false);
    expect(personnelEmployeeProfileSchema.safeParse({ fields: { homeStreet: "x".repeat(2_001) } }).success).toBe(false);
    expect(personnelEmployeeProfileSchema.safeParse({ fields: { unknownPersonalField: "x" } }).success).toBe(false);
    expect(personnelEmployeeProfileSchema.safeParse({ fields: {}, sources: [{ ...sourceFixture, fileSha256: "not-a-sha" }] }).success).toBe(false);
  });
});

describe("migração do profileData", () => {
  it("é aditiva, nullable e não altera identificadores/relacionamentos", () => {
    const migration = readFileSync(new URL("../drizzle-pg/0017_nifty_ulik.sql", import.meta.url), "utf8");
    expect(migration.trim()).toBe('ALTER TABLE "personnel_employees" ADD COLUMN "profileData" jsonb;');
    expect(migration).not.toMatch(/DROP|UPDATE|DELETE|RENAME|NOT NULL|REFERENCES/i);
  });
});
