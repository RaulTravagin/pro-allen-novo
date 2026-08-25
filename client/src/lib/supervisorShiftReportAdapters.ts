import type { PdfReportInput, PdfRouteSection, PdfVisit } from "./operationalReportPdf";
import { slugifyFileName } from "./gestorPdfAdapters";

const SHIFT_LABEL: Record<string, string> = {
  day: "Plantão Dia · 06h–18h",
  night: "Plantão Noite · 18h–06h",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando início",
  in_progress: "Em andamento",
  completed: "Encerrada",
  cancelled: "Cancelada",
};

function mapVisit(visit: any): PdfVisit {
  return {
    postName: visit.postName,
    region: visit.postRegion,
    status: visit.status,
    arrivalTime: visit.arrivalTime,
    departureTime: visit.departureTime,
    auditSubmittedAt: visit.auditSubmittedAt,
    durationMinutes: visit.durationMinutes,
    observations: visit.observations,
    isCoverage: visit.isCoverage,
    coverageReason: visit.coverageReason,
    arrivalLatitude: visit.arrivalLatitude,
    arrivalLongitude: visit.arrivalLongitude,
    departureLatitude: visit.departureLatitude,
    departureLongitude: visit.departureLongitude,
    checklistItems: visit.checklistItems ?? [],
  };
}

function activityLabel(activity: any) {
  return activity.routeActivityType === "operational_base" ? "Base Operacional" : activity.routeName;
}

function buildSection(report: any, activity: any): PdfRouteSection {
  const visits = (report.visits ?? []).filter((visit: any) => visit.supervisorRouteId === activity.id).map(mapVisit);
  return {
    supervisorName: report.supervisor?.name ?? "Supervisor",
    supervisorUsername: report.supervisor?.username ?? null,
    routeName: activityLabel(activity),
    routeRegion: activity.routeRegion,
    shiftLabel: SHIFT_LABEL[activity.shiftType ?? report.shiftType ?? ""] ?? "Turno não identificado",
    startedAt: activity.startedAt ?? activity.shiftStartedAt,
    completedAt: activity.completedAt,
    vehiclePlate: activity.vehicle?.plate ?? null,
    vehicleModel: activity.vehicle?.model ?? null,
    kmInitial: activity.kmInitial,
    kmFinal: activity.kmFinal,
    kmCovered: activity.kmCovered,
    statusLabel: STATUS_LABEL[activity.status] ?? null,
    plannedPosts: visits.length,
    visits,
  };
}

export function buildSupervisorShiftPdfInput(report: any): PdfReportInput {
  const reportDate = new Date(report.reportDate);
  const supervisorName = report.supervisor?.name ?? "supervisor";
  const metrics = report.metrics ?? {};
  const fuelLabel = `${metrics.fuelCount ?? 0} abastecimento(s) · R$ ${Number(metrics.fuelAmount ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const sections = (report.activities ?? []).map((activity: any) => buildSection(report, activity));
  return {
    title: "Relatório de encerramento de turno",
    periodLabel: `${reportDate.toLocaleDateString("pt-BR")} · ${SHIFT_LABEL[report.shiftType ?? ""] ?? "Turno operacional"}`,
    generatedAt: new Date(report.generatedAt),
    contextLines: [
      `Supervisor: ${supervisorName}${report.supervisor?.username ? ` · @${report.supervisor.username}` : ""}`,
      `Início do turno: ${report.startedAt ? new Date(report.startedAt).toLocaleString("pt-BR") : "não informado"} · Término: ${report.completedAt ? new Date(report.completedAt).toLocaleString("pt-BR") : "não informado"}`,
      `Atividades: ${report.activities?.length ?? 0} · visitas: ${metrics.totalVisits ?? 0} · coberturas/Base Operacional: ${metrics.coverageCount ?? 0} · combustível: ${fuelLabel}`,
    ],
    executiveMetrics: [
      { label: "KM percorrido", value: `${Number(metrics.kmCovered ?? 0).toLocaleString("pt-BR")} km` },
      { label: "Visitas concluídas", value: String(metrics.completedVisits ?? 0) },
      { label: "Coberturas", value: String(metrics.coverageCount ?? 0) },
      { label: "Ocorrências", value: String(metrics.nonCompliantItems ?? 0), alert: Number(metrics.nonCompliantItems ?? 0) > 0 },
    ],
    summaryLines: [
      `Quilometragem: inicial ${metrics.kmInitial ?? "—"} km · final ${metrics.kmFinal ?? "—"} km · percorrido ${Number(metrics.kmCovered ?? 0).toLocaleString("pt-BR")} km.`,
      `Abastecimentos: ${fuelLabel}${metrics.fuelLiters ? ` · ${Number(metrics.fuelLiters).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} L` : ""}.`,
      `Registros: ${metrics.observationCount ?? 0} observação(ões), ${metrics.nonCompliantItems ?? 0} não conformidade(s) e ${metrics.pendingVisits ?? 0} visita(s) pendente(s).`,
    ],
    sections,
    fileName: `relatorio-turno-${slugifyFileName(supervisorName)}-${reportDate.toISOString().slice(0, 10)}.pdf`,
  };
}
