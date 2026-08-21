import { describe, expect, it } from "vitest";
import { buildOperationalReportCsv } from "./OperationalReports";

describe("relatório operacional CSV", () => {
  it("inclui contexto executivo e colunas operacionais em português no arquivo exportado", () => {
    const csv = buildOperationalReportCsv({
      filters: { startDate: new Date("2026-08-01T12:00:00"), endDate: new Date("2026-08-15T12:00:00"), shiftType: "night", supervisorId: 4, vehicleId: 6 },
      filterOptions: { supervisors: [{ id: 4, name: "Paulo" }], vehicles: [{ id: 6, plate: "ABC1D23", model: "Fiat Mobi" }] },
      summary: { totalKm: 240, totalFuelAmount: 360, averageConsumptionKmPerLiter: 8.5, inspections: 4, plannedPosts: 6, auditedPosts: 4, nonCompliantItems: 1, complianceRate: 90 },
      routes: [{ id: 30, routeName: "Rota 1", shiftType: "night", kmInitial: 15000, kmFinal: 15240, kmCovered: 240 }],
      fuelLogs: [{ createdAt: new Date("2026-08-10T10:00:00"), vehiclePlate: "ABC1D23", vehicleModel: "Fiat Mobi", supervisorName: "Paulo", supervisorRouteId: 30, odometerKm: 15200, fuelType: "gasoline", liters: 30, amount: 180, consumptionKmPerLiter: 8.5, costPerKm: 0.7 }],
      visits: [{ supervisorRouteId: 30, postName: "Kelvion", supervisorName: "Paulo", vehiclePlate: "ABC1D23", arrivalTime: new Date("2026-08-10T09:00:00"), departureTime: new Date("2026-08-10T10:00:00"), auditSubmittedAt: new Date("2026-08-10T10:02:00"), status: "visited", compliant: 8, nonCompliant: 1, observations: "Ajustar limpeza", arrivalLatitude: -23.18, arrivalLongitude: -46.88, departureLatitude: -23.1802, departureLongitude: -46.8802 }],
    });
    expect(csv).toContain("Relatório de Gestão Operacional");
    expect(csv).toContain("Parâmetros aplicados");
    expect(csv).toContain("Postos previstos");
    expect(csv).toContain("Postos auditados");
    expect(csv).toContain("Posto / Condomínio");
    expect(csv).toContain("Status da Vistoria");
    expect(csv).toContain("KM Inicial");
    expect(csv).toContain("GPS de Chegada");
    expect(csv).toContain("ABC1D23");
    expect(csv).toContain("Kelvion");
    expect(csv).toContain("Ajustar limpeza");
    expect(csv).toContain("Plantão Noturno · 18h às 06h");
  });
});
