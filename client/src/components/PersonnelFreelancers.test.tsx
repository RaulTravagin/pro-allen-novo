/* @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersonnelFreelancerFields } from "@shared/personnelFreelancer";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  create: vi.fn(async () => undefined),
  update: vi.fn(async () => undefined),
  invalidate: vi.fn(async () => undefined),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ personnel: { freelancers: { invalidate: mocks.invalidate } } }),
    personnel: {
      freelancers: { useQuery: mocks.query },
      createFreelancer: { useMutation: () => ({ mutateAsync: mocks.create, isPending: false }) },
      updateFreelancer: { useMutation: () => ({ mutateAsync: mocks.update, isPending: false }) },
    },
  },
}));

import { PersonnelFreelancers } from "./PersonnelFreelancers";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const rawCollaborator = "COLABORADOR BRUTO | contato@exemplo.test | (11) 90000-0000";
const fields: PersonnelFreelancerFields = {
  collaboratorRaw: rawCollaborator,
  jobFunction: "Posto ficticio",
  situation: "Ativo",
  hours: "07:00 às 19:00",
  posts: "0007; 0012",
  coverage: "Cobertura ficticia",
  pix: "PIX-TEXTO-FICTICIO",
  value: "R$ 1.250,00",
  supervision: "Supervisão ficticia",
  observations: "Observação ficticia",
};
const record = {
  id: 12,
  ...fields,
  sourceFileSha256: "a".repeat(64),
  sourceSheet: "Planilha2",
  sourceRow: 5,
  sourceData: { cells: [{ column: "A", header: "Colaborador", value: rawCollaborator, kind: "s" }] },
};

describe("painel RH de freelancers", () => {
  it("exibe a lista separada e mantém Colaborador em texto bruto integral", () => {
    mocks.query.mockReturnValue({ data: [record], isLoading: false, isError: false });
    render(<PersonnelFreelancers role="RH" />);
    expect(screen.getByText("Freelancers", { exact: true })).toBeTruthy();
    expect(screen.getAllByText(rawCollaborator).length).toBeGreaterThan(0);
    expect(screen.getByText(/Origem: Planilha2, linha 5/)).toBeTruthy();
    expect(screen.queryByText("email@exemplo.test")).toBeNull();
  });

  it("edita os dez campos sem decompor ou normalizar Colaborador", () => {
    mocks.query.mockReturnValue({ data: [record], isLoading: false, isError: false });
    render(<PersonnelFreelancers role="ADM" />);
    fireEvent.click(screen.getAllByText(rawCollaborator)[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Editar ficha" }));
    expect(screen.getByLabelText("Colaborador (texto original) *")).toHaveProperty("value", rawCollaborator);
    expect(screen.getByLabelText("Horário")).toHaveProperty("value", "07:00 às 19:00");
    expect(screen.getByLabelText("Postos")).toHaveProperty("value", "0007; 0012");
    expect(screen.getByLabelText("Valor")).toHaveProperty("value", "R$ 1.250,00");
  });

  it.each(["SUPERVISOR", "FINANCEIRO"] as const)("não renderiza nem consulta a lista para %s", (role) => {
    mocks.query.mockReturnValue({ data: [], isLoading: false, isError: false });
    const { container } = render(<PersonnelFreelancers role={role} />);
    expect(container.innerHTML).toBe("");
    expect(mocks.query).toHaveBeenCalledWith({}, { enabled: false });
  });
});
