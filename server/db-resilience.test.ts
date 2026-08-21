import { describe, expect, it } from "vitest";
import { isTransientDatabaseError } from "./db";

describe("resiliência da conexão PostgreSQL", () => {
  it("identifica códigos de rede e encerramento transitório como recuperáveis", () => {
    expect(isTransientDatabaseError({ code: "ECONNRESET" })).toBe(true);
    expect(isTransientDatabaseError({ code: "08006" })).toBe(true);
    expect(isTransientDatabaseError(new Error("Connection terminated unexpectedly"))).toBe(true);
  });

  it("não classifica erros de regra de negócio como falha transitória de banco", () => {
    expect(isTransientDatabaseError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isTransientDatabaseError(new Error("KM final não pode ser menor que o inicial"))).toBe(false);
  });
});
