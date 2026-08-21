import { describe, expect, it } from "vitest";
import { buildEmptyGestorKpis } from "./db";

describe("indicadores do Gestor indisponíveis", () => {
  it("retorna todos os agregados zerados mantendo o formato esperado pelo painel", () => {
    const fallback = buildEmptyGestorKpis({ shiftType: "night", supervisorId: 41 });

    expect(fallback.inspections).toEqual({ completed: 0, audited: 0, target: 0, completionRate: null });
    expect(fallback.auditDuration).toEqual({ averageMinutes: null, measuredVisits: 0 });
    expect(fallback.fleet).toEqual({ totalKm: 0, routesWithKm: 0, routesPendingKm: 0 });
    expect(fallback.compliance).toEqual({ rate: null, compliantVisits: 0, evaluatedVisits: 0, nonCompliantItems: 0 });
  });

  it("preserva o turno, o supervisor e a janela do período consultado", () => {
    const start = new Date("2026-08-18T00:00:00-03:00");
    const end = new Date("2026-08-20T00:00:00-03:00");
    const fallback = buildEmptyGestorKpis({ startDate: start, endDate: end, shiftType: "day", supervisorId: 7 });

    expect(fallback.period.shiftType).toBe("day");
    expect(fallback.period.supervisorId).toBe(7);
    expect(fallback.period.start.getTime()).toBeLessThan(fallback.period.end.getTime());
  });

  it("aceita consulta sem filtros e ainda assim entrega período válido", () => {
    const fallback = buildEmptyGestorKpis();
    expect(fallback.period.shiftType).toBeNull();
    expect(fallback.period.supervisorId).toBeNull();
    expect(fallback.period.start instanceof Date).toBe(true);
    expect(fallback.period.end instanceof Date).toBe(true);
  });
});
