export type OperationalAccessProfile = {
  role?: string | null;
  personnelRole?: string | null;
} | null | undefined;

export function isAdminOperationalViewer(user: OperationalAccessProfile): boolean {
  return user?.role === "admin";
}

export function canMutateSupervisorOperations(user: OperationalAccessProfile): boolean {
  if (!user || user.role === "admin") return false;
  return (user.personnelRole ?? "SUPERVISOR") === "SUPERVISOR";
}
