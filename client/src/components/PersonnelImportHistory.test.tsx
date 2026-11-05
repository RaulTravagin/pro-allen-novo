/* @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersonnelImportPayload } from "@shared/personnelImport";

const hooks = vi.hoisted(() => ({ list: vi.fn(() => ({ data: [], isLoading: false, isError: false })), detail: vi.fn(() => ({ data: undefined, isLoading: false, isError: false })) }));
vi.mock("@/lib/trpc", () => ({ trpc: { personnel: { importBatches: { useQuery: hooks.list }, importBatch: { useQuery: hooks.detail } } } }));
import { PersonnelImportHistory, PersonnelImportSourceViewer } from "./PersonnelImportHistory";

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const payload: PersonnelImportPayload = {
  fileName: "modelo-ficticio.xlsx", fileSha256: "b".repeat(64),
  summary: { sourceEmployees: 2, created: 1, updated: 0, pending: 1, warnings: 0, unlinkedContacts: 0 },
  sheets: [{ name: "Cadastro", headerRow: 1, rows: [
    { row: 1, status: "REFERENCE", reasons: [], cells: [{ column: "B", header: "Matrícula", value: "Cabeçalho fictício" }] },
    { row: 2, status: "IMPORTED", employeeId: 7, reasons: [], cells: [{ column: "B", header: "Matrícula", value: "0007" }] },
    { row: 3, status: "PENDING", reasons: ["Conferir vínculo fictício"], cells: [{ column: "C", header: "Nome", value: "<script>alert(1)</script>" }] },
  ] }],
};

describe("Histórico de planilhas RH", () => {
  it("prioriza pendências e permite ver a origem inteira sem executar o texto da fonte", () => {
    const { container } = render(<PersonnelImportSourceViewer payload={payload} />);
    expect(screen.getByText("<script>alert(1)</script>")).toBeTruthy();
    expect(container.querySelector("script")).toBeNull();
    expect(screen.queryByText("0007")).toBeNull();
    fireEvent.change(screen.getByLabelText("Situação da linha"), { target: { value: "ALL" } });
    expect(screen.getByText("0007")).toBeTruthy();
    expect(screen.getByText("Cabeçalho fictício")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Buscar na origem"), { target: { value: "0007" } });
    expect(screen.getByText("0007")).toBeTruthy();
    expect(screen.queryByText("<script>alert(1)</script>")).toBeNull();
  });

  it.each(["SUPERVISOR", "FINANCEIRO"] as const)("não consulta nem renderiza o histórico para %s", role => {
    const { container } = render(<PersonnelImportHistory role={role} />);
    expect(container.innerHTML).toBe("");
    expect(hooks.list).not.toHaveBeenCalled();
    expect(hooks.detail).not.toHaveBeenCalled();
  });
});
