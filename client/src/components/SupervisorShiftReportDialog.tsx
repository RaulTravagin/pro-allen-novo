import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, Download, FileText, Fuel, Gauge, Loader2, MessageCircle, Route, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { buildSupervisorShiftPdfInput } from "@/lib/supervisorShiftReportAdapters";
import { downloadOperationalReportPdf } from "@/lib/operationalReportPdf";
import { downloadSupervisorShiftWord } from "@/lib/supervisorShiftReportDocx";

interface SupervisorShiftReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: any | null;
  isLoading?: boolean;
  isClosing?: boolean;
  initialKmFinal?: string;
  canClose?: boolean;
  onConfirmClose: (kmFinal: number) => Promise<void>;
}

function formatDateTime(value: unknown) {
  return value ? new Date(value as string | Date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function formatKm(value: unknown) {
  if (value == null || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toLocaleString("pt-BR")} km` : "—";
}

function formatCurrency(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
}

function activityName(activity: any) {
  return activity.routeActivityType === "operational_base" ? "Base Operacional" : activity.routeName;
}

function statusLabel(status: string) {
  return ({ pending: "Aguardando início", in_progress: "Em andamento", completed: "Encerrada", cancelled: "Cancelada" } as Record<string, string>)[status] ?? status;
}

function visitStatusLabel(status: string) {
  return ({ visited: "Concluído", in_progress: "Em atendimento", pending: "Pendente", skipped: "Não realizado" } as Record<string, string>)[status] ?? status;
}

function shareText(report: any) {
  const metrics = report.metrics ?? {};
  const activities = (report.activities ?? []).map((activity: any) => `${activityName(activity)} (${statusLabel(activity.status)})`).join("; ");
  const visits = (report.visits ?? []).map((visit: any) => `${visit.postName}: ${visitStatusLabel(visit.status)}${visit.isCoverage ? ` — ${visit.coverageReason}` : ""}`).join("; ");
  return [
    `Relatório de turno — ${report.supervisor?.name ?? "Supervisor"}`,
    `Início: ${formatDateTime(report.startedAt)} | Término: ${formatDateTime(report.completedAt)}`,
    `KM: ${formatKm(metrics.kmInitial)} → ${formatKm(metrics.kmFinal)} (${formatKm(metrics.kmCovered)})`,
    `Atividades: ${activities || "—"}`,
    `Visitas: ${visits || "Nenhuma"}`,
    `Abastecimentos: ${metrics.fuelCount ?? 0} | Ocorrências: ${metrics.nonCompliantItems ?? 0}`,
  ].join("\n");
}

export default function SupervisorShiftReportDialog({ open, onOpenChange, report, isLoading = false, isClosing = false, initialKmFinal = "", canClose = false, onConfirmClose }: SupervisorShiftReportDialogProps) {
  const [kmFinal, setKmFinal] = useState(initialKmFinal);
  const [isExporting, setIsExporting] = useState<"pdf" | "word" | null>(null);

  useEffect(() => {
    if (open) setKmFinal(initialKmFinal || (report?.metrics?.kmFinal != null ? String(report.metrics.kmFinal) : ""));
  }, [initialKmFinal, open, report?.metrics?.kmFinal]);

  const isClosed = report?.status === "completed" || report?.status === "cancelled";
  const metrics = report?.metrics ?? {};
  const visits = report?.visits ?? [];
  const activities = report?.activities ?? [];
  const fuelLogs = report?.fuelLogs ?? [];
  const observations = report?.observations ?? [];

  const handleExportPdf = async () => {
    if (!report) return;
    setIsExporting("pdf");
    try {
      await downloadOperationalReportPdf(buildSupervisorShiftPdfInput(report));
      toast.success("Relatório PDF baixado com sucesso");
    } catch (error) {
      console.error("Supervisor shift PDF export error:", error);
      toast.error("Não foi possível gerar o PDF do turno");
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportWord = async () => {
    if (!report) return;
    setIsExporting("word");
    try {
      await downloadSupervisorShiftWord(report);
      toast.success("Relatório Word baixado com sucesso");
    } catch (error) {
      console.error("Supervisor shift Word export error:", error);
      toast.error("Não foi possível gerar o Word do turno");
    } finally {
      setIsExporting(null);
    }
  };

  const handleShare = () => {
    if (!report) return;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText(report))}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const handleConfirm = async () => {
    const parsedKmFinal = Number(kmFinal.replace(",", "."));
    const kmInitial = Number(metrics.kmInitial);
    if (!Number.isFinite(parsedKmFinal) || parsedKmFinal < 0) {
      toast.error("Informe um KM final válido para encerrar o turno");
      return;
    }
    if (Number.isFinite(kmInitial) && parsedKmFinal < kmInitial) {
      toast.error("O KM final não pode ser menor que o KM inicial");
      return;
    }
    await onConfirmClose(parsedKmFinal);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-950"><ClipboardList className="h-5 w-5 text-blue-700" /> {isClosed ? "Relatório do turno" : "Confirmar encerramento do turno"}</DialogTitle>
          <DialogDescription>
            {report ? `Confira a compilação da jornada de ${report.supervisor?.name ?? "supervisor"} antes de finalizar o turno.` : "Consolidando os registros do turno..."}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !report ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Compilando relatório do turno...</div> : <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-blue-100 bg-blue-50/70"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Início</p><p className="mt-2 font-semibold text-slate-950">{formatDateTime(report.startedAt)}</p></CardContent></Card>
            <Card className="border-blue-100 bg-blue-50/70"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Término</p><p className="mt-2 font-semibold text-slate-950">{formatDateTime(report.completedAt)}</p></CardContent></Card>
            <Card className="border-amber-100 bg-amber-50/70"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Quilometragem</p><p className="mt-2 font-semibold text-slate-950">{formatKm(metrics.kmCovered)}</p><p className="mt-1 text-xs text-slate-600">{formatKm(metrics.kmInitial)} → {formatKm(metrics.kmFinal)}</p></CardContent></Card>
            <Card className="border-violet-100 bg-violet-50/70"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Situação</p><p className="mt-2 font-semibold text-slate-950">{statusLabel(report.status)}</p><p className="mt-1 text-xs text-slate-600">{metrics.totalVisits ?? 0} visita(s) · {metrics.coverageCount ?? 0} cobertura(s)</p></CardContent></Card>
          </div>

          <Card className="border-slate-200"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Route className="h-4 w-4 text-blue-700" /> Atividades e horários</CardTitle></CardHeader><CardContent className="space-y-2">{activities.map((activity: any) => <div key={activity.id} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-[1.2fr_.8fr_1.4fr_1fr] sm:items-center"><p className="font-semibold text-slate-950">{activityName(activity)}<span className="block text-xs font-normal text-slate-500">{activity.routeRegion}</span></p><p className="text-slate-700">{statusLabel(activity.status)}</p><p className="text-xs text-slate-600">Início: {formatDateTime(activity.startedAt ?? activity.shiftStartedAt)}<br />Fim: {formatDateTime(activity.completedAt)}</p><p className="text-xs text-slate-600">Inicial: {formatKm(activity.kmInitial)}<br />Final: {formatKm(activity.kmFinal)}</p></div>)}</CardContent></Card>

          <Card className="border-slate-200"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4 text-blue-700" /> Postos visitados, Base Operacional e coberturas</CardTitle></CardHeader><CardContent>{visits.length ? <div className="space-y-2">{visits.map((visit: any) => <div key={visit.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-slate-950">{visit.postName}</p><p className="text-xs text-slate-500">{visit.routeName} · {visit.postRegion}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{visitStatusLabel(visit.status)}</span></div><p className="mt-2 text-xs text-slate-600">Entrada: {formatDateTime(visit.arrivalTime)} · Saída: {formatDateTime(visit.departureTime)}</p>{visit.isCoverage && <p className="mt-2 rounded-md border border-violet-100 bg-violet-50 p-2 text-xs text-violet-950"><strong>{visit.postName === "Base Operacional" ? "Motivo da atividade:" : "Justificativa da cobertura:"}</strong> {visit.coverageReason || "Não informado"}</p>}{visit.observations && <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-700"><strong>Observação:</strong> {visit.observations}</p>}</div>)}</div> : <p className="text-sm text-slate-500">Nenhum posto ou atividade de visita registrado neste turno.</p>}</CardContent></Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="border-emerald-100"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Fuel className="h-4 w-4 text-emerald-700" /> Abastecimentos</CardTitle></CardHeader><CardContent>{fuelLogs.length ? <div className="space-y-2">{fuelLogs.map((fuel: any) => <div key={fuel.id} className="flex items-center justify-between gap-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-xs"><span>{formatDateTime(fuel.createdAt)} · {fuel.fuelType}</span><span className="text-right font-semibold">{formatCurrency(fuel.amount)} · {Number(fuel.liters ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} L<br /><span className="font-normal text-slate-500">{formatKm(fuel.odometerKm)}</span></span></div>)}</div> : <p className="text-sm text-slate-500">Nenhum abastecimento registrado.</p>}<p className="mt-3 text-xs text-slate-600">Total: {metrics.fuelCount ?? 0} abastecimento(s) · {formatCurrency(metrics.fuelAmount)}</p></CardContent></Card>
            <Card className="border-rose-100"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4 text-rose-700" /> Ocorrências e observações</CardTitle></CardHeader><CardContent>{observations.length ? <div className="space-y-2">{observations.map((item: any, index: number) => <div key={`${item.type}-${item.postName}-${index}`} className="rounded-lg border border-rose-100 bg-rose-50/50 p-3 text-xs text-slate-700"><strong>{item.type === "coverage" ? "Cobertura/Base Operacional" : "Observação"} · {item.postName}:</strong> {item.text}</div>)}</div> : <p className="text-sm text-slate-500">Nenhuma ocorrência ou observação registrada.</p>}<p className="mt-3 text-xs text-slate-600">Não conformidades no checklist: {metrics.nonCompliantItems ?? 0}</p></CardContent></Card>
          </div>

          {!isClosed && canClose && <Card className="border-amber-200 bg-amber-50/60"><CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-end"><label className="grid gap-1 text-sm font-semibold text-amber-950">KM final para encerrar o turno<input type="number" inputMode="decimal" min={metrics.kmInitial ?? 0} value={kmFinal} onChange={(event) => setKmFinal(event.target.value)} placeholder="Ex.: 15050" className="mt-1 h-10 rounded-md border border-amber-300 bg-white px-3 font-normal text-slate-900 outline-none focus:ring-2 focus:ring-amber-600" /></label><p className="text-xs leading-5 text-amber-900">Após confirmar, a rota será encerrada no banco e este relatório ficará disponível para download.</p></CardContent></Card>}
        </div>}

        <DialogFooter className="gap-2 sm:flex-wrap sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleExportPdf} disabled={!report || isLoading || Boolean(isExporting) || isClosing} className="gap-2"><Download className="h-4 w-4" />{isExporting === "pdf" ? "Gerando PDF..." : "Baixar PDF"}</Button>
            <Button type="button" variant="outline" onClick={handleExportWord} disabled={!report || isLoading || Boolean(isExporting) || isClosing} className="gap-2"><FileText className="h-4 w-4" />{isExporting === "word" ? "Gerando Word..." : "Baixar Word"}</Button>
            <Button type="button" variant="outline" onClick={handleShare} disabled={!report || isLoading || isClosing} className="gap-2 border-emerald-200 text-emerald-800 hover:bg-emerald-50"><MessageCircle className="h-4 w-4" />Compartilhar WhatsApp</Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isClosing}>{isClosed ? "Fechar" : "Cancelar"}</Button>
            {!isClosed && canClose && <Button type="button" onClick={handleConfirm} disabled={isClosing || isLoading} className="gap-2 bg-blue-700 text-white hover:bg-blue-800">{isClosing ? <><Loader2 className="h-4 w-4 animate-spin" /> Encerrando...</> : <><Share2 className="h-4 w-4" /> Confirmar encerramento</>}</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
