import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
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

const NAVY = "0F172A";
const BLUE = "1D4ED8";
const YELLOW = "FACC15";
const MUTED = "475569";
const LIGHT = "F8FAFC";
const GREEN = "166534";
const GREEN_LIGHT = "ECFDF5";
const AMBER = "92400E";
const AMBER_LIGHT = "FFFBEB";
const ROSE = "BE123C";
const ROSE_LIGHT = "FFF1F2";

function text(value: unknown) {
  return value == null || value === "" ? "—" : String(value);
}

function time(value: unknown) {
  return value ? new Date(value as string | Date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatKm(value: unknown) {
  return `${number(value).toLocaleString("pt-BR")} km`;
}

function formatCurrency(value: unknown) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function cell(value: unknown, options: { bold?: boolean; color?: string; shading?: string; width?: number; size?: number } = {}) {
  return new TableCell({
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    shading: options.shading ? { type: ShadingType.CLEAR, fill: options.shading } : undefined,
    margins: { top: 110, bottom: 110, left: 130, right: 130 },
    children: text(value).split("\n").map((line) => new Paragraph({ spacing: { after: 25 }, children: [new TextRun({ text: line, bold: options.bold, color: options.color ?? NAVY, size: options.size ?? 18 })] })),
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
      new TableRow({ children: headers.map((header, index) => cell(header, { bold: true, color: "FFFFFF", shading: NAVY, width: widths?.[index], size: 17 })) }),
      ...rows.map((row, rowIndex) => new TableRow({ children: row.map((value, index) => cell(value, { width: widths?.[index], shading: rowIndex % 2 ? LIGHT : "FFFFFF" })) })),
    ],
  });
}

function brandBanner(supervisorName: string, reportDate: Date) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, color: NAVY, size: 0 },
      bottom: { style: BorderStyle.NONE, color: NAVY, size: 0 },
      left: { style: BorderStyle.NONE, color: NAVY, size: 0 },
      right: { style: BorderStyle.NONE, color: NAVY, size: 0 },
      insideHorizontal: { style: BorderStyle.NONE, color: NAVY, size: 0 },
      insideVertical: { style: BorderStyle.NONE, color: NAVY, size: 0 },
    },
    rows: [new TableRow({ children: [new TableCell({
      shading: { type: ShadingType.CLEAR, fill: NAVY },
      margins: { top: 220, bottom: 180, left: 220, right: 220 },
      children: [
        new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "PRO ALLEN  ·  SUPERVISÃO DE CAMPO", bold: true, color: YELLOW, size: 19, characterSpacing: 35 })] }),
        new Paragraph({ spacing: { after: 70 }, children: [new TextRun({ text: "RELATÓRIO DE ENCERRAMENTO DE TURNO", bold: true, color: "FFFFFF", size: 30 })] }),
        new Paragraph({ children: [new TextRun({ text: `${supervisorName}  ·  ${reportDate.toLocaleDateString("pt-BR")}  ·  Documento operacional`, color: "CBD5E1", size: 18 })] }),
      ],
    })] })],
  });
}

function sectionTitle(title: string, eyebrow: string) {
  return new Paragraph({ spacing: { before: 260, after: 90 }, keepNext: true, children: [new TextRun({ text: `${eyebrow.toUpperCase()}  /  `, bold: true, color: BLUE, size: 16 }), new TextRun({ text: title, bold: true, color: NAVY, size: 23 })] });
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
  const total = number(checklist?.total);
  const compliant = number(checklist?.compliant);
  const nonCompliant = number(checklist?.nonCompliant);
  const unanswered = number(checklist?.unanswered);
  if (!total) return "Checklist não iniciado";
  if (nonCompliant) return `${nonCompliant} não conforme(s)`;
  if (unanswered) return `${unanswered} sem resposta`;
  return `${compliant}/${total} conforme`;
}

export function createSupervisorShiftWordDocument(report: any) {
  const metrics = report.metrics ?? {};
  const reportDate = new Date(report.reportDate);
  const activities = report.activities ?? [];
  const visits = report.visits ?? [];
  const fuelLogs = report.fuelLogs ?? [];
  const observations = report.observations ?? [];
  const supervisorName = report.supervisor?.name ?? "Supervisor";
  const attentionCount = number(metrics.nonCompliantItems);
  const completedVisits = number(metrics.completedVisits);
  const totalVisits = number(metrics.totalVisits);
  const executiveSummary = `O turno de ${supervisorName} registrou ${completedVisits} visita(s) concluída(s) de ${totalVisits} prevista(s), ${number(metrics.coverageCount)} cobertura(s) ou atividade(s) na Base Operacional e ${formatKm(metrics.kmCovered)} percorridos. ${attentionCount ? `Foram identificados ${attentionCount} ponto(s) de atenção no checklist.` : "Não foram identificados pontos de atenção no checklist."}`;
  const activityRows = activities.map((activity: any) => [
    activityLabel(activity),
    statusLabel(activity.status),
    `Início: ${time(activity.startedAt ?? activity.shiftStartedAt)}\nTérmino: ${time(activity.completedAt)}`,
    `Inicial: ${formatKm(activity.kmInitial)}\nFinal: ${formatKm(activity.kmFinal)}\nPercorrido: ${formatKm(activity.kmCovered)}`,
  ]);
  const visitRows = visits.map((visit: any) => [
    `${text(visit.postName)}${visit.isCoverage ? `\n${visit.postName === "Base Operacional" ? "BASE OPERACIONAL" : "COBERTURA"}` : ""}\n${text(visit.routeName)}`,
    visitStatusLabel(visit.status),
    `Entrada: ${time(visit.arrivalTime)}\nSaída: ${time(visit.departureTime)}`,
    visit.isCoverage ? `Justificativa: ${text(visit.coverageReason)}\n${text(visit.observations)}` : text(visit.observations),
    checklistSummary(visit.checklistSummary),
  ]);
  const fuelRows = fuelLogs.map((fuel: any) => [
    time(fuel.createdAt),
    `${text(fuel.odometerKm)} km`,
    text(fuel.fuelType),
    `${formatCurrency(fuel.amount)}\n${number(fuel.liters).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} L`,
  ]);
  const occurrenceRows = observations.map((item: any) => [item.type === "coverage" ? "Cobertura / Base" : "Observação", text(item.postName), text(item.text)]);

  return new Document({
    creator: "Pro Allen",
    title: `Relatório de encerramento de turno - ${supervisorName}`,
    description: "Relatório operacional individual do supervisor",
    sections: [{
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "PRO ALLEN · USO INTERNO", color: MUTED, size: 14 })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Pro Allen · Gestão e Fiscalização Operacional em Campo", color: MUTED, size: 14 })] })] }) },
      properties: { page: { margin: { top: 720, right: 900, bottom: 720, left: 900 } } },
      children: [
        brandBanner(supervisorName, reportDate),
        new Paragraph({ spacing: { before: 160, after: 70 }, children: [new TextRun({ text: `Gerado em ${time(report.generatedAt)}  ·  Status do turno: `, color: MUTED, size: 17 }), new TextRun({ text: statusLabel(report.status), bold: true, color: report.status === "completed" ? GREEN : AMBER, size: 17 })] }),
        sectionTitle("Leitura executiva", "Visão geral"),
        new Paragraph({ spacing: { after: 130 }, children: [new TextRun({ text: executiveSummary, color: NAVY, size: 21 })] }),
        table(["Início", "Término", "KM percorrido", "Visitas", "Atenção"], [[time(report.startedAt), time(report.completedAt), formatKm(metrics.kmCovered), `${completedVisits}/${totalVisits}`, String(attentionCount)], ["Período operacional", report.shiftType === "night" ? "Noturno · 18h–06h" : "Diurno · 06h–18h", `KM ${formatKm(metrics.kmInitial)} → ${formatKm(metrics.kmFinal)}`, `${number(metrics.coverageCount)} cobertura(s)/base`, attentionCount ? "Revisar checklist" : "Sem pendências"]], [20, 20, 20, 20, 20]),
        sectionTitle("Atividades e horários", "Linha do tempo"),
        ...(activityRows.length ? [table(["Atividade", "Situação", "Janela", "Quilometragem"], activityRows, [26, 18, 28, 28])] : [new Paragraph({ children: [new TextRun({ text: "Nenhuma atividade registrada.", color: MUTED, italics: true })] })]),
        sectionTitle("Postos visitados, Base Operacional e coberturas", "Registros de campo"),
        ...(visitRows.length ? [table(["Posto / atividade", "Situação", "Entrada e saída", "Observações / justificativa", "Checklist"], visitRows, [23, 15, 22, 28, 12])] : [new Paragraph({ children: [new TextRun({ text: "Nenhum posto ou atividade de visita registrado neste turno.", color: MUTED, italics: true })] })]),
        sectionTitle("Abastecimentos", "Controle de frota"),
        ...(fuelRows.length ? [table(["Data", "Odômetro", "Combustível", "Valor / litros"], fuelRows, [27, 20, 23, 30])] : [new Paragraph({ children: [new TextRun({ text: `Nenhum abastecimento registrado. Total financeiro: ${formatCurrency(metrics.fuelAmount)}.`, color: MUTED, italics: true })] })]),
        sectionTitle("Ocorrências e observações", "Pontos de atenção"),
        ...(occurrenceRows.length ? [table(["Tipo", "Posto / atividade", "Registro"], occurrenceRows, [25, 25, 50])] : [new Paragraph({ children: [new TextRun({ text: "Nenhuma ocorrência ou observação registrada.", color: GREEN, italics: true })] })]),
        new Paragraph({ spacing: { before: 220, after: 90 }, children: [new TextRun({ text: "INDICADORES DE CONFERÊNCIA", bold: true, color: BLUE, size: 16 })] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({ children: [
            cell(`Abastecimentos\n${number(metrics.fuelCount)} registro(s) · ${formatCurrency(metrics.fuelAmount)}`, { shading: LIGHT, width: 33, bold: true }),
            cell(`Observações\n${number(metrics.observationCount)} registro(s) anotado(s)`, { shading: LIGHT, width: 34, bold: true }),
            cell(`Checklist\n${attentionCount ? `${attentionCount} ponto(s) para revisão` : "Sem não conformidades"}`, { shading: attentionCount ? ROSE_LIGHT : GREEN_LIGHT, width: 33, bold: true, color: attentionCount ? ROSE : GREEN }),
          ] })],
        }),
        new Paragraph({ spacing: { before: 260, after: 0 }, children: [new TextRun({ text: "Documento gerado automaticamente pelo sistema Pro Allen. Os horários, quilometragens, abastecimentos e registros apresentados correspondem às informações lançadas durante o turno.", color: MUTED, italics: true, size: 14 })] }),
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
