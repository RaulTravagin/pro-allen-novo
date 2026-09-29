import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Loader2, Calendar, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminHeader } from "@/components/AdminHeader";
import { createRelativeDateRange, formatDateInputValue, parseDateInputValue } from "@/lib/reportDateRange";
import { downloadStyledWorkbook } from "@/lib/xlsxExport";
import { buildReportExportWorksheets, countReportOccurrences, type ReportType } from "@/lib/reportExport";

export default function ReportExport() {
  const { user, logout } = useAuth();
  const [dateRange, setDateRange] = useState(() => createRelativeDateRange(7));
  const [reportType, setReportType] = useState<ReportType>("visits");
  const [isExporting, setIsExporting] = useState(false);

  // Queries
  const { data: reports, isLoading: reportsLoading } = trpc.reports.occurrencesByDateRange.useQuery({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const occurrenceCount = countReportOccurrences(reports ?? []);
  const exportCount = reportType === "compliance" ? occurrenceCount : reports?.length ?? 0;
  const exportCountLabel = reportType === "compliance"
    ? "ocorrências"
    : reportType === "summary"
      ? "visitas resumidas"
      : "visitas";

  const generateExcel = async () => {
    if (!reports || reports.length === 0 || (reportType === "compliance" && occurrenceCount === 0)) {
      toast.error("Nenhum dado disponível para exportar");
      return;
    }

    setIsExporting(true);
    try {
      const periodLabel = `${dateRange.start.toLocaleDateString("pt-BR")} a ${dateRange.end.toLocaleDateString("pt-BR")}`;
      const worksheets = buildReportExportWorksheets(reports, reportType, periodLabel);
      await downloadStyledWorkbook(`relatorio-${reportType}-${formatDateInputValue(dateRange.start)}-${formatDateInputValue(dateRange.end)}.xlsx`, worksheets);
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
      <AdminHeader
        title="Exportar relatórios"
        subtitle="Gere arquivos operacionais para análise e compartilhamento"
        onLogout={() => logout()}
      />

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
                        value={formatDateInputValue(dateRange.start)}
                        onChange={(e) => setDateRange({ ...dateRange, start: parseDateInputValue(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-gray-600">Data Final</label>
                  <input
                    type="date"
                        value={formatDateInputValue(dateRange.end)}
                        onChange={(e) => setDateRange({ ...dateRange, end: parseDateInputValue(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Report Type */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-3">Tipo de Relatório</label>
              <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visits">Relatório de Visitas com Horários</SelectItem>
                  <SelectItem value="summary">Resumo Executivo</SelectItem>
                  <SelectItem value="compliance">Registros de ocorrência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Período:</strong> {dateRange.start.toLocaleDateString('pt-BR')} a {dateRange.end.toLocaleDateString('pt-BR')}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Tipo:</strong> {reportType === 'visits' ? 'Visitas com Horários' : reportType === 'summary' ? 'Resumo Executivo' : 'Registros de ocorrência'}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Registros:</strong> {exportCount} {exportCountLabel}
              </p>
            </div>

            {/* Export Button */}
            <Button
              onClick={generateExcel}
              disabled={isExporting || !reports || exportCount === 0}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando Excel...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Relatório Excel (.xlsx)
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
              <p>Os relatórios são exportados em formato Excel (.xlsx):</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Compatível com Excel, LibreOffice e WPS</li>
                <li>Filtro automático e primeira linha congelada</li>
                <li>Datas, horários e duração com formato de planilha</li>
                <li>Colunas dimensionadas para leitura e impressão</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
