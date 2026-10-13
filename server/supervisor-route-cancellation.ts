import { and, eq, isNotNull, isNull } from "drizzle-orm";
import {
  supervisorRouteCancellations,
  supervisorRoutes,
} from "../drizzle/schema";
import { RouteClosureError } from "./route-closure";

export type CancelActiveSupervisorRouteInput = {
  supervisorRouteId: number;
  cancelledByUserId: number;
  reason: string;
};

/** Cancela apenas uma rota efetivamente iniciada; status e auditoria devem usar a mesma transação. */
export async function cancelActiveSupervisorRouteInTransaction(
  transaction: any,
  input: CancelActiveSupervisorRouteInput
) {
  const reason = input.reason.trim();
  if (reason.length < 8 || reason.length > 1000) {
    throw new RouteClosureError(
      "BAD_REQUEST",
      "Informe um motivo entre 8 e 1000 caracteres"
    );
  }

  const [route] = await transaction
    .select({
      id: supervisorRoutes.id,
      status: supervisorRoutes.status,
      kmInitial: supervisorRoutes.kmInitial,
      startedAt: supervisorRoutes.startedAt,
      completedAt: supervisorRoutes.completedAt,
    })
    .from(supervisorRoutes)
    .where(eq(supervisorRoutes.id, input.supervisorRouteId))
    .for("update")
    .limit(1);

  if (!route) {
    throw new RouteClosureError("NOT_FOUND", "Rota não encontrada");
  }
  if (
    route.status !== "in_progress" ||
    route.kmInitial == null ||
    route.startedAt == null ||
    route.completedAt != null
  ) {
    throw new RouteClosureError(
      "CONFLICT",
      "Somente uma rota iniciada e ainda ativa pode ser cancelada"
    );
  }

  const cancelledAt = new Date();
  const [updatedRoute] = await transaction
    .update(supervisorRoutes)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(supervisorRoutes.id, input.supervisorRouteId),
        eq(supervisorRoutes.status, "in_progress"),
        isNotNull(supervisorRoutes.kmInitial),
        isNotNull(supervisorRoutes.startedAt),
        isNull(supervisorRoutes.completedAt)
      )
    )
    .returning({ id: supervisorRoutes.id });

  if (!updatedRoute) {
    throw new RouteClosureError(
      "CONFLICT",
      "A rota mudou de estado antes do cancelamento; atualize o monitor"
    );
  }

  const [audit] = await transaction
    .insert(supervisorRouteCancellations)
    .values({
      supervisorRouteId: input.supervisorRouteId,
      cancelledByUserId: input.cancelledByUserId,
      previousStatus: "in_progress",
      cancelledAt,
      reason,
    })
    .returning({ id: supervisorRouteCancellations.id });

  if (!audit) {
    throw new Error("Não foi possível gravar a auditoria do cancelamento");
  }

  return {
    cancelled: true as const,
    supervisorRouteId: input.supervisorRouteId,
    auditId: audit.id,
    cancelledAt,
  };
}
