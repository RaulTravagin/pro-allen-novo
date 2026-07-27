import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, AlertCircle, Loader2, Calendar, Clock } from "lucide-react";
import { useState } from "react";
import { PostPriorityCard } from "@/components/PostPriorityCard";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [dateRange, setDateRange] = useState({ start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() });
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");

  // Queries
  const { data: routes, isLoading: routesLoading } = trpc.routes.list.useQuery();
  const { data: reports, isLoading: reportsLoading } = trpc.reports.visitChecklistsByDateRange.useQuery({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });
  const { data: postsWithPriority, isLoading: postsLoading } = trpc.routes.getPostsWithPriority.useQuery(
    { routeId: parseInt(selectedRouteId) },
    { enabled: !!selectedRouteId }
  );

  const formatTime = (date: any) => {
    if (!date) return '-';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '-';
    }
  };

  const calculateDuration = (arrival: any, departure: any) => {
    if (!arrival || !departure) return '-';
    try {
      const start = typeof arrival === 'string' ? new Date(arrival) : arrival;
      const end = typeof departure === 'string' ? new Date(departure) : departure;
      const diffMs = end.getTime() - start.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    } catch {
      return '-';
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
        <Tabs defaultValue="priority" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="priority" className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Prioridades
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Relatórios
            </TabsTrigger>
          </TabsList>

          {/* Priority Tab */}
          <TabsContent value="priority" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Prioridades de Visita</CardTitle>
                <CardDescription>
                  Postos ordenados por urgência de visita
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Selecione uma Rota</label>
                  <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione uma rota..." />
                    </SelectTrigger>
                    <SelectContent>
                      {routes?.map((route) => (
                        <SelectItem key={route.id} value={route.id.toString()}>
                          {route.name} - {route.region}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedRouteId && (
                  <div className="space-y-3 mt-6">
                    {postsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      </div>
                    ) : (
                      <>
                        {/* Red Priority (Critical) */}
                        {postsWithPriority?.filter(p => p.priority === 'red').length ? (
                          <div>
                            <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                              Críticos (Mais de 10 dias sem visita)
                            </h4>
                            <div className="space-y-2">
                              {postsWithPriority?.filter(p => p.priority === 'red').map(post => (
                                <PostPriorityCard
                                  key={post.id}
                                  name={post.name}
                                  address={post.address}
                                  lastVisitDate={post.lastVisitDate}
                                  priority="red"
                                  daysSinceVisit={post.daysSinceVisit}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {/* Yellow Priority (Attention) */}
                        {postsWithPriority?.filter(p => p.priority === 'yellow').length ? (
                          <div>
                            <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                              Atenção (5-10 dias sem visita)
                            </h4>
                            <div className="space-y-2">
                              {postsWithPriority?.filter(p => p.priority === 'yellow').map(post => (
                                <PostPriorityCard
                                  key={post.id}
                                  name={post.name}
                                  address={post.address}
                                  lastVisitDate={post.lastVisitDate}
                                  priority="yellow"
                                  daysSinceVisit={post.daysSinceVisit}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {/* Green Priority (On Track) */}
                        {postsWithPriority?.filter(p => p.priority === 'green').length ? (
                          <div>
                            <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              Em Dia (Menos de 5 dias)
                            </h4>
                            <div className="space-y-2">
                              {postsWithPriority?.filter(p => p.priority === 'green').map(post => (
                                <PostPriorityCard
                                  key={post.id}
                                  name={post.name}
                                  address={post.address}
                                  lastVisitDate={post.lastVisitDate}
                                  priority="green"
                                  daysSinceVisit={post.daysSinceVisit}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {!postsWithPriority?.length && (
                          <div className="text-center py-8 text-gray-600">
                            Nenhum posto encontrado para esta rota
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="mt-6">
            <div className="space-y-6">
              {/* Date Range Filter */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Filtro de Período
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 items-end flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-sm font-medium text-gray-700">Data Inicial</label>
                      <input
                        type="date"
                        value={dateRange.start.toISOString().split('T')[0]}
                        onChange={(e) => setDateRange({ ...dateRange, start: new Date(e.target.value) })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div className="flex-1 min-w-[200px]">
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
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Visitas Realizadas com Horários
                  </CardTitle>
                  <CardDescription>
                    Relatório detalhado de postos visitados com horários de chegada e saída
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
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">Posto</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">Supervisor</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">Chegada</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">Saída</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">Duração</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">Data</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">Observações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reports?.map((report: any) => (
                            <tr key={report.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 px-4 text-gray-900 font-medium">Posto #{report.postId}</td>
                              <td className="py-3 px-4 text-gray-900">Rota #{report.supervisorRouteId}</td>
                              <td className="py-3 px-4 text-gray-600">
                                {formatTime(report.arrivalTime)}
                              </td>
                              <td className="py-3 px-4 text-gray-600">
                                {formatTime(report.departureTime)}
                              </td>
                              <td className="py-3 px-4 text-gray-600">
                                {calculateDuration(report.arrivalTime, report.departureTime)}
                              </td>
                              <td className="py-3 px-4 text-gray-600">
                                {report.visitedAt ? new Date(report.visitedAt).toLocaleDateString('pt-BR') : '-'}
                              </td>
                              <td className="py-3 px-4 text-gray-600 max-w-xs truncate">{report.observations || '-'}</td>
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
