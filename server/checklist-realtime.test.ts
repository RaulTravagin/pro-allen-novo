import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    submitOccurrenceForActiveRoute: vi.fn(),
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
    vi.mocked(db.submitOccurrenceForActiveRoute).mockResolvedValue({ success: true, occurrenceSubmittedAt: new Date() } as never);

    const caller = appRouter.createCaller(supervisorContext());
    await expect(caller.checklists.submitOccurrence({ checklistId: 33, occurrenceReport: "Visita concluída durante a rota" })).resolves.toBeDefined();

    expect(db.submitOccurrenceForActiveRoute).toHaveBeenCalledWith({
      checklistId: 33,
      supervisorId: 17,
      occurrenceReport: "Visita concluída durante a rota",
    });
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
