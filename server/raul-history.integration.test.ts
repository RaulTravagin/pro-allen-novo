import { describe, expect, it } from "vitest";
import { buildDailyOperationalReport } from "./daily-operational-report";
import { getGestorOperationalSnapshot } from "./db";

describe("histórico operacional de Raul Travagin", () => {
  it("mantém as rotas concluídas de 13 e 14 de agosto acessíveis pelo relatório do Gestor", async () => {
    const reportDate = new Date("2026-08-14T12:00:00");
    const snapshot = await getGestorOperationalSnapshot(reportDate, { includeHistoricalUsers: true });
    const report = buildDailyOperationalReport(snapshot);
    const raul = report.supervisors.find((supervisor) => supervisor.username === "raultravagin");

    expect(report.reportDate.getFullYear()).toBe(2026);
    expect(report.reportDate.getMonth()).toBe(7);
    expect(report.reportDate.getDate()).toBe(14);
    expect(raul).toMatchObject({
      supervisorName: "Raul Travagin",
      route: expect.objectContaining({ name: "Rota 2", status: "completed" }),
    });
    expect(raul?.route?.visits.length).toBeGreaterThan(0);

    const flex1 = raul?.route?.visits.find((visit) => visit.postName === "Flex 1");
    expect(flex1).toMatchObject({
      status: "visited",
      observations: expect.stringContaining("Aline"),
      checklist: { total: 9, compliant: 9, nonCompliant: 0, unanswered: 0 },
    });
  });

  it("inclui também o histórico registrado pelo Raul antes da conta operacional atual", async () => {
    const reportDate = new Date("2026-08-12T12:00:00");
    const snapshot = await getGestorOperationalSnapshot(reportDate, { includeHistoricalUsers: true });
    const report = buildDailyOperationalReport(snapshot);
    const raul = report.supervisors.find((supervisor) => supervisor.supervisorName === "Raul Travagin");

    expect(raul?.route).toMatchObject({ name: "Rota 1" });
    expect(raul?.route?.visits.length).toBeGreaterThan(0);
  });
});
