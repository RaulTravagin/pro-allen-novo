export type ReportDateRange = {
  start: Date;
  end: Date;
};

/** Mantém a data exibida pelo input no calendário local, sem conversão UTC. */
export function formatDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Converte o valor de um input date para o meio do dia local. */
export function parseDateInputValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (![year, month, day].every(Number.isInteger)) return new Date(NaN);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** Cria uma janela inclusiva por dias de calendário, preservando a data local. */
export function createRelativeDateRange(calendarDays: number, now = new Date()): ReportDateRange {
  const end = new Date(now);
  const start = new Date(now);
  const days = Math.max(1, Math.floor(calendarDays));
  start.setDate(start.getDate() - (days - 1));
  return { start, end };
}
