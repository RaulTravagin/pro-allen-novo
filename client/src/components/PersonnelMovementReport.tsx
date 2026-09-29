import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { downloadStyledWorkbook } from "@/lib/xlsxExport";
import { buildPersonnelMovementWorksheets, type MovementReportAudience } from "@/lib/personnelMovementExport";
import { brazilCivilDate, getPersonnelMovementWindow, summarizeGestorMovements, summarizePersonnelMovements, type GestorMovementRow, type MovementPeriod, type PersonnelMovementRow } from "@shared/personnel-movement-report";
import { isCivilMonth } from "@shared/personnel-schedules";
import { formatCivilDate } from "@/lib/personnelCivilCalendar";
import { trpc } from "@/lib/trpc";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const statusOptions = [
  ["ALL", "Todos os status"],
  ["PENDING", "Pendente"],
  ["APPROVED", "Aprovado"],
  ["PAID", "Quitado"],
  ["REJECTED", "Rejeitado"],
] as const;
const statusLabels: Record<string, string> = {
  PENDING: "Pendente", APPROVED: "Aprovado", PAID: "Quitado", REJECTED: "Rejeitado",
};
const kindLabels = { FT: "Folga trabalhada", EXTRA: "Serviço extra" };

function brazilTodayMonth() {
  return (brazilCivilDate(new Date()) ?? new Date().toISOString().slice(0, 10)).slice(0, 7);
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatTimestampDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const civilDate = brazilCivilDate(value);
  return civilDate ? formatCivilDate(civilDate) : "—";
}

export function PersonnelMovementReport({ audience }: { audience: MovementReportAudience }) {
  const [month, setMonth] = useState(brazilTodayMonth);
  const [period, setPeriod] = useState<MovementPeriod>("ALL");
  const [kind, setKind] = useState<"ALL" | "FT" | "EXTRA">("ALL");
  const [status, setStatus] = useState("ALL");
  const [employee, setEmployee] = useState("ALL");
  const [serviceFilter, setServiceFilter] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const validMonth = isCivilMonth(month);
  const input = useMemo(() => ({ month, period }), [month, period]);
  const personnelQuery = trpc.personnel.movementReport.useQuery(input, {
    enabled: audience !== "GESTOR" && validMonth,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const gestorQuery = trpc.gestor.personnelMovementReport.useQuery(input, {
    enabled: audience === "GESTOR" && validMonth,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const query = audience === "GESTOR" ? gestorQuery : personnelQuery;
  const reportMatchesSelection = validMonth && query.data?.window?.month === month && query.data?.window?.period === period;
  const rawRows = (reportMatchesSelection ? query.data?.rows ?? [] : []) as Array<PersonnelMovementRow & GestorMovementRow>;
  const employees = useMemo(() => Array.from(new Set(rawRows.map((row) => row.employeeName).filter((name): name is string => Boolean(name)))).sort((left, right) => left.localeCompare(right, "pt-BR")), [rawRows]);
  const filteredRows = useMemo(() => rawRows.filter((row) => {
    if (kind !== "ALL" && row.kind !== kind) return false;
    if (audience !== "GESTOR") {
      const personRow = row as PersonnelMovementRow;
      if (status !== "ALL" && personRow.status !== status) return false;
      if (employee !== "ALL" && personRow.employeeName !== employee) return false;
      if (serviceFilter.trim()) {
        const queryText = serviceFilter.trim().toLocaleLowerCase("pt-BR");
        const searchable = [personRow.post, personRow.description, personRow.reason].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
        if (!searchable.includes(queryText)) return false;
      }
    }
    return true;
  }), [audience, employee, kind, rawRows, serviceFilter, status]);
  const periodWindow = useMemo(() => validMonth ? getPersonnelMovementWindow(month, period) : null, [month, period, validMonth]);
  const periodLabel = periodWindow?.label ?? "Mês inválido";
  const personnelSummary = audience === "GESTOR" ? null : summarizePersonnelMovements(filteredRows as PersonnelMovementRow[]);
  const gestorSummary = audience === "GESTOR" ? summarizeGestorMovements(filteredRows as GestorMovementRow[]) : null;
  const totalRecords = audience === "GESTOR" ? gestorSummary?.totalRecords ?? 0 : personnelSummary?.totalRecords ?? 0;
  const noRowsInWindow = rawRows.length === 0;

  const exportReport = async () => {
    if (!totalRecords) return;
    setIsExporting(true);
    try {
      const filename = `relatorio-movimentacoes-${audience.toLowerCase()}-${month}-${period.toLowerCase()}.xlsx`;
      await downloadStyledWorkbook(filename, buildPersonnelMovementWorksheets(filteredRows as PersonnelMovementRow[] | GestorMovementRow[], audience, periodLabel));
      toast.success("Relatório exportado em Excel.");
    } catch (error) {
      console.error("Falha ao exportar relatório de movimentações:", error);
      toast.error("Não foi possível exportar o relatório. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  const retry = () => void query.refetch();
  const isGestor = audience === "GESTOR";
  const title = isGestor ? "Movimentações de pessoal · visão operacional" : "Relatório de Folgas Trabalhadas e Serviços Extras";

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              {isGestor
                ? "Resumo agregado por data e tipo. Sem nomes, identificadores, justificativas ou valores de pagamento."
                : audience === "FINANCEIRO"
                  ? "Valores, status e identificação necessária à conferência de pagamento; sem CPF, PIX ou informações médicas."
                  : "Dados de operação necessários à auditoria do RH; sem CPF, PIX, documentos médicos ou links privados."}
            </CardDescription>
          </div>
          <Button variant="outline" onClick={exportReport} disabled={isExporting || query.isLoading || totalRecords === 0} className="shrink-0 gap-2">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isExporting ? "Gerando XLSX…" : "Exportar Excel (.xlsx)"}
          </Button>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          As janelas 01–15 e 16–último dia agrupam a movimentação para consulta. Não criam fechamento, lote, aprovação nem bloqueio.
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Mês civil
            <Input aria-label="Mês civil do relatório" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            {!validMonth && <span role="alert" className="font-normal text-rose-700">Selecione um mês civil válido.</span>}
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Janela de movimentação
            <select aria-label="Janela de movimentação" value={period} onChange={(event) => setPeriod(event.target.value as MovementPeriod)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900">
              <option value="ALL">Mês completo · 01–último dia</option>
              <option value="FIRST_HALF">01–15</option>
              <option value="SECOND_HALF">16–último dia</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Tipo de movimentação
            <select aria-label="Tipo de movimentação" value={kind} onChange={(event) => setKind(event.target.value as "ALL" | "FT" | "EXTRA")} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900">
              <option value="ALL">FTs e serviços extras</option>
              <option value="FT">Folgas trabalhadas</option>
              <option value="EXTRA">Serviços extras</option>
            </select>
          </label>
          {!isGestor ? (
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Status
              <select aria-label="Status do relatório" value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900">
                {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          ) : <div className="flex items-end text-xs text-slate-500">{periodWindow ? `Janela: ${formatCivilDate(periodWindow.startDate)} a ${formatCivilDate(periodWindow.endDate)}` : "Selecione um mês válido."}</div>}
          {!isGestor && (
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Funcionário
              <select aria-label="Filtrar por funcionário" value={employee} onChange={(event) => setEmployee(event.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900">
                <option value="ALL">Todos os funcionários</option>
                {employees.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          )}
          {(audience === "RH" || audience === "ADM") && (
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Posto/serviço
              <Input aria-label="Filtrar por posto ou serviço" value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)} placeholder="Buscar posto ou descrição do serviço" />
            </label>
          )}
        </div>

        {query.error && (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 sm:flex-row sm:items-center sm:justify-between">
            <span>Não foi possível carregar o relatório: {query.error.message}</span>
            <Button variant="outline" onClick={retry} disabled={query.isFetching} className="gap-2 border-rose-300 bg-white text-rose-900">
              <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /> Tentar novamente
            </Button>
          </div>
        )}
        {(query.isLoading || query.isFetching) && !reportMatchesSelection && (
          <div className="flex items-center justify-center rounded-xl border border-slate-100 bg-slate-50 p-10 text-sm text-slate-600"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando somente a janela selecionada…</div>
        )}

        {reportMatchesSelection && !query.error && (
          <>
            {isGestor ? (
              <section aria-label="Resumo do relatório" className="grid gap-3 sm:grid-cols-3">
                <SummaryCard label="Movimentações na janela" value={String(gestorSummary?.totalRecords ?? 0)} />
                <SummaryCard label="Folgas trabalhadas" value={String(gestorSummary?.byKind.FT ?? 0)} />
                <SummaryCard label="Serviços extras" value={String(gestorSummary?.byKind.EXTRA ?? 0)} />
              </section>
            ) : (
              <section aria-label="Resumo totalizador" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Registros filtrados" value={String(personnelSummary?.totalRecords ?? 0)} />
                <SummaryCard label="Folgas trabalhadas" value={`${personnelSummary?.byKind.FT.count ?? 0} · ${formatCurrency(personnelSummary?.byKind.FT.amount ?? 0)}`} />
                <SummaryCard label="Serviços extras" value={`${personnelSummary?.byKind.EXTRA.count ?? 0} · ${formatCurrency(personnelSummary?.byKind.EXTRA.amount ?? 0)}`} />
                <SummaryCard label="Total no filtro" value={formatCurrency(personnelSummary?.totalAmount ?? 0)} />
              </section>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>Período consultado: <strong className="text-slate-700">{periodLabel}</strong> · início e fim inclusivos · data civil brasileira</span>
              <span>{query.isFetching ? "Atualizando…" : `${totalRecords} registro(s)`}</span>
            </div>
            {noRowsInWindow ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="font-semibold text-slate-800">Nenhuma movimentação nesta janela</p>
                <p className="mt-1 text-sm text-slate-600">Não há FTs ou serviços extras registrados para o período civil selecionado.</p>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">Nenhum registro corresponde aos filtros escolhidos.</div>
            ) : isGestor ? (
              <MovementTable rows={filteredRows as GestorMovementRow[]} audience="GESTOR" />
            ) : (
              <MovementTable rows={filteredRows as PersonnelMovementRow[]} audience={audience} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-slate-900">{value}</p></div>;
}

function MovementTable({ rows, audience }: { rows: PersonnelMovementRow[] | GestorMovementRow[]; audience: MovementReportAudience }) {
  if (audience === "GESTOR") {
    return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[500px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Data civil</th><th className="px-4 py-3">Movimentação</th><th className="px-4 py-3 text-right">Registros</th></tr></thead><tbody className="divide-y divide-slate-100">{(rows as GestorMovementRow[]).map((row, index) => <tr key={`${row.civilDate}-${row.kind}-${index}`}><td className="px-4 py-3">{formatCivilDate(row.civilDate)}</td><td className="px-4 py-3">{kindLabels[row.kind]}</td><td className="px-4 py-3 text-right font-semibold">{row.count}</td></tr>)}</tbody></table></div>;
  }
  const finance = audience === "FINANCEIRO";
  return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Data</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Funcionário</th>{!finance && <><th className="px-3 py-3">Posto/serviço</th><th className="px-3 py-3">Detalhe operacional</th></>}<th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Valor</th>{finance && <th className="px-3 py-3">Pagamento previsto</th>}</tr></thead><tbody className="divide-y divide-slate-100">{(rows as PersonnelMovementRow[]).map((row, index) => <tr key={`${row.civilDate}-${row.kind}-${index}`}><td className="whitespace-nowrap px-3 py-3">{formatCivilDate(row.civilDate)}</td><td className="px-3 py-3">{kindLabels[row.kind]}</td><td className="px-3 py-3 font-medium">{row.employeeName ?? "—"}</td>{!finance && <><td className="px-3 py-3">{row.post || "—"}{row.kind === "EXTRA" && row.description ? <span className="block text-xs text-slate-500">{row.description}</span> : null}</td><td className="max-w-sm px-3 py-3 text-slate-600">{row.kind === "FT" ? row.reason || "—" : `${row.hoursOrDaily ?? "—"} h/diária`}</td></>}<td className="px-3 py-3">{statusLabels[row.status] ?? row.status}</td><td className="whitespace-nowrap px-3 py-3 text-right font-semibold">{formatCurrency(Number(row.amount ?? 0))}</td>{finance && <td className="px-3 py-3">{row.kind === "FT" ? formatTimestampDate(row.paymentDate) : "—"}</td>}</tr>)}</tbody></table></div>;
}
