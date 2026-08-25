import { describe, expect, it } from "vitest";
import { buildSupervisorShiftPdfInput } from "./supervisorShiftReportAdapters";

describe("buildSupervisorShiftPdfInput", () => {
  it("preserva atividades, justificativas e resumo da jornada", () => {
    const input = buildSupervisorShiftPdfInput({
      reportDate: "2026-08-25T12:00:00.000Z",
      generatedAt: "2026-08-25T17:00:00.000Z",
      shiftType: "day",
      startedAt: "2026-08-25T09:00:00.000Z",
      completedAt: "2026-08-25T17:00:00.000Z",
      supervisor: { name: "Paulo Murashita", username: "paulo.murashita" },
      metrics: { kmInitial: 12000, kmFinal: 12040, kmCovered: 40, totalVisits: 2, completedVisits: 2, coverageCount: 1, nonCompliantItems: 1, observationCount: 2, fuelCount: 1, fuelAmount: 100, fuelLiters: 12 },
      activities: [
        { id: 1, routeActivityType: "operational_base", routeName: "Base", routeRegion: "Interna", shiftType: "day", status: "completed", startedAt: "2026-08-25T09:00:00.000Z", completedAt: "2026-08-25T10:00:00.000Z", kmInitial: 12000, kmFinal: 12005, kmCovered: 5 },
        { id: 2, routeActivityType: "field_route", routeName: "Rota 1", routeRegion: "Jundiaí", shiftType: "day", status: "completed", startedAt: "2026-08-25T10:05:00.000Z", completedAt: "2026-08-25T17:00:00.000Z", kmInitial: 12005, kmFinal: 12040, kmCovered: 35 },
      ],
      visits: [{ supervisorRouteId: 2, postName: "Posto Extra", postRegion: "Jundiaí", status: "visited", isCoverage: true, coverageReason: "Cobertura emergencial", observations: "Acompanhamento realizado", checklistItems: [] }],
    });

    expect(input.sections.map((section) => section.routeName)).toEqual(["Base Operacional", "Rota 1"]);
    expect(input.sections[1]?.visits[0]).toMatchObject({ postName: "Posto Extra", coverageReason: "Cobertura emergencial", isCoverage: true });
    expect(input.executiveMetrics?.[0]?.value).toContain("40");
    expect(input.fileName).toMatch(/relatorio-turno-paulo-murashita-2026-08-25\.pdf$/);
  });
});
