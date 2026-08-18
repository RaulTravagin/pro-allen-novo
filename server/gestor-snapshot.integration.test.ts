import { describe, expect, it } from "vitest";
import { getGestorOperationalSnapshot } from "./db";

describe("snapshot operacional do Gestor", () => {
  it("retorna a estrutura completa de acompanhamento sem alterar dados operacionais", async () => {
    const snapshot = await getGestorOperationalSnapshot();

    expect(snapshot).toMatchObject({
      activeRoutes: expect.any(Array),
      operationalSupervisors: expect.any(Array),
      alerts: expect.any(Array),
      recentVisits: expect.any(Array),
      metrics: expect.objectContaining({
        supervisorsOnRoute: expect.any(Number),
        visitsInProgress: expect.any(Number),
        pendingVisits: expect.any(Number),
        gpsStale: expect.any(Number),
        alerts: expect.any(Number),
      }),
    });
  });

  it("não inclui contas desativadas na lista operacional", async () => {
    const snapshot = await getGestorOperationalSnapshot();
    const names = snapshot.operationalSupervisors.map((supervisor) => supervisor.supervisorName);
    const usernames = snapshot.operationalSupervisors.map((supervisor) => supervisor.supervisorUsername);

    expect(names).not.toContain("João Supervisor");
    expect(usernames).not.toContain("raul.travagin");
  });
});
