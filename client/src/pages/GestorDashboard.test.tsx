/* @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const now = new Date("2026-08-12T15:00:00.000Z");
const wordExport = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
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
      dailyReport: {
        useQuery: () => ({
          isLoading: false,
          isFetching: false,
          refetch: vi.fn(),
          data: {
            reportDate: now,
            generatedAt: now,
            summary: { supervisors: 1, supervisorsOnRoute: 1, completedVisits: 1, pendingVisits: 2, visitsInProgress: 1, coverages: 0, kmCovered: 0, nonCompliantItems: 1, unansweredItems: 4, alerts: 1 },
            supervisors: [{
              supervisorId: 41,
              supervisorName: "Paulo Murashita",
              operationalStatus: "em_atendimento",
              operationalStatusLabel: "Em atendimento",
              latestLocation: { latitude: "-23.1", longitude: "-46.5", recordedAt: now },
              alerts: [{ title: "Atendimento prolongado" }],
              checklistTotals: { total: 9, compliant: 4, nonCompliant: 1, unanswered: 4 },
              coverageCount: 0,
              route: { name: "Rota 1", region: "Jundiaí", totalPosts: 4, completedVisits: 1, kmInitial: "1250", kmCovered: 0, activeVisit: { postName: "Kelvion", arrivalTime: now, durationMinutes: 30 }, visits: [{ postName: "Kelvion", region: "Jordanésia", status: "in_progress", arrivalTime: now, departureTime: null, durationMinutes: 30, observations: "Verificar troca de uniforme.", isCoverage: false, checklist: { total: 9, compliant: 4, nonCompliant: 1, unanswered: 4 } }] },
            }],
          },
        }),
      },
    },
  },
}));

vi.mock("@/lib/dailyReportDocx", () => ({
  downloadDailyReportWord: wordExport,
}));

vi.mock("wouter", () => ({ useLocation: () => ["/gestor", vi.fn()] }));

import GestorDashboard from "./GestorDashboard";

describe("GestorDashboard", () => {
  afterEach(() => cleanup());

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

  it("gera a visualização clara do relatório diário e disponibiliza a exportação Word", async () => {
    render(<GestorDashboard />);
    fireEvent.click(screen.getByRole("button", { name: "Relatório do dia" }));

    expect(screen.getByText("Relatório operacional diário")).toBeTruthy();
    expect(screen.getByText("Acompanhamento completo dos supervisores")).toBeTruthy();
    const exportButton = screen.getByRole("button", { name: "Baixar Word" });
    expect(exportButton).toBeTruthy();
    fireEvent.click(exportButton);
    expect(wordExport).toHaveBeenCalled();
    expect(screen.getAllByText("Paulo Murashita").length).toBeGreaterThan(1);
    expect(screen.getByText("Checklist conforme")).toBeTruthy();
  });
});
