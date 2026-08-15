/* @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

const now = new Date("2026-08-12T15:00:00.000Z");
const wordExport = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const scheduleUpdate = vi.hoisted(() => vi.fn());
const postCreate = vi.hoisted(() => vi.fn());
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
    checklistItems: [{ id: 1, category: "Uniforme", description: "Uniforme e apresentação pessoal", isCompliant: true, notes: "Em ordem" }, { id: 2, category: "Limpeza", description: "Limpeza e organização", isCompliant: false, notes: "Ajustar área comum" }],
  }],
};

const scheduleFixture = {
  scheduleDate: now,
  supervisors: [
    { supervisorId: 41, supervisorName: "Paulo Murashita", username: "paulo.murashita", assignment: "night", defaultShift: "reliever", note: "Plantão noturno de cobertura", isOverride: true },
    { supervisorId: 42, supervisorName: "Rodrigo Ramos", username: "rodrigo.ramos", assignment: "day", defaultShift: "day", note: "Plantão realizado das 06h às 18h", isOverride: true },
    { supervisorId: 43, supervisorName: "Aparecido Quirino", username: "aparecido.quirino", assignment: "off", defaultShift: "night", note: "Folga", isOverride: true },
  ],
};

const postsManagementFixture = {
  routes: [
    { id: 1, name: "Rota 1", region: "Jundiaí", posts: [{ id: 101, name: "Kelvion", region: "Jundiaí", address: "Jundiaí", order: 1 }] },
    { id: 2, name: "Rota 2", region: "Cabreúva", posts: [] },
  ],
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
              route: { name: "Rota 1", region: "Jundiaí", totalPosts: 4, completedVisits: 1, kmInitial: "1250", kmCovered: 0, activeVisit: { postName: "Kelvion", arrivalTime: now, durationMinutes: 30 }, visits: [{ postName: "Kelvion", region: "Jordanésia", status: "in_progress", arrivalTime: now, departureTime: null, durationMinutes: 30, observations: "Verificar troca de uniforme.", isCoverage: false, checklist: { total: 9, compliant: 4, nonCompliant: 1, unanswered: 4 }, checklistItems: route.checklistVisits[0].checklistItems }] },
            }],
          },
        }),
      },
      schedule: {
        useQuery: () => ({
          isLoading: false,
          data: scheduleFixture,
        }),
      },
      updateSchedule: { useMutation: () => ({ mutate: scheduleUpdate, isPending: false, error: null }) },
      postsManagement: { useQuery: () => ({ isLoading: false, data: postsManagementFixture }) },
      createPost: { useMutation: () => ({ mutate: postCreate, isPending: false, error: null }) },
    },
    useUtils: () => ({ gestor: { schedule: { invalidate: vi.fn() }, postsManagement: { invalidate: vi.fn() } } }),
  },
}));

vi.mock("@/lib/dailyReportDocx", () => ({
  downloadDailyReportWord: wordExport,
}));

vi.mock("@/components/Map", () => ({
  MapView: ({ className }: { className?: string }) => <div data-testid="operational-map" className={className}>Mapa Google</div>,
}));

vi.mock("wouter", () => ({ useLocation: () => ["/gestor", vi.fn()] }));

import GestorDashboard from "./GestorDashboard";

describe("GestorDashboard", () => {
  afterEach(() => cleanup());

  it("mostra a central detalhada de operação por supervisor", () => {
    render(<GestorDashboard />);

    expect(screen.getByText("Monitoramento de ponta a ponta")).toBeTruthy();
    expect(screen.getAllByText("Paulo Murashita").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Em atendimento").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kelvion").length).toBeGreaterThan(0);
    expect(screen.getByText("Verificar troca de uniforme.")).toBeTruthy();
    expect(screen.getByText("Atendimento prolongado · Paulo Murashita")).toBeTruthy();
    expect(screen.getByText("Postos e checklist da rota")).toBeTruthy();
    expect(screen.getAllByText("Checklist por visita").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Requer atenção").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Uniforme e apresentação pessoal").length).toBeGreaterThan(0);
    expect(screen.getByText("Escala de plantão")).toBeTruthy();
    expect(screen.getByText("Plantão Noite")).toBeTruthy();
    expect(screen.getByText("Plantão realizado das 06h às 18h")).toBeTruthy();
    expect(screen.getAllByText("Folga").length).toBeGreaterThan(0);
    expect(screen.getByText("Progresso da equipe em um olhar")).toBeTruthy();
    expect(screen.getByText("Progresso por supervisor")).toBeTruthy();
    expect(screen.getByText("Mapa operacional")).toBeTruthy();
    expect(screen.getByTestId("operational-map")).toBeTruthy();
    expect(screen.getByText("posto(s) aguardando endereço completo para localização")).toBeTruthy();
  });

  it("permite que o Gestor edite e salve a escala diária", async () => {
    scheduleUpdate.mockReset();
    render(<GestorDashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Alterar escala" }));
    const pauloSchedule = screen.getByLabelText("Escala de Paulo Murashita") as HTMLSelectElement;
    fireEvent.change(pauloSchedule, { target: { value: "day" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar escala" }));

    await waitFor(() => expect(scheduleUpdate).toHaveBeenCalledWith(expect.objectContaining({
      entries: expect.arrayContaining([expect.objectContaining({ supervisorId: 41, assignment: "day" })]),
    })));
  });

  it("permite que o Gestor cadastre um novo posto vinculado à rota", async () => {
    postCreate.mockReset();
    render(<GestorDashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Novo posto" }));
    await waitFor(() => expect((screen.getByLabelText("Rota vinculada") as HTMLSelectElement).value).toBe("1"));
    fireEvent.change(screen.getByLabelText("Nome do posto"), { target: { value: "Novo Cliente" } });
    fireEvent.change(screen.getByLabelText("Região do posto"), { target: { value: "Jundiaí" } });
    fireEvent.change(screen.getByLabelText("Endereço do posto"), { target: { value: "Rua das Flores, 100" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar posto" }));

    await waitFor(() => expect(postCreate).toHaveBeenCalledWith({ routeId: 1, name: "Novo Cliente", region: "Jundiaí", address: "Rua das Flores, 100" }));
  });

  it("gera a visualização clara do relatório diário e disponibiliza a exportação Word", async () => {
    render(<GestorDashboard />);
    fireEvent.click(screen.getByRole("button", { name: "Relatório do dia" }));

    expect(screen.getByText("Relatório operacional diário")).toBeTruthy();
    expect(screen.getByText("Acompanhamento completo dos supervisores")).toBeTruthy();
    const dateInput = screen.getByLabelText("Data do relatório") as HTMLInputElement;
    expect(dateInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.change(dateInput, { target: { value: "2026-08-14" } });
    expect(dateInput.value).toBe("2026-08-14");
    const exportButton = screen.getByRole("button", { name: "Baixar Word" });
    expect(exportButton).toBeTruthy();
    fireEvent.click(exportButton);
    await waitFor(() => expect(wordExport).toHaveBeenCalled());
    expect(screen.getAllByText("Paulo Murashita").length).toBeGreaterThan(1);
    expect(screen.getByText("Itens conformes")).toBeTruthy();
  });
});
