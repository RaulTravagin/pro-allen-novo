/* @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { invalidate: vi.fn() } } }),
    localAuth: {
      login: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
  },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Login from "./Login";

describe("Login", () => {
  it("exibe somente o formulário de login dos supervisores", () => {
    render(<Login />);

    expect(screen.getByText("Acesso do Supervisor")).toBeTruthy();
    expect(screen.getByLabelText("Usuário")).toBeTruthy();
    expect(screen.getByLabelText("Senha")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Entrar como supervisor" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Entrar no Sistema" })).toBeNull();
    expect(screen.queryByText("Acesso exclusivo do Gestor")).toBeNull();
  });
});
