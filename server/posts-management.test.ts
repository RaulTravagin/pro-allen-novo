import { describe, expect, it } from "vitest";
import { buildPostAddress } from "./db";

describe("gestor posts management", () => {
  it("compõe endereço completo e normaliza o CEP", () => {
    expect(
      buildPostAddress({
        addressStreet: "Avenida das Indústrias",
        addressNumber: "655",
        addressNeighborhood: "Distrito Industrial",
        addressCity: "Jundiaí",
        addressPostalCode: "13208600",
      })
    ).toBe(
      "Avenida das Indústrias, 655 — Distrito Industrial, Jundiaí — CEP 13208-600"
    );
  });

  it("rejeita CEP com quantidade inválida de dígitos", () => {
    expect(() =>
      buildPostAddress({
        addressStreet: "Rua das Flores",
        addressNumber: "100",
        addressNeighborhood: "Centro",
        addressCity: "Jundiaí",
        addressPostalCode: "1320-000",
      })
    ).toThrow("Informe um CEP válido com 8 dígitos");
  });
});
