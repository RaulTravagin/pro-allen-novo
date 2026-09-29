import { describe, expect, it } from "vitest";
import { personnelEmployeeEmptyState } from "./personnelEmptyState";

describe("estado vazio de funcionários", () => {
  it("orienta o cadastro no RH quando não há funcionários", () => {
    expect(personnelEmployeeEmptyState(0)).toEqual({
      title: "Nenhum funcionário cadastrado",
      description: "O RH ainda não cadastrou a base de colaboradores. Cadastre um funcionário na aba Funcionários antes de lançar registros.",
    });
  });

  it("não mostra estado vazio quando existe base cadastrada", () => {
    expect(personnelEmployeeEmptyState(1)).toBeNull();
  });
});
