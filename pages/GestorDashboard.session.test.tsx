/* @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dashboardQuery: vi.fn(),
  dailyReportQuery: vi.fn(),
  scheduleQuery: vi.fn(),
  postsManagementQuery: vi.fn(),
  sessionQuery: { data: { authenticated: false }, isLoading: false, isFetchedAfterMount: false, isSuccess: false },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    gestorAccess: {
      session: {
        useQuery: () => mocks.sessionQuery,
      },
      logout: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    gestor: { dashboard: { useQuery: mocks.dashboardQuery }, dailyReport: { useQuery: mocks.dailyReportQuery }, schedule: { useQuery: mocks.scheduleQuery }, updateSchedule: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) }, postsManagement: { useQuery: mocks.postsManagementQuery }, createPost: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) } },
    useUtils: () => ({ gestor: { schedule: { invalidate: vi.fn() }, postsManagement: { invalidate: vi.fn() } } }),
  },
}));

vi.mock("@/components/Map", () => ({
  MapView: () => <div data-testid="operational-map" />,
}));

vi.mock("wouter", () => ({ useLocation: () => ["/gestor", vi.fn()] }));

import GestorDashboard from "./GestorDashboard";

describe("GestorDashboard com sessão em validação", () => {
  beforeEach(() => {
    mocks.sessionQuery = { data: { authenticated: false }, isLoading: false, isFetchedAfterMount: false, isSuccess: false };
    mocks.dashboardQuery.mockReset();
    mocks.dashboardQuery.mockReturnValue({ data: undefined, isLoading: false });
    mocks.dailyReportQuery.mockReset();
    mocks.dailyReportQuery.mockReturnValue({ data: undefined, isLoading: false, isFetching: false, refetch: vi.fn() });
    mocks.scheduleQuery.mockReset();
    mocks.scheduleQuery.mockReturnValue({ data: undefined, isLoading: false });
    mocks.postsManagementQuery.mockReset();
    mocks.postsManagementQuery.mockReturnValue({ data: undefined, isLoading: false });
  });

  it("não habilita a consulta protegida até confirmar a sessão nesta navegação", () => {
    render(<GestorDashboard />);

    expect(screen.getByText("Conferindo acesso do Gestor...")).toBeTruthy();
    expect(mocks.dashboardQuery).toHaveBeenCalledWith(undefined, expect.objectContaining({ enabled: false }));
    expect(mocks.dailyReportQuery).toHaveBeenCalledWith(
      expect.objectContaining({ reportDate: expect.any(Date) }),
      expect.objectContaining({ enabled: false })
    );
    expect(mocks.scheduleQuery).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleDate: expect.any(Date) }),
      expect.objectContaining({ enabled: false })
    );
    expect(mocks.postsManagementQuery).toHaveBeenCalledWith(undefined, expect.objectContaining({ enabled: false }));
  });

  it("mantém a ordem dos hooks ao passar da sessão em validação para autenticada", () => {
    const { rerender } = render(<GestorDashboard />);
    mocks.sessionQuery = { data: { authenticated: true }, isLoading: false, isFetchedAfterMount: true, isSuccess: true };
    mocks.dashboardQuery.mockReturnValue({ data: { operationalSupervisors: [], metrics: {}, alerts: [], recentVisits: [], lastUpdatedAt: new Date() }, isLoading: false });

    rerender(<GestorDashboard />);

    expect(screen.getByText("Monitoramento de ponta a ponta")).toBeTruthy();
    expect(screen.getByText("Nenhum supervisor cadastrado")).toBeTruthy();
    expect(mocks.dashboardQuery).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ enabled: true }));
  });
});
