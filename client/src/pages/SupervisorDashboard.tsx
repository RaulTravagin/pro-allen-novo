import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MapPin, Clock, Fuel, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function SupervisorDashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [supervisorRouteId, setSupervisorRouteId] = useState<number | null>(null);

  // Queries
  const { data: routes, isLoading: routesLoading } = trpc.routes.list.useQuery();
  const { data: todayRoute } = trpc.supervisorRoutes.getTodayRoute.useQuery();

  // Mutations
  const createRouteMutation = trpc.supervisorRoutes.create.useMutation();
  const createChecklistsMutation = trpc.checklists.createForRoute.useMutation();

  const handleSelectRoute = async (routeId: string) => {
    setSelectedRouteId(routeId);
    
    try {
      const result = await createRouteMutation.mutateAsync({
        routeId: parseInt(routeId),
        date: new Date(),
      });
      
      setSupervisorRouteId(result as number);
      
      // Create checklists for all posts in the route
      await createChecklistsMutation.mutateAsync({
        supervisorRouteId: result as number,
      });
      
      // Navigate to route details
      window.location.href = `/supervisor/route/${result}`;
    } catch (error) {
      console.error("Error starting route:", error);
    }
  };

  const handleContinueRoute = () => {
    if (todayRoute) {
      window.location.href = `/supervisor/route/${todayRoute.id}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard do Supervisor</h1>
            <p className="text-gray-600 mt-1">Bem-vindo, {user?.name}</p>
          </div>
          <Button
            onClick={() => logout()}
            variant="outline"
            className="text-gray-700"
          >
            Sair
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Status Card */}
        {todayRoute && (
          <Card className="mb-8 border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-green-600" />
                Rota em Andamento
              </CardTitle>
              <CardDescription>Você tem uma rota ativa para hoje</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Status: <span className="font-semibold text-green-600">Ativa</span></p>
                  <p className="text-sm text-gray-600 mt-1">Iniciada em: {new Date(todayRoute.startedAt || todayRoute.createdAt).toLocaleTimeString()}</p>
                </div>
                <Button
                  onClick={handleContinueRoute}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Continuar Rota
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Select Route Card */}
        {!todayRoute && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Iniciar Nova Rota</CardTitle>
              <CardDescription>
                Selecione a rota que deseja executar hoje
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {routesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <>
                  <Select value={selectedRouteId} onValueChange={handleSelectRoute}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione uma rota..." />
                    </SelectTrigger>
                    <SelectContent>
                      {routes?.map((route) => (
                        <SelectItem key={route.id} value={route.id.toString()}>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {route.name} - {route.region}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedRouteId && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-900">
                        ✓ Rota selecionada. Os checklists serão criados automaticamente quando você iniciar a rota.
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Rotas Disponíveis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{routes?.length || 0}</div>
              <p className="text-xs text-gray-600 mt-2">Rotas cadastradas no sistema</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Postos por Rota
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">~6</div>
              <p className="text-xs text-gray-600 mt-2">Média de postos por rota</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Fuel className="w-4 h-4" />
                KM Registrado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">0</div>
              <p className="text-xs text-gray-600 mt-2">Hoje</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
