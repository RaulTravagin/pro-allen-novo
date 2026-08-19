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

function formatFuelType(value: string | null | undefined) {
  return ({ gasoline: "Gasolina", ethanol: "Etanol", diesel: "Diesel" } as Record<string, string>)[value ?? ""] ?? "—";
}

export function buildOperationalReportCsv(report: any) {
  const rows: Array<Array<string | number>> = [
    ["Pro Allen — Relatório de Gestão Operacional"],
    ["Período", `${new Date(report.filters.startDate).toLocaleDateString("pt-BR")} a ${new Date(report.filters.endDate).toLocaleDateString("pt-BR")}`],
    [],
    ["Resumo executivo"],
    ["KM rodados", report.summary.totalKm],
    ["Gasto com combustível", report.summary.totalFuelAmount],
    ["Média geral Km/L", report.summary.averageConsumptionKmPerLiter ?? "—"],
    ["Inspeções realizadas", report.summary.inspections],
    ["Conformidade", report.summary.complianceRate == null ? "—" : `${report.summary.complianceRate}%`],
    [],
    ["Frota e abastecimentos"],
    ["Data/Hora", "Placa", "Modelo", "Supervisor", "Rota", "KM atual", "Combustível", "Litros", "Valor total (R$)", "Média (Km/L)", "Custo por KM (R$)"],
    ...(report.fuelLogs ?? []).map((log: any) => [formatDateTime(log.createdAt), log.vehiclePlate ?? "—", log.vehicleModel ?? "—", log.supervisorName ?? "—", log.supervisorRouteId ?? "—", log.odometerKm, formatFuelType(log.fuelType), log.liters, log.amount, log.consumptionKmPerLiter ?? "—", log.costPerKm ?? "—"]),
    [],
    ["Auditorias e checklists"],
    ["Posto auditado", "Supervisor", "Placa", "Entrada", "Saída", "Status da visita", "Conformes", "Ocorrências", "Observações"],
    ...(report.visits ?? []).map((visit: any) => [visit.postName, visit.supervisorName ?? "—", visit.vehiclePlate ?? "—", formatDateTime(visit.arrivalTime), formatDateTime(visit.departureTime), visit.status, visit.compliant, visit.nonCompliant, visit.observations ?? visit.coverageReason ?? "—"]),
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

export default function OperationalReports() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const gestorSession = trpc.gestorAccess.session.useQuery(undefined, { retry: false });
  const [startDate, setStartDate] = useState(() => toDateInput(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)));
  const [endDate, setEndDate] = useState(() => toDateInput(new Date()));
  const [supervisorId, setSupervisorId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const isAdmin = user?.role === "admin";
  const hasAccess = isAdmin || gestorSession.data?.authenticated === true;
  const filters = useMemo(() => ({ startDate: new Date(`${startDate}T00:00:00`), endDate: new Date(`${endDate}T23:59:59`), supervisorId: supervisorId ? Number(supervisorId) : null, vehicleId: vehicleId ? Number(vehicleId) : null }), [startDate, endDate, supervisorId, vehicleId]);
  const report = trpc.gestor.operationalReport.useQuery(filters, { enabled: hasAccess, retry: false });
  const data = report.data;

  if (authLoading || gestorSession.isLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando relatórios...</div>;
  if (!hasAccess) return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><Card className="max-w-md border-amber-200"><CardHeader><CardTitle className="flex items-center gap-2 text-amber-950"><ShieldCheck className="h-5 w-5" /> Acesso restrito</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-slate-600">Esta área é exclusiva ao Gestor e ao Administrador.</p><Button className="mt-5" onClick={() => navigate("/gestor/acesso")}>Acessar como Gestor</Button></CardContent></Card></main>;

  const options = data?.filterOptions ?? { supervisors: [], vehicles: [] };
  const summary = data?.summary;
  return <main className="report-print min-h-screen bg-slate-100 text-slate-950">
    <style>{`@media print { @page { size: A4 landscape; margin: 12mm; } body { background: white !important; } .no-print { display: none !important; } .report-print { background: white !important; } .print-avoid { break-inside: avoid; page-break-inside: avoid; } .print-table { font-size: 9px; } }`}</style>
    <header className="no-print border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Pro Allen</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Relatórios de Gestão Operacional</h1><p className="mt-1 text-sm text-slate-600">Auditorias, rotas, viaturas e consumo de combustível.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate(isAdmin ? "/admin" : "/gestor")}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button><Button variant="outline" onClick={() => data && downloadCsv(data)} disabled={!data}><Download className="mr-2 h-4 w-4" /> Exportar CSV / Excel</Button><Button onClick={() => window.print()} disabled={!data} className="bg-slate-950 text-white hover:bg-slate-800"><Printer className="mr-2 h-4 w-4" /> Exportar PDF</Button></div></div></header>
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-6">
      <section className="print-avoid rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8"><p className="text-sm font-semibold text-amber-300">Pro Allen — Relatório de Gestão Operacional</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Visão executiva da operação de campo</h2><p className="mt-3 text-sm text-slate-300">Período: {new Date(filters.startDate).toLocaleDateString("pt-BR")} a {new Date(filters.endDate).toLocaleDateString("pt-BR")} · Emissão: {new Date().toLocaleString("pt-BR")}</p></section>
      <section className="no-print print-avoid rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="grid gap-1 text-xs font-semibold text-slate-600">Início<input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs font-semibold text-slate-600">Fim<input type="date" value={endDate} min={startDate} max={toDateInput(new Date())} onChange={(event) => setEndDate(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs font-semibold text-slate-600">Supervisor<select value={supervisorId} onChange={(event) => setSupervisorId(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"><option value="">Todos os supervisores</option>{options.supervisors.map((supervisor: any) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name ?? supervisor.username}</option>)}</select></label><label className="grid gap-1 text-xs font-semibold text-slate-600">Placa / viatura<select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"><option value="">Todas as viaturas</option>{options.vehicles.map((vehicle: any) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.model}</option>)}</select></label></div><p className="mt-3 text-xs text-slate-500">O período inicial considera os últimos 30 dias. Os dados são atualizados quando os filtros são alterados.</p></section>
      {report.isLoading ? <div className="flex items-center justify-center p-12 text-sm text-slate-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Consolidando dados...</div> : report.error ? <Card className="border-rose-200 bg-rose-50"><CardContent className="flex gap-3 p-5 text-sm text-rose-950"><AlertTriangle className="h-5 w-5 shrink-0" />{report.error.message}</CardContent></Card> : data && <>
        <section className="print-avoid grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric icon={Route} label="KM rodados" value={formatNumber(summary?.totalKm, " km")} /><Metric icon={Fuel} label="Gasto em combustível" value={formatCurrency(summary?.totalFuelAmount)} /><Metric icon={Gauge} label="Média de consumo geral" value={summary?.averageConsumptionKmPerLiter != null ? formatNumber(summary.averageConsumptionKmPerLiter, " km/L") : "Sem base"} /><Metric icon={ClipboardCheck} label="Inspeções realizadas" value={formatNumber(summary?.inspections)} /><Metric icon={AlertTriangle} label="Conformidade / ocorrências" value={summary?.complianceRate != null ? `${formatNumber(summary.complianceRate)}%` : "Sem base"} alert={(summary?.nonCompliantItems ?? 0) > 0} /></section>
        <section className="print-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h3 className="flex items-center gap-2 text-lg font-semibold"><Car className="h-5 w-5 text-emerald-700" /> Frota e abastecimento</h3><p className="mt-1 text-sm text-slate-600">{data.fuelLogs.length} abastecimento(s) no período filtrado.</p></div><div className="overflow-x-auto"><table className="print-table min-w-[1040px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Data / hora</th><th className="px-4 py-3">Placa</th><th className="px-4 py-3">Supervisor</th><th className="px-4 py-3 text-right">KM atual</th><th className="px-4 py-3 text-right">Litros</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-right">Média</th></tr></thead><tbody className="divide-y divide-slate-100">{data.fuelLogs.length ? data.fuelLogs.map((log: any) => <tr key={log.id}><td className="px-4 py-3 text-slate-600">{formatDateTime(log.createdAt)}</td><td className="px-4 py-3 font-medium">{log.vehiclePlate} <span className="font-normal text-slate-500">· {log.vehicleModel}</span></td><td className="px-4 py-3 text-slate-600">{log.supervisorName ?? "—"}</td><td className="px-4 py-3 text-right">{formatNumber(log.odometerKm, " km")}</td><td className="px-4 py-3 text-right">{formatNumber(log.liters, " L")}</td><td className="px-4 py-3 text-right">{formatCurrency(log.amount)}</td><td className="px-4 py-3 text-right font-semibold text-emerald-800">{log.consumptionKmPerLiter != null ? formatNumber(log.consumptionKmPerLiter, " km/L") : "—"}</td></tr>) : <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Nenhum abastecimento no período selecionado.</td></tr>}</tbody></table></div></section>
        <section className="print-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h3 className="flex items-center gap-2 text-lg font-semibold"><FileText className="h-5 w-5 text-blue-700" /> Auditorias e checklists dos postos</h3><p className="mt-1 text-sm text-slate-600">Horários, situação da visita e ocorrências registradas em campo.</p></div><div className="overflow-x-auto"><table className="print-table min-w-[1080px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Posto auditado</th><th className="px-4 py-3">Supervisor</th><th className="px-4 py-3">Entrada / saída</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Ocorrências</th></tr></thead><tbody className="divide-y divide-slate-100">{data.visits.length ? data.visits.map((visit: any) => <tr key={visit.id} className="align-top"><td className="px-4 py-3 font-medium">{visit.postName}<p className="mt-1 text-xs font-normal text-slate-500">{visit.postRegion}</p></td><td className="px-4 py-3 text-slate-600">{visit.supervisorName ?? "—"}<p className="mt-1 text-xs">{visit.vehiclePlate ?? "Sem placa"}</p></td><td className="px-4 py-3 text-xs text-slate-600">Entrada: {formatDateTime(visit.arrivalTime)}<br />Saída: {formatDateTime(visit.departureTime)}</td><td className="px-4 py-3"><span className={visit.status === "visited" ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800" : visit.status === "in_progress" ? "rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800" : "rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"}>{visit.status === "visited" ? "Concluída" : visit.status === "in_progress" ? "Em andamento" : "Pendente"}</span></td><td className="max-w-[340px] px-4 py-3 text-xs leading-5 text-slate-600">{visit.nonCompliant > 0 ? <p className="mb-2 font-semibold text-rose-700">{visit.nonCompliant} ocorrência(s) no checklist</p> : <p className="mb-2 font-semibold text-emerald-700">Checklist conforme</p>}{visit.observations || visit.coverageReason || "Sem observações"}</td></tr>) : <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nenhuma auditoria no período selecionado.</td></tr>}</tbody></table></div></section>
      </>}
    </div>
  </main>;
}
