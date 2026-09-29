import ExcelJS from "exceljs";

export type XlsxSheetSpec = {
  name: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: unknown[][];
  widths?: number[];
  formats?: Record<number, string>;
  tabColor?: string;
};

const COLORS = {
  navy: "0D1B2A",
  blue: "1D4ED8",
  gold: "F6C915",
  paleBlue: "EAF2FF",
  paleGold: "FFF8D9",
  slate: "475569",
  border: "CBD5E1",
  white: "FFFFFF",
};

function cellValue(value: unknown): ExcelJS.CellValue {
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function applyWorksheetPrintSettings(worksheet: ExcelJS.Worksheet, headerRow: number) {
  worksheet.views = [{ state: "frozen", ySplit: headerRow }];
  worksheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: Math.max(headerRow, worksheet.rowCount), column: Math.max(1, worksheet.columnCount) },
  };
  worksheet.properties.showGridLines = false;
  worksheet.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalDpi: 300,
    verticalDpi: 300,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  worksheet.pageSetup.horizontalCentered = false;
  worksheet.pageSetup.verticalCentered = false;
  worksheet.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
  worksheet.headerFooter.oddFooter = "&LPro Allen · Uso interno&RPágina &P de &N";
}

export function buildStyledWorkbook(specs: XlsxSheetSpec[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pro Allen";
  workbook.company = "Pro Allen";
  workbook.subject = "Relatório operacional";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = false;

  for (const spec of specs) {
    const worksheet = workbook.addWorksheet(spec.name, {
      properties: { tabColor: { argb: spec.tabColor ?? COLORS.blue } },
    });
    const columnCount = Math.max(spec.headers.length, 1);
    const titleRow = worksheet.addRow([spec.title]);
    worksheet.mergeCells(1, 1, 1, columnCount);
    titleRow.height = 26;
    titleRow.getCell(1).font = { name: "Aptos", size: 16, bold: true, color: { argb: COLORS.white } };
    titleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } };
    titleRow.getCell(1).alignment = { vertical: "middle" };

    if (spec.subtitle) {
      const subtitleRow = worksheet.addRow([spec.subtitle]);
      worksheet.mergeCells(2, 1, 2, columnCount);
      subtitleRow.height = 22;
      subtitleRow.getCell(1).font = { name: "Aptos", size: 10, color: { argb: COLORS.slate } };
      subtitleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.paleBlue } };
      subtitleRow.getCell(1).alignment = { wrapText: true, vertical: "middle" };
    }

    worksheet.addRow([]);
    const headerRowNumber = worksheet.rowCount + 1;
    const headerRow = worksheet.addRow(spec.headers);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: COLORS.white } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.blue } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: COLORS.gold } } };
    });

    spec.rows.forEach((rowValues, rowIndex) => {
      const row = worksheet.addRow(rowValues.map(cellValue));
      row.height = 30;
      row.eachCell((cell, columnNumber) => {
        cell.font = { name: "Aptos", size: 10, color: { argb: "172033" } };
        cell.alignment = { vertical: "top", wrapText: true };
        cell.border = { bottom: { style: "hair", color: { argb: COLORS.border } } };
        if (rowIndex % 2 === 1) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F8FAFC" } };
        }
        const format = spec.formats?.[columnNumber - 1];
        if (format) cell.numFmt = format;
      });
    });

    const widths = spec.widths ?? spec.headers.map((header) => Math.min(34, Math.max(12, header.length + 3)));
    widths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });
    applyWorksheetPrintSettings(worksheet, headerRowNumber);
  }

  return workbook;
}

export async function downloadStyledWorkbook(fileName: string, specs: XlsxSheetSpec[]) {
  const workbook = buildStyledWorkbook(specs);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export const xlsxColors = COLORS;
