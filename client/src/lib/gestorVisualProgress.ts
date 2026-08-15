export type SupervisorVisualProgress = {
  supervisorId: number;
  supervisorName: string;
  routeName: string;
  status: string;
  statusLabel: string;
  completed: number;
  inProgress: number;
  pending: number;
  total: number;
  progress: number;
  alertCount: number;
  checklistTotal: number;
  compliant: number;
  nonCompliant: number;
  unanswered: number;
  complianceRate: number;
};

const STATUS_LABELS: Record<string, string> = {
  sem_rota: "Sem rota",
  aguardando_km: "Aguardando KM",
  em_deslocamento: "Em deslocamento",
  em_atendimento: "Em atendimento",
  rota_concluida: "Concluída",
  rota_cancelada: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  sem_rota: "#94a3b8",
  aguardando_km: "#60a5fa",
  em_deslocamento: "#22d3ee",
  em_atendimento: "#fbbf24",
  rota_concluida: "#34d399",
  rota_cancelada: "#fb7185",
};

function asNonNegativeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function buildGestorVisualProgress(supervisors: any[]) {
  const supervisorProgress: SupervisorVisualProgress[] = supervisors.map((supervisor) => {
    const route = supervisor.route;
    const visits = route?.checklistVisits ?? [];
    const completed = asNonNegativeNumber(route?.completedVisits);
    const inProgressFromVisits = visits.filter((visit: any) => visit.status === "in_progress").length;
    const inProgress = inProgressFromVisits || (route?.activeVisit ? 1 : 0);
    const total = Math.max(asNonNegativeNumber(route?.totalPosts), completed + inProgress);
    const pending = Math.max(0, total - completed - inProgress);
    const status = supervisor.operationalStatus ?? supervisor.status ?? "sem_rota";
    const alertCount = (supervisor.alerts ?? []).length;
    const checklistTotals = visits.filter((visit: any) => visit.status === "visited" || visit.status === "in_progress").reduce((accumulator: { total: number; compliant: number; nonCompliant: number; unanswered: number }, visit: any) => {
      const checklist = visit.checklistSummary ?? {};
      accumulator.total += asNonNegativeNumber(checklist.total);
      accumulator.compliant += asNonNegativeNumber(checklist.compliant);
      accumulator.nonCompliant += asNonNegativeNumber(checklist.nonCompliant);
      accumulator.unanswered += asNonNegativeNumber(checklist.unanswered);
      return accumulator;
    }, { total: 0, compliant: 0, nonCompliant: 0, unanswered: 0 });

    return {
      supervisorId: supervisor.supervisorId,
      supervisorName: supervisor.supervisorName ?? "Supervisor",
      routeName: route?.routeName ?? "Sem rota preparada",
      status,
      statusLabel: STATUS_LABELS[status] ?? "Sem rota",
      completed,
      inProgress,
      pending,
      total,
      progress: total ? Math.round((completed / total) * 100) : 0,
      alertCount,
      checklistTotal: checklistTotals.total,
      compliant: checklistTotals.compliant,
      nonCompliant: checklistTotals.nonCompliant,
      unanswered: checklistTotals.unanswered,
      complianceRate: checklistTotals.total ? Math.round((checklistTotals.compliant / checklistTotals.total) * 100) : 0,
    };
  });

  const statusDistribution = Object.entries(
    supervisorProgress.reduce<Record<string, number>>((accumulator, supervisor) => {
      accumulator[supervisor.status] = (accumulator[supervisor.status] ?? 0) + 1;
      return accumulator;
    }, {}),
  ).map(([status, count]) => ({
    status,
    name: STATUS_LABELS[status] ?? "Sem rota",
    count,
    color: STATUS_COLORS[status] ?? STATUS_COLORS.sem_rota,
  }));

  const totals = supervisorProgress.reduce(
    (accumulator, supervisor) => ({
      total: accumulator.total + supervisor.total,
      completed: accumulator.completed + supervisor.completed,
      inProgress: accumulator.inProgress + supervisor.inProgress,
      pending: accumulator.pending + supervisor.pending,
      supervisorsWithAlerts: accumulator.supervisorsWithAlerts + (supervisor.alertCount > 0 ? 1 : 0),
    }),
    { total: 0, completed: 0, inProgress: 0, pending: 0, supervisorsWithAlerts: 0 },
  );

  return {
    supervisorProgress,
    routePerformance: supervisorProgress.filter((supervisor) => supervisor.total > 0).map((supervisor) => ({
      routeName: supervisor.routeName,
      supervisorName: supervisor.supervisorName,
      progress: supervisor.progress,
      completed: supervisor.completed,
      total: supervisor.total,
    })),
    statusDistribution,
    totals: {
      ...totals,
      averageProgress: totals.total ? Math.round((totals.completed / totals.total) * 100) : 0,
    },
  };
}
