export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

export type WeeklySchedulePattern = {
  kind: "WEEKLY";
  minutesByDay: number[];
};

export type CycleSchedulePattern = {
  kind: "CYCLE";
  /** Item zero is the cycle day named by the assignment's anchor date. Zero minutes means off. */
  minutesByDay: number[];
};

export type WorkSchedulePattern = WeeklySchedulePattern | CycleSchedulePattern;

export type ScheduleDefinition = {
  id: number;
  name: string;
  weeklyHours: string | number;
  pattern: WorkSchedulePattern;
};

export type ScheduleAssignment = {
  id?: number;
  startDate: string;
  endDate: string | null;
  cycleAnchorDate: string | null;
  assignedBy?: number | null;
  createdAt?: Date | string;
  schedule: ScheduleDefinition;
};

export type ScheduleDayStatus = "WORKDAY" | "OFF_DAY" | "NO_SCHEDULE";

export type ClassifiedScheduleDay = {
  status: ScheduleDayStatus;
  scheduleName: string | null;
  minutes: number | null;
};

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MINUTE_PER_DAY = 24 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isCivilDate(value: unknown): value is string {
  if (typeof value !== "string" || !CIVIL_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isCivilMonth(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return false;
  const [year, month] = value.split("-").map(Number);
  return year >= 1900 && year <= 9999 && month >= 1 && month <= 12;
}

export function addCivilDays(value: string, amount: number): string {
  if (!isCivilDate(value) || !Number.isInteger(amount)) throw new Error("Data civil inválida");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;
}

export function compareCivilDates(left: string, right: string): number {
  if (!isCivilDate(left) || !isCivilDate(right)) throw new Error("Data civil inválida");
  return left < right ? -1 : left > right ? 1 : 0;
}

export function hasOverlappingScheduleAssignment(
  candidate: { startDate: string; endDate: string | null },
  assignments: Array<Pick<ScheduleAssignment, "id" | "startDate" | "endDate">>,
  excludedAssignmentId?: number,
): boolean {
  if (!isCivilDate(candidate.startDate) || (candidate.endDate !== null && !isCivilDate(candidate.endDate))) {
    throw new Error("Informe datas civis válidas para a vigência");
  }
  if (candidate.endDate && compareCivilDates(candidate.endDate, candidate.startDate) < 0) {
    throw new Error("O fim da vigência não pode anteceder o início");
  }
  return assignments.some((assignment) => assignment.id !== excludedAssignmentId &&
    compareCivilDates(assignment.startDate, candidate.endDate ?? "9999-12-31") <= 0 &&
    (!assignment.endDate || compareCivilDates(assignment.endDate, candidate.startDate) >= 0));
}

export function civilDayDifference(left: string, right: string): number {
  if (!isCivilDate(left) || !isCivilDate(right)) throw new Error("Data civil inválida");
  const [leftYear, leftMonth, leftDay] = left.split("-").map(Number);
  const [rightYear, rightMonth, rightDay] = right.split("-").map(Number);
  return Math.round((Date.UTC(rightYear, rightMonth - 1, rightDay) - Date.UTC(leftYear, leftMonth - 1, leftDay)) / DAY_MS);
}

export function weeklyHoursFromPattern(pattern: WorkSchedulePattern): number {
  const minutes = pattern.minutesByDay.reduce((total, dailyMinutes) => total + dailyMinutes, 0);
  const weeklyMinutes = pattern.kind === "WEEKLY" ? minutes : (minutes * 7) / pattern.minutesByDay.length;
  return Math.round((weeklyMinutes / 60) * 100) / 100;
}

export function validateWorkSchedulePattern(pattern: unknown): string | null {
  if (!pattern || typeof pattern !== "object") return "Informe o padrão da jornada";
  const candidate = pattern as Partial<WorkSchedulePattern>;
  if (candidate.kind !== "WEEKLY" && candidate.kind !== "CYCLE") return "Tipo de padrão inválido";
  if (!Array.isArray(candidate.minutesByDay)) return "Informe as horas de cada dia";
  if (candidate.kind === "WEEKLY" && candidate.minutesByDay.length !== 7) return "A grade semanal deve conter os sete dias";
  if (candidate.kind === "CYCLE" && (candidate.minutesByDay.length < 2 || candidate.minutesByDay.length > 42)) return "O ciclo deve conter entre 2 e 42 dias";
  if (candidate.minutesByDay.some((minutes) => !Number.isInteger(minutes) || minutes < 0 || minutes > MINUTE_PER_DAY)) return "Cada dia deve ter entre 0 e 24 horas, em minutos inteiros";
  if (!candidate.minutesByDay.some((minutes) => minutes > 0)) return "A jornada precisa ter ao menos um dia de trabalho";
  if (candidate.kind === "CYCLE" && !candidate.minutesByDay.some((minutes) => minutes === 0)) return "O ciclo precisa incluir ao menos um dia de folga";
  return null;
}

function weekdayIndex(civilDate: string): number {
  const [year, month, day] = civilDate.split("-").map(Number);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

function isAssignmentEffective(assignment: ScheduleAssignment, civilDate: string): boolean {
  return compareCivilDates(assignment.startDate, civilDate) <= 0 &&
    (!assignment.endDate || compareCivilDates(civilDate, assignment.endDate) <= 0);
}

export function classifyScheduleDay(assignments: ScheduleAssignment[], civilDate: string): ClassifiedScheduleDay {
  if (!isCivilDate(civilDate)) throw new Error("Informe uma data válida no formato AAAA-MM-DD");
  const effective = assignments.filter((assignment) => isAssignmentEffective(assignment, civilDate));
  if (effective.length > 1) throw new Error("Há jornadas vigentes sobrepostas para este funcionário");
  const assignment = effective[0];
  if (!assignment) return { status: "NO_SCHEDULE", scheduleName: null, minutes: null };
  const { pattern } = assignment.schedule;
  const patternError = validateWorkSchedulePattern(pattern);
  if (patternError) throw new Error(patternError);

  let minutes: number;
  if (pattern.kind === "WEEKLY") {
    minutes = pattern.minutesByDay[weekdayIndex(civilDate)];
  } else {
    const anchor = assignment.cycleAnchorDate;
    if (!anchor || !isCivilDate(anchor)) throw new Error("A escala cíclica está sem uma data âncora válida");
    const offset = civilDayDifference(anchor, civilDate);
    const cycleIndex = ((offset % pattern.minutesByDay.length) + pattern.minutesByDay.length) % pattern.minutesByDay.length;
    minutes = pattern.minutesByDay[cycleIndex];
  }

  return {
    status: minutes > 0 ? "WORKDAY" : "OFF_DAY",
    scheduleName: assignment.schedule.name,
    minutes,
  };
}

export function assertFtAllowedForScheduleDay(day: Pick<ClassifiedScheduleDay, "status">) {
  if (day.status === "NO_SCHEDULE") throw new Error("Não há jornada atribuída para este funcionário nesta data. Peça ao RH para atribuir uma jornada vigente.");
  if (day.status === "WORKDAY") throw new Error("A data selecionada é um dia programado de trabalho; Folga Trabalhada só pode ser lançada em dia de folga.");
  return day;
}

export function getFtSettlementPeriod(civilDate: string) {
  if (!isCivilDate(civilDate)) throw new Error("Informe uma data válida no formato AAAA-MM-DD");
  const [yearText, monthText, dayText] = civilDate.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstHalf = day <= 15;
  return {
    key: `${yearText}-${monthText}-${firstHalf ? "01-15" : `16-${lastDay.toString().padStart(2, "0")}`}`,
    label: `${firstHalf ? "01–15" : `16–${lastDay}`} · ${monthText}/${yearText}`,
    startDate: `${yearText}-${monthText}-${firstHalf ? "01" : "16"}`,
    endDate: `${yearText}-${monthText}-${firstHalf ? "15" : lastDay.toString().padStart(2, "0")}`,
    half: firstHalf ? "FIRST_HALF" as const : "SECOND_HALF" as const,
  };
}

export function monthCalendarDays(month: string): string[] {
  if (!isCivilMonth(month)) throw new Error("Informe um mês válido no formato AAAA-MM");
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => `${yearText}-${monthText}-${(index + 1).toString().padStart(2, "0")}`);
}

export function civilDateFromLegacyFt(date: Date | string, civilDate?: string | null): string | null {
  if (civilDate && isCivilDate(civilDate)) return civilDate;
  if (typeof date === "string" && isCivilDate(date)) return date;
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}
