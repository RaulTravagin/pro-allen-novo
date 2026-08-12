import { describe, expect, it } from "vitest";
import { getGestorRouteMode } from "./gestor-routing";

describe("getGestorRouteMode", () => {
  it("mantém a tela de senha isolada do painel protegido", () => {
    expect(getGestorRouteMode("/gestor/acesso")).toBe("login");
    expect(getGestorRouteMode("/gestor")).toBe("dashboard");
    expect(getGestorRouteMode("/gestor/acesso/extra")).toBeNull();
  });
});
