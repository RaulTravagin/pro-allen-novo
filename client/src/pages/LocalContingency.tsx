import React, { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Download, HardDrive, LogOut, MapPin, Play, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  LocalActivity,
  LocalChecklistAnswer,
  LocalSession,
  LocalVisit,
  LOCAL_ROUTES,
  checkInLocalVisit,
  checkOutLocalVisit,
  exportLocalContingencyData,
  getActivitiesForLocalUser,
  getLocalSession,
  getOpenActivityForLocalUser,
  importLocalContingencyData,
  loginLocal,
  logoutLocal,
  saveLocalChecklistItem,
  saveLocalVisitObservations,
  startLocalActivity,
  updateLocalKm,
} from "@/lib/localContingency";

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function duration(arrivalAt: string | null, departureAt: string | null) {
  if (!arrivalAt) return "Aguardando chegada";
  const diff = Math.max(0, (new Date(departureAt ?? Date.now()).getTime() - new Date(arrivalAt).getTime()) / 60_000);
  return `${Math.floor(diff / 60)}h ${Math.floor(diff % 60)}min`;
}

function statusStyle(answer: LocalChecklistAnswer) {
  if (answer === "conforme") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (answer === "atencao") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function answerLabel(answer: LocalChecklistAnswer) {
  return answer === "conforme" ? "Conforme" : answer === "atencao" ? "Requer atenção" : "Pendente";
}

export default function LocalContingency() {
  const [, navigate] = useLocation();
  const [session, setSession] = useState<LocalSession | null>(() => getLocalSession());
  const [activity, setActivity] = useState<LocalActivity | null>(() => session ? getOpenActivityForLocalUser(session.username) : null);
  const [history, setHistory] = useState<LocalActivity[]>(() => session ? getActivitiesForLocalUser(session.username) : []);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [routeId, setRouteId] = useState("");
  const [kmValue, setKmValue] = useState("");
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = (nextSession = session) => {
    if (!nextSession) return;
    setActivity(getOpenActivityForLocalUser(nextSession.username));
    setHistory(getActivitiesForLocalUser(nextSession.username));
  };

  const completedActivities = useMemo(() => history.filter((item) => item.status === "completed").slice(0, 4), [history]);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const nextSession = await loginLocal(username, password);
      if (!nextSession) return toast.error("Usuário ou senha inválidos para o modo local.");
      setSession(nextSession);
      refresh(nextSession);
      setPassword("");
      toast.success("Modo local iniciado neste dispositivo.");
    } catch {
      toast.error("O navegador não disponibilizou a verificação segura de credenciais.");
    }
  }

  function startActivity() {
    if (!session || !routeId) return;
    try {
      const next = startLocalActivity(session, routeId);
      setActivity(next);
      setHistory(getActivitiesForLocalUser(session.username));
      setRouteId("");
      toast.success(`${next.routeName} iniciada no modo local.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar a atividade.");
    }
  }

  function saveKm(type: "initial" | "final") {
    if (!activity) return;
    const numericKm = Number(kmValue.replace(",", "."));
    if (!Number.isFinite(numericKm) || numericKm < 0) return toast.error("Informe uma quilometragem válida.");
    try {
      const next = updateLocalKm(activity.id, numericKm, type);
      setKmValue("");
      if (type === "final") {
        setActivity(null);
        refresh();
        toast.success("Atividade encerrada. Você já pode iniciar a próxima rota.");
      } else {
        setActivity(next);
        refresh();
        toast.success("KM inicial salvo neste dispositivo.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o KM.");
    }
  }

  function updateVisit(visitId: string, operation: "checkin" | "checkout") {
    if (!activity) return;
    const next = operation === "checkin" ? checkInLocalVisit(activity.id, visitId) : checkOutLocalVisit(activity.id, visitId);
    setActivity(next);
    refresh();
    toast.success(operation === "checkin" ? "Chegada registrada localmente." : "Saída registrada localmente.");
  }

  function updateChecklist(visitId: string, itemId: string, answer: LocalChecklistAnswer, notes: string) {
    if (!activity) return;
    const next = saveLocalChecklistItem(activity.id, visitId, itemId, answer, notes);
    setActivity(next);
    refresh();
  }

  function updateObservations(visitId: string, observations: string) {
    if (!activity) return;
    const next = saveLocalVisitObservations(activity.id, visitId, observations);
    setActivity(next);
    refresh();
  }

  function exportData() {
    const blob = new Blob([exportLocalContingencyData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pro-allen-contingencia-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Cópia dos dados locais exportada.");
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      importLocalContingencyData(await file.text());
      const nextSession = getLocalSession();
      setSession(nextSession);
      setActivity(nextSession ? getOpenActivityForLocalUser(nextSession.username) : null);
      setHistory(nextSession ? getActivitiesForLocalUser(nextSession.username) : []);
      toast.success("Dados locais importados neste dispositivo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível importar o arquivo.");
    } finally {
      event.target.value = "";
    }
  }

  function leaveLocalMode() {
    logoutLocal();
    setSession(null);
    setActivity(null);
    setHistory([]);
    navigate("/");
  }

  if (!session) {
    return <div className="min-h-screen bg-slate-950 p-4 text-white"><div className="mx-auto flex min-h-screen max-w-md items-center"><Card className="w-full border-white/10 bg-white shadow-2xl"><CardHeader><div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400 text-slate-950"><HardDrive className="h-6 w-6" /></div><CardTitle className="text-2xl text-slate-950">Modo local de contingência</CardTitle><CardDescription>Login e checklist salvos apenas neste navegador, para uso durante indisponibilidade do servidor.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={submitLogin}><div className="space-y-1.5"><Label htmlFor="local-username">Usuário</Label><Input id="local-username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></div><div className="space-y-1.5"><Label htmlFor="local-password">Senha</Label><Input id="local-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></div><Button type="submit" className="w-full bg-amber-400 font-bold text-slate-950 hover:bg-amber-300">Entrar no modo local</Button></form><div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">Atenção: dados deste modo ficam neste dispositivo.</p><p className="mt-1">Exporte o arquivo de contingência antes de trocar de aparelho, limpar dados do navegador ou voltar ao servidor.</p></div><Button variant="link" className="mt-3 px-0 text-slate-700" onClick={() => navigate("/")}>Voltar ao acesso online</Button></CardContent></Card></div></div>;
  }

  return <div className="min-h-screen bg-slate-50 pb-10 text-slate-950"><header className="border-b border-slate-200 bg-slate-950 text-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-slate-950"><HardDrive className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Pro Allen</p><h1 className="font-bold">Modo local de contingência</h1></div></div><div className="flex items-center gap-2"><Badge className="border border-amber-300/30 bg-amber-300/10 text-amber-200">{session.name}</Badge><Button size="sm" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={leaveLocalMode}><LogOut className="mr-2 h-4 w-4" />Sair</Button></div></div></header>
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6"><div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Dados locais e não compartilhados.</p><p className="mt-1">Checklists, horários e KM registrados aqui não aparecem em outros celulares nem no Painel do Gestor até a recuperação manual por exportação e importação.</p></div></div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-5">{activity ? <LocalActivityPanel activity={activity} kmValue={kmValue} setKmValue={setKmValue} onSaveKm={saveKm} onVisitAction={updateVisit} onChecklistChange={updateChecklist} onObservationsChange={updateObservations} expandedVisitId={expandedVisitId} setExpandedVisitId={setExpandedVisitId} /> : <StartActivityPanel routeId={routeId} setRouteId={setRouteId} onStart={startActivity} hasCompletedBase={completedActivities.some((item) => item.activityType === "operational_base")} />}</div>
        <aside className="space-y-5"><Card><CardHeader className="pb-3"><CardTitle className="text-base">Proteja os registros locais</CardTitle><CardDescription>Faça uma cópia antes de encerrar o uso deste aparelho.</CardDescription></CardHeader><CardContent className="space-y-2"><Button className="w-full" variant="outline" onClick={exportData}><Download className="mr-2 h-4 w-4" />Exportar dados locais</Button><Button className="w-full" variant="outline" onClick={() => inputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Importar dados locais</Button><input ref={inputRef} type="file" accept="application/json" className="hidden" onChange={importData} /></CardContent></Card><Card><CardHeader className="pb-3"><CardTitle className="text-base">Atividades recentes</CardTitle></CardHeader><CardContent className="space-y-3">{completedActivities.length ? completedActivities.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3"><p className="font-semibold text-slate-900">{item.routeName}</p><p className="mt-1 text-xs text-slate-600">Encerrada em {formatDateTime(item.completedAt)}</p><p className="mt-1 text-xs text-slate-600">KM: {item.kmInitial ?? "—"} → {item.kmFinal ?? "—"}</p></div>) : <p className="text-sm text-slate-600">Nenhuma atividade concluída neste dispositivo.</p>}</CardContent></Card></aside></div>
    </main></div>;
}

function StartActivityPanel({ routeId, setRouteId, onStart, hasCompletedBase }: { routeId: string; setRouteId: (value: string) => void; onStart: () => void; hasCompletedBase: boolean }) {
  return <Card><CardHeader><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><Play className="h-5 w-5" /></div><div><CardTitle>Iniciar atividade local</CardTitle><CardDescription>Escolha a Base Operacional ou uma rota de campo.</CardDescription></div></div></CardHeader><CardContent className="space-y-4">{hasCompletedBase && <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950"><p className="font-semibold">Base Operacional encerrada</p><p className="mt-1">Você pode iniciar agora uma rota de campo no mesmo dispositivo.</p></div>}<div className="space-y-2"><Label htmlFor="local-route">Atividade</Label><Select value={routeId} onValueChange={setRouteId}><SelectTrigger id="local-route"><SelectValue placeholder="Selecione a Base ou uma rota" /></SelectTrigger><SelectContent>{LOCAL_ROUTES.map((route) => <SelectItem key={route.id} value={route.id}>{route.name} · {route.region}</SelectItem>)}</SelectContent></Select></div><Button className="w-full bg-slate-950 text-white hover:bg-slate-800" disabled={!routeId} onClick={onStart}><Play className="mr-2 h-4 w-4" />Iniciar atividade</Button></CardContent></Card>;
}

function LocalActivityPanel({ activity, kmValue, setKmValue, onSaveKm, onVisitAction, onChecklistChange, onObservationsChange, expandedVisitId, setExpandedVisitId }: { activity: LocalActivity; kmValue: string; setKmValue: (value: string) => void; onSaveKm: (type: "initial" | "final") => void; onVisitAction: (visitId: string, action: "checkin" | "checkout") => void; onChecklistChange: (visitId: string, itemId: string, answer: LocalChecklistAnswer, notes: string) => void; onObservationsChange: (visitId: string, observations: string) => void; expandedVisitId: string | null; setExpandedVisitId: (value: string | null) => void }) {
  const hasInitialKm = activity.kmInitial !== null;
  return <div className="space-y-5"><Card className="border-slate-900 bg-slate-950 text-white"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Atividade em andamento</p><CardTitle className="mt-1 text-2xl text-white">{activity.routeName}</CardTitle><CardDescription className="text-slate-300">{activity.routeRegion} · iniciado em {formatDateTime(activity.startedAt)}</CardDescription></div><Badge className="bg-emerald-400 text-emerald-950">Em andamento</Badge></div></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-300">KM inicial</p><p className="mt-1 text-lg font-bold">{activity.kmInitial ?? "Pendente"}</p></div><div className="rounded-lg border border-white/10 bg-white/5 p-3"><p className="text-xs text-slate-300">KM final</p><p className="mt-1 text-lg font-bold">{activity.kmFinal ?? "Pendente"}</p></div></div><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Input inputMode="decimal" value={kmValue} onChange={(event) => setKmValue(event.target.value)} placeholder={hasInitialKm ? "Informe o KM final" : "Informe o KM inicial"} className="border-white/20 bg-white text-slate-950" /><Button className="bg-amber-400 text-slate-950 hover:bg-amber-300" onClick={() => onSaveKm(hasInitialKm ? "final" : "initial")}>{hasInitialKm ? "Encerrar atividade" : "Registrar KM inicial"}</Button></div></CardContent></Card>
    {activity.activityType === "operational_base" ? <Card><CardContent className="flex gap-3 p-5"><ShieldCheck className="h-6 w-6 text-violet-700" /><div><p className="font-semibold">Atividade na Base Operacional</p><p className="mt-1 text-sm text-slate-600">Não há postos ou checklists fictícios para a Base. Registre o KM inicial e, ao sair, informe o KM final para encerrar e abrir a seleção da próxima rota.</p></div></CardContent></Card> : <div className="space-y-4"><div><h2 className="text-xl font-bold">Postos e checklists locais</h2><p className="mt-1 text-sm text-slate-600">Os dados são gravados imediatamente neste navegador.</p></div>{activity.visits.map((visit) => <LocalVisitCard key={visit.id} visit={visit} canCheckIn={hasInitialKm} isExpanded={expandedVisitId === visit.id} setExpanded={() => setExpandedVisitId(expandedVisitId === visit.id ? null : visit.id)} onAction={(action) => onVisitAction(visit.id, action)} onChecklistChange={(itemId, answer, notes) => onChecklistChange(visit.id, itemId, answer, notes)} onObservationsChange={(observations) => onObservationsChange(visit.id, observations)} />)}</div>}</div>;
}

function LocalVisitCard({ visit, canCheckIn, isExpanded, setExpanded, onAction, onChecklistChange, onObservationsChange }: { visit: LocalVisit; canCheckIn: boolean; isExpanded: boolean; setExpanded: () => void; onAction: (action: "checkin" | "checkout") => void; onChecklistChange: (itemId: string, answer: LocalChecklistAnswer, notes: string) => void; onObservationsChange: (observations: string) => void }) {
  const answered = visit.items.filter((item) => item.answer !== "pendente").length;
  return <Card className={visit.status === "in_progress" ? "border-emerald-300" : visit.status === "visited" ? "border-slate-200" : "border-slate-200"}><CardContent className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-950">{visit.postName}</h3><Badge className={visit.status === "in_progress" ? "bg-emerald-100 text-emerald-800" : visit.status === "visited" ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-800"}>{visit.status === "in_progress" ? "Em atendimento" : visit.status === "visited" ? "Visita concluída" : "Aguardando chegada"}</Badge></div><p className="mt-1 text-sm text-slate-600">{visit.region}</p>{visit.arrivalAt && <p className="mt-2 text-xs text-slate-600">Chegada: {formatDateTime(visit.arrivalAt)} · Permanência: {duration(visit.arrivalAt, visit.departureAt)}</p>}</div>{visit.status === "pending" ? <Button disabled={!canCheckIn} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onAction("checkin")}><MapPin className="mr-2 h-4 w-4" />Registrar chegada</Button> : visit.status === "in_progress" ? <Button className="bg-amber-500 text-slate-950 hover:bg-amber-400" onClick={() => onAction("checkout")}><CheckCircle2 className="mr-2 h-4 w-4" />Registrar saída</Button> : <Badge className="bg-slate-100 text-slate-700">Concluída</Badge>}</div>{visit.status !== "pending" && <div className="mt-4 border-t border-slate-100 pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Checklist: {answered}/{visit.items.length} itens respondidos</p><Button variant="outline" size="sm" onClick={setExpanded}><ClipboardCheck className="mr-2 h-4 w-4" />{isExpanded ? "Fechar checklist" : "Abrir checklist"}</Button></div>{isExpanded && <div className="mt-4 space-y-3">{visit.items.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><p className="font-medium text-slate-900">{item.label}</p><Select value={item.answer} onValueChange={(answer: LocalChecklistAnswer) => onChecklistChange(item.id, answer, item.notes)}><SelectTrigger className={`w-full md:w-48 ${statusStyle(item.answer)}`}><SelectValue>{answerLabel(item.answer)}</SelectValue></SelectTrigger><SelectContent><SelectItem value="conforme">Conforme</SelectItem><SelectItem value="atencao">Requer atenção</SelectItem><SelectItem value="pendente">Pendente</SelectItem></SelectContent></Select></div><Input className="mt-3" value={item.notes} onChange={(event) => onChecklistChange(item.id, item.answer, event.target.value)} placeholder="Observação do item (opcional)" /></div>)}<div className="space-y-2"><Label htmlFor={`observations-${visit.id}`}>Observações gerais</Label><Textarea id={`observations-${visit.id}`} value={visit.observations} onChange={(event) => onObservationsChange(event.target.value)} placeholder="Registre as observações da visita." /></div></div>}</div>}</CardContent></Card>;
}
