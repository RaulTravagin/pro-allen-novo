import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

type DailyReport = any;

const slate = "0F172A";
const blue = "1D4ED8";
const muted = "475569";
const lightBlue = "EFF6FF";

function text(value: unknown) {
  return value == null || value === "" ? "—" : String(value);
}

function time(value: unknown) {
  return value ? new Date(value as string | Date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function duration(minutes: unknown) {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total < 0) return "—";
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  return hours ? `${hours}h ${remainder}min` : `${remainder} min`;
}

function checklistSummary(checklist: any) {
  const total = Number(checklist?.total ?? 0);
  const compliant = Number(checklist?.compliant ?? 0);
  const nonCompliant = Number(checklist?.nonCompliant ?? 0);
  const unanswered = Number(checklist?.unanswered ?? 0);
  if (total === 0) return "Checklist não iniciado";
  if (nonCompliant > 0) return `Requer atenção: ${nonCompliant} item(ns) não conforme(s)`;
  if (unanswered > 0) return `Preenchimento pendente: ${unanswered} item(ns) aguardando resposta`;
  return `Checklist conforme: ${compliant} item(ns) verificado(s)`;
}

function checklistItemStatus(item: any) {
  if (item.isCompliant === true) return "Conforme";
  if (item.isCompliant === false) return "Não conforme";
  return "Sem resposta";
}

function cell(value: unknown, options: { bold?: boolean; color?: string; shading?: string; width?: number } = {}) {
  return new TableCell({
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    shading: options.shading ? { type: ShadingType.CLEAR, color: options.shading } : undefined,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: text(value).split("\n").map((line) => new Paragraph({ children: [new TextRun({ text: line, bold: options.bold, color: options.color ?? slate, size: 18 })] })),
  });
}

function table(headers: string[], rows: Array<Array<unknown>>, widths?: number[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, color: "CBD5E1", size: 4 }, bottom: { style: BorderStyle.SINGLE, color: "CBD5E1", size: 4 }, left: { style: BorderStyle.SINGLE, color: "CBD5E1", size: 4 }, right: { style: BorderStyle.SINGLE, color: "CBD5E1", size: 4 }, insideHorizontal: { style: BorderStyle.SINGLE, color: "E2E8F0", size: 4 }, insideVertical: { style: BorderStyle.SINGLE, color: "E2E8F0", size: 4 },
    },
    rows: [
      new TableRow({ children: headers.map((header, index) => cell(header, { bold: true, color: "FFFFFF", shading: slate, width: widths?.[index] })) }),
      ...rows.map((row) => new TableRow({ children: row.map((value, index) => cell(value, { width: widths?.[index] })) })),
    ],
  });
}

function metricTable(report: DailyReport) {
  const summary = report.summary;
  return table(
    ["Supervisores em rota", "Visitas concluídas", "Postos pendentes", "Em atendimento"],
    [[`${summary.supervisorsOnRoute}/${summary.supervisors}`, summary.completedVisits, summary.pendingVisits, summary.visitsInProgress], ["Coberturas", "KM percorridos", "Não conformidades", "Alertas"], [summary.coverages, `${Number(summary.kmCovered).toLocaleString("pt-BR")} km`, summary.nonCompliantItems, summary.alerts]],
    [25, 25, 25, 25],
  );
}

function supervisorSection(supervisor: any, index: number) {
  const route = supervisor.route;
  const visitRows = (route?.visits ?? []).map((visit: any) => [
    `${visit.postName}${visit.isCoverage ? " (Cobertura)" : ""}`,
    visit.status === "visited" ? "Concluído" : visit.status === "in_progress" ? "Em atendimento" : visit.status === "pending" ? "Pendente" : "Não realizado",
    `Chegada: ${time(visit.arrivalTime)}\nSaída: ${time(visit.departureTime)}\nDuração: ${duration(visit.durationMinutes)}`,
    `${visit.isCoverage ? `Cobertura: ${text(visit.coverageReason)}\n` : ""}${text(visit.observations)}`,
  ]);
  const location = supervisor.latestLocation ? `${Number(supervisor.latestLocation.latitude).toFixed(5)}, ${Number(supervisor.latestLocation.longitude).toFixed(5)} · precisão ${text(supervisor.latestLocation.accuracy)} m · ${time(supervisor.latestLocation.recordedAt)}` : "Sem localização recebida";

  return [
    new Paragraph({ pageBreakBefore: index > 0, heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: supervisor.supervisorName, color: blue, bold: true })] }),
    new Paragraph({ children: [new TextRun({ text: `Situação: ${supervisor.operationalStatusLabel}`, bold: true, color: slate }), new TextRun({ text: `  |  Usuário: ${text(supervisor.username)}`, color: muted })] }),
    table(
      ["Rota", "Atendimento atual", "KM", "Último GPS"],
      [[route ? `${route.name} · ${route.region}` : "Sem rota preparada", route?.activeVisit ? `${route.activeVisit.postName} desde ${time(route.activeVisit.arrivalTime)} (${duration(route.activeVisit.durationMinutes)})` : "Sem atendimento ativo", route?.kmInitial != null ? `Inicial: ${route.kmInitial} km\nFinal: ${text(route.kmFinal)} km\nPercorrido: ${text(route.kmCovered)} km` : "KM não informado", location]],
      [25, 25, 25, 25],
    ),
    new Paragraph({ spacing: { before: 180 }, children: [new TextRun({ text: `Checklist consolidado: ${checklistSummary(supervisor.checklistTotals)} · ${supervisor.coverageCount} cobertura(s).`, color: slate })] }),
    new Paragraph({ spacing: { before: 140, after: 80 }, children: [new TextRun({ text: `Alertas: ${(supervisor.alerts ?? []).map((alert: any) => alert.title).join(" · ") || "Sem alertas operacionais"}`, bold: true, color: (supervisor.alerts ?? []).length ? "B45309" : "166534" })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Postos e atendimentos", color: slate, bold: true })] }),
    ...(visitRows.length ? [table(["Posto", "Situação", "Horários", "Observações"], visitRows, [22, 16, 28, 34])] : [new Paragraph({ children: [new TextRun({ text: "Nenhum posto registrado para este supervisor no dia.", color: muted, italics: true })] })]),
    new Paragraph({ spacing: { before: 220, after: 80 }, heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Checklist por visita", color: slate, bold: true })] }),
    ...((route?.visits ?? []).filter((visit: any) => visit.status === "visited" || visit.status === "in_progress").flatMap((visit: any) => {
      const items = visit.checklistItems ?? [];
      if (!items.length) return [];
      return [
        new Paragraph({ spacing: { before: 100, after: 60 }, children: [new TextRun({ text: `${visit.postName}: ${checklistSummary(visit.checklist)}`, bold: true, color: slate })] }),
        table(["Item verificado", "Resultado", "Observação"], items.map((item: any) => [`${text(item.category)} · ${text(item.description)}`, checklistItemStatus(item), text(item.notes)]), [52, 20, 28]),
      ];
    })),
  ];
}

export function createDailyReportWordDocument(report: DailyReport) {
  const executiveSummary = `No dia ${new Date(report.reportDate).toLocaleDateString("pt-BR")}, foram acompanhados ${report.summary.supervisors} supervisor(es), com ${report.summary.completedVisits} visita(s) concluída(s), ${report.summary.pendingVisits} posto(s) pendente(s), ${report.summary.coverages} cobertura(s) e ${report.summary.alerts} alerta(s) operacional(is).`;
  return new Document({
    creator: "CT3 Chults Travagin",
    title: `Relatório Diário Operacional - ${new Date(report.reportDate).toLocaleDateString("pt-BR")}`,
    sections: [{
      properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "CT3 · CHULTS TRAVAGIN", bold: true, color: blue, size: 24, characterSpacing: 30 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "RELATÓRIO DIÁRIO OPERACIONAL", bold: true, color: slate, size: 36 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [new TextRun({ text: `Data de referência: ${new Date(report.reportDate).toLocaleDateString("pt-BR")}  |  Gerado em: ${new Date(report.generatedAt).toLocaleString("pt-BR")}`, color: muted, size: 18 })] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Resumo executivo", color: blue, bold: true })] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: executiveSummary, color: slate, size: 21 })] }),
        metricTable(report),
        new Paragraph({ spacing: { before: 360, after: 100 }, heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Acompanhamento por supervisor", color: blue, bold: true })] }),
        ...report.supervisors.flatMap((supervisor: any, index: number) => supervisorSection(supervisor, index)),
      ],
    }],
  });
}

export async function downloadDailyReportWord(report: DailyReport) {
  const blob = await Packer.toBlob(createDailyReportWordDocument(report));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-diario-${new Date(report.reportDate).toISOString().slice(0, 10)}.docx`;
  link.click();
  URL.revokeObjectURL(url);
}
