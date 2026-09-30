import { describe, expect, it } from "vitest";
import { buildSupervisorShiftReport } from "./supervisor-shift-report";

describe("buildSupervisorShiftReport", () => {
  it("consolida a jornada do supervisor com coberturas, KM, abastecimentos e ocorrências", () => {
    const report = buildSupervisorShiftReport({
      reportDate: new Date("2026-08-25T12:00:00.000Z"),
      activeRoutes: [
        {
          id: 12,
          supervisorId: 7,
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
        {
          id: 13,
          supervisorId: 7,
          supervisorName: "Paulo Murashita",
          supervisorUsername: "paulo.murashita",
          routeName: "Rota 1",
          routeRegion: "Jundiaí",
          routeActivityType: "field_route",
          shiftType: "day",
          status: "in_progress",
          shiftStartedAt: new Date("2026-08-25T10:05:00.000Z"),
          startedAt: new Date("2026-08-25T10:05:00.000Z"),
          completedAt: null,
          kmInitial: "12008",
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
        },
      ],
    }, 7, 13);

    expect(report).toMatchObject({
      supervisor: { id: 7, name: "Paulo Murashita" },
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
    expect(report?.visits.map((visit) => visit.postName)).toEqual(["Kelvion", "Base Operacional"]);
    expect(report?.visits[1]?.coverageReason).toBe("Retorno à base para apoio operacional");
    expect(report?.activities.map((activity) => activity.routeActivityType)).toEqual(["operational_base", "field_route"]);
  });

  it("não reutiliza dados da atividade mais recente quando a rota solicitada pertence a outro turno", () => {
    const nextShiftRoute = {
      id: 14,
      supervisorId: 7,
      routeName: "Rota Nova Fictícia",
      routeRegion: "Região de teste",
      routeActivityType: "field_route",
      shiftType: "night",
      status: "in_progress",
      shiftStartedAt: new Date("2026-09-30T21:00:00.000Z"),
      startedAt: new Date("2026-09-30T21:05:00.000Z"),
      visits: [{ id: 41, postName: "Posto Novo Fictício", status: "visited", occurrenceReport: "Relato do novo turno" }],
      fuelLogs: [],
    };
    const snapshot = { activeRoutes: [nextShiftRoute] };

    expect(buildSupervisorShiftReport(snapshot, 7, 13)).toBeNull();
    const report = buildSupervisorShiftReport(snapshot, 7, 14);
    expect(report?.supervisorRouteId).toBe(14);
    expect(report?.visits.map((visit) => visit.postName)).toEqual(["Posto Novo Fictício"]);
    expect(report?.visits.some((visit) => visit.postName === "Posto antigo fictício")).toBe(false);
  });
});
