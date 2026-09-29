import { describe, expect, it } from "vitest";
import { getReportQueryPeriod } from "./db";

describe("período comum das consultas de relatório", () => {
  it("usa a data operacional completa, das 06h às 06h, com fim exclusivo", () => {
    const period = getReportQueryPeriod(new Date("2026-08-20T12:00:00Z"), new Date("2026-08-20T12:00:00Z"));
    expect(period.start.toISOString()).toBe("2026-08-20T09:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-08-21T09:00:00.000Z");
  });
});
