import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CalendarDays, Clock3, Plus, RefreshCw, UsersRound } from "lucide-react";
import { WEEKDAY_LABELS, validateWorkSchedulePattern, type WorkSchedulePattern } from "@shared/personnel-schedules";

type EmployeeOption = { id: number; name: string; position?: string | null };
type Preset = "WEEKLY_44" | "WEEKLY_CUSTOM" | "CYCLE_12X36" | "CYCLE_CUSTOM";

function localCivilToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function hoursToMinutes(value: string) {
  const hours = Number(value || 0);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) return Number.NaN;
  return Math.round(hours * 60);
}

function minutesToHours(minutes: number) {
  return Number((minutes / 60).toFixed(2)).toString();
}

function mondayFirstIndex(civilDate: string) {
  const [year, month, day] = civilDate.split("-").map(Number);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

function currentMonth() {
  return localCivilToday().slice(0, 7);
}

export function PersonnelWorkSchedules({ employees }: { employees: EmployeeOption[] }) {
  const firstEmployeeId = employees[0]?.id;
  const [employeeId, setEmployeeId] = useState(firstEmployeeId ? String(firstEmployeeId) : "");
  const [month, setMonth] = useState(currentMonth);
  const [scheduleId, setScheduleId] = useState("");
  const [startDate, setStartDate] = useState(localCivilToday);
  const [cycleAnchorDate, setCycleAnchorDate] = useState(localCivilToday);
  const [preset, setPreset] = useState<Preset>("WEEKLY_CUSTOM");
  const [name, setName] = useState("");
  const [weeklyHours, setWeeklyHours] = useState<string[]>(Array(7).fill("0"));
  const [cycleHours, setCycleHours] = useState<string[]>(["8", "0"]);

  const schedulesQuery = trpc.personnel.workSchedules.useQuery();
  const calendarQuery = trpc.personnel.employeeScheduleCalendar.useQuery(
    { employeeId: Number(employeeId) || 0, month },
    { enabled: Boolean(employeeId) && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) },
  );
  const utils = trpc.useUtils();
  const createSchedule = trpc.personnel.createWorkSchedule.useMutation();
  const assignSchedule = trpc.personnel.assignWorkSchedule.useMutation();
  const schedules = schedulesQuery.data ?? [];
  const selectedSchedule = schedules.find((schedule) => String(schedule.id) === scheduleId);
  const calendarDays = calendarQuery.data?.days ?? [];
  const calendarAssignments = calendarQuery.data?.assignments ?? [];
  const weeklyTotalMinutes = weeklyHours.reduce((sum, value) => sum + (Number.isFinite(hoursToMinutes(value)) ? hoursToMinutes(value) : 0), 0);
  const cycleWeeklyHours = cycleHours.reduce((sum, value) => sum + (Number.isFinite(hoursToMinutes(value)) ? hoursToMinutes(value) : 0), 0) * 7 / Math.max(cycleHours.length, 1) / 60;
  const calendarCells = useMemo(() => {
    if (!calendarDays.length) return [];
    const prefix = Array(mondayFirstIndex(calendarDays[0].date)).fill(null);
    return [...prefix, ...calendarDays];
  }, [calendarDays]);

  useEffect(() => {
    if (firstEmployeeId && !employees.some((employee) => String(employee.id) === employeeId)) setEmployeeId(String(firstEmployeeId));
    if (!firstEmployeeId) setEmployeeId("");
  }, [firstEmployeeId, employees, employeeId]);

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
    try {
      await assignSchedule.mutateAsync({
        employeeId: Number(employeeId),
        scheduleId: Number(scheduleId),
        startDate,
        cycleAnchorDate: selectedSchedule?.pattern.kind === "CYCLE" ? cycleAnchorDate : null,
      });
      await calendarQuery.refetch();
      toast.success("Jornada atribuída; a vigência anterior foi preservada no histórico");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atribuir a jornada");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Escalas contratuais</p>
        <h3 className="mt-1 text-xl font-black tracking-tight">Jornadas e calendário</h3>
        <p className="mt-1 text-sm text-slate-500">Modelos reutilizáveis e atribuições por data de vigência. Esta configuração é separada da escala operacional dos supervisores.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Plus className="h-5 w-5 text-blue-600" />Cadastrar modelo de jornada</CardTitle>
            <CardDescription>Use uma grade semanal ou um ciclo repetitivo. As regras são salvas como modelos reutilizáveis, sem lista fechada de nomes.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submitSchedule}>
              <div className="space-y-1.5">
                <Label htmlFor="work-schedule-preset">Modelo de partida</Label>
                <select id="work-schedule-preset" value={preset} onChange={(event) => choosePreset(event.target.value as Preset)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="WEEKLY_44">44 horas semanais</option>
                  <option value="WEEKLY_CUSTOM">Grade semanal personalizada</option>
                  <option value="CYCLE_12X36">12x36 (1 dia de 12h / 1 folga)</option>
                  <option value="CYCLE_CUSTOM">Ciclo repetitivo personalizado</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="work-schedule-name">Nome do modelo</Label>
                <Input id="work-schedule-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required placeholder="Ex.: 44 horas semanais — equipe A" />
              </div>

              {preset.startsWith("WEEKLY") ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Horas por dia (semana)</p>
                    <p className={`text-sm font-bold ${preset === "WEEKLY_44" && weeklyTotalMinutes !== 2640 ? "text-amber-700" : "text-slate-600"}`}>{(weeklyTotalMinutes / 60).toFixed(2).replace(".", ",")} h/semana</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {WEEKDAY_LABELS.map((label, index) => (
                      <div key={label} className="space-y-1">
                        <Label htmlFor={`weekly-hours-${index}`} className="text-xs">{label}</Label>
                        <Input id={`weekly-hours-${index}`} type="number" min="0" max="24" step="0.25" value={weeklyHours[index]} onChange={(event) => setWeeklyHours((values) => values.map((value, i) => i === index ? event.target.value : value))} />
                      </div>
                    ))}
                  </div>
                  {preset === "WEEKLY_44" && <p className="text-xs text-slate-500">Distribua as 44 horas entre os dias; não há uma distribuição diária predefinida.</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Dias do ciclo (o primeiro item é a âncora)</p>
                    <p className="text-sm font-bold text-slate-600">{cycleWeeklyHours.toFixed(2).replace(".", ",")} h/semana (média)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {cycleHours.map((hours, index) => (
                      <div key={index} className="space-y-1">
                        <Label htmlFor={`cycle-hours-${index}`} className="text-xs">Dia {index + 1}</Label>
                        <Input id={`cycle-hours-${index}`} type="number" min="0" max="24" step="0.25" value={hours} onChange={(event) => setCycleHours((values) => values.map((value, i) => i === index ? event.target.value : value))} />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={cycleHours.length >= 42} onClick={() => setCycleHours((values) => [...values, "0"])}>Adicionar dia ao ciclo</Button>
                    <Button type="button" size="sm" variant="outline" disabled={cycleHours.length <= 2} onClick={() => setCycleHours((values) => values.slice(0, -1))}>Remover último dia</Button>
                  </div>
                  <p className="text-xs text-slate-500">Informe 0 para folga. No 12x36, o padrão é 12, 0. A média semanal é calculada pelo ciclo.</p>
                </div>
              )}
              <Button type="submit" disabled={createSchedule.isPending || name.trim().length < 2} className="bg-[#0d1b2a] hover:bg-slate-800">{createSchedule.isPending ? "Salvando…" : "Salvar modelo"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><UsersRound className="h-5 w-5 text-blue-600" />Atribuir jornada</CardTitle>
            <CardDescription>Uma nova atribuição fecha a anterior no dia anterior e mantém o histórico. Para preservar regras antigas, modelos cadastrados não são alterados.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submitAssignment}>
              <div className="space-y-1.5">
                <Label htmlFor="schedule-employee">Funcionário</Label>
                <select id="schedule-employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" required>
                  <option value="">Selecione</option>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.position ? ` · ${employee.position}` : ""}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="schedule-model">Modelo</Label>
                <select id="schedule-model" value={scheduleId} onChange={(event) => { setScheduleId(event.target.value); setCycleAnchorDate(startDate); }} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" required>
                  <option value="">Selecione</option>
                  {schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name} · {Number(schedule.weeklyHours).toLocaleString("pt-BR")} h/semana</option>)}
                </select>
                {!schedules.length && <p className="text-xs text-amber-700">Cadastre um modelo de jornada antes de atribuir.</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="schedule-start-date">Início da vigência</Label>
                  <Input id="schedule-start-date" type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setCycleAnchorDate(event.target.value); }} required />
                </div>
                {selectedSchedule?.pattern.kind === "CYCLE" && <div className="space-y-1.5">
                  <Label htmlFor="schedule-anchor-date">Data âncora do ciclo</Label>
                  <Input id="schedule-anchor-date" type="date" value={cycleAnchorDate} onChange={(event) => setCycleAnchorDate(event.target.value)} max={startDate} required />
                  <p className="text-xs text-slate-500">O dia âncora corresponde ao primeiro item do padrão; pode ser anterior ao início da vigência.</p>
                </div>}
              </div>
              <Button type="submit" disabled={assignSchedule.isPending || !employeeId || !scheduleId || !startDate} className="bg-[#0d1b2a] hover:bg-slate-800">{assignSchedule.isPending ? "Atribuindo…" : "Atribuir jornada"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5 text-blue-600" />Calendário de trabalho e folgas</CardTitle>
              <CardDescription>Dias úteis segundo a jornada vigente; usado também para validar novas FTs.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="schedule-calendar-month" className="sr-only">Mês do calendário</Label>
              <Input id="schedule-calendar-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="w-44" />
              <Button type="button" size="sm" variant="outline" onClick={() => void calendarQuery.refetch()} disabled={!employeeId}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {calendarQuery.isLoading ? <p className="text-sm text-slate-500">Carregando calendário…</p> : !employeeId ? <p className="text-sm text-slate-500">Cadastre um funcionário para iniciar.</p> : calendarQuery.error ? <p className="text-sm text-rose-700">{calendarQuery.error.message}</p> : (
            <>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_LABELS.map((label) => <div key={label} className="py-1 text-center text-xs font-bold text-slate-500">{label}</div>)}
                {calendarCells.map((day: any, index: number) => day ? <div key={day.date} className={`min-h-20 rounded-lg border p-2 ${day.status === "WORKDAY" ? "border-blue-200 bg-blue-50" : day.status === "OFF_DAY" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                  <div className="text-xs font-bold text-slate-800">{Number(day.date.slice(-2))}</div>
                  <div className={`mt-2 text-[11px] font-semibold ${day.status === "WORKDAY" ? "text-blue-800" : day.status === "OFF_DAY" ? "text-emerald-800" : "text-slate-500"}`}>
                    {day.status === "WORKDAY" ? `Trabalho · ${(day.minutes / 60).toLocaleString("pt-BR")} h` : day.status === "OFF_DAY" ? "Folga" : "Sem jornada"}
                  </div>
                </div> : <div key={`blank-${index}`} className="min-h-20" />)}
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-blue-200" />Trabalho programado</span>
                <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-emerald-200" />Folga programada</span>
                <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-slate-200" />Sem atribuição</span>
              </div>
              {calendarAssignments.length > 0 && <div>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-bold"><Clock3 className="h-4 w-4" />Histórico de vigências</h4>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-2">Jornada</th><th className="px-3 py-2">Início</th><th className="px-3 py-2">Fim</th><th className="px-3 py-2">Âncora</th><th className="px-3 py-2">Horas semanais</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{calendarAssignments.map((assignment: any, index: number) => <tr key={`${assignment.startDate}-${index}`}><td className="px-3 py-2 font-semibold">{assignment.schedule.name}</td><td className="px-3 py-2">{assignment.startDate}</td><td className="px-3 py-2">{assignment.endDate ?? "Em aberto"}</td><td className="px-3 py-2">{assignment.cycleAnchorDate ?? "—"}</td><td className="px-3 py-2">{Number(assignment.schedule.weeklyHours).toLocaleString("pt-BR")}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
