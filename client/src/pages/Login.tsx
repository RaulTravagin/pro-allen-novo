import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import React, { FormEvent, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Login() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const supervisorLogin = trpc.localAuth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("Acesso do supervisor liberado.");
      navigate("/supervisor");
    },
    onError: (error) => toast.error(error.message || "Não foi possível entrar."),
  });

  function handleSupervisorLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    supervisorLogin.mutate({ username, password });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0b0b] p-4 text-white">
      <div aria-hidden="true" className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-yellow-400/15 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f6c915] shadow-lg shadow-yellow-400/20">
              <MapPin className="h-7 w-7 text-black" />
            </div>
            <div className="text-left"><p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#f6c915]">Operação em campo</p><h1 className="text-3xl font-black tracking-tight text-white">Pro Allen</h1></div>
          </div>
          <p className="text-sm text-zinc-400">Sistema de Gestão de Supervisores</p>
        </div>

        <Card className="border border-white/10 bg-white shadow-2xl shadow-black/30">
          <CardHeader className="space-y-2 pb-4">
            <CardTitle className="text-2xl text-zinc-950">Acesso do Supervisor</CardTitle>
            <CardDescription className="text-zinc-600">
              Informe seu usuário e senha para acessar as rotas e checklists.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4" onSubmit={handleSupervisorLogin}>
              <div className="space-y-1.5"><Label htmlFor="supervisor-username" className="text-zinc-800">Usuário</Label><Input id="supervisor-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="ex.: paulo.murashita" autoComplete="username" disabled={supervisorLogin.isPending} required className="border-zinc-300 bg-white focus-visible:ring-yellow-400" /></div>
              <div className="space-y-1.5"><Label htmlFor="supervisor-password" className="text-zinc-800">Senha</Label><Input id="supervisor-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={supervisorLogin.isPending} required className="border-zinc-300 bg-white focus-visible:ring-yellow-400" /></div>
              <Button type="submit" className="h-11 w-full bg-[#f6c915] font-bold text-black hover:bg-[#e5b900]" disabled={supervisorLogin.isPending || !username || !password}>{supervisorLogin.isPending ? "Verificando acesso..." : "Entrar como supervisor"}</Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">CT3 Chults Travagin</p>
          <a
            href="/gestor/acesso"
            className="mt-2 inline-block text-[11px] font-semibold text-[#f6c915] transition-colors hover:text-yellow-300 focus-visible:text-yellow-200 focus-visible:outline-none"
          >
            Acesso do Gestor
          </a>
        </div>
      </div>
    </div>
  );
}
