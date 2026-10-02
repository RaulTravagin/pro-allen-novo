// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RouteDetails from "./RouteDetails";
import { saveRouteDraft } from "@/lib/onlineOperationDraft";

const routeQuery = vi.hoisted(() => vi.fn());
const checklistsQuery = vi.hoisted(() => vi.fn());
const postsByRouteQuery = vi.hoisted(() => vi.fn());
const coveragePostsQuery = vi.hoisted(() => vi.fn());
const vehiclesQuery = vi.hoisted(() => vi.fn());
const fuelSummaryQuery = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => {
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  const invalidate = vi.fn();
  return {
    trpc: {
      useUtils: () => ({
        supervisorRoutes: { getById: { invalidate }, getTodayRoute: { invalidate }, getTodayHistory: { invalidate }, getShiftReport: { invalidate } },
        checklists: { getByRoute: { invalidate } },
        fleet: { getFuelSummary: { invalidate }, listVehicles: { invalidate } },
      }),
      supervisorRoutes: {
        getById: { useQuery: routeQuery },
        getShiftReport: { useQuery: () => ({ data: null, isLoading: false, error: null, refetch: vi.fn() }) },
        updateKm: { useMutation: mutation },
        cancelPending: { useMutation: mutation },
        finishShift: { useMutation: mutation },
        getPostPops: { useQuery: () => ({ data: [], isLoading: false, isSuccess: true, error: null }) },
      },
      checklists: {
        getByRoute: { useQuery: checklistsQuery },
        getCoveragePosts: { useQuery: coveragePostsQuery },
        createForRoute: { useMutation: mutation },
        checkIn: { useMutation: mutation },
        checkOut: { useMutation: mutation },
        createCoverage: { useMutation: mutation },
      },
      routes: { getPostsByRoute: { useQuery: postsByRouteQuery } },
      fleet: {
        listVehicles: { useQuery: vehiclesQuery },
        getFuelSummary: { useQuery: fuelSummaryQuery },
        saveVehicle: { useMutation: mutation },
        registerFuel: { useMutation: mutation },
        updateFuel: { useMutation: mutation },
      },
      locations: { record: { useMutation: mutation } },
      postPops: { downloadUrl: { useMutation: mutation } },
    },
  };
});
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 99, role: "admin", personnelRole: "SUPERVISOR" }, logout: vi.fn() }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/supervisor/route/31", navigate] }));
vi.mock("@/components/SupervisorShiftReportDialog", () => ({ default: () => null }));
vi.mock("@/lib/onlineOperationDraft", () => ({ clearRouteDraft: vi.fn(), readRouteDraft: vi.fn(), saveRouteDraft: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  routeQuery.mockReturnValue({ data: {
    id: 31,
    supervisorId: 17,
    routeId: 4,
    routeName: "Rota Norte",
    routeRegion: "Jundiaí",
    routeActivityType: "field_route",
    status: "in_progress",
    vehicleId: null,
    kmInitial: null,
    kmFinal: null,
  }, isLoading: false, error: null, refetch: vi.fn() });
  checklistsQuery.mockReturnValue({ data: [{
    postName: "Posto Alfa",
    status: "in_progress",
    arrivalTime: new Date("2026-10-01T11:45:00.000Z"),
    departureTime: null,
  }], isLoading: false, error: null, refetch: vi.fn() });
  postsByRouteQuery.mockReturnValue({ data: [{ id: 14, name: "Posto Alfa", address: "Endereço não autorizado", region: "Jundiaí" }], isLoading: false });
  coveragePostsQuery.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() });
  vehiclesQuery.mockReturnValue({ data: [], isLoading: false });
  fuelSummaryQuery.mockReturnValue({ data: null, isLoading: false });
});

describe("RouteDetails Admin read-only", () => {
  it("exibe apenas posto, status e horário com atualização periódica, sem texto ou ações não autorizadas", () => {
    render(<RouteDetails params={{ supervisorRouteId: "31" }} />);

    expect(screen.getByText("Detalhes da Rota")).toBeTruthy();
    expect(screen.getByText("in_progress")).toBeTruthy();
    expect(screen.getByText("Posto Alfa")).toBeTruthy();
    expect(screen.getByText(/Entrada:/)).toBeTruthy();
    expect(screen.getByText("Somente leitura")).toBeTruthy();
    expect(screen.queryByText(/Relato existente|Observação não autorizada|Justificativa não autorizada|Endereço não autorizado|-12\.500000/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Ver ocorrência|POP/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Registrar chegada|Registrar saída|Iniciar turno|Encerrar turno|Cancelar rota|Nova viatura|Cadastrar|Registrar abastecimento|Salvar abastecimento|Adicionar ocorrência|Registrar atividade na base|Tentar novamente/ })).toBeNull();
    expect(screen.queryByLabelText("vehicle-select")).toBeNull();
    expect(screen.queryByLabelText("kmInitial")).toBeNull();
    expect(screen.queryByText("Controle da viatura")).toBeNull();
    expect(screen.queryByText("Média de consumo")).toBeNull();
    expect(routeQuery).toHaveBeenCalledWith({ id: 31 }, expect.objectContaining({ refetchInterval: 15_000 }));
    expect(checklistsQuery).toHaveBeenCalledWith({ supervisorRouteId: 31 }, expect.objectContaining({ refetchInterval: 15_000 }));
    expect(postsByRouteQuery).toHaveBeenCalledWith({ routeId: 4 }, { enabled: false });
    expect(coveragePostsQuery).toHaveBeenCalledWith({ supervisorRouteId: 31 }, { enabled: false });
    expect(vehiclesQuery).toHaveBeenCalledWith(undefined, { enabled: false });
    expect(fuelSummaryQuery).toHaveBeenCalledWith({ vehicleId: 0 }, { enabled: false });
    expect(saveRouteDraft).not.toHaveBeenCalled();
  });
});
