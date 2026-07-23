import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Users, TrendingUp, AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { MapView } from "@/components/Map";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [dateRange, setDateRange] = useState({ start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() });

  // Queries
  const { data: locations, isLoading: locationsLoading } = trpc.locations.getAllLatest.useQuery();
  const { data: reports, isLoading: reportsLoading } = trpc.reports.visitsByDateRange.useQuery({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const handleMapReady = (map: google.maps.Map) => {
    if (!locations || locations.length === 0) return;

    // Add markers for each supervisor location
    locations.forEach((location) => {
      new google.maps.Marker({
        position: {
          lat: parseFloat(location.latitude.toString()),
          lng: parseFloat(location.longitude.toString()),
        },
        map,
        title: `Supervisor #${location.supervisorId}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#2563eb',
          fillOpacity: 0.8,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });
    });

    // Center map on first location
    if (locations.length > 0) {
      map.setCenter({
        lat: parseFloat(locations[0].latitude.toString()),
        lng: parseFloat(locations[0].longitude.toString()),
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
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
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Supervisores Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{locations?.length || 0}</div>
              <p className="text-xs text-gray-600 mt-2">Localizações registradas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Visitas Realizadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{reports?.length || 0}</div>
              <p className="text-xs text-gray-600 mt-2">Últimos 7 dias</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Taxa de Conformidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">95%</div>
              <p className="text-xs text-gray-600 mt-2">Média geral</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="map" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="map" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Mapa em Tempo Real
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Relatórios
            </TabsTrigger>
          </TabsList>

          {/* Map Tab */}
          <TabsContent value="map" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Localização dos Supervisores</CardTitle>
                <CardDescription>
                  Posição em tempo real de todos os supervisores em campo
                </CardDescription>
              </CardHeader>
              <CardContent>
                {locationsLoading ? (
                  <div className="h-96 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <div className="h-96 rounded-lg overflow-hidden border border-gray-200">
                    <MapView onMapReady={handleMapReady} />
                  </div>
                )}
                
                {/* Supervisors List */}
                <div className="mt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Supervisores Ativos</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {locations?.map((location) => (
                      <div key={location.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                          <div>
                            <p className="font-medium text-gray-900">Supervisor #{location.supervisorId}</p>
                            <p className="text-xs text-gray-600">
                              Lat: {parseFloat(location.latitude.toString()).toFixed(4)}, 
                              Lng: {parseFloat(location.longitude.toString()).toFixed(4)}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600">
                          {new Date(location.recordedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="mt-6">
            <div className="space-y-6">
              {/* Date Range Filter */}
              <Card>
                <CardHeader>
                  <CardTitle>Filtro de Período</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-700">Data Inicial</label>
                      <input
                        type="date"
                        value={dateRange.start.toISOString().split('T')[0]}
                        onChange={(e) => setDateRange({ ...dateRange, start: new Date(e.target.value) })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-700">Data Final</label>
                      <input
                        type="date"
                        value={dateRange.end.toISOString().split('T')[0]}
                        onChange={(e) => setDateRange({ ...dateRange, end: new Date(e.target.value) })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Visits Report */}
              <Card>
                <CardHeader>
                  <CardTitle>Visitas Realizadas</CardTitle>
                  <CardDescription>
                    Relatório de postos visitados no período selecionado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reportsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">Posto</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">Supervisor</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">Data/Hora</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">Observações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reports?.map((report) => (
                            <tr key={report.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 px-4 text-gray-900">Posto #{report.postId}</td>
                              <td className="py-3 px-4 text-gray-900">Supervisor #{report.supervisorId}</td>
                              <td className="py-3 px-4 text-gray-600">
                                {new Date(report.visitedAt).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-gray-600">{report.observations || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {reports?.length === 0 && (
                        <div className="text-center py-8 text-gray-600">
                          Nenhuma visita registrada neste período
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
