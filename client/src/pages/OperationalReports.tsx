import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowLeft, Car, ClipboardCheck, Download, FileDown, FileText, Fuel, Gauge, Loader2, Printer, Route, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatCurrency(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
}

function formatNumber(value: unknown, suffix = "") {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix}` : "—";
}

function formatDateTime(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function formatDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

function formatTime(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
}

function formatCoordinates(latitude: unknown, longitude: unknown) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Não registrado";
}

function formatFuelType(value: string | null | undefined) {
  return ({ gasoline: "Gasolina", ethanol: "Etanol", diesel: "Diesel" } as Record<string, string>)[value ?? ""] ?? "—";
}

function shiftLabel(shiftType: string | null | undefined) {
  return shiftType === "day" ? "Plantão Diurno · 06h às 18h" : shiftType === "night" ? "Plantão Noturno · 18h às 06h" : "Todos os plantões";
}

function reportContext(report: any) {
  const selectedSupervisor = report.filterOptions?.supervisors?.find((supervisor: any) => supervisor.id === report.filters?.supervisorId);
  const selectedVehicle = report.filterOptions?.vehicles?.find((vehicle: any) => vehicle.id === report.filters?.vehicleId);
  return {
    period: `${formatDate(report.filters?.startDate)} a ${formatDate(report.filters?.endDate)}`,
    shift: shiftLabel(report.filters?.shiftType),
    supervisor: selectedSupervisor?.name ?? selectedSupervisor?.username ?? "Todos os supervisores",
    vehicle: selectedVehicle ? `${selectedVehicle.plate} · ${selectedVehicle.model}` : "Todas as viaturas",
  };
}

export function buildOperationalReportCsv(report: any) {
  const context = reportContext(report);
  const routesById = new Map((report.routes ?? []).map((route: any) => [route.id, route]));
  const visits = [...(report.visits ?? [])].sort((first: any, second: any) => new Date(first.arrivalTime ?? first.auditSubmittedAt ?? 0).getTime() - new Date(second.arrivalTime ?? second.auditSubmittedAt ?? 0).getTime());
  const rows: Array<Array<string | number>> = [
    ["Pro Allen — Relatório de Gestão Operacional"],
    ["Parâmetros aplicados", `Filtro: ${context.shift} | Supervisor: ${context.supervisor} | Viatura: ${context.vehicle} | Período: ${context.period}`],
    [],
    ["Resumo executivo"],
    ["Postos previstos", report.summary.plannedPosts ?? 0],
    ["Postos auditados", report.summary.auditedPosts ?? report.summary.inspections ?? 0],
    ["KM total percorrido", report.summary.totalKm],
    ["Ocorrências marcadas", report.summary.nonCompliantItems ?? 0],
    ["Conformidade", report.summary.complianceRate == null ? "—" : `${report.summary.complianceRate}%`],
    [],
    ["Vistorias em ordem cronológica"],
    ["Data", "Hora", "Supervisor", "Rota", "Turno", "Posto / Condomínio", "Status da Vistoria", "Início da Visita", "Fim da Visita", "Envio da Auditoria", "KM Inicial", "KM Final", "KM Percorrido", "Ocorrências", "Observações", "GPS de Chegada", "GPS de Saída"],
    ...visits.map((visit: any) => {
      const route = routesById.get(visit.supervisorRouteId) as any;
      return [formatDate(visit.arrivalTime ?? visit.auditSubmittedAt), formatTime(visit.arrivalTime ?? visit.auditSubmittedAt), visit.supervisorName ?? "—", route?.routeName ?? "—", shiftLabel(route?.shiftType), visit.postName ?? "—", visitStatusLabel(visit.status), formatDateTime(visit.arrivalTime), formatDateTime(visit.departureTime), formatDateTime(visit.auditSubmittedAt), formatNumber(route?.kmInitial, " km"), formatNumber(route?.kmFinal, " km"), formatNumber(route?.kmCovered, " km"), Number(visit.nonCompliant ?? 0) > 0 ? `${visit.nonCompliant} ocorrência(s)` : "Sem ocorrência", visit.observations ?? visit.coverageReason ?? "Sem observações", formatCoordinates(visit.arrivalLatitude, visit.arrivalLongitude), formatCoordinates(visit.departureLatitude, visit.departureLongitude)];
    }),
    [],
    ["Frota e abastecimentos"],
    ["Data", "Hora", "Viatura", "Supervisor", "KM no Abastecimento", "Combustível", "Litros", "Valor do Abastecimento (R$)", "Média de Consumo (Km/L)", "Custo por KM (R$)"],
    ...(report.fuelLogs ?? []).map((log: any) => [formatDate(log.createdAt), formatTime(log.createdAt), `${log.vehiclePlate ?? "—"}${log.vehicleModel ? ` · ${log.vehicleModel}` : ""}`, log.supervisorName ?? "—", formatNumber(log.odometerKm, " km"), formatFuelType(log.fuelType), log.liters, log.amount, log.consumptionKmPerLiter ?? "—", log.costPerKm ?? "—"]),
  ];
  return rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
}

function downloadCsv(report: any) {
  const content = buildOperationalReportCsv(report);
  const url = URL.createObjectURL(new Blob([`\ufeff${content}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `pro-allen-relatorio-operacional-${toDateInput(new Date(report.filters.startDate))}-${toDateInput(new Date(report.filters.endDate))}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function Metric({ label, value, icon: Icon, alert = false }: { label: string; value: string; icon: typeof Gauge; alert?: boolean }) {
  return <Card className={alert ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}><CardContent className="p-5"><Icon className={`h-5 w-5 ${alert ? "text-amber-700" : "text-blue-700"}`} /><p className="mt-4 text-2xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-sm text-slate-600">{label}</p></CardContent></Card>;
}

function splitIntoPages<T>(items: T[], size: number) {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages.length ? pages : [[]];
}

function visitStatusLabel(status: string) {
  if (status === "visited") return "Concluída";
  if (status === "in_progress") return "Em andamento";
  return "Pendente";
}

function PrintHeader({ report, page, totalPages }: { report: any; page: number; totalPages: number }) {
  const context = reportContext(report);
  return <>
    <div className="print-header">
      <div><p className="print-kicker">PRO ALLEN · GESTÃO OPERACIONAL</p><h1>Relatório Operacional de Campo</h1><p>Filtro: {context.shift} · Supervisor: {context.supervisor} · Período: {context.period}</p></div>
      <div className="print-stamp"><strong>DOCUMENTO DE GESTÃO</strong><span>Viatura: {context.vehicle}</span><span>Emissão: {new Date().toLocaleString("pt-BR")}</span></div>
    </div>
    <div className="print-rule" />
    <div className="print-page-meta"><span>Uso interno · Supervisão de campo</span><span>Página {page} de {totalPages}</span></div>
  </>;
}

function PrintOperationalReport({ data }: { data: any }) {
  const fuelPages = splitIntoPages<any>(data.fuelLogs ?? [], 14);
  const auditPages = splitIntoPages<any>(data.visits ?? [], 11);
  const totalPages = 1 + fuelPages.length + auditPages.length;
  const summary = data.summary;
  let pageNumber = 1;

  return <article className="print-document" aria-hidden="true">
    <section className="print-page">
      <PrintHeader report={data} page={pageNumber++} totalPages={totalPages} />
      <div className="print-title-block"><p>VISÃO EXECUTIVA</p><h2>Resumo do período</h2><span>Indicadores consolidados de rota, consumo e auditoria.</span></div>
      <div className="print-metric-grid">
        <div><span>Postos previstos / auditados</span><strong>{formatNumber(summary?.plannedPosts)} / {formatNumber(summary?.auditedPosts ?? summary?.inspections)}</strong></div>
        <div><span>KM total percorrido</span><strong>{formatNumber(summary?.totalKm, " km")}</strong></div>
        <div><span>Combustível</span><strong>{formatCurrency(summary?.totalFuelAmount)}</strong></div>
        <div><span>Média de consumo</span><strong>{summary?.averageConsumptionKmPerLiter != null ? formatNumber(summary.averageConsumptionKmPerLiter, " km/L") : "Sem base"}</strong></div>
        <div><span>Ocorrências marcadas</span><strong>{formatNumber(summary?.nonCompliantItems)}</strong></div>
      </div>
      <div className="print-summary-box"><h3>Leitura gerencial</h3><p>Foram consolidados {summary?.plannedPosts ?? 0} posto(s) previstos e {summary?.auditedPosts ?? summary?.inspections ?? 0} auditado(s), com {formatNumber(summary?.totalKm, " km")} percorridos e {summary?.nonCompliantItems ?? 0} ocorrência(s) marcada(s). Os detalhes das viaturas e dos postos seguem nas páginas subsequentes.</p></div>
      <footer className="print-footer"><span>Pro Allen · Relatório operacional</span><span>Gerado pelo sistema de gestão de supervisores</span></footer>
    </section>
    {fuelPages.map((logs, index) => <section className="print-page" key={`fuel-${index}`}>
      <PrintHeader report={data} page={pageNumber++} totalPages={totalPages} />
      <div className="print-title-block compact"><p>FROTA E ABASTECIMENTOS</p><h2>Controle de consumo</h2><span>{data.fuelLogs?.length ?? 0} registro(s) no período selecionado.</span></div>
      <table className="print-table print-fuel-table"><thead><tr><th>Data / hora</th><th>Viatura</th><th>Supervisor</th><th>KM</th><th>Comb.</th><th>Litros</th><th>Valor</th><th>Média</th><th>Custo/KM</th></tr></thead><tbody>{logs.length ? logs.map((log: any) => <tr key={log.id}><td>{formatDateTime(log.createdAt)}</td><td><strong>{log.vehiclePlate ?? "—"}</strong><br /><small>{log.vehicleModel ?? ""}</small></td><td>{log.supervisorName ?? "—"}</td><td>{formatNumber(log.odometerKm, " km")}</td><td>{formatFuelType(log.fuelType)}</td><td>{formatNumber(log.liters, " L")}</td><td>{formatCurrency(log.amount)}</td><td>{log.consumptionKmPerLiter != null ? formatNumber(log.consumptionKmPerLiter, " km/L") : "—"}</td><td>{log.costPerKm != null ? formatCurrency(log.costPerKm) : "—"}</td></tr>) : <tr><td colSpan={9} className="print-empty">Nenhum abastecimento no período selecionado.</td></tr>}</tbody></table>
      <footer className="print-footer"><span>Pro Allen · Controle de frota</span><span>Dados registrados pelos supervisores</span></footer>
    </section>)}
    {auditPages.map((visits, index) => <section className="print-page" key={`audit-${index}`}>
      <PrintHeader report={data} page={pageNumber++} totalPages={totalPages} />
      <div className="print-title-block compact"><p>AUDITORIAS E CHECKLISTS</p><h2>Visitas aos postos</h2><span>Horários, situação da visita e observações operacionais.</span></div>
      <table className="print-table print-audit-table"><thead><tr><th>Posto / região</th><th>Supervisor / viatura</th><th>Entrada e saída</th><th>Status</th><th>Checklist</th><th>Ocorrências e observações</th></tr></thead><tbody>{visits.length ? visits.map((visit: any) => <tr key={visit.id}><td><strong>{visit.postName}</strong><br /><small>{visit.postRegion ?? ""}</small></td><td>{visit.supervisorName ?? "—"}<br /><small>{visit.vehiclePlate ?? "Sem placa"}</small></td><td>Entrada: {formatDateTime(visit.arrivalTime)}<br />Saída: {formatDateTime(visit.departureTime)}</td><td>{visitStatusLabel(visit.status)}</td><td>{visit.nonCompliant > 0 ? `${visit.nonCompliant} ocorrência(s)` : "Conforme"}<br /><small>{visit.compliant} item(ns) conforme(s)</small></td><td>{visit.observations || visit.coverageReason || "Sem observações"}</td></tr>) : <tr><td colSpan={6} className="print-empty">Nenhuma auditoria no período selecionado.</td></tr>}</tbody></table>
      <footer className="print-footer"><span>Pro Allen · Auditorias de postos</span><span>Informações preenchidas em campo</span></footer>
    </section>)}
  </article>;
}

export default function OperationalReports() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const gestorSession = trpc.gestorAccess.session.useQuery(undefined, { retry: false });
  const [startDate, setStartDate] = useState(() => toDateInput(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)));
  const [endDate, setEndDate] = useState(() => toDateInput(new Date()));
  const [supervisorId, setSupervisorId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [shiftType, setShiftType] = useState<"" | "day" | "night">("");
  const isAdmin = user?.role === "admin";
  const hasAccess = isAdmin || gestorSession.data?.authenticated === true;
  const filters = useMemo(() => ({ startDate: new Date(`${startDate}T12:00:00`), endDate: new Date(`${endDate}T12:00:00`), supervisorId: supervisorId ? Number(supervisorId) : null, vehicleId: vehicleId ? Number(vehicleId) : null, shiftType: shiftType || null }), [startDate, endDate, supervisorId, vehicleId, shiftType]);
  const report = trpc.gestor.operationalReport.useQuery(filters, { enabled: hasAccess, retry: false });
  const utils = trpc.useUtils();
  const [editingFuelId, setEditingFuelId] = useState<number | null>(null);
  const [fuelAmountDraft, setFuelAmountDraft] = useState("");
  const [fuelEditError, setFuelEditError] = useState<string | null>(null);
  const updateFuelAmount = trpc.gestor.updateFuelAmount.useMutation({
    onSuccess: async () => {
      setEditingFuelId(null);
      setFuelAmountDraft("");
      setFuelEditError(null);
      await utils.gestor.operationalReport.invalidate();
    },
    onError: (error) => setFuelEditError(error.message),
  });
  const beginFuelEdit = (log: any) => {
    setFuelEditError(null);
    setEditingFuelId(log.id);
    setFuelAmountDraft(String(log.amount ?? ""));
  };
  const saveFuelAmount = (log: any) => {
    const amount = Number(fuelAmountDraft.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setFuelEditError("Informe um valor maior que zero.");
      return;
    }
    if (!window.confirm(`Confirmar correção do abastecimento de ${formatCurrency(log.amount)} para ${formatCurrency(amount)}?`)) return;
    updateFuelAmount.mutate({ id: log.id, amount: Number(amount.toFixed(2)) });
  };
  const data = report.data;

  if (authLoading || gestorSession.isLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando relatórios...</div>;
  if (!hasAccess) return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><Card className="max-w-md border-amber-200"><CardHeader><CardTitle className="flex items-center gap-2 text-amber-950"><ShieldCheck className="h-5 w-5" /> Acesso restrito</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-slate-600">Esta área é exclusiva ao Gestor e ao Administrador.</p><Button className="mt-5" onClick={() => navigate("/gestor/acesso")}>Acessar como Gestor</Button></CardContent></Card></main>;

  const options = data?.filterOptions ?? { supervisors: [], vehicles: [] };
  const summary = data?.summary;
  return <main className="report-print min-h-screen bg-slate-100 text-slate-950">
    <style>{`
      .print-document { display: none; }
      @media print {
        @page { size: A4 landscape; margin: 15mm 15mm 20mm; }
        html, body { width: 267mm !important; height: auto !important; background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .no-print, .screen-report { display: none !important; }
        .report-print { display: block !important; min-height: 0 !important; background: #fff !important; }
        .print-document { display: block !important; width: 267mm !important; color: #172033 !important; font-family: Arial, Helvetica, sans-serif !important; }
        .print-page { display: flex; flex-direction: column; box-sizing: border-box; width: 267mm; min-height: 175mm; padding: 0; break-after: page; page-break-after: always; overflow: visible; }
        .print-page:last-child { break-after: auto; page-break-after: auto; }
        .print-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12mm; break-inside: avoid; page-break-inside: avoid; }
        .print-kicker { margin: 0 0 2mm; color: #9a7000; font-size: 8pt; font-weight: 700; letter-spacing: .18em; }
        .print-header h1 { margin: 0; font-size: 19pt; line-height: 1.1; color: #111827; }
        .print-header p:not(.print-kicker) { margin: 2mm 0 0; font-size: 9pt; color: #475569; }
        .print-stamp { min-width: 50mm; border: .35mm solid #d6b044; border-radius: 2mm; padding: 3mm 4mm; text-align: right; color: #6b4c00; font-size: 8pt; }
        .print-stamp strong, .print-stamp span { display: block; }
        .print-stamp span { margin-top: 1mm; color: #64748b; }
        .print-rule { flex: 0 0 auto; height: 1.2mm; margin: 5mm 0 2mm; background: #172033; }
        .print-page-meta { display: flex; justify-content: space-between; color: #64748b; font-size: 7.5pt; break-inside: avoid; page-break-inside: avoid; }
        .print-title-block { margin-top: 9mm; break-inside: avoid; page-break-inside: avoid; }
        .print-title-block p { margin: 0; color: #9a7000; font-size: 8pt; font-weight: 700; letter-spacing: .14em; }
        .print-title-block h2 { margin: 1.5mm 0 1mm; font-size: 17pt; line-height: 1.1; color: #172033; }
        .print-title-block span { font-size: 9pt; color: #64748b; }
        .print-title-block.compact { margin-top: 7mm; margin-bottom: 4mm; }
        .print-title-block.compact h2 { font-size: 15pt; }
        .print-metric-grid { display: grid !important; grid-template-columns: repeat(5, 1fr) !important; gap: 3mm; margin-top: 7mm; }
        .print-metric-grid > div { box-sizing: border-box; min-height: 27mm; border: .3mm solid #cbd5e1; border-radius: 2mm; padding: 4mm; background: #f8fafc; break-inside: avoid; page-break-inside: avoid; }
        .print-summary-box { break-inside: avoid; page-break-inside: avoid; }
        .print-metric-grid span { display: block; color: #64748b; font-size: 8pt; }
        .print-metric-grid strong { display: block; margin-top: 3mm; color: #111827; font-size: 15pt; line-height: 1.05; }
        .print-summary-box { margin-top: 7mm; border-left: 1.2mm solid #d3a800; background: #fffbeb; padding: 4mm 5mm; }
        .print-summary-box h3 { margin: 0; color: #6b4c00; font-size: 10pt; }
        .print-summary-box p { margin: 2mm 0 0; color: #475569; font-size: 9pt; line-height: 1.45; }
        .print-table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; font-size: 7.7pt !important; line-height: 1.25 !important; break-inside: auto; page-break-inside: auto; }
        .print-table thead { display: table-header-group; }
        .print-table tfoot { display: table-footer-group; }
        .print-table th { padding: 2.4mm 2mm; background: #172033 !important; color: #fff !important; font-size: 7.1pt; font-weight: 700; letter-spacing: .03em; text-align: left; }
        .print-table td { vertical-align: top; border-bottom: .22mm solid #cbd5e1; padding: 2.4mm 2mm; overflow-wrap: anywhere; }
        .print-table tr, .print-table td, .print-table th { break-inside: avoid; page-break-inside: avoid; }
        .print-table tbody tr:nth-child(even) { background: #f8fafc !important; }
        .print-table small { color: #64748b; font-size: 6.8pt; }
        .print-fuel-table th:nth-child(1) { width: 11%; } .print-fuel-table th:nth-child(2) { width: 13%; } .print-fuel-table th:nth-child(3) { width: 13%; } .print-fuel-table th:nth-child(4) { width: 10%; } .print-fuel-table th:nth-child(5) { width: 10%; } .print-fuel-table th:nth-child(6) { width: 8%; } .print-fuel-table th:nth-child(7) { width: 10%; } .print-fuel-table th:nth-child(8) { width: 12%; } .print-fuel-table th:nth-child(9) { width: 13%; }
        .print-audit-table th:nth-child(1) { width: 16%; } .print-audit-table th:nth-child(2) { width: 15%; } .print-audit-table th:nth-child(3) { width: 18%; } .print-audit-table th:nth-child(4) { width: 10%; } .print-audit-table th:nth-child(5) { width: 12%; } .print-audit-table th:nth-child(6) { width: 29%; }
        .print-empty { padding: 12mm !important; text-align: center; color: #64748b; }
        .print-footer { position: static; display: flex; justify-content: space-between; margin-top: auto; padding-top: 4mm; border-top: .22mm solid #cbd5e1; color: #64748b; font-size: 7pt; break-inside: avoid; page-break-inside: avoid; }
      }
    `}</style>
    <header className="no-print border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Pro Allen</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Relatórios de Gestão Operacional</h1><p className="mt-1 text-sm text-slate-600">Auditorias, rotas, viaturas e consumo de combustível.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate(isAdmin ? "/admin" : "/gestor")}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button><Button variant="outline" onClick={() => data && downloadCsv(data)} disabled={!data}><Download className="mr-2 h-4 w-4" /> Exportar CSV / Excel</Button><Button onClick={() => window.print()} disabled={!data} className="bg-slate-950 text-white hover:bg-slate-800"><Printer className="mr-2 h-4 w-4" /> Exportar PDF</Button></div></div></header>
    <div className="screen-report mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-6">
      <section className="print-avoid rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8"><p className="text-sm font-semibold text-amber-300">Pro Allen — Relatório de Gestão Operacional</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Visão executiva da operação de campo</h2><p className="mt-3 text-sm text-slate-300">Parâmetros aplicados: Filtro: {shiftLabel(shiftType)} · Supervisor: {data ? reportContext(data).supervisor : "Carregando"} · Viatura: {data ? reportContext(data).vehicle : "Carregando"} · Período: {data ? reportContext(data).period : "Carregando"} · Emissão: {new Date().toLocaleString("pt-BR")}</p></section>
      <section className="no-print print-avoid rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><label className="grid gap-1 text-xs font-semibold text-slate-600">Início<input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs font-semibold text-slate-600">Fim<input type="date" value={endDate} min={startDate} max={toDateInput(new Date())} onChange={(event) => setEndDate(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs font-semibold text-slate-600">Turno<select value={shiftType} onChange={(event) => setShiftType(event.target.value as "" | "day" | "night")} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"><option value="">Todos os turnos</option><option value="day">Diurno · 06h às 18h</option><option value="night">Noturno · 18h às 06h</option></select></label><label className="grid gap-1 text-xs font-semibold text-slate-600">Supervisor<select value={supervisorId} onChange={(event) => setSupervisorId(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"><option value="">Todos os supervisores</option>{options.supervisors.map((supervisor: any) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name ?? supervisor.username}</option>)}</select></label><label className="grid gap-1 text-xs font-semibold text-slate-600">Placa / viatura<select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"><option value="">Todas as viaturas</option>{options.vehicles.map((vehicle: any) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.model}</option>)}</select></label></div><p className="mt-3 text-xs text-slate-500">O período inicial considera os últimos 30 dias. Cada data operacional vai de 06h até 06h do dia seguinte, mantendo o plantão noturno unido após a meia-noite.</p></section>
      {report.isLoading ? <div className="flex items-center justify-center p-12 text-sm text-slate-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Consolidando dados...</div> : report.error ? <Card className="border-rose-200 bg-rose-50"><CardContent className="flex gap-3 p-5 text-sm text-rose-950"><AlertTriangle className="h-5 w-5 shrink-0" />{report.error.message}</CardContent></Card> : data && <>
        {fuelEditError && <div className="print-avoid rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{fuelEditError}</div>}
        <section className="print-avoid grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={ClipboardCheck} label="Postos previstos vs. auditados" value={`${formatNumber(summary?.plannedPosts)} / ${formatNumber(summary?.auditedPosts ?? summary?.inspections)}`} /><Metric icon={Route} label="KM total percorrido" value={formatNumber(summary?.totalKm, " km")} /><Metric icon={AlertTriangle} label="Ocorrências marcadas" value={formatNumber(summary?.nonCompliantItems)} alert={(summary?.nonCompliantItems ?? 0) > 0} /><Metric icon={Gauge} label="Índice de conformidade" value={summary?.complianceRate != null ? `${formatNumber(summary.complianceRate)}%` : "Sem base"} /></section>
        <section className="print-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h3 className="flex items-center gap-2 text-lg font-semibold"><Car className="h-5 w-5 text-emerald-700" /> Frota e abastecimento</h3><p className="mt-1 text-sm text-slate-600">{data.fuelLogs.length} abastecimento(s) no período filtrado.</p></div><div className="overflow-x-auto"><table className="print-table min-w-[1040px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Data / hora</th><th className="px-4 py-3">Placa</th><th className="px-4 py-3">Supervisor</th><th className="px-4 py-3 text-right">KM atual</th><th className="px-4 py-3 text-right">Litros</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-right">Média</th><th className="no-print px-4 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{data.fuelLogs.length ? data.fuelLogs.map((log: any) => <tr key={log.id}><td className="px-4 py-3 text-slate-600">{formatDateTime(log.createdAt)}</td><td className="px-4 py-3 font-medium">{log.vehiclePlate} <span className="font-normal text-slate-500">· {log.vehicleModel}</span></td><td className="px-4 py-3 text-slate-600">{log.supervisorName ?? "—"}</td><td className="px-4 py-3 text-right">{formatNumber(log.odometerKm, " km")}</td><td className="px-4 py-3 text-right">{formatNumber(log.liters, " L")}</td><td className="px-4 py-3 text-right">{editingFuelId === log.id ? <div className="flex items-center justify-end gap-2"><input aria-label={`Novo valor do abastecimento ${log.id}`} type="text" inputMode="decimal" placeholder="155,89" value={fuelAmountDraft} onChange={(event) => setFuelAmountDraft(event.target.value)} className="h-9 w-28 rounded-md border border-slate-300 px-2 text-right" /><Button type="button" size="sm" onClick={() => saveFuelAmount(log)} disabled={updateFuelAmount.isPending}>Salvar</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditingFuelId(null)}>Cancelar</Button></div> : formatCurrency(log.amount)}</td><td className="px-4 py-3 text-right font-semibold text-emerald-800">{log.consumptionKmPerLiter != null ? formatNumber(log.consumptionKmPerLiter, " km/L") : "—"}</td><td className="no-print px-4 py-3 text-right"><Button type="button" size="sm" variant="outline" onClick={() => beginFuelEdit(log)} disabled={updateFuelAmount.isPending}>{editingFuelId === log.id ? "Editando" : "Corrigir valor"}</Button></td></tr>) : <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Nenhum abastecimento no período selecionado.</td></tr>}</tbody></table></div></section>
        <section className="print-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h3 className="flex items-center gap-2 text-lg font-semibold"><FileText className="h-5 w-5 text-blue-700" /> Auditorias e checklists dos postos</h3><p className="mt-1 text-sm text-slate-600">Horários, situação da visita e ocorrências registradas em campo.</p></div><div className="overflow-x-auto"><table className="print-table min-w-[1080px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Posto auditado</th><th className="px-4 py-3">Supervisor</th><th className="px-4 py-3">Entrada / saída</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Ocorrências</th></tr></thead><tbody className="divide-y divide-slate-100">{data.visits.length ? data.visits.map((visit: any) => <tr key={visit.id} className="align-top"><td className="px-4 py-3 font-medium">{visit.postName}<p className="mt-1 text-xs font-normal text-slate-500">{visit.postRegion}</p></td><td className="px-4 py-3 text-slate-600">{visit.supervisorName ?? "—"}<p className="mt-1 text-xs">{visit.vehiclePlate ?? "Sem placa"}</p></td><td className="px-4 py-3 text-xs text-slate-600">Entrada: {formatDateTime(visit.arrivalTime)}<br />Saída: {formatDateTime(visit.departureTime)}</td><td className="px-4 py-3"><span className={visit.status === "visited" ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800" : visit.status === "in_progress" ? "rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800" : "rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"}>{visit.status === "visited" ? "Concluída" : visit.status === "in_progress" ? "Em andamento" : "Pendente"}</span></td><td className="max-w-[340px] px-4 py-3 text-xs leading-5 text-slate-600">{visit.nonCompliant > 0 ? <p className="mb-2 font-semibold text-rose-700">{visit.nonCompliant} ocorrência(s) no checklist</p> : <p className="mb-2 font-semibold text-emerald-700">Checklist conforme</p>}{visit.observations || visit.coverageReason || "Sem observações"}</td></tr>) : <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nenhuma auditoria no período selecionado.</td></tr>}</tbody></table></div></section>
      </>}
    </div>
    {data && <PrintOperationalReport data={data} />}
  </main>;
}
