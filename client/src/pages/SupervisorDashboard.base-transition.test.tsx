// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SupervisorDashboard from "./SupervisorDashboard";

const invalidate = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ supervisorRoutes: { getTodayRoute: { invalidate }, getTodayHistory: { invalidate } }, checklists: { getByRoute: { invalidate } } }),
    routes: {
      list: { useQuery: () => ({ data: [{ id: 1, name: "Rota 1", region: "Jundiaí", activityType: "field_route" }, { id: 50_001, name: "Base Operacional", region: "Operação Interna", activityType: "operational_base" }], isLoading: false, isError: false }) },
      getPostsByRoute: { useQuery: () => ({ data: [], isLoading: false }) },
    },
    supervisorRoutes: {
      getTodayRoute: { useQuery: () => ({ data: null, isLoading: false }) },
      getTodayHistory: { useQuery: () => ({ data: [{ id: 50_101, routeName: "Base Operacional", routeActivityType: "operational_base", status: "completed", completedAt: new Date("2026-08-17T12:00:00.000Z") }], isLoading: false }) },
      create: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
    },
    checklists: { createForRoute: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) }, getByRoute: { useQuery: () => ({ data: [] }) } },
  },
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 3_270_010, role: "user" }, logout: vi.fn() }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/supervisor", vi.fn()] }));

describe("SupervisorDashboard após Base Operacional", () => {
  it("orienta o supervisor a escolher uma rota de campo depois de encerrar a Base", () => {
    render(<SupervisorDashboard />);

    expect(screen.getByText("Base Operacional encerrada")).toBeTruthy();
    expect(screen.getAllByText("Iniciar rota de campo").length).toBeGreaterThan(0);
    expect(screen.getByText(/Agora escolha uma rota de campo para continuar o turno/)).toBeTruthy();
    expect(screen.getByLabelText("Selecionar rota")).toBeTruthy();
  });
});
