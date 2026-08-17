import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Building2, Fuel, Clock, AlertCircle, Route } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import PostCard from "@/components/PostCard";

interface RouteDetailsProps {
  params: {
    supervisorRouteId: string;
  };
}

export default function RouteDetails({ params }: RouteDetailsProps) {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const supervisorRouteId = parseInt(params.supervisorRouteId);
  
  const [kmInitial, setKmInitial] = useState<string>("");
  const [kmFinal, setKmFinal] = useState<string>("");
  const [showKmFinal, setShowKmFinal] = useState(false);
  const [gpsError, setGpsError] = useState<string>("");
  const [coveragePostId, setCoveragePostId] = useState("");
  const [coverageReason, setCoverageReason] = useState("");

  // Queries
  const { data: route, isLoading: routeLoading } = trpc.supervisorRoutes.getById.useQuery({ id: supervisorRouteId });
  const { data: checklists, isLoading: checklistsLoading } = trpc.checklists.getByRoute.useQuery({ supervisorRouteId });
  const activeChecklist = checklists?.find((checklist) => checklist.status === 'in_progress');
  const isBaseOperational = route?.routeActivityType === "operational_base";

  useEffect(() => {
    if (route?.status === 'completed') setShowKmFinal(false);
  }, [route?.status]);

  const { data: posts } = trpc.routes.getPostsByRoute.useQuery(
    { routeId: route?.routeId || 0 },
    { enabled: !!route?.routeId }
  );
  const { data: coveragePosts } = trpc.checklists.getCoveragePosts.useQuery(
    { supervisorRouteId },
    { enabled: route?.status === "in_progress" },
  );

  // Mutations
  const updateKmMutation = trpc.supervisorRoutes.updateKm.useMutation();
  const recordLocationMutation = trpc.locations.record.useMutation();
  const createChecklistsMutation = trpc.checklists.createForRoute.useMutation();
  const checkInMutation = trpc.checklists.checkIn.useMutation();
  const checkOutMutation = trpc.checklists.checkOut.useMutation();
  const createCoverageMutation = trpc.checklists.createCoverage.useMutation();

  useEffect(() => {
    if (!route || checklistsLoading || !posts?.length || (checklists?.length ?? 0) > 0 || createChecklistsMutation.isPending) {
      return;
    }

    void createChecklistsMutation.mutateAsync({ supervisorRouteId })
      .then(() => utils.checklists.getByRoute.invalidate({ supervisorRouteId }))
      .catch((error) => {
        console.error("Checklist creation error:", error);
        toast.error("Não foi possível preparar os postos da rota");
      });
  }, [route?.id, posts?.length, checklists?.length, checklistsLoading, supervisorRouteId, createChecklistsMutation, utils]);

  const captureCoordinates = () => new Promise<{ latitude?: number; longitude?: number }>((resolve) => {
    if (!navigator.geolocation) {
      setGpsError("Geolocalização não disponível neste navegador. A presença será registrada sem coordenadas.");
      resolve({});
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsError("");
        resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      (error) => {
        setGpsError("Não foi possível capturar a localização. A presença foi registrada sem coordenadas.");
        console.warn("Geolocation error:", error);
        resolve({});
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });

  const plannedPostCards = (posts ?? []).flatMap((post) => {
    const latestChecklist = (checklists ?? [])
      .filter((checklist) => checklist.postId === post.id && !checklist.isCoverage)
      .sort((a, b) => b.id - a.id)[0];
    return latestChecklist ? [{ post, checklist: latestChecklist }] : [];
  });
  const coveragePostById = new Map((coveragePosts ?? []).map((post) => [post.id, post]));
  const coveragePostCards = (checklists ?? [])
    .filter((checklist) => checklist.isCoverage)
    .map((checklist) => ({ post: coveragePostById.get(checklist.postId), checklist }));
  const postCards = [...plannedPostCards, ...coveragePostCards];

  const handleCreateCoverage = async () => {
    const postId = Number(coveragePostId);
    const reason = coverageReason.trim();
    if (!Number.isSafeInteger(postId) || postId <= 0) {
      toast.error("Selecione o posto que receberá a cobertura");
      return;
    }
    if (reason.length < 8) {
      toast.error("Justifique a cobertura com pelo menos 8 caracteres");
      return;
    }
    try {
      await createCoverageMutation.mutateAsync({ supervisorRouteId, postId, coverageReason: reason });
      await utils.checklists.getByRoute.invalidate({ supervisorRouteId });
      setCoveragePostId("");
      setCoverageReason("");
      toast.success("Cobertura adicionada. Registre a chegada no novo card.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar a cobertura");
    }
  };

  useEffect(() => {
    // Start recording GPS location periodically
    if (route && route.status === 'in_progress') {
      const interval = setInterval(() => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              recordLocationMutation.mutate({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                supervisorRouteId,
              });
              setGpsError("");
            },
            (error) => {
              setGpsError(`Erro de localização: ${error.message}`);
              console.error("Geolocation error:", error);
            }
          );
        } else {
          setGpsError("Geolocalização não disponível neste navegador");
        }
      }, 30000); // Record every 30 seconds

      return () => clearInterval(interval);
    }
  }, [route?.status, supervisorRouteId, recordLocationMutation]);

  const handleStartRoute = async () => {
    const initialKm = Number(kmInitial);
    if (!Number.isFinite(initialKm) || initialKm < 0) {
      toast.error("Por favor, informe o KM inicial");
      return;
    }
    
    try {
      await updateKmMutation.mutateAsync({
        id: supervisorRouteId,
        kmInitial: initialKm,
      });
      toast.success("Rota iniciada com sucesso!");
    } catch (error) {
      toast.error("Erro ao iniciar rota");
      console.error("Error starting route:", error);
    }
  };

  const handleEndRoute = async () => {
    const finalKm = Number(kmFinal);
    const initialKm = Number(kmInitial || route?.kmInitial);
    if (!Number.isFinite(finalKm) || finalKm < 0) {
      toast.error("Por favor, informe o KM final");
      return;
    }
    
    if (Number.isFinite(initialKm) && finalKm < initialKm) {
      toast.error("O KM final não pode ser menor que o KM inicial");
      return;
    }

    try {
      await updateKmMutation.mutateAsync({
        id: supervisorRouteId,
        kmFinal: finalKm,
      });
      setShowKmFinal(false);
      toast.success("Rota encerrada com sucesso!");
    } catch (error) {
      toast.error("Erro ao encerrar rota");
      console.error("Error ending route:", error);
    }
  };

  if (routeLoading || checklistsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Button onClick={() => window.location.href = '/supervisor'} variant="outline" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-900">Rota não encontrada</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button onClick={() => window.location.href = '/supervisor'} variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{isBaseOperational ? "Base Operacional" : "Detalhes da Rota"}</h1>
              <p className="text-gray-600 mt-1">{isBaseOperational ? "Atividade de apoio e operação interna" : "Status da rota"}: <span className="font-semibold text-blue-600">{route.status}</span></p>
            </div>
          </div>
          <Button onClick={() => logout()} variant="outline">
            Sair
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* GPS Error Alert */}
        {gpsError && (
          <Card className="mb-8 border-yellow-200 bg-yellow-50">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <CardTitle className="text-yellow-900">Aviso de Localização</CardTitle>
                  <p className="text-sm text-yellow-800 mt-1">{gpsError}</p>
                </div>
              </div>
            </CardHeader>
          </Card>
        )}

        <section className="mb-8" aria-labelledby="vehicle-control-title">
          <Card className="border-blue-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle id="vehicle-control-title" className="flex items-center gap-2">
                <Fuel className="h-5 w-5 text-blue-600" />
                Controle da viatura
              </CardTitle>
              <CardDescription>
                Registre aqui a quilometragem da viatura. Esta informação é independente dos postos visitados.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">KM inicial</p>
                {route.kmInitial == null ? (
                  <div className="mt-3 space-y-3">
                    <Label htmlFor="kmInitial">Leitura ao retirar a viatura</Label>
                    <Input
                      id="kmInitial"
                      type="number"
                      inputMode="decimal"
                      placeholder="Ex.: 15000"
                      value={kmInitial}
                      onChange={(e) => setKmInitial(e.target.value)}
                    />
                    <Button
                      onClick={handleStartRoute}
                      disabled={!kmInitial || updateKmMutation.isPending}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {updateKmMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</> : "Registrar KM inicial"}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-3 text-3xl font-bold text-slate-900">{Number(route.kmInitial).toLocaleString("pt-BR")} km</p>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">KM final</p>
                {route.kmFinal != null ? (
                  <div className="mt-3 space-y-1">
                    <p className="text-3xl font-bold text-slate-900">{Number(route.kmFinal).toLocaleString("pt-BR")} km</p>
                    <p className="text-sm text-slate-600">Total percorrido: {(Number(route.kmFinal) - Number(route.kmInitial ?? 0)).toFixed(2)} km</p>
                  </div>
                ) : route.status === "in_progress" ? (
                  showKmFinal ? (
                    <div className="mt-3 space-y-3">
                      <Label htmlFor="kmFinal">Leitura ao devolver a viatura</Label>
                      <Input
                        id="kmFinal"
                        type="number"
                        inputMode="decimal"
                        placeholder="Ex.: 15050"
                        value={kmFinal}
                        onChange={(e) => setKmFinal(e.target.value)}
                      />
                      {kmFinal && <p className="text-sm text-slate-600">Total estimado: {(Number(kmFinal) - Number(route.kmInitial ?? 0)).toFixed(2)} km</p>}
                      <Button onClick={handleEndRoute} disabled={!kmFinal || updateKmMutation.isPending} className="w-full bg-slate-900 hover:bg-slate-800">
                        {updateKmMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</> : "Registrar KM final"}
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={() => setShowKmFinal(true)} variant="outline" className="mt-3 w-full">Informar KM final</Button>
                  )
                ) : (
                  <p className="mt-3 text-sm text-slate-600">Disponível depois do registro do KM inicial.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {!isBaseOperational && <section className="mb-8" aria-labelledby="coverage-title">
          <Card className="border-violet-200 bg-violet-50/40 shadow-sm">
            <CardHeader>
              <CardTitle id="coverage-title" className="flex items-center gap-2 text-violet-950">
                <Route className="h-5 w-5 text-violet-700" />
                Cobertura fora da rota
              </CardTitle>
              <CardDescription>
                Use somente quando for necessário atender um posto não previsto nesta rota. A justificativa ficará disponível para o Gestor.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="coverage-post">Posto para cobertura</Label>
                <select
                  id="coverage-post"
                  value={coveragePostId}
                  onChange={(event) => setCoveragePostId(event.target.value)}
                  disabled={route.status !== "in_progress" || createCoverageMutation.isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Selecione um posto fora da rota</option>
                  {(coveragePosts ?? []).map((post) => <option key={post.id} value={post.id}>{post.name} · {post.region} ({post.routeName})</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="coverage-reason">Motivo da cobertura</Label>
                <Textarea
                  id="coverage-reason"
                  value={coverageReason}
                  onChange={(event) => setCoverageReason(event.target.value)}
                  placeholder="Ex.: Cobertura emergencial por ausência no posto"
                  disabled={route.status !== "in_progress" || createCoverageMutation.isPending}
                  className="min-h-10 resize-none"
                />
              </div>
              <Button
                type="button"
                onClick={handleCreateCoverage}
                disabled={route.status !== "in_progress" || !coveragePostId || coverageReason.trim().length < 8 || createCoverageMutation.isPending || Boolean(activeChecklist)}
                className="bg-violet-700 hover:bg-violet-800"
              >
                {createCoverageMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</> : "Adicionar cobertura"}
              </Button>
            </CardContent>
            {route.status !== "in_progress" && <CardContent className="pt-0 text-sm text-violet-800">Registre o KM inicial para liberar coberturas.</CardContent>}
            {activeChecklist && <CardContent className="pt-0 text-sm text-violet-800">Finalize a visita ativa antes de iniciar uma cobertura.</CardContent>}
          </Card>
        </section>}

        {/* Posts List */}
        {isBaseOperational ? <section className="mb-8" aria-labelledby="base-operational-title">
          <Card className="border-violet-200 bg-violet-50/50 shadow-sm">
            <CardHeader>
              <CardTitle id="base-operational-title" className="flex items-center gap-2 text-violet-950"><Building2 className="h-5 w-5 text-violet-700" /> Atividade em Base Operacional</CardTitle>
              <CardDescription>Esta atividade não possui postos de cliente ou checklist de visita. Registre o KM da viatura e mantenha a localização ativa enquanto estiver na base.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-violet-900">{route.status === "pending" ? "Informe o KM inicial para começar o registro da atividade na base." : route.status === "in_progress" ? "Atividade na base em andamento. Ao finalizar, informe o KM final para encerrar o registro do dia." : "Atividade na base encerrada."}</CardContent>
          </Card>
        </section> : <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Postos a Visitar</h2>
            <span className="text-sm text-gray-600">
              {postCards.filter(({ checklist }) => checklist.status === 'visited').length} / {postCards.length} postos concluídos
            </span>
          </div>

          {createChecklistsMutation.isPending && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="flex items-center gap-3 py-5 text-sm text-blue-900">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                Preparando os cards dos postos da rota...
              </CardContent>
            </Card>
          )}

          {!createChecklistsMutation.isPending && postCards.length === 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="flex flex-col gap-3 py-5 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                <span>Os postos ainda estão sendo preparados. Atualize a tela em alguns segundos.</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => createChecklistsMutation.mutate({ supervisorRouteId }, {
                    onSuccess: () => utils.checklists.getByRoute.invalidate({ supervisorRouteId }),
                    onError: () => toast.error("Não foi possível preparar os postos da rota"),
                  })}
                >
                  Tentar novamente
                </Button>
              </CardContent>
            </Card>
          )}

          {postCards.map(({ checklist, post }) => {
            return (
              <PostCard
                key={checklist.id}
                id={checklist.id}
                postId={checklist.postId}
                postName={post?.name || `Posto #${checklist.postId}`}
                postAddress={post?.address}
                status={checklist.status as 'pending' | 'in_progress' | 'visited'}
                observations={checklist.observations || undefined}
                isCoverage={checklist.isCoverage}
                coverageReason={checklist.coverageReason}
                arrivalTime={checklist.arrivalTime}
                departureTime={checklist.departureTime}
                arrivalLatitude={checklist.arrivalLatitude as number | null | undefined}
                arrivalLongitude={checklist.arrivalLongitude as number | null | undefined}
                departureLatitude={checklist.departureLatitude as number | null | undefined}
                departureLongitude={checklist.departureLongitude as number | null | undefined}
                onCheckIn={async (checklistId) => {
                  try {
                    const coordinates = await captureCoordinates();
                    await checkInMutation.mutateAsync({ checklistId, ...coordinates });
                    await utils.checklists.getByRoute.invalidate({ supervisorRouteId });
                    toast.success("Chegada registrada com sucesso!");
                  } catch (error) {
                    toast.error("Erro ao registrar chegada");
                    console.error("Check-in error:", error);
                  }
                }}
                onCheckOut={async (checklistId) => {
                  try {
                    const coordinates = await captureCoordinates();
                    await checkOutMutation.mutateAsync({ checklistId, ...coordinates });
                    await utils.checklists.getByRoute.invalidate({ supervisorRouteId });
                    toast.success("Saída registrada com sucesso!");
                  } catch (error) {
                    toast.error("Erro ao registrar saída");
                    console.error("Check-out error:", error);
                  }
                }}
                onOpenChecklist={(checklistId) => {
                  window.location.href = `/supervisor/checklist/${checklistId}`;
                }}
                hasActiveVisit={Boolean(activeChecklist && activeChecklist.id !== checklist.id)}
                isActiveVisit={activeChecklist?.id === checklist.id}
                isLoading={checkInMutation.isPending || checkOutMutation.isPending}
              />
            );
          })}
        </div>}

      </div>
    </div>
  );
}
