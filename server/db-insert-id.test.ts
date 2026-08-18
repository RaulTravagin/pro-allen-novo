import { describe, expect, it } from "vitest";
import { getInsertedId } from "./db";

describe("getInsertedId", () => {
  it("lê o identificador retornado pelo driver MySQL em uma tupla de resultado", () => {
    expect(getInsertedId([{ insertId: 30001 }, []])).toBe(30001);
  });

  it("rejeita retornos sem identificador válido para evitar abertura de rota com id zero", () => {
    expect(() => getInsertedId([{ insertId: 0 }, []])).toThrow("Não foi possível obter o identificador");
  });
});
