import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { clearChecklistDraft, readChecklistDraft, saveChecklistDraft } from "@/lib/onlineOperationDraft";

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
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Queries
  const { data: checklist, isLoading: checklistLoading } = trpc.checklists.getById.useQuery({ id: checklistId });

  // Mutations
  const updateItemMutation = trpc.checklists.updateItem.useMutation();
  const updateDetailsMutation = trpc.checklists.updateDetails.useMutation();

  useEffect(() => {
    if (!checklist) return;
    const serverItems = Object.fromEntries((checklist.items || []).map((item) => [item.id, {
      isCompliant: item.isCompliant === true,
      notes: item.notes || "",
    }]));
    const draft = user?.id ? readChecklistDraft(user.id, checklist.id) : null;
    setObservations(draft?.observations ?? checklist.observations ?? "");
    setItemStates(draft?.itemStates ?? serverItems);
    setDraftLoaded(true);
  }, [checklist?.id, user?.id]);

  useEffect(() => {
    if (!checklist || !user?.id || !draftLoaded) return;
    saveChecklistDraft(user.id, checklist.id, { observations, itemStates });
  }, [checklist?.id, draftLoaded, itemStates, observations, user?.id]);

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

  const handleSaveDetails = async () => {
    try {
      await updateDetailsMutation.mutateAsync({ checklistId, observations });
      if (user?.id) clearChecklistDraft(user.id, checklistId);
      toast.success("Checklist salvo com sucesso");
    } catch (error) {
      toast.error("Não foi possível salvar as observações");
      console.error("Error saving checklist details:", error);
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
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const formatDateTime = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Ainda não registrado';

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
              <CardDescription>A presença é registrada pelos botões de chegada e saída no card do posto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Entrada</p>
                <p className="mt-1 font-mono text-sm text-blue-950">{formatDateTime(checklist.arrivalTime)}</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Saída</p>
                <p className="mt-1 font-mono text-sm text-emerald-950">{formatDateTime(checklist.departureTime)}</p>
              </div>
            </div>
            {checklist.arrivalTime && checklist.departureTime && (
              <div className="rounded-lg border border-purple-100 bg-purple-50 p-3">
                <p className="text-sm text-purple-900"><strong>Tempo de visita:</strong> {calculateDuration(new Date(checklist.arrivalTime).toISOString(), new Date(checklist.departureTime).toISOString())}</p>
              </div>
            )}
            {checklist.status === 'pending' && (
              <p className="text-sm font-medium text-amber-800">Volte à lista da rota e clique em “Registrar chegada” para iniciar a visita.</p>
            )}
          </CardContent>
        </Card>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
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
            onClick={handleSaveDetails}
            disabled={updateDetailsMutation.isPending || checklist.status === 'pending'}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {updateDetailsMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
            ) : (
              <><CheckCircle2 className="mr-2 h-4 w-4" />Salvar checklist</>
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
