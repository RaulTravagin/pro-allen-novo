import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MapView } from "@/components/Map";
import { trpc } from "@/lib/trpc";
import { Activity, AlertTriangle, Building2, CalendarDays, Car, CheckCircle2, ChevronDown, ClipboardCheck, Clock3, Crosshair, Download, FileDown, FileText, Gauge, Loader2, LogOut, MapPin, Moon, Navigation, Pencil, Plus, Radio, Route, Save, ShieldCheck, Sun, TimerReset, UsersRound, XCircle } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const REFRESH_INTERVAL = 15_000;

function formatTime(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
}

function formatDateTime(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
}

function formatCoordinates(latitude: unknown, longitude: unknown) {
  if (latitude == null || longitude == null) return "GPS ainda não recebido";
  return `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
}

function mapCoordinate(latitude: unknown, longitude: unknown) {
  if (latitude == null || longitude == null) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

function formatDuration(minutes: number | null | undefined) {
  if (minutes == null) return "—";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder}min` : `${remainder} min`;
}

function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
}

function formatFuelType(value: string | null | undefined) {
  return ({ gasoline: "Gasolina", ethanol: "Etanol", diesel: "Diesel" } as Record<string, string>)[value ?? ""] ?? "Combustível não informado";
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function scheduleAppearance(assignment: string) {
  const config: Record<string, { label: string; detail: string; className: string; icon: typeof Sun }> = {
    day: { label: "Plantão Dia", detail: "06h às 18h", className: "bg-amber-100 text-amber-900", icon: Sun },
    night: { label: "Plantão Noite", detail: "18h às 06h", className: "bg-indigo-100 text-indigo-900", icon: Moon },
    reliever: { label: "Folguista", detail: "Cobertura de folgas", className: "bg-cyan-100 text-cyan-900", icon: UsersRound },
    off: { label: "Folga", detail: "Sem plantão nesta data", className: "bg-slate-100 text-slate-700", icon: Clock3 },
  };
  return config[assignment] ?? config.off;
}

function checklistStatus(status: string) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: "Pendente", className: "bg-slate-100 text-slate-700" },
    in_progress: { label: "Em atendimento", className: "bg-amber-100 text-amber-800" },
    visited: { label: "Concluído", className: "bg-emerald-100 text-emerald-800" },
    skipped: { label: "Não realizado", className: "bg-rose-100 text-rose-800" },
  };
  return config[status] ?? config.pending;
}

function checklistPresentation(checklist: any) {
  const total = Number(checklist?.total ?? 0);
  const compliant = Number(checklist?.compliant ?? 0);
  const nonCompliant = Number(checklist?.nonCompliant ?? 0);
  const unanswered = Number(checklist?.unanswered ?? 0);
  if (total === 0) return { label: "Checklist não iniciado", detail: "Nenhum item preenchido", className: "bg-slate-100 text-slate-700" };
  if (nonCompliant > 0) return { label: "Requer atenção", detail: `${nonCompliant} item(ns) não conforme(s)`, className: "bg-rose-100 text-rose-800" };
  if (unanswered > 0) return { label: "Preenchimento pendente", detail: `${unanswered} item(ns) aguardando resposta`, className: "bg-amber-100 text-amber-800" };
  return { label: "Checklist conforme", detail: `${compliant} item(ns) verificado(s)`, className: "bg-emerald-100 text-emerald-800" };
}

function checklistItemPresentation(item: any) {
  if (item.isCompliant === true) return { label: "Conforme", className: "bg-emerald-100 text-emerald-800" };
  if (item.isCompliant === false) return { label: "Não conforme", className: "bg-rose-100 text-rose-800" };
  return { label: "Sem resposta", className: "bg-slate-100 text-slate-700" };
}

function ChecklistPreview({ checklist, items = [], status }: { checklist: any; items?: any[]; status?: string }) {
  if (status === "pending") return <div className="space-y-1"><Badge className="bg-slate-100 text-slate-700">Aguardando visita</Badge><p className="text-xs text-slate-600">Checklist será liberado após a chegada ao posto</p></div>;
  if (status === "skipped") return <div className="space-y-1"><Badge className="bg-slate-100 text-slate-700">Checklist não realizado</Badge><p className="text-xs text-slate-600">Não há itens preenchidos para esta visita</p></div>;
  const presentation = checklistPresentation(checklist);
  return <div className="space-y-2"><Badge className={presentation.className}>{presentation.label}</Badge><p className="text-xs text-slate-600">{presentation.detail}</p>{items.length > 0 && <details className="group rounded-lg border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-blue-700 marker:content-none">Ver {items.length} item(ns) do checklist<ChevronDown className="h-3.5 w-3.5 text-slate-500 transition-transform duration-200 group-open:rotate-180" /></summary><div className="divide-y divide-slate-100 border-t border-slate-100">{items.map((item, index) => { const itemStatus = checklistItemPresentation(item); return <article key={item.id ?? `${item.category}-${item.description}-${index}`} className="space-y-1.5 px-3 py-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-slate-900">{item.description}</p><Badge className={itemStatus.className}>{itemStatus.label}</Badge></div><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{item.category}</p>{item.notes && <p className="text-xs leading-5 text-slate-600"><strong>Observação:</strong> {item.notes}</p>}</article>; })}</div></details>}</div>;
}

function ChecklistDetails({ visits }: { visits: any[] }) {
  const entries = visits.filter((visit) => (visit.status === "visited" || visit.status === "in_progress") && ((visit.checklistItems?.length ?? 0) > 0 || Number(visit.checklistSummary?.total ?? visit.checklist?.total ?? 0) > 0));
  if (!entries.length) return null;
  return <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4"><div className="mb-3"><p className="flex items-center gap-2 font-semibold text-slate-950"><ClipboardCheck className="h-4 w-4 text-blue-700" /> Checklist por visita</p><p className="mt-1 text-xs leading-5 text-slate-600">Leitura rápida do resultado. Abra um cartão para consultar os itens e as observações registradas.</p></div><div className="grid gap-3 lg:grid-cols-2">{entries.map((visit, index) => <article key={`${visit.id ?? visit.postName}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-slate-900">{visit.postName}</p><p className="mt-1 text-xs text-slate-500">{visit.postRegion ?? visit.region}</p></div><Badge className={checklistStatus(visit.status).className}>{checklistStatus(visit.status).label}</Badge></div><ChecklistPreview checklist={visit.checklistSummary ?? visit.checklist} items={visit.checklistItems} status={visit.status} /></article>)}</div></section>;
}

function operationStatus(status: string) {
  const config: Record<string, { label: string; className: string }> = {
    sem_rota: { label: "Sem rota hoje", className: "bg-slate-100 text-slate-700" },
    aguardando_km: { label: "Aguardando KM", className: "bg-blue-100 text-blue-800" },
    em_deslocamento: { label: "Em deslocamento", className: "bg-cyan-100 text-cyan-800" },
    em_atendimento: { label: "Em atendimento", className: "bg-amber-100 text-amber-800" },
    em_base_operacional: { label: "Na Base Operacional", className: "bg-violet-100 text-violet-800" },
    rota_concluida: { label: "Rota concluída", className: "bg-emerald-100 text-emerald-800" },
    base_concluida: { label: "Base concluída", className: "bg-violet-100 text-violet-800" },
    rota_cancelada: { label: "Rota cancelada", className: "bg-rose-100 text-rose-800" },
  };
  return config[status] ?? config.sem_rota;
}

function alertAppearance(severity: string) {
  return severity === "critical" ? "border-rose-200 bg-rose-50 text-rose-950" : severity === "warning" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-blue-200 bg-blue-50 text-blue-950";
}

function downloadDailyReportCsv(report: any) {
  const rows: Array<Array<string | number>> = [["Relatório diário", new Date(report.reportDate).toLocaleDateString("pt-BR")], [], ["Supervisor", "Situação", "Rota", "Posto", "Atendimento", "Chegada", "Saída", "Duração (min)", "Cobertura", "Motivo da cobertura", "Checklist conforme", "Não conformidades", "Sem resposta", "Observações", "KM percorridos", "GPS", "Alertas"]];
  for (const supervisor of report.supervisors ?? []) {
    const visits = supervisor.route?.visits?.length ? supervisor.route.visits : [null];
    for (const visit of visits) {
      rows.push([
        supervisor.supervisorName, supervisor.operationalStatusLabel, supervisor.route?.name ?? "Sem rota", visit?.postName ?? "—", visit ? checklistStatus(visit.status).label : "—",
        visit?.arrivalTime ? new Date(visit.arrivalTime).toLocaleString("pt-BR") : "—", visit?.departureTime ? new Date(visit.departureTime).toLocaleString("pt-BR") : "—", visit?.durationMinutes ?? "—",
        visit?.isCoverage ? "Sim" : "Não", visit?.coverageReason ?? "—", visit?.checklist?.compliant ?? 0, visit?.checklist?.nonCompliant ?? 0, visit?.checklist?.unanswered ?? 0,
        visit?.observations ?? "—", supervisor.route?.kmCovered ?? "—", supervisor.latestLocation ? formatCoordinates(supervisor.latestLocation.latitude, supervisor.latestLocation.longitude) : "Sem GPS",
        (supervisor.alerts ?? []).map((alert: any) => alert.title).join(" | ") || "Sem alertas",
      ]);
    }
  }
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-diario-${new Date(report.reportDate).toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function GestorDashboard() {
  const [, navigate] = useLocation();
  const [showDailyReport, setShowDailyReport] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [reportDateValue, setReportDateValue] = useState(() => toDateInputValue(new Date()));
  const [scheduleDateValue, setScheduleDateValue] = useState(() => toDateInputValue(new Date()));
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState<Record<number, { assignment: string; note: string }>>({});
  const [showPostForm, setShowPostForm] = useState(false);
  const [postForm, setPostForm] = useState({ routeId: "", name: "", region: "", address: "" });
  const sessionQuery = trpc.gestorAccess.session.useQuery(undefined, { retry: false, refetchInterval: REFRESH_INTERVAL, refetchOnMount: "always" });
  const { data: session, isLoading: isCheckingSession } = sessionQuery;
  const hasConfirmedGestorSession = sessionQuery.isFetchedAfterMount && sessionQuery.isSuccess && session?.authenticated === true;
  const dashboard = trpc.gestor.dashboard.useQuery(undefined, { enabled: hasConfirmedGestorSession, retry: false, refetchInterval: REFRESH_INTERVAL, refetchOnWindowFocus: true });
  const dailyReportInput = useMemo(() => ({ reportDate: new Date(`${reportDateValue}T12:00:00`) }), [reportDateValue]);
  const dailyReport = trpc.gestor.dailyReport.useQuery(dailyReportInput, { enabled: hasConfirmedGestorSession && showDailyReport, retry: false });
  const scheduleInput = useMemo(() => ({ scheduleDate: new Date(`${scheduleDateValue}T12:00:00`) }), [scheduleDateValue]);
  const schedule = trpc.gestor.schedule.useQuery(scheduleInput, { enabled: hasConfirmedGestorSession, retry: false });
  const postsManagement = trpc.gestor.postsManagement.useQuery(undefined, { enabled: hasConfirmedGestorSession, retry: false });
  const utils = trpc.useUtils();
  const updateSchedule = trpc.gestor.updateSchedule.useMutation({
    onSuccess: async () => {
      await utils.gestor.schedule.invalidate();
      setIsEditingSchedule(false);
    },
  });
  const createPost = trpc.gestor.createPost.useMutation({
    onSuccess: async (_post, variables) => {
      await utils.gestor.postsManagement.invalidate();
      const selectedRoute = postsManagement.data?.routes.find((route: any) => route.id === variables.routeId);
      setPostForm({ routeId: String(variables.routeId), name: "", region: selectedRoute?.region ?? "", address: "" });
      setShowPostForm(false);
    },
  });
  const logout = trpc.gestorAccess.logout.useMutation({ onSuccess: () => navigate("/gestor/acesso") });

  useEffect(() => {
    if (sessionQuery.isFetchedAfterMount && !isCheckingSession && !session?.authenticated) navigate("/gestor/acesso");
  }, [isCheckingSession, navigate, session?.authenticated, sessionQuery.isFetchedAfterMount]);

  useEffect(() => {
    if (!schedule.data) return;
    setScheduleDraft(Object.fromEntries(schedule.data.supervisors.map((supervisor: any) => [supervisor.supervisorId, { assignment: supervisor.assignment, note: supervisor.note ?? "" }])));
  }, [schedule.data]);

  useEffect(() => {
    const firstRoute = postsManagement.data?.routes?.[0];
    if (!firstRoute) return;
    setPostForm((current) => current.routeId ? current : { ...current, routeId: String(firstRoute.id), region: firstRoute.region });
  }, [postsManagement.data]);

  if (!sessionQuery.isFetchedAfterMount || isCheckingSession || !session?.authenticated) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Conferindo acesso do Gestor...</div>;
  }

  const data = dashboard.data;
  const metrics = data?.metrics;
  const supervisors = data?.operationalSupervisors ?? [];
  const alerts = data?.alerts ?? [];
  const updatedAt = data?.lastUpdatedAt ? new Date(data.lastUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white">CT3</div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Central operacional</p><h1 className="text-2xl font-bold tracking-tight">Painel do Gestor</h1></div></div>
          <div className="flex flex-wrap items-center gap-3"><div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"><Radio className="h-3.5 w-3.5" /> Atualização automática a cada 15 s</div><Button variant="outline" onClick={() => navigate("/gestor/relatorios")} className="gap-2"><FileDown className="h-4 w-4" /> Relatórios</Button><Button variant="outline" onClick={() => setShowDailyReport(true)} className="gap-2"><FileText className="h-4 w-4" /> Relatório do dia</Button><Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending} className="gap-2"><LogOut className="h-4 w-4" /> Sair</Button></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-7 sm:px-6 lg:px-8">
        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/10 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><Activity className="h-4 w-4" /> Monitoramento de ponta a ponta</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Toda a operação de campo, supervisor por supervisor.</h2><p className="mt-3 max-w-3xl text-slate-300">Acompanhe rotas, atendimentos, postos pendentes, checklist, horários, observações, quilometragem, GPS e exceções operacionais em uma única central.</p></div><p className="text-sm text-slate-400">Última atualização: <span className="font-semibold text-white">{updatedAt}</span></p></div>
        </section>

        <section className="space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Acompanhamento em tempo real</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Supervisores, postos e tempo de atendimento</h2><p className="mt-1 text-sm text-slate-600">Cada supervisor permanece aberto para consulta imediata de posto atual, tempo no local, GPS, KM, checklist, observações, alertas e próximas ações.</p></div>
          {dashboard.isLoading ? <LoadingRows /> : supervisors.length ? <div className="space-y-4">{supervisors.map((supervisor) => <SupervisorOperationalCard key={supervisor.supervisorId} supervisor={supervisor} />)}</div> : <EmptyState title="Nenhum supervisor cadastrado" description="Os supervisores aparecerão nesta área quando tiverem acesso operacional configurado." />}
        </section>

        {showDailyReport && <section className="rounded-3xl border border-blue-100 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-start lg:justify-between"><div><p className="flex items-center gap-2 text-sm font-semibold text-blue-700"><FileText className="h-4 w-4" /> Relatório operacional diário</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Acompanhamento completo dos supervisores</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Consulte o dia atual ou selecione uma data anterior para recuperar rotas, postos, horários, checklist, cobertura, KM, GPS e alertas.</p></div><div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-xs font-semibold text-slate-600">Data do relatório<input aria-label="Data do relatório" type="date" value={reportDateValue} max={toDateInputValue(new Date())} onChange={(event) => setReportDateValue(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-blue-600 focus:ring-2" /></label><Button variant="outline" onClick={() => dailyReport.refetch()} disabled={dailyReport.isFetching} className="gap-2"><TimerReset className="h-4 w-4" /> Atualizar dados</Button><Button onClick={async () => { if (!dailyReport.data) return; setIsExportingWord(true); try { const { downloadDailyReportWord } = await import("@/lib/dailyReportDocx"); await downloadDailyReportWord(dailyReport.data); } finally { setIsExportingWord(false); } }} disabled={!dailyReport.data || isExportingWord} className="gap-2 bg-slate-950 text-white hover:bg-slate-800"><Download className="h-4 w-4" /> {isExportingWord ? "Gerando Word..." : "Baixar Word"}</Button></div></div>
          {dailyReport.isLoading ? <LoadingRows /> : dailyReport.data ? <DailyOperationalReport report={dailyReport.data} /> : <EmptyState title="Relatório indisponível" description="Tente atualizar os dados do relatório diário." />}
        </section>}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Supervisores em rota" value={metrics?.supervisorsOnRoute ?? 0} icon={UsersRound} tone="blue" />
          <MetricCard label="Rotas em operação" value={metrics?.activeRoutes ?? 0} icon={Route} tone="emerald" />
          <MetricCard label="Postos em atendimento" value={metrics?.visitsInProgress ?? 0} icon={Activity} tone="amber" />
          <MetricCard label="Visitas concluídas" value={metrics?.completedVisits ?? 0} icon={CheckCircle2} tone="indigo" />
          <MetricCard label="Postos pendentes" value={metrics?.pendingVisits ?? 0} icon={ClipboardCheck} tone="slate" />
          <MetricCard label="KM percorridos" value={`${(metrics?.totalKm ?? 0).toLocaleString("pt-BR")} km`} icon={Gauge} tone="slate" />
          <MetricCard label="GPS a verificar" value={metrics?.gpsStale ?? 0} icon={Crosshair} tone="red" />
          <MetricCard label="Alertas abertos" value={metrics?.alerts ?? 0} icon={AlertTriangle} tone="red" />
        </section>

        <section className="grid gap-7 xl:grid-cols-[1.2fr_.8fr]">
          <Card className="border-slate-200 shadow-sm"><CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /> Alertas operacionais</CardTitle><CardDescription>Exceções que merecem acompanhamento imediato do Gestor.</CardDescription></CardHeader><CardContent className="space-y-3 p-5">
            {dashboard.isLoading ? <LoadingRows /> : alerts.length ? alerts.map((alert, index) => <article key={`${alert.supervisorId}-${alert.code}-${index}`} className={`rounded-xl border p-4 ${alertAppearance(alert.severity)}`}><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">{alert.title} · {alert.supervisorName}</p><p className="mt-1 text-sm opacity-80">{alert.description}</p></div></div></article>) : <EmptyState title="Sem alertas operacionais" description="As rotas em andamento estão com registros compatíveis com o acompanhamento esperado." />}
          </CardContent></Card>

          <Card className="border-slate-200 shadow-sm"><CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2"><TimerReset className="h-5 w-5 text-blue-700" /> Eventos recentes</CardTitle><CardDescription>Chegadas, atendimentos e saídas registradas hoje.</CardDescription></CardHeader><CardContent className="p-0">
            {dashboard.isLoading ? <LoadingRows /> : data?.recentVisits.length ? <div className="divide-y divide-slate-100">{data.recentVisits.map((visit) => <article key={visit.id} className="flex gap-3 p-5"><div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${visit.status === "in_progress" ? "bg-amber-400" : "bg-emerald-500"}`} /><div className="min-w-0"><p className="font-semibold text-slate-900">{visit.postName}</p><p className="mt-1 text-sm text-slate-500">{visit.supervisorName} · {visit.routeName}</p><p className="mt-2 text-xs font-medium text-slate-600">{visit.status === "in_progress" ? `Em atendimento desde ${formatTime(visit.arrivalTime)}` : `Saída às ${formatTime(visit.departureTime)}`}</p></div></article>)}</div> : <EmptyState title="Sem atividade recente" description="Os registros de chegada e saída aparecerão nesta área." />}
          </CardContent></Card>
        </section>

        <ScheduleManagementPanel schedule={schedule.data} loading={schedule.isLoading} dateValue={scheduleDateValue} editing={isEditingSchedule} drafts={scheduleDraft} saving={updateSchedule.isPending} error={updateSchedule.error?.message} onDateChange={(value) => { setScheduleDateValue(value); setIsEditingSchedule(false); }} onStartEditing={() => setIsEditingSchedule(true)} onCancelEditing={() => { setIsEditingSchedule(false); if (schedule.data) setScheduleDraft(Object.fromEntries(schedule.data.supervisors.map((supervisor: any) => [supervisor.supervisorId, { assignment: supervisor.assignment, note: supervisor.note ?? "" }]))); }} onDraftChange={(supervisorId, updates) => setScheduleDraft((current) => ({ ...current, [supervisorId]: { assignment: current[supervisorId]?.assignment ?? "off", note: current[supervisorId]?.note ?? "", ...updates } }))} onSave={() => { if (!schedule.data) return; updateSchedule.mutate({ scheduleDate: schedule.data.scheduleDate, entries: schedule.data.supervisors.map((supervisor: any) => ({ supervisorId: supervisor.supervisorId, assignment: (scheduleDraft[supervisor.supervisorId]?.assignment ?? supervisor.assignment) as "day" | "night" | "reliever" | "off", note: scheduleDraft[supervisor.supervisorId]?.note ?? supervisor.note ?? null })) }); }} />

        <OperationalMapPanel routes={postsManagement.data?.routes ?? []} supervisors={supervisors} loading={postsManagement.isLoading || dashboard.isLoading} />

        <PostsManagementPanel management={postsManagement.data} loading={postsManagement.isLoading} form={postForm} showingForm={showPostForm} saving={createPost.isPending} error={createPost.error?.message} onOpenForm={() => setShowPostForm(true)} onCancelForm={() => setShowPostForm(false)} onRouteChange={(routeId) => { const route = postsManagement.data?.routes.find((item: any) => item.id === Number(routeId)); setPostForm((current) => ({ ...current, routeId, region: route?.region ?? current.region })); }} onFormChange={(changes) => setPostForm((current) => ({ ...current, ...changes }))} onSubmit={() => { if (!postForm.routeId) return; createPost.mutate({ routeId: Number(postForm.routeId), name: postForm.name, region: postForm.region, address: postForm.address }); }} />

        <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 text-sm text-blue-950"><p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Central do Gestor protegida</p><p className="mt-1 text-blue-800">O Gestor acompanha a operação sem alterar registros de campo. Chegadas, saídas, checklist, observações, KM e GPS continuam sendo registrados pelo supervisor.</p></section>
      </div>
    </main>
  );
}

function ScheduleManagementPanel({ schedule, loading, dateValue, editing, drafts, saving, error, onDateChange, onStartEditing, onCancelEditing, onDraftChange, onSave }: { schedule: any; loading: boolean; dateValue: string; editing: boolean; drafts: Record<number, { assignment: string; note: string }>; saving: boolean; error?: string; onDateChange: (value: string) => void; onStartEditing: () => void; onCancelEditing: () => void; onDraftChange: (supervisorId: number, updates: Partial<{ assignment: string; note: string }>) => void; onSave: () => void }) {
  return <section className="rounded-3xl border border-indigo-100 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-start lg:justify-between"><div><p className="flex items-center gap-2 text-sm font-semibold text-indigo-700"><CalendarDays className="h-4 w-4" /> Escala de plantão</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Dia, noite, folga e cobertura</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">A escala é independente das rotas. O Gestor pode ajustar a data, o responsável e uma observação operacional sempre que necessário.</p></div><div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-xs font-semibold text-slate-600">Data da escala<input aria-label="Data da escala" type="date" value={dateValue} onChange={(event) => onDateChange(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-indigo-600 focus:ring-2" /></label>{editing ? <><Button variant="outline" onClick={onCancelEditing} disabled={saving}>Cancelar</Button><Button onClick={onSave} disabled={saving || !schedule} className="gap-2 bg-slate-950 text-white hover:bg-slate-800"><Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar escala"}</Button></> : <Button onClick={onStartEditing} disabled={!schedule || loading} className="gap-2 bg-slate-950 text-white hover:bg-slate-800"><Pencil className="h-4 w-4" /> Alterar escala</Button>}</div></div>{loading ? <LoadingRows /> : !schedule ? <EmptyState title="Escala indisponível" description="Atualize a página para consultar a escala do dia." /> : <div className="p-6"><div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-950"><strong>{new Date(schedule.scheduleDate).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}.</strong> As alterações são salvas apenas para a data escolhida e preservam a escala-base dos supervisores.</div>{error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</div>}<div className="grid gap-4 md:grid-cols-3">{schedule.supervisors.map((supervisor: any) => { const draft = drafts[supervisor.supervisorId] ?? { assignment: supervisor.assignment, note: supervisor.note ?? "" }; const appearance = scheduleAppearance(editing ? draft.assignment : supervisor.assignment); const Icon = appearance.icon; return <article key={supervisor.supervisorId} className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white">{String(supervisor.supervisorName).slice(0, 2).toUpperCase()}</div><div className="min-w-0"><p className="truncate font-semibold text-slate-950">{supervisor.supervisorName}</p><p className="mt-1 truncate text-xs text-slate-500">@{supervisor.username}</p></div></div><Icon className="h-5 w-5 text-indigo-700" /></div>{editing ? <div className="mt-5 space-y-3"><label className="grid gap-1 text-xs font-semibold text-slate-600">Atribuição<select aria-label={`Escala de ${supervisor.supervisorName}`} value={draft.assignment} onChange={(event) => onDraftChange(supervisor.supervisorId, { assignment: event.target.value })} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-indigo-600 focus:ring-2"><option value="day">Plantão Dia — 06h às 18h</option><option value="night">Plantão Noite — 18h às 06h</option><option value="reliever">Folguista</option><option value="off">Folga</option></select></label><label className="grid gap-1 text-xs font-semibold text-slate-600">Observação<textarea value={draft.note} onChange={(event) => onDraftChange(supervisor.supervisorId, { note: event.target.value })} placeholder="Ex.: cobertura de folga" rows={2} className="resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-600 focus:ring-2" /></label></div> : <div className="mt-5"><Badge className={appearance.className}>{appearance.label}</Badge><p className="mt-2 text-sm font-medium text-slate-900">{appearance.detail}</p><p className="mt-2 text-xs leading-5 text-slate-600">{supervisor.note || (supervisor.isOverride ? "Ajuste manual do Gestor" : "Escala-base do supervisor")}</p></div>}</article>; })}</div></div>}</section>;
}

function OperationalMapPanel({ routes, supervisors, loading }: { routes: any[]; supervisors: any[]; loading: boolean }) {
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const selectedRoute = routes.find((route) => String(route.id) === selectedRouteId) ?? routes[0];
  const routePosts = selectedRoute?.posts ?? [];
  const mappedPosts = routePosts.map((post: any) => ({ ...post, coordinate: mapCoordinate(post.latitude, post.longitude) })).filter((post: any) => post.coordinate);
  const supervisorMarkers = supervisors.map((supervisor) => ({ supervisor, coordinate: mapCoordinate(supervisor.latestLocation?.latitude, supervisor.latestLocation?.longitude) })).filter((entry) => entry.coordinate);

  useEffect(() => {
    if (!selectedRouteId && routes[0]) setSelectedRouteId(String(routes[0].id));
  }, [routes, selectedRouteId]);

  const pendingPosts = routePosts.length - mappedPosts.length;
  return <section className="overflow-hidden rounded-3xl border border-cyan-100 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-start lg:justify-between"><div><p className="flex items-center gap-2 text-sm font-semibold text-cyan-700"><MapPin className="h-4 w-4" /> Mapa operacional</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Rota, postos e posição de campo</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">O mapa usa OpenStreetMap, mostra postos com coordenadas confirmadas e a última posição GPS recebida dos supervisores. Nenhuma localização é estimada para postos sem endereço completo.</p></div><label className="grid gap-1 text-xs font-semibold text-slate-600">Rota exibida<select aria-label="Rota exibida no mapa" value={selectedRoute ? String(selectedRoute.id) : ""} onChange={(event) => setSelectedRouteId(event.target.value)} disabled={loading || !routes.length} className="h-10 min-w-56 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-cyan-600 focus:ring-2">{routes.map((route) => <option key={route.id} value={route.id}>{route.name} · {route.region}</option>)}</select></label></div>{loading ? <LoadingRows /> : !routes.length ? <EmptyState title="Nenhuma rota cadastrada" description="Cadastre uma rota e seus postos para preparar a visualização operacional." /> : <div className="grid gap-0 lg:grid-cols-[1fr_320px]"><MapView className="h-[440px] min-h-[360px]" initialCenter={{ lat: -23.185, lng: -46.884 }} initialZoom={10} posts={mappedPosts.map((post: any) => ({ id: post.id, title: `${post.name} · ${post.address || post.region}`, position: post.coordinate }))} supervisors={supervisorMarkers.map(({ supervisor, coordinate }) => ({ id: supervisor.supervisorId, title: `${supervisor.supervisorName} · última posição GPS`, position: coordinate! }))} routePath={mappedPosts.map((post: any) => post.coordinate)} /><aside className="border-t border-slate-100 bg-slate-50 p-5 lg:border-l lg:border-t-0"><p className="text-sm font-semibold text-slate-950">Situação da localização</p><div className="mt-4 space-y-3"><div className="rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-2xl font-bold text-blue-950">{mappedPosts.length}/{routePosts.length}</p><p className="mt-1 text-xs leading-5 text-blue-800">postos da rota com coordenadas confirmadas</p></div><div className="rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="text-2xl font-bold text-amber-950">{pendingPosts}</p><p className="mt-1 text-xs leading-5 text-amber-800">posto(s) aguardando endereço completo para localização</p></div><div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-2xl font-bold text-emerald-950">{supervisorMarkers.length}</p><p className="mt-1 text-xs leading-5 text-emerald-800">supervisor(es) com última posição GPS no mapa</p></div></div><div className="mt-5 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600"><p className="font-semibold text-slate-900">Legenda</p><p className="mt-2"><span className="font-semibold text-blue-700">P azul:</span> posto geocodificado.</p><p><span className="font-semibold text-emerald-700">GPS verde:</span> última posição recebida.</p><p className="mt-3">O traçado da rota aparecerá automaticamente quando houver pelo menos dois postos com coordenadas confirmadas.</p><p className="mt-3 border-t border-slate-200 pt-3">Base cartográfica fornecida pelo OpenStreetMap, sem chave de API.</p></div></aside></div>}</section>;
}

function PostsManagementPanel({ management, loading, form, showingForm, saving, error, onOpenForm, onCancelForm, onRouteChange, onFormChange, onSubmit }: { management: any; loading: boolean; form: { routeId: string; name: string; region: string; address: string }; showingForm: boolean; saving: boolean; error?: string; onOpenForm: () => void; onCancelForm: () => void; onRouteChange: (routeId: string) => void; onFormChange: (changes: Partial<{ routeId: string; name: string; region: string; address: string }>) => void; onSubmit: () => void }) {
  const routes = management?.routes ?? [];
  return <section className="rounded-3xl border border-emerald-100 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-start lg:justify-between"><div><p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Building2 className="h-4 w-4" /> Postos de serviço</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Clientes e locais atendidos</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Cadastre novos postos conforme surgirem clientes e associe cada local à rota responsável.</p></div>{!showingForm && <Button onClick={onOpenForm} disabled={loading || !routes.length} className="gap-2 bg-slate-950 text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> Novo posto</Button>}</div>{loading ? <LoadingRows /> : <div className="p-6">{showingForm && <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="font-semibold text-slate-950">Cadastrar novo posto</p><p className="mt-1 text-xs text-slate-600">O posto será adicionado ao fim da rota escolhida e ficará disponível para as próximas rotas preparadas.</p></div><Button type="button" variant="outline" onClick={onCancelForm} disabled={saving}>Cancelar</Button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="grid gap-1 text-xs font-semibold text-slate-600">Rota vinculada<select aria-label="Rota vinculada" required value={form.routeId} onChange={(event) => onRouteChange(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-emerald-600 focus:ring-2">{routes.map((route: any) => <option key={route.id} value={route.id}>{route.name} · {route.region}</option>)}</select></label><label className="grid gap-1 text-xs font-semibold text-slate-600">Nome do posto<input aria-label="Nome do posto" required minLength={2} maxLength={255} value={form.name} onChange={(event) => onFormChange({ name: event.target.value })} placeholder="Ex.: Novo condomínio" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-emerald-600 focus:ring-2" /></label><label className="grid gap-1 text-xs font-semibold text-slate-600">Região<input aria-label="Região do posto" required minLength={2} maxLength={255} value={form.region} onChange={(event) => onFormChange({ region: event.target.value })} placeholder="Ex.: Jundiaí" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-emerald-600 focus:ring-2" /></label><label className="grid gap-1 text-xs font-semibold text-slate-600">Endereço<input aria-label="Endereço do posto" required minLength={3} maxLength={255} value={form.address} onChange={(event) => onFormChange({ address: event.target.value })} placeholder="Rua, número e cidade" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-emerald-600 focus:ring-2" /></label></div>{error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}<div className="mt-4 flex justify-end"><Button type="submit" disabled={saving || !form.routeId || form.name.trim().length < 2 || form.region.trim().length < 2 || form.address.trim().length < 3} className="gap-2 bg-emerald-700 text-white hover:bg-emerald-800"><Save className="h-4 w-4" /> {saving ? "Cadastrando..." : "Cadastrar posto"}</Button></div></form>}<div className="grid gap-3 lg:grid-cols-2">{routes.map((route: any) => <details key={route.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-slate-950">{route.name}</p><p className="mt-1 text-xs text-slate-500">{route.region} · {route.posts.length} posto(s)</p></div><ChevronDown className="h-4 w-4 text-slate-500" /></div></summary><div className="mt-4 space-y-2 border-t border-slate-200 pt-3">{route.posts.length ? route.posts.map((post: any) => <div key={post.id} className="flex gap-2 rounded-lg bg-white p-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><div><p className="text-sm font-semibold text-slate-900">{post.name}</p><p className="mt-1 text-xs leading-5 text-slate-600">{post.address} · {post.region}</p></div></div>) : <p className="text-sm text-slate-500">Nenhum posto cadastrado nesta rota.</p>}</div></details>)}</div></div>}</section>;
}

function DailyOperationalReport({ report }: { report: any }) {
  const summary = report.summary;
  return <div className="space-y-6 p-6">
    <div className="flex flex-col gap-2 rounded-2xl bg-blue-50 p-4 text-sm text-blue-950 sm:flex-row sm:items-center sm:justify-between"><p><strong>Data:</strong> {new Date(report.reportDate).toLocaleDateString("pt-BR")}</p><p><strong>Gerado às:</strong> {new Date(report.generatedAt).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><ReportMetric label="Supervisores em rota" value={`${summary.supervisorsOnRoute}/${summary.supervisors}`} /><ReportMetric label="Visitas concluídas" value={summary.completedVisits} /><ReportMetric label="Postos pendentes" value={summary.pendingVisits} /><ReportMetric label="Em atendimento" value={summary.visitsInProgress} /><ReportMetric label="Coberturas" value={summary.coverages} /><ReportMetric label="KM percorridos" value={`${Number(summary.kmCovered).toLocaleString("pt-BR")} km`} /><ReportMetric label="Não conformidades" value={summary.nonCompliantItems} alert={summary.nonCompliantItems > 0} /><ReportMetric label="Alertas abertos" value={summary.alerts} alert={summary.alerts > 0} /></div>
    <div className="space-y-3">{report.supervisors.map((supervisor: any) => {
      const visits = supervisor.route?.visits ?? [];
      return <details key={supervisor.supervisorId} className="rounded-2xl border border-slate-200 bg-slate-50" open={supervisor.operationalStatus === "em_atendimento"}>
        <summary className="flex cursor-pointer list-none flex-col gap-3 p-5 marker:content-none sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-950">{supervisor.supervisorName}</p><p className="mt-1 text-sm text-slate-600">{supervisor.route ? `${supervisor.route.name} · ${supervisor.route.region}` : "Nenhuma rota preparada"}</p></div><div className="flex flex-wrap gap-2"><Badge className={operationStatus(supervisor.operationalStatus).className}>{supervisor.operationalStatusLabel}</Badge>{supervisor.route && <Badge variant="outline">{supervisor.route.completedVisits}/{supervisor.route.totalPosts} postos</Badge>}</div></summary>
        <div className="space-y-4 border-t border-slate-200 bg-white p-5">
          <div className="grid gap-3 md:grid-cols-3"><InfoBlock icon={Activity} label="Atendimento" value={supervisor.route?.activeVisit?.postName ?? "Sem atendimento ativo"} detail={supervisor.route?.activeVisit ? `Desde ${formatTime(supervisor.route.activeVisit.arrivalTime)} · ${formatDuration(supervisor.route.activeVisit.durationMinutes)}` : "Sem posto em atendimento"} /><InfoBlock icon={Car} label="Quilometragem" value={supervisor.route?.kmInitial != null ? `${Number(supervisor.route.kmInitial).toLocaleString("pt-BR")} km inicial` : "KM não informado"} detail={supervisor.route?.kmCovered != null ? `${Number(supervisor.route.kmCovered).toLocaleString("pt-BR")} km percorridos` : "KM final pendente"} /><InfoBlock icon={Crosshair} label="Último GPS" value={supervisor.latestLocation ? formatCoordinates(supervisor.latestLocation.latitude, supervisor.latestLocation.longitude) : "Sem GPS"} detail={supervisor.latestLocation?.recordedAt ? formatDateTime(supervisor.latestLocation.recordedAt) : "Localização não recebida"} /></div>
          {(supervisor.activities?.length ?? 0) > 1 && <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4"><p className="text-sm font-semibold text-indigo-950">Sequência de atividades do dia</p><div className="mt-3 grid gap-2 md:grid-cols-2">{supervisor.activities.map((activity: any) => <div key={activity.id} className="rounded-lg border border-indigo-100 bg-white p-3 text-sm"><p className="font-semibold text-slate-900">{activity.name}</p><p className="mt-1 text-xs text-slate-600">{activity.startedAt ? `Início: ${formatTime(activity.startedAt)}` : "Aguardando início"}{activity.completedAt ? ` · Fim: ${formatTime(activity.completedAt)}` : ""}</p><p className="mt-1 text-xs text-slate-600">{activity.kmInitial != null ? `${Number(activity.kmInitial).toLocaleString("pt-BR")} km inicial` : "KM inicial pendente"}{activity.kmFinal != null ? ` · ${Number(activity.kmFinal).toLocaleString("pt-BR")} km final` : ""}</p></div>)}</div></div>}
          <div className="grid gap-3 sm:grid-cols-4"><ReportMetric label="Itens conformes" value={supervisor.checklistTotals.compliant} /><ReportMetric label="Requer atenção" value={supervisor.checklistTotals.nonCompliant} alert={supervisor.checklistTotals.nonCompliant > 0} /><ReportMetric label="Aguardando resposta" value={supervisor.checklistTotals.unanswered} /><ReportMetric label="Coberturas" value={supervisor.coverageCount} /></div>
          {supervisor.alerts.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>Alertas:</strong> {supervisor.alerts.map((alert: any) => alert.title).join(" · ")}</div>}
          <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-[960px] w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-3">Posto</th><th className="px-3 py-3">Situação</th><th className="px-3 py-3">Horários</th><th className="px-3 py-3">Resumo do checklist</th><th className="px-3 py-3">Cobertura / observações</th></tr></thead><tbody className="divide-y divide-slate-100">{visits.map((visit: any, index: number) => <tr key={`${visit.postName}-${index}`} className="align-top"><td className="px-3 py-3 font-semibold text-slate-900">{visit.postName}<p className="mt-1 font-normal text-slate-500">{visit.region}</p></td><td className="px-3 py-3"><Badge className={checklistStatus(visit.status).className}>{checklistStatus(visit.status).label}</Badge></td><td className="px-3 py-3 text-slate-600">Chegada: {formatTime(visit.arrivalTime)}<br />Saída: {formatTime(visit.departureTime)}{visit.durationMinutes != null && <><br />Duração: {formatDuration(visit.durationMinutes)}</>}</td><td className="min-w-[220px] px-3 py-3"><ChecklistPreview checklist={visit.checklist} items={visit.checklistItems} status={visit.status} /></td><td className="max-w-[260px] px-3 py-3 text-slate-600">{visit.isCoverage && <p className="mb-2 rounded bg-violet-50 p-2 text-violet-950"><strong>Cobertura:</strong> {visit.coverageReason}</p>}{visit.observations || "Sem observações"}</td></tr>)}</tbody></table></div>
          <ChecklistDetails visits={visits} />
        </div>
      </details>;
    })}</div>
  </div>;
}

function ReportMetric({ label, value, alert = false }: { label: string; value: string | number; alert?: boolean }) {
  return <div className={`rounded-xl border p-4 ${alert ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}><p className="text-lg font-bold text-slate-950">{value}</p><p className="mt-1 text-xs font-medium text-slate-600">{label}</p></div>;
}

function SupervisorOperationalCard({ supervisor }: { supervisor: any }) {
  const route = supervisor.route;
  const activities = supervisor.activities ?? (route ? [route] : []);
  const status = operationStatus(supervisor.status);
  const progress = route?.totalPosts ? Math.round((route.completedVisits / route.totalPosts) * 100) : 0;
  const gpsDescription = supervisor.latestLocation ? `${formatCoordinates(supervisor.latestLocation.latitude, supervisor.latestLocation.longitude)} · ${supervisor.latestLocation.accuracy != null ? `precisão ${Number(supervisor.latestLocation.accuracy).toFixed(0)} m` : "precisão não informada"}` : "GPS ainda não recebido";

  return <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm" open>
    <summary className="flex cursor-pointer list-none flex-col gap-4 p-5 marker:content-none sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">{String(supervisor.supervisorName ?? "S").slice(0, 2).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-lg font-semibold text-slate-950">{supervisor.supervisorName}</p><p className="mt-0.5 truncate text-sm text-slate-500">{supervisor.supervisorUsername ? `@${supervisor.supervisorUsername}` : "Usuário operacional"} {route ? `· ${route.routeName}` : ""}</p></div></div><div className="flex flex-wrap items-center gap-2"><Badge className={status.className}>{status.label}</Badge>{route && <span className="text-sm font-medium text-slate-700">{route.routeActivityType === "operational_base" ? "Atividade interna" : `${route.completedVisits}/${route.totalPosts} postos`}</span>}<ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-200 group-open:rotate-180" /></div></summary>
    <div className="border-t border-slate-100 p-5">
      {!route ? <EmptyState title="Nenhuma rota preparada hoje" description="Ainda não há registros de rota para este supervisor no dia de hoje." /> : <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-4"><InfoBlock icon={Route} label={route.routeActivityType === "operational_base" ? "Atividade" : "Rota"} value={route.routeActivityType === "operational_base" ? "Base Operacional" : `${route.routeName} · ${route.routeRegion}`} detail={route.routeActivityType === "operational_base" ? "Atividade interna sem postos de cliente" : route.startedAt ? `Iniciada às ${formatTime(route.startedAt)}` : "Ainda não iniciada"} /><InfoBlock icon={Activity} label={route.routeActivityType === "operational_base" ? "Situação atual" : "Posto atual e tempo"} value={route.routeActivityType === "operational_base" ? "Em atividade na base" : route.activeVisit?.postName ?? "Em deslocamento"} detail={route.routeActivityType === "operational_base" ? "Sem checklist de visita previsto" : route.activeVisit ? `No posto há ${formatDuration(route.activeVisit.durationMinutes)} · chegada ${formatTime(route.activeVisit.arrivalTime)}` : route.nextPost ? `Próximo posto: ${route.nextPost.postName}` : "Sem próximos postos"} /><InfoBlock icon={Car} label="Viatura e KM" value={route.kmInitial != null ? `${Number(route.kmInitial).toLocaleString("pt-BR")} km inicial` : "KM inicial pendente"} detail={route.kmFinal != null ? `${Number(route.kmFinal).toLocaleString("pt-BR")} km final · ${Number(route.kmCovered ?? 0).toLocaleString("pt-BR")} km rodados` : "KM final não informado"} /><InfoBlock icon={Crosshair} label="Último GPS" value={supervisor.latestLocation ? `${supervisor.latestLocation.recordedAt ? `há ${route.gpsAgeMinutes ?? 0} min` : "recebido"}` : "Sem localização"} detail={gpsDescription} /></div>
        <FleetConsumptionDetails route={route} />
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-900">Progresso da rota</p><p className="mt-1 text-sm text-slate-600">{route.completedVisits} concluídos · {route.pendingVisits} pendentes · {route.skippedVisits} não realizados</p></div><p className="text-sm font-bold text-slate-950">{progress}%</p></div><Progress value={progress} className="mt-3 h-2" /></div>
        {activities.length > 1 && <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4"><p className="text-sm font-semibold text-indigo-950">Sequência de atividades no dia</p><div className="mt-3 grid gap-3 md:grid-cols-2">{activities.map((activity: any) => <div key={activity.id} className="rounded-lg border border-indigo-100 bg-white p-3"><div className="flex items-center justify-between gap-2"><p className="font-semibold text-slate-900">{activity.routeActivityType === "operational_base" ? "Base Operacional" : activity.routeName}</p><Badge className={activity.routeStatus === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}>{activity.routeStatus === "completed" ? "Encerrada" : activity.routeStatus === "in_progress" ? "Em andamento" : "Aguardando KM"}</Badge></div><p className="mt-1 text-xs text-slate-600">{activity.startedAt ? `Início: ${formatTime(activity.startedAt)}` : "Aguardando início"}{activity.completedAt ? ` · Fim: ${formatTime(activity.completedAt)}` : ""}</p><p className="mt-1 text-xs text-slate-600">{activity.kmInitial != null ? `${Number(activity.kmInitial).toLocaleString("pt-BR")} km inicial` : "KM inicial pendente"}{activity.kmFinal != null ? ` · ${Number(activity.kmFinal).toLocaleString("pt-BR")} km final` : ""}</p></div>)}</div></div>}
        {supervisor.alerts.length > 0 && <div className="flex flex-wrap gap-2">{supervisor.alerts.map((alert: any, index: number) => <Badge key={`${alert.code}-${index}`} variant="outline" className={alertAppearance(alert.severity)}>{alert.title}</Badge>)}</div>}
        <div><div className="mb-3 flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-blue-700" /><h3 className="font-semibold text-slate-950">Postos e checklist da rota</h3></div><div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-[960px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Posto</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Horários</th><th className="px-4 py-3">Resumo do checklist</th><th className="px-4 py-3">Observações</th></tr></thead><tbody className="divide-y divide-slate-100">{route.checklistVisits.map((visit: any) => { const visitStatus = checklistStatus(visit.status); return <tr key={visit.id} className="align-top"><td className="px-4 py-4"><p className="font-semibold text-slate-900">{visit.postName}</p>{visit.isCoverage && <Badge className="mt-2 bg-violet-100 text-violet-800 hover:bg-violet-100">Cobertura fora da rota</Badge>}<p className="mt-1 text-xs text-slate-500">{visit.postRegion}{visit.postAddress ? ` · ${visit.postAddress}` : ""}</p></td><td className="px-4 py-4"><Badge className={visitStatus.className}>{visitStatus.label}</Badge>{visit.status === "in_progress" && <p className="mt-2 text-xs font-medium text-amber-700">{formatDuration(visit.durationMinutes)}</p>}</td><td className="px-4 py-4 text-xs text-slate-600"><p>Chegada: {formatTime(visit.arrivalTime)}</p><p className="mt-1">Saída: {formatTime(visit.departureTime)}</p><p className="mt-1">Registro: {formatDateTime(visit.visitedAt ?? visit.arrivalTime)}</p></td><td className="min-w-[220px] px-4 py-4"><ChecklistPreview checklist={visit.checklistSummary} items={visit.checklistItems} status={visit.status} /></td><td className="max-w-[240px] px-4 py-4 text-xs leading-5 text-slate-600">{visit.isCoverage && <p className="mb-2 rounded bg-violet-50 p-2 text-violet-950"><strong>Motivo:</strong> {visit.coverageReason}</p>}{visit.observations || "Sem observações"}</td></tr>; })}</tbody></table></div></div>
        <ChecklistDetails visits={route.checklistVisits} />
      </div>}
    </div>
  </details>;
}

function InfoBlock({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail: string }) {
  return <div className="rounded-xl border border-slate-200 p-4"><Icon className="h-4 w-4 text-blue-700" /><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-900">{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div>;
}

function FleetConsumptionDetails({ route }: { route: any }) {
  const vehicle = route?.vehicle;
  const fuelSummary = route?.fuelSummary;
  const fuelHistory = route?.fuelHistory ?? [];

  return <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><p className="flex items-center gap-2 font-semibold text-emerald-950"><Gauge className="h-4 w-4" /> Viatura, abastecimentos e consumo</p><p className="mt-1 text-xs leading-5 text-emerald-800">Dados registrados pelo supervisor e vinculados à atividade atual.</p></div><Badge className="w-fit bg-emerald-100 text-emerald-900 hover:bg-emerald-100">{vehicle?.plate ? `${vehicle.plate} · ${vehicle.model}` : "Viatura não associada"}</Badge></div>
    {!vehicle ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">O supervisor ainda não associou uma viatura a esta atividade.</p> : <>
      <div className="mt-4 grid gap-3 md:grid-cols-3"><InfoBlock icon={Car} label="Viatura" value={`${vehicle.plate} · ${vehicle.model}`} detail={route.kmInitial != null ? `KM inicial: ${Number(route.kmInitial).toLocaleString("pt-BR")}${route.kmFinal != null ? ` · KM final: ${Number(route.kmFinal).toLocaleString("pt-BR")}` : ""}` : "KM inicial ainda não informado"} /><InfoBlock icon={Gauge} label="Média de consumo" value={fuelSummary?.consumptionKmPerLiter != null ? `${Number(fuelSummary.consumptionKmPerLiter).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km/L` : "Aguardando média"} detail={fuelSummary?.distanceSincePrevious != null ? `${Number(fuelSummary.distanceSincePrevious).toLocaleString("pt-BR")} km desde o abastecimento anterior` : "A média é calculada a partir do segundo abastecimento"} /><InfoBlock icon={Gauge} label="Custo por quilômetro" value={fuelSummary?.costPerKm != null ? formatCurrency(fuelSummary.costPerKm) : "Aguardando cálculo"} detail={fuelSummary?.latestFuelAt ? `Último abastecimento: ${formatDateTime(fuelSummary.latestFuelAt)}` : "Sem abastecimento registrado"} /></div>
      {!fuelHistory.length ? <p className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">Ainda não há abastecimentos registrados para esta viatura.</p> : <div className="mt-4 overflow-x-auto rounded-xl border border-emerald-100 bg-white"><table className="min-w-[760px] w-full text-left text-sm"><thead className="bg-emerald-50 text-xs uppercase tracking-wide text-emerald-900"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Odômetro</th><th className="px-4 py-3">Combustível</th><th className="px-4 py-3">Valor / litros</th><th className="px-4 py-3">Consumo</th></tr></thead><tbody className="divide-y divide-slate-100">{fuelHistory.map((fuel: any) => <tr key={fuel.id}><td className="px-4 py-3 text-slate-600">{formatDateTime(fuel.createdAt)}</td><td className="px-4 py-3 font-medium text-slate-900">{Number(fuel.odometerKm).toLocaleString("pt-BR")} km</td><td className="px-4 py-3 text-slate-600">{formatFuelType(fuel.fuelType)}</td><td className="px-4 py-3 text-slate-600">{formatCurrency(fuel.amount)} · {Number(fuel.liters).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} L</td><td className="px-4 py-3">{fuel.consumptionKmPerLiter != null ? <><p className="font-semibold text-emerald-800">{Number(fuel.consumptionKmPerLiter).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km/L</p><p className="mt-1 text-xs text-slate-500">{formatCurrency(fuel.costPerKm)}/km · {Number(fuel.distanceSincePrevious).toLocaleString("pt-BR")} km percorridos</p></> : <span className="text-slate-500">Aguardando próximo abastecimento</span>}</td></tr>)}</tbody></table></div>}
    </>}
  </section>;
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof Activity; tone: "blue" | "emerald" | "amber" | "indigo" | "slate" | "red" }) {
  const colors = { blue: "bg-blue-50 text-blue-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", indigo: "bg-indigo-50 text-indigo-700", slate: "bg-slate-100 text-slate-700", red: "bg-rose-50 text-rose-700" };
  return <Card className="border-slate-200 shadow-sm"><CardContent className="p-5"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[tone]}`}><Icon className="h-5 w-5" /></div><p className="mt-5 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-sm text-slate-500">{label}</p></CardContent></Card>;
}

function LoadingRows() { return <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Atualizando dados operacionais...</div>; }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="p-10 text-center"><MapPin className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-3 font-semibold text-slate-800">{title}</p><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p></div>; }
