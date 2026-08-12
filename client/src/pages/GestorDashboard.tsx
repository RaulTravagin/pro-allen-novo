import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Activity, AlertTriangle, Car, CheckCircle2, ChevronDown, ClipboardCheck, Clock3, Crosshair, Gauge, Loader2, LogOut, MapPin, Navigation, Radio, Route, ShieldCheck, TimerReset, UsersRound, XCircle } from "lucide-react";
import React, { useEffect } from "react";
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

function formatDuration(minutes: number | null | undefined) {
  if (minutes == null) return "—";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder}min` : `${remainder} min`;
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

function operationStatus(status: string) {
  const config: Record<string, { label: string; className: string }> = {
    sem_rota: { label: "Sem rota hoje", className: "bg-slate-100 text-slate-700" },
    aguardando_km: { label: "Aguardando KM", className: "bg-blue-100 text-blue-800" },
    em_deslocamento: { label: "Em deslocamento", className: "bg-cyan-100 text-cyan-800" },
    em_atendimento: { label: "Em atendimento", className: "bg-amber-100 text-amber-800" },
    rota_concluida: { label: "Rota concluída", className: "bg-emerald-100 text-emerald-800" },
    rota_cancelada: { label: "Rota cancelada", className: "bg-rose-100 text-rose-800" },
  };
  return config[status] ?? config.sem_rota;
}

function alertAppearance(severity: string) {
  return severity === "critical" ? "border-rose-200 bg-rose-50 text-rose-950" : severity === "warning" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-blue-200 bg-blue-50 text-blue-950";
}

export default function GestorDashboard() {
  const [, navigate] = useLocation();
  const sessionQuery = trpc.gestorAccess.session.useQuery(undefined, { retry: false, refetchInterval: REFRESH_INTERVAL, refetchOnMount: "always" });
  const { data: session, isLoading: isCheckingSession } = sessionQuery;
  const hasConfirmedGestorSession = sessionQuery.isFetchedAfterMount && sessionQuery.isSuccess && session?.authenticated === true;
  const dashboard = trpc.gestor.dashboard.useQuery(undefined, { enabled: hasConfirmedGestorSession, retry: false, refetchInterval: REFRESH_INTERVAL, refetchOnWindowFocus: true });
  const logout = trpc.gestorAccess.logout.useMutation({ onSuccess: () => navigate("/gestor/acesso") });

  useEffect(() => {
    if (sessionQuery.isFetchedAfterMount && !isCheckingSession && !session?.authenticated) navigate("/gestor/acesso");
  }, [isCheckingSession, navigate, session?.authenticated, sessionQuery.isFetchedAfterMount]);

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
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">PR</div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Central operacional</p><h1 className="text-2xl font-bold tracking-tight">Painel do Gestor</h1></div></div>
          <div className="flex flex-wrap items-center gap-3"><div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"><Radio className="h-3.5 w-3.5" /> Atualização automática a cada 15 s</div><Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending} className="gap-2"><LogOut className="h-4 w-4" /> Sair</Button></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-7 sm:px-6 lg:px-8">
        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/10 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><Activity className="h-4 w-4" /> Monitoramento de ponta a ponta</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Toda a operação de campo, supervisor por supervisor.</h2><p className="mt-3 max-w-3xl text-slate-300">Acompanhe rotas, atendimentos, postos pendentes, checklist, horários, observações, quilometragem, GPS e exceções operacionais em uma única central.</p></div><p className="text-sm text-slate-400">Última atualização: <span className="font-semibold text-white">{updatedAt}</span></p></div>
        </section>

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

        <section className="space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Acompanhamento por supervisor</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Situação detalhada da equipe</h2><p className="mt-1 text-sm text-slate-600">Abra cada supervisor para consultar a rota, os postos, o checklist, os horários, o GPS e a viatura.</p></div>
          {dashboard.isLoading ? <LoadingRows /> : supervisors.length ? <div className="space-y-4">{supervisors.map((supervisor) => <SupervisorOperationalCard key={supervisor.supervisorId} supervisor={supervisor} />)}</div> : <EmptyState title="Nenhum supervisor cadastrado" description="Os supervisores aparecerão nesta área quando tiverem acesso operacional configurado." />}
        </section>

        <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 text-sm text-blue-950"><p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Central do Gestor protegida</p><p className="mt-1 text-blue-800">O Gestor acompanha a operação sem alterar registros de campo. Chegadas, saídas, checklist, observações, KM e GPS continuam sendo registrados pelo supervisor.</p></section>
      </div>
    </main>
  );
}

function SupervisorOperationalCard({ supervisor }: { supervisor: any }) {
  const route = supervisor.route;
  const status = operationStatus(supervisor.status);
  const progress = route?.totalPosts ? Math.round((route.completedVisits / route.totalPosts) * 100) : 0;
  const gpsDescription = supervisor.latestLocation ? `${formatCoordinates(supervisor.latestLocation.latitude, supervisor.latestLocation.longitude)} · ${supervisor.latestLocation.accuracy != null ? `precisão ${Number(supervisor.latestLocation.accuracy).toFixed(0)} m` : "precisão não informada"}` : "GPS ainda não recebido";

  return <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm" open={supervisor.status === "em_atendimento" || supervisor.status === "em_deslocamento"}>
    <summary className="flex cursor-pointer list-none flex-col gap-4 p-5 marker:content-none sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">{String(supervisor.supervisorName ?? "S").slice(0, 2).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-lg font-semibold text-slate-950">{supervisor.supervisorName}</p><p className="mt-0.5 truncate text-sm text-slate-500">{supervisor.supervisorUsername ? `@${supervisor.supervisorUsername}` : "Usuário operacional"} {route ? `· ${route.routeName}` : ""}</p></div></div><div className="flex flex-wrap items-center gap-2"><Badge className={status.className}>{status.label}</Badge>{route && <span className="text-sm font-medium text-slate-700">{route.completedVisits}/{route.totalPosts} postos</span>}<ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-200 group-open:rotate-180" /></div></summary>
    <div className="border-t border-slate-100 p-5">
      {!route ? <EmptyState title="Nenhuma rota preparada hoje" description="Ainda não há registros de rota para este supervisor no dia de hoje." /> : <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-4"><InfoBlock icon={Route} label="Rota" value={`${route.routeName} · ${route.routeRegion}`} detail={route.startedAt ? `Iniciada às ${formatTime(route.startedAt)}` : "Ainda não iniciada"} /><InfoBlock icon={Activity} label="Atendimento atual" value={route.activeVisit?.postName ?? "Em deslocamento"} detail={route.activeVisit ? `Desde ${formatTime(route.activeVisit.arrivalTime)} · ${formatDuration(route.activeVisit.durationMinutes)}` : route.nextPost ? `Próximo: ${route.nextPost.postName}` : "Sem próximos postos"} /><InfoBlock icon={Car} label="Viatura e KM" value={route.kmInitial != null ? `${Number(route.kmInitial).toLocaleString("pt-BR")} km inicial` : "KM inicial pendente"} detail={route.kmFinal != null ? `${Number(route.kmFinal).toLocaleString("pt-BR")} km final · ${Number(route.kmCovered ?? 0).toLocaleString("pt-BR")} km rodados` : "KM final não informado"} /><InfoBlock icon={Crosshair} label="Último GPS" value={supervisor.latestLocation ? `${supervisor.latestLocation.recordedAt ? `há ${route.gpsAgeMinutes ?? 0} min` : "recebido"}` : "Sem localização"} detail={gpsDescription} /></div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-900">Progresso da rota</p><p className="mt-1 text-sm text-slate-600">{route.completedVisits} concluídos · {route.pendingVisits} pendentes · {route.skippedVisits} não realizados</p></div><p className="text-sm font-bold text-slate-950">{progress}%</p></div><Progress value={progress} className="mt-3 h-2" /></div>
        {supervisor.alerts.length > 0 && <div className="flex flex-wrap gap-2">{supervisor.alerts.map((alert: any, index: number) => <Badge key={`${alert.code}-${index}`} variant="outline" className={alertAppearance(alert.severity)}>{alert.title}</Badge>)}</div>}
        <div><div className="mb-3 flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-blue-700" /><h3 className="font-semibold text-slate-950">Postos e checklist da rota</h3></div><div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-[880px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Posto</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Horários</th><th className="px-4 py-3">Checklist</th><th className="px-4 py-3">Observações</th></tr></thead><tbody className="divide-y divide-slate-100">{route.checklistVisits.map((visit: any) => { const visitStatus = checklistStatus(visit.status); return <tr key={visit.id} className="align-top"><td className="px-4 py-4"><p className="font-semibold text-slate-900">{visit.postName}</p><p className="mt-1 text-xs text-slate-500">{visit.postRegion}{visit.postAddress ? ` · ${visit.postAddress}` : ""}</p></td><td className="px-4 py-4"><Badge className={visitStatus.className}>{visitStatus.label}</Badge>{visit.status === "in_progress" && <p className="mt-2 text-xs font-medium text-amber-700">{formatDuration(visit.durationMinutes)}</p>}</td><td className="px-4 py-4 text-xs text-slate-600"><p>Chegada: {formatTime(visit.arrivalTime)}</p><p className="mt-1">Saída: {formatTime(visit.departureTime)}</p><p className="mt-1">Registro: {formatDateTime(visit.visitedAt ?? visit.arrivalTime)}</p></td><td className="px-4 py-4 text-xs text-slate-600"><p>{visit.checklistSummary.compliant}/{visit.checklistSummary.total} conforme</p>{visit.checklistSummary.nonCompliant > 0 && <p className="mt-1 font-semibold text-rose-700">{visit.checklistSummary.nonCompliant} não conforme</p>}<p className="mt-1">{visit.checklistSummary.unanswered} sem resposta</p></td><td className="max-w-[240px] px-4 py-4 text-xs leading-5 text-slate-600">{visit.observations || "Sem observações"}</td></tr>; })}</tbody></table></div></div>
      </div>}
    </div>
  </details>;
}

function InfoBlock({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail: string }) {
  return <div className="rounded-xl border border-slate-200 p-4"><Icon className="h-4 w-4 text-blue-700" /><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-900">{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div>;
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof Activity; tone: "blue" | "emerald" | "amber" | "indigo" | "slate" | "red" }) {
  const colors = { blue: "bg-blue-50 text-blue-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", indigo: "bg-indigo-50 text-indigo-700", slate: "bg-slate-100 text-slate-700", red: "bg-rose-50 text-rose-700" };
  return <Card className="border-slate-200 shadow-sm"><CardContent className="p-5"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[tone]}`}><Icon className="h-5 w-5" /></div><p className="mt-5 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-sm text-slate-500">{label}</p></CardContent></Card>;
}

function LoadingRows() { return <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Atualizando dados operacionais...</div>; }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="p-10 text-center"><MapPin className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-3 font-semibold text-slate-800">{title}</p><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p></div>; }
