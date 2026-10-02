// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SupervisorDashboard from "./SupervisorDashboard";

const adminDashboardUseQuery = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const logout = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      supervisorRoutes: { getTodayRoute: { invalidate: vi.fn() }, getTodayHistory: { invalidate: vi.fn() } },
      checklists: { getByRoute: { invalidate: vi.fn() } },
    }),
    routes: { list: { useQuery: () => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() }) } },
    supervisorRoutes: {
      getTodayRoute: { useQuery: () => ({ data: null, isLoading: false, error: null, refetch: vi.fn() }) },
      getTodayHistory: { useQuery: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }) },
      create: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
    },
    checklists: {
      createForRoute: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      getByRoute: { useQuery: () => ({ data: [] }) },
    },
    adminOperations: { liveSnapshot: { useQuery: adminDashboardUseQuery } },
  },
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 99, role: "admin", personnelRole: "SUPERVISOR" }, logout }),
}));
vi.mock("wouter", () => ({ useLocation: () => ["/supervisor", navigate] }));

const snapshot = {
  visits: [{ postName: "Posto Alfa", status: "in_progress", arrivalTime: new Date("2026-10-01T11:45:00.000Z"), departureTime: null }],
};

beforeEach(() => {
  vi.clearAllMocks();
  adminDashboardUseQuery.mockReturnValue({ data: snapshot, isLoading: false, error: null, refetch: vi.fn() });
});

describe("SupervisorDashboard Admin read-only", () => {
  it("exibe somente posto, status e horários com polling, sem metadados ou ações operacionais", () => {
    render(<SupervisorDashboard />);

    expect(screen.getByRole("heading", { name: "Monitoramento operacional em tempo real" })).toBeTruthy();
    expect(screen.getByText("Posto Alfa")).toBeTruthy();
    expect(screen.getAllByText("Em atendimento").length).toBeGreaterThan(0);
    expect(screen.getByText("Chegada")).toBeTruthy();
    expect(screen.getByText("Saída")).toBeTruthy();
    expect(screen.queryByText(/Supervisor Ana|Rota Norte|Jundiaí|Supervisores em rota|Visitas em atendimento|Postos pendentes|Última atualização/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Ver detalhes da rota" })).toBeNull();

    expect(screen.queryByRole("button", { name: /Preparar rota|Iniciar rota|Registrar chegada|Registrar saída|Encerrar turno|Registrar abastecimento|Adicionar ocorrência|Cadastrar viatura/ })).toBeNull();
    expect(screen.queryByText(/Último GPS|km\/L|Custo por KM|Abastecimento/)).toBeNull();
    expect(adminDashboardUseQuery).toHaveBeenCalledWith(undefined, expect.objectContaining({ enabled: true, refetchInterval: 15_000 }));
  });
});
