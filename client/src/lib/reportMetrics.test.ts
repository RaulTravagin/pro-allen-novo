import { describe, expect, it } from "vitest";
import { countReportedOccurrences, isOccurrenceReported } from "./reportMetrics";

describe("métricas de ocorrência sobre a mesma lista de visitas", () => {
  it("considera relato preenchido ou timestamp de envio", () => {
    expect(isOccurrenceReported({ occurrenceReport: "Relato fictício" })).toBe(true);
    expect(isOccurrenceReported({ occurrenceSubmittedAt: new Date("2026-09-01T12:00:00Z") })).toBe(true);
    expect(isOccurrenceReported({ occurrenceReport: "   " })).toBe(false);
  });

  it("conta somente registros enviados", () => {
    expect(countReportedOccurrences([
      { occurrenceReport: "Ocorrência fictícia" },
      { occurrenceReport: "" },
      { occurrenceSubmittedAt: "2026-09-02T12:00:00Z" },
    ])).toBe(2);
  });
});
