import { describe, expect, it } from "vitest";
import {
  brazilCivilDate,
  getPersonnelMovementWindow,
  isCivilDateInWindow,
  summarizeGestorMovements,
  summarizePersonnelMovements,
} from "../shared/personnel-movement-report";

describe("janelas civis do relatório de movimentações", () => {
  it("monta janelas inclusivas 01–15 e 16–fim usando o último dia real do mês", () => {
    expect(getPersonnelMovementWindow("2026-09", "FIRST_HALF")).toMatchObject({
      startDate: "2026-09-01", endDate: "2026-09-15", label: "01–15 · 09/2026",
    });
    expect(getPersonnelMovementWindow("2026-09", "SECOND_HALF")).toMatchObject({
      startDate: "2026-09-16", endDate: "2026-09-30", label: "16–30 · 09/2026",
    });
    expect(getPersonnelMovementWindow("2026-09", "ALL")).toMatchObject({
      startDate: "2026-09-01", endDate: "2026-09-30",
    });
    expect(getPersonnelMovementWindow("2024-02", "ALL").endDate).toBe("2024-02-29");
    expect(getPersonnelMovementWindow("2026-02", "SECOND_HALF").endDate).toBe("2026-02-28");
  });

  it("valida os limites inicial e final como inclusivos", () => {
    expect(isCivilDateInWindow("2026-09-01", "2026-09-01", "2026-09-15")).toBe(true);
    expect(isCivilDateInWindow("2026-09-15", "2026-09-01", "2026-09-15")).toBe(true);
    expect(isCivilDateInWindow("2026-08-31", "2026-09-01", "2026-09-15")).toBe(false);
    expect(isCivilDateInWindow("2026-09-16", "2026-09-01", "2026-09-15")).toBe(false);
    expect(() => getPersonnelMovementWindow("2026-13", "ALL")).toThrow();
  });

  it("usa a data civil brasileira para instantes legados sem deslocar datas civis já tipadas", () => {
    expect(brazilCivilDate("2026-09-01")).toBe("2026-09-01");
    expect(brazilCivilDate(new Date("2026-09-01T02:30:00.000Z"))).toBe("2026-08-31");
    expect(brazilCivilDate(new Date("2026-09-01T12:00:00.000Z"))).toBe("2026-09-01");
  });

  it("totaliza quantidades e valores por tipo/status apenas a partir das linhas filtradas", () => {
    const summary = summarizePersonnelMovements([
      { kind: "FT", civilDate: "2026-09-01", status: "PENDING", amount: "100.50" },
      { kind: "FT", civilDate: "2026-09-15", status: "APPROVED", amount: 200 },
      { kind: "EXTRA", civilDate: "2026-09-16", status: "PAID", amount: "50.25" },
      { kind: "EXTRA", civilDate: "2026-09-30", status: "REJECTED", amount: 25 },
      { kind: "EXTRA", civilDate: "2026-09-30", status: "REJECTED", amount: 0.1 },
      { kind: "EXTRA", civilDate: "2026-09-30", status: "REJECTED", amount: 0.2 },
    ]);
    expect(summary).toEqual({
      totalRecords: 6,
      totalAmount: 376.05,
      byKind: { FT: { count: 2, amount: 300.5 }, EXTRA: { count: 4, amount: 75.55 } },
      byStatus: {
        PENDING: { count: 1, amount: 100.5 },
        APPROVED: { count: 1, amount: 200 },
        PAID: { count: 1, amount: 50.25 },
        REJECTED: { count: 3, amount: 25.3 },
      },
    });
  });

  it("totaliza o detalhe agregado do Gestor sem valores de pagamento", () => {
    expect(summarizeGestorMovements([
      { civilDate: "2026-09-01", kind: "FT", count: 2 },
      { civilDate: "2026-09-15", kind: "EXTRA", count: 1 },
    ])).toEqual({ totalRecords: 3, byKind: { FT: 2, EXTRA: 1 } });
  });
});
