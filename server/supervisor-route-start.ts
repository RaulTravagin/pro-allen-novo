import { and, eq } from "drizzle-orm";
import { supervisorRoutes, vehicles } from "../drizzle/schema";
import { RouteClosureError } from "./route-closure";
import {
  lockSupervisorRouteOperations,
  withLockedSupervisorRoute,
} from "./route-checklist-lock";

export type StartSupervisorRouteInput = {
  supervisorRouteId: number;
  supervisorId: number;
  vehicleId: number;
  kmInitial: number;
};

/** Executa a transição pending → in_progress sob o mesmo lock que serializa o fechamento. */
export async function startSupervisorRouteInTransaction(
  transaction: any,
  input: StartSupervisorRouteInput
) {
  await lockSupervisorRouteOperations(transaction, input.supervisorId);

  if (!Number.isFinite(input.kmInitial) || input.kmInitial < 0) {
    throw new RouteClosureError(
      "BAD_REQUEST",
      "Informe um KM inicial válido para iniciar a rota"
    );
  }

  return withLockedSupervisorRoute(
    transaction,
    {
      supervisorRouteId: input.supervisorRouteId,
      supervisorId: input.supervisorId,
      allowedStatuses: ["pending"],
      statusMessage:
        "Somente uma rota pendente pode ser iniciada; atualize a operação antes de tentar novamente",
    },
    async route => {
      if (route.kmInitial != null || route.startedAt != null) {
        throw new RouteClosureError(
          "CONFLICT",
          "Esta rota já possui dados de início registrados"
        );
      }

      const [vehicle] = await transaction
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(
          and(eq(vehicles.id, input.vehicleId), eq(vehicles.isActive, true))
        )
        .limit(1);
      if (!vehicle) {
        throw new RouteClosureError(
          "BAD_REQUEST",
          "Viatura inválida ou indisponível"
        );
      }

      const [updated] = await transaction
        .update(supervisorRoutes)
        .set({
          kmInitial: input.kmInitial.toFixed(2),
          vehicleId: input.vehicleId,
          status: "in_progress",
          startedAt: new Date(),
        })
        .where(
          and(
            eq(supervisorRoutes.id, input.supervisorRouteId),
            eq(supervisorRoutes.supervisorId, input.supervisorId),
            eq(supervisorRoutes.status, "pending")
          )
        )
        .returning({ id: supervisorRoutes.id });

      if (!updated) {
        throw new RouteClosureError(
          "CONFLICT",
          "A rota mudou de estado antes do início; atualize a operação"
        );
      }

      return {
        started: true as const,
        supervisorRouteId: input.supervisorRouteId,
      };
    }
  );
}
