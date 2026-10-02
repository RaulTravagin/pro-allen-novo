// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OccurrencePage from "./OccurrencePage";
import { readOccurrenceDraft, saveOccurrenceDraft } from "@/lib/onlineOperationDraft";

const submitOccurrence = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ checklists: { getById: { invalidate: vi.fn() } } }),
    checklists: {
      getById: { useQuery: () => ({ data: {
        postName: "Posto Alfa",
        status: "in_progress",
        arrivalTime: new Date("2026-10-01T11:45:00.000Z"),
        departureTime: null,
      }, isLoading: false, error: null, refetch: vi.fn() }) },
      submitOccurrence: { useMutation: () => ({ mutateAsync: submitOccurrence, isPending: false }) },
    },
  },
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 99, role: "admin", personnelRole: "SUPERVISOR" }, logout: vi.fn() }) }));
vi.mock("@/lib/onlineOperationDraft", () => ({
  clearOccurrenceDraft: vi.fn(),
  readOccurrenceDraft: vi.fn(),
  saveOccurrenceDraft: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("OccurrencePage Admin read-only", () => {
  it("mostra apenas posto, status e horários, sem texto de relato, edição ou envio", async () => {
    render(<OccurrencePage params={{ visitId: "501" }} />);

    expect(await screen.findByText("Posto Alfa")).toBeTruthy();
    expect(screen.getByText("Em atendimento")).toBeTruthy();
    expect(screen.getByText("Visualização administrativa")).toBeTruthy();
    expect(screen.getByText("Entrada")).toBeTruthy();
    expect(screen.getByText("Saída")).toBeTruthy();
    expect(screen.queryByText("Relato confirmado para consulta administrativa.")).toBeNull();
    expect(screen.queryByText("Observação que não deve aparecer")).toBeNull();
    expect(screen.queryByText("Justificativa que não deve aparecer")).toBeNull();
    expect(screen.queryByText("Duração")).toBeNull();
    expect(screen.queryByLabelText("Relato da visita")).toBeNull();
    expect(screen.queryByText("Registro detalhado")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Enviar ocorrência ao Gestor/ })).toBeNull();
    expect(submitOccurrence).not.toHaveBeenCalled();
    expect(readOccurrenceDraft).not.toHaveBeenCalled();
    expect(saveOccurrenceDraft).not.toHaveBeenCalled();
  });
});
