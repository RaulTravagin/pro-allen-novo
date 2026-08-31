import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, ArrowLeft, Building2, ClipboardList, Fuel, Clock, AlertCircle, Route, CarFront, Gauge, Droplets, CircleDollarSign, History, Plus, XCircle, Pencil } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import PostCard from "@/components/PostCard";
import SupervisorShiftReportDialog from "@/components/SupervisorShiftReportDialog";
import { clearRouteDraft, readRouteDraft, saveRouteDraft } from "@/lib/onlineOperationDraft";
import { notifySupervisorError, supervisorErrorMessage } from "@/lib/networkFeedback";

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
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [showNewVehicle, setShowNewVehicle] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [showFuelForm, setShowFuelForm] = useState(false);
  const [fuelOdometer, setFuelOdometer] = useState("");
  const [fuelAmount, setFuelAmount] = useState("");
  const [fuelLiters, setFuelLiters] = useState("");
  const [fuelType, setFuelType] = useState<"gasoline" | "ethanol" | "diesel">("gasoline");
  const [editingFuel, setEditingFuel] = useState<any | null>(null);
  const [fuelEditOdometer, setFuelEditOdometer] = useState("");
  const [fuelEditAmount, setFuelEditAmount] = useState("");
  const [fuelEditLiters, setFuelEditLiters] = useState("");
  const [fuelEditType, setFuelEditType] = useState<"gasoline" | "ethanol" | "diesel">("gasoline");
  const [fuelEditWarnings, setFuelEditWarnings] = useState<string[]>([]);
  const [gpsError, setGpsError] = useState<string>("");
  const [occurrencePostId, setOccurrencePostId] = useState("");
  const [occurrenceReason, setOccurrenceReason] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [showShiftReport, setShowShiftReport] = useState(false);
  const [shiftReport, setShiftReport] = useState<any | null>(null);
  const OPERATIONAL_BASE_OCCURRENCE_VALUE = "operational_base";

  // Queries
  const routeQuery = trpc.supervisorRoutes.getById.useQuery({ id: supervisorRouteId }, { retry: false });
  const { data: route, isLoading: routeLoading, error: routeError } = routeQuery;
  const checklistsQuery = trpc.checklists.getByRoute.useQuery({ supervisorRouteId }, { retry: false });
  const { data: checklists, isLoading: checklistsLoading, error: checklistsError } = checklistsQuery;
  const { data: vehicles } = trpc.fleet.listVehicles.useQuery();
  const effectiveVehicleId = Number(route?.vehicleId ?? selectedVehicleId);
  const { data: fuelSummary } = trpc.fleet.getFuelSummary.useQuery(
    { vehicleId: effectiveVehicleId },
    { enabled: Number.isSafeInteger(effectiveVehicleId) && effectiveVehicleId > 0 },
  );
  const activeChecklist = checklists?.find((checklist) => checklist.status === 'in_progress');
  const isBaseOperational = route?.routeActivityType === "operational_base";

  useEffect(() => {
    if (route?.vehicleId) setSelectedVehicleId(String(route.vehicleId));
  }, [route?.vehicleId]);

  useEffect(() => {
    if (!route || !user?.id) return;
    if (route.status === "completed") {
      clearRouteDraft(user.id, route.id);
      setDraftLoaded(true);
      return;
    }
    const draft = readRouteDraft(user.id, route.id);
    if (draft) {
      setKmInitial(draft.kmInitial);
      setKmFinal(draft.kmFinal);
      setSelectedVehicleId((current) => route.vehicleId ? String(route.vehicleId) : current || draft.selectedVehicleId);
      setOccurrencePostId(draft.coveragePostId);
      setOccurrenceReason(draft.coverageReason);
      setFuelOdometer(draft.fuelOdometer);
      setFuelAmount(draft.fuelAmount);
      setFuelLiters(draft.fuelLiters);
      setFuelType(draft.fuelType);
    }
    setDraftLoaded(true);
  }, [route?.id, route?.status, route?.vehicleId, user?.id]);

  useEffect(() => {
    if (!route || !user?.id || !draftLoaded || route.status === "completed") return;
    saveRouteDraft(user.id, route.id, { kmInitial, kmFinal, selectedVehicleId, coveragePostId: occurrencePostId, coverageReason: occurrenceReason, fuelOdometer, fuelAmount, fuelLiters, fuelType });
  }, [occurrencePostId, occurrenceReason, draftLoaded, fuelAmount, fuelLiters, fuelOdometer, fuelType, kmFinal, kmInitial, route?.id, route?.status, selectedVehicleId, user?.id]);

  const { data: posts } = trpc.routes.getPostsByRoute.useQuery(
    { routeId: route?.routeId || 0 },
    { enabled: !!route?.routeId }
  );
  const { data: occurrencePosts } = trpc.checklists.getCoveragePosts.useQuery(
    { supervisorRouteId },
    { enabled: route?.status === "in_progress" },
  );
  const shiftReportQuery = trpc.supervisorRoutes.getShiftReport.useQuery(
    { supervisorRouteId },
    { enabled: showShiftReport, retry: false },
  );

  // Mutations
  const updateKmMutation = trpc.supervisorRoutes.updateKm.useMutation();
  const cancelPendingMutation = trpc.supervisorRoutes.cancelPending.useMutation();
  const saveVehicleMutation = trpc.fleet.saveVehicle.useMutation();
  const registerFuelMutation = trpc.fleet.registerFuel.useMutation();
  const updateFuelMutation = trpc.fleet.updateFuel.useMutation({
    onSuccess: async (result) => {
      if (result.requiresConfirmation) {
        setFuelEditWarnings(result.warnings);
        return;
      }
      setEditingFuel(null);
      setFuelEditWarnings([]);
      await utils.fleet.getFuelSummary.invalidate({ vehicleId: effectiveVehicleId });
      await utils.supervisorRoutes.getShiftReport.invalidate({ supervisorRouteId });
      toast.success("Abastecimento atualizado e indicadores recalculados.");
    },
    onError: (error) => notifySupervisorError(error, "Não foi possível editar o abastecimento"),
  });
  const recordLocationMutation = trpc.locations.record.useMutation();
  const createChecklistsMutation = trpc.checklists.createForRoute.useMutation();
  const checkInMutation = trpc.checklists.checkIn.useMutation();
  const checkOutMutation = trpc.checklists.checkOut.useMutation();
  const createOccurrenceMutation = trpc.checklists.createCoverage.useMutation();
  const finishShiftMutation = trpc.supervisorRoutes.finishShift.useMutation();

  const refreshOperationalData = async () => {
    await Promise.all([
      utils.supervisorRoutes.getById.invalidate({ id: supervisorRouteId }),
      utils.supervisorRoutes.getTodayRoute.invalidate(),
      utils.supervisorRoutes.getTodayHistory.invalidate(),
      utils.supervisorRoutes.getShiftReport.invalidate({ supervisorRouteId }),
      utils.checklists.getByRoute.invalidate({ supervisorRouteId }),
    ]);
  };

  useEffect(() => {
    if (!route || checklistsLoading || !posts?.length || (checklists?.length ?? 0) > 0 || createChecklistsMutation.isPending) {
      return;
    }

    void createChecklistsMutation.mutateAsync({ supervisorRouteId })
      .then(() => utils.checklists.getByRoute.invalidate({ supervisorRouteId }))
      .catch((error) => {
        notifySupervisorError(error, "Não foi possível preparar os postos da rota");
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
  const occurrencePostById = new Map((occurrencePosts ?? []).map((post) => [post.id, post]));
  const selectableOccurrencePosts = (occurrencePosts ?? []).filter((post) => post.routeActivityType !== "operational_base");
  const occurrencePostCards = (checklists ?? [])
    .filter((checklist) => checklist.isCoverage)
    .map((checklist) => ({ post: occurrencePostById.get(checklist.postId), checklist }));
  const postCards = [...plannedPostCards, ...occurrencePostCards];

  const handleCreateOccurrence = async () => {
    const postId = occurrencePostId === OPERATIONAL_BASE_OCCURRENCE_VALUE
      ? OPERATIONAL_BASE_OCCURRENCE_VALUE
      : Number(occurrencePostId);
    const reason = occurrenceReason.trim();
    if (postId !== OPERATIONAL_BASE_OCCURRENCE_VALUE && (!Number.isSafeInteger(postId) || postId <= 0)) {
      toast.error("Selecione o posto relacionado à ocorrência");
      return;
    }
    if (reason.length < 8) {
      toast.error("Informe o motivo da ocorrência com pelo menos 8 caracteres");
      return;
    }
    try {
      await createOccurrenceMutation.mutateAsync({ supervisorRouteId, postId, coverageReason: reason });
      await refreshOperationalData();
      setOccurrencePostId("");
      setOccurrenceReason("");
      toast.success(occurrencePostId === OPERATIONAL_BASE_OCCURRENCE_VALUE ? "Atividade na Base Operacional adicionada. Registre a chegada no novo card." : "Ocorrência adicionada. Registre a chegada no novo card.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar a ocorrência");
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
    const vehicleId = Number(selectedVehicleId);
    if (!Number.isFinite(initialKm) || initialKm < 0) {
      toast.error("Por favor, informe o KM inicial");
      return;
    }
    if (!Number.isSafeInteger(vehicleId) || vehicleId <= 0) {
      toast.error("Selecione a viatura antes de registrar o KM inicial");
      return;
    }
    
    try {
      await updateKmMutation.mutateAsync({
        id: supervisorRouteId,
        vehicleId,
        kmInitial: initialKm,
      });
      await refreshOperationalData();
      setKmInitial("");
      toast.success("Rota iniciada com sucesso!");
    } catch (error) {
      notifySupervisorError(error, "Erro ao iniciar rota");
    }
  };

  const handleSaveVehicle = async () => {
    if (vehiclePlate.trim().length < 7 || vehicleModel.trim().length < 2) {
      toast.error("Informe placa e modelo da viatura");
      return;
    }
    try {
      const vehicle = await saveVehicleMutation.mutateAsync({ plate: vehiclePlate, model: vehicleModel });
      setSelectedVehicleId(String(vehicle.id));
      setVehiclePlate("");
      setVehicleModel("");
      setShowNewVehicle(false);
      await Promise.all([utils.fleet.listVehicles.invalidate(), utils.fleet.getFuelSummary.invalidate()]);
      toast.success("Viatura cadastrada e selecionada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar a viatura");
    }
  };

  const handleRegisterFuel = async () => {
    const odometerKm = Number(fuelOdometer);
    const amount = Number(fuelAmount.replace(",", "."));
    const liters = Number(fuelLiters.replace(",", "."));
    if (![odometerKm, amount, liters].every(Number.isFinite) || odometerKm < 0 || amount <= 0 || liters <= 0) {
      toast.error("Informe KM, valor e litros válidos para o abastecimento");
      return;
    }
    try {
      await registerFuelMutation.mutateAsync({ supervisorRouteId, odometerKm, amount, liters, fuelType });
      setFuelOdometer("");
      setFuelAmount("");
      setFuelLiters("");
      setShowFuelForm(false);
      await Promise.all([
        effectiveVehicleId ? utils.fleet.getFuelSummary.invalidate({ vehicleId: effectiveVehicleId }) : Promise.resolve(),
        refreshOperationalData(),
      ]);
      toast.success("Abastecimento registrado com sucesso");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar o abastecimento");
    }
  };

  const openFuelEditor = (log: any) => {
    setFuelEditWarnings([]);
    setEditingFuel(log);
    setFuelEditOdometer(String(log.odometerKm ?? ""));
    setFuelEditAmount(String(log.amount ?? ""));
    setFuelEditLiters(String(log.liters ?? ""));
    setFuelEditType(log.fuelType);
  };

  const submitFuelEdit = async (confirmPriceVariation = false) => {
    if (!editingFuel) return;
    const odometerKm = Number(fuelEditOdometer.replace(",", "."));
    const amount = Number(fuelEditAmount.replace(",", "."));
    const liters = Number(fuelEditLiters.replace(",", "."));
    if (![odometerKm, amount, liters].every(Number.isFinite) || odometerKm < 0 || amount <= 0 || liters <= 0) {
      toast.error("Informe KM, valor e litros válidos para a correção");
      return;
    }
    setFuelEditWarnings([]);
    await updateFuelMutation.mutateAsync({ id: editingFuel.id, odometerKm, amount, liters, fuelType: fuelEditType, confirmPriceVariation });
  };

  const formatCurrency = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formatNumber = (value: number | null | undefined, suffix = "") => value == null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix}`;

  const handleOpenShiftReport = () => {
    setShowShiftReport(true);
  };

  const handleFinishShift = async (finalKm: number) => {
    try {
      const result = await finishShiftMutation.mutateAsync({ supervisorRouteId, kmFinal: finalKm });
      setShiftReport(result.report);
      if (user?.id) clearRouteDraft(user.id, supervisorRouteId);
      await refreshOperationalData();
      toast.success("Turno encerrado e relatório gerado com sucesso");
    } catch (error) {
      notifySupervisorError(error, "Não foi possível encerrar o turno");
    }
  };

  const handleCancelPendingRoute = async () => {
    try {
      await cancelPendingMutation.mutateAsync({ id: supervisorRouteId });
      if (user?.id) clearRouteDraft(user.id, supervisorRouteId);
      await refreshOperationalData();
      toast.success("Rota cancelada. Selecione a rota correta para continuar.");
      navigate("/supervisor");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível cancelar a rota");
    } finally {
      setShowCancelConfirmation(false);
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
              <CardTitle className="text-red-900">{routeError ? "Falha de conexão" : "Rota não encontrada"}</CardTitle>
              <CardDescription className="text-red-800">{routeError ? supervisorErrorMessage(routeError, "Não foi possível carregar a rota.") : "Não foi possível localizar esta rota."}</CardDescription>
            </CardHeader>
            {routeError && <CardContent><Button type="button" variant="outline" onClick={() => void routeQuery.refetch()} className="border-red-300 bg-white text-red-900">Tentar novamente</Button></CardContent>}
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
          <div className="flex items-center gap-2">
            {route.status === "pending" && <Button onClick={() => setShowCancelConfirmation(true)} variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"><XCircle className="mr-2 h-4 w-4" />Cancelar rota</Button>}
            <Button onClick={() => logout()} variant="outline">Sair</Button>
          </div>
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
          <Card className="border-amber-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle id="vehicle-control-title" className="flex items-center gap-2">
                <CarFront className="h-5 w-5 text-amber-600" />
                Controle da viatura
              </CardTitle>
              <CardDescription>
                Selecione a viatura, registre retirada, abastecimentos e devolução. Tudo fica associado à placa selecionada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">1. Seleção de viatura</p>
                    {route.vehicleId ? (
                      <p className="mt-1 text-lg font-bold text-slate-950">{route.vehiclePlate} <span className="font-medium text-slate-600">· {route.vehicleModel}</span></p>
                    ) : <p className="mt-1 text-sm text-slate-700">A seleção da placa é obrigatória antes do KM inicial.</p>}
                  </div>
                  {!route.vehicleId && <Button type="button" variant="outline" onClick={() => setShowNewVehicle((value) => !value)} className="border-amber-300 bg-white"><Plus className="mr-2 h-4 w-4" />Nova viatura</Button>}
                </div>
                {!route.vehicleId && <div className="mt-4 space-y-2">
                  <Label htmlFor="vehicle-select">Placa / modelo</Label>
                  <select id="vehicle-select" value={selectedVehicleId} onChange={(event) => setSelectedVehicleId(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Selecione a viatura</option>
                    {(vehicles ?? []).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.model}</option>)}
                  </select>
                </div>}
                {!route.vehicleId && showNewVehicle && <div className="mt-4 grid gap-3 rounded-lg border border-amber-200 bg-white p-3 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
                  <div className="space-y-2"><Label htmlFor="vehicle-plate">Placa</Label><Input id="vehicle-plate" value={vehiclePlate} onChange={(event) => setVehiclePlate(event.target.value.toUpperCase())} placeholder="Ex.: ABC1D23" /></div>
                  <div className="space-y-2"><Label htmlFor="vehicle-model">Modelo</Label><Input id="vehicle-model" value={vehicleModel} onChange={(event) => setVehicleModel(event.target.value)} placeholder="Ex.: Fiat Strada" /></div>
                  <Button type="button" onClick={handleSaveVehicle} disabled={saveVehicleMutation.isPending} className="bg-amber-600 hover:bg-amber-700">{saveVehicleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cadastrar"}</Button>
                </div>}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">2. KM inicial</p>
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
                      disabled={!kmInitial || !selectedVehicleId || updateKmMutation.isPending}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {updateKmMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</> : "Iniciar turno / registrar KM inicial"}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-3 text-3xl font-bold text-slate-900">{Number(route.kmInitial).toLocaleString("pt-BR")} km</p>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">4. KM final</p>
                {route.kmFinal != null ? (
                  <div className="mt-3 space-y-1">
                    <p className="text-3xl font-bold text-slate-900">{Number(route.kmFinal).toLocaleString("pt-BR")} km</p>
                    <p className="text-sm text-slate-600">Total percorrido: {(Number(route.kmFinal) - Number(route.kmInitial ?? 0)).toFixed(2)} km</p>
                    {isBaseOperational && <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-3"><p className="text-sm font-semibold text-violet-950">Base Operacional encerrada</p><p className="mt-1 text-xs leading-5 text-violet-800">Você já pode selecionar uma rota de campo para continuar o turno.</p><Button type="button" onClick={() => navigate("/supervisor")} className="mt-3 w-full bg-violet-700 hover:bg-violet-800">Selecionar rota de campo <ArrowLeft className="ml-2 h-4 w-4 rotate-180" /></Button></div>}
                  </div>
                ) : route.status === "in_progress" ? (
                  <Button onClick={handleOpenShiftReport} className="mt-3 w-full bg-slate-900 hover:bg-slate-800"><ClipboardList className="mr-2 h-4 w-4" />Encerrar turno e gerar relatório</Button>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">Disponível depois do registro do KM inicial.</p>
                )}
              </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">3. Abastecimento</p><p className="mt-1 text-sm text-emerald-950">Registre durante a operação para acompanhar consumo e custo da viatura.</p></div>
                  {route.status === "in_progress" && <Button type="button" onClick={() => setShowFuelForm((value) => !value)} className="bg-emerald-700 hover:bg-emerald-800"><Fuel className="mr-2 h-4 w-4" />Registrar abastecimento</Button>}
                </div>
                {showFuelForm && <div className="mt-4 grid gap-3 rounded-lg border border-emerald-200 bg-white p-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2"><Label htmlFor="fuel-km">KM no abastecimento</Label><Input id="fuel-km" type="number" inputMode="decimal" value={fuelOdometer} onChange={(event) => setFuelOdometer(event.target.value)} placeholder="Ex.: 15120" /></div>
                  <div className="space-y-2"><Label htmlFor="fuel-amount">Valor pago (R$)</Label><Input id="fuel-amount" inputMode="decimal" value={fuelAmount} onChange={(event) => setFuelAmount(event.target.value)} placeholder="Ex.: 150,00" /></div>
                  <div className="space-y-2"><Label htmlFor="fuel-liters">Litros</Label><Input id="fuel-liters" inputMode="decimal" value={fuelLiters} onChange={(event) => setFuelLiters(event.target.value)} placeholder="Ex.: 28,5" /></div>
                  <div className="space-y-2"><Label htmlFor="fuel-type">Combustível</Label><select id="fuel-type" value={fuelType} onChange={(event) => setFuelType(event.target.value as typeof fuelType)} className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm"><option value="gasoline">Gasolina</option><option value="ethanol">Etanol</option><option value="diesel">Diesel</option></select></div>
                  <div className="md:col-span-2 lg:col-span-4"><Button type="button" onClick={handleRegisterFuel} disabled={registerFuelMutation.isPending} className="w-full bg-emerald-700 hover:bg-emerald-800">{registerFuelMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar abastecimento"}</Button></div>
                </div>}
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-emerald-100 bg-white p-3"><Gauge className="h-4 w-4 text-emerald-700" /><p className="mt-2 text-xs font-semibold uppercase text-slate-500">Média de consumo</p><p className="mt-1 text-xl font-bold text-slate-950">{formatNumber(fuelSummary?.latestMetrics?.consumptionKmPerLiter, " km/L")}</p></div>
                  <div className="rounded-lg border border-emerald-100 bg-white p-3"><CircleDollarSign className="h-4 w-4 text-emerald-700" /><p className="mt-2 text-xs font-semibold uppercase text-slate-500">Custo por KM</p><p className="mt-1 text-xl font-bold text-slate-950">{formatCurrency(fuelSummary?.latestMetrics?.costPerKm)}</p></div>
                  <div className="rounded-lg border border-emerald-100 bg-white p-3"><Droplets className="h-4 w-4 text-emerald-700" /><p className="mt-2 text-xs font-semibold uppercase text-slate-500">KM entre abastecimentos</p><p className="mt-1 text-xl font-bold text-slate-950">{formatNumber(fuelSummary?.latestMetrics?.distanceSincePrevious, " km")}</p></div>
                </div>
                {fuelSummary && fuelSummary.history.length > 0 && <div className="mt-5"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><History className="h-4 w-4" />Últimos abastecimentos — {fuelSummary.vehicle.plate}</div><div className="mt-2 overflow-x-auto rounded-lg border border-emerald-100 bg-white"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-emerald-50 text-xs uppercase text-emerald-900"><tr><th className="p-3">Data</th><th className="p-3">KM</th><th className="p-3">Combustível</th><th className="p-3">Valor / litros</th><th className="p-3">Média</th><th className="p-3">Custo/KM</th><th className="p-3 text-right">Ação</th></tr></thead><tbody>{fuelSummary.history.slice(0, 5).map((log) => <tr key={log.id} className="border-t border-emerald-50"><td className="p-3">{new Date(log.createdAt).toLocaleDateString("pt-BR")}</td><td className="p-3">{formatNumber(Number(log.odometerKm), " km")}</td><td className="p-3">{{ gasoline: "Gasolina", ethanol: "Etanol", diesel: "Diesel" }[log.fuelType]}</td><td className="p-3">{formatCurrency(Number(log.amount))} · {formatNumber(Number(log.liters), " L")}</td><td className="p-3">{formatNumber(log.consumptionKmPerLiter, " km/L")}</td><td className="p-3">{formatCurrency(log.costPerKm)}</td><td className="p-3 text-right"><Button type="button" variant="ghost" size="sm" onClick={() => openFuelEditor(log)} aria-label={`Editar abastecimento de ${new Date(log.createdAt).toLocaleDateString("pt-BR")}`}><Pencil className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div></div>}
              </div>
            </CardContent>
          </Card>
        </section>

        {!isBaseOperational && <section className="mb-8" aria-labelledby="occurrence-title">
          <Card className="border-violet-200 bg-violet-50/40 shadow-sm">
            <CardHeader>
              <CardTitle id="occurrence-title" className="flex items-center gap-2 text-violet-950">
                <Route className="h-5 w-5 text-violet-700" />
                Ocorrência ou atividade na Base Operacional
              </CardTitle>
              <CardDescription>
                Use para registrar uma ocorrência em um posto não previsto nesta rota ou uma atividade realizada na Base Operacional. A justificativa ficará disponível para o Gestor.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="occurrence-post">Posto ou atividade</Label>
                <select
                  id="occurrence-post"
                  value={occurrencePostId}
                  onChange={(event) => setOccurrencePostId(event.target.value)}
                  disabled={route.status !== "in_progress" || createOccurrenceMutation.isPending}
                  required
                  aria-required="true"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Selecione um posto ou a Base Operacional</option>
                  <option value={OPERATIONAL_BASE_OCCURRENCE_VALUE}>Base Operacional · Operação interna</option>
                  {selectableOccurrencePosts.map((post) => <option key={post.id} value={post.id}>{post.name} · {post.region} ({post.routeName})</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="occurrence-reason">Motivo da ocorrência <span className="text-rose-700">(obrigatório)</span></Label>
                <Textarea
                  id="occurrence-reason"
                  value={occurrenceReason}
                  onChange={(event) => setOccurrenceReason(event.target.value)}
                  placeholder="Ex.: Ocorrência emergencial por ausência no posto ou permanência na base"
                  disabled={route.status !== "in_progress" || createOccurrenceMutation.isPending}
                  required
                  aria-required="true"
                  minLength={8}
                  maxLength={2000}
                  className="min-h-10 resize-none"
                />
                <p className="text-xs text-violet-800">Informe pelo menos 8 caracteres para registrar a atividade selecionada.</p>
              </div>
              <Button
                type="button"
                onClick={handleCreateOccurrence}
                disabled={route.status !== "in_progress" || !occurrencePostId || occurrenceReason.trim().length < 8 || createOccurrenceMutation.isPending || Boolean(activeChecklist)}
                className="bg-violet-700 hover:bg-violet-800"
              >
                {createOccurrenceMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</> : occurrencePostId === OPERATIONAL_BASE_OCCURRENCE_VALUE ? "Registrar atividade na base" : "Adicionar ocorrência"}
              </Button>
            </CardContent>
            {route.status !== "in_progress" && <CardContent className="pt-0 text-sm text-violet-800">Registre o KM inicial para liberar ocorrências.</CardContent>}
            {activeChecklist && <CardContent className="pt-0 text-sm text-violet-800">Finalize a visita ativa antes de registrar uma ocorrência.</CardContent>}
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

          {checklistsError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="flex flex-col gap-3 py-5 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
                <span>{supervisorErrorMessage(checklistsError, "Não foi possível carregar os registros dos postos.")}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => void checklistsQuery.refetch()} className="border-red-300 bg-white text-red-900">Tentar novamente</Button>
              </CardContent>
            </Card>
          )}

          {!checklistsError && !createChecklistsMutation.isPending && postCards.length === 0 && (
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
                isOperationalBaseCoverage={Boolean(post && "routeActivityType" in post && post.routeActivityType === "operational_base")}
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
                    await refreshOperationalData();
                    toast.success("Chegada registrada com sucesso!");
    } catch (error) {
      notifySupervisorError(error, "Erro ao registrar chegada");
    }
                }}
                onCheckOut={async (checklistId) => {
                  try {
                    const coordinates = await captureCoordinates();
                    await checkOutMutation.mutateAsync({ checklistId, ...coordinates });
                    await refreshOperationalData();
                    toast.success("Saída registrada com sucesso!");
    } catch (error) {
      notifySupervisorError(error, "Erro ao registrar saída");
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

      <AlertDialog open={Boolean(editingFuel)} onOpenChange={(open) => {
        if (!open && !updateFuelMutation.isPending) {
          setEditingFuel(null);
          setFuelEditWarnings([]);
        }
      }}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Editar abastecimento</AlertDialogTitle>
            <AlertDialogDescription>Revise os novos valores antes de confirmar. A sequência de KM é validada contra os abastecimentos anterior e posterior da mesma viatura.</AlertDialogDescription>
          </AlertDialogHeader>
          {editingFuel && <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="edit-fuel-km">Quilometragem (KM)</Label><Input id="edit-fuel-km" inputMode="decimal" value={fuelEditOdometer} onChange={(event) => setFuelEditOdometer(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="edit-fuel-amount">Valor total (R$)</Label><Input id="edit-fuel-amount" inputMode="decimal" value={fuelEditAmount} onChange={(event) => setFuelEditAmount(event.target.value)} placeholder="155,89" /></div>
            <div className="space-y-2"><Label htmlFor="edit-fuel-liters">Litros (L)</Label><Input id="edit-fuel-liters" inputMode="decimal" value={fuelEditLiters} onChange={(event) => setFuelEditLiters(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="edit-fuel-type">Tipo de combustível</Label><select id="edit-fuel-type" value={fuelEditType} onChange={(event) => setFuelEditType(event.target.value as typeof fuelEditType)} className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm"><option value="gasoline">Gasolina</option><option value="ethanol">Etanol</option><option value="diesel">Diesel</option></select></div>
            <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><p className="font-semibold text-slate-900">Novos valores a confirmar</p><p className="mt-1">{Number(fuelEditOdometer.replace(",", ".")).toLocaleString("pt-BR")} km · {formatCurrency(Number(fuelEditAmount.replace(",", ".")))} · {fuelEditLiters.replace(".", ",")} L · {{ gasoline: "Gasolina", ethanol: "Etanol", diesel: "Diesel" }[fuelEditType]}</p></div>
            {fuelEditWarnings.length > 0 && <div className="sm:col-span-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">Atenção: preço por litro fora do padrão</p>{fuelEditWarnings.map((warning) => <p key={warning} className="mt-1">{warning}</p>)}<p className="mt-2">Confirme novamente somente se os valores estiverem corretos.</p></div>}
          </div>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateFuelMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="button" onClick={(event) => { event.preventDefault(); void submitFuelEdit(fuelEditWarnings.length > 0).catch(() => undefined); }} disabled={updateFuelMutation.isPending} className="bg-emerald-700 text-white hover:bg-emerald-800">{updateFuelMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : fuelEditWarnings.length > 0 ? "Confirmar mesmo assim" : "Confirmar e salvar"}</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <SupervisorShiftReportDialog
        open={showShiftReport}
        onOpenChange={(open) => {
          setShowShiftReport(open);
          if (!open) setShiftReport(null);
        }}
        report={shiftReport ?? shiftReportQuery.data ?? null}
        isLoading={shiftReportQuery.isLoading && !shiftReport}
        isClosing={finishShiftMutation.isPending}
        initialKmFinal={kmFinal}
        canClose={route.status === "in_progress"}
        onConfirmClose={handleFinishShift}
      />

      <AlertDialog open={showCancelConfirmation} onOpenChange={setShowCancelConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta rota?</AlertDialogTitle>
            <AlertDialogDescription>Use esta ação somente se a rota foi selecionada por engano. Como o KM inicial ainda não foi registrado, a atividade será marcada como cancelada e você voltará ao Dashboard para selecionar a rota correta.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelPendingMutation.isPending}>Manter rota</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelPendingRoute} disabled={cancelPendingMutation.isPending} className="bg-rose-600 text-white hover:bg-rose-700">{cancelPendingMutation.isPending ? "Cancelando..." : "Sim, cancelar rota"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
