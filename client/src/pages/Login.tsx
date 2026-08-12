import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, CheckCircle2, Zap } from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { FormEvent, useState } from "react";
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
          <CardHeader className="space-y-2 pb-6">
            <CardTitle className="text-2xl">Bem-vindo</CardTitle>
            <CardDescription>
              Acesse o sistema para gerenciar suas rotas e checklists
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Features */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">Rastreamento em Tempo Real</p>
                  <p className="text-sm text-gray-600">Monitore a localização dos supervisores</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">Checklists Inteligentes</p>
                  <p className="text-sm text-gray-600">Verifique conformidade em cada visita</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">Relatórios Detalhados</p>
                  <p className="text-sm text-gray-600">Análise completa de rotas e visitas</p>
                </div>
              </div>
            </div>

            {/* Login Button */}
            <Button
              onClick={() => startLogin()}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all duration-200"
            >
              <Zap className="w-4 h-4 mr-2" />
              Entrar no Sistema
            </Button>

            <div className="relative py-1"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center"><span className="bg-white px-2 text-xs text-slate-500">ou entre como supervisor</span></div></div>

            <form className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleSupervisorLogin}>
              <div className="space-y-1.5"><Label htmlFor="supervisor-username">Usuário</Label><Input id="supervisor-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="ex.: paulo.murashita" autoComplete="username" disabled={supervisorLogin.isPending} required /></div>
              <div className="space-y-1.5"><Label htmlFor="supervisor-password">Senha</Label><Input id="supervisor-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={supervisorLogin.isPending} required /></div>
              <Button type="submit" className="h-10 w-full bg-slate-900 text-white hover:bg-slate-800" disabled={supervisorLogin.isPending || !username || !password}>{supervisorLogin.isPending ? "Verificando acesso..." : "Entrar como supervisor"}</Button>
            </form>

            <Link href="/gestor/acesso" className="block text-center text-sm font-semibold text-slate-600 transition-colors hover:text-blue-700">
              Acesso exclusivo do Gestor
            </Link>

            <p className="text-xs text-center text-gray-600 mt-4">
              Ao fazer login, você concorda com nossos termos de serviço
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            © 2026 Plano de Rotas Pro Allen. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
