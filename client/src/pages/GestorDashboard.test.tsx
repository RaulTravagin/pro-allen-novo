/* @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const now = new Date("2026-08-12T15:00:00.000Z");
const route = {
  id: 30001,
  routeName: "Rota 1",
  routeRegion: "Jundiaí",
  startedAt: new Date("2026-08-12T13:00:00.000Z"),
  kmInitial: "1250.00",
  kmFinal: null,
  kmCovered: null,
  totalPosts: 4,
  completedVisits: 1,
  pendingVisits: 2,
  skippedVisits: 0,
  gpsAgeMinutes: 2,
  activeVisit: { postName: "Kelvion", arrivalTime: new Date("2026-08-12T14:30:00.000Z"), durationMinutes: 30 },
  nextPost: { postName: "Supertec" },
  checklistVisits: [{
    id: 701,
    postName: "Kelvion",
    postRegion: "Jordanésia",
    postAddress: null,
    status: "in_progress",
    arrivalTime: new Date("2026-08-12T14:30:00.000Z"),
    departureTime: null,
    visitedAt: null,
    observations: "Verificar troca de uniforme.",
    durationMinutes: 30,
    checklistSummary: { total: 9, compliant: 4, nonCompliant: 1, unanswered: 4 },
  }],
};

vi.mock("@/lib/trpc", () => ({
  trpc: {
    gestorAccess: {
      session: { useQuery: () => ({ data: { authenticated: true }, isLoading: false, isFetchedAfterMount: true, isSuccess: true }) },
      logout: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    gestor: {
      dashboard: {
        useQuery: () => ({
          isLoading: false,
          data: {
            lastUpdatedAt: now,
            metrics: { supervisorsOnRoute: 1, activeRoutes: 1, visitsInProgress: 1, completedVisits: 1, pendingVisits: 2, totalKm: 0, gpsStale: 0, alerts: 1 },
            activeRoutes: [route],
            alerts: [{ code: "visit_extended", severity: "warning", title: "Atendimento prolongado", description: "O posto está em atendimento há 100 min.", supervisorId: 41, supervisorName: "Paulo Murashita", routeId: 30001 }],
            recentVisits: [{ id: 701, postName: "Kelvion", supervisorName: "Paulo Murashita", routeName: "Rota 1", status: "in_progress", arrivalTime: route.activeVisit.arrivalTime, departureTime: null }],
            operationalSupervisors: [{
              supervisorId: 41,
              supervisorName: "Paulo Murashita",
              supervisorUsername: "paulo.murashita",
              status: "em_atendimento",
              latestLocation: { latitude: "-23.10000000", longitude: "-46.50000000", accuracy: "12.00", recordedAt: new Date("2026-08-12T14:58:00.000Z") },
              alerts: [{ code: "visit_extended", severity: "warning", title: "Atendimento prolongado", description: "O posto está em atendimento há 100 min." }],
              route,
            }],
          },
        }),
      },
    },
  },
}));

vi.mock("wouter", () => ({ useLocation: () => ["/gestor", vi.fn()] }));

import GestorDashboard from "./GestorDashboard";

describe("GestorDashboard", () => {
  it("mostra a central detalhada de operação por supervisor", () => {
    render(<GestorDashboard />);

    expect(screen.getByText("Monitoramento de ponta a ponta")).toBeTruthy();
    expect(screen.getByText("Paulo Murashita")).toBeTruthy();
    expect(screen.getAllByText("Em atendimento").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kelvion").length).toBeGreaterThan(0);
    expect(screen.getByText("Verificar troca de uniforme.")).toBeTruthy();
    expect(screen.getByText("Atendimento prolongado · Paulo Murashita")).toBeTruthy();
    expect(screen.getByText("Postos e checklist da rota")).toBeTruthy();
  });
});
