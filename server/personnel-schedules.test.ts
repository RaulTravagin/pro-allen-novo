import { describe, expect, it } from "vitest";
import {
  addCivilDays,
  assertFtAllowedForScheduleDay,
  classifyScheduleDay,
  getFtSettlementPeriod,
  isCivilDate,
  monthCalendarDays,
  validateWorkSchedulePattern,
  weeklyHoursFromPattern,
  type ScheduleAssignment,
  type WorkSchedulePattern,
} from "../shared/personnel-schedules";

function assignment(
  pattern: WorkSchedulePattern,
  options: Partial<Pick<ScheduleAssignment, "startDate" | "endDate" | "cycleAnchorDate" | "schedule">> = {},
): ScheduleAssignment {
  return {
    startDate: options.startDate ?? "2026-09-01",
    endDate: options.endDate ?? null,
    cycleAnchorDate: options.cycleAnchorDate ?? (pattern.kind === "CYCLE" ? "2026-09-01" : null),
    schedule: options.schedule ?? { id: 1, name: "Fixture sintética", weeklyHours: weeklyHoursFromPattern(pattern), pattern },
  };
}

describe("regras civis de jornadas e Folgas Trabalhadas", () => {
  it("ancora o 12x36 em um dia de trabalho e alterna trabalho/folga sem depender de timezone", () => {
    const pattern: WorkSchedulePattern = { kind: "CYCLE", minutesByDay: [720, 0] };
    const shift = assignment(pattern, { startDate: "2026-08-31", cycleAnchorDate: "2026-08-31" });

    expect(weeklyHoursFromPattern(pattern)).toBe(42);
    expect(classifyScheduleDay([shift], "2026-08-31")).toMatchObject({ status: "WORKDAY", minutes: 720 });
    expect(classifyScheduleDay([shift], "2026-09-01")).toMatchObject({ status: "OFF_DAY", minutes: 0 });
    expect(classifyScheduleDay([shift], "2026-09-02")).toMatchObject({ status: "WORKDAY", minutes: 720 });
    expect(classifyScheduleDay([shift], "2026-09-03")).toMatchObject({ status: "OFF_DAY", minutes: 0 });
    expect(addCivilDays("2026-09-30", 1)).toBe("2026-10-01");
  });

  it("calcula uma grade semanal configurável de 44 horas e classifica cada dia", () => {
    const pattern: WorkSchedulePattern = { kind: "WEEKLY", minutesByDay: [480, 480, 480, 480, 480, 240, 0] };
    const week = assignment(pattern);

    expect(validateWorkSchedulePattern(pattern)).toBeNull();
    expect(weeklyHoursFromPattern(pattern)).toBe(44);
    expect(classifyScheduleDay([week], "2026-09-07")).toMatchObject({ status: "WORKDAY", minutes: 480 });
    expect(classifyScheduleDay([week], "2026-09-12")).toMatchObject({ status: "WORKDAY", minutes: 240 });
    expect(classifyScheduleDay([week], "2026-09-13")).toMatchObject({ status: "OFF_DAY", minutes: 0 });
  });

  it("permite ciclo personalizado com duração e horas por dia diferentes", () => {
    const pattern: WorkSchedulePattern = { kind: "CYCLE", minutesByDay: [480, 480, 0, 0] };
    const custom = assignment(pattern);

    expect(validateWorkSchedulePattern(pattern)).toBeNull();
    expect(classifyScheduleDay([custom], "2026-09-01").status).toBe("WORKDAY");
    expect(classifyScheduleDay([custom], "2026-09-02").status).toBe("WORKDAY");
    expect(classifyScheduleDay([custom], "2026-09-03").status).toBe("OFF_DAY");
    expect(classifyScheduleDay([custom], "2026-09-05").status).toBe("WORKDAY");
  });

  it("respeita início/fim inclusivos de atribuições e lacunas sem jornada", () => {
    const prior = assignment({ kind: "CYCLE", minutesByDay: [480, 0] }, {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      cycleAnchorDate: "2026-01-01",
      schedule: { id: 1, name: "Anterior", weeklyHours: 28, pattern: { kind: "CYCLE", minutesByDay: [480, 0] } },
    });
    const next = assignment({ kind: "CYCLE", minutesByDay: [0, 480] }, {
      startDate: "2026-02-01",
      cycleAnchorDate: "2026-02-01",
      schedule: { id: 2, name: "Nova", weeklyHours: 28, pattern: { kind: "CYCLE", minutesByDay: [0, 480] } },
    });

    expect(classifyScheduleDay([prior, next], "2025-12-31").status).toBe("NO_SCHEDULE");
    expect(classifyScheduleDay([prior, next], "2026-01-31").status).toBe("WORKDAY");
    expect(classifyScheduleDay([prior, next], "2026-02-01").status).toBe("OFF_DAY");
    expect(classifyScheduleDay([prior, next], "2026-02-02").status).toBe("WORKDAY");
  });

  it("aceita FT em folga e rejeita trabalho programado ou ausência de escala com mensagem útil", () => {
    const cycle = assignment({ kind: "CYCLE", minutesByDay: [720, 0] });
    const offDay = classifyScheduleDay([cycle], "2026-09-02");
    const workDay = classifyScheduleDay([cycle], "2026-09-01");
    const noSchedule = classifyScheduleDay([], "2026-09-01");

    expect(assertFtAllowedForScheduleDay(offDay).status).toBe("OFF_DAY");
    expect(() => assertFtAllowedForScheduleDay(workDay)).toThrow(/dia programado de trabalho/);
    expect(() => assertFtAllowedForScheduleDay(noSchedule)).toThrow(/Peça ao RH para atribuir/);
  });

  it.each([
    ["2026-01-01", "01–15 · 01/2026", "2026-01-01", "2026-01-15"],
    ["2026-01-15", "01–15 · 01/2026", "2026-01-01", "2026-01-15"],
    ["2026-01-16", "16–31 · 01/2026", "2026-01-16", "2026-01-31"],
    ["2026-01-31", "16–31 · 01/2026", "2026-01-16", "2026-01-31"],
    ["2024-02-29", "16–29 · 02/2024", "2024-02-16", "2024-02-29"],
    ["2026-12-31", "16–31 · 12/2026", "2026-12-16", "2026-12-31"],
    ["2027-01-01", "01–15 · 01/2027", "2027-01-01", "2027-01-15"],
  ])("agrupa a data %s na janela civil correta", (date, label, startDate, endDate) => {
    expect(getFtSettlementPeriod(date)).toMatchObject({ label, startDate, endDate });
  });

  it("gera todos os dias civis do mês, incluindo 29 de fevereiro, sem deslocamento de fuso", () => {
    expect(isCivilDate("2024-02-29")).toBe(true);
    expect(isCivilDate("2026-02-29")).toBe(false);
    expect(monthCalendarDays("2024-02")).toHaveLength(29);
    expect(monthCalendarDays("2024-02").at(-1)).toBe("2024-02-29");
  });
});
