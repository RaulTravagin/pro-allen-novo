import type { jsPDF } from "jspdf";

/**
 * Geração de PDF operacional do Painel do Gestor.
 * A biblioteca é carregada sob demanda para não pesar no carregamento inicial do painel.
 */

export type PdfChecklistItem = {
  category?: string | null;
  description?: string | null;
  isCompliant?: boolean | null;
  notes?: string | null;
};

export type PdfVisit = {
  postName?: string | null;
  region?: string | null;
  status?: string | null;
  arrivalTime?: Date | string | null;
  departureTime?: Date | string | null;
  durationMinutes?: number | null;
  observations?: string | null;
  isCoverage?: boolean | null;
  coverageReason?: string | null;
  checklistItems?: PdfChecklistItem[] | null;
  photos?: Array<{ url?: string | null; caption?: string | null }> | null;
};

export type PdfRouteSection = {
  supervisorName: string;
  supervisorUsername?: string | null;
  routeName?: string | null;
  routeRegion?: string | null;
  shiftLabel?: string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  vehiclePlate?: string | null;
  vehicleModel?: string | null;
  kmInitial?: number | string | null;
  kmFinal?: number | string | null;
  kmCovered?: number | string | null;
  statusLabel?: string | null;
  visits: PdfVisit[];
};

export type PdfReportInput = {
  title: string;
  periodLabel: string;
  generatedAt?: Date;
  summaryLines?: string[];
  sections: PdfRouteSection[];
  fileName: string;
};

const BRAND = { name: "PRO ALLEN", subtitle: "Gestão e Fiscalização Operacional em Campo", credit: "CT3 Chults Travagin" };
const YELLOW: [number, number, number] = [250, 204, 21];
const BLACK: [number, number, number] = [15, 23, 42];
const GRAY: [number, number, number] = [100, 116, 139];

function textOrDash(value: unknown) {
  return value == null || value === "" ? "—" : String(value);
}

function formatDateTime(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function formatDuration(minutes: number | null | undefined) {
  if (minutes == null || !Number.isFinite(Number(minutes))) return "—";
  const total = Math.max(0, Math.round(Number(minutes)));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  return hours ? `${hours}h ${remainder}min` : `${remainder} min`;
}

function formatKm(value: number | string | null | undefined) {
  if (value == null || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toLocaleString("pt-BR")} km` : "—";
}

export function visitStatusLabel(status: string | null | undefined) {
  return ({ visited: "Concluído", in_progress: "Em atendimento", pending: "Pendente", skipped: "Não realizado" } as Record<string, string>)[status ?? ""] ?? "—";
}

export function checklistItemLabel(item: PdfChecklistItem) {
  if (item.isCompliant === true) return "Conforme";
  if (item.isCompliant === false) return "Não conforme";
  return "Sem resposta";
}

/** Converte imagens de auditoria em data URL para embutir no PDF sem depender do servidor. */
async function loadImageAsDataUrl(url: string) {
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawHeader(doc: jsPDF, input: PdfReportInput, generatedAt: Date) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageWidth, 30, "F");
  doc.setFillColor(...YELLOW);
  doc.rect(0, 30, pageWidth, 2, "F");
  doc.setTextColor(...YELLOW);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(BRAND.name, 14, 14);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(BRAND.subtitle, 14, 20);
  doc.text(input.title, 14, 25.5);
  doc.setFontSize(8);
  doc.text(`Emitido em ${generatedAt.toLocaleString("pt-BR")}`, pageWidth - 14, 14, { align: "right" });
  doc.text(input.periodLabel, pageWidth - 14, 19.5, { align: "right" });
  doc.text(BRAND.credit, pageWidth - 14, 25, { align: "right" });
}

function drawFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(`${BRAND.name} · Relatório operacional gerado pelo sistema`, 14, pageHeight - 9);
    doc.text(`Página ${page} de ${total}`, pageWidth - 14, pageHeight - 9, { align: "right" });
  }
}

export async function downloadOperationalReportPdf(input: PdfReportInput) {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const generatedAt = input.generatedAt ?? new Date();
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  let cursorY = 40;

  drawHeader(doc, input, generatedAt);

  const ensureSpace = (needed: number) => {
    if (cursorY + needed <= doc.internal.pageSize.getHeight() - 20) return;
    doc.addPage();
    drawHeader(doc, input, generatedAt);
    cursorY = 40;
  };

  if (input.summaryLines?.length) {
    ensureSpace(10 + input.summaryLines.length * 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BLACK);
    doc.text("Resumo do período", marginX, cursorY);
    cursorY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    for (const line of input.summaryLines) {
      const wrapped = doc.splitTextToSize(line, pageWidth - marginX * 2);
      ensureSpace(wrapped.length * 4.6);
      doc.text(wrapped, marginX, cursorY);
      cursorY += wrapped.length * 4.6;
    }
    cursorY += 4;
  }

  for (const section of input.sections) {
    ensureSpace(34);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX, cursorY - 4, pageWidth - marginX * 2, 26, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...BLACK);
    doc.text(section.supervisorName, marginX + 4, cursorY + 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    const routeLine = `${textOrDash(section.routeName)}${section.routeRegion ? ` · ${section.routeRegion}` : ""} · ${textOrDash(section.shiftLabel)}${section.statusLabel ? ` · ${section.statusLabel}` : ""}`;
    doc.text(routeLine, marginX + 4, cursorY + 9);
    const vehicleLine = `Viatura: ${textOrDash(section.vehiclePlate)}${section.vehicleModel ? ` (${section.vehicleModel})` : ""} · KM inicial: ${formatKm(section.kmInitial)} · KM final: ${formatKm(section.kmFinal)} · Percorrido: ${formatKm(section.kmCovered)}`;
    doc.text(vehicleLine, marginX + 4, cursorY + 14.5);
    doc.text(`Início: ${formatDateTime(section.startedAt)} · Encerramento: ${formatDateTime(section.completedAt)}`, marginX + 4, cursorY + 20);
    cursorY += 30;

    const visitRows = section.visits.map((visit) => [
      `${textOrDash(visit.postName)}${visit.isCoverage ? "\n(Cobertura)" : ""}${visit.region ? `\n${visit.region}` : ""}`,
      visitStatusLabel(visit.status),
      `Chegada: ${formatDateTime(visit.arrivalTime)}\nSaída: ${formatDateTime(visit.departureTime)}\nDuração: ${formatDuration(visit.durationMinutes)}`,
      `${visit.isCoverage && visit.coverageReason ? `Cobertura: ${visit.coverageReason}\n` : ""}${textOrDash(visit.observations)}`,
    ]);

    autoTable(doc, {
      startY: cursorY,
      head: [["Posto", "Situação", "Horários", "Observações da visita"]],
      body: visitRows.length ? visitRows : [["Nenhum posto registrado", "—", "—", "—"]],
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2, textColor: BLACK, lineColor: [226, 232, 240] },
      headStyles: { fillColor: BLACK, textColor: YELLOW, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 24 }, 2: { cellWidth: 48 }, 3: { cellWidth: "auto" } },
      margin: { left: marginX, right: marginX },
      didDrawPage: () => drawHeader(doc, input, generatedAt),
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

    for (const visit of section.visits) {
      const items = visit.checklistItems ?? [];
      const photos = (visit.photos ?? []).filter((photo) => photo?.url);
      if (!items.length && !photos.length) continue;

      ensureSpace(14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...BLACK);
      doc.text(`Auditoria do posto: ${textOrDash(visit.postName)}`, marginX, cursorY);
      cursorY += 3;

      if (items.length) {
        autoTable(doc, {
          startY: cursorY,
          head: [["Item verificado", "Resultado", "Anotação do supervisor"]],
          body: items.map((item) => [`${textOrDash(item.category)}${item.description ? ` · ${item.description}` : ""}`, checklistItemLabel(item), textOrDash(item.notes)]),
          theme: "striped",
          styles: { font: "helvetica", fontSize: 8, cellPadding: 2, textColor: BLACK, lineColor: [226, 232, 240] },
          headStyles: { fillColor: YELLOW, textColor: BLACK, fontStyle: "bold" },
          columnStyles: { 0: { cellWidth: 82 }, 1: { cellWidth: 28 }, 2: { cellWidth: "auto" } },
          margin: { left: marginX, right: marginX },
          didDrawPage: () => drawHeader(doc, input, generatedAt),
        });
        cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
      }

      if (photos.length) {
        ensureSpace(12);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...BLACK);
        doc.text("Registro fotográfico", marginX, cursorY);
        cursorY += 4;
        const imageWidth = 55;
        const imageHeight = 41;
        let columnX = marginX;
        for (const photo of photos) {
          const dataUrl = await loadImageAsDataUrl(String(photo.url));
          if (!dataUrl) continue;
          if (columnX + imageWidth > pageWidth - marginX) {
            columnX = marginX;
            cursorY += imageHeight + 8;
          }
          ensureSpace(imageHeight + 10);
          try {
            doc.addImage(dataUrl, "JPEG", columnX, cursorY, imageWidth, imageHeight, undefined, "FAST");
          } catch {
            continue;
          }
          if (photo.caption) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...GRAY);
            doc.text(doc.splitTextToSize(photo.caption, imageWidth), columnX, cursorY + imageHeight + 3.5);
          }
          columnX += imageWidth + 6;
        }
        cursorY += imageHeight + 10;
      }
    }

    cursorY += 4;
  }

  drawFooter(doc);
  doc.save(input.fileName);
}
