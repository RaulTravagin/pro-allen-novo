export type ReportType = "visits" | "summary" | "compliance";

export interface ReportVisit {
  postName?: string | null;
  postId?: number | null;
  routeName?: string | null;
  routeId?: number | null;
  supervisorName?: string | null;
  arrivalTime?: Date | string | null;
  departureTime?: Date | string | null;
  visitedAt?: Date | string | null;
  occurrenceSubmittedAt?: Date | string | null;
  occurrenceReport?: string | null;
  status?: string | null;
}

export interface ReportWorksheet {
  name: string;
  title: string;
  subtitle: string;
  headers: string[];
  rows: Array<Array<string | number | Date | null>>;
  widths: number[];
  formats?: Record<number, string>;
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasOccurrenceReport(visit: ReportVisit) {
  return Boolean(visit.occurrenceReport?.trim());
}

function durationMinutes(visit: ReportVisit) {
  const arrival = asDate(visit.arrivalTime);
  const departure = asDate(visit.departureTime);
  return arrival && departure
    ? Math.floor((departure.getTime() - arrival.getTime()) / 60_000)
    : null;
}

export function countReportOccurrences(reports: readonly ReportVisit[]) {
  return reports.filter(hasOccurrenceReport).length;
}

export function buildReportExportWorksheets(
  reports: readonly ReportVisit[],
  reportType: ReportType,
  periodLabel: string,
): ReportWorksheet[] {
  if (reportType === "summary") {
    const durations = reports
      .map(durationMinutes)
      .filter((duration): duration is number => duration !== null);
    const averageDuration = durations.length
      ? Math.round((durations.reduce((total, duration) => total + duration, 0) / durations.length) * 10) / 10
      : null;
    const occurrenceCount = countReportOccurrences(reports);

    return [{
      name: "Resumo",
      title: "Pro Allen — Resumo Executivo",
      subtitle: `Período: ${periodLabel} · Visitas analisadas: ${reports.length}`,
      headers: ["Indicador", "Total"],
      rows: [
        ["Visitas concluídas", reports.length],
        ["Chegadas registradas", reports.filter((visit) => asDate(visit.arrivalTime) !== null).length],
        ["Saídas registradas", reports.filter((visit) => asDate(visit.departureTime) !== null).length],
        ["Duração média (min)", averageDuration],
        ["Ocorrências registradas", occurrenceCount],
        ["Visitas sem ocorrência registrada", reports.length - occurrenceCount],
      ],
      widths: [36, 18],
    }];
  }

  if (reportType === "compliance") {
    const occurrences = reports.filter(hasOccurrenceReport);
    return [{
      name: "Ocorrências",
      title: "Pro Allen — Registros de Ocorrência",
      subtitle: `Período: ${periodLabel} · Ocorrências registradas: ${occurrences.length}`,
      headers: ["Data da visita", "Envio do registro", "Posto", "Rota", "Supervisor", "Ocorrência / relatório"],
      rows: occurrences.map((visit) => [
        asDate(visit.visitedAt),
        asDate(visit.occurrenceSubmittedAt),
        visit.postName || (visit.postId != null ? `Posto #${visit.postId}` : "Posto não informado"),
        visit.routeName || (visit.routeId != null ? `Rota #${visit.routeId}` : "Rota não informada"),
        visit.supervisorName || "Supervisor não informado",
        visit.occurrenceReport ?? "",
      ]),
      widths: [18, 18, 28, 22, 28, 60],
      formats: { 0: "dd/mm/yyyy", 1: "dd/mm/yyyy hh:mm" },
    }];
  }

  return [{
    name: "Visitas",
    title: "Pro Allen — Relatório de Visitas",
    subtitle: `Período: ${periodLabel} · Total de visitas: ${reports.length}`,
    headers: ["Posto", "Rota", "Supervisor", "Chegada", "Saída", "Duração", "Data", "Ocorrência / relatório"],
    rows: reports.map((visit) => [
      visit.postName || (visit.postId != null ? `Posto #${visit.postId}` : "Posto não informado"),
      visit.routeName || (visit.routeId != null ? `Rota #${visit.routeId}` : "Rota não informada"),
      visit.supervisorName || "Supervisor não informado",
      asDate(visit.arrivalTime),
      asDate(visit.departureTime),
      durationMinutes(visit),
      asDate(visit.visitedAt),
      visit.occurrenceReport || "-",
    ]),
    widths: [28, 22, 28, 18, 18, 12, 14, 48],
    formats: { 3: "dd/mm/yyyy hh:mm", 4: "dd/mm/yyyy hh:mm", 5: '0" min"', 6: "dd/mm/yyyy" },
  }];
}
