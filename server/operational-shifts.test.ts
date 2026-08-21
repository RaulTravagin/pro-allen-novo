import { describe, expect, it } from "vitest";
import { getCurrentOperationalPeriod, getOperationalPeriodForCalendarDate, getOperationalShift, getOperationalRangeForCalendarDates } from "./operational-shifts";

describe("janelas operacionais de 12 horas", () => {
  it("mantém 05h como parte do plantão noturno iniciado na noite anterior", () => {
    const shift = getOperationalShift(new Date("2026-08-20T08:00:00.000Z"));

    expect(shift.shiftType).toBe("night");
    expect(shift.operationalDate).toBe("2026-08-19");
    expect(shift.shiftStartedAt.toISOString()).toBe("2026-08-19T21:00:00.000Z");
    expect(shift.shiftEndedAt.toISOString()).toBe("2026-08-20T09:00:00.000Z");
  });

  it("inicia o plantão diurno exatamente às 06h de São Paulo", () => {
    const shift = getOperationalShift(new Date("2026-08-20T09:00:00.000Z"));

    expect(shift.shiftType).toBe("day");
    expect(shift.operationalDate).toBe("2026-08-20");
    expect(shift.shiftStartedAt.toISOString()).toBe("2026-08-20T09:00:00.000Z");
  });

  it("cria um período diário que inclui o turno noturno até 06h do dia seguinte", () => {
    const period = getOperationalPeriodForCalendarDate(new Date("2026-08-20T12:00:00.000Z"));
    const range = getOperationalRangeForCalendarDates(new Date("2026-08-20T12:00:00.000Z"), new Date("2026-08-20T12:00:00.000Z"));

    expect(period.start.toISOString()).toBe("2026-08-20T09:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-08-21T09:00:00.000Z");
    expect(range).toEqual({ start: period.start, end: period.end });
  });

  it("informa a janela noturna vigente sem cortar a atividade após a meia-noite", () => {
    const period = getCurrentOperationalPeriod(new Date("2026-08-20T07:30:00.000Z"));

    expect(period.shiftType).toBe("night");
    expect(period.start.toISOString()).toBe("2026-08-19T21:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-08-20T09:00:00.000Z");
  });
});
