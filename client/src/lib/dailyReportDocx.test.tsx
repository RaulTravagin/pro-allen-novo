import { Packer } from "docx";
import { describe, expect, it } from "vitest";
import { createDailyReportWordDocument } from "./dailyReportDocx";

describe("createDailyReportWordDocument", () => {
  it("gera um arquivo Word compactado e estruturado a partir do relatório diário", async () => {
    const document = createDailyReportWordDocument({
      reportDate: new Date("2026-08-13T12:00:00.000Z"),
      generatedAt: new Date("2026-08-13T18:00:00.000Z"),
      summary: { supervisors: 1, supervisorsOnRoute: 1, completedVisits: 2, pendingVisits: 1, visitsInProgress: 0, coverages: 1, kmCovered: 18.5, nonCompliantItems: 1, alerts: 1 },
      supervisors: [{
        supervisorId: 1,
        supervisorName: "Paulo Murashita",
        username: "paulo.murashita",
        operationalStatusLabel: "Em deslocamento",
        latestLocation: { latitude: "-23.10000", longitude: "-46.50000", accuracy: 12, recordedAt: new Date() },
        alerts: [{ title: "GPS desatualizado" }],
        checklistTotals: { total: 9, compliant: 8, nonCompliant: 1, unanswered: 0 },
        coverageCount: 1,
        route: {
          name: "Rota 1",
          region: "Jundiaí",
          kmInitial: 12000,
          kmFinal: 12018.5,
          kmCovered: 18.5,
          activeVisit: null,
          visits: [{ postName: "Kelvion", status: "visited", arrivalTime: new Date(), departureTime: new Date(), durationMinutes: 20, isCoverage: true, coverageReason: "Cobertura emergencial", observations: "Tudo em ordem", checklist: { total: 9, compliant: 8, nonCompliant: 1, unanswered: 0 }, checklistItems: [{ id: 1, category: "Uniforme", description: "Uniforme e apresentação pessoal", isCompliant: true, notes: "Em ordem" }, { id: 2, category: "Limpeza", description: "Limpeza e organização", isCompliant: false, notes: "Ajustar área comum" }] }],
        },
      }],
    });

    const buffer = await Packer.toBuffer(document);
    expect(buffer.byteLength).toBeGreaterThan(500);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
  });
});
