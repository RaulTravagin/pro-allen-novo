import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface ChecklistPageProps {
  params: {
    checklistId: string;
  };
}

export default function ChecklistPage({ params }: ChecklistPageProps) {
  const { user, logout } = useAuth();
  const checklistId = parseInt(params.checklistId);
  
  const [observations, setObservations] = useState<string>("");
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
    try {
      await markVisitedMutation.mutateAsync({
        checklistId,
        observations,
      });
      // Redirect back to route
      window.history.back();
    } catch (error) {
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
            disabled={completedItems === 0 || markVisitedMutation.isPending}
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
                Marcar como Visitado
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
