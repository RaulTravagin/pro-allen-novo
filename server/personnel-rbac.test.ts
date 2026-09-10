import { describe, expect, it } from "vitest";
import { getPersonnelRole, PERSONNEL_ROLES } from "./db";

describe("personnel RBAC", () => {
  it("maps the existing admin account to the global personnel role", () => {
    expect(getPersonnelRole({ role: "admin", personnelRole: null })).toBe(
      "ADM"
    );
  });

  it("maps local operational users to Supervisor by default", () => {
    expect(getPersonnelRole({ role: "user", personnelRole: null })).toBe(
      "SUPERVISOR"
    );
  });

  it("preserves explicit RH and Financeiro profiles", () => {
    expect(getPersonnelRole({ role: "user", personnelRole: "RH" })).toBe("RH");
    expect(
      getPersonnelRole({ role: "user", personnelRole: "FINANCEIRO" })
    ).toBe("FINANCEIRO");
  });

  it("exposes all four supported profiles", () => {
    expect(PERSONNEL_ROLES).toEqual(["SUPERVISOR", "RH", "FINANCEIRO", "ADM"]);
  });
});
