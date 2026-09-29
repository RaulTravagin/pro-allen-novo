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

export function projectPersonnelDashboard<T extends RecordValue>(data: T, role: PersonnelRole) {
  const fts = mapRows(data.fts, projectFinancialRow);
  const extras = mapRows(data.extras, projectFinancialRow);
  const occurrences = role === "FINANCEIRO"
    ? []
    : mapRows(data.occurrences, (row) => projectPersonnelOccurrence(row, role));
  const employees = role === "FINANCEIRO"
    ? []
    : mapRows(data.employees, (row) => projectPersonnelEmployee(row, role));

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

  return { ...data, employees, fts, extras, occurrences, summary };
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
