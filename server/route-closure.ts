export type RouteClosureChecklist = {
  id: number;
  postId: number;
  postName: string | null;
  status: "pending" | "in_progress" | "visited" | "skipped";
  isCoverage: boolean;
  arrivalTime?: Date | string | null;
  departureTime?: Date | string | null;
  occurrenceReport?: string | null;
  occurrenceSubmittedAt?: Date | string | null;
};

export type RouteClosurePost = { id: number; name: string };

export type RouteClosurePendingSummary = {
  routeStatus: "in_progress";
  totalPlannedPosts: number;
  pendingPosts: Array<{ postId: number; postName: string; status: string }>;
  pendingVisits: Array<{ checklistId: number; postId: number; postName: string; status: "pending" | "skipped"; isCoverage: boolean }>;
  activeVisits: Array<{ checklistId: number; postId: number; postName: string; arrivalTime: Date | string | null; isCoverage: boolean }>;
  unsentReports: Array<{ checklistId: number; postId: number; postName: string; status: string; isCoverage: boolean }>;
  counts: { pendingPosts: number; pendingVisits: number; activeVisits: number; unsentReports: number };
};

/** Constrói um snapshot serializável das pendências no instante da tentativa de fechamento. */
export function summarizeRouteClosure(input: {
  posts: RouteClosurePost[];
  checklists: RouteClosureChecklist[];
}): RouteClosurePendingSummary {
  const latestByPost = new Map<number, RouteClosureChecklist>();
  const latestByVisitType = new Map<string, RouteClosureChecklist>();
  for (const checklist of [...input.checklists].sort((a, b) => a.id - b.id)) {
    const visitTypeKey = `${checklist.postId}:${checklist.isCoverage ? "coverage" : "planned"}`;
    latestByVisitType.set(visitTypeKey, checklist);
    if (!checklist.isCoverage) latestByPost.set(checklist.postId, checklist);
  }

  const pendingPosts = input.posts.flatMap((post) => {
    const latest = latestByPost.get(post.id);
    return !latest || latest.status !== "visited"
      ? [{ postId: post.id, postName: post.name, status: latest?.status ?? "not_started" }]
      : [];
  });
  const currentVisits = Array.from(latestByVisitType.values());
  const pendingVisits = currentVisits.flatMap((checklist) => checklist.status === "pending" || checklist.status === "skipped"
    ? [{ checklistId: checklist.id, postId: checklist.postId, postName: checklist.postName ?? "Posto removido", status: checklist.status, isCoverage: checklist.isCoverage }]
    : []);
  const activeVisits = currentVisits.flatMap((checklist) => checklist.status === "in_progress"
    ? [{ checklistId: checklist.id, postId: checklist.postId, postName: checklist.postName ?? "Posto removido", arrivalTime: checklist.arrivalTime ?? null, isCoverage: checklist.isCoverage }]
    : []);
  const unsentReports = input.checklists.flatMap((checklist) =>
    (checklist.status === "visited" || checklist.status === "in_progress")
      && (!checklist.occurrenceSubmittedAt || !checklist.occurrenceReport?.trim())
      ? [{ checklistId: checklist.id, postId: checklist.postId, postName: checklist.postName ?? "Posto removido", status: checklist.status, isCoverage: checklist.isCoverage }]
      : [],
  );

  return {
    routeStatus: "in_progress",
    totalPlannedPosts: input.posts.length,
    pendingPosts,
    pendingVisits,
    activeVisits,
    unsentReports,
    counts: {
      pendingPosts: pendingPosts.length,
      pendingVisits: pendingVisits.length,
      activeVisits: activeVisits.length,
      unsentReports: unsentReports.length,
    },
  };
}

export function hasRouteClosurePendencies(summary: RouteClosurePendingSummary) {
  return summary.pendingPosts.length > 0
    || summary.pendingVisits.length > 0
    || summary.activeVisits.length > 0
    || summary.unsentReports.length > 0;
}

export class RouteClosureError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "CONFLICT" | "BAD_REQUEST", message: string) {
    super(message);
    this.name = "RouteClosureError";
  }
}
