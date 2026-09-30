import { and, eq } from "drizzle-orm";
import { supervisorRoutes, users, type SupervisorRoute } from "../drizzle/schema";
import { RouteClosureError } from "./route-closure";

/** Serializa criação/início/encerramento/cancelamento de rotas do mesmo supervisor. */
export async function lockSupervisorRouteOperations(transaction: any, supervisorId: number) {
  const [supervisor] = await transaction.select({ id: users.id }).from(users)
    .where(eq(users.id, supervisorId))
    .for("update")
    .limit(1);

  if (!supervisor) {
    throw new RouteClosureError("NOT_FOUND", "Supervisor não encontrado");
  }
}

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
