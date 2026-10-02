import { describe, expect, it, vi } from "vitest";
import { buildOperationalReportCsv, buildOperationalReportCsvFile, downloadOperationalReportCsv } from "./OperationalReports";

describe("relatório operacional CSV", () => {
  it("inclui contexto executivo e colunas operacionais em português no arquivo exportado", () => {
    const csv = buildOperationalReportCsv({
      filters: { startDate: new Date("2026-08-01T12:00:00"), endDate: new Date("2026-08-15T12:00:00"), shiftType: "night", supervisorId: 4, vehicleId: 6 },
      filterOptions: { supervisors: [{ id: 4, name: "Paulo" }], vehicles: [{ id: 6, plate: "ABC1D23", model: "Fiat Mobi" }] },
      summary: { totalKm: 240, totalFuelAmount: 360, averageConsumptionKmPerLiter: 8.5, inspections: 4, plannedPosts: 6, reportedVisits: 1, pendingReports: 3 },
      routes: [{ id: 30, routeName: "Rota 1", shiftType: "night", kmInitial: 15000, kmFinal: 15240, kmCovered: 240 }],
      fuelLogs: [{ createdAt: new Date("2026-08-10T10:00:00"), vehiclePlate: "ABC1D23", vehicleModel: "Fiat Mobi", supervisorName: "Paulo", supervisorRouteId: 30, odometerKm: 15200, fuelType: "gasoline", liters: 30, amount: 180, consumptionKmPerLiter: 8.5, costPerKm: 0.7 }],
      visits: [{ supervisorRouteId: 30, postName: "Kelvion", supervisorName: "Paulo", vehiclePlate: "ABC1D23", arrivalTime: new Date("2026-08-10T09:00:00"), departureTime: new Date("2026-08-10T10:00:00"), occurrenceSubmittedAt: new Date("2026-08-10T10:02:00"), occurrenceReport: "Ajustar limpeza", status: "visited", arrivalLatitude: -23.18, arrivalLongitude: -46.88, departureLatitude: -23.1802, departureLongitude: -46.8802 }],
    });
    expect(csv).toContain("Relatório de Gestão Operacional");
    expect(csv).toContain("Parâmetros aplicados");
    expect(csv).toContain("Postos previstos");
    expect(csv).toContain("Visitas concluídas");
    expect(csv).toContain("Posto / Condomínio");
    expect(csv).toContain("Status da Visita");
    expect(csv).toContain("KM Inicial");
    expect(csv).toContain("GPS de Chegada");
    expect(csv).toContain("ABC1D23");
    expect(csv).toContain("Kelvion");
    expect(csv).toContain("Ajustar limpeza");
    expect(csv).toContain("Plantão Noturno · 18h às 06h");
  });

  it("neutraliza fórmulas em textos vindos dos registros", () => {
    const csv = buildOperationalReportCsv({
      filters: { startDate: new Date("2026-08-01T12:00:00"), endDate: new Date("2026-08-01T12:00:00"), shiftType: null, supervisorId: null, vehicleId: null },
      filterOptions: { supervisors: [], vehicles: [] },
      summary: { totalKm: 0, totalFuelAmount: 0, averageConsumptionKmPerLiter: null, inspections: 1, plannedPosts: 1, reportedVisits: 1, pendingReports: 0 },
      routes: [],
      fuelLogs: [],
      visits: [{ supervisorRouteId: 1, postName: "Posto fictício", supervisorName: "=HYPERLINK(\"https://example.invalid\")", arrivalTime: new Date("2026-08-01T09:00:00"), occurrenceReport: "@cmd", status: "visited" }],
    });
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'@cmd");
  });

  it("neutraliza fórmulas mesmo após whitespace, tabulação ou quebra de linha", () => {
    const formulaValues = [" =1+1", "\t=1+1", "\n=1+1", "\r\n=1+1", " +1+1", "\t+1+1", "\n+1+1", "\r\n+1+1", " -1+1", "\t-1+1", "\n-1+1", "\r\n-1+1", " @cmd", "\t@cmd", "\n@cmd", "\r\n@cmd"];
    const csv = buildOperationalReportCsv({
      filters: { startDate: new Date("2026-08-01T12:00:00"), endDate: new Date("2026-08-01T12:00:00"), shiftType: null, supervisorId: null, vehicleId: null },
      filterOptions: { supervisors: [], vehicles: [] },
      summary: { totalKm: 0, totalFuelAmount: 0, averageConsumptionKmPerLiter: null, inspections: formulaValues.length, plannedPosts: formulaValues.length, reportedVisits: 0, pendingReports: 0 },
      routes: [],
      fuelLogs: [],
      visits: formulaValues.map((postName, index) => ({ supervisorRouteId: index + 1, postName, status: "visited" })),
    });

    for (const value of formulaValues) {
      expect(csv).toContain(`"'${value}"`);
    }
  });

  it("monta arquivo CSV UTF-8 baixável com nome por período e sanitização preservada", () => {
    const file = buildOperationalReportCsvFile({
      filters: { startDate: new Date("2026-08-01T12:00:00"), endDate: new Date("2026-08-15T12:00:00"), shiftType: null, supervisorId: null, vehicleId: null },
      filterOptions: { supervisors: [], vehicles: [] },
      summary: { totalKm: 0, totalFuelAmount: 0, averageConsumptionKmPerLiter: null, inspections: 1, plannedPosts: 1, reportedVisits: 1, pendingReports: 0 },
      routes: [],
      fuelLogs: [],
      visits: [{ supervisorRouteId: 1, postName: "=HYPERLINK(\"https://example.invalid\")", status: "visited" }],
    });

    expect(file.fileName).toBe("pro-allen-relatorio-operacional-2026-08-01-2026-08-15.csv");
    expect(file.mimeType).toBe("text/csv;charset=utf-8");
    expect(file.content.startsWith("\uFEFF")).toBe(true);
    expect(file.content).toContain("'=HYPERLINK");
  });

  it("dispara o download usando um link temporário e o conteúdo CSV sanitizado", async () => {
    const link = { href: "", download: "", click: vi.fn(), remove: vi.fn() } as unknown as HTMLAnchorElement;
    const createElement = vi.fn(() => link);
    const appendChild = vi.fn();
    vi.stubGlobal("document", { createElement, body: { appendChild } } as unknown as Document);
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:operational-csv");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    downloadOperationalReportCsv({
      filters: { startDate: new Date("2026-08-01T12:00:00"), endDate: new Date("2026-08-15T12:00:00"), shiftType: null, supervisorId: null, vehicleId: null },
      filterOptions: { supervisors: [], vehicles: [] },
      summary: { totalKm: 0, totalFuelAmount: 0, averageConsumptionKmPerLiter: null, inspections: 1, plannedPosts: 1, reportedVisits: 1, pendingReports: 0 },
      routes: [],
      fuelLogs: [],
      visits: [{ supervisorRouteId: 1, postName: "=1+1", status: "visited" }],
    });

    expect(createElement).toHaveBeenCalledWith("a");
    expect(appendChild).toHaveBeenCalledWith(link);
    expect(link.href).toBe("blob:operational-csv");
    expect(link.download).toBe("pro-allen-relatorio-operacional-2026-08-01-2026-08-15.csv");
    expect(link.click).toHaveBeenCalledOnce();
    expect(link.remove).toHaveBeenCalledOnce();
    const blob = createObjectUrl.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8");
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(await blob.text()).toContain("'=1+1");
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:operational-csv");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
