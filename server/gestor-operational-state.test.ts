import { describe, expect, it } from "vitest";
import { deriveGestorOperationalState } from "./db";

describe("deriveGestorOperationalState", () => {
  const now = new Date("2026-08-12T15:00:00.000Z");

  it("identifica um supervisor em atendimento prolongado com GPS desatualizado", () => {
    const result = deriveGestorOperationalState({
      routeStatus: "in_progress",
      hasKmInitial: true,
      activeVisitArrival: new Date("2026-08-12T13:20:00.000Z"),
      latestGpsAt: new Date("2026-08-12T14:50:00.000Z"),
      now,
    });

    expect(result.status).toBe("em_atendimento");
    expect(result.gpsAgeMinutes).toBe(10);
    expect(result.activeVisitMinutes).toBe(100);
    expect(result.alerts.map((alert) => alert.code)).toEqual(expect.arrayContaining(["gps_stale", "visit_extended"]));
  });

  it("identifica rota preparada aguardando a quilometragem inicial", () => {
    const result = deriveGestorOperationalState({ routeStatus: "pending", hasKmInitial: false, now });

    expect(result.status).toBe("aguardando_km");
    expect(result.alerts).toContainEqual(expect.objectContaining({ code: "km_pending", severity: "info" }));
  });

  it("identifica deslocamento sem GPS quando a rota está em andamento", () => {
    const result = deriveGestorOperationalState({ routeStatus: "in_progress", hasKmInitial: true, now });

    expect(result.status).toBe("em_deslocamento");
    expect(result.alerts).toContainEqual(expect.objectContaining({ code: "gps_missing" }));
  });

  it("identifica atividade interna na Base Operacional sem tratá-la como deslocamento", () => {
    const result = deriveGestorOperationalState({ routeStatus: "in_progress", isOperationalBase: true, hasKmInitial: true, latestGpsAt: now, now });

    expect(result.status).toBe("em_base_operacional");
    expect(result.alerts).not.toContainEqual(expect.objectContaining({ code: "visit_extended" }));
  });
});
