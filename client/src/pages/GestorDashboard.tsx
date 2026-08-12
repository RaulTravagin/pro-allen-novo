import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Activity, CheckCircle2, Clock3, Crosshair, Gauge, Loader2, LogOut, MapPin, Radio, Route, ShieldCheck, UsersRound } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

const REFRESH_INTERVAL = 15_000;

function formatTime(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
}

function formatCoordinates(latitude: unknown, longitude: unknown) {
  if (latitude == null || longitude == null) return "GPS ainda não recebido";
  return `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
}

function routeStatus(status: string) {
  const config = {
    pending: { label: "Aguardando início", className: "bg-slate-100 text-slate-700" },
    in_progress: { label: "Em operação", className: "bg-emerald-100 text-emerald-800" },
    completed: { label: "Concluída", className: "bg-blue-100 text-blue-800" },
    cancelled: { label: "Cancelada", className: "bg-rose-100 text-rose-800" },
  } as const;
  return config[status as keyof typeof config] ?? config.pending;
}

export default function GestorDashboard() {
  const [, navigate] = useLocation();
  const { data: session, isLoading: isCheckingSession } = trpc.gestorAccess.session.useQuery(undefined, { retry: false, refetchInterval: REFRESH_INTERVAL });
  const dashboard = trpc.gestor.dashboard.useQuery(undefined, { enabled: !!session?.authenticated, retry: false, refetchInterval: REFRESH_INTERVAL, refetchOnWindowFocus: true });
  const logout = trpc.gestorAccess.logout.useMutation({ onSuccess: () => navigate("/gestor/acesso") });

  useEffect(() => {
    if (!isCheckingSession && !session?.authenticated) navigate("/gestor/acesso");
  }, [isCheckingSession, navigate, session?.authenticated]);

  if (isCheckingSession || !session?.authenticated) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Conferindo acesso do Gestor...</div>;
  }

  const data = dashboard.data;
  const metrics = data?.metrics;
  const updatedAt = data?.lastUpdatedAt ? new Date(data.lastUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">PR</div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Visão executiva</p><h1 className="text-2xl font-bold tracking-tight">Painel do Gestor</h1></div></div>
          <div className="flex flex-wrap items-center gap-3"><div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"><Radio className="h-3.5 w-3.5" /> Atualização automática a cada 15 s</div><Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending} className="gap-2"><LogOut className="h-4 w-4" /> Sair</Button></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-7 sm:px-6 lg:px-8">
        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/10 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><Activity className="h-4 w-4" /> Acompanhamento ao vivo</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">A operação de campo em uma única tela.</h2><p className="mt-3 max-w-2xl text-slate-300">Monitore a execução das rotas, a presença nos postos, a quilometragem e os últimos pontos de GPS informados pelos supervisores.</p></div><p className="text-sm text-slate-400">Última atualização: <span className="font-semibold text-white">{updatedAt}</span></p></div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Supervisores em rota" value={metrics?.supervisorsOnRoute ?? 0} icon={UsersRound} tone="blue" />
          <MetricCard label="Rotas em operação" value={metrics?.activeRoutes ?? 0} icon={Route} tone="emerald" />
          <MetricCard label="Postos em atendimento" value={metrics?.visitsInProgress ?? 0} icon={Activity} tone="amber" />
          <MetricCard label="Visitas concluídas" value={metrics?.completedVisits ?? 0} icon={CheckCircle2} tone="indigo" />
          <MetricCard label="KM percorridos" value={`${(metrics?.totalKm ?? 0).toLocaleString("pt-BR")} km`} icon={Gauge} tone="slate" />
        </section>

        <section className="grid gap-7 xl:grid-cols-[1.45fr_.85fr]">
          <Card className="border-slate-200 shadow-sm"><CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2"><Route className="h-5 w-5 text-blue-700" /> Rotas e supervisores</CardTitle><CardDescription>Atualização baseada nos registros operacionais de hoje.</CardDescription></CardHeader><CardContent className="p-0">
            {dashboard.isLoading ? <LoadingRows /> : data?.activeRoutes.length ? <div className="divide-y divide-slate-100">{data.activeRoutes.map((route) => { const status = routeStatus(route.status); const progress = route.totalPosts ? Math.round((route.completedVisits / route.totalPosts) * 100) : 0; return <article className="space-y-4 p-5" key={route.id}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-lg font-semibold">{route.routeName}</p><p className="mt-1 text-sm text-slate-500">{route.routeRegion} · Supervisor em campo #{route.supervisorId}</p></div><Badge className={status.className}>{status.label}</Badge></div><div className="grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Postos</p><p className="mt-1 font-medium text-slate-800">{route.completedVisits}/{route.totalPosts} concluídos</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Atendimento atual</p><p className="mt-1 font-medium text-slate-800">{route.activeVisit?.postName || "Nenhum posto em atendimento"}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Viatura</p><p className="mt-1 font-medium text-slate-800">{route.kmInitial != null ? `${Number(route.kmInitial).toLocaleString("pt-BR")} km inicial` : "KM inicial não registrado"}</p></div></div><Progress value={progress} className="h-2" /><div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><Crosshair className="h-3.5 w-3.5 text-blue-700" /> {formatCoordinates(route.latestLocation?.latitude, route.latestLocation?.longitude)} <span className="text-slate-300">|</span> GPS: {formatTime(route.latestLocation?.recordedAt)}</div></article>; })}</div> : <EmptyState title="Nenhuma rota registrada hoje" description="Quando um supervisor preparar a rota diária, o acompanhamento aparecerá aqui." />}
          </CardContent></Card>

          <Card className="border-slate-200 shadow-sm"><CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-emerald-700" /> Atividade recente</CardTitle><CardDescription>Chegadas, atendimentos e saídas registradas hoje.</CardDescription></CardHeader><CardContent className="p-0">
            {dashboard.isLoading ? <LoadingRows /> : data?.recentVisits.length ? <div className="divide-y divide-slate-100">{data.recentVisits.map((visit) => <article key={visit.id} className="flex gap-3 p-5"><div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${visit.status === "in_progress" ? "bg-amber-400" : "bg-emerald-500"}`} /><div className="min-w-0"><p className="font-semibold text-slate-900">{visit.postName}</p><p className="mt-1 text-sm text-slate-500">{visit.postRegion}</p><p className="mt-2 text-xs font-medium text-slate-600">{visit.status === "in_progress" ? `Em atendimento desde ${formatTime(visit.arrivalTime)}` : `Saída registrada às ${formatTime(visit.departureTime)}`}</p></div></article>)}</div> : <EmptyState title="Sem atividade recente" description="Os registros de chegada e saída dos postos aparecerão nesta área." />}
          </CardContent></Card>
        </section>

        <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 text-sm text-blue-950"><p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Acesso do Gestor protegido</p><p className="mt-1 text-blue-800">Este painel é somente de acompanhamento. Os registros de chegada, saída, checklist e KM continuam sendo feitos pelo supervisor na operação de campo.</p></section>
      </div>
    </main>
  );
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof Activity; tone: "blue" | "emerald" | "amber" | "indigo" | "slate" }) {
  const colors = { blue: "bg-blue-50 text-blue-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", indigo: "bg-indigo-50 text-indigo-700", slate: "bg-slate-100 text-slate-700" };
  return <Card className="border-slate-200 shadow-sm"><CardContent className="p-5"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[tone]}`}><Icon className="h-5 w-5" /></div><p className="mt-5 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-sm text-slate-500">{label}</p></CardContent></Card>;
}

function LoadingRows() { return <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Atualizando dados operacionais...</div>; }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="p-10 text-center"><MapPin className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-3 font-semibold text-slate-800">{title}</p><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p></div>; }
