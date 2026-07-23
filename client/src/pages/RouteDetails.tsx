import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, ArrowLeft, Fuel, Clock, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

interface RouteDetailsProps {
  params: {
    supervisorRouteId: string;
  };
}

export default function RouteDetails({ params }: RouteDetailsProps) {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const supervisorRouteId = parseInt(params.supervisorRouteId);
  
  const [kmInitial, setKmInitial] = useState<string>("");
  const [kmFinal, setKmFinal] = useState<string>("");
  const [showKmInitial, setShowKmInitial] = useState(true);
  const [showKmFinal, setShowKmFinal] = useState(false);

  // Queries
  const { data: route, isLoading: routeLoading } = trpc.supervisorRoutes.getById.useQuery({ id: supervisorRouteId });
  const { data: checklists, isLoading: checklistsLoading } = trpc.checklists.getByRoute.useQuery({ supervisorRouteId });

  // Mutations
  const updateKmMutation = trpc.supervisorRoutes.updateKm.useMutation();
  const recordLocationMutation = trpc.locations.record.useMutation();

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
            },
            (error) => console.error("Geolocation error:", error)
          );
        }
      }, 30000); // Record every 30 seconds

      return () => clearInterval(interval);
    }
  }, [route?.status, supervisorRouteId, recordLocationMutation]);

  const handleStartRoute = async () => {
    if (!kmInitial) return;
    
    try {
      await updateKmMutation.mutateAsync({
        id: supervisorRouteId,
        kmInitial: parseFloat(kmInitial),
      });
      setShowKmInitial(false);
    } catch (error) {
      console.error("Error starting route:", error);
    }
  };

  const handleEndRoute = async () => {
    if (!kmFinal) return;
    
    try {
      await updateKmMutation.mutateAsync({
        id: supervisorRouteId,
        kmFinal: parseFloat(kmFinal),
      });
      setShowKmFinal(false);
    } catch (error) {
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
              <h1 className="text-2xl font-bold text-gray-900">Detalhes da Rota</h1>
              <p className="text-gray-600 mt-1">Status: <span className="font-semibold text-blue-600">{route.status}</span></p>
            </div>
          </div>
          <Button onClick={() => logout()} variant="outline">
            Sair
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* KM Registration */}
        {showKmInitial && (
          <Card className="mb-8 border-l-4 border-l-yellow-500 bg-gradient-to-r from-yellow-50 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fuel className="w-5 h-5 text-yellow-600" />
                Registrar KM Inicial
              </CardTitle>
              <CardDescription>Informe o KM inicial da viatura</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="kmInitial">KM Inicial</Label>
                <Input
                  id="kmInitial"
                  type="number"
                  placeholder="Ex: 15000"
                  value={kmInitial}
                  onChange={(e) => setKmInitial(e.target.value)}
                  className="text-lg"
                />
              </div>
              <Button
                onClick={handleStartRoute}
                disabled={!kmInitial || updateKmMutation.isPending}
                className="w-full bg-yellow-600 hover:bg-yellow-700"
              >
                {updateKmMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  "Iniciar Rota"
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Posts List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Postos a Visitar</h2>
            <span className="text-sm text-gray-600">
              {checklists?.filter(c => c.status === 'visited').length || 0} / {checklists?.length || 0} visitados
            </span>
          </div>

          {checklists?.map((checklist) => (
            <Card key={checklist.id} className={`transition-all ${checklist.status === 'visited' ? 'bg-green-50 border-green-200' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {checklist.status === 'visited' && (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    )}
                    {checklist.status !== 'visited' && (
                      <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {/* Will be populated with post name */}
                        Posto #{checklist.postId}
                      </CardTitle>
                      <CardDescription>
                        Status: <span className="font-semibold">{checklist.status}</span>
                      </CardDescription>
                    </div>
                  </div>
                  {checklist.status !== 'visited' && (
                    <Button
                      onClick={() => window.location.href = `/supervisor/checklist/${checklist.id}`}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Iniciar Checklist
                    </Button>
                  )}
                </div>
              </CardHeader>
              {checklist.observations && (
                <CardContent>
                  <p className="text-sm text-gray-700"><strong>Observações:</strong> {checklist.observations}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* End Route */}
        {route.status === 'in_progress' && !showKmFinal && (
          <div className="mt-8 flex justify-end">
            <Button
              onClick={() => setShowKmFinal(true)}
              className="bg-red-600 hover:bg-red-700"
            >
              <Clock className="w-4 h-4 mr-2" />
              Encerrar Rota
            </Button>
          </div>
        )}

        {/* KM Final Registration */}
        {showKmFinal && (
          <Card className="mt-8 border-l-4 border-l-red-500 bg-gradient-to-r from-red-50 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fuel className="w-5 h-5 text-red-600" />
                Registrar KM Final
              </CardTitle>
              <CardDescription>Informe o KM final da viatura</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="kmFinal">KM Final</Label>
                <Input
                  id="kmFinal"
                  type="number"
                  placeholder="Ex: 15050"
                  value={kmFinal}
                  onChange={(e) => setKmFinal(e.target.value)}
                  className="text-lg"
                />
              </div>
              {kmInitial && kmFinal && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-900">
                    <strong>KM Percorrido:</strong> {(parseFloat(kmFinal) - parseFloat(kmInitial)).toFixed(2)} km
                  </p>
                </div>
              )}
              <Button
                onClick={handleEndRoute}
                disabled={!kmFinal || updateKmMutation.isPending}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                {updateKmMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Encerrando...
                  </>
                ) : (
                  "Encerrar Rota"
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
