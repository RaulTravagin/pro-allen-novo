import { describe, expect, it } from "vitest";
import { monthCalendarDays } from "@shared/personnel-schedules";
import {
  buildCivilCalendarGrid,
  civilWeekdayLabel,
  civilDateAsLocalDate,
  formatCivilDate,
  formatCivilMonthLabel,
  localCivilToday,
  shiftCivilMonth,
} from "./personnelCivilCalendar";

describe("calendário civil de RH", () => {
  it("formata datas civis brasileiras sem convertê-las em instantes UTC", () => {
    expect(formatCivilDate("2026-09-29")).toBe("29/09/2026");
    expect(formatCivilDate("2024-02-29")).toBe("29/02/2024");
    expect(formatCivilDate("2026-02-29")).toBe("—");
    expect(localCivilToday(new Date(2026, 8, 29, 0, 5))).toBe("2026-09-29");
    const exported = civilDateAsLocalDate("2028-12-31");
    expect([exported.getFullYear(), exported.getMonth() + 1, exported.getDate()]).toEqual([2028, 12, 31]);
  });

  it("apresenta o dia da semana pela data civil, inclusive após a virada do mês e do ano", () => {
    expect(civilWeekdayLabel("2026-09-30")).toBe("quarta-feira");
    expect(civilWeekdayLabel("2026-10-01")).toBe("quinta-feira");
    expect(civilWeekdayLabel("2027-01-01")).toBe("sexta-feira");
  });

  it.each([
    ["2026-02", 28],
    ["2024-02", 29],
    ["2026-04", 30],
    ["2026-09", 30],
    ["2026-01", 31],
  ])("%s contém %i dias civis", (month, length) => {
    expect(monthCalendarDays(month)).toHaveLength(length);
    expect(monthCalendarDays(month)[0]).toBe(`${month}-01`);
    expect(monthCalendarDays(month).at(-1)).toBe(`${month}-${String(length).padStart(2, "0")}`);
  });

  it("navega meses e anos sem deslocar a data", () => {
    expect(shiftCivilMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftCivilMonth("2027-01", -1)).toBe("2026-12");
    expect(shiftCivilMonth("2024-02", -1)).toBe("2024-01");
    expect(formatCivilMonthLabel("2026-09")).toBe("setembro de 2026");
  });

  it("alinha a semana de segunda a domingo e completa a última linha", () => {
    const monthDays = monthCalendarDays("2026-09").map((date) => ({
      date,
      status: "OFF_DAY" as const,
      minutes: 0,
    }));
    const cells = buildCivilCalendarGrid(monthDays);
    expect(cells).toHaveLength(35);
    expect(cells.slice(0, 1)).toEqual([null]);
    expect(cells[1]?.date).toBe("2026-09-01");
    expect(cells[30]?.date).toBe("2026-09-30");
    expect(cells.slice(-4)).toEqual([null, null, null, null]);
  });
});
