import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getVisitChecklistById: vi.fn(),
    getSupervisorRouteById: vi.fn(),
    submitVisitOccurrence: vi.fn(),
  };
});

import * as db from "./db";
import { deriveVisitProgress } from "./db";
import { appRouter } from "./routers";

function supervisorContext(supervisorId = 17): TrpcContext {
  return {
    user: { id: supervisorId, role: "user" } as TrpcContext["user"],
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as TrpcContext["res"],
  };
}

describe("sincronização imediata de ocorrência", () => {
  it("persiste a ocorrência do posto e toca a rota em andamento sem exigir KM final", async () => {
    vi.mocked(db.getVisitChecklistById).mockResolvedValue({ id: 33, supervisorRouteId: 71, status: "in_progress" } as never);
    vi.mocked(db.getSupervisorRouteById).mockResolvedValue({ id: 71, supervisorId: 17, status: "in_progress", kmFinal: null } as never);
    vi.mocked(db.submitVisitOccurrence).mockResolvedValue({} as never);

    const caller = appRouter.createCaller(supervisorContext());
    await expect(caller.checklists.submitOccurrence({ checklistId: 33, occurrenceReport: "Visita concluída durante a rota" })).resolves.toBeDefined();

    expect(db.submitVisitOccurrence).toHaveBeenCalledWith(33, "Visita concluída durante a rota");
  });

  it("contabiliza o relato no Gestor mesmo com a rota e a visita ainda em andamento", () => {
    const progress = deriveVisitProgress([
      {
        status: "in_progress",
        occurrenceSubmittedAt: new Date("2026-08-21T22:15:00.000Z"),
        occurrenceReport: "Visita realizada.",
      },
      { status: "pending", occurrenceSubmittedAt: null, occurrenceReport: null },
      { status: "pending", occurrenceSubmittedAt: null, occurrenceReport: null },
    ]);

    expect(progress).toEqual({ totalPosts: 3, reportedVisits: 1, completedVisits: 0, pendingVisits: 2, skippedVisits: 0 });
  });
});
