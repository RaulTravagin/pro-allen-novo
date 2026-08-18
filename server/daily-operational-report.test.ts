import { describe, expect, it } from "vitest";
import { buildDailyOperationalReport } from "./daily-operational-report";

describe("buildDailyOperationalReport", () => {
  it("consolida situação, visitas, cobertura, checklist, KM e alertas por supervisor", () => {
    const report = buildDailyOperationalReport({
      operationalSupervisors: [{
        supervisorId: 7,
        supervisorName: "Paulo Murashita",
        supervisorUsername: "paulo.murashita",
        status: "em_atendimento",
        latestLocation: { latitude: "-23.12345", longitude: "-46.12345", accuracy: "12", recordedAt: new Date() },
        alerts: [{ code: "gps_stale", title: "GPS desatualizado" }],
        activities: [
          { id: 1, routeName: "Base Operacional", routeRegion: "Operação Interna", routeActivityType: "operational_base", routeStatus: "completed", startedAt: new Date("2026-08-12T09:00:00.000Z"), completedAt: new Date("2026-08-12T11:00:00.000Z"), kmInitial: "12000", kmFinal: "12008", kmCovered: 8 },
          { id: 2, routeName: "Rota 1", routeRegion: "Jundiaí", routeActivityType: "field_route", routeStatus: "in_progress", startedAt: new Date("2026-08-12T11:15:00.000Z"), kmInitial: "12008", kmFinal: null, kmCovered: null },
        ],
        route: {
          id: 2,
          routeName: "Rota 1",
          routeRegion: "Jundiaí",
          routeStatus: "in_progress",
          totalPosts: 2,
          completedVisits: 1,
          pendingVisits: 0,
          skippedVisits: 0,
          kmInitial: "12000",
          kmFinal: "12018.5",
          kmCovered: 18.5,
          checklistVisits: [
            { postName: "Kelvion", postRegion: "Jundiaí", status: "visited", isCoverage: false, checklistSummary: { total: 9, compliant: 8, nonCompliant: 1, unanswered: 0 }, checklistItems: [{ id: 1, category: "Uniforme", description: "Uniforme e apresentação pessoal", isCompliant: true, notes: "Em ordem" }, { id: 2, category: "Limpeza", description: "Limpeza e organização", isCompliant: false, notes: "Ajustar área comum" }] },
            { postName: "Cobertura Extra", postRegion: "Jundiaí", status: "in_progress", isCoverage: true, coverageReason: "Cobertura emergencial", arrivalTime: new Date(), checklistSummary: { total: 9, compliant: 0, nonCompliant: 0, unanswered: 9 } },
          ],
        },
      }],
    });

    expect(report.summary).toMatchObject({ supervisors: 1, supervisorsOnRoute: 1, completedVisits: 1, visitsInProgress: 1, coverages: 1, kmCovered: 18.5, nonCompliantItems: 1, unansweredItems: 9, alerts: 1 });
    expect(report.supervisors[0]).toMatchObject({ supervisorName: "Paulo Murashita", operationalStatusLabel: "Em atendimento", coverageCount: 1, checklistTotals: { total: 18, compliant: 8, nonCompliant: 1, unanswered: 9 } });
    expect(report.supervisors[0].route?.activeVisit).toMatchObject({ postName: "Cobertura Extra" });
    expect(report.supervisors[0].route?.visits[0]?.checklistItems).toEqual(expect.arrayContaining([expect.objectContaining({ description: "Limpeza e organização", isCompliant: false, notes: "Ajustar área comum" })]));
    expect(report.supervisors[0].activities).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Base Operacional", status: "completed", kmFinal: "12008" }), expect.objectContaining({ name: "Rota 1", status: "in_progress" })]));
  });

  it("preserva a data histórica consultada no relatório", () => {
    const reportDate = new Date("2026-08-14T12:00:00");
    const report = buildDailyOperationalReport({ reportDate, operationalSupervisors: [] });

    expect(report.reportDate).toEqual(reportDate);
  });
});
