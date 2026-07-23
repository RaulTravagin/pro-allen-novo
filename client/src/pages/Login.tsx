import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, CheckCircle2, Zap } from "lucide-react";

export default function Login() {
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
