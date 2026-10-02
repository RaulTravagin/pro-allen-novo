import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, ArrowRight, Building2, CheckCircle2, ClipboardCheck, Clock3, ListChecks, Loader2, MapPin, Route as RouteIcon, ShieldCheck } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { supervisorErrorMessage } from "@/lib/networkFeedback";
import { canMutateSupervisorOperations, isAdminOperationalViewer } from "@/lib/supervisor-access";

const LIVE_OPERATION_REFRESH_INTERVAL = 15_000;

function formatOperationDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function operationVisitLabel(status: string) {
  return ({ pending: "Pendente", in_progress: "Em atendimento", visited: "Concluído", skipped: "Não realizado" } as Record<string, string>)[status] ?? status;
}

function operationStatusLabel(status: string | undefined) {
  return ({ sem_rota: "Sem rota", pending: "Aguardando início", in_progress: "Em deslocamento", completed: "Concluída", cancelled: "Cancelada", em_atendimento: "Em atendimento", em_deslocamento: "Em deslocamento", em_base_operacional: "Na Base Operacional", rota_concluida: "Rota concluída", base_concluida: "Base concluída", rota_cancelada: "Rota cancelada" } as Record<string, string>)[status ?? ""] ?? status ?? "Sem atividade";
}

export function describeRoutePosts(route: { posts?: Array<{ name: string }> }) {
  return route.posts?.length ? `Postos: ${route.posts.map((post) => post.name).join(", ")}` : "Postos: nenhum posto cadastrado";
}

export default function SupervisorDashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const isAdminReadOnly = isAdminOperationalViewer(user);
  const canManageOperations = canMutateSupervisorOperations(user);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [hasAttemptedAutomaticResume, setHasAttemptedAutomaticResume] = useState(false);

  const adminLiveQuery = trpc.adminOperations.liveSnapshot.useQuery(undefined, {
    enabled: isAdminReadOnly,
    retry: false,
    refetchInterval: isAdminReadOnly ? LIVE_OPERATION_REFRESH_INTERVAL : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
  const routesQuery = trpc.routes.list.useQuery(undefined, { retry: false, enabled: canManageOperations });
  const todayRouteQuery = trpc.supervisorRoutes.getTodayRoute.useQuery(undefined, { retry: false, enabled: canManageOperations });
  const todayHistoryQuery = trpc.supervisorRoutes.getTodayHistory.useQuery(undefined, { retry: false, enabled: canManageOperations });
  const { data: routes, isLoading: routesLoading } = routesQuery;
  const { data: todayRoute, isLoading: todayRouteLoading } = todayRouteQuery;
  const { data: todayHistory, isLoading: todayHistoryLoading } = todayHistoryQuery;
  const routeLoadError = routesQuery.error ?? todayRouteQuery.error ?? todayHistoryQuery.error;
  const selectedRoute = routes?.find((route) => route.id === Number(selectedRouteId));
  const selectedRoutePosts = selectedRoute?.posts ?? [];
  const isBaseOperational = selectedRoute?.activityType === "operational_base";
  const completedBase = todayHistory?.find((route) => route.routeActivityType === "operational_base" && route.status === "completed");
  const selectableRoutes = routes?.filter((route) => route.activityType !== "operational_base" || !completedBase);

  const createRouteMutation = trpc.supervisorRoutes.create.useMutation();
  const createChecklistsMutation = trpc.checklists.createForRoute.useMutation();

  const handleStartRoute = async () => {
    if (todayRoute) {
      try {
        await createChecklistsMutation.mutateAsync({ supervisorRouteId: todayRoute.id });
        await utils.checklists.getByRoute.invalidate({ supervisorRouteId: todayRoute.id });
        navigate(`/supervisor/route/${todayRoute.id}`);
      } catch (error) {
        console.error("Open route error:", error);
        toast.error("Não foi possível abrir a rota existente");
      }
      return;
    }

    const routeId = Number(selectedRouteId);
    if (!Number.isInteger(routeId) || routeId <= 0) {
      toast.error("Selecione uma rota antes de continuar");
      return;
    }

    try {
      const supervisorRouteId = await createRouteMutation.mutateAsync({
        routeId,
        date: new Date(),
      });
      await createChecklistsMutation.mutateAsync({ supervisorRouteId });
      await utils.supervisorRoutes.getTodayRoute.invalidate();
      await utils.supervisorRoutes.getTodayHistory.invalidate();
      toast.success(isBaseOperational ? "Base Operacional preparada. Informe o KM inicial para iniciar a atividade." : "Rota preparada. Informe o KM inicial para começar.");
      navigate(`/supervisor/route/${supervisorRouteId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível criar a rota";
      toast.error(message);
    }
  };

  const handleContinueRoute = () => {
    if (!todayRoute) {
      toast.error("Nenhuma rota aberta encontrada para hoje");
      return;
    }
    navigate(`/supervisor/route/${todayRoute.id}`);
  };

  useEffect(() => {
    if (!canManageOperations || hasAttemptedAutomaticResume || !todayRoute || todayRoute.status !== "in_progress") return;
    setHasAttemptedAutomaticResume(true);
    navigate(`/supervisor/route/${todayRoute.id}`);
  }, [canManageOperations, hasAttemptedAutomaticResume, navigate, todayRoute?.id, todayRoute?.status]);

  const isStarting = createRouteMutation.isPending || createChecklistsMutation.isPending;

  if (isAdminReadOnly) {
    const visits = adminLiveQuery.data?.visits ?? [];

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <header className="border-b border-slate-200 bg-white/95">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Operação em campo · leitura administrativa</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Monitoramento operacional em tempo real</h1>
              <p className="mt-1 text-sm text-slate-600">Posto, status e horários de chegada/saída. Atualização automática a cada 15 segundos.</p>
            </div>
            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
              <Button onClick={() => navigate("/admin")} variant="outline">Painel administrativo</Button>
              <Button onClick={() => logout()} variant="outline">Sair</Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
            <span><ShieldCheck className="mr-2 inline h-4 w-4" />Acesso somente para consulta; ações operacionais permanecem exclusivas do Supervisor.</span>
            <span>Atualização automática a cada 15 segundos.</span>
          </div>

          {adminLiveQuery.error && <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"><span>{supervisorErrorMessage(adminLiveQuery.error, "Não foi possível carregar o monitoramento operacional.")}</span><Button type="button" size="sm" variant="outline" onClick={() => void adminLiveQuery.refetch()} className="border-red-300 bg-white text-red-900">Tentar novamente</Button></div>}
          {adminLiveQuery.isLoading ? <div className="flex items-center gap-2 py-8 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Carregando dados operacionais...</div> : (
            <section aria-label="Postos, status e horários" className="overflow-x-auto rounded-lg border bg-white">
              {visits.length === 0 ? <p className="py-8 text-center text-sm text-slate-600">Nenhum registro de visita no período atual.</p> : (
                <table className="min-w-[620px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Posto</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Chegada</th><th className="px-3 py-2">Saída</th></tr></thead>
                  <tbody className="divide-y">{visits.map((visit, index) => <tr key={`${visit.postName}-${index}`}><td className="px-3 py-3 font-medium text-slate-900">{visit.postName}</td><td className="px-3 py-3">{operationVisitLabel(visit.status)}</td><td className="px-3 py-3">{formatOperationDateTime(visit.arrivalTime)}</td><td className="px-3 py-3">{formatOperationDateTime(visit.departureTime)}</td></tr>)}</tbody>
                </table>
              )}
            </section>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <header className="border-b border-slate-200 bg-white/95">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Operação em campo</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Dashboard do Supervisor</h1>
            <p className="mt-1 text-sm text-slate-600">Organize sua visita de hoje.</p>
          </div>
          <div className="flex flex-wrap gap-2 self-start sm:self-auto">
            <Button onClick={() => navigate("/pessoal")} variant="outline"><ClipboardCheck className="mr-2 h-4 w-4" />Gestão de pessoal</Button>
            {user?.role === "admin" && (
              <Button onClick={() => navigate("/admin")} variant="outline">Painel administrativo</Button>
            )}
            <Button onClick={() => logout()} variant="outline">Sair</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8">
        {todayRoute && (
          <Card className="border-emerald-200 bg-emerald-50/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-emerald-950">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Atividade aberta para hoje
              </CardTitle>
              <CardDescription className="text-emerald-800">Continue de onde parou ou registre o KM inicial na tela da rota.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-emerald-900">
                <span className="font-semibold">{todayRoute.routeActivityType === "operational_base" ? "Base Operacional" : todayRoute.routeName ?? "Rota"}:</span> {todayRoute.status === "in_progress" ? "em andamento" : "pendente de início"}
              </div>
              <Button onClick={handleContinueRoute} className="bg-emerald-600 hover:bg-emerald-700">
                Continuar rota <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {!todayRoute && (
          <Card className="border-blue-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-950"><RouteIcon className="h-5 w-5 text-blue-600" />{completedBase ? "Iniciar rota de campo" : "Iniciar atividade"}</CardTitle>
              <CardDescription>{completedBase ? "A Base Operacional já foi encerrada. Selecione a rota de campo que será iniciada agora." : "Selecione uma rota de campo ou a Base Operacional e confirme. A criação não acontece apenas ao abrir o seletor."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {completedBase && <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950"><p className="font-semibold">Base Operacional encerrada</p><p className="mt-1">KM final registrado às {completedBase.completedAt ? new Date(completedBase.completedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}. Agora escolha uma rota de campo para continuar o turno.</p></div>}
              {routesLoading || todayRouteLoading || todayHistoryLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Carregando rotas...</div>
              ) : routeLoadError ? (
                <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{supervisorErrorMessage(routeLoadError, "Não foi possível carregar as informações da operação.")}</span><Button type="button" size="sm" variant="outline" onClick={() => void Promise.all([routesQuery.refetch(), todayRouteQuery.refetch(), todayHistoryQuery.refetch()])} className="border-red-300 bg-white text-red-900">Tentar novamente</Button></div>
              ) : (
                <>
                  <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                    <SelectTrigger aria-label="Selecionar rota" className="w-full"><SelectValue placeholder="Selecione uma rota..." /></SelectTrigger>
                    <SelectContent>
                      {selectableRoutes?.map((route) => (
                        <SelectItem key={route.id} value={route.id.toString()}>
                          <span className="flex max-w-[min(84vw,32rem)] items-start gap-2 py-0.5">
                            {route.activityType === "operational_base" ? <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" /> : <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />}
                            <span className="min-w-0">
                              <span className="block font-medium text-slate-900">{route.name} · {route.region}</span>
                              {route.activityType !== "operational_base" && <span className="mt-0.5 block truncate text-xs text-slate-500">{describeRoutePosts(route)}</span>}
                              {route.activityType === "operational_base" && <span className="mt-0.5 block text-xs text-violet-700">Atividade interna, sem postos de cliente</span>}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedRouteId && isBaseOperational ? (
                    <div className="rounded-lg border border-violet-100 bg-violet-50 p-4">
                      <div className="flex items-start gap-3"><Building2 className="mt-0.5 h-5 w-5 text-violet-700" /><div className="min-w-0 flex-1"><p className="font-semibold text-violet-950">Atividade em Base Operacional</p><p className="mt-1 text-sm text-violet-800">Nenhum posto de cliente ou checklist será criado. Registre o KM da viatura e mantenha a localização ativa durante a atividade.</p></div></div>
                    </div>
                  ) : selectedRouteId && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <ListChecks className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-blue-950">Pré-visualização da rota</p>
                          <p className="mt-1 text-sm text-blue-800"><span className="font-semibold">{selectedRoutePosts.length} postos</span> serão preparados para a atividade. Confira abaixo antes de iniciar.</p>
                        </div>
                      </div>
                      {selectedRoutePosts.length ? <ol className="mt-4 grid gap-2 sm:grid-cols-2" aria-label={`Postos da ${selectedRoute?.name}`}>
                        {selectedRoutePosts.map((post, index) => <li key={post.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-blue-100 bg-white/80 px-3 py-2 text-sm text-slate-800"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">{index + 1}</span><span className="truncate font-medium">{post.name}</span><span className="ml-auto shrink-0 text-xs text-slate-500">{post.region}</span></li>)}
                      </ol> : <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Esta rota ainda não possui postos cadastrados. Confirme com o Gestor antes de iniciar.</p>}
                    </div>
                  )}

                  <Button onClick={handleStartRoute} disabled={!selectedRouteId || isStarting} className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto">
                    {isStarting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparando...</> : <>{isBaseOperational ? "Preparar atividade na base" : completedBase ? "Iniciar rota de campo" : "Preparar rota"} <ArrowRight className="ml-2 h-4 w-4" /></>}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <section aria-label="Resumo da operação" className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600"><RouteIcon className="h-4 w-4" />Rotas disponíveis</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-slate-950">{routes?.length ?? 0}</p><p className="mt-1 text-xs text-slate-500">Rotas cadastradas</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">{isBaseOperational ? <Building2 className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}{isBaseOperational ? "Atividade selecionada" : "Postos na rota selecionada"}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-slate-950">{selectedRouteId ? isBaseOperational ? "Base" : selectedRoutePosts.length : "—"}</p><p className="mt-1 text-xs text-slate-500">{isBaseOperational ? "Sem postos de cliente" : selectedRouteId ? "Lista exibida antes da confirmação" : "Selecione uma rota para consultar"}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600"><Clock3 className="h-4 w-4" />KM do dia</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-slate-950">—</p><p className="mt-1 text-xs text-slate-500">Disponível após encerrar a rota</p></CardContent></Card>
        </section>
      </main>
    </div>
  );
}
