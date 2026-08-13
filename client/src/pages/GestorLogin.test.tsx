/* @vitest-environment jsdom */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cancelDashboard: vi.fn().mockResolvedValue(undefined),
  cancelDailyReport: vi.fn().mockResolvedValue(undefined),
  navigate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ gestor: { dashboard: { cancel: mocks.cancelDashboard }, dailyReport: { cancel: mocks.cancelDailyReport } } }),
    gestorAccess: {
      session: { useQuery: () => ({ data: { authenticated: false }, isLoading: false }) },
      login: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

vi.mock("wouter", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>, useLocation: () => ["/gestor/acesso", mocks.navigate] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import GestorLogin from "./GestorLogin";

describe("GestorLogin", () => {
  it("cancela queries protegidas antigas antes de exibir a tela de senha", async () => {
    render(<GestorLogin />);

    expect(screen.getByText("Acesso do Gestor")).toBeTruthy();
    await waitFor(() => {
      expect(mocks.cancelDashboard).toHaveBeenCalledTimes(1);
      expect(mocks.cancelDailyReport).toHaveBeenCalledTimes(1);
    });
  });
});
