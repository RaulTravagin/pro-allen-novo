import { describe, expect, it } from "vitest";
import { buildOperationalReportCsv } from "./OperationalReports";

describe("relatório operacional CSV", () => {
  it("inclui resumo, abastecimentos e auditorias no arquivo exportado", () => {
    const csv = buildOperationalReportCsv({
      filters: { startDate: new Date("2026-08-01T12:00:00"), endDate: new Date("2026-08-15T12:00:00"), shiftType: "night" },
      summary: { totalKm: 240, totalFuelAmount: 360, averageConsumptionKmPerLiter: 8.5, inspections: 4, complianceRate: 90 },
      fuelLogs: [{ createdAt: new Date("2026-08-10T10:00:00"), vehiclePlate: "ABC1D23", vehicleModel: "Fiat Mobi", supervisorName: "Paulo", supervisorRouteId: 30, odometerKm: 15200, fuelType: "gasoline", liters: 30, amount: 180, consumptionKmPerLiter: 8.5, costPerKm: 0.7 }],
      visits: [{ postName: "Kelvion", supervisorName: "Paulo", vehiclePlate: "ABC1D23", arrivalTime: new Date("2026-08-10T09:00:00"), departureTime: new Date("2026-08-10T10:00:00"), status: "visited", compliant: 8, nonCompliant: 1, observations: "Ajustar limpeza" }],
    });
    expect(csv).toContain("Relatório de Gestão Operacional");
    expect(csv).toContain("ABC1D23");
    expect(csv).toContain("Kelvion");
    expect(csv).toContain("Ajustar limpeza");
    expect(csv).toContain("Noturno · 18h às 06h");
  });
});
