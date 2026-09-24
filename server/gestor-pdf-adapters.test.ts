import { describe, expect, it } from "vitest";
import { buildDailyReportPdfSections, buildDailyReportSummaryLines, buildSupervisorPdfSection, slugifyFileName } from "../client/src/lib/gestorPdfAdapters";
import { visitStatusLabel } from "../client/src/lib/operationalReportPdf";

describe("adaptadores do relatório em PDF do Gestor", () => {
  it("monta a seção do supervisor com viatura, KM e auditorias do painel em tempo real", () => {
    const section = buildSupervisorPdfSection({
      supervisorName: "Rodrigo Ramos",
      supervisorUsername: "rodrigo.ramos",
      route: {
        routeName: "Rota 2",
        routeRegion: "Jundiaí",
        routeStatus: "in_progress",
        shiftType: "day",
        startedAt: new Date("2026-08-21T09:00:00Z"),
        completedAt: null,
        vehicle: { plate: "ABC1D23", model: "Fiat Strada" },
        kmInitial: 12_000,
        kmFinal: null,
        kmCovered: null,
        visits: [
          {
            postName: "Flex 1",
            postRegion: "Jundiaí",
            status: "visited",
            arrivalTime: new Date("2026-08-21T10:00:00Z"),
            departureTime: new Date("2026-08-21T10:25:00Z"),
            occurrenceSubmittedAt: new Date("2026-08-21T10:27:00Z"),
            occurrenceReport: "Ronda conferida e posto em funcionamento.",
            durationMinutes: 25,
            observations: "Ronda conferida",
            isCoverage: false,
            arrivalLatitude: -23.18,
            arrivalLongitude: -46.88,
          },
        ],
      },
    });

    expect(section.supervisorName).toBe("Rodrigo Ramos");
    expect(section.vehiclePlate).toBe("ABC1D23");
    expect(section.kmInitial).toBe(12_000);
    expect(section.shiftLabel).toContain("Dia");
    expect(section.statusLabel).toBe("Em andamento");
    expect(section.visits).toHaveLength(1);
    expect(section.visits[0]?.occurrenceReport).toBe("Ronda conferida e posto em funcionamento.");
    expect(section.visits[0]?.occurrenceSubmittedAt).toEqual(new Date("2026-08-21T10:27:00Z"));
    expect(section.visits[0]?.arrivalLatitude).toBe(-23.18);
  });

  it("identifica a Base Operacional e mantém a seção sem postos", () => {
    const section = buildSupervisorPdfSection({
      supervisorName: "Paulo Murashita",
      route: { routeActivityType: "operational_base", routeName: "Base", shiftType: "night", visits: [] },
    });
    expect(section.routeName).toBe("Base Operacional");
    expect(section.shiftLabel).toContain("Noite");
    expect(section.visits).toEqual([]);
  });

  it("converte o relatório diário em seções e resumo do período", () => {
    const report = {
      reportDate: new Date("2026-08-21T09:00:00Z"),
      summary: { supervisors: 3, supervisorsOnRoute: 2, completedVisits: 5, visitsInProgress: 1, pendingVisits: 2, coverages: 1, kmCovered: 140, reportedOccurrences: 2, pendingOccurrenceReports: 0, alerts: 1 },
      supervisors: [
        {
          supervisorName: "Aparecido Quirino",
          username: "aparecido.quirino",
          operationalStatusLabel: "Em atendimento",
          route: {
            name: "Rota 3", region: "Jundiaí", shiftType: "night", kmInitial: 500, kmFinal: 560, kmCovered: 60,
            vehiclePlate: "XYZ9K88",
            visits: [{ postName: "Open View", status: "visited", occurrenceReport: "Livro de ocorrências conferido e sem pendências." }],
          },
        },
      ],
    };

    const sections = buildDailyReportPdfSections(report);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.vehiclePlate).toBe("XYZ9K88");
    expect(sections[0]?.kmCovered).toBe(60);
    expect(sections[0]?.visits[0]?.occurrenceReport).toContain("Livro de ocorrências");

    const summary = buildDailyReportSummaryLines(report);
    expect(summary.join(" ")).toContain("Visitas concluídas: 5");
    expect(summary.join(" ")).toContain("140 km");
  });

  it("traduz situação da visita", () => {
    expect(visitStatusLabel("visited")).toBe("Concluído");
    expect(visitStatusLabel("in_progress")).toBe("Em atendimento");
  });

  it("gera nome de arquivo sem acentos nem espaços", () => {
    expect(slugifyFileName("Aparecido Quirino")).toBe("aparecido-quirino");
    expect(slugifyFileName("Rota 2 · Jundiaí")).toBe("rota-2-jundiai");
    expect(slugifyFileName("///")).toBe("relatorio");
  });
});
