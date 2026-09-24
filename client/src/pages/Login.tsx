import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { BadgeDollarSign, ClipboardList, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import React, { FormEvent, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Portal = "SUPERVISOR" | "RH" | "FINANCEIRO" | "ADM";

type PortalOption = {
  id: Portal;
  label: string;
  description: string;
  icon: typeof ClipboardList;
  path: string;
};

const portalOptions: PortalOption[] = [
  {
    id: "SUPERVISOR",
    label: "Portal do Supervisor",
    description: "Rotas, visitas e ocorrências",
    icon: ClipboardList,
    path: "/supervisor",
  },
  {
    id: "RH",
    label: "Portal do RH",
    description: "Funcionários e lançamentos",
    icon: UsersRound,
    path: "/rh/funcionarios",
  },
  {
    id: "FINANCEIRO",
    label: "Portal do Financeiro",
    description: "Aprovados e quitação",
    icon: BadgeDollarSign,
    path: "/financeiro/pagamentos",
  },
  {
    id: "ADM",
    label: "Portal do Admin",
    description: "Acesso global e perfis",
    icon: ShieldCheck,
    path: "/admin",
  },
];

function roleLabel(role: Portal) {
  return portalOptions.find(option => option.id === role)?.label ?? "Portal";
}

function getRolePath(role: Portal) {
  return portalOptions.find(option => option.id === role)?.path ?? "/supervisor";
}

export default function Login() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [portal, setPortal] = useState<Portal>("SUPERVISOR");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const localLogin = trpc.localAuth.login.useMutation({
    onSuccess: async result => {
      await utils.auth.me.invalidate();
      const actualRole = result.user.personnelRole as Portal;
      toast.success(`Acesso liberado: ${roleLabel(actualRole)}.`);
      navigate(getRolePath(actualRole));
    },
    onError: error => toast.error(error.message || "Não foi possível entrar."),
  });

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    localLogin.mutate({ username, password });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0b0b] p-4 text-white">
      <div aria-hidden="true" className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-yellow-400/15 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="relative w-full max-w-3xl">
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f6c915] shadow-lg shadow-yellow-400/20">
              <MapPin className="h-7 w-7 text-black" />
            </div>
            <div className="text-left"><p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#f6c915]">Acesso aos portais</p><h1 className="text-3xl font-black tracking-tight text-white">Pro Allen</h1></div>
          </div>
          <p className="text-sm text-zinc-400">Sistema de Gestão Operacional</p>
        </div>

        <Card className="border border-white/10 bg-white shadow-2xl shadow-black/30">
          <CardHeader className="space-y-2 pb-4">
            <CardTitle className="text-2xl text-zinc-950">Escolha seu portal</CardTitle>
            <CardDescription className="text-zinc-600">
              Selecione a área de trabalho e informe seu usuário e senha. O sistema confirma seu perfil e direciona você automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Portal de acesso">
              {portalOptions.map(option => {
                const Icon = option.icon;
                const selected = portal === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPortal(option.id)}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-[#0d1b2a] bg-[#0d1b2a] text-white shadow-md" : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-yellow-400 hover:bg-yellow-50"}`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-[#f6c915] text-[#0d1b2a]" : "bg-white text-zinc-500"}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold">{option.label}</span>
                      <span className={`mt-0.5 block text-xs ${selected ? "text-zinc-300" : "text-zinc-500"}`}>{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <form className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4" onSubmit={handleLogin}>
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs leading-5 text-yellow-900">
                Portal escolhido: <strong>{roleLabel(portal)}</strong>. Se o perfil do usuário for diferente, o sistema fará o redirecionamento correto automaticamente.
              </div>
              <div className="space-y-1.5"><Label htmlFor="initial-username" className="text-zinc-800">Usuário</Label><Input id="initial-username" value={username} onChange={event => setUsername(event.target.value)} placeholder="ex.: rh.proallen" autoComplete="username" disabled={localLogin.isPending} required className="border-zinc-300 bg-white focus-visible:ring-yellow-400" /></div>
              <div className="space-y-1.5"><Label htmlFor="initial-password" className="text-zinc-800">Senha</Label><Input id="initial-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" disabled={localLogin.isPending} required className="border-zinc-300 bg-white focus-visible:ring-yellow-400" /></div>
              <Button type="submit" className="h-11 w-full bg-[#f6c915] font-bold text-black hover:bg-[#e5b900]" disabled={localLogin.isPending || !username || !password}>{localLogin.isPending ? "Verificando acesso..." : `Entrar no ${portal === "SUPERVISOR" ? "portal do Supervisor" : portal === "RH" ? "portal do RH" : portal === "FINANCEIRO" ? "portal do Financeiro" : "portal do Admin"}`}</Button>
            </form>

            <div className="rounded-xl border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-600">
              <strong className="text-zinc-900">Acessos iniciais:</strong> os usuários <code>rh.proallen</code>, <code>financeiro.proallen</code> e <code>admin.proallen</code> são provisionados pelo banco quando as respectivas senhas iniciais estão configuradas no Render. Por segurança, as senhas não ficam expostas nesta tela.
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">CT3 Chults Travagin</p>
          <a href="/local" className="mt-3 inline-block text-[11px] font-semibold text-zinc-400 transition-colors hover:text-zinc-200 focus-visible:text-zinc-100 focus-visible:outline-none">Usar modo local de contingência</a>
          <a href="/gestor/acesso" className="mt-2 block text-[11px] font-semibold text-[#f6c915] transition-colors hover:text-yellow-300 focus-visible:text-yellow-200 focus-visible:outline-none">Acesso do Gestor</a>
        </div>
      </div>
    </div>
  );
}

export { getRolePath, roleLabel };
