/* @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PersonnelEmployeeProfileEditor, countPersonnelProfileFields, personnelEmployeeMatchesSearch } from "./PersonnelEmployeeProfile";
import { personnelProfileFields, type PersonnelEmployeeProfile } from "@shared/personnelEmployeeProfile";

afterEach(cleanup);
const source: NonNullable<PersonnelEmployeeProfile["sources"]>[number] = {
  fileName: "modelo-ficticio.xlsx", fileSha256: "a".repeat(64), sheet: "Cadastro", row: 4,
  importedAt: "2026-11-05T18:00:00.000Z", cells: [{ column: "B", header: "Matrícula", value: "0007" }],
};

describe("Ficha completa RH", () => {
  it("mostra todos os campos configurados e preserva data civil e origem ao editar", () => {
    const profile: PersonnelEmployeeProfile = { fields: { birthDate: "1990-05-20", registrationNumber: "0007" }, sources: [source] };
    const onChange = vi.fn();
    render(<PersonnelEmployeeProfileEditor profile={profile} onChange={onChange} role="RH" />);
    for (const field of personnelProfileFields) expect(document.getElementById(`employee-profile-${field.key}`)).toBeTruthy();
    const date = document.getElementById("employee-profile-birthDate") as HTMLInputElement;
    expect(date.value).toBe("1990-05-20");
    fireEvent.change(date, { target: { value: "1990-05-21" } });
    expect(onChange).toHaveBeenCalledWith({ fields: { birthDate: "1990-05-21", registrationNumber: "0007" }, sources: [source] });
    expect(screen.getByText("modelo-ficticio.xlsx")).toBeTruthy();
    expect(countPersonnelProfileFields(profile)).toBe(2);
  });

  it("permite limpar uma data e mantém o alerta de conferência visível", () => {
    const onChange = vi.fn();
    render(<PersonnelEmployeeProfileEditor profile={{ fields: { birthDate: "1990-05-20", reviewNotes: "Conferir documento fictício" }, sources: [source] }} onChange={onChange} role="ADM" />);
    fireEvent.change(document.getElementById("employee-profile-birthDate")!, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({ fields: { reviewNotes: "Conferir documento fictício" }, sources: [source] });
    expect(screen.getByRole("status").textContent).toContain("Conferir documento fictício");
  });

  it.each(["SUPERVISOR", "FINANCEIRO"] as const)("não renderiza dados pessoais para %s", role => {
    const { container } = render(<PersonnelEmployeeProfileEditor profile={{ fields: { bankAccountNumber: "valor-ficticio" }, sources: [source] }} onChange={vi.fn()} role={role} />);
    expect(container.innerHTML).toBe("");
  });

  it("busca sem acentos e por CPF sem pontuação, sem depender de dados privados inexistentes", () => {
    const employee = { name: "Funcionário Fictício", cpf: "mat-7", position: null, post: "Posto Modelo", profileData: { fields: { registrationNumber: "0007", documentCpf: "000.000.000-00" } } };
    expect(personnelEmployeeMatchesSearch(employee, "funcionario ficticio")).toBe(true);
    expect(personnelEmployeeMatchesSearch(employee, "00000000000")).toBe(true);
    expect(personnelEmployeeMatchesSearch(employee, "0007")).toBe(true);
    expect(personnelEmployeeMatchesSearch(employee, "não encontrado")).toBe(false);
    expect(personnelEmployeeMatchesSearch({ name: "Pessoa", post: "Modelo" }, "Pessoa")).toBe(true);
  });
});
