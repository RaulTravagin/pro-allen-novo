import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const connectionString = process.env.NEON_DATABASE_URL;
const pool = connectionString ? new Pool({ connectionString, ssl: { rejectUnauthorized: false } }) : null;

afterAll(async () => {
  await pool?.end();
});

describe("conexão de backup Neon", () => {
  it("executa uma consulta somente leitura antes de gerar o dump", async () => {
    expect(connectionString).toMatch(/^postgres(?:ql)?:\/\//);
    const result = await pool!.query<{ database_name: string }>("select current_database() as database_name");
    expect(result.rows[0]?.database_name).toBeTruthy();
  });
});
