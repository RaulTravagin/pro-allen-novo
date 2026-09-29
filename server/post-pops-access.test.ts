import { describe, expect, it } from "vitest";
import {
  canManagePostPops,
  canSupervisorViewPostPops,
  isAllowedPostPopFile,
} from "./post-pops-access";

describe("permissões dos POPs por posto", () => {
  it("permite administração a ADM e Gestor, mas não a RH, Financeiro ou Supervisor", () => {
    expect(canManagePostPops("ADM", false)).toBe(true);
    expect(canManagePostPops("SUPERVISOR", true)).toBe(true);
    expect(canManagePostPops("SUPERVISOR", false)).toBe(false);
    expect(canManagePostPops("RH", false)).toBe(false);
    expect(canManagePostPops("FINANCEIRO", false)).toBe(false);
    expect(canManagePostPops(null, false)).toBe(false);
  });

  it("requer identidade de supervisor e igualdade entre a rota atribuída e a rota do posto", () => {
    const linked = {
      role: "SUPERVISOR" as const,
      supervisorId: 21,
      assignedRouteId: 4,
      postRouteId: 4,
    };
    expect(canSupervisorViewPostPops(linked)).toBe(true);
    expect(canSupervisorViewPostPops({ ...linked, assignedRouteId: 5 })).toBe(
      false
    );
    expect(canSupervisorViewPostPops({ ...linked, role: "RH" })).toBe(false);
    expect(canSupervisorViewPostPops({ ...linked, supervisorId: null })).toBe(
      false
    );
    expect(
      canSupervisorViewPostPops({ ...linked, assignedRouteId: null })
    ).toBe(false);
  });

  it("aceita apenas extensões e MIME types documentais suportados", () => {
    expect(isAllowedPostPopFile("application/pdf", "rotina.pdf")).toBe(true);
    expect(isAllowedPostPopFile("application/msword", "rotina.doc")).toBe(true);
    expect(
      isAllowedPostPopFile(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "rotina.docx"
      )
    ).toBe(true);
    expect(
      isAllowedPostPopFile("application/octet-stream", "rotina.docx")
    ).toBe(true);
    expect(isAllowedPostPopFile("application/vnd.ms-word", "rotina.doc")).toBe(
      true
    );
    expect(isAllowedPostPopFile("text/html", "rotina.html")).toBe(false);
    expect(isAllowedPostPopFile("application/pdf", "rotina.docx")).toBe(false);
    expect(isAllowedPostPopFile("image/svg+xml", "rotina.svg")).toBe(false);
  });
});
