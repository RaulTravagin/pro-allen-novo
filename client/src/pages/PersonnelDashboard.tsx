import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  BadgeDollarSign,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  ClipboardCheck,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  HeartPulse,
  Loader2,
  LogOut,
  Plus,
  ShieldCheck,
  UserCog,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type EntryType =
  | "FT"
  | "FALTA_JUSTIFICADA"
  | "FALTA_INJUSTIFICADA"
  | "ATESTADO"
  | "EXTRA";
type PersonnelRole = "SUPERVISOR" | "RH" | "FINANCEIRO" | "ADM";

type FilePayload = { name: string; mimeType: string; base64: string };

const entryOptions: Array<{
  id: EntryType;
  label: string;
  helper: string;
  icon: typeof Clock3;
}> = [
  {
    id: "FT",
    label: "Folga trabalhada",
    helper: "Valor a pagar",
    icon: Clock3,
  },
  {
    id: "FALTA_JUSTIFICADA",
    label: "Falta justificada",
    helper: "Ocorrência",
    icon: FileCheck2,
  },
  {
    id: "FALTA_INJUSTIFICADA",
    label: "Falta injustificada",
    helper: "Ocorrência",
    icon: FileText,
  },
  {
    id: "ATESTADO",
    label: "Atestado médico",
    helper: "Anexe o documento",
    icon: HeartPulse,
  },
  {
    id: "EXTRA",
    label: "Serviço extra",
    helper: "Horas ou diária",
    icon: BriefcaseBusiness,
  },
];

function todayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatCurrency(value: unknown) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: unknown) {
  if (!value) return "—";
  return new Date(value as string).toLocaleDateString("pt-BR");
}

function roleLabel(role: PersonnelRole) {
  return {
    SUPERVISOR: "Supervisor",
    RH: "Recursos Humanos",
    FINANCEIRO: "Financeiro",
    ADM: "Administrador",
  }[role];
}

function statusLabel(status: string) {
  return (
    {
      PENDING: "Pendente",
      APPROVED: "Aprovado",
      PAID: "Quitado",
      REJECTED: "Rejeitado",
    }[status] ?? status
  );
}

function statusClass(status: string) {
  return (
    {
      PENDING: "border-amber-200 bg-amber-50 text-amber-800",
      APPROVED: "border-blue-200 bg-blue-50 text-blue-800",
      PAID: "border-emerald-200 bg-emerald-50 text-emerald-800",
      REJECTED: "border-rose-200 bg-rose-50 text-rose-800",
    }[status] ?? "border-slate-200 bg-slate-50 text-slate-700"
  );
}

async function fileToPayload(file: File): Promise<FilePayload> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo"));
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? value.split(",")[1] : value);
    };
    reader.readAsDataURL(file);
  });
  return { name: file.name, mimeType: file.type, base64 };
}

type PersonnelSection = "workspace" | "employees" | "users" | "finance";

export default function PersonnelDashboard({
  initialSection = "workspace",
  requiredRole,
}: {
  initialSection?: PersonnelSection;
  requiredRole?: PersonnelRole[];
}) {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const dashboardQuery = trpc.personnel.dashboard.useQuery(undefined, {
    retry: false,
  });
  const [entryType, setEntryType] = useState<EntryType>("FT");
  const [activeSection, setActiveSection] = useState<PersonnelSection>(initialSection);
  const role = (dashboardQuery.data?.role ??
    (user?.role === "admin" ? "ADM" : "SUPERVISOR")) as PersonnelRole;
  const isSupervisor = role === "SUPERVISOR";
  const isReviewer = role === "RH" || role === "ADM";
  const isFinance = role === "FINANCEIRO" || role === "ADM";
  const isAdmin = role === "ADM";

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const invalidateDashboard = async () => {
    await utils.personnel.dashboard.invalidate();
  };

  if (dashboardQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] text-slate-600">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando módulo de pessoal...
      </div>
    );
  }

  if (dashboardQuery.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-5">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Área indisponível</CardTitle>
            <CardDescription>
              {dashboardQuery.error.message ||
                "Não foi possível carregar os dados."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void dashboardQuery.refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (requiredRole && !requiredRole.includes(role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-5">
        <Card className="max-w-md border-rose-200">
          <CardHeader>
            <CardTitle>Acesso não autorizado</CardTitle>
            <CardDescription>
              Esta área é restrita aos perfis {requiredRole.map(roleLabel).join(" e ")}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(user?.role === "admin" ? "/admin" : "/supervisor")}>
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = dashboardQuery.data;
  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="border-b border-slate-200 bg-[#0d1b2a] text-white">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f6c915] text-[#0d1b2a] shadow-lg shadow-yellow-500/20">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#f6c915]">
                Pro Allen · Pessoas
              </p>
              <h1 className="text-xl font-black tracking-tight sm:text-2xl">
                Gestão operacional e financeira
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-slate-200 sm:inline-flex">
              {roleLabel(role)}
            </span>
            <Button
              variant="outline"
              onClick={() =>
                navigate(user?.role === "admin" ? "/admin" : "/supervisor")
              }
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              Voltar
            </Button>
            <Button
              variant="outline"
              onClick={() => logout()}
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Módulo
          </p>
          <nav
            className="space-y-1"
            aria-label="Navegação da gestão de pessoal"
          >
            <NavButton
              active={activeSection === "workspace"}
              icon={ClipboardCheck}
              label="Central de lançamentos"
              onClick={() => setActiveSection("workspace")}
            />
            <NavButton
              active={activeSection === "employees"}
              icon={UsersRound}
              label="Funcionários"
              onClick={() => setActiveSection("employees")}
            />
            {isAdmin && (
              <NavButton
                active={activeSection === "users"}
                icon={UserCog}
                label="Perfis de acesso"
                onClick={() => setActiveSection("users")}
              />
            )}
            {isFinance && (
              <NavButton
                active={activeSection === "finance"}
                icon={BadgeDollarSign}
                label="Aprovados para pagar"
                onClick={() => setActiveSection("finance")}
              />
            )}
          </nav>
          <div className="mt-5 rounded-xl bg-[#0d1b2a] p-3 text-white">
            <p className="text-xs font-semibold text-[#f6c915]">
              Fluxo de governança
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              Supervisor lança → RH audita → Financeiro quita.
            </p>
          </div>
        </aside>

        <main className="min-w-0 space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Pendências na fila"
              value={data?.summary.pendingCount ?? 0}
              helper="Aguardando análise"
              icon={Clock3}
              tone="amber"
            />
            <MetricCard
              label="Aprovados para pagar"
              value={formatCurrency(data?.summary.approvedAmount)}
              helper={`${data?.summary.pendingFinancialCount ?? 0} lançamentos`}
              icon={BadgeDollarSign}
              tone="blue"
            />
            <MetricCard
              label="Total já quitado"
              value={formatCurrency(data?.summary.paidAmount)}
              helper="FTs e extras pagos"
              icon={BadgeCheck}
              tone="emerald"
            />
            <MetricCard
              label="Base ativa"
              value={data?.summary.employeesCount ?? 0}
              helper="Funcionários cadastrados"
              icon={UsersRound}
              tone="slate"
            />
          </section>

          {activeSection === "workspace" && (
            <Workspace
              data={data}
              role={role}
              entryType={entryType}
              setEntryType={setEntryType}
              onRefresh={invalidateDashboard}
              isSupervisor={isSupervisor}
              isReviewer={isReviewer}
              isFinance={isFinance}
            />
          )}
          {activeSection === "employees" && (
            <EmployeesSection
              data={data}
              role={role}
              onRefresh={invalidateDashboard}
            />
          )}
          {activeSection === "users" && isAdmin && (
            <UsersSection onRefresh={invalidateDashboard} />
          )}
          {activeSection === "finance" && isFinance && (
            <FinanceQueue data={data} onRefresh={invalidateDashboard} />
          )}
        </main>
      </div>
    </div>
  );
}

function NavButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof ClipboardCheck;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${active ? "bg-[#0d1b2a] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
    >
      <Icon
        className={`h-4 w-4 ${active ? "text-[#f6c915]" : "text-slate-400"}`}
      />
      {label}
    </button>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: typeof Clock3;
  tone: "amber" | "blue" | "emerald" | "slate";
}) {
  const colors = {
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${colors[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function Workspace({
  data,
  role,
  entryType,
  setEntryType,
  onRefresh,
  isSupervisor,
  isReviewer,
  isFinance,
}: {
  data: any;
  role: PersonnelRole;
  entryType: EntryType;
  setEntryType: (value: EntryType) => void;
  onRefresh: () => Promise<void>;
  isSupervisor: boolean;
  isReviewer: boolean;
  isFinance: boolean;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      {(isSupervisor || role === "ADM") && (
        <EntryForm
          employees={(data?.employees ?? []).filter((employee: any) => employee.isActive)}
          entryType={entryType}
          setEntryType={setEntryType}
          onRefresh={onRefresh}
        />
      )}
      {isReviewer && <ReviewQueue data={data} onRefresh={onRefresh} />}
      {isFinance && <FinanceQueue data={data} onRefresh={onRefresh} />}
      {isSupervisor && <RecentEntries data={data} />}
    </div>
  );
}

function EntryForm({
  employees,
  entryType,
  setEntryType,
  onRefresh,
}: {
  employees: any[];
  entryType: EntryType;
  setEntryType: (value: EntryType) => void;
  onRefresh: () => Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [legacyEmployeeName, setLegacyEmployeeName] = useState("");
  const [date, setDate] = useState(todayInputValue);
  const [amount, setAmount] = useState("");
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<FilePayload | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const createFt = trpc.personnel.createFt.useMutation();
  const createOccurrence = trpc.personnel.createOccurrence.useMutation();
  const createExtra = trpc.personnel.createExtra.useMutation();
  const ensureLegacyEmployee = trpc.personnel.ensureLegacyEmployee.useMutation();
  const isOccurrence =
    entryType === "FALTA_JUSTIFICADA" ||
    entryType === "FALTA_INJUSTIFICADA" ||
    entryType === "ATESTADO";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!employeeId && employees.length > 0) return toast.error("Selecione um funcionário");
    if (!employeeId && employees.length === 0 && !legacyEmployeeName.trim()) {
      return toast.error("Informe o nome do colaborador para o cadastro temporário");
    }
    if (!date) return toast.error("Informe a data da ocorrência");
    if (entryType === "ATESTADO" && !file)
      return toast.error("Anexe o atestado médico");
    if (entryType === "FT" && (!amount || Number(amount) <= 0))
      return toast.error("Informe um valor válido");
    if (
      entryType === "EXTRA" &&
      (!amount || Number(amount) <= 0 || !hours || Number(hours) <= 0)
    )
      return toast.error("Informe horas/diária e valor");
    if (isOccurrence && !reason.trim())
      return toast.error("Informe uma observação para a ocorrência");
    setSubmitting(true);
    try {
      let selectedEmployeeId = employeeId;
      if (!selectedEmployeeId) {
        const legacyEmployee = await ensureLegacyEmployee.mutateAsync({ name: legacyEmployeeName.trim() });
        if (!legacyEmployee?.id) throw new Error("Não foi possível criar o cadastro temporário");
        selectedEmployeeId = String(legacyEmployee.id);
      }
      const base = {
        employeeId: Number(selectedEmployeeId),
        date: new Date(`${date}T12:00:00`),
      };
      if (entryType === "FT")
        await createFt.mutateAsync({
          ...base,
          amount: Number(amount),
          reason:
            reason.trim() || "Folga trabalhada registrada pelo supervisor",
        });
      else if (entryType === "EXTRA")
        await createExtra.mutateAsync({
          ...base,
          hoursOrDaily: Number(hours),
          amount: Number(amount),
          description: reason.trim(),
        });
      else
        await createOccurrence.mutateAsync({
          ...base,
          type: entryType,
          observation: reason.trim(),
          document: file,
        });
      toast.success("Lançamento enviado para a fila de auditoria");
      setAmount("");
      setHours("");
      setReason("");
      setLegacyEmployeeName("");
      setFile(null);
      await onRefresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o lançamento"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-blue-600" />
              Novo lançamento
            </CardTitle>
            <CardDescription className="mt-1">
              Registre uma atividade e encaminhe para validação.
            </CardDescription>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
            Supervisor
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {entryOptions.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setEntryType(item.id)}
                className={`rounded-xl border p-3 text-left transition ${entryType === item.id ? "border-[#0d1b2a] bg-[#0d1b2a] text-white shadow-md" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/50"}`}
              >
                <Icon
                  className={`mb-2 h-4 w-4 ${entryType === item.id ? "text-[#f6c915]" : "text-slate-400"}`}
                />
                <span className="block text-xs font-bold leading-4">
                  {item.label}
                </span>
                <span
                  className={`mt-1 block text-[10px] ${entryType === item.id ? "text-slate-300" : "text-slate-400"}`}
                >
                  {item.helper}
                </span>
              </button>
            );
          })}
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="personnel-employee">Funcionário</Label>
              {employees.length > 0 ? (
                <select
                  id="personnel-employee"
                  value={employeeId}
                  onChange={event => setEmployeeId(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Selecione o colaborador</option>
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} · {employee.position || employee.post}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <Input
                    id="personnel-employee"
                    value={legacyEmployeeName}
                    onChange={event => setLegacyEmployeeName(event.target.value)}
                    placeholder="Digite o nome enquanto o RH cadastra a base"
                    required
                  />
                  <p className="mt-1 text-xs text-amber-700">A lista nova ainda está vazia. Este nome ficará marcado como cadastro manual temporário.</p>
                </>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="personnel-date">Data de referência</Label>
              <Input
                id="personnel-date"
                type="date"
                value={date}
                onChange={event => setDate(event.target.value)}
                required
              />
            </div>
          </div>
          {(entryType === "FT" || entryType === "EXTRA") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="personnel-amount">Valor a pagar (R$)</Label>
                <Input
                  id="personnel-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={event => setAmount(event.target.value)}
                  placeholder="0,00"
                  required
                />
              </div>
              {entryType === "EXTRA" && (
                <div className="space-y-1.5">
                  <Label htmlFor="personnel-hours">Horas ou diárias</Label>
                  <Input
                    id="personnel-hours"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={hours}
                    onChange={event => setHours(event.target.value)}
                    placeholder="Ex.: 4 ou 1"
                    required
                  />
                </div>
              )}
            </div>
          )}
          {entryType === "ATESTADO" && (
            <div className="space-y-1.5">
              <Label htmlFor="personnel-file">
                Atestado médico (PDF, JPG, PNG ou WEBP)
              </Label>
              <Input
                id="personnel-file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={async event => {
                  const selected = event.target.files?.[0];
                  if (!selected) return;
                  if (selected.size > 10 * 1024 * 1024) {
                    toast.error("O arquivo deve ter no máximo 10 MB");
                    return;
                  }
                  try {
                    setFile(await fileToPayload(selected));
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Não foi possível ler o arquivo"
                    );
                  }
                }}
                className="h-auto py-2"
                required
              />
              {file && (
                <p className="text-xs text-emerald-700">
                  Arquivo pronto: {file.name}
                </p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="personnel-reason">
              {entryType === "FT"
                ? "Motivo / observação"
                : entryType === "EXTRA"
                  ? "Descrição do serviço"
                  : "Observação"}
            </Label>
            <Textarea
              id="personnel-reason"
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder={
                entryType === "FT"
                  ? "Ex.: cobertura de escala no posto Centro"
                  : "Descreva os detalhes do lançamento"
              }
              required={entryType !== "FT"}
              minLength={entryType === "FT" ? 0 : 5}
              maxLength={2000}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
            <p className="text-xs leading-5 text-blue-900">
              O registro ficará <strong>pendente</strong> até a conferência do
              RH.
            </p>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Enviar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ReviewQueue({
  data,
  onRefresh,
}: {
  data: any;
  onRefresh: () => Promise<void>;
}) {
  const reviewFt = trpc.personnel.reviewFt.useMutation();
  const reviewOccurrence = trpc.personnel.reviewOccurrence.useMutation();
  const reviewExtra = trpc.personnel.reviewExtra.useMutation();
  const pendingRows = useMemo(
    () => [
      ...(data?.fts ?? [])
        .filter((row: any) => row.status === "PENDING")
        .map((row: any) => ({ ...row, kind: "FT", label: "Folga trabalhada" })),
      ...(data?.extras ?? [])
        .filter((row: any) => row.status === "PENDING")
        .map((row: any) => ({ ...row, kind: "EXTRA", label: "Serviço extra" })),
      ...(data?.occurrences ?? [])
        .filter((row: any) => row.status === "PENDING")
        .map((row: any) => ({
          ...row,
          kind: "OCCURRENCE",
          label: row.type.replaceAll("_", " "),
        })),
    ],
    [data]
  );

  const review = async (row: any, status: "APPROVED" | "REJECTED") => {
    const rejectionReason =
      status === "REJECTED"
        ? window.prompt("Informe o motivo da rejeição:")?.trim()
        : undefined;
    if (
      status === "REJECTED" &&
      (!rejectionReason || rejectionReason.length < 5)
    )
      return toast.error("Informe um motivo com pelo menos 5 caracteres");
    try {
      if (row.kind === "FT")
        await reviewFt.mutateAsync({ id: row.id, status, rejectionReason });
      else if (row.kind === "EXTRA")
        await reviewExtra.mutateAsync({ id: row.id, status, rejectionReason });
      else
        await reviewOccurrence.mutateAsync({
          id: row.id,
          status,
          rejectionReason,
        });
      toast.success(
        status === "APPROVED" ? "Lançamento aprovado" : "Lançamento rejeitado"
      );
      await onRefresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível revisar o lançamento"
      );
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm xl:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Fila de auditoria do RH
          </CardTitle>
          <CardDescription>
            Confira documentos e valores antes do envio ao Financeiro.
          </CardDescription>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
          {pendingRows.length} pendentes
        </span>
      </CardHeader>
      <CardContent>
        {pendingRows.length === 0 ? (
          <EmptyState
            title="Tudo em dia"
            description="Não há lançamentos pendentes de auditoria."
          />
        ) : (
          <div className="space-y-3">
            {pendingRows.map((row: any) => (
              <div
                key={`${row.kind}-${row.id}`}
                className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-950">
                      {row.employeeName}
                    </p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                      {row.label}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{formatDate(row.date)}</span>
                    {row.amount !== undefined && (
                      <span className="font-bold text-slate-700">
                        {formatCurrency(row.amount)}
                      </span>
                    )}
                    {row.hoursOrDaily !== undefined && (
                      <span>{row.hoursOrDaily} h/diária</span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                    {row.reason ||
                      row.description ||
                      row.observation ||
                      "Sem observação"}
                  </p>
                  {row.documentUrl && (
                    <a
                      href={row.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {row.documentName || "Ver documento"}
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    onClick={() => void review(row, "APPROVED")}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Check className="mr-1.5 h-4 w-4" />
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void review(row, "REJECTED")}
                    className="border-rose-200 text-rose-700 hover:bg-rose-50"
                  >
                    <X className="mr-1.5 h-4 w-4" />
                    Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FinanceQueue({
  data,
  onRefresh,
}: {
  data: any;
  onRefresh: () => Promise<void>;
}) {
  const payFt = trpc.personnel.payFt.useMutation();
  const payExtra = trpc.personnel.payExtra.useMutation();
  const rows = useMemo(
    () => [
      ...(data?.fts ?? [])
        .filter((row: any) => row.status === "APPROVED")
        .map((row: any) => ({ ...row, kind: "FT", label: "Folga trabalhada" })),
      ...(data?.extras ?? [])
        .filter((row: any) => row.status === "APPROVED")
        .map((row: any) => ({ ...row, kind: "EXTRA", label: "Serviço extra" })),
    ],
    [data]
  );
  const total = rows.reduce(
    (sum: number, row: any) => sum + Number(row.amount),
    0
  );
  const settle = async (row: any) => {
    try {
      if (row.kind === "FT") await payFt.mutateAsync({ id: row.id });
      else await payExtra.mutateAsync({ id: row.id });
      toast.success("Lançamento quitado");
      await onRefresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível quitar o lançamento"
      );
    }
  };
  const exportCsv = () => {
    const allRows = [
      ...(data?.fts ?? []).map((row: any) => ({ ...row, kind: "FT" })),
      ...(data?.extras ?? []).map((row: any) => ({ ...row, kind: "EXTRA" })),
    ];
    const csv = [
      ["Funcionário", "Tipo", "Data de referência", "Pagamento previsto", "Valor", "Chave PIX", "Status"],
      ...allRows.map((row: any) => [
        row.employeeName,
        row.kind,
        formatDate(row.date),
        row.kind === "FT" ? formatDate(row.paymentDate) : "—",
        Number(row.amount).toFixed(2).replace(".", ","),
        row.employeePixKey || "",
        statusLabel(row.status),
      ]),
    ]
      .map(line =>
        line.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(";")
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Card className="border-slate-200 shadow-sm xl:col-span-2">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BadgeDollarSign className="h-5 w-5 text-emerald-600" />
            Fila de pagamentos
          </CardTitle>
          <CardDescription>
            Somente lançamentos aprovados pelo RH podem ser quitados.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-700">
            {formatCurrency(total)}
          </span>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" />
            CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            title="Nenhum pagamento pendente"
            description="As aprovações do RH aparecerão aqui."
          />
        ) : (
          <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Favorecido</th>
                  <th className="px-3 py-3">PIX</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3">Referência</th>
                  <th className="px-3 py-3">Pagamento previsto</th>
                  <th className="px-3 py-3">Valor</th>
                  <th className="px-3 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row: any) => (
                  <tr key={`${row.kind}-${row.id}`}>
                    <td className="px-3 py-3 font-semibold">
                      {row.employeeName}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-500">
                      {row.employeePixKey || "Não informado"}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{row.label}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-3 py-3 font-semibold text-blue-700">
                      {row.kind === "FT" ? formatDate(row.paymentDate) : "—"}
                    </td>
                    <td className="px-3 py-3 font-black text-emerald-700">
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        size="sm"
                        onClick={() => void settle(row)}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <BadgeCheck className="mr-1.5 h-4 w-4" />
                        Quitar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentEntries({ data }: { data: any }) {
  const rows = useMemo(
    () =>
      [
        ...(data?.fts ?? []).map((row: any) => ({
          ...row,
          kind: "FT",
          label: "Folga trabalhada",
          detail: row.reason,
          amount: row.amount,
        })),
        ...(data?.extras ?? []).map((row: any) => ({
          ...row,
          kind: "EXTRA",
          label: "Serviço extra",
          detail: row.description,
          amount: row.amount,
        })),
        ...(data?.occurrences ?? []).map((row: any) => ({
          ...row,
          kind: "OCCURRENCE",
          label: row.type.replaceAll("_", " "),
          detail: row.observation,
        })),
      ]
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt as string).getTime() -
            new Date(a.createdAt as string).getTime()
        )
        .slice(0, 8),
    [data]
  );
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-blue-600" />
          Meus lançamentos recentes
        </CardTitle>
        <CardDescription>
          Acompanhe o status dos registros enviados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            title="Nenhum lançamento ainda"
            description="Use o formulário para registrar a primeira ocorrência."
          />
        ) : (
          <div className="space-y-3">
            {rows.map((row: any) => (
              <div
                key={`${row.kind}-${row.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold capitalize text-slate-900">
                    {row.label.toLowerCase()}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {formatDate(row.date)} · {row.detail || "Sem observação"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {row.amount !== undefined && (
                    <p className="text-sm font-bold text-slate-800">
                      {formatCurrency(row.amount)}
                    </p>
                  )}
                  <span
                    className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass(row.status)}`}
                  >
                    {statusLabel(row.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmployeesSection({
  data,
  role,
  onRefresh,
}: {
  data: any;
  role: PersonnelRole;
  onRefresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [position, setPosition] = useState("");
  const [postId, setPostId] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [isActive, setIsActive] = useState(true);
  const createEmployee = trpc.personnel.createEmployee.useMutation();
  const updateEmployee = trpc.personnel.updateEmployee.useMutation();
  const canEdit = role === "RH" || role === "ADM";
  const reset = () => {
    setEditing(null);
    setName("");
    setCpf("");
    setPosition("");
    setPostId("");
    setPixKey("");
    setIsActive(true);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;
    try {
      if (editing)
        await updateEmployee.mutateAsync({
          id: editing.id,
          name,
          cpf,
          position,
          postId: postId ? Number(postId) : null,
          pixKey: pixKey || null,
          isActive,
        });
      else
        await createEmployee.mutateAsync({
          name,
          cpf,
          position,
          postId: postId ? Number(postId) : null,
          pixKey: pixKey || null,
        });
      toast.success(
        editing ? "Funcionário atualizado" : "Funcionário cadastrado"
      );
      reset();
      await onRefresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o funcionário"
      );
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
            Cadastros
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">
            Funcionários
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Mantenha a base de colaboradores e chaves de pagamento atualizada.
          </p>
        </div>
        {!canEdit && (
          <span className="rounded-full bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
            Somente leitura
          </span>
        )}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        {canEdit && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {editing ? (
                  <UserCog className="h-5 w-5 text-blue-600" />
                ) : (
                  <Plus className="h-5 w-5 text-blue-600" />
                )}
                {editing ? "Editar funcionário" : "Novo funcionário"}
              </CardTitle>
              <CardDescription>
                Cargo, posto principal e chave PIX ficam disponíveis para o fluxo financeiro.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={submit}>
                <div className="space-y-1.5">
                  <Label htmlFor="employee-name">Nome completo</Label>
                  <Input
                    id="employee-name"
                    value={name}
                    onChange={event => setName(event.target.value)}
                    minLength={2}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="employee-cpf">CPF / matrícula</Label>
                  <Input
                    id="employee-cpf"
                    value={cpf}
                    onChange={event => setCpf(event.target.value)}
                    placeholder="CPF ou matrícula"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="employee-position">Cargo / função</Label>
                  <Input
                    id="employee-position"
                    value={position}
                    onChange={event => setPosition(event.target.value)}
                    placeholder="Ex.: Vigia, Controlador de acesso"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="employee-post">Posto de trabalho principal</Label>
                  <select
                    id="employee-post"
                    value={postId}
                    onChange={event => setPostId(event.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Não informado</option>
                    {(data?.posts ?? []).map((postItem: any) => (
                      <option key={postItem.id} value={postItem.id}>
                        {postItem.name} · {postItem.region}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="employee-pix">Chave PIX (opcional)</Label>
                  <Input
                    id="employee-pix"
                    value={pixKey}
                    onChange={event => setPixKey(event.target.value)}
                    placeholder="CPF, e-mail, telefone ou chave aleatória"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="employee-status">Status</Label>
                  <select
                    id="employee-status"
                    value={isActive ? "active" : "inactive"}
                    onChange={event => setIsActive(event.target.value === "active")}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="bg-[#0d1b2a] hover:bg-slate-800"
                  >
                    {editing ? "Salvar alterações" : "Cadastrar"}
                  </Button>
                  {editing && (
                    <Button type="button" variant="outline" onClick={reset}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UsersRound className="h-5 w-5 text-blue-600" />
              Base cadastrada
            </CardTitle>
            <CardDescription>
              {data?.employees?.length ?? 0} funcionários ativos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[550px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Nome</th>
                    <th className="px-3 py-3">CPF</th>
                    <th className="px-3 py-3">Cargo / posto</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">PIX</th>
                    {canEdit && <th className="px-3 py-3 text-right">Ação</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.employees ?? []).map((employee: any) => (
                    <tr key={employee.id}>
                      <td className="px-3 py-3 font-semibold">
                        {employee.name}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {employee.cpf}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        <span className="font-semibold">{employee.position || "—"}</span>
                        <span className="block text-xs text-slate-500">{employee.post}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={employee.isActive ? "text-emerald-700" : "text-slate-400"}>
                          {employee.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-500">
                        {employee.pixKey || "—"}
                      </td>
                      {canEdit && (
                        <td className="px-3 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditing(employee);
                              setName(employee.name);
                              setCpf(employee.cpf);
                              setPosition(employee.position || "");
                              setPostId(employee.postId ? String(employee.postId) : "");
                              setPixKey(employee.pixKey || "");
                              setIsActive(employee.isActive);
                            }}
                          >
                            Editar
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data?.employees?.length && (
              <EmptyState
                title="Base vazia"
                description="Cadastre o primeiro funcionário para começar."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UsersSection({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const usersQuery = trpc.personnel.users.useQuery();
  const setRole = trpc.personnel.setUserRole.useMutation();
  const saveRole = async (userId: number, personnelRole: PersonnelRole) => {
    try {
      await setRole.mutateAsync({ userId, personnelRole });
      toast.success("Perfil atualizado");
      await Promise.all([usersQuery.refetch(), onRefresh()]);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o perfil"
      );
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
          Segurança
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">
          Perfis de acesso
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Defina quem lança, audita e quita os registros.
        </p>
      </div>
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCog className="h-5 w-5 text-blue-600" />
            Usuários ativos
          </CardTitle>
          <CardDescription>
            O perfil ADM mantém acesso global ao módulo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando usuários...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Usuário</th>
                    <th className="px-3 py-3">Login</th>
                    <th className="px-3 py-3">Acesso operacional</th>
                    <th className="px-3 py-3">Perfil do módulo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(usersQuery.data ?? []).map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-3 py-3 font-semibold">
                        {item.name || "Sem nome"}
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {item.username || item.email || "—"}
                      </td>
                      <td className="px-3 py-3">
                        {item.isOperational ? (
                          <span className="text-emerald-700">Ativo</span>
                        ) : (
                          <span className="text-slate-400">Inativo</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={
                            item.role === "admin"
                              ? "ADM"
                              : item.personnelRole || "SUPERVISOR"
                          }
                          onChange={event =>
                            void saveRole(
                              item.id,
                              event.target.value as PersonnelRole
                            )
                          }
                          disabled={setRole.isPending}
                          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                        >
                          <option value="SUPERVISOR">Supervisor</option>
                          <option value="RH">RH</option>
                          <option value="FINANCEIRO">Financeiro</option>
                          <option value="ADM">ADM</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-10 text-center">
      <UserRound className="mx-auto h-7 w-7 text-slate-300" />
      <p className="mt-3 text-sm font-bold text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}
