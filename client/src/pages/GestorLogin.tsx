import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import React, { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export default function GestorLogin() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [password, setPassword] = useState("");
  const { data: session, isLoading: isCheckingSession } = trpc.gestorAccess.session.useQuery(undefined, { retry: false });
  const login = trpc.gestorAccess.login.useMutation({
    onSuccess: () => {
      toast.success("Acesso do Gestor liberado.");
      navigate("/gestor");
    },
    onError: (error) => toast.error(error.message || "Não foi possível liberar o acesso."),
  });

  useEffect(() => {
    // Uma consulta iniciada pelo painel em uma sessão anterior não deve
    // sobreviver até a rota pública de senha e gerar erro no console.
    void utils.gestor.dashboard.cancel();
    void utils.gestor.dailyReport.cancel();
  }, [utils]);

  useEffect(() => {
    if (session?.authenticated) navigate("/gestor");
  }, [navigate, session?.authenticated]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate({ password });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe_0,_transparent_36%),linear-gradient(135deg,_#f8fafc_0%,_#eef6ff_50%,_#ffffff_100%)] p-4 sm:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-blue-950/10 md:grid-cols-[1.12fr_.88fr]">
          <div className="bg-slate-950 p-8 text-white sm:p-12">
            <div className="mb-14 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400 text-slate-950"><Activity className="h-5 w-5" /></div>
              <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">Operação em campo</p><h1 className="text-xl font-bold">CT3 Chults Travagin</h1></div>
            </div>
            <p className="max-w-md text-4xl font-semibold leading-tight sm:text-5xl">Visão integral, decisões no momento certo.</p>
            <p className="mt-6 max-w-md text-base leading-7 text-slate-300">Este acesso é reservado ao Gestor para acompanhar as rotas, os postos, as visitas, a quilometragem e a última atualização de GPS da operação.</p>
            <div className="mt-12 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4"><ShieldCheck className="mb-3 h-5 w-5 text-emerald-300" /><p className="font-medium">Acesso protegido</p><p className="mt-1 text-sm text-slate-400">Sessão segura de oito horas.</p></div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4"><Activity className="mb-3 h-5 w-5 text-emerald-300" /><p className="font-medium">Atualização contínua</p><p className="mt-1 text-sm text-slate-400">Dados renovados a cada 15 segundos.</p></div>
            </div>
          </div>
          <div className="flex items-center p-7 sm:p-12">
            <Card className="w-full border-0 shadow-none">
              <CardHeader className="px-0 pt-0"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><LockKeyhole className="h-5 w-5" /></div><CardTitle className="text-3xl text-slate-950">Acesso do Gestor</CardTitle><CardDescription className="pt-2 text-base">Informe a senha exclusiva para abrir o painel operacional.</CardDescription></CardHeader>
              <CardContent className="px-0 pb-0">
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="space-y-2"><Label htmlFor="gestor-password">Senha de acesso</Label><Input id="gestor-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha" disabled={isCheckingSession || login.isPending} required className="h-12" /></div>
                  <Button type="submit" disabled={isCheckingSession || login.isPending || !password} className="h-12 w-full bg-slate-950 font-semibold text-white hover:bg-slate-800">{login.isPending ? "Verificando acesso..." : "Entrar no Painel do Gestor"}</Button>
                </form>
                <Link href="/" className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Voltar para o acesso de supervisores</Link>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
