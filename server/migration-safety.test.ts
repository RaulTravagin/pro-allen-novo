import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationDirectory = join(process.cwd(), "drizzle-pg");

function migrationSqlFiles() {
  return readdirSync(migrationDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .map((fileName) => ({ fileName, sql: readFileSync(join(migrationDirectory, fileName), "utf8") }));
}

describe("segurança das migrations PostgreSQL", () => {
  it("não contém truncamento, exclusão de tabela/coluna ou DELETE em migrations", () => {
    const destructiveSql = /^\s*(?:truncate\b|drop\s+(?:table|column)\b|delete\s+from\b)/im;
    const offendingFiles = migrationSqlFiles()
      .filter(({ sql }) => destructiveSql.test(sql))
      .map(({ fileName }) => fileName);

    expect(offendingFiles).toEqual([]);
  });

  it("cria freelancers numa tabela aditiva, sem employeeId nem FK para empregados", () => {
    const schema = readFileSync(join(process.cwd(), "drizzle/schema.ts"), "utf8");
    const freelancerDefinition = schema.match(/export const personnelFreelancers = pgTable\([\s\S]*?^\}\)\);/m);
    const migration = readFileSync(join(migrationDirectory, "0019_personnel_freelancers.sql"), "utf8");
    expect(freelancerDefinition?.[0]).toBeTruthy();
    expect(freelancerDefinition?.[0]).not.toMatch(/\bemployeeId\b|references\(/i);
    expect(migration).toMatch(/CREATE TABLE "personnel_freelancers"/);
    expect(migration).not.toMatch(/employeeId|FOREIGN KEY/i);
  });
});
