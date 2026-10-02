import { describe, expect, it } from "vitest";
import { checkInVisitForRoute, checkOutVisitForRoute, saveSupervisorLocation } from "./db";

describe("coordenadas na camada de persistência de visita", () => {
  it("rejeita pares incompletos e valores fora da faixa antes de consultar o banco", async () => {
    await expect(checkInVisitForRoute({ checklistId: 1, supervisorId: 2, latitude: -23.5 }))
      .rejects.toThrow("Latitude e longitude devem ser enviadas juntas");
    await expect(checkInVisitForRoute({ checklistId: 1, supervisorId: 2, latitude: 91, longitude: 0 }))
      .rejects.toThrow("Latitude e longitude devem ser enviadas juntas");
    await expect(checkOutVisitForRoute({ checklistId: 1, supervisorId: 2, latitude: 0, longitude: -181 }))
      .rejects.toThrow("Latitude e longitude devem ser enviadas juntas");
    await expect(saveSupervisorLocation(2, null, 91, 0))
      .rejects.toThrow("latitude e longitude dentro das faixas geográficas válidas");
  });

  it.each([-1, Number.POSITIVE_INFINITY, Number.NaN])(
    "rejeita accuracy inválida (%s) antes de consultar o banco",
    async (accuracy) => {
      await expect(saveSupervisorLocation(2, null, -23.5, -46.6, accuracy))
        .rejects.toThrow("acurácia deve ser um número finito e não negativo");
    },
  );
});
