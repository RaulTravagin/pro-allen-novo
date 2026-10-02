import type { PersonnelRole } from "./db";

type RecordValue = Record<string, unknown>;

function withoutFields<T extends RecordValue>(value: T, fields: string[]): RecordValue {
  const result: RecordValue = { ...value };
  for (const field of fields) delete result[field];
  return result;
}

function mapRows(value: unknown, project: (row: RecordValue) => RecordValue): unknown {
  return Array.isArray(value)
    ? value.map((row) => (row && typeof row === "object" ? project(row as RecordValue) : row))
    : value;
}

export function projectPersonnelEmployee<T extends RecordValue>(employee: T, role: PersonnelRole) {
  if (role === "RH" || role === "ADM") return { ...employee };
  return withoutFields(employee, role === "SUPERVISOR" ? ["cpf", "pixKey", "postId"] : ["cpf", "pixKey"]);
}

export function projectPersonnelOccurrence<T extends RecordValue>(occurrence: T, role: PersonnelRole) {
  return role === "RH" || role === "ADM"
    ? withoutFields(occurrence, ["documentKey"])
    : withoutFields(occurrence, ["documentKey", "documentUrl", "documentName"]);
}

function projectFinancialRow(row: RecordValue) {
  return withoutFields(row, ["employeePixKey", "pixKey"]);
}

/** Campos de relatório por allowlist: nada de CPF, PIX, identificadores internos ou anexos privados. */
export function projectPersonnelMovementRow(row: RecordValue, role: PersonnelRole) {
  if (role === "FINANCEIRO") {
    return {
      kind: row.kind,
      civilDate: row.civilDate,
      employeeName: row.employeeName,
      status: row.status,
      amount: row.amount,
      ...(row.kind === "FT" ? { paymentDate: row.paymentDate } : {}),
    };
  }
  return {
    kind: row.kind,
    civilDate: row.civilDate,
    employeeName: row.employeeName,
    position: row.position,
    post: row.post,
    status: row.status,
    amount: row.amount,
    ...(row.kind === "FT"
      ? { reason: row.reason }
      : { hoursOrDaily: row.hoursOrDaily, description: row.description }),
  };
}

export function projectPersonnelDashboard<T extends RecordValue>(data: T, role: PersonnelRole) {
  const fts = mapRows(data.fts, projectFinancialRow);
  const extras = mapRows(data.extras, projectFinancialRow);
  const occurrences = role === "FINANCEIRO"
    ? []
    : mapRows(data.occurrences, (row) => projectPersonnelOccurrence(row, role));
  const employees = role === "FINANCEIRO"
    ? []
    : mapRows(data.employees, (row) => projectPersonnelEmployee(row, role));
  const posts = role === "RH" || role === "ADM" ? data.posts : [];

  const summary = data.summary && typeof data.summary === "object"
    ? { ...(data.summary as RecordValue) }
    : {};
  if (role === "FINANCEIRO") {
    const financialRows = [
      ...(Array.isArray(fts) ? fts : []),
      ...(Array.isArray(extras) ? extras : []),
    ] as RecordValue[];
    summary.pendingCount = financialRows.filter((row) => row.status === "PENDING").length;
  }

  return { ...data, employees, posts, fts, extras, occurrences, summary };
}

export function projectGestorPersonnelOverview<T extends RecordValue>(data: T) {
  const source = data.summary && typeof data.summary === "object"
    ? data.summary as RecordValue
    : {};
  return {
    summary: {
      employees: Number(source.employees ?? 0),
      activeEmployees: Number(source.activeEmployees ?? 0),
      users: Number(source.users ?? 0),
      pending: Number(source.pending ?? 0),
      approved: Number(source.approved ?? 0),
      paid: Number(source.paid ?? 0),
    },
  };
}


export function projectGestorPersonnelMovementReport<T extends RecordValue>(report: T) {
  const window = report.window && typeof report.window === "object"
    ? report.window as RecordValue
    : {};
  const rows = Array.isArray(report.rows) ? report.rows : [];
  return {
    window: {
      month: window.month,
      period: window.period,
      startDate: window.startDate,
      endDate: window.endDate,
      label: window.label,
    },
    rows: rows.map((row) => {
      const entry = row && typeof row === "object" ? row as RecordValue : {};
      return { civilDate: entry.civilDate, kind: entry.kind, count: Number(entry.count ?? 0) };
    }),
  };
}
