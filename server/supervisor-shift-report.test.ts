import { describe, expect, it } from "vitest";
import { buildSupervisorShiftReport } from "./supervisor-shift-report";

const supervisorId = 7;

function routeActivity(input: Record<string, unknown>) {
  return {
    id: 13,
    supervisorId,
    supervisorName: "Paulo Murashita",
    supervisorUsername: "paulo.murashita",
    routeName: "Rota 1",
    routeRegion: "Jundiaí",
    routeActivityType: "field_route",
    shiftType: "day",
    shiftStartedAt: new Date("2026-08-25T09:00:00.000Z"),
    startedAt: new Date("2026-08-25T10:05:00.000Z"),
    status: "completed",
    completedAt: new Date("2026-08-25T18:30:00.000Z"),
    kmInitial: "12008",
    kmFinal: "12025",
    kmCovered: 17,
    visits: [],
    fuelLogs: [],
    ...input,
  };
}

describe("buildSupervisorShiftReport", () => {
  it("consolida atividades anteriores do mesmo turno e exclui atividades posteriores", () => {
    const report = buildSupervisorShiftReport({
      reportDate: new Date("2026-08-25T12:00:00.000Z"),
      activeRoutes: [
        {
          id: 12,
          supervisorId,
          supervisorName: "Paulo Murashita",
          supervisorUsername: "paulo.murashita",
          routeName: "Base Operacional",
          routeRegion: "Operação interna",
          routeActivityType: "operational_base",
          shiftType: "day",
          status: "completed",
          shiftStartedAt: new Date("2026-08-25T09:00:00.000Z"),
          startedAt: new Date("2026-08-25T09:05:00.000Z"),
          completedAt: new Date("2026-08-25T10:00:00.000Z"),
          kmInitial: "12000",
          kmFinal: "12008",
          kmCovered: 8,
          visits: [],
          fuelLogs: [],
        },
        routeActivity({
          status: "in_progress",
          completedAt: null,
          kmFinal: null,
          kmCovered: null,
          visits: [
            {
              id: 21,
              postName: "Kelvion",
              postRegion: "Jundiaí",
              status: "visited",
              arrivalTime: new Date("2026-08-25T10:30:00.000Z"),
              departureTime: new Date("2026-08-25T10:55:00.000Z"),
              observations: "Portaria em ordem",
              isCoverage: false,
              occurrenceReport: "Portaria em ordem",
              occurrenceSubmittedAt: new Date("2026-08-25T10:56:00.000Z"),
            },
            {
              id: 22,
              postName: "Base Operacional",
              postRegion: "Operação interna",
              status: "in_progress",
              arrivalTime: new Date("2026-08-25T11:10:00.000Z"),
              departureTime: null,
              observations: null,
              isCoverage: true,
              coverageReason: "Retorno à base para apoio operacional",
            },
          ],
          fuelLogs: [{ id: 31, amount: "200.50", liters: "25.5", createdAt: new Date("2026-08-25T11:30:00.000Z") }],
        }),
        routeActivity({
          id: 14,
          routeName: "Turno seguinte",
          shiftType: "night",
          startedAt: new Date("2026-08-25T21:00:00.000Z"),
          visits: [{ id: 41, postName: "Posto do turno seguinte", status: "visited" }],
          fuelLogs: [{ id: 42, amount: "900", liters: "99", createdAt: new Date("2026-08-25T21:30:00.000Z") }],
        }),
        routeActivity({
          id: 15,
          routeName: "Atividade posterior",
          startedAt: new Date("2026-08-25T19:00:00.000Z"),
          visits: [{ id: 51, postName: "Posto posterior", status: "visited" }],
        }),
      ],
    }, supervisorId, 13);

    expect(report).toMatchObject({
      supervisor: { id: supervisorId, name: "Paulo Murashita" },
      supervisorRouteId: 13,
      status: "in_progress",
      metrics: {
        kmInitial: 12000,
        kmCovered: 8,
        totalVisits: 2,
        completedVisits: 1,
        visitsInProgress: 1,
        coverageCount: 1,
        occurrenceCount: 1,
        observationCount: 2,
        fuelCount: 1,
        fuelAmount: 200.5,
        fuelLiters: 25.5,
      },
    });
    expect(report?.visits.map(visit => visit.postName)).toEqual(["Kelvion", "Base Operacional"]);
    expect(report?.visits[1]?.coverageReason).toBe("Retorno à base para apoio operacional");
    expect(report?.activities.map(activity => activity.id)).toEqual([12, 13]);
    expect(report?.fuelLogs.map(fuel => fuel.id)).toEqual([31]);
  });

  it("mantém pendências e KM final da rota encerrada sem herdar dados posteriores", () => {
    const completedAt = new Date("2026-09-30T20:00:00.000Z");
    const targetRoute = routeActivity({
      id: 69,
      status: "completed",
      completedAt,
      shiftStartedAt: new Date("2026-09-30T08:00:00.000Z"),
      startedAt: new Date("2026-09-30T08:05:00.000Z"),
      kmInitial: "340091",
      kmFinal: "340226",
      kmCovered: 135,
      visits: [
        { id: 701, postName: "Posto concluído fictício", status: "visited", occurrenceReport: "Registro enviado" },
        { id: 702, postName: "Supertec fictício", status: "pending", occurrenceReport: null },
        { id: 703, postName: "Comtec fictício", status: "pending", occurrenceReport: null },
      ],
      fuelLogs: [{ id: 704, amount: "120", liters: "15", createdAt: new Date("2026-09-30T12:00:00.000Z") }],
    });
    const nextShift = routeActivity({
      id: 70,
      routeName: "Rota do próximo turno",
      shiftType: "night",
      startedAt: new Date("2026-09-30T21:00:00.000Z"),
      completedAt: null,
      kmInitial: "340226",
      kmFinal: null,
      kmCovered: null,
      status: "in_progress",
      visits: [{ id: 705, postName: "Posto do próximo turno", status: "visited", occurrenceReport: "Outro turno" }],
      fuelLogs: [{ id: 706, amount: "700", liters: "80", createdAt: new Date("2026-09-30T21:30:00.000Z") }],
    });
    const laterSameType = routeActivity({
      id: 71,
      routeName: "Atividade posterior do mesmo tipo",
      startedAt: new Date("2026-09-30T22:00:00.000Z"),
      visits: [{ id: 707, postName: "Posto posterior", status: "visited" }],
    });
    const futurePendingRoute = routeActivity({
      id: 72,
      routeName: "Rota futura ainda pendente",
      status: "pending",
      startedAt: null,
      shiftStartedAt: new Date("2026-09-30T08:00:00.000Z"),
      visits: [{ id: 708, postName: "Posto futuro", status: "pending" }],
    });

    const report = buildSupervisorShiftReport({ activeRoutes: [targetRoute, nextShift, laterSameType, futurePendingRoute] }, supervisorId, 69);

    expect(report).toMatchObject({
      supervisorRouteId: 69,
      status: "completed",
      completedAt,
      metrics: {
        kmInitial: 340091,
        kmFinal: 340226,
        kmCovered: 135,
        totalVisits: 3,
        completedVisits: 1,
        pendingVisits: 2,
        fuelCount: 1,
        fuelAmount: 120,
        fuelLiters: 15,
      },
    });
    expect(report?.visits.map(visit => visit.postName)).toEqual([
      "Posto concluído fictício",
      "Supertec fictício",
      "Comtec fictício",
    ]);
    expect(report?.visits.filter(visit => visit.status === "pending")).toHaveLength(2);
    expect(report?.activities.map(activity => activity.id)).toEqual([69]);
    expect(report?.fuelLogs.map(fuel => fuel.id)).toEqual([704]);
  });

  it("retorna null quando a rota solicitada não pertence ao snapshot do supervisor", () => {
    const snapshot = {
      activeRoutes: [routeActivity({ id: 70, visits: [{ id: 1, postName: "Posto fictício", status: "visited" }] })],
    };
    expect(buildSupervisorShiftReport(snapshot, supervisorId, 69)).toBeNull();
  });
});
