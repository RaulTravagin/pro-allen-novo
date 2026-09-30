type SupervisorRouteSelection = { id: number; status: string };

/** Concluídas/canceladas ficam no histórico; somente in_progress ou pending podem ser retomadas. */
export function selectOpenSupervisorRoute<T extends SupervisorRouteSelection>(
  routes: readonly T[]
) {
  return (
    routes.find(route => route.status === "in_progress") ??
    routes.find(route => route.status === "pending") ??
    null
  );
}
