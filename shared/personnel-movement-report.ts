import { isCivilDate, isCivilMonth } from "./personnel-schedules";

export type MovementPeriod = "ALL" | "FIRST_HALF" | "SECOND_HALF";
export type MovementKind = "FT" | "EXTRA";
export type MovementStatus = "PENDING" | "APPROVED" | "PAID" | "REJECTED";

export type PersonnelMovementRow = {
  kind: MovementKind;
  civilDate: string;
  status: MovementStatus;
  amount?: string | number | null;
  paymentDate?: Date | string | null;
  employeeName?: string;
  position?: string | null;
  post?: string | null;
  hoursOrDaily?: string | number | null;
  reason?: string | null;
  description?: string | null;
};

export type GestorMovementRow = {
  civilDate: string;
  kind: MovementKind;
  count: number;
};

export function getPersonnelMovementWindow(month: string, period: MovementPeriod) {
  if (!isCivilMonth(month)) throw new Error("Informe um mês válido no formato AAAA-MM");
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const startDay = period === "SECOND_HALF" ? 16 : 1;
  const endDay = period === "FIRST_HALF" ? 15 : lastDay;
  const startDate = `${yearText}-${monthText}-${String(startDay).padStart(2, "0")}`;
  const endDate = `${yearText}-${monthText}-${String(endDay).padStart(2, "0")}`;
  const label = period === "FIRST_HALF"
    ? `01–15 · ${monthText}/${yearText}`
    : period === "SECOND_HALF"
      ? `16–${lastDay} · ${monthText}/${yearText}`
      : `01–${lastDay} · ${monthText}/${yearText}`;
  return { month, period, startDate, endDate, label } as const;
}

/** Converts instants to Brazilian civil dates; plain YYYY-MM-DD values remain civil and are never UTC-shifted. */
export function brazilCivilDate(value: Date | string): string | null {
  if (typeof value === "string" && isCivilDate(value)) return value;
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const civilDate = `${part("year")}-${part("month")}-${part("day")}`;
  return isCivilDate(civilDate) ? civilDate : null;
}

export function isCivilDateInWindow(civilDate: string, startDate: string, endDate: string) {
  return isCivilDate(civilDate) && isCivilDate(startDate) && isCivilDate(endDate) &&
    civilDate >= startDate && civilDate <= endDate;
}

export function summarizePersonnelMovements(rows: PersonnelMovementRow[]) {
  const byKind = { FT: { count: 0, amount: 0 }, EXTRA: { count: 0, amount: 0 } };
  const byStatus: Record<MovementStatus, { count: number; amount: number }> = {
    PENDING: { count: 0, amount: 0 },
    APPROVED: { count: 0, amount: 0 },
    PAID: { count: 0, amount: 0 },
    REJECTED: { count: 0, amount: 0 },
  };
  let totalAmountCents = 0;
  for (const row of rows) {
    const amount = Number(row.amount ?? 0);
    const amountCents = Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) : 0;
    byKind[row.kind].count += 1;
    byKind[row.kind].amount = (Math.round(byKind[row.kind].amount * 100) + amountCents) / 100;
    byStatus[row.status].count += 1;
    byStatus[row.status].amount = (Math.round(byStatus[row.status].amount * 100) + amountCents) / 100;
    totalAmountCents += amountCents;
  }
  return { totalRecords: rows.length, totalAmount: totalAmountCents / 100, byKind, byStatus };
}

export function summarizeGestorMovements(rows: GestorMovementRow[]) {
  return rows.reduce((summary, row) => {
    summary.totalRecords += row.count;
    summary.byKind[row.kind] += row.count;
    return summary;
  }, { totalRecords: 0, byKind: { FT: 0, EXTRA: 0 } });
}
