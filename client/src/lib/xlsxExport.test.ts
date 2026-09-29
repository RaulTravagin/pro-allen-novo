import { describe, expect, it } from "vitest";
import { buildStyledWorkbook } from "./xlsxExport";

describe("exportação XLSX formatada", () => {
  it("preserva colunas e valores enquanto configura leitura e impressão", async () => {
    const workbook = buildStyledWorkbook([{
      name: "Visitas",
      title: "Pro Allen — Teste",
      subtitle: "Dados fictícios",
      headers: ["Data", "Valor", "Ocorrência"],
      rows: [[new Date("2026-08-20T12:00:00Z"), 155.89, "=Registro fictício"]],
      widths: [14, 16, 40],
      formats: { 0: "dd/mm/yyyy", 1: "R$ #,##0.00" },
    }]);
    const worksheet = workbook.getWorksheet("Visitas");

    expect(worksheet).toBeDefined();
    expect(worksheet?.getCell("A1").value).toBe("Pro Allen — Teste");
    expect(worksheet?.getRow(4).values).toEqual([, "Data", "Valor", "Ocorrência"]);
    expect(worksheet?.getCell("B5").value).toBe(155.89);
    expect(worksheet?.getCell("B5").numFmt).toBe("R$ #,##0.00");
    expect(worksheet?.getCell("C5").value).toBe("'=Registro fictício");
    expect(worksheet?.autoFilter).toMatchObject({ from: { row: 4, column: 1 }, to: { row: 5, column: 3 } });
    expect(worksheet?.views[0]).toMatchObject({ state: "frozen", ySplit: 4 });
    expect(worksheet?.pageSetup.fitToWidth).toBe(1);
    expect(worksheet?.getColumn(3).width).toBe(40);
    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
