import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import type { PersonnelImportPayload } from "@shared/personnelImport";

const statusLabels = { IMPORTED: "Aplicado ao cadastro", PENDING: "Pendente — não aplicado ao cadastro", REFERENCE: "Referência da planilha" } as const;

function rowStatusLabel(row: PersonnelImportPayload["sheets"][number]["rows"][number]) {
  return row.freelancerId ? "Aplicado à lista de freelancers" : statusLabels[row.status];
}

export function PersonnelImportSourceViewer({ payload }: { payload: PersonnelImportPayload }) {
  const [sheetName, setSheetName] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [search, setSearch] = useState("");
  const sheet = payload.sheets.find(item => item.name === sheetName) ?? payload.sheets[0];
  const rows = (sheet?.rows ?? []).filter(row => (status === "ALL" || row.status === status) && (!search.trim() || row.cells.some(cell => cell.value.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))) || String(row.row) === search.trim()));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 text-xs sm:grid-cols-3">
        <div className="rounded-lg bg-emerald-50 p-3 text-emerald-900">{payload.summary.updated} atualizados · {payload.summary.created} incluídos</div>
        <div className="rounded-lg bg-amber-50 p-3 text-amber-900">{payload.summary.pending} linhas de funcionários em espera · {payload.summary.warnings} com alerta</div>
        <div className="rounded-lg bg-slate-100 p-3 text-slate-700">{payload.summary.freelancersImported ?? 0} freelancers na lista separada · {payload.summary.freelancersPending ?? 0} linhas de freelancers pendentes</div>
        <div className="rounded-lg bg-slate-100 p-3 text-slate-700">{payload.summary.unlinkedContacts} contatos sem vínculo automático com funcionários</div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5"><Label htmlFor="import-source-sheet">Aba da planilha</Label><select id="import-source-sheet" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={sheet?.name ?? ""} onChange={event => setSheetName(event.target.value)}>{payload.sheets.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></div>
        <div className="space-y-1.5"><Label htmlFor="import-source-status">Situação da linha</Label><select id="import-source-status" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={status} onChange={event => setStatus(event.target.value)}><option value="PENDING">Pendentes</option><option value="IMPORTED">Aplicadas</option><option value="REFERENCE">Referência / cabeçalhos</option><option value="ALL">Todas</option></select></div>
        <div className="space-y-1.5"><Label htmlFor="import-source-search">Buscar na origem</Label><Input id="import-source-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, valor ou número da linha" /></div>
      </div>
      <p className="text-xs text-slate-500" aria-live="polite">{rows.length} linhas nesta consulta. Os valores abaixo são a origem preservada; alterações na ficha não reescrevem a planilha.</p>
      <div className="max-h-[600px] space-y-2 overflow-y-auto">
        {rows.map(row => (
          <details key={row.row} className={`rounded-lg border bg-white ${row.status === "PENDING" ? "border-amber-200" : "border-slate-200"}`}>
            <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-slate-800">Linha {row.row} · {rowStatusLabel(row)}{row.employeeId ? <span className="ml-2 font-normal text-slate-500">Funcionário #{row.employeeId}</span> : null}{row.freelancerId ? <span className="ml-2 font-normal text-slate-500">Freelancer #{row.freelancerId}</span> : null}</summary>
            <div className="space-y-3 border-t border-slate-100 p-3">
              {row.reasons.length > 0 && <ul className="list-inside list-disc space-y-1 text-xs text-amber-900">{row.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
              <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{row.cells.map((cell, index) => <div key={`${cell.column}-${index}`} className="rounded bg-slate-50 p-2 text-xs"><dt className="break-words font-semibold text-slate-500">{cell.column} · {cell.header || "Sem cabeçalho"}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-800">{cell.value || "—"}</dd>{cell.formula && <dd className="mt-1 break-words font-mono text-[10px] text-slate-500">Fórmula: {cell.formula}</dd>}</div>)}</dl>
            </div>
          </details>
        ))}
        {!rows.length && <p className="rounded border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Nenhuma linha com esse filtro nesta aba. Selecione outra situação para consultar os valores originais.</p>}
      </div>
    </div>
  );
}

function HistoryContent() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showSources, setShowSources] = useState(false);
  const batches = trpc.personnel.importBatches.useQuery();
  const activeId = selectedId ?? batches.data?.[0]?.id;
  const detail = trpc.personnel.importBatch.useQuery({ id: activeId ?? 1 }, { enabled: showSources && Boolean(activeId) });
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader><CardTitle className="text-lg">Planilhas e pendências do RH</CardTitle><CardDescription>Origem preservada para conferência. As linhas de freelancers ficam em lista separada; linhas sem vínculo seguem preservadas aqui, sem associação automática a funcionários.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {batches.isLoading && <p className="text-sm text-slate-500">Carregando histórico...</p>}
        {batches.isError && <p className="text-sm text-red-700">Não foi possível carregar o histórico de planilhas.</p>}
        {batches.data?.length ? <div className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1 space-y-1.5"><Label htmlFor="import-source-batch">Arquivo de origem</Label><select id="import-source-batch" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={activeId} onChange={event => setSelectedId(Number(event.target.value))}>{batches.data.map(batch => <option key={batch.id} value={batch.id}>{batch.fileName}</option>)}</select></div><Button type="button" variant="outline" onClick={() => setShowSources(value => !value)}>{showSources ? "Recolher origem" : "Consultar origem e pendências"}</Button></div> : !batches.isLoading && !batches.isError && <p className="text-sm text-slate-500">Nenhuma planilha registrada ainda.</p>}
        {showSources && detail.isLoading && <p className="text-sm text-slate-500">Carregando valores de origem...</p>}
        {showSources && detail.isError && <p className="text-sm text-red-700">Não foi possível consultar os valores de origem.</p>}
        {showSources && detail.data?.sourceData && <PersonnelImportSourceViewer key={detail.data.id} payload={detail.data.sourceData} />}
      </CardContent>
    </Card>
  );
}

export function PersonnelImportHistory({ role }: { role: "RH" | "ADM" | "SUPERVISOR" | "FINANCEIRO" }) {
  if (role !== "RH" && role !== "ADM") return null;
  return <HistoryContent />;
}
