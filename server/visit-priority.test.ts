import { describe, expect, it, vi } from "vitest";
import { calculateVisitPriority } from "./db";

describe("calculateVisitPriority", () => {
  it("classifica postos sem visita como críticos", () => {
    expect(calculateVisitPriority(null)).toEqual({ priority: "red", daysSinceVisit: 999 });
  });

  it("classifica mais de dez dias como vermelho", () => {
    vi.setSystemTime(new Date("2026-08-12T12:00:00.000Z"));
    expect(calculateVisitPriority(new Date("2026-08-01T12:00:00.000Z")).priority).toBe("red");
    vi.useRealTimers();
  });

  it("classifica cinco a dez dias como amarelo", () => {
    vi.setSystemTime(new Date("2026-08-12T12:00:00.000Z"));
    expect(calculateVisitPriority(new Date("2026-08-07T12:00:00.000Z"))).toEqual({ priority: "yellow", daysSinceVisit: 5 });
    vi.useRealTimers();
  });

  it("classifica menos de cinco dias como verde", () => {
    vi.setSystemTime(new Date("2026-08-12T12:00:00.000Z"));
    expect(calculateVisitPriority(new Date("2026-08-10T12:00:00.000Z"))).toEqual({ priority: "green", daysSinceVisit: 2 });
    vi.useRealTimers();
  });
});
