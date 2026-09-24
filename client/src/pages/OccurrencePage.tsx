import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, CheckCircle2, Clock, MapPin, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { clearOccurrenceDraft, readOccurrenceDraft, saveOccurrenceDraft } from "@/lib/onlineOperationDraft";
import { notifySupervisorError, supervisorErrorMessage } from "@/lib/networkFeedback";

interface OccurrencePageProps {
  params: {
    visitId: string;
  };
}

function formatDateTime(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Ainda não registrado";
}

function calculateDuration(start: Date | string | null | undefined, end: Date | string | null | undefined) {
  if (!start || !end) return null;
  const diffMinutes = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function OccurrencePage({ params }: OccurrencePageProps) {
  const { user, logout } = useAuth();
  const visitId = Number.parseInt(params.visitId, 10);
  const [occurrenceReport, setOccurrenceReport] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const utils = trpc.useUtils();
  const occurrenceQuery = trpc.checklists.getById.useQuery({ id: visitId }, { retry: false });
  const submitOccurrenceMutation = trpc.checklists.submitOccurrence.useMutation();
  const { data: visit, isLoading, error } = occurrenceQuery;

  useEffect(() => {
    if (!visit) return;
    const draft = user?.id ? readOccurrenceDraft(user.id, visit.id) : null;
    setOccurrenceReport(draft?.occurrenceReport ?? visit.occurrenceReport ?? "");
    setDraftLoaded(true);
  }, [visit?.id, user?.id]);

  useEffect(() => {
    if (!visit || !user?.id || !draftLoaded) return;
    saveOccurrenceDraft(user.id, visit.id, { occurrenceReport });
  }, [draftLoaded, occurrenceReport, user?.id, visit?.id]);

  const handleSubmit = async () => {
    const report = occurrenceReport.trim();
    if (report.length < 8) {
      toast.error("Descreva a ocorrência ou o relatório da visita com pelo menos 8 caracteres.");
      return;
    }
    try {
      await submitOccurrenceMutation.mutateAsync({ checklistId: visitId, occurrenceReport: report });
      if (user?.id) clearOccurrenceDraft(user.id, visitId);
      await utils.checklists.getById.invalidate({ id: visitId });
      toast.success("Ocorrência enviada ao Gestor com sucesso.");
      if (visit?.supervisorRouteId) window.location.href = `/supervisor/route/${visit.supervisorRouteId}`;
    } catch (submissionError) {
      notifySupervisorError(submissionError, "Não foi possível enviar a ocorrência");
    }
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  if (!visit) {
    return <div className="min-h-screen bg-slate-50 p-4"><div className="mx-auto max-w-3xl"><Button onClick={() => window.history.back()} variant="outline" className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button><Card className="border-rose-200 bg-rose-50"><CardHeader><CardTitle className="text-rose-900">{error ? "Falha de conexão" : "Visita não encontrada"}</CardTitle><CardDescription className="text-rose-800">{error ? supervisorErrorMessage(error, "Não foi possível carregar o registro da visita.") : "Não foi possível localizar esta visita."}</CardDescription></CardHeader>{error && <CardContent><Button type="button" variant="outline" onClick={() => void occurrenceQuery.refetch()} className="border-rose-300 bg-white text-rose-900">Tentar novamente</Button></CardContent>}</Card></div></div>;
  }

  const duration = calculateDuration(visit.arrivalTime, visit.departureTime);
  const isReadyToReport = visit.status === "in_progress" || visit.status === "visited";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-5">
          <div className="flex items-center gap-3"><Button onClick={() => window.history.back()} variant="ghost" size="icon" aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Button><div><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Registro obrigatório da visita</p><h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Ocorrência ou relatório da visita</h1></div></div>
          <Button onClick={() => void logout()} variant="outline" size="sm">Sair</Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <Card className="border-blue-200 bg-white shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-blue-950"><MapPin className="h-5 w-5 text-blue-700" />Posto #{visit.postId}</CardTitle><CardDescription>Descreva de forma objetiva o que foi observado, realizado ou encaminhado no posto. Este registro ficará disponível para o Gestor e é obrigatório para concluir a visita.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-blue-100 bg-blue-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Entrada</p><p className="mt-1 font-mono text-sm text-blue-950">{formatDateTime(visit.arrivalTime)}</p></div><div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Saída</p><p className="mt-1 font-mono text-sm text-emerald-950">{formatDateTime(visit.departureTime)}</p></div><div className="rounded-lg border border-violet-100 bg-violet-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Duração</p><p className="mt-1 font-mono text-sm text-violet-950">{duration ?? "Em andamento"}</p></div></CardContent></Card>

        <Card className="border-violet-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-violet-950">Registro detalhado <span className="text-rose-700">*</span></CardTitle><CardDescription>Campo obrigatório. Use pelo menos 8 caracteres. Exemplo: “Visita realizada, posto em funcionamento e orientação repassada ao responsável.”</CardDescription></CardHeader><CardContent><Textarea value={occurrenceReport} onChange={(event) => setOccurrenceReport(event.target.value)} disabled={!isReadyToReport || submitOccurrenceMutation.isPending} required minLength={8} maxLength={5000} aria-required="true" placeholder="Digite aqui a ocorrência ou o relatório completo da visita..." className="min-h-48 resize-y text-sm leading-6" /><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{occurrenceReport.trim().length < 8 ? "Mínimo de 8 caracteres" : "Registro pronto para envio"}</span><span>{occurrenceReport.length}/5000</span></div></CardContent></Card>

        {!isReadyToReport && <Card className="border-amber-200 bg-amber-50"><CardContent className="py-4 text-sm text-amber-950">Registre a chegada no card do posto antes de enviar a ocorrência.</CardContent></Card>}
        <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row"><Button onClick={() => window.history.back()} variant="outline">Cancelar</Button><Button onClick={() => void handleSubmit()} disabled={!isReadyToReport || occurrenceReport.trim().length < 8 || submitOccurrenceMutation.isPending} className="bg-violet-700 text-white hover:bg-violet-800">{submitOccurrenceMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : <><Send className="mr-2 h-4 w-4" />Enviar ocorrência ao Gestor</>}</Button></div>
        {visit.occurrenceReport && <p className="flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" />Este registro já foi enviado e pode ser atualizado.</p>}
      </main>
    </div>
  );
}
