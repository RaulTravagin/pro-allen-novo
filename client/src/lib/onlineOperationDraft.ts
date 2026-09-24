export type RouteDraft = {
  kmInitial: string;
  kmFinal: string;
  selectedVehicleId: string;
  coveragePostId: string;
  coverageReason: string;
  fuelOdometer: string;
  fuelAmount: string;
  fuelLiters: string;
  fuelType: "gasoline" | "ethanol" | "diesel";
  updatedAt: string;
};

export type OccurrenceDraft = {
  occurrenceReport: string;
  updatedAt: string;
};

const PREFIX = "pro-allen:online-turn-draft:v1";

function key(kind: "route" | "occurrence", supervisorId: number, recordId: number) {
  return `${PREFIX}:${kind}:${supervisorId}:${recordId}`;
}

function read<T>(storageKey: string): T | null {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function write<T>(storageKey: string, value: T) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // O banco continua sendo a fonte de verdade; falha local não bloqueia a operação.
  }
}

export function readRouteDraft(supervisorId: number, routeId: number) {
  return read<RouteDraft>(key("route", supervisorId, routeId));
}

export function saveRouteDraft(supervisorId: number, routeId: number, draft: Omit<RouteDraft, "updatedAt">) {
  const value = { ...draft, updatedAt: new Date().toISOString() };
  write(key("route", supervisorId, routeId), value);
  return value;
}

export function clearRouteDraft(supervisorId: number, routeId: number) {
  try { localStorage.removeItem(key("route", supervisorId, routeId)); } catch {}
}

export function readOccurrenceDraft(supervisorId: number, visitId: number) {
  return read<OccurrenceDraft>(key("occurrence", supervisorId, visitId));
}

export function saveOccurrenceDraft(supervisorId: number, visitId: number, draft: Omit<OccurrenceDraft, "updatedAt">) {
  const value = { ...draft, updatedAt: new Date().toISOString() };
  write(key("occurrence", supervisorId, visitId), value);
  return value;
}

export function clearOccurrenceDraft(supervisorId: number, visitId: number) {
  try { localStorage.removeItem(key("occurrence", supervisorId, visitId)); } catch {}
}
