import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Loader2, Calendar, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ReportExport() {
  const { user, logout } = useAuth();
  const [dateRange, setDateRange] = useState({ start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() });
  const [reportType, setReportType] = useState<string>("visits");
  const [isExporting, setIsExporting] = useState(false);

  // Queries
  const { data: reports, isLoading: reportsLoading } = trpc.reports.visitChecklistsByDateRange.useQuery({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const generatePDF = async () => {
    if (!reports || reports.length === 0) {
      toast.error("Nenhum dado disponível para exportar");
      return;
    }

    setIsExporting(true);
    try {
      // Create CSV content
      const headers = ["Posto", "Rota", "Chegada", "Saída", "Duração", "Data", "Observações"];
      const rows = reports.map((r: any) => {
        const arrival = r.arrivalTime ? new Date(r.arrivalTime).toLocaleTimeString('pt-BR') : '-';
        const departure = r.departureTime ? new Date(r.departureTime).toLocaleTimeString('pt-BR') : '-';
        const duration = r.arrivalTime && r.departureTime 
          ? `${Math.floor((new Date(r.departureTime).getTime() - new Date(r.arrivalTime).getTime()) / 60000)}m`
          : '-';
        const date = new Date(r.visitedAt).toLocaleDateString('pt-BR');
        
        return [
          `Posto #${r.postId}`,
          `Rota #${r.supervisorRouteId}`,
          arrival,
          departure,
          duration,
          date,
          r.observations || '-'
        ];
      });

      // Create CSV string
      const csvContent = [
        ["RELATÓRIO DE VISITAS"],
        [`Período: ${dateRange.start.toLocaleDateString('pt-BR')} a ${dateRange.end.toLocaleDateString('pt-BR')}`],
        [`Total de Visitas: ${reports.length}`],
        [""],
        headers,
        ...rows
      ]
        .map(row => row.map(cell => `"${cell}"`).join(","))
        .join("\n");

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      link.setAttribute("href", url);
      link.setAttribute("download", `relatorio-visitas-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Relatório exportado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar relatório");
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Exportar Relatórios</h1>
            <p className="text-gray-600 mt-1">Gere relatórios em CSV/PDF</p>
          </div>
          <Button onClick={() => logout()} variant="outline" className="text-gray-700">
            Sair
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Export Options */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Configurar Exportação
            </CardTitle>
            <CardDescription>
              Selecione o período e tipo de relatório para exportar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date Range */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-3">Período</label>
              <div className="flex gap-4 items-end flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-gray-600">Data Inicial</label>
                  <input
                    type="date"
                    value={dateRange.start.toISOString().split('T')[0]}
                    onChange={(e) => setDateRange({ ...dateRange, start: new Date(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-gray-600">Data Final</label>
                  <input
                    type="date"
                    value={dateRange.end.toISOString().split('T')[0]}
                    onChange={(e) => setDateRange({ ...dateRange, end: new Date(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Report Type */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-3">Tipo de Relatório</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visits">Relatório de Visitas com Horários</SelectItem>
                  <SelectItem value="summary">Resumo Executivo</SelectItem>
                  <SelectItem value="compliance">Conformidade do Checklist</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Período:</strong> {dateRange.start.toLocaleDateString('pt-BR')} a {dateRange.end.toLocaleDateString('pt-BR')}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Tipo:</strong> {reportType === 'visits' ? 'Visitas com Horários' : reportType === 'summary' ? 'Resumo Executivo' : 'Conformidade'}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Registros:</strong> {reports?.length || 0} visitas
              </p>
            </div>

            {/* Export Button */}
            <Button
              onClick={generatePDF}
              disabled={isExporting || !reports || reports.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Relatório (CSV)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Relatório de Visitas
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
              <p>Inclui detalhes completos de cada visita:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Posto visitado</li>
                <li>Rota atribuída</li>
                <li>Hora de chegada e saída</li>
                <li>Duração da visita</li>
                <li>Data e observações</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Formato de Exportação
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
              <p>Os relatórios são exportados em formato CSV:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Compatível com Excel</li>
                <li>Fácil de compartilhar</li>
                <li>Pronto para análise</li>
                <li>Pode ser convertido para PDF</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
