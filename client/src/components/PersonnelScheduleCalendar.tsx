import React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildCivilCalendarGrid,
  civilWeekdayLabel,
  formatCivilDate,
  formatCivilMonthLabel,
  localCivilToday,
  shiftCivilMonth,
  type CivilCalendarDay,
} from "@/lib/personnelCivilCalendar";

type PersonnelScheduleCalendarProps = {
  month: string;
  days: CivilCalendarDay[];
  onMonthChange: (month: string) => void;
};

const WEEKDAYS = [
  ["Seg", "Segunda-feira"],
  ["Ter", "Terça-feira"],
  ["Qua", "Quarta-feira"],
  ["Qui", "Quinta-feira"],
  ["Sex", "Sexta-feira"],
  ["Sáb", "Sábado"],
  ["Dom", "Domingo"],
] as const;

function dayPresentation(day: CivilCalendarDay) {
  if (day.status === "WORKDAY") {
    const hours = Number(((day.minutes ?? 0) / 60).toFixed(2)).toLocaleString("pt-BR");
    return {
      label: `Trabalho · ${hours} h`,
      accessibleLabel: `Trabalho programado, ${hours} horas`,
      className: "border-blue-200 bg-blue-50 text-blue-950",
      detailClassName: "text-blue-800",
    };
  }
  if (day.status === "OFF_DAY") {
    return {
      label: "Folga",
      accessibleLabel: "Folga programada",
      className: "border-emerald-200 bg-emerald-50 text-emerald-950",
      detailClassName: "text-emerald-800",
    };
  }
  return {
    label: "Sem escala",
    accessibleLabel: "Sem jornada atribuída",
    className: "border-slate-200 bg-slate-50 text-slate-700",
    detailClassName: "text-slate-600",
  };
}

export function PersonnelScheduleCalendar({ month, days, onMonthChange }: PersonnelScheduleCalendarProps) {
  const cells = buildCivilCalendarGrid(days);
  const today = localCivilToday();
  const monthLabel = formatCivilMonthLabel(month);

  return (
    <section aria-labelledby="personnel-schedule-calendar-title" className="space-y-4">
      <div className="space-y-2">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <Button type="button" variant="outline" size="icon" aria-label="Mês anterior" onClick={() => onMonthChangeBy(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 text-center sm:text-left">
            <h3 id="personnel-schedule-calendar-title" className="truncate text-base font-bold text-slate-950">{monthLabel}</h3>
            <p className="text-xs text-slate-500">Datas do calendário civil · dd/MM/aaaa</p>
          </div>
          <Button type="button" variant="outline" size="icon" aria-label="Próximo mês" onClick={() => onMonthChangeBy(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:justify-end">
          <Label htmlFor="personnel-calendar-month" className="sr-only">Ir para mês</Label>
          <div className="relative h-9 min-w-0 rounded-md focus-within:ring-[3px] focus-within:ring-ring/50 sm:w-44">
            <span aria-hidden="true" className="pointer-events-none flex h-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm shadow-xs">
              <span className="truncate">{monthLabel}</span>
              <CalendarDays className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
            </span>
            <Input id="personnel-calendar-month" type="month" lang="pt-BR" value={month} aria-describedby="personnel-schedule-calendar-title" onChange={(event) => event.target.value && onMonthChange(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer rounded-md opacity-0 focus-visible:outline-none" />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => onMonthChange(today.slice(0, 7))}>Mês atual</Button>
        </div>
      </div>

      <div role="list" className="grid grid-cols-7 gap-1 sm:gap-2" aria-label={`Dias de ${monthLabel}`}>
        {WEEKDAYS.map(([short, full]) => (
          <div key={short} aria-label={full} className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:text-xs">{short}</div>
        ))}
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} aria-hidden="true" className="min-h-[4.4rem] sm:min-h-24" />;
          const appearance = dayPresentation(day);
          const number = Number(day.date.slice(-2));
          const isToday = day.date === today;
          return (
            <div
              key={day.date}
              role="listitem"
              aria-label={`${civilWeekdayLabel(day.date)}, ${formatCivilDate(day.date)}: ${appearance.accessibleLabel}`}
              aria-current={isToday ? "date" : undefined}
              className={`min-h-[4.4rem] rounded-lg border p-1.5 sm:min-h-24 sm:p-2 ${appearance.className} ${isToday ? "ring-2 ring-[#f6c915] ring-offset-1" : ""}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold sm:text-sm">{number}</span>
                {isToday && <span className="hidden text-[9px] font-bold uppercase sm:inline sm:text-[10px]">Hoje</span>}
              </div>
              <p className={`mt-2 text-[9px] font-semibold leading-3 sm:mt-3 sm:text-xs sm:leading-4 ${appearance.detailClassName}`}>{appearance.label}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-700" aria-label="Legenda do calendário">
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-sm border border-blue-300 bg-blue-100" />Trabalho programado</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-sm border border-emerald-300 bg-emerald-100" />Folga programada</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-sm border border-slate-300 bg-slate-100" />Sem jornada atribuída</span>
        <span className="inline-flex items-center gap-2"><span className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 font-bold text-violet-800">FT</span>Folga trabalhada é um lançamento separado; não é marcada aqui</span>
      </div>
    </section>
  );

  function onMonthChangeBy(amount: number) {
    onMonthChange(shiftCivilMonth(month, amount));
  }
}
