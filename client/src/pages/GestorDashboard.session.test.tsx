/* @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dashboardQuery: vi.fn(),
  dailyReportQuery: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    gestorAccess: {
      session: {
        useQuery: () => ({ data: { authenticated: false }, isLoading: false, isFetchedAfterMount: false, isSuccess: false }),
      },
      logout: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    gestor: { dashboard: { useQuery: mocks.dashboardQuery }, dailyReport: { useQuery: mocks.dailyReportQuery } },
  },
}));

vi.mock("wouter", () => ({ useLocation: () => ["/gestor", vi.fn()] }));

import GestorDashboard from "./GestorDashboard";

describe("GestorDashboard com sessão em validação", () => {
  beforeEach(() => {
    mocks.dashboardQuery.mockReset();
    mocks.dashboardQuery.mockReturnValue({ data: undefined, isLoading: false });
    mocks.dailyReportQuery.mockReset();
    mocks.dailyReportQuery.mockReturnValue({ data: undefined, isLoading: false, isFetching: false, refetch: vi.fn() });
  });

  it("não habilita a consulta protegida até confirmar a sessão nesta navegação", () => {
    render(<GestorDashboard />);

    expect(screen.getByText("Conferindo acesso do Gestor...")).toBeTruthy();
    expect(mocks.dashboardQuery).toHaveBeenCalledWith(undefined, expect.objectContaining({ enabled: false }));
    expect(mocks.dailyReportQuery).toHaveBeenCalledWith(undefined, expect.objectContaining({ enabled: false }));
  });
});
