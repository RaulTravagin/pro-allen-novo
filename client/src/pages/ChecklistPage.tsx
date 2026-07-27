import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ChecklistPageProps {
  params: {
    checklistId: string;
  };
}

export default function ChecklistPage({ params }: ChecklistPageProps) {
  const { user, logout } = useAuth();
  const checklistId = parseInt(params.checklistId);
  
  const [observations, setObservations] = useState<string>("");
  const [arrivalTime, setArrivalTime] = useState<string>("");
  const [departureTime, setDepartureTime] = useState<string>("");
  const [itemStates, setItemStates] = useState<Record<number, { isCompliant: boolean; notes: string }>>({});

  // Queries
  const { data: checklist, isLoading: checklistLoading } = trpc.checklists.getById.useQuery({ id: checklistId });

  // Mutations
  const updateItemMutation = trpc.checklists.updateItem.useMutation();
  const markVisitedMutation = trpc.checklists.markVisited.useMutation();

  const handleItemChange = async (itemId: number, isCompliant: boolean, notes?: string) => {
    setItemStates(prev => ({
      ...prev,
      [itemId]: { isCompliant, notes: notes || '' }
    }));

    try {
      await updateItemMutation.mutateAsync({
        itemId,
        isCompliant,
        notes,
      });
    } catch (error) {
      console.error("Error updating item:", error);
    }
  };

  const handleMarkVisited = async () => {
    if (!arrivalTime) {
      toast.error("Por favor, informe a hora de chegada");
      return;
    }

    try {
      await markVisitedMutation.mutateAsync({
        checklistId,
        observations,
        arrivalTime: new Date(arrivalTime),
        departureTime: departureTime ? new Date(departureTime) : undefined,
      });
      toast.success("Visita registrada com sucesso!");
      // Redirect back to route
      window.history.back();
    } catch (error) {
      toast.error("Erro ao registrar visita");
      console.error("Error marking visited:", error);
    }
  };

  if (checklistLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Button onClick={() => window.history.back()} variant="outline" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-900">Checklist não encontrado</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  const completedItems = Object.values(itemStates).filter(s => s.isCompliant).length;
  const totalItems = checklist.items?.length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button onClick={() => window.history.back()} variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Checklist de Visita</h1>
              <p className="text-gray-600 mt-1">Progresso: {completedItems}/{totalItems}</p>
            </div>
          </div>
          <Button onClick={() => logout()} variant="outline">
            Sair
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Horários Card */}
        <Card className="mb-8 border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Horários de Visita
            </CardTitle>
            <CardDescription>Registre a hora de chegada e saída do posto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="arrivalTime">Hora de Chegada *</Label>
                <Input
                  id="arrivalTime"
                  type="datetime-local"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  className="text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="departureTime">Hora de Saída</Label>
                <Input
                  id="departureTime"
                  type="datetime-local"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="text-base"
                />
              </div>
            </div>
            {arrivalTime && departureTime && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  <strong>Tempo de visita:</strong> {calculateDuration(arrivalTime, departureTime)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedItems / totalItems) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">{completedItems} de {totalItems} itens verificados</p>
        </div>

        {/* Checklist Items */}
        <div className="space-y-4 mb-8">
          {checklist.items?.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-4">
                  <Checkbox
                    id={`item-${item.id}`}
                    checked={itemStates[item.id]?.isCompliant || false}
                    onCheckedChange={(checked) => handleItemChange(item.id, checked as boolean)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor={`item-${item.id}`} className="text-base font-semibold cursor-pointer">
                      {item.description}
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">Categoria: {item.category}</p>
                  </div>
                  {itemStates[item.id]?.isCompliant && (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
                  )}
                </div>
              </CardHeader>
              {itemStates[item.id]?.isCompliant && (
                <CardContent>
                  <Textarea
                    placeholder="Adicione observações sobre este item (opcional)"
                    value={itemStates[item.id]?.notes || ''}
                    onChange={(e) => handleItemChange(item.id, true, e.target.value)}
                    className="text-sm"
                    rows={2}
                  />
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* Observations */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Observações Gerais da Visita</CardTitle>
            <CardDescription>
              Descreva o objetivo da visita e qualquer informação relevante
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Ex: Inspeção de rotina, problemas identificados, ações recomendadas..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={4}
              className="text-sm"
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-between">
          <Button onClick={() => window.history.back()} variant="outline">
            Cancelar
          </Button>
          <Button
            onClick={handleMarkVisited}
            disabled={!arrivalTime || markVisitedMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {markVisitedMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Registrar Visita
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function calculateDuration(start: string, end: string): string {
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  } catch {
    return "Inválido";
  }
}
