import { and, eq } from "drizzle-orm";
import {
  posts,
  routes,
  supervisorRouteClosureExceptions,
  supervisorRoutes,
  visitChecklists,
} from "../drizzle/schema";
import {
  lockSupervisorRouteOperations,
  withLockedSupervisorRoute,
} from "./route-checklist-lock";
import {
  hasRouteClosurePendencies,
  RouteClosureError,
  summarizeRouteClosure,
} from "./route-closure";

export type CloseSupervisorRouteInput = {
  supervisorRouteId: number;
  supervisorId: number;
  kmFinal: number;
  exceptionJustification?: string;
};

/** Fecha a rota e persiste o snapshot excepcional na mesma transação. */
export async function closeSupervisorRouteInTransaction(
  transaction: any,
  input: CloseSupervisorRouteInput
) {
  await lockSupervisorRouteOperations(transaction, input.supervisorId);

  return withLockedSupervisorRoute(
    transaction,
    {
      supervisorRouteId: input.supervisorRouteId,
      supervisorId: input.supervisorId,
      allowedStatuses: ["in_progress"],
      statusMessage: "Somente uma rota ativa do supervisor pode ser encerrada",
    },
    async route => {
      if (
        !Number.isFinite(input.kmFinal) ||
        input.kmFinal < 0 ||
        (route.kmInitial != null && input.kmFinal < Number(route.kmInitial))
      ) {
        throw new RouteClosureError(
          "BAD_REQUEST",
          "O KM final informado é inválido ou menor que o KM inicial"
        );
      }

      const [routeCatalog] = await transaction
        .select({ activityType: routes.activityType })
        .from(routes)
        .where(eq(routes.id, route.routeId))
        .limit(1);
      const [activePosts, checklistRows] = await Promise.all([
        transaction
          .select({ id: posts.id, name: posts.name })
          .from(posts)
          .where(
            and(eq(posts.routeId, route.routeId), eq(posts.isActive, true))
          ),
        transaction
          .select({
            id: visitChecklists.id,
            postId: visitChecklists.postId,
            postName: posts.name,
            status: visitChecklists.status,
            isCoverage: visitChecklists.isCoverage,
            arrivalTime: visitChecklists.arrivalTime,
            departureTime: visitChecklists.departureTime,
            occurrenceReport: visitChecklists.occurrenceReport,
            occurrenceSubmittedAt: visitChecklists.occurrenceSubmittedAt,
          })
          .from(visitChecklists)
          .leftJoin(posts, eq(posts.id, visitChecklists.postId))
          .where(
            eq(visitChecklists.supervisorRouteId, input.supervisorRouteId)
          ),
      ]);
      const pendingSummary = summarizeRouteClosure({
        posts:
          routeCatalog?.activityType === "operational_base" ? [] : activePosts,
        checklists:
          routeCatalog?.activityType === "operational_base"
            ? []
            : checklistRows,
      });
      const hasPendencies = hasRouteClosurePendencies(pendingSummary);
      const justification = input.exceptionJustification?.trim();

      if (
        hasPendencies &&
        input.exceptionJustification !== undefined &&
        (!justification ||
          justification.length < 8 ||
          justification.length > 2000)
      ) {
        throw new RouteClosureError(
          "BAD_REQUEST",
          "A justificativa da exceção deve ter entre 8 e 2000 caracteres"
        );
      }
      if (hasPendencies && !justification) {
        return {
          closed: false as const,
          requiresExceptionJustification: true as const,
          pendingSummary,
        };
      }

      const closedAt = new Date();
      const [closedRoute] = await transaction
        .update(supervisorRoutes)
        .set({
          kmFinal: input.kmFinal.toFixed(2),
          status: "completed",
          completedAt: closedAt,
        })
        .where(
          and(
            eq(supervisorRoutes.id, input.supervisorRouteId),
            eq(supervisorRoutes.supervisorId, input.supervisorId),
            eq(supervisorRoutes.status, "in_progress")
          )
        )
        .returning({ id: supervisorRoutes.id });
      if (!closedRoute) {
        throw new RouteClosureError(
          "CONFLICT",
          "A rota mudou de estado antes do encerramento; atualize a operação"
        );
      }

      if (hasPendencies) {
        await transaction.insert(supervisorRouteClosureExceptions).values({
          supervisorRouteId: input.supervisorRouteId,
          supervisorId: input.supervisorId,
          closedAt,
          justification: justification!,
          pendingSummary,
        });
        return {
          closed: true as const,
          exceptionAudit: {
            supervisorRouteId: input.supervisorRouteId,
            supervisorId: input.supervisorId,
            closedAt,
            justification: justification!,
            pendingSummary,
          },
        };
      }

      return { closed: true as const, exceptionAudit: null };
    }
  );
}
