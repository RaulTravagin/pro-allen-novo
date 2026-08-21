export type OperationShift = "day" | "night";

const OPERATION_TIME_ZONE = "America/Sao_Paulo";

type LocalParts = { year: number; month: number; day: number; hour: number };

function getLocalParts(date: Date): LocalParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: OPERATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour) };
}

function localDateKey(parts: Pick<LocalParts, "year" | "month" | "day">) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function addLocalDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, "0")}-${String(result.getUTCDate()).padStart(2, "0")}`;
}

function atLocalHour(dateKey: string, hour: 6 | 18) {
  // São Paulo não adota horário de verão desde 2019; o offset fixo garante UTC correto no PostgreSQL.
  return new Date(`${dateKey}T${String(hour).padStart(2, "0")}:00:00-03:00`);
}

export function getOperationalShift(date: Date) {
  const local = getLocalParts(date);
  const calendarDate = localDateKey(local);
  const shiftType: OperationShift = local.hour >= 6 && local.hour < 18 ? "day" : "night";
  const operationalDate = shiftType === "night" && local.hour < 6 ? addLocalDays(calendarDate, -1) : calendarDate;
  const shiftStartedAt = atLocalHour(operationalDate, shiftType === "day" ? 6 : 18);
  const shiftEndedAt = new Date(shiftStartedAt.getTime() + 12 * 60 * 60 * 1000);
  return { shiftType, operationalDate, shiftStartedAt, shiftEndedAt };
}

/** Retorna o período operacional completo de uma data: 06h daquela data até 06h do dia seguinte. */
export function getOperationalPeriodForCalendarDate(date: Date) {
  const calendarDate = localDateKey(getLocalParts(date));
  return { start: atLocalHour(calendarDate, 6), end: atLocalHour(addLocalDays(calendarDate, 1), 6), operationalDate: calendarDate };
}

/** Retorna o período de 12h vigente, inclusive quando o relógio está entre 00h e 06h. */
export function getCurrentOperationalPeriod(now = new Date()) {
  const shift = getOperationalShift(now);
  return { start: shift.shiftStartedAt, end: shift.shiftEndedAt, shiftType: shift.shiftType, operationalDate: shift.operationalDate };
}

/** Intervalo de relatórios que inclui o plantão noturno iniciado no último dia selecionado. */
export function getOperationalRangeForCalendarDates(startDate: Date, endDate: Date) {
  const start = getOperationalPeriodForCalendarDate(startDate).start;
  const end = getOperationalPeriodForCalendarDate(endDate).end;
  return { start, end };
}
