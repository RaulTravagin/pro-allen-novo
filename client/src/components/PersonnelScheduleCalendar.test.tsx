// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersonnelScheduleCalendar } from "./PersonnelScheduleCalendar";

describe("calendário de jornadas do RH", () => {
  it("mostra dias civis, situação em texto e controles de mês acessíveis", () => {
    const onMonthChange = vi.fn();
    render(
      <PersonnelScheduleCalendar
        month="2026-09"
        onMonthChange={onMonthChange}
        days={[
          { date: "2026-09-01", status: "WORKDAY", minutes: 480 },
          { date: "2026-09-02", status: "OFF_DAY", minutes: 0 },
          { date: "2026-09-03", status: "NO_SCHEDULE", minutes: null },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "setembro de 2026" })).toBeTruthy();
    const monthPicker = screen.getByLabelText("Ir para mês") as HTMLInputElement;
    expect(monthPicker.type).toBe("month");
    expect(monthPicker.value).toBe("2026-09");
    expect(screen.getAllByText("setembro de 2026").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("listitem", { name: /terça-feira, 01\/09\/2026: Trabalho programado, 8 horas/ })).toBeTruthy();
    expect(screen.getByRole("listitem", { name: /quarta-feira, 02\/09\/2026: Folga programada/ })).toBeTruthy();
    expect(screen.getByRole("listitem", { name: /quinta-feira, 03\/09\/2026: Sem jornada atribuída/ })).toBeTruthy();
    expect(screen.getByText("Trabalho programado")).toBeTruthy();
    expect(screen.getByText("Folga programada")).toBeTruthy();
    expect(screen.getByText("Sem jornada atribuída")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Ir para mês"), { target: { value: "2028-12" } });
    expect(onMonthChange).toHaveBeenCalledWith("2028-12");
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(onMonthChange).toHaveBeenCalledWith("2026-08");
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(onMonthChange).toHaveBeenCalledWith("2026-10");
  });
});
