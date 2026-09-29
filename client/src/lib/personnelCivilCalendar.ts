import { isCivilDate, isCivilMonth } from "@shared/personnel-schedules";

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

const WEEKDAY_NAMES = [
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
  "domingo",
] as const;

export type CivilCalendarDay = {
  date: string;
  status: "WORKDAY" | "OFF_DAY" | "NO_SCHEDULE";
  minutes: number | null;
};

/** Produces a YYYY-MM-DD value from local calendar fields without a UTC round-trip. */
export function localCivilToday(now = new Date()): string {
  return `${now.getFullYear().toString().padStart(4, "0")}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
}

/** Formats an ISO civil date as Brazilian dd/MM/yyyy without parsing it as an instant. */
export function formatCivilDate(value: string | null | undefined): string {
  if (!value || !isCivilDate(value)) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

/** Converts civil fields to a local-noon Date for spreadsheet serializers without parsing an ISO instant. */
export function civilDateAsLocalDate(value: string): Date {
  if (!isCivilDate(value)) throw new Error("Data civil inválida");
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function formatCivilMonthLabel(value: string): string {
  if (!isCivilMonth(value)) return "Mês inválido";
  const [year, month] = value.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} de ${year}`;
}

export function civilWeekdayLabel(value: string): string {
  if (!isCivilDate(value)) return "";
  const [year, month, day] = value.split("-").map(Number);
  const mondayFirstIndex = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return WEEKDAY_NAMES[mondayFirstIndex];
}

/** Moves by calendar months, clamping only the month itself (dates are month-only values). */
export function shiftCivilMonth(value: string, amount: number): string {
  if (!isCivilMonth(value) || !Number.isInteger(amount)) throw new Error("Mês civil inválido");
  const [year, month] = value.split("-").map(Number);
  const absoluteMonth = year * 12 + month - 1 + amount;
  const nextYear = Math.floor(absoluteMonth / 12);
  const nextMonth = ((absoluteMonth % 12) + 12) % 12 + 1;
  if (nextYear < 1900 || nextYear > 9999) throw new Error("Mês fora do intervalo permitido");
  return `${nextYear.toString().padStart(4, "0")}-${nextMonth.toString().padStart(2, "0")}`;
}

/** Builds a Monday-first grid, padded to whole weeks, using the API's civil-date values. */
export function buildCivilCalendarGrid(days: CivilCalendarDay[]): Array<CivilCalendarDay | null> {
  if (days.length === 0) return [];
  const first = days[0].date;
  if (!isCivilDate(first)) return [];
  const [year, month, day] = first.split("-").map(Number);
  const leadingCells = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  const cells: Array<CivilCalendarDay | null> = [...Array(leadingCells).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
