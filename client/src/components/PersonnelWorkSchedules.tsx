import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CalendarDays, Clock3, Plus, UsersRound } from "lucide-react";
import { WEEKDAY_LABELS, isCivilDate, monthCalendarDays, validateWorkSchedulePattern, type WorkSchedulePattern } from "@shared/personnel-schedules";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PersonnelScheduleCalendar } from "@/components/PersonnelScheduleCalendar";
import { formatCivilDate, localCivilToday } from "@/lib/personnelCivilCalendar";
import { trpc } from "@/lib/trpc";

type EmployeeOption = { id: number; name: string; position?: string | null };
type Preset = "WEEKLY_44" | "WEEKLY_CUSTOM" | "CYCLE_12X36" | "CYCLE_CUSTOM";

function hoursToMinutes(value: string) {
  const hours = Number(value || 0);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) return Number.NaN;
  return Math.round(hours * 60);
}

function minutesToHours(minutes: number) {
  return Number((minutes / 60).toFixed(2)).toLocaleString("pt-BR");
}

function employeeMatches(employee: EmployeeOption, query: string) {
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  return !normalized || `${employee.name} ${employee.position ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalized);
}

function filteredEmployees(employees: EmployeeOption[], query: string, selectedId: string) {
  const matching = employees.filter((employee) => employeeMatches(employee, query));
  const selected = employees.find((employee) => String(employee.id) === selectedId);
  if (selected && !matching.some((employee) => employee.id === selected.id)) return [selected, ...matching];
  return matching;
}

function auditActionLabel(action: string) {
  return ({ ASSIGN: "Atribuição criada", CLOSE: "Vigência anterior encerrada", EDIT: "Vigência corrigida" } as Record<string, string>)[action] ?? action;
}

function snapshotSummary(snapshot: any) {
  if (!snapshot) return "Sem versão anterior";
  return `${snapshot.scheduleName} · funcionário #${snapshot.employeeId} · ${formatCivilDate(snapshot.startDate)} a ${snapshot.endDate ? formatCivilDate(snapshot.endDate) : "em aberto"}${snapshot.cycleAnchorDate ? ` · âncora ${formatCivilDate(snapshot.cycleAnchorDate)}` : ""}`;
}

export function PersonnelWorkSchedules({ employees }: { employees: EmployeeOption[] }) {
  const firstEmployeeId = employees[0]?.id;
  const [employeeId, setEmployeeId] = useState(firstEmployeeId ? String(firstEmployeeId) : "");
  const [calendarEmployeeId, setCalendarEmployeeId] = useState(firstEmployeeId ? String(firstEmployeeId) : "");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [calendarEmployeeSearch, setCalendarEmployeeSearch] = useState("");
  const [month, setMonth] = useState(() => localCivilToday().slice(0, 7));
  const [scheduleId, setScheduleId] = useState("");
  const [startDate, setStartDate] = useState(localCivilToday);
  const [cycleAnchorDate, setCycleAnchorDate] = useState(localCivilToday);
  const [preset, setPreset] = useState<Preset>("WEEKLY_CUSTOM");
  const [name, setName] = useState("");
  const [weeklyHours, setWeeklyHours] = useState<string[]>(Array(7).fill("0"));
  const [cycleHours, setCycleHours] = useState<string[]>(["8", "0"]);
  const [assignmentEditId, setAssignmentEditId] = useState<number | null>(null);
  const [assignmentEndDate, setAssignmentEndDate] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [auditAssignmentId, setAuditAssignmentId] = useState<number | null>(null);

  const schedulesQuery = trpc.personnel.workSchedules.useQuery();
  const calendarQuery = trpc.personnel.employeeScheduleCalendar.useQuery(
    { employeeId: Number(calendarEmployeeId) || 0, month },
    { enabled: Boolean(calendarEmployeeId) && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) },
  );
  const utils = trpc.useUtils();
  const createSchedule = trpc.personnel.createWorkSchedule.useMutation();
  const assignSchedule = trpc.personnel.assignWorkSchedule.useMutation();
  const editScheduleAssignment = trpc.personnel.editWorkScheduleAssignment.useMutation();
  const assignmentAuditQuery = trpc.personnel.workScheduleAssignmentAudit.useQuery(
    { assignmentId: auditAssignmentId ?? 0 },
    { enabled: Boolean(auditAssignmentId) },
  );
  const schedules = schedulesQuery.data ?? [];
  const selectedSchedule = schedules.find((schedule) => String(schedule.id) === scheduleId);
  const calendarDays = calendarQuery.data?.days ?? [];
  const calendarAssignments = calendarQuery.data?.assignments ?? [];
  const calendarMonthEnd = monthCalendarDays(month).at(-1) ?? `${month}-01`;
  const assignmentEmployees = useMemo(() => filteredEmployees(employees, employeeSearch, employeeId), [employees, employeeSearch, employeeId]);
  const calendarEmployees = useMemo(() => filteredEmployees(employees, calendarEmployeeSearch, calendarEmployeeId), [employees, calendarEmployeeSearch, calendarEmployeeId]);
  const calendarEmployee = employees.find((employee) => String(employee.id) === calendarEmployeeId);
  const assignmentEmployee = employees.find((employee) => String(employee.id) === employeeId);
  const calendarAssignmentsForMonth = calendarAssignments.filter((assignment: any) =>
    assignment.startDate <= calendarMonthEnd && (!assignment.endDate || assignment.endDate >= `${month}-01`),
  );
  const weeklyTotalMinutes = weeklyHours.reduce((sum, value) => sum + (Number.isFinite(hoursToMinutes(value)) ? hoursToMinutes(value) : 0), 0);
  const cycleWeeklyHours = cycleHours.reduce((sum, value) => sum + (Number.isFinite(hoursToMinutes(value)) ? hoursToMinutes(value) : 0), 0) * 7 / Math.max(cycleHours.length, 1) / 60;
  const nameSuggests12x36 = /(?:^|\D)12\s*[x×]\s*36(?:\D|$)/i.test(name);
  const patternIs12x36 = preset === "CYCLE_12X36" || (preset === "CYCLE_CUSTOM" && cycleHours.length === 2 && hoursToMinutes(cycleHours[0]) === 720 && hoursToMinutes(cycleHours[1]) === 0);

  useEffect(() => {
    const validIds = new Set(employees.map((employee) => String(employee.id)));
    if (!validIds.has(employeeId)) setEmployeeId(firstEmployeeId ? String(firstEmployeeId) : "");
    if (!validIds.has(calendarEmployeeId)) setCalendarEmployeeId(firstEmployeeId ? String(firstEmployeeId) : "");
  }, [firstEmployeeId, employees, employeeId, calendarEmployeeId]);

  useEffect(() => {
    if (!schedules.length) {
      setScheduleId("");
      return;
    }
    if (!schedules.some((schedule) => String(schedule.id) === scheduleId)) setScheduleId(String(schedules[0].id));
  }, [schedules, scheduleId]);

  const choosePreset = (next: Preset) => {
    setPreset(next);
    if (next === "CYCLE_12X36") {
      setName((value) => value || "12x36");
      setCycleHours(["12", "0"]);
      setCycleAnchorDate(startDate);
    } else if (next === "CYCLE_CUSTOM") {
      setName((value) => value || "Ciclo personalizado");
      setCycleHours(["8", "0"]);
    } else {
      setWeeklyHours(Array(7).fill("0"));
      setName((value) => value || (next === "WEEKLY_44" ? "44 horas semanais" : "Jornada semanal personalizada"));
    }
  };

  const submitSchedule = async (event: FormEvent) => {
    event.preventDefault();
    const pattern: WorkSchedulePattern = preset.startsWith("WEEKLY")
      ? { kind: "WEEKLY", minutesByDay: weeklyHours.map(hoursToMinutes) }
      : { kind: "CYCLE", minutesByDay: cycleHours.map(hoursToMinutes) };
    if (pattern.minutesByDay.some((minutes) => !Number.isInteger(minutes))) return toast.error("Informe horas entre 0 e 24 em cada dia");
    const validation = validateWorkSchedulePattern(pattern);
    if (validation) return toast.error(validation);
    if (preset === "WEEKLY_44" && pattern.minutesByDay.reduce((sum, minutes) => sum + minutes, 0) !== 44 * 60)
      return toast.error("A grade do modelo de 44 horas deve somar exatamente 44 horas por semana");
    try {
      const schedule = await createSchedule.mutateAsync({ name, pattern });
      await schedulesQuery.refetch();
      setScheduleId(String(schedule.id));
      toast.success("Jornada cadastrada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar a jornada");
    }
  };

  const submitAssignment = async (event: FormEvent) => {
    event.preventDefault();
    if (!employeeId || !scheduleId) return toast.error("Selecione o funcionário e a jornada");
    if (!isCivilDate(startDate)) return toast.error("Informe uma data válida para o início da vigência");
    if (assignmentEditId && assignmentEndDate && !isCivilDate(assignmentEndDate)) return toast.error("Informe uma data válida para o fim da vigência");
    if (assignmentEditId && assignmentEndDate && assignmentEndDate < startDate) return toast.error("O fim da vigência não pode anteceder o início");
    if (assignmentReason.trim().length < 5) return toast.error("Informe o motivo com pelo menos 5 caracteres");
    if (selectedSchedule?.pattern.kind === "CYCLE") {
      if (!isCivilDate(cycleAnchorDate)) return toast.error("Informe uma data âncora válida para o ciclo");
      if (cycleAnchorDate > startDate) return toast.error("A data âncora não pode ser posterior ao início da vigência");
    }
    try {
      const editedId = assignmentEditId;
      if (editedId) {
        await editScheduleAssignment.mutateAsync({
          assignmentId: editedId,
          employeeId: Number(employeeId),
          scheduleId: Number(scheduleId),
          startDate,
          endDate: assignmentEndDate || null,
          cycleAnchorDate: selectedSchedule?.pattern.kind === "CYCLE" ? cycleAnchorDate : null,
          reason: assignmentReason.trim(),
        });
        setCalendarEmployeeId(employeeId);
        setAuditAssignmentId(editedId);
        setAssignmentEditId(null);
        setAssignmentEndDate("");
      } else {
        await assignSchedule.mutateAsync({
          employeeId: Number(employeeId),
          scheduleId: Number(scheduleId),
          startDate,
          cycleAnchorDate: selectedSchedule?.pattern.kind === "CYCLE" ? cycleAnchorDate : null,
          reason: assignmentReason.trim(),
        });
      }
      setAssignmentReason("");
      await utils.personnel.employeeScheduleCalendar.invalidate();
      await utils.personnel.workScheduleAssignmentAudit.invalidate();
      toast.success(editedId ? "Vigência corrigida e registrada no histórico de auditoria" : "Nova vigência registrada com motivo");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a vigência");
    }
  };

  const beginAssignmentEdit = (assignment: any) => {
    if (!Number.isInteger(assignment.id)) return toast.error("Este período não tem um identificador válido para edição");
    setAssignmentEditId(assignment.id);
    setEmployeeId(String(calendarEmployeeId));
    setScheduleId(String(assignment.schedule.id));
    setStartDate(assignment.startDate);
    setAssignmentEndDate(assignment.endDate ?? "");
    setCycleAnchorDate(assignment.cycleAnchorDate ?? assignment.startDate);
    setAssignmentReason("");
    setTimeout(() => document.getElementById("schedule-assignment-form")?.scrollIntoView?.({ behavior: "smooth", block: "center" }), 0);
  };

  const cancelAssignmentEdit = () => {
    setAssignmentEditId(null);
    setAssignmentEndDate("");
    setAssignmentReason("");
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Escalas contratuais</p>
        <h3 className="mt-1 text-xl font-black tracking-tight">Jornadas e calendário</h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Cadastre modelos configuráveis e atribua-os por vigência. O calendário mostra os dias civis da pessoa escolhida; “sem jornada” não equivale a folga.</p>
      </header>

      <div className="order-2 grid gap-5 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Plus className="h-5 w-5 text-blue-600" />Cadastrar modelo de jornada</CardTitle>
            <CardDescription>Tipo e horas definem o padrão calculado; o nome serve só para identificação. O RH pode configurar e reutilizar os modelos.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submitSchedule}>
              <div className="space-y-1.5">
                <Label htmlFor="work-schedule-preset">Tipo e padrão da jornada</Label>
                <select id="work-schedule-preset" value={preset} onChange={(event) => choosePreset(event.target.value as Preset)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                  <option value="WEEKLY_44">Semana predefinida · total de 44 h</option>
                  <option value="WEEKLY_CUSTOM">Semana personalizada · 7 dias</option>
                  <option value="CYCLE_12X36">Ciclo 12x36 · 12 h / 36 h de descanso</option>
                  <option value="CYCLE_CUSTOM">Ciclo repetitivo personalizado</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="work-schedule-name">Nome para identificação</Label>
                <Input id="work-schedule-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required placeholder="Ex.: Equipe A · turno diurno" />
                <p className="text-xs text-slate-500">O nome não altera o tipo, os dias nem as horas do padrão.</p>
              </div>
              <div className={`rounded-xl border p-3 text-sm ${nameSuggests12x36 && !patternIs12x36 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-100 bg-blue-50 text-blue-950"}`}>
                <strong>Padrão selecionado:</strong> {preset === "WEEKLY_44" ? `grade semanal de 7 dias · ${minutesToHours(weeklyTotalMinutes)} h/semana` : preset === "WEEKLY_CUSTOM" ? `grade semanal de 7 dias · ${minutesToHours(weeklyTotalMinutes)} h/semana` : patternIs12x36 ? "ciclo 12x36 · 12 h em um dia e folga no seguinte" : `ciclo personalizado · ${cycleHours.length} dias`}
                {nameSuggests12x36 && !patternIs12x36 && <p className="mt-1 text-xs leading-5">O nome contém “12x36”, mas o padrão escolhido não é o ciclo 12x36. O nome não transforma uma semana em ciclo; confira o tipo antes de salvar.</p>}
              </div>

              {preset.startsWith("WEEKLY") ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">Horas por dia (segunda a domingo)</p><p className={`text-sm font-bold ${preset === "WEEKLY_44" && weeklyTotalMinutes !== 2640 ? "text-amber-700" : "text-slate-600"}`}>{(weeklyTotalMinutes / 60).toFixed(2).replace(".", ",")} h/semana</p></div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {WEEKDAY_LABELS.map((label, index) => <div key={label} className="space-y-1"><Label htmlFor={`weekly-hours-${index}`} className="text-xs">{label}</Label><Input id={`weekly-hours-${index}`} type="number" min="0" max="24" step="0.25" value={weeklyHours[index]} onChange={(event) => setWeeklyHours((values) => values.map((value, i) => i === index ? event.target.value : value))} /></div>)}
                  </div>
                  {preset === "WEEKLY_44" && <p className="text-xs text-slate-500">Distribua as 44 horas entre os dias; não há uma distribuição diária predefinida.</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">Dias do ciclo (o primeiro item é a âncora)</p><p className="text-sm font-bold text-slate-600">{cycleWeeklyHours.toFixed(2).replace(".", ",")} h/semana (média)</p></div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {cycleHours.map((hours, index) => <div key={index} className="space-y-1"><Label htmlFor={`cycle-hours-${index}`} className="text-xs">Dia {index + 1}</Label><Input id={`cycle-hours-${index}`} type="number" min="0" max="24" step="0.25" value={hours} onChange={(event) => setCycleHours((values) => values.map((value, i) => i === index ? event.target.value : value))} /></div>)}
                  </div>
                  <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={cycleHours.length >= 42} onClick={() => setCycleHours((values) => [...values, "0"])}>Adicionar dia ao ciclo</Button><Button type="button" size="sm" variant="outline" disabled={cycleHours.length <= 2} onClick={() => setCycleHours((values) => values.slice(0, -1))}>Remover último dia</Button></div>
                  <p className="text-xs text-slate-500">Informe 0 para folga. No 12x36, o padrão é 12, 0. A média semanal é calculada pelo ciclo.</p>
                </div>
              )}
              <Button type="submit" disabled={createSchedule.isPending || name.trim().length < 2} className="bg-[#0d1b2a] hover:bg-slate-800">{createSchedule.isPending ? "Salvando…" : "Salvar modelo"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg"><UsersRound className="h-5 w-5 text-blue-600" />{assignmentEditId ? "Corrigir vigência salva" : "Atribuir ou trocar jornada"}</CardTitle>
              {assignmentEditId && <Button type="button" variant="outline" size="sm" onClick={cancelAssignmentEdit}>Cancelar correção</Button>}
            </div>
            <CardDescription>Para uma troca planejada, registre uma nova vigência. Para corrigir um período já salvo, use “Editar período” no histórico; informe o motivo e a aplicação guarda versões anterior e nova com ator e horário.</CardDescription>
          </CardHeader>
          <CardContent>
            <form id="schedule-assignment-form" className="space-y-4" onSubmit={submitAssignment}>
              <div className={`rounded-xl border p-3 text-sm ${assignmentEditId ? "border-amber-200 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-slate-700"}`} role="status">
                {assignmentEditId ? <>Correção do período #{assignmentEditId}. Ao salvar, o registro atual será atualizado junto com um snapshot append-only anterior/novo, seu ator, horário e motivo.</> : <>Nova atribuição: a jornada anterior, quando aplicável, termina na véspera do início; ambos os eventos ficam auditados.</>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="schedule-employee-search">Buscar funcionário para atribuição</Label>
                <Input id="schedule-employee-search" type="search" autoComplete="off" value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Nome ou cargo" />
                <Label htmlFor="schedule-employee" className="sr-only">Funcionário para atribuir</Label>
                <select id="schedule-employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" required>
                  <option value="">Selecione o funcionário</option>
                  {assignmentEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.position ? ` · ${employee.position}` : ""}</option>)}
                </select>
                {employees.length === 0 ? <p className="text-xs text-amber-700">Cadastre um funcionário antes de atribuir uma jornada.</p> : assignmentEmployees.length === 0 ? <p className="text-xs text-slate-500">Nenhum funcionário corresponde à busca.</p> : assignmentEmployee && <p className="text-xs text-slate-600">Selecionado: <strong>{assignmentEmployee.name}</strong>{assignmentEmployee.position ? ` · ${assignmentEmployee.position}` : ""}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="schedule-model">Modelo de jornada</Label>
                <select id="schedule-model" value={scheduleId} onChange={(event) => { setScheduleId(event.target.value); setCycleAnchorDate(startDate); }} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" required>
                  <option value="">Selecione o modelo</option>
                  {schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name} · {Number(schedule.weeklyHours).toLocaleString("pt-BR")} h/semana</option>)}
                </select>
                {!schedules.length && <p className="text-xs text-amber-700">Cadastre um modelo de jornada antes de atribuir.</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="schedule-start-date">Início da vigência</Label>
                  <Input id="schedule-start-date" type="date" lang="pt-BR" value={startDate} onChange={(event) => { setStartDate(event.target.value); if (!assignmentEditId) setCycleAnchorDate(event.target.value); }} required />
                  <p className="text-xs text-slate-600">Data selecionada: <strong>{formatCivilDate(startDate)}</strong></p>
                </div>
                {assignmentEditId && <div className="space-y-1.5">
                  <Label htmlFor="schedule-end-date">Fim da vigência (vazio = em aberto)</Label>
                  <Input id="schedule-end-date" type="date" lang="pt-BR" min={startDate} value={assignmentEndDate} onChange={(event) => setAssignmentEndDate(event.target.value)} />
                  <p className="text-xs text-slate-600">Data selecionada: <strong>{assignmentEndDate ? formatCivilDate(assignmentEndDate) : "em aberto"}</strong></p>
                </div>}
                {selectedSchedule?.pattern.kind === "CYCLE" && <div className="space-y-1.5">
                  <Label htmlFor="schedule-anchor-date">Data âncora do ciclo</Label>
                  <Input id="schedule-anchor-date" type="date" lang="pt-BR" value={cycleAnchorDate} onChange={(event) => setCycleAnchorDate(event.target.value)} max={startDate} required />
                  <p className="text-xs text-slate-600">Data selecionada: <strong>{formatCivilDate(cycleAnchorDate)}</strong>. O primeiro item do ciclo vale nessa data; a âncora pode ser anterior à vigência.</p>
                </div>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="schedule-assignment-reason">Motivo obrigatório</Label>
                <Textarea id="schedule-assignment-reason" value={assignmentReason} onChange={(event) => setAssignmentReason(event.target.value)} minLength={5} maxLength={2_000} required placeholder="Explique a troca ou a correção e sua referência interna" />
                <p className="text-xs text-slate-500">O motivo, seu usuário, o horário e os snapshots anterior/novo ficam na trilha de auditoria.</p>
              </div>
              <Button type="submit" disabled={assignSchedule.isPending || editScheduleAssignment.isPending || !employeeId || !scheduleId || !startDate || assignmentReason.trim().length < 5 || employees.length === 0} className="bg-[#0d1b2a] hover:bg-slate-800">{assignSchedule.isPending || editScheduleAssignment.isPending ? "Salvando…" : assignmentEditId ? "Salvar correção auditada" : "Registrar nova vigência"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="order-1 border-slate-200 shadow-sm">
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5 text-blue-600" />Calendário de trabalho e folgas</CardTitle>
            <CardDescription className="mt-1">Consulte os dias previstos segundo as jornadas vigentes. Trabalho, folga e ausência de atribuição têm estados distintos.</CardDescription>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="schedule-calendar-employee-search">Buscar funcionário do calendário</Label>
              <Input id="schedule-calendar-employee-search" type="search" autoComplete="off" value={calendarEmployeeSearch} onChange={(event) => setCalendarEmployeeSearch(event.target.value)} placeholder="Nome ou cargo" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schedule-calendar-employee">Funcionário visualizado</Label>
              <select id="schedule-calendar-employee" value={calendarEmployeeId} onChange={(event) => setCalendarEmployeeId(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                <option value="">Selecione um funcionário</option>
                {calendarEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.position ? ` · ${employee.position}` : ""}</option>)}
              </select>
            </div>
          </div>
          {calendarEmployee && <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-sm text-blue-950"><strong>Visualizando:</strong> {calendarEmployee.name}{calendarEmployee.position ? ` · ${calendarEmployee.position}` : ""}. {calendarAssignmentsForMonth.length ? <><span className="font-semibold"> Jornada(s) no mês:</span> <span className="inline-flex flex-wrap gap-x-2">{calendarAssignmentsForMonth.map((assignment: any, index: number) => <span key={assignment.id ?? index}><strong>{assignment.schedule.name}</strong> · {formatCivilDate(assignment.startDate)} a {assignment.endDate ? formatCivilDate(assignment.endDate) : "em aberto"}{index < calendarAssignmentsForMonth.length - 1 ? ";" : "."}</span>)}</span></> : <>Sem atribuição de jornada neste mês; isso não significa folga.</>}</div>}
        </CardHeader>
        <CardContent className="space-y-5">
          {calendarQuery.isLoading ? <p className="text-sm text-slate-500" role="status">Carregando calendário…</p> : !calendarEmployeeId ? <p className="text-sm text-slate-500">Selecione um funcionário para consultar o calendário.</p> : calendarQuery.error ? <p className="text-sm text-rose-700" role="alert">{calendarQuery.error.message}</p> : (
            <>
              <PersonnelScheduleCalendar month={month} days={calendarDays} onMonthChange={setMonth} />
              {calendarAssignments.length > 0 && <section aria-labelledby="schedule-assignment-history" className="border-t border-slate-100 pt-4">
                <h4 id="schedule-assignment-history" className="mb-3 flex items-center gap-2 text-sm font-bold"><Clock3 className="h-4 w-4" />Histórico de vigências do funcionário visualizado</h4>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {calendarAssignments.map((assignment: any, index: number) => <li key={`${assignment.startDate}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-semibold text-slate-950">{assignment.schedule.name}</p><Button type="button" size="sm" variant="outline" onClick={() => beginAssignmentEdit(assignment)} disabled={!assignment.id}>Editar período</Button></div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">Vigência: {formatCivilDate(assignment.startDate)} a {assignment.endDate ? formatCivilDate(assignment.endDate) : "em aberto"}</p>
                    {assignment.cycleAnchorDate && <p className="text-xs text-slate-600">Âncora do ciclo: {formatCivilDate(assignment.cycleAnchorDate)}</p>}
                    <p className="text-xs text-slate-600">{Number(assignment.schedule.weeklyHours).toLocaleString("pt-BR")} h/semana</p>
                    {Number.isInteger(assignment.id) && <Button type="button" size="sm" variant="ghost" className="mt-1 h-auto px-0 py-1 text-xs" aria-expanded={auditAssignmentId === assignment.id} onClick={() => setAuditAssignmentId(auditAssignmentId === assignment.id ? null : assignment.id)}>{auditAssignmentId === assignment.id ? "Ocultar auditoria" : "Ver auditoria"}</Button>}
                  </li>)}
                </ul>
              </section>}
              {auditAssignmentId && <section aria-label="Trilha de auditoria da vigência" className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
                <h4 className="font-bold text-violet-950">Trilha de auditoria · período #{auditAssignmentId}</h4>
                {assignmentAuditQuery.isLoading ? <p className="mt-2 text-sm text-slate-600" role="status">Carregando histórico…</p> : assignmentAuditQuery.error ? <p className="mt-2 text-sm text-rose-700" role="alert">{assignmentAuditQuery.error.message}</p> : assignmentAuditQuery.data?.length ? <ol className="mt-3 space-y-3">
                  {assignmentAuditQuery.data.map((entry: any) => <li key={entry.id} className="rounded-lg border border-violet-100 bg-white p-3 text-sm">
                    <p className="font-semibold text-slate-950">{auditActionLabel(entry.action)} · {entry.actorNameSnapshot}{entry.actorUsernameSnapshot ? ` (@${entry.actorUsernameSnapshot})` : ` · usuário #${entry.actorId}`}</p>
                    <p className="text-xs text-slate-500">{new Date(entry.changedAt).toLocaleString("pt-BR")}</p>
                    <p className="mt-2"><strong>Motivo:</strong> {entry.reason}</p>
                    <p className="mt-2 text-xs"><strong>Antes:</strong> {snapshotSummary(entry.previousSnapshot)}</p>
                    <p className="text-xs"><strong>Depois:</strong> {snapshotSummary(entry.newSnapshot)}</p>
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer font-semibold text-blue-800">Ver snapshots completos</summary>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2"><pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2">{JSON.stringify(entry.previousSnapshot, null, 2) ?? "null"}</pre><pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2">{JSON.stringify(entry.newSnapshot, null, 2)}</pre></div>
                    </details>
                  </li>)}
                </ol> : <p className="mt-2 text-sm text-slate-600">Nenhuma alteração auditada posterior foi registrada para esta vigência.</p>}
              </section>}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
