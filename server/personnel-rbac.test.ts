import { describe, expect, it } from "vitest";
import { calculateFtPaymentDate, calculateFtPaymentDateForCivilDate, getPersonnelRole, PERSONNEL_ROLES } from "./db";

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

  it("pays first-half FT references on the 20th of the same month", () => {
    expect(calculateFtPaymentDate(new Date(2026, 7, 15, 8))).toEqual(new Date(2026, 7, 20, 12));
  });

  it("pays second-half FT references on the 15th of the next month", () => {
    expect(calculateFtPaymentDate(new Date(2026, 11, 31, 8))).toEqual(new Date(2027, 0, 15, 12));
  });

  it("calculates new civil-date FT payments without timezone conversion", () => {
    expect(calculateFtPaymentDateForCivilDate("2026-01-15").toISOString()).toBe("2026-01-20T12:00:00.000Z");
    expect(calculateFtPaymentDateForCivilDate("2026-01-16").toISOString()).toBe("2026-02-15T12:00:00.000Z");
    expect(calculateFtPaymentDateForCivilDate("2026-12-31").toISOString()).toBe("2027-01-15T12:00:00.000Z");
  });
});
