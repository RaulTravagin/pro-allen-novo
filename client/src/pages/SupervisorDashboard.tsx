import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, ArrowRight, Building2, CheckCircle2, Clock3, Loader2, MapPin, Route as RouteIcon, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function SupervisorDashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");

  const { data: routes, isLoading: routesLoading, isError: routesError } = trpc.routes.list.useQuery();
  const { data: todayRoute, isLoading: todayRouteLoading } = trpc.supervisorRoutes.getTodayRoute.useQuery();
  const selectedRoute = routes?.find((route) => route.id === Number(selectedRouteId));
  const isBaseOperational = selectedRoute?.activityType === "operational_base";
  const { data: selectedPosts } = trpc.routes.getPostsByRoute.useQuery(
    { routeId: Number(selectedRouteId) },
    { enabled: Boolean(selectedRouteId) },
  );

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

  const isStarting = createRouteMutation.isPending || createChecklistsMutation.isPending;

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
              <CardTitle className="flex items-center gap-2 text-slate-950"><RouteIcon className="h-5 w-5 text-blue-600" />Iniciar atividade</CardTitle>
              <CardDescription>Selecione uma rota de campo ou a Base Operacional e confirme. A criação não acontece apenas ao abrir o seletor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {routesLoading || todayRouteLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Carregando rotas...</div>
              ) : routesError ? (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="h-4 w-4" />Não foi possível carregar as rotas.</div>
              ) : (
                <>
                  <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                    <SelectTrigger aria-label="Selecionar rota" className="w-full"><SelectValue placeholder="Selecione uma rota..." /></SelectTrigger>
                    <SelectContent>
                      {routes?.map((route) => (
                        <SelectItem key={route.id} value={route.id.toString()}>
                          <span className="flex items-center gap-2">{route.activityType === "operational_base" ? <Building2 className="h-4 w-4 text-violet-700" /> : <MapPin className="h-4 w-4" />}{route.name} · {route.region}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedRouteId && isBaseOperational ? (
                    <div className="rounded-lg border border-violet-100 bg-violet-50 p-4">
                      <div className="flex items-start gap-3"><Building2 className="mt-0.5 h-5 w-5 text-violet-700" /><div className="min-w-0 flex-1"><p className="font-semibold text-violet-950">Atividade em Base Operacional</p><p className="mt-1 text-sm text-violet-800">Nenhum posto de cliente ou checklist será criado. Registre o KM da viatura e mantenha a localização ativa durante a atividade.</p></div></div>
                    </div>
                  ) : selectedRouteId && (
                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-600" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-blue-950">{selectedPosts?.length ?? 0} postos nesta rota</p>
                          <p className="mt-1 text-sm text-blue-800">Os endereços serão exibidos quando forem cadastrados. Confirme para preparar os checklists.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button onClick={handleStartRoute} disabled={!selectedRouteId || isStarting} className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto">
                    {isStarting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparando...</> : <>{isBaseOperational ? "Preparar atividade na base" : "Preparar rota"} <ArrowRight className="ml-2 h-4 w-4" /></>}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <section aria-label="Resumo da operação" className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600"><RouteIcon className="h-4 w-4" />Rotas disponíveis</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-slate-950">{routes?.length ?? 0}</p><p className="mt-1 text-xs text-slate-500">Rotas cadastradas</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">{isBaseOperational ? <Building2 className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}{isBaseOperational ? "Atividade selecionada" : "Postos na rota selecionada"}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-slate-950">{selectedRouteId ? isBaseOperational ? "Base" : selectedPosts?.length ?? 0 : "—"}</p><p className="mt-1 text-xs text-slate-500">{isBaseOperational ? "Sem postos de cliente" : "Selecione uma rota para consultar"}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600"><Clock3 className="h-4 w-4" />KM do dia</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-slate-950">—</p><p className="mt-1 text-xs text-slate-500">Disponível após encerrar a rota</p></CardContent></Card>
        </section>
      </main>
    </div>
  );
}
