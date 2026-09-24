import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearOccurrenceDraft, clearRouteDraft, readOccurrenceDraft, readRouteDraft, saveOccurrenceDraft, saveRouteDraft } from "./onlineOperationDraft";

describe("rascunhos online do turno", () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("restaura os campos em preenchimento da rota ativa", () => {
    saveRouteDraft(10, 30, { kmInitial: "15000", kmFinal: "", selectedVehicleId: "8", coveragePostId: "", coverageReason: "", fuelOdometer: "15120", fuelAmount: "150", fuelLiters: "28,5", fuelType: "gasoline" });
    expect(readRouteDraft(10, 30)).toMatchObject({ kmInitial: "15000", selectedVehicleId: "8", fuelLiters: "28,5" });
    clearRouteDraft(10, 30);
    expect(readRouteDraft(10, 30)).toBeNull();
  });

  it("mantém o relato da ocorrência até o envio ser confirmado", () => {
    saveOccurrenceDraft(10, 90, { occurrenceReport: "Acompanhar troca de uniforme" });
    expect(readOccurrenceDraft(10, 90)).toMatchObject({ occurrenceReport: "Acompanhar troca de uniforme" });
    clearOccurrenceDraft(10, 90);
    expect(readOccurrenceDraft(10, 90)).toBeNull();
  });
});
