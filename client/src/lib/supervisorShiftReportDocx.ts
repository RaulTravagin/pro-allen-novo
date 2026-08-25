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
import { slugifyFileName } from "./gestorPdfAdapters";

function text(value: unknown) {
  return value == null || value === "" ? "—" : String(value);
}

function time(value: unknown) {
  return value ? new Date(value as string | Date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function cell(value: unknown, options: { bold?: boolean; color?: string; shading?: string; width?: number } = {}) {
  return new TableCell({
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    shading: options.shading ? { type: ShadingType.CLEAR, color: options.shading } : undefined,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: text(value).split("\n").map((line) => new Paragraph({ children: [new TextRun({ text: line, bold: options.bold, color: options.color ?? "0F172A", size: 18 })] })),
  });
}

function table(headers: string[], rows: Array<Array<unknown>>, widths?: number[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, color: "CBD5E1", size: 4 },
      bottom: { style: BorderStyle.SINGLE, color: "CBD5E1", size: 4 },
      left: { style: BorderStyle.SINGLE, color: "CBD5E1", size: 4 },
      right: { style: BorderStyle.SINGLE, color: "CBD5E1", size: 4 },
      insideHorizontal: { style: BorderStyle.SINGLE, color: "E2E8F0", size: 4 },
      insideVertical: { style: BorderStyle.SINGLE, color: "E2E8F0", size: 4 },
    },
    rows: [
      new TableRow({ children: headers.map((header, index) => cell(header, { bold: true, color: "FFFFFF", shading: "0F172A", width: widths?.[index] })) }),
      ...rows.map((row) => new TableRow({ children: row.map((value, index) => cell(value, { width: widths?.[index] })) })),
    ],
  });
}

function activityLabel(activity: any) {
  return activity.routeActivityType === "operational_base" ? "Base Operacional" : activity.routeName;
}

function statusLabel(status: string) {
  return ({ pending: "Aguardando início", in_progress: "Em andamento", completed: "Encerrada", cancelled: "Cancelada" } as Record<string, string>)[status] ?? status;
}

function visitStatusLabel(status: string) {
  return ({ visited: "Concluído", in_progress: "Em atendimento", pending: "Pendente", skipped: "Não realizado" } as Record<string, string>)[status] ?? status;
}

function checklistSummary(checklist: any) {
  const total = Number(checklist?.total ?? 0);
  const compliant = Number(checklist?.compliant ?? 0);
  const nonCompliant = Number(checklist?.nonCompliant ?? 0);
  const unanswered = Number(checklist?.unanswered ?? 0);
  if (!total) return "Checklist não iniciado";
  if (nonCompliant) return `Requer atenção: ${nonCompliant} não conforme(s)`;
  if (unanswered) return `Pendente: ${unanswered} sem resposta`;
  return `Conforme: ${compliant} item(ns)`;
}

export function createSupervisorShiftWordDocument(report: any) {
  const metrics = report.metrics ?? {};
  const reportDate = new Date(report.reportDate);
  const activities = report.activities ?? [];
  const visits = report.visits ?? [];
  const fuelLogs = report.fuelLogs ?? [];
  const observations = report.observations ?? [];
  const supervisorName = report.supervisor?.name ?? "Supervisor";
  const activityRows = activities.map((activity: any) => [
    activityLabel(activity),
    statusLabel(activity.status),
    `Início: ${time(activity.startedAt ?? activity.shiftStartedAt)}\nFim: ${time(activity.completedAt)}`,
    `Inicial: ${text(activity.kmInitial)} km\nFinal: ${text(activity.kmFinal)} km\nPercorrido: ${text(activity.kmCovered)} km`,
  ]);
  const visitRows = visits.map((visit: any) => [
    `${text(visit.postName)}${visit.isCoverage ? " (Cobertura/Base)" : ""}\n${text(visit.routeName)}`,
    visitStatusLabel(visit.status),
    `Entrada: ${time(visit.arrivalTime)}\nSaída: ${time(visit.departureTime)}`,
    visit.isCoverage ? `Justificativa: ${text(visit.coverageReason)}\n${text(visit.observations)}` : text(visit.observations),
    checklistSummary(visit.checklistSummary),
  ]);
  const fuelRows = fuelLogs.map((fuel: any) => [
    time(fuel.createdAt),
    `${text(fuel.odometerKm)} km`,
    text(fuel.fuelType),
    `R$ ${Number(fuel.amount ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n${Number(fuel.liters ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} L`,
  ]);
  const occurrenceRows = observations.map((item: any) => [item.type === "coverage" ? "Cobertura/Base Operacional" : "Observação", text(item.postName), text(item.text)]);

  return new Document({
    creator: "Pro Allen",
    title: `Relatório de encerramento de turno - ${supervisorName}`,
    sections: [{
      properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "PRO ALLEN", bold: true, color: "1D4ED8", size: 28 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "RELATÓRIO DE ENCERRAMENTO DE TURNO", bold: true, color: "0F172A", size: 30 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: `Supervisor: ${supervisorName} · Data: ${reportDate.toLocaleDateString("pt-BR")} · Gerado em: ${time(report.generatedAt)}`, color: "475569", size: 18 })] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Resumo do turno", color: "1D4ED8", bold: true })] }),
        table(["Início", "Término", "KM inicial", "KM final", "KM percorrido"], [[time(report.startedAt), time(report.completedAt), `${text(metrics.kmInitial)} km`, `${text(metrics.kmFinal)} km`, `${Number(metrics.kmCovered ?? 0).toLocaleString("pt-BR")} km`]], [20, 20, 20, 20, 20]),
        new Paragraph({ spacing: { before: 180, after: 80 }, children: [new TextRun({ text: `Visitas: ${metrics.completedVisits ?? 0} concluída(s) · ${metrics.pendingVisits ?? 0} pendente(s) · ${metrics.coverageCount ?? 0} cobertura(s)/Base Operacional · ${metrics.nonCompliantItems ?? 0} não conformidade(s).`, color: "0F172A" })] }),
        ...(activities.length ? [new Paragraph({ spacing: { before: 220, after: 80 }, heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Atividades do turno", color: "1D4ED8", bold: true })] }), table(["Atividade", "Situação", "Horários", "Quilometragem"], activityRows, [25, 18, 29, 28])] : []),
        new Paragraph({ spacing: { before: 240, after: 80 }, heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Postos visitados, Base Operacional e coberturas", color: "1D4ED8", bold: true })] }),
        ...(visitRows.length ? [table(["Posto / atividade", "Situação", "Entrada e saída", "Observações / justificativa", "Checklist"], visitRows, [23, 15, 22, 28, 12])] : [new Paragraph({ children: [new TextRun({ text: "Nenhum posto ou atividade de visita registrado neste turno.", color: "475569", italics: true })] })]),
        new Paragraph({ spacing: { before: 240, after: 80 }, heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Abastecimentos", color: "1D4ED8", bold: true })] }),
        ...(fuelRows.length ? [table(["Data", "Odômetro", "Combustível", "Valor / litros"], fuelRows, [27, 20, 23, 30])] : [new Paragraph({ children: [new TextRun({ text: "Nenhum abastecimento registrado neste turno.", color: "475569", italics: true })] })]),
        new Paragraph({ spacing: { before: 240, after: 80 }, heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Ocorrências e observações", color: "1D4ED8", bold: true })] }),
        ...(occurrenceRows.length ? [table(["Tipo", "Posto / atividade", "Registro"], occurrenceRows, [25, 25, 50])] : [new Paragraph({ children: [new TextRun({ text: "Nenhuma ocorrência ou observação registrada.", color: "475569", italics: true })] })]),
      ],
    }],
  });
}

export async function downloadSupervisorShiftWord(report: any) {
  const blob = await Packer.toBlob(createSupervisorShiftWordDocument(report));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-turno-${slugifyFileName(report.supervisor?.name ?? "supervisor")}-${new Date(report.reportDate).toISOString().slice(0, 10)}.docx`;
  link.click();
  URL.revokeObjectURL(url);
}
