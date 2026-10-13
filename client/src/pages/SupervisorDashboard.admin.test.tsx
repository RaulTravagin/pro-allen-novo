// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SupervisorDashboard from "./SupervisorDashboard";

const adminDashboardUseQuery = vi.hoisted(() => vi.fn());
const adminCancelableRoutesUseQuery = vi.hoisted(() => vi.fn());
const cancelActiveRouteMutation = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const logout = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      supervisorRoutes: { getTodayRoute: { invalidate: vi.fn() }, getTodayHistory: { invalidate: vi.fn() } },
      checklists: { getByRoute: { invalidate: vi.fn() } },
      adminOperations: { listCancelableRoutes: { invalidate: vi.fn() }, liveSnapshot: { invalidate: vi.fn() } },
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
    adminOperations: {
      liveSnapshot: { useQuery: adminDashboardUseQuery },
      listCancelableRoutes: { useQuery: adminCancelableRoutesUseQuery },
      cancelActiveRoute: { useMutation: () => ({ mutateAsync: cancelActiveRouteMutation, isPending: false }) },
    },
  },
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 99, role: "admin", personnelRole: "SUPERVISOR" }, logout }),
}));
vi.mock("wouter", () => ({ useLocation: () => ["/supervisor", navigate] }));

const snapshot = {
  visits: [{ postName: "Posto Alfa", status: "in_progress", arrivalTime: new Date("2026-10-01T11:45:00.000Z"), departureTime: null }],
};
const cancelableRoutes = [{
  id: 731,
  routeName: "Rota Sintética A",
  routeActivityType: "field_route" as const,
  supervisorName: "Supervisor Fixture",
  status: "in_progress" as const,
  shiftType: "day" as const,
  shiftStartedAt: new Date("2026-10-13T11:00:00.000Z"),
  startedAt: new Date("2026-10-13T12:00:00.000Z"),
}];

beforeEach(() => {
  vi.clearAllMocks();
  adminDashboardUseQuery.mockReturnValue({ data: snapshot, isLoading: false, error: null, refetch: vi.fn() });
  adminCancelableRoutesUseQuery.mockReturnValue({ data: cancelableRoutes, isLoading: false, error: null, refetch: vi.fn() });
  cancelActiveRouteMutation.mockResolvedValue({ auditId: 4401, supervisorRouteId: 731 });
});
afterEach(() => cleanup());

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
    expect(adminCancelableRoutesUseQuery).toHaveBeenCalledWith(undefined, expect.objectContaining({ enabled: true, refetchInterval: 15_000 }));
  });

  it("permite revisar a identificação mínima e exige motivo antes de chamar o cancelamento", async () => {
    render(<SupervisorDashboard />);
    expect(screen.getAllByText("Rota Sintética A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Supervisor: Supervisor Fixture · Turno diurno").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Revisar cancelamento da rota Rota Sintética A #731" }));
    expect(screen.getByRole("heading", { name: "Confirmar cancelamento da rota iniciada?" })).toBeTruthy();
    expect(screen.getByRole("alertdialog").textContent).toContain("Rota Sintética A");
    const confirmButton = screen.getByRole("button", { name: "Confirmar cancelamento" }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
    expect(cancelActiveRouteMutation).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Motivo obrigatório"), { target: { value: "Reinício operacional autorizado." } });
    expect(confirmButton.disabled).toBe(false);
    fireEvent.click(confirmButton);
    await waitFor(() => expect(cancelActiveRouteMutation).toHaveBeenCalledWith({ supervisorRouteId: 731, reason: "Reinício operacional autorizado." }));
  });

});
