import { describe, expect, it } from "vitest";
import { selectOpenSupervisorRoute } from "./supervisor-route-selection";

describe("selectOpenSupervisorRoute", () => {
  it("retoma uma rota em andamento existente antes de escolher outra pendente", () => {
    const inProgressRoute = { id: 12, status: "in_progress" };
    const pendingRoute = { id: 13, status: "pending" };

    expect(selectOpenSupervisorRoute([pendingRoute, inProgressRoute])).toBe(
      inProgressRoute
    );
  });

  it("não retoma a rota concluída do turno anterior quando existe uma rota pendente nova", () => {
    const previousShift = {
      id: 13,
      status: "completed",
      kmInitial: "340091",
      kmFinal: "340226",
    };
    const nextShift = {
      id: 14,
      status: "pending",
      kmInitial: null,
      kmFinal: null,
    };

    expect(selectOpenSupervisorRoute([previousShift, nextShift])).toBe(
      nextShift
    );
    expect(previousShift).toMatchObject({
      status: "completed",
      kmFinal: "340226",
    });
  });

  it("retorna null quando só há histórico encerrado, sem apagar esse histórico", () => {
    const history = [
      { id: 13, status: "completed" },
      { id: 12, status: "cancelled" },
    ];
    expect(selectOpenSupervisorRoute(history)).toBeNull();
    expect(history).toHaveLength(2);
  });
});
