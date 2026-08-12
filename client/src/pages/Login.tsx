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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Plano de Rotas</h1>
          </div>
          <p className="text-gray-600">Pro Allen - Sistema de Gestão de Supervisores</p>
        </div>

        {/* Login Card */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="space-y-2 pb-4">
            <CardTitle className="text-2xl">Acesso do Supervisor</CardTitle>
            <CardDescription>
              Informe seu usuário e senha para acessar as rotas e checklists.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleSupervisorLogin}>
              <div className="space-y-1.5"><Label htmlFor="supervisor-username">Usuário</Label><Input id="supervisor-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="ex.: paulo.murashita" autoComplete="username" disabled={supervisorLogin.isPending} required /></div>
              <div className="space-y-1.5"><Label htmlFor="supervisor-password">Senha</Label><Input id="supervisor-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={supervisorLogin.isPending} required /></div>
              <Button type="submit" className="h-10 w-full bg-slate-900 text-white hover:bg-slate-800" disabled={supervisorLogin.isPending || !username || !password}>{supervisorLogin.isPending ? "Verificando acesso..." : "Entrar como supervisor"}</Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            © 2026 Plano de Rotas Pro Allen. Todos os direitos reservados.
          </p>
          <a
            href="/gestor/acesso"
            className="mt-2 inline-block text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-600 focus-visible:text-slate-700 focus-visible:outline-none"
          >
            Acesso do Gestor
          </a>
        </div>
      </div>
    </div>
  );
}
