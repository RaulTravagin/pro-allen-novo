import { describe, expect, it } from "vitest";
import { createRelativeDateRange, formatDateInputValue, parseDateInputValue } from "./reportDateRange";


describe("filtros de data dos relatórios", () => {
  it("mantém a data do input no calendário local", () => {
    const parsed = parseDateInputValue("2026-08-20");
    expect(formatDateInputValue(parsed)).toBe("2026-08-20");
  });

  it("cria a janela relativa sem converter a data para UTC", () => {
    const range = createRelativeDateRange(30, new Date(2026, 8, 28, 23, 30));
    expect(formatDateInputValue(range.start)).toBe("2026-08-30");
    expect(formatDateInputValue(range.end)).toBe("2026-09-28");
  });
});
