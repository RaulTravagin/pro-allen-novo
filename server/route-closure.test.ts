import { describe, expect, it } from "vitest";
import { hasRouteClosurePendencies, summarizeRouteClosure } from "./route-closure";

const fixedAt = new Date("2026-09-28T16:00:00.000Z");

describe("resumo de encerramento de rota", () => {
  it("sinaliza postos sem visita, visitas ativas/pendentes e relatos não enviados", () => {
    const summary = summarizeRouteClosure({
      posts: [
        { id: 1, name: "Posto visitado" },
        { id: 2, name: "Posto sem visita" },
      ],
      checklists: [
        { id: 10, postId: 1, postName: "Posto visitado", status: "visited", isCoverage: false, occurrenceReport: "Relato salvo", occurrenceSubmittedAt: fixedAt },
        { id: 11, postId: 2, postName: "Posto sem visita", status: "pending", isCoverage: false },
        { id: 12, postId: 3, postName: "Cobertura ativa", status: "in_progress", isCoverage: true, arrivalTime: fixedAt, occurrenceReport: "rascunho" },
        { id: 13, postId: 4, postName: "Relato não enviado", status: "visited", isCoverage: true, occurrenceReport: "Relato sem envio" },
        { id: 14, postId: 5, postName: "Visita pulada", status: "skipped", isCoverage: true },
      ],
    });

    expect(summary.counts).toEqual({ pendingPosts: 1, pendingVisits: 2, activeVisits: 1, unsentReports: 2 });
    expect(summary.pendingPosts[0]).toMatchObject({ postId: 2, status: "pending" });
    expect(summary.activeVisits[0]).toMatchObject({ checklistId: 12, postName: "Cobertura ativa" });
    expect(summary.unsentReports.map((item) => item.checklistId)).toEqual([12, 13]);
    expect(hasRouteClosurePendencies(summary)).toBe(true);
  });

  it("permite fechamento normal apenas quando postos ativos e registros exigidos estão concluídos/enviados", () => {
    const summary = summarizeRouteClosure({
      posts: [{ id: 1, name: "Posto 1" }],
      checklists: [
        { id: 20, postId: 1, postName: "Posto 1", status: "visited", isCoverage: false, arrivalTime: fixedAt, departureTime: fixedAt, occurrenceReport: "Visita conferida e posto em funcionamento.", occurrenceSubmittedAt: fixedAt },
      ],
    });

    expect(summary.counts).toEqual({ pendingPosts: 0, pendingVisits: 0, activeVisits: 0, unsentReports: 0 });
    expect(hasRouteClosurePendencies(summary)).toBe(false);
  });

  it("usa a última visita por posto para detectar um reatendimento ainda pendente", () => {
    const summary = summarizeRouteClosure({
      posts: [{ id: 1, name: "Posto 1" }],
      checklists: [
        { id: 30, postId: 1, postName: "Posto 1", status: "visited", isCoverage: false, occurrenceReport: "Relato anterior", occurrenceSubmittedAt: fixedAt },
        { id: 31, postId: 1, postName: "Posto 1", status: "pending", isCoverage: false },
      ],
    });

    expect(summary.pendingPosts).toEqual([{ postId: 1, postName: "Posto 1", status: "pending" }]);
  });

  it("não mantém uma visita histórica pendente como aberta quando o último atendimento foi concluído e enviado", () => {
    const summary = summarizeRouteClosure({
      posts: [{ id: 1, name: "Posto 1" }],
      checklists: [
        { id: 40, postId: 1, postName: "Posto 1", status: "skipped", isCoverage: false },
        { id: 41, postId: 1, postName: "Posto 1", status: "visited", isCoverage: false, occurrenceReport: "Visita finalizada com sucesso.", occurrenceSubmittedAt: fixedAt },
      ],
    });

    expect(summary.pendingPosts).toEqual([]);
    expect(summary.pendingVisits).toEqual([]);
    expect(hasRouteClosurePendencies(summary)).toBe(false);
  });
});
