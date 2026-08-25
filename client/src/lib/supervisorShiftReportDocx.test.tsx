import { describe, expect, it } from "vitest";
import { Packer } from "docx";
import { createSupervisorShiftWordDocument } from "./supervisorShiftReportDocx";

describe("createSupervisorShiftWordDocument", () => {
  it("gera um documento Word válido com o resumo do turno", async () => {
    const document = createSupervisorShiftWordDocument({
      reportDate: "2026-08-25T12:00:00.000Z",
      generatedAt: "2026-08-25T17:00:00.000Z",
      supervisor: { name: "Paulo Murashita" },
      startedAt: "2026-08-25T09:00:00.000Z",
      completedAt: "2026-08-25T17:00:00.000Z",
      metrics: { kmInitial: 12000, kmFinal: 12040, kmCovered: 40, completedVisits: 1, pendingVisits: 0, coverageCount: 1, nonCompliantItems: 0 },
      activities: [{ id: 1, routeName: "Rota 1", routeRegion: "Jundiaí", routeActivityType: "field_route", status: "completed", startedAt: "2026-08-25T09:00:00.000Z", completedAt: "2026-08-25T17:00:00.000Z", kmInitial: 12000, kmFinal: 12040, kmCovered: 40 }],
      visits: [{ postName: "Base Operacional", routeName: "Rota 1", status: "visited", isCoverage: true, coverageReason: "Apoio operacional", arrivalTime: "2026-08-25T12:00:00.000Z", departureTime: "2026-08-25T12:30:00.000Z", observations: null, checklistSummary: { total: 0 } }],
      fuelLogs: [],
      observations: [{ type: "coverage", postName: "Base Operacional", text: "Apoio operacional" }],
    });
    const blob = await Packer.toBlob(document);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(100);
    expect(String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0)).toBe("PK");
  });
});
