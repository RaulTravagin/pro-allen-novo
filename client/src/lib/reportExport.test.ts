import { describe, expect, it } from "vitest";
import { buildReportExportWorksheets, countReportOccurrences, type ReportVisit } from "./reportExport";

describe("exportação de relatórios administrativos", () => {
  const fixture = [
    {
      postName: "Posto Fictício A",
      postId: 11,
      routeName: "Rota Fictícia A",
      routeId: 21,
      supervisorName: "Supervisora Fictícia A",
      arrivalTime: new Date("2026-08-03T08:00:00Z"),
      departureTime: new Date("2026-08-03T08:30:00Z"),
      visitedAt: new Date("2026-08-03T08:30:00Z"),
      occurrenceSubmittedAt: new Date("2026-08-03T08:32:00Z"),
      occurrenceReport: "Relato fictício A",
      status: "visited",
      id: "ID-PRIVADO-NÃO-EXPORTAR",
      postAddress: "ENDEREÇO-PRIVADO-NÃO-EXPORTAR",
      observations: "OBSERVAÇÃO-INTERNA-NÃO-EXPORTAR",
    },
    {
      postName: "Posto Fictício B",
      routeName: "Rota Fictícia B",
      supervisorName: "Supervisor Fictício B",
      arrivalTime: new Date("2026-08-03T09:00:00Z"),
      departureTime: null,
      visitedAt: new Date("2026-08-03T09:00:00Z"),
      occurrenceSubmittedAt: null,
      occurrenceReport: "   ",
      status: "visited",
      id: "ID-PRIVADO-NÃO-EXPORTAR-2",
      postAddress: "ENDEREÇO-PRIVADO-NÃO-EXPORTAR-2",
      observations: "OBSERVAÇÃO-INTERNA-NÃO-EXPORTAR-2",
    },
    {
      postName: "Posto Fictício C",
      routeName: "Rota Fictícia C",
      supervisorName: "Supervisor Fictício C",
      arrivalTime: new Date("2026-08-03T10:00:00Z"),
      departureTime: new Date("2026-08-03T10:20:00Z"),
      visitedAt: new Date("2026-08-03T10:20:00Z"),
      occurrenceSubmittedAt: new Date("2026-08-03T10:22:00Z"),
      occurrenceReport: "Relato fictício C",
      status: "visited",
      id: "ID-PRIVADO-NÃO-EXPORTAR-3",
      postAddress: "ENDEREÇO-PRIVADO-NÃO-EXPORTAR-3",
      observations: "OBSERVAÇÃO-INTERNA-NÃO-EXPORTAR-3",
    },
  ];
  const reports: ReportVisit[] = fixture;

  it("exporta visitas com os campos já previstos e sem campos não autorizados pela tela", () => {
    const [sheet] = buildReportExportWorksheets(reports, "visits", "01/08/2026 a 07/08/2026");

    expect(sheet?.name).toBe("Visitas");
    expect(sheet?.headers).toEqual(["Posto", "Rota", "Supervisor", "Chegada", "Saída", "Duração", "Data", "Ocorrência / relatório"]);
    expect(sheet?.rows).toHaveLength(3);
    expect(sheet?.rows[0]?.[5]).toBe(30);
    expect(sheet?.rows[0]?.[7]).toBe("Relato fictício A");
    expect(JSON.stringify(sheet)).not.toContain("ID-PRIVADO-NÃO-EXPORTAR");
    expect(JSON.stringify(sheet)).not.toContain("ENDEREÇO-PRIVADO-NÃO-EXPORTAR");
    expect(JSON.stringify(sheet)).not.toContain("OBSERVAÇÃO-INTERNA-NÃO-EXPORTAR");
  });

  it("gera resumo agregado, distinto e sem dados identificáveis por linha", () => {
    const [sheet] = buildReportExportWorksheets(reports, "summary", "01/08/2026 a 07/08/2026");

    expect(sheet?.name).toBe("Resumo");
    expect(sheet?.headers).toEqual(["Indicador", "Total"]);
    expect(sheet?.rows).toEqual([
      ["Visitas concluídas", 3],
      ["Chegadas registradas", 3],
      ["Saídas registradas", 2],
      ["Duração média (min)", 25],
      ["Ocorrências registradas", 2],
      ["Visitas sem ocorrência registrada", 1],
    ]);
    expect(JSON.stringify(sheet)).not.toContain("Posto Fictício");
    expect(JSON.stringify(sheet)).not.toContain("Supervisora Fictícia");
    expect(JSON.stringify(sheet)).not.toContain("Relato fictício");
  });

  it("exporta somente relatos preenchidos na opção de ocorrências", () => {
    const [sheet] = buildReportExportWorksheets(reports, "compliance", "01/08/2026 a 07/08/2026");

    expect(sheet?.name).toBe("Ocorrências");
    expect(sheet?.headers).toEqual(["Data da visita", "Envio do registro", "Posto", "Rota", "Supervisor", "Ocorrência / relatório"]);
    expect(sheet?.rows).toHaveLength(2);
    expect(sheet?.rows.map((row) => row[5])).toEqual(["Relato fictício A", "Relato fictício C"]);
    expect(countReportOccurrences(reports)).toBe(2);
    expect(JSON.stringify(sheet)).not.toContain("OBSERVAÇÃO-INTERNA-NÃO-EXPORTAR");
  });
});
