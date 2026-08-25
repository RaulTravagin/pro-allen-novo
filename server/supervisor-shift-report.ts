type AnyRecord = Record<string, any>;

function numericOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timeValue(value: unknown) {
  return value instanceof Date || typeof value === "string" ? new Date(value) : null;
}

function chronologicalValue(value: unknown) {
  return timeValue(value)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

/** Converte o snapshot operacional em um relatório individual do turno do supervisor. */
export function buildSupervisorShiftReport(snapshot: AnyRecord, supervisorId: number, supervisorRouteId: number) {
  const routeViews: AnyRecord[] = (snapshot.activeRoutes ?? [])
    .filter((route: AnyRecord) => route.supervisorId === supervisorId)
    .sort((first: AnyRecord, second: AnyRecord) => chronologicalValue(first.startedAt ?? first.shiftStartedAt) - chronologicalValue(second.startedAt ?? second.shiftStartedAt));
  if (!routeViews.length) return null;

  const currentRoute = routeViews.find((route: AnyRecord) => route.id === supervisorRouteId) ?? routeViews.at(-1);
  const activities: AnyRecord[] = routeViews.map((route: AnyRecord) => ({
    id: route.id,
    routeName: route.routeName,
    routeRegion: route.routeRegion,
    routeActivityType: route.routeActivityType ?? "field_route",
    shiftType: route.shiftType,
    status: route.status,
    shiftStartedAt: route.shiftStartedAt ?? null,
    startedAt: route.startedAt ?? null,
    completedAt: route.completedAt ?? null,
    kmInitial: numericOrNull(route.kmInitial),
    kmFinal: numericOrNull(route.kmFinal),
    kmCovered: numericOrNull(route.kmCovered),
    vehicle: route.vehicle ?? null,
  }));

  const visits: AnyRecord[] = routeViews.flatMap((route: AnyRecord) => (route.checklistVisits ?? []).map((visit: AnyRecord) => ({
    id: visit.id,
    supervisorRouteId: route.id,
    routeName: route.routeName,
    routeRegion: route.routeRegion,
    postName: visit.postName,
    postRegion: visit.postRegion,
    postAddress: visit.postAddress ?? null,
    status: visit.status,
    arrivalTime: visit.arrivalTime ?? null,
    departureTime: visit.departureTime ?? null,
    visitedAt: visit.visitedAt ?? null,
    auditSubmittedAt: visit.auditSubmittedAt ?? null,
    durationMinutes: visit.durationMinutes ?? null,
    observations: visit.observations ?? null,
    isCoverage: Boolean(visit.isCoverage),
    coverageReason: visit.coverageReason ?? null,
    arrivalLatitude: visit.arrivalLatitude ?? null,
    arrivalLongitude: visit.arrivalLongitude ?? null,
    departureLatitude: visit.departureLatitude ?? null,
    departureLongitude: visit.departureLongitude ?? null,
    checklistSummary: visit.checklistSummary ?? { total: 0, compliant: 0, nonCompliant: 0, unanswered: 0 },
    checklistItems: visit.checklistItems ?? [],
  }))).sort((first: AnyRecord, second: AnyRecord) => chronologicalValue(first.arrivalTime ?? first.auditSubmittedAt ?? first.visitedAt) - chronologicalValue(second.arrivalTime ?? second.auditSubmittedAt ?? second.visitedAt));

  const fuelById = new Map<number, AnyRecord>();
  for (const route of routeViews) {
    for (const fuel of route.fuelLogs ?? []) fuelById.set(fuel.id, fuel);
  }
  const fuelLogs: AnyRecord[] = Array.from(fuelById.values()).sort((first: AnyRecord, second: AnyRecord) => chronologicalValue(first.createdAt) - chronologicalValue(second.createdAt));
  const firstStartedActivity = activities.find((activity: AnyRecord) => activity.startedAt) ?? activities[0];
  const lastActivity = activities.at(-1);
  const kmCovered = activities.reduce((total: number, activity: AnyRecord) => total + (activity.kmCovered ?? 0), 0);
  const observations: AnyRecord[] = visits.flatMap((visit: AnyRecord) => [
    visit.observations?.trim() ? { type: "observation", postName: visit.postName, text: visit.observations.trim() } : null,
    visit.isCoverage && visit.coverageReason?.trim() ? { type: "coverage", postName: visit.postName, text: visit.coverageReason.trim() } : null,
  ].filter(Boolean) as AnyRecord[]);

  return {
    reportDate: snapshot.reportDate ?? new Date(),
    generatedAt: new Date(),
    supervisor: {
      id: supervisorId,
      name: currentRoute?.supervisorName ?? `Supervisor #${supervisorId}`,
      username: currentRoute?.supervisorUsername ?? null,
    },
    supervisorRouteId,
    status: currentRoute?.status ?? lastActivity?.status ?? "completed",
    shiftType: currentRoute?.shiftType ?? firstStartedActivity?.shiftType ?? null,
    startedAt: firstStartedActivity?.startedAt ?? firstStartedActivity?.shiftStartedAt ?? null,
    completedAt: lastActivity?.completedAt ?? null,
    activities,
    visits,
    fuelLogs,
    observations,
    metrics: {
      kmInitial: firstStartedActivity?.kmInitial ?? null,
      kmFinal: lastActivity?.kmFinal ?? null,
      kmCovered: Number(kmCovered.toFixed(2)),
      totalVisits: visits.length,
      completedVisits: visits.filter((visit: AnyRecord) => visit.status === "visited").length,
      pendingVisits: visits.filter((visit: AnyRecord) => visit.status === "pending").length,
      visitsInProgress: visits.filter((visit: AnyRecord) => visit.status === "in_progress").length,
      coverageCount: visits.filter((visit: AnyRecord) => visit.isCoverage).length,
      nonCompliantItems: visits.reduce((total: number, visit: AnyRecord) => total + Number(visit.checklistSummary?.nonCompliant ?? 0), 0),
      observationCount: observations.length,
      fuelCount: fuelLogs.length,
      fuelAmount: Number(fuelLogs.reduce((total: number, fuel: AnyRecord) => total + Number(fuel.amount ?? 0), 0).toFixed(2)),
      fuelLiters: Number(fuelLogs.reduce((total: number, fuel: AnyRecord) => total + Number(fuel.liters ?? 0), 0).toFixed(3)),
    },
  };
}
