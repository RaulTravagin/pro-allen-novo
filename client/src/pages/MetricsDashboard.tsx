import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Clock, CheckCircle2, AlertCircle, Loader2, Calendar } from "lucide-react";
import { useState } from "react";

export default function MetricsDashboard() {
  const { user, logout } = useAuth();
  const [dateRange, setDateRange] = useState({ start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() });

  // Queries
  const { data: reports, isLoading: reportsLoading } = trpc.reports.visitChecklistsByDateRange.useQuery({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // Calculate metrics
  const calculateMetrics = () => {
    if (!reports || reports.length === 0) {
      return {
        totalVisits: 0,
        avgVisitTime: 0,
        avgConformance: 0,
        visitsByDay: [],
        visitsByRoute: [],
        conformanceData: [],
      };
    }

    // Total visits
    const totalVisits = reports.length;

    // Average visit time
    const visitTimes = reports
      .filter(r => r.arrivalTime && r.departureTime)
      .map(r => {
        const start = new Date(r.arrivalTime!);
        const end = new Date(r.departureTime!);
        return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
      });
    const avgVisitTime = visitTimes.length > 0 ? Math.round(visitTimes.reduce((a, b) => a + b, 0) / visitTimes.length) : 0;

    // Visits by day
    const visitsByDay: Record<string, number> = {};
    reports.forEach(r => {
      const day = new Date(r.visitedAt || new Date()).toLocaleDateString('pt-BR');
      visitsByDay[day] = (visitsByDay[day] || 0) + 1;
    });
    const visitsByDayData = Object.entries(visitsByDay).map(([day, count]) => ({ day, visits: count }));

    // Visits by route
    const visitsByRoute: Record<number, number> = {};
    reports.forEach(r => {
      visitsByRoute[r.supervisorRouteId] = (visitsByRoute[r.supervisorRouteId] || 0) + 1;
    });
    const visitsByRouteData = Object.entries(visitsByRoute).map(([route, count]) => ({ route: `Rota ${route}`, visits: count }));

    // Conformance data (simplified - assuming all visited = compliant)
    const conformanceData = [
      { name: 'Conforme', value: totalVisits, fill: '#10b981' },
      { name: 'Não Conforme', value: 0, fill: '#ef4444' },
    ];

    return {
      totalVisits,
      avgVisitTime,
      avgConformance: 100,
      visitsByDay: visitsByDayData,
      visitsByRoute: visitsByRouteData,
      conformanceData,
    };
  };

  const metrics = calculateMetrics();
  const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard de Métricas</h1>
            <p className="text-gray-600 mt-1">Análise de desempenho e conformidade</p>
          </div>
          <Button onClick={() => logout()} variant="outline" className="text-gray-700">
            Sair
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Date Range Filter */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Período de Análise
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

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Total de Visitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{metrics.totalVisits}</div>
              <p className="text-xs text-gray-600 mt-2">No período selecionado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Tempo Médio de Visita
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{metrics.avgVisitTime}m</div>
              <p className="text-xs text-gray-600 mt-2">Minutos por visita</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Taxa de Conformidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{metrics.avgConformance}%</div>
              <p className="text-xs text-gray-600 mt-2">Visitas conformes</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="visits" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="visits">Visitas por Dia</TabsTrigger>
            <TabsTrigger value="routes">Visitas por Rota</TabsTrigger>
            <TabsTrigger value="conformance">Conformidade</TabsTrigger>
          </TabsList>

          {/* Visits by Day */}
          <TabsContent value="visits" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Visitas Realizadas por Dia</CardTitle>
                <CardDescription>Distribuição de visitas ao longo do período</CardDescription>
              </CardHeader>
              <CardContent>
                {reportsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.visitsByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="visits" fill="#3b82f6" name="Visitas" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Visits by Route */}
          <TabsContent value="routes" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Visitas por Rota</CardTitle>
                <CardDescription>Distribuição de visitas entre as rotas</CardDescription>
              </CardHeader>
              <CardContent>
                {reportsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.visitsByRoute}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="route" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="visits" fill="#10b981" name="Visitas" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conformance */}
          <TabsContent value="conformance" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Taxa de Conformidade</CardTitle>
                <CardDescription>Proporção de visitas conformes vs não conformes</CardDescription>
              </CardHeader>
              <CardContent>
                {reportsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={metrics.conformanceData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {metrics.conformanceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Summary */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Resumo do Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  <strong>Período:</strong> {dateRange.start.toLocaleDateString('pt-BR')} a {dateRange.end.toLocaleDateString('pt-BR')}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Total de Visitas:</strong> {metrics.totalVisits}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Tempo Médio:</strong> {metrics.avgVisitTime} minutos
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  <strong>Conformidade:</strong> {metrics.avgConformance}%
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Rotas Ativas:</strong> {metrics.visitsByRoute.length}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Dias com Visitas:</strong> {metrics.visitsByDay.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
