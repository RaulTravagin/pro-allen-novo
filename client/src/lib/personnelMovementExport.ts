import { civilDateAsLocalDate } from "@/lib/personnelCivilCalendar";
import { brazilCivilDate, summarizeGestorMovements, summarizePersonnelMovements, type GestorMovementRow, type PersonnelMovementRow } from "@shared/personnel-movement-report";

export type MovementReportAudience = "RH" | "FINANCEIRO" | "ADM" | "GESTOR";

type Worksheet = {
  name: string;
  title: string;
  subtitle: string;
  headers: string[];
  rows: Array<Array<unknown>>;
  widths: number[];
  formats?: Record<number, string>;
  tabColor: string;
};

const statusLabel: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  PAID: "Quitado",
  REJECTED: "Rejeitado",
};
const kindLabel: Record<string, string> = { FT: "Folga trabalhada", EXTRA: "Serviço extra" };

function excelCivilDate(value: string) {
  return civilDateAsLocalDate(value);
}

function summaryWorksheet(rows: PersonnelMovementRow[], periodLabel: string): Worksheet {
  const summary = summarizePersonnelMovements(rows);
  return {
    name: "Resumo",
    title: "Pro Allen — Movimentações de pessoal",
    subtitle: `${periodLabel} · Relatório de movimentação; não representa fechamento ou bloqueio.`,
    headers: ["Indicador", "Registros", "Valor (R$)"],
    rows: [
      ["Folgas trabalhadas (FT)", summary.byKind.FT.count, summary.byKind.FT.amount],
      ["Serviços extras", summary.byKind.EXTRA.count, summary.byKind.EXTRA.amount],
      ["Total", summary.totalRecords, summary.totalAmount],
      ...Object.entries(summary.byStatus).map(([status, value]) => [statusLabel[status], value.count, value.amount]),
    ],
    widths: [34, 16, 20],
    formats: { 2: 'R$ #,##0.00' },
    tabColor: "F6C915",
  };
}

function detailWorksheet(rows: PersonnelMovementRow[], audience: Exclude<MovementReportAudience, "GESTOR">, periodLabel: string): Worksheet {
  const base = {
    name: "Movimentações",
    title: "Pro Allen — FTs e serviços extras",
    subtitle: `${periodLabel} · Datas civis inclusivas, fuso America/Sao_Paulo.`,
    tabColor: audience === "FINANCEIRO" ? "10B981" : "1D4ED8",
  };
  if (audience === "FINANCEIRO") {
    return {
      ...base,
      headers: ["Data de referência", "Tipo", "Funcionário", "Status", "Valor (R$)", "Pagamento previsto"],
      rows: rows.map((row) => [
        excelCivilDate(row.civilDate), kindLabel[row.kind], row.employeeName ?? "—", statusLabel[row.status],
        Number(row.amount ?? 0), row.kind === "FT" && row.paymentDate && brazilCivilDate(row.paymentDate)
          ? excelCivilDate(brazilCivilDate(row.paymentDate)!)
          : null,
      ]),
      widths: [19, 22, 30, 16, 18, 22],
      formats: { 0: "dd/mm/yyyy", 4: 'R$ #,##0.00', 5: "dd/mm/yyyy" },
    };
  }
  return {
    ...base,
    headers: ["Data de referência", "Tipo", "Funcionário", "Cargo/função", "Posto", "Status", "Horas/diária", "Valor (R$)", "Detalhe operacional"],
    rows: rows.map((row) => [
      excelCivilDate(row.civilDate), kindLabel[row.kind], row.employeeName ?? "—", row.position ?? "—", row.post ?? "—",
      statusLabel[row.status], row.kind === "EXTRA" ? Number(row.hoursOrDaily ?? 0) : null,
      Number(row.amount ?? 0), row.kind === "FT" ? row.reason ?? "" : row.description ?? "",
    ]),
    widths: [19, 22, 30, 24, 28, 16, 18, 18, 56],
    formats: { 0: "dd/mm/yyyy", 6: "0.00", 7: 'R$ #,##0.00' },
  };
}

function gestorWorksheets(rows: GestorMovementRow[], periodLabel: string): Worksheet[] {
  const summary = summarizeGestorMovements(rows);
  return [
    {
      name: "Resumo",
      title: "Pro Allen — Resumo de movimentações",
      subtitle: `${periodLabel} · Contagens operacionais agregadas; relatório sem efeito de fechamento.`,
      headers: ["Indicador", "Registros"],
      rows: [
        ["Folgas trabalhadas (FT)", summary.byKind.FT],
        ["Serviços extras", summary.byKind.EXTRA],
        ["Total de movimentações", summary.totalRecords],
      ],
      widths: [36, 18],
      tabColor: "F6C915",
    },
    {
      name: "Detalhe operacional",
      title: "Pro Allen — Movimentações por data e tipo",
      subtitle: "Detalhe agregado por dia e tipo; sem identificação individual, valores ou justificativas.",
      headers: ["Data civil", "Tipo", "Quantidade de registros"],
      rows: rows.map((row) => [excelCivilDate(row.civilDate), kindLabel[row.kind], row.count]),
      widths: [18, 26, 26],
      formats: { 0: "dd/mm/yyyy", 2: "0" },
      tabColor: "1D4ED8",
    },
  ];
}

export function buildPersonnelMovementWorksheets(
  rows: PersonnelMovementRow[] | GestorMovementRow[],
  audience: MovementReportAudience,
  periodLabel: string,
): Worksheet[] {
  if (audience === "GESTOR") return gestorWorksheets(rows as GestorMovementRow[], periodLabel);
  const personnelRows = rows as PersonnelMovementRow[];
  return [summaryWorksheet(personnelRows, periodLabel), detailWorksheet(personnelRows, audience, periodLabel)];
}
