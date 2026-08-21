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
  auditSubmittedAt?: Date | string | null;
  durationMinutes?: number | null;
  observations?: string | null;
  isCoverage?: boolean | null;
  coverageReason?: string | null;
  arrivalLatitude?: number | string | null;
  arrivalLongitude?: number | string | null;
  departureLatitude?: number | string | null;
  departureLongitude?: number | string | null;
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
  plannedPosts?: number | null;
  visits: PdfVisit[];
};

export type PdfReportInput = {
  title: string;
  periodLabel: string;
  generatedAt?: Date;
  contextLines?: string[];
  executiveMetrics?: Array<{ label: string; value: string; alert?: boolean }>;
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

function formatCoordinates(latitude: number | string | null | undefined, longitude: number | string | null | undefined) {
  if (latitude == null || longitude == null) return "Não registrado";
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Não registrado";
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

function drawContextBlock(doc: jsPDF, input: PdfReportInput, startY: number, pageWidth: number, marginX: number) {
  let cursorY = startY;
  if (input.contextLines?.length) {
    const contextHeight = Math.max(17, 9 + input.contextLines.length * 4.5);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(marginX, cursorY, pageWidth - marginX * 2, contextHeight, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...BLACK);
    doc.text("CONTEXTO DA EXTRAÇÃO", marginX + 4, cursorY + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    let lineY = cursorY + 10;
    for (const line of input.contextLines) {
      const wrapped = doc.splitTextToSize(line, pageWidth - marginX * 2 - 8);
      doc.text(wrapped, marginX + 4, lineY);
      lineY += wrapped.length * 3.8;
    }
    cursorY += contextHeight + 5;
  }

  if (input.executiveMetrics?.length) {
    const metrics = input.executiveMetrics.slice(0, 4);
    const gap = 3;
    const cardWidth = (pageWidth - marginX * 2 - gap * (metrics.length - 1)) / metrics.length;
    const cardHeight = 23;
    for (let index = 0; index < metrics.length; index += 1) {
      const metric = metrics[index]!;
      const cardX = marginX + index * (cardWidth + gap);
      doc.setFillColor(...(metric.alert ? [254, 242, 242] as [number, number, number] : [255, 255, 255] as [number, number, number]));
      doc.setDrawColor(...(metric.alert ? [252, 165, 165] as [number, number, number] : [203, 213, 225] as [number, number, number]));
      doc.roundedRect(cardX, cursorY, cardWidth, cardHeight, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      doc.setTextColor(...(metric.alert ? [185, 28, 28] as [number, number, number] : GRAY));
      doc.text(metric.label.toUpperCase(), cardX + 3, cursorY + 6);
      doc.setFontSize(11);
      doc.setTextColor(...BLACK);
      doc.text(metric.value, cardX + 3, cursorY + 15);
    }
    cursorY += cardHeight + 6;
  }
  return cursorY;
}

function drawOccurrenceBlock(doc: jsPDF, lines: string[], startY: number, pageWidth: number, marginX: number) {
  const wrappedLines = lines.flatMap((line) => doc.splitTextToSize(line, pageWidth - marginX * 2 - 10));
  const height = Math.max(13, 8 + wrappedLines.length * 4);
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(248, 113, 113);
  doc.roundedRect(marginX, startY, pageWidth - marginX * 2, height, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(185, 28, 28);
  doc.text("OCORRÊNCIA / PENDÊNCIA REQUER ATENÇÃO", marginX + 4, startY + 5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BLACK);
  doc.setFontSize(8);
  doc.text(wrappedLines, marginX + 4, startY + 10);
  return height;
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

  cursorY = drawContextBlock(doc, input, cursorY, pageWidth, marginX);

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

    const chronologicalVisits = [...section.visits].sort((first, second) => {
      const firstTime = new Date(first.arrivalTime ?? first.auditSubmittedAt ?? 0).getTime();
      const secondTime = new Date(second.arrivalTime ?? second.auditSubmittedAt ?? 0).getTime();
      return firstTime - secondTime;
    });
    const visitRows = chronologicalVisits.map((visit) => [
      `${textOrDash(visit.postName)}${visit.isCoverage ? "\n(Cobertura)" : ""}${visit.region ? `\n${visit.region}` : ""}`,
      visitStatusLabel(visit.status),
      `Chegada: ${formatDateTime(visit.arrivalTime)}\nSaída: ${formatDateTime(visit.departureTime)}\nDuração: ${formatDuration(visit.durationMinutes)}`,
      `Envio: ${formatDateTime(visit.auditSubmittedAt)}\n${visit.isCoverage && visit.coverageReason ? `Cobertura: ${visit.coverageReason}\n` : ""}${textOrDash(visit.observations)}`,
    ]);

    autoTable(doc, {
      startY: cursorY,
      head: [["Posto", "Situação", "Atendimento", "Envio e observações"]],
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

    for (const visit of chronologicalVisits) {
      const items = visit.checklistItems ?? [];
      const photos = (visit.photos ?? []).filter((photo) => photo?.url);
      const nonCompliantItems = items.filter((item) => item.isCompliant === false);
      const occurrenceLines = [
        ...(nonCompliantItems.length ? [`${nonCompliantItems.length} item(ns) não conforme(s) identificado(s).`] : []),
        ...nonCompliantItems.map((item) => `${textOrDash(item.description)}${item.notes ? `: ${item.notes}` : ""}`),
        ...(visit.isCoverage && visit.coverageReason ? [`Cobertura justificada: ${visit.coverageReason}`] : []),
      ];
      if (!items.length && !photos.length && !occurrenceLines.length) continue;

      ensureSpace(28);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(marginX, cursorY, pageWidth - marginX * 2, 20, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...BLACK);
      doc.text(`VISTORIA DETALHADA · ${textOrDash(visit.postName)}`, marginX + 4, cursorY + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...GRAY);
      doc.text(`Envio: ${formatDateTime(visit.auditSubmittedAt)} · Chegada: ${formatDateTime(visit.arrivalTime)} · Saída: ${formatDateTime(visit.departureTime)}`, marginX + 4, cursorY + 11);
      doc.text(`GPS chegada: ${formatCoordinates(visit.arrivalLatitude, visit.arrivalLongitude)} · GPS saída: ${formatCoordinates(visit.departureLatitude, visit.departureLongitude)}`, marginX + 4, cursorY + 15.5);
      cursorY += 25;

      if (occurrenceLines.length) {
        ensureSpace(20 + occurrenceLines.length * 4);
        cursorY += drawOccurrenceBlock(doc, occurrenceLines, cursorY, pageWidth, marginX) + 5;
      }

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
        const imageWidth = (pageWidth - marginX * 2 - 6) / 2;
        const imageHeight = 46;
        const loadedPhotos: Array<{ dataUrl: string; caption?: string | null }> = [];
        for (const photo of photos) {
          const dataUrl = await loadImageAsDataUrl(String(photo.url));
          if (!dataUrl) continue;
          loadedPhotos.push({ dataUrl, caption: photo.caption });
        }
        const photoRows = Math.ceil(loadedPhotos.length / 2);
        ensureSpace(photoRows * (imageHeight + 10) + 6);
        for (let index = 0; index < loadedPhotos.length; index += 1) {
          const photo = loadedPhotos[index]!;
          const column = index % 2;
          const row = Math.floor(index / 2);
          const columnX = marginX + column * (imageWidth + 6);
          const imageY = cursorY + row * (imageHeight + 10);
          try {
            doc.addImage(photo.dataUrl, "JPEG", columnX, imageY, imageWidth, imageHeight, undefined, "FAST");
          } catch {
            continue;
          }
          if (photo.caption) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...GRAY);
            doc.text(doc.splitTextToSize(photo.caption, imageWidth), columnX, imageY + imageHeight + 3.5);
          }
        }
        cursorY += photoRows * (imageHeight + 10) + 4;
      }
    }

    cursorY += 4;
  }

  drawFooter(doc);
  doc.save(input.fileName);
}
