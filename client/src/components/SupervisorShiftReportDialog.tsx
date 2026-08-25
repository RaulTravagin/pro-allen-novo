import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, ClipboardList, Download, FileText, Fuel, Gauge, Loader2, MapPin, MessageCircle, Route, Share2, Timer, TrendingUp } from "lucide-react";
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

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function activityName(activity: any) {
  return activity.routeActivityType === "operational_base" ? "Base Operacional" : activity.routeName;
}

function statusLabel(status: string) {
  return ({ pending: "Aguardando início", in_progress: "Em andamento", completed: "Encerrada", cancelled: "Cancelada" } as Record<string, string>)[status] ?? status;
}

function statusStyle(status: string) {
  return status === "completed"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : status === "in_progress"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : status === "cancelled"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-slate-200 bg-slate-100 text-slate-700";
}

function visitStatusLabel(status: string) {
  return ({ visited: "Concluído", in_progress: "Em atendimento", pending: "Pendente", skipped: "Não realizado" } as Record<string, string>)[status] ?? status;
}

function visitStatusStyle(status: string) {
  return status === "visited"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : status === "in_progress"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : status === "skipped"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-slate-200 bg-slate-100 text-slate-700";
}

function checklistLabel(summary: any) {
  const total = number(summary?.total);
  const compliant = number(summary?.compliant);
  const nonCompliant = number(summary?.nonCompliant);
  const unanswered = number(summary?.unanswered);
  if (!total) return "Checklist não iniciado";
  if (nonCompliant) return `${nonCompliant} não conforme(s)`;
  if (unanswered) return `${unanswered} sem resposta`;
  return `${compliant}/${total} conforme`;
}

function checklistPercent(summary: any) {
  const total = number(summary?.total);
  if (!total) return 0;
  return Math.min(100, Math.round((number(summary?.compliant) / total) * 100));
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

function Kpi({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail?: string; icon: typeof Gauge; tone: "blue" | "amber" | "emerald" | "rose" }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return <div className={`rounded-xl border p-4 ${tones[tone]}`}><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold uppercase tracking-[0.14em]">{label}</span><Icon className="h-4 w-4" /></div><p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</p>{detail && <p className="mt-1 text-xs text-slate-600">{detail}</p>}</div>;
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
  const completedVisits = number(metrics.completedVisits);
  const totalVisits = number(metrics.totalVisits);
  const visitProgress = totalVisits ? Math.min(100, Math.round((completedVisits / totalVisits) * 100)) : 0;
  const attentionCount = number(metrics.nonCompliantItems);

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
      <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto border-0 bg-slate-50 p-0 text-slate-950 shadow-2xl">
        <div className="border-b-4 border-amber-400 bg-slate-950 px-6 py-6 text-white sm:px-8">
          <DialogHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300">Pro Allen · Supervisão de campo</p>
                <DialogTitle className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{isClosed ? "Relatório de encerramento" : "Conferência do turno"}</DialogTitle>
                <DialogDescription className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{report ? `Compilação operacional de ${report.supervisor?.name ?? "supervisor"}. Confira os registros antes de encerrar e gerar o documento final.` : "Consolidando os registros do turno..."}</DialogDescription>
              </div>
              {report && <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${report.status === "completed" ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-200" : report.status === "in_progress" ? "border-amber-300/40 bg-amber-300/15 text-amber-200" : "border-slate-500/50 bg-slate-700/50 text-slate-200"}`}><span className="h-2 w-2 rounded-full bg-current" />{statusLabel(report.status)}</span>}
            </div>
          </DialogHeader>
        </div>

        {isLoading || !report ? <div className="flex items-center justify-center gap-2 px-6 py-20 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-blue-700" /> Compilando relatório do turno...</div> : <div className="space-y-6 px-6 py-6 sm:px-8">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores do turno">
            <Kpi label="KM percorrido" value={formatKm(metrics.kmCovered)} detail={`${formatKm(metrics.kmInitial)} → ${formatKm(metrics.kmFinal)}`} icon={TrendingUp} tone="blue" />
            <Kpi label="Visitas concluídas" value={`${completedVisits}/${totalVisits}`} detail={`${visitProgress}% da jornada registrada`} icon={CheckCircle2} tone="emerald" />
            <Kpi label="Coberturas / base" value={String(number(metrics.coverageCount))} detail={`${number(metrics.observationCount)} observação(ões)`} icon={Route} tone="amber" />
            <Kpi label="Pontos de atenção" value={String(attentionCount)} detail={`${number(metrics.pendingVisits)} visita(s) pendente(s)`} icon={attentionCount ? AlertTriangle : CheckCircle2} tone={attentionCount ? "rose" : "emerald"} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Leitura rápida</p><h3 className="mt-1 text-lg font-bold text-slate-950">Visão geral da jornada</h3></div><p className="text-xs text-slate-500">Atualizado em {formatDateTime(report.generatedAt)}</p></div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex items-center justify-between text-xs font-semibold text-slate-600"><span>Progresso das visitas</span><span>{completedVisits} de {totalVisits} concluída(s)</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-700 transition-all" style={{ width: `${visitProgress}%` }} /></div></div><div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-600"><span><strong className="text-slate-950">{number(metrics.fuelCount)}</strong> abastecimento(s)</span><span><strong className="text-slate-950">{formatCurrency(metrics.fuelAmount)}</strong> em combustível</span><span><strong className="text-slate-950">{number(metrics.nonCompliantItems)}</strong> não conforme(s)</span><span><strong className="text-slate-950">{number(metrics.pendingVisits)}</strong> pendente(s)</span></div></div>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Linha do tempo</p><h3 className="mt-1 text-lg font-bold text-slate-950">Atividades e horários</h3></div><span className="text-xs text-slate-500">{activities.length} atividade(s)</span></div>
            <div className="space-y-3">{activities.map((activity: any, index: number) => <div key={activity.id} className="relative flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:gap-4 sm:p-5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-amber-300">{String(index + 1).padStart(2, "0")}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-bold text-slate-950">{activityName(activity)}</h4><p className="mt-1 text-xs text-slate-500">{activity.routeRegion || "Região não informada"}</p></div><span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusStyle(activity.status)}`}>{statusLabel(activity.status)}</span></div><div className="mt-4 grid gap-3 text-xs sm:grid-cols-3"><div className="flex items-start gap-2"><Timer className="mt-0.5 h-4 w-4 text-blue-700" /><span><strong className="block text-slate-700">Janela da atividade</strong><span className="text-slate-500">{formatDateTime(activity.startedAt ?? activity.shiftStartedAt)} → {formatDateTime(activity.completedAt)}</span></span></div><div className="flex items-start gap-2"><Gauge className="mt-0.5 h-4 w-4 text-amber-600" /><span><strong className="block text-slate-700">Quilometragem</strong><span className="text-slate-500">{formatKm(activity.kmInitial)} → {formatKm(activity.kmFinal)} · {formatKm(activity.kmCovered)}</span></span></div><div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-emerald-700" /><span><strong className="block text-slate-700">Tipo de operação</strong><span className="text-slate-500">{activity.routeActivityType === "operational_base" ? "Atividade interna" : "Rota de campo"}</span></span></div></div></div></div>)}</div>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Registros de campo</p><h3 className="mt-1 text-lg font-bold text-slate-950">Postos, Base Operacional e coberturas</h3></div><span className="text-xs text-slate-500">{visits.length} registro(s)</span></div>
            {visits.length ? <div className="space-y-3">{visits.map((visit: any) => <article key={visit.id} className={`rounded-2xl border-l-4 bg-white p-4 shadow-sm sm:p-5 ${visit.isCoverage ? "border-l-amber-400" : visit.status === "visited" ? "border-l-emerald-500" : "border-l-slate-300"}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${visit.isCoverage ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}><MapPin className="h-4 w-4" /></div><div><h4 className="font-bold text-slate-950">{visit.postName}</h4><p className="mt-1 text-xs text-slate-500">{visit.routeName} · {visit.postRegion || "Região não informada"}</p></div></div><span className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-bold ${visitStatusStyle(visit.status)}`}>{visitStatusLabel(visit.status)}</span></div><div className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-3 text-slate-600"><strong className="block text-slate-700">Atendimento</strong><span>Entrada: {formatDateTime(visit.arrivalTime)}</span><br /><span>Saída: {formatDateTime(visit.departureTime)}</span></div><div className="rounded-lg bg-slate-50 p-3 text-slate-600"><strong className="block text-slate-700">Checklist</strong><span>{checklistLabel(visit.checklistSummary)}</span><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${visit.checklistSummary?.nonCompliant ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${checklistPercent(visit.checklistSummary)}%` }} /></div></div></div>{visit.isCoverage && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950"><strong>{visit.postName === "Base Operacional" ? "Motivo da atividade" : "Justificativa da cobertura"}:</strong> {visit.coverageReason || "Não informado"}</div>}{visit.observations && <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700"><strong>Observação:</strong> {visit.observations}</div>}</article>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Nenhum posto ou atividade de visita registrado neste turno.</div>}
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="border-emerald-200 bg-white shadow-sm"><CardHeader className="border-b border-emerald-100 pb-3"><CardTitle className="flex items-center gap-2 text-base"><Fuel className="h-4 w-4 text-emerald-700" /> Abastecimentos <span className="ml-auto text-xs font-normal text-slate-500">{fuelLogs.length} registro(s)</span></CardTitle></CardHeader><CardContent className="p-4">{fuelLogs.length ? <div className="space-y-2">{fuelLogs.map((fuel: any) => <div key={fuel.id} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs"><span className="text-slate-700">{formatDateTime(fuel.createdAt)}<br /><span className="text-slate-500">{fuel.fuelType} · {formatKm(fuel.odometerKm)}</span></span><span className="text-right font-bold text-emerald-900">{formatCurrency(fuel.amount)}<br /><span className="font-normal text-slate-500">{number(fuel.liters).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} L</span></span></div>)}</div> : <p className="py-4 text-sm text-slate-500">Nenhum abastecimento registrado.</p>}<div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs"><span className="text-slate-500">Total do turno</span><strong className="text-slate-950">{formatCurrency(metrics.fuelAmount)}</strong></div></CardContent></Card>
            <Card className={`${attentionCount ? "border-rose-200" : "border-slate-200"} bg-white shadow-sm`}><CardHeader className={`border-b pb-3 ${attentionCount ? "border-rose-100" : "border-slate-100"}`}><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className={`h-4 w-4 ${attentionCount ? "text-rose-700" : "text-slate-500"}`} /> Ocorrências e observações <span className="ml-auto text-xs font-normal text-slate-500">{observations.length} registro(s)</span></CardTitle></CardHeader><CardContent className="p-4">{observations.length ? <div className="space-y-2">{observations.map((item: any, index: number) => <div key={`${item.type}-${item.postName}-${index}`} className={`rounded-xl border p-3 text-xs leading-5 ${item.type === "coverage" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-slate-700"}`}><strong>{item.type === "coverage" ? "Cobertura/Base Operacional" : "Observação"} · {item.postName}:</strong> {item.text}</div>)}</div> : <div className="flex items-center gap-2 py-4 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Nenhuma ocorrência ou observação registrada.</div>}<p className={`mt-4 border-t pt-3 text-xs ${attentionCount ? "border-rose-100 text-rose-700" : "border-slate-100 text-slate-500"}`}><strong>{attentionCount}</strong> não conformidade(s) identificada(s) no checklist.</p></CardContent></Card>
          </div>

          {!isClosed && canClose && <section className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-800">Última conferência</p><h3 className="mt-1 text-base font-bold text-amber-950">Informe o KM final para encerrar</h3><p className="mt-1 max-w-xl text-xs leading-5 text-amber-900">Após confirmar, a rota será marcada como encerrada e o relatório ficará pronto para baixar ou compartilhar.</p></div><label className="grid min-w-[220px] gap-1 text-xs font-bold text-amber-950">Leitura final do odômetro<input type="number" inputMode="decimal" min={metrics.kmInitial ?? 0} value={kmFinal} onChange={(event) => setKmFinal(event.target.value)} placeholder="Ex.: 15050" className="mt-1 h-11 rounded-xl border border-amber-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200" /></label></div></section>}
        </div>}

        <DialogFooter className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4 sm:px-8">
          <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={handleExportPdf} disabled={!report || isLoading || Boolean(isExporting) || isClosing} className="gap-2 border-slate-300"><Download className="h-4 w-4 text-blue-700" />{isExporting === "pdf" ? "Gerando PDF..." : "Baixar PDF"}</Button><Button type="button" variant="outline" onClick={handleExportWord} disabled={!report || isLoading || Boolean(isExporting) || isClosing} className="gap-2 border-slate-300"><FileText className="h-4 w-4 text-blue-700" />{isExporting === "word" ? "Gerando Word..." : "Baixar Word"}</Button><Button type="button" variant="outline" onClick={handleShare} disabled={!report || isLoading || isClosing} className="gap-2 border-emerald-200 text-emerald-800 hover:bg-emerald-50"><MessageCircle className="h-4 w-4" />WhatsApp</Button></div>
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isClosing}>{isClosed ? "Fechar relatório" : "Voltar"}</Button>{!isClosed && canClose && <Button type="button" onClick={handleConfirm} disabled={isClosing || isLoading} className="gap-2 bg-blue-700 font-bold text-white shadow-sm hover:bg-blue-800">{isClosing ? <><Loader2 className="h-4 w-4 animate-spin" /> Encerrando...</> : <><Share2 className="h-4 w-4" /> Confirmar e gerar relatório</>}</Button>}</div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
