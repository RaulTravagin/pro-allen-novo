type AnyRecord = Record<string, any>;

const statusLabels: Record<string, string> = {
  sem_rota: "Sem rota preparada",
  aguardando_km: "Aguardando KM inicial",
  em_deslocamento: "Em deslocamento",
  em_atendimento: "Em atendimento",
  em_base_operacional: "Na Base Operacional",
  rota_concluida: "Rota concluída",
  base_concluida: "Base concluída",
  rota_cancelada: "Rota cancelada",
};

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Converte o snapshot operacional do dia em um resumo claro, exportável e auditável. */
export function buildDailyOperationalReport(snapshot: AnyRecord) {
  const supervisors = (snapshot.operationalSupervisors ?? []).map((supervisor: AnyRecord) => {
    const route = supervisor.route as AnyRecord | null;
    const visits = route?.checklistVisits ?? [];
    const completedVisits = visits.filter((visit: AnyRecord) => visit.status === "visited");
    const activeVisit = visits.find((visit: AnyRecord) => visit.status === "in_progress") ?? null;
    const coverages = visits.filter((visit: AnyRecord) => visit.isCoverage);
    const checklistTotals = visits.filter((visit: AnyRecord) => visit.status === "visited" || visit.status === "in_progress").reduce((total: AnyRecord, visit: AnyRecord) => {
      const checklist = visit.checklistSummary ?? {};
      total.total += asNumber(checklist.total);
      total.compliant += asNumber(checklist.compliant);
      total.nonCompliant += asNumber(checklist.nonCompliant);
      total.unanswered += asNumber(checklist.unanswered);
      return total;
    }, { total: 0, compliant: 0, nonCompliant: 0, unanswered: 0 });

    return {
      supervisorId: supervisor.supervisorId,
      supervisorName: supervisor.supervisorName,
      username: supervisor.supervisorUsername ?? null,
      operationalStatus: supervisor.status,
      operationalStatusLabel: statusLabels[supervisor.status] ?? "Situação não informada",
      route: route ? {
        id: route.id,
        name: route.routeName,
        region: route.routeRegion,
        activityType: route.routeActivityType ?? "field_route",
        status: route.routeStatus,
        startedAt: route.startedAt ?? null,
        completedAt: route.completedAt ?? null,
        totalPosts: route.totalPosts,
        completedVisits: route.completedVisits,
        pendingVisits: route.pendingVisits,
        skippedVisits: route.skippedVisits,
        kmInitial: route.kmInitial ?? null,
        kmFinal: route.kmFinal ?? null,
        kmCovered: route.kmCovered ?? null,
        activeVisit: activeVisit ? {
          postName: activeVisit.postName,
          arrivalTime: activeVisit.arrivalTime ?? null,
          durationMinutes: activeVisit.durationMinutes ?? null,
        } : null,
        visits: visits.map((visit: AnyRecord) => ({
          postName: visit.postName,
          region: visit.postRegion,
          status: visit.status,
          arrivalTime: visit.arrivalTime ?? null,
          departureTime: visit.departureTime ?? null,
          durationMinutes: visit.durationMinutes ?? null,
          observations: visit.observations ?? null,
          isCoverage: Boolean(visit.isCoverage),
          coverageReason: visit.coverageReason ?? null,
          checklist: visit.checklistSummary ?? { total: 0, compliant: 0, nonCompliant: 0, unanswered: 0 },
          checklistItems: visit.checklistItems ?? [],
        })),
      } : null,
      latestLocation: supervisor.latestLocation ? {
        latitude: supervisor.latestLocation.latitude,
        longitude: supervisor.latestLocation.longitude,
        accuracy: supervisor.latestLocation.accuracy ?? null,
        recordedAt: supervisor.latestLocation.recordedAt ?? null,
      } : null,
      alerts: supervisor.alerts ?? [],
      checklistTotals,
      completedVisitCount: completedVisits.length,
      coverageCount: coverages.length,
    };
  });

  const summary = supervisors.reduce((total: AnyRecord, supervisor: AnyRecord) => {
    total.supervisors += 1;
    total.supervisorsOnRoute += ["aguardando_km", "em_deslocamento", "em_atendimento", "em_base_operacional"].includes(supervisor.operationalStatus) ? 1 : 0;
    total.completedVisits += supervisor.route?.completedVisits ?? 0;
    total.pendingVisits += supervisor.route?.pendingVisits ?? 0;
    total.visitsInProgress += supervisor.route?.activeVisit ? 1 : 0;
    total.coverages += supervisor.coverageCount;
    total.kmCovered += asNumber(supervisor.route?.kmCovered);
    total.nonCompliantItems += supervisor.checklistTotals.nonCompliant;
    total.unansweredItems += supervisor.checklistTotals.unanswered;
    total.alerts += supervisor.alerts.length;
    return total;
  }, { supervisors: 0, supervisorsOnRoute: 0, completedVisits: 0, pendingVisits: 0, visitsInProgress: 0, coverages: 0, kmCovered: 0, nonCompliantItems: 0, unansweredItems: 0, alerts: 0 });

  return {
    reportDate: snapshot.reportDate ? new Date(snapshot.reportDate) : new Date(),
    generatedAt: new Date(),
    summary: { ...summary, kmCovered: Number(summary.kmCovered.toFixed(2)) },
    supervisors,
  };
}
