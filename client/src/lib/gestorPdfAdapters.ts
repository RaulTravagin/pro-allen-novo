import type { PdfRouteSection, PdfVisit } from "./operationalReportPdf";

/** Converte estruturas do Painel do Gestor no formato usado pelo gerador de PDF. */

const SHIFT_LABEL: Record<string, string> = { day: "Plantão Dia · 06h–18h", night: "Plantão Noite · 18h–06h" };
const ROUTE_STATUS_LABEL: Record<string, string> = { pending: "Aguardando início", in_progress: "Em andamento", completed: "Encerrada", cancelled: "Cancelada" };

function mapVisit(visit: any): PdfVisit {
  return {
    postName: visit?.postName ?? null,
    region: visit?.postRegion ?? visit?.region ?? null,
    status: visit?.status ?? null,
    arrivalTime: visit?.arrivalTime ?? null,
    departureTime: visit?.departureTime ?? null,
    durationMinutes: visit?.durationMinutes ?? null,
    observations: visit?.observations ?? null,
    isCoverage: Boolean(visit?.isCoverage),
    coverageReason: visit?.coverageReason ?? null,
    checklistItems: (visit?.checklistItems ?? []).map((item: any) => ({
      category: item?.category ?? null,
      description: item?.description ?? null,
      isCompliant: item?.isCompliant ?? null,
      notes: item?.notes ?? null,
    })),
    photos: (visit?.photos ?? []).map((photo: any) => ({ url: photo?.url ?? photo?.photoUrl ?? null, caption: photo?.caption ?? photo?.description ?? null })),
  };
}

/** Seção de PDF a partir de um card de supervisor do painel em tempo real. */
export function buildSupervisorPdfSection(supervisor: any): PdfRouteSection {
  const route = supervisor?.route;
  return {
    supervisorName: supervisor?.supervisorName ?? "Supervisor",
    supervisorUsername: supervisor?.supervisorUsername ?? null,
    routeName: route?.routeActivityType === "operational_base" ? "Base Operacional" : route?.routeName ?? "Sem rota preparada",
    routeRegion: route?.routeRegion ?? null,
    shiftLabel: SHIFT_LABEL[route?.shiftType ?? ""] ?? "Plantão não identificado",
    startedAt: route?.startedAt ?? null,
    completedAt: route?.completedAt ?? null,
    vehiclePlate: route?.vehicle?.plate ?? null,
    vehicleModel: route?.vehicle?.model ?? null,
    kmInitial: route?.kmInitial ?? null,
    kmFinal: route?.kmFinal ?? null,
    kmCovered: route?.kmCovered ?? null,
    statusLabel: ROUTE_STATUS_LABEL[route?.routeStatus ?? ""] ?? null,
    visits: (route?.checklistVisits ?? []).map(mapVisit),
  };
}

/** Seções de PDF a partir do relatório diário consolidado. */
export function buildDailyReportPdfSections(report: any): PdfRouteSection[] {
  return (report?.supervisors ?? []).map((supervisor: any) => {
    const route = supervisor?.route;
    return {
      supervisorName: supervisor?.supervisorName ?? "Supervisor",
      supervisorUsername: supervisor?.username ?? null,
      routeName: route?.name ?? "Sem rota preparada",
      routeRegion: route?.region ?? null,
      shiftLabel: SHIFT_LABEL[route?.shiftType ?? ""] ?? "Plantão não identificado",
      startedAt: route?.startedAt ?? null,
      completedAt: route?.completedAt ?? null,
      vehiclePlate: route?.vehicle?.plate ?? route?.vehiclePlate ?? null,
      vehicleModel: route?.vehicle?.model ?? route?.vehicleModel ?? null,
      kmInitial: route?.kmInitial ?? null,
      kmFinal: route?.kmFinal ?? null,
      kmCovered: route?.kmCovered ?? null,
      statusLabel: supervisor?.operationalStatusLabel ?? null,
      visits: (route?.visits ?? []).map(mapVisit),
    };
  });
}

export function buildDailyReportSummaryLines(report: any): string[] {
  const summary = report?.summary;
  if (!summary) return [];
  return [
    `Supervisores acompanhados: ${summary.supervisors ?? 0} · em rota: ${summary.supervisorsOnRoute ?? 0}.`,
    `Visitas concluídas: ${summary.completedVisits ?? 0} · em atendimento: ${summary.visitsInProgress ?? 0} · pendentes: ${summary.pendingVisits ?? 0} · coberturas: ${summary.coverages ?? 0}.`,
    `Quilometragem registrada: ${Number(summary.kmCovered ?? 0).toLocaleString("pt-BR")} km · não conformidades: ${summary.nonCompliantItems ?? 0} · alertas: ${summary.alerts ?? 0}.`,
  ];
}

export function slugifyFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "relatorio";
}
