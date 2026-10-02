import { describe, expect, it } from "vitest";
import { canMutateSupervisorOperations, isAdminOperationalViewer } from "./supervisor-access";

describe("permissões de operação na interface", () => {
  it("mantém as ações para Supervisor e usuário operacional sem perfil explícito", () => {
    expect(canMutateSupervisorOperations({ role: "user", personnelRole: "SUPERVISOR" })).toBe(true);
    expect(canMutateSupervisorOperations({ role: "user" })).toBe(true);
  });

  it.each([
    [{ role: "admin", personnelRole: "SUPERVISOR" }, true],
    [{ role: "user", personnelRole: "ADM" }, false],
  ])("aplica a política de monitor Admin sem conceder escrita: %s", (profile, expected) => {
    expect(isAdminOperationalViewer(profile)).toBe(expected);
    expect(canMutateSupervisorOperations(profile)).toBe(false);
  });

  it.each([
    { role: "user", personnelRole: "RH" },
    { role: "user", personnelRole: "FINANCEIRO" },
    { role: "user", personnelRole: "GESTOR" },
    null,
    undefined,
  ])("não expõe mutations a perfis sem autorização (%s)", (profile) => {
    expect(canMutateSupervisorOperations(profile)).toBe(false);
  });
});
