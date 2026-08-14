import { describe, expect, it } from "vitest";
import { buildGestorVisualProgress } from "./gestorVisualProgress";

describe("buildGestorVisualProgress", () => {
  it("consolida o progresso e o status de cada supervisor", () => {
    const data = buildGestorVisualProgress([
      {
        supervisorId: 1,
        supervisorName: "Paulo",
        operationalStatus: "em_atendimento",
        alerts: [{ code: "GPS_STALE" }],
        route: {
          routeName: "Rota 1",
          totalPosts: 5,
          completedVisits: 2,
          checklistVisits: [{ status: "visited" }, { status: "visited" }, { status: "in_progress" }],
        },
      },
      { supervisorId: 2, supervisorName: "Rodrigo", operationalStatus: "sem_rota", alerts: [], route: null },
    ]);

    expect(data.supervisorProgress[0]).toMatchObject({ completed: 2, inProgress: 1, pending: 2, progress: 40, alertCount: 1, checklistTotal: 0, complianceRate: 0 });
    expect(data.supervisorProgress[1]).toMatchObject({ total: 0, progress: 0, statusLabel: "Sem rota" });
    expect(data.totals).toMatchObject({ total: 5, completed: 2, inProgress: 1, pending: 2, supervisorsWithAlerts: 1, averageProgress: 40 });
    expect(data.statusDistribution).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Em atendimento", count: 1 }), expect.objectContaining({ name: "Sem rota", count: 1 })]));
  });

  it("retorna uma estrutura vazia segura quando não há supervisores operacionais", () => {
    const data = buildGestorVisualProgress([]);

    expect(data.supervisorProgress).toEqual([]);
    expect(data.routePerformance).toEqual([]);
    expect(data.statusDistribution).toEqual([]);
    expect(data.totals).toMatchObject({ total: 0, completed: 0, pending: 0, averageProgress: 0 });
  });
});
