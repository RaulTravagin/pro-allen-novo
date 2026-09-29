import { and, eq } from "drizzle-orm";
import { supervisorRoutes, type SupervisorRoute } from "../drizzle/schema";
import { RouteClosureError } from "./route-closure";

/**
 * All checklist mutations and route closure use this same supervisorRoutes row
 * lock. The owner and allowed state are evaluated from the row returned after
 * PostgreSQL grants the lock, not from a router-side preflight read.
 */
export async function withLockedSupervisorRoute<T>(
  transaction: any,
  input: {
    supervisorRouteId: number;
    supervisorId: number;
    allowedStatuses: readonly SupervisorRoute["status"][];
    statusMessage?: string;
  },
  mutate: (route: SupervisorRoute) => Promise<T>,
): Promise<T> {
  const [route] = await transaction.select().from(supervisorRoutes)
    .where(and(
      eq(supervisorRoutes.id, input.supervisorRouteId),
      eq(supervisorRoutes.supervisorId, input.supervisorId),
    ))
    .for("update")
    .limit(1);

  if (!route) {
    throw new RouteClosureError("NOT_FOUND", "Rota não encontrada para este supervisor");
  }
  if (!input.allowedStatuses.includes(route.status)) {
    throw new RouteClosureError(
      "CONFLICT",
      input.statusMessage ?? "A rota não está em um estado que permita alterar checklists",
    );
  }

  return mutate(route);
}
