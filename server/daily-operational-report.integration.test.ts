import { describe, expect, it } from "vitest";
import { buildDailyOperationalReport } from "./daily-operational-report";
import { getGestorOperationalSnapshot } from "./db";

describe("relatório diário operacional integrado", () => {
  it("consolida o snapshot real do dia em resumo e lista de supervisores", async () => {
    const snapshot = await getGestorOperationalSnapshot();
    const report = buildDailyOperationalReport(snapshot);

    expect(report.reportDate).toBeInstanceOf(Date);
    expect(report.generatedAt).toBeInstanceOf(Date);
    expect(report.summary).toMatchObject({
      supervisors: expect.any(Number),
      completedVisits: expect.any(Number),
      pendingVisits: expect.any(Number),
      kmCovered: expect.any(Number),
      alerts: expect.any(Number),
    });
    expect(report.supervisors).toHaveLength(snapshot.operationalSupervisors.length);
  });
});
