import { describe, expect, it } from "vitest";
import { enrichFuelHistory } from "./db";

describe("enrichFuelHistory", () => {
  it("calcula Km/L, custo por Km e distância entre abastecimentos da mesma viatura", () => {
    const history = enrichFuelHistory([
      { id: 1, odometerKm: "12000", liters: "30", amount: "150", createdAt: new Date("2026-08-18T08:00:00.000Z") },
      { id: 2, odometerKm: "12360", liters: "40", amount: "260", createdAt: new Date("2026-08-19T08:00:00.000Z") },
    ]);

    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ id: 2, distanceSincePrevious: 360, consumptionKmPerLiter: 9, costPerKm: 0.72 });
    expect(history[1]).toMatchObject({ id: 1, distanceSincePrevious: null, consumptionKmPerLiter: null, costPerKm: null });
  });
});
