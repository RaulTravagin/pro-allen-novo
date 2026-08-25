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
          checklistVisits: [],
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
          checklistVisits: [
            {
              id: 21,
              postName: "Kelvion",
              postRegion: "Jundiaí",
              status: "visited",
              arrivalTime: new Date("2026-08-25T10:30:00.000Z"),
              departureTime: new Date("2026-08-25T10:55:00.000Z"),
              observations: "Portaria em ordem",
              isCoverage: false,
              checklistSummary: { total: 9, compliant: 8, nonCompliant: 1, unanswered: 0 },
              checklistItems: [],
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
              checklistSummary: { total: 9, compliant: 0, nonCompliant: 0, unanswered: 9 },
              checklistItems: [],
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
        nonCompliantItems: 1,
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
});
