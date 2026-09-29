export type PostPopRole = "SUPERVISOR" | "RH" | "FINANCEIRO" | "ADM" | null;

export function canManagePostPops(role: PostPopRole, hasGestorSession: boolean) {
  return role === "ADM" || hasGestorSession;
}

export function canSupervisorViewPostPops(input: {
  role: PostPopRole;
  supervisorId: number | null | undefined;
  assignedRouteId: number | null | undefined;
  postRouteId: number | null | undefined;
}) {
  return input.role === "SUPERVISOR"
    && Number.isSafeInteger(input.supervisorId)
    && Number(input.supervisorId) > 0
    && Number.isSafeInteger(input.assignedRouteId)
    && Number(input.assignedRouteId) > 0
    && input.assignedRouteId === input.postRouteId;
}

export function isAllowedPostPopFile(mimeType: string, fileName: string) {
  const extension = fileName.toLowerCase().split(".").pop();
  return (mimeType === "application/pdf" && extension === "pdf")
    || (mimeType === "application/msword" && extension === "doc")
    || (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && extension === "docx");
}
