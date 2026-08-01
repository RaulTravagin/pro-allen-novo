import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MapPin, CheckCircle2, Clock, LogIn, LogOut, Loader2 } from "lucide-react";
import { useState } from "react";

interface PostCardProps {
  id: number;
  postId: number;
  postName: string;
  postAddress?: string;
  status: 'pending' | 'in_progress' | 'visited';
  observations?: string;
  arrivalTime?: Date | null;
  departureTime?: Date | null;
  onCheckIn: (checklistId: number) => Promise<void>;
  onCheckOut: (checklistId: number) => Promise<void>;
  onOpenChecklist: (checklistId: number) => void;
  isLoading?: boolean;
}

export default function PostCard({
  id,
  postId,
  postName,
  postAddress,
  status,
  observations,
  arrivalTime,
  departureTime,
  onCheckIn,
  onCheckOut,
  onOpenChecklist,
  isLoading = false,
}: PostCardProps) {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    try {
      await onCheckIn(id);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setIsCheckingOut(true);
    try {
      await onCheckOut(id);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const formatTime = (date: Date | null | undefined) => {
    if (!date) return '-';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '-';
    }
  };

  const getCardStyles = () => {
    if (status === 'visited') {
      return 'bg-green-50 border-green-200 border-l-4 border-l-green-500';
    }
    if (status === 'in_progress') {
      return 'bg-blue-50 border-blue-200 border-l-4 border-l-blue-500';
    }
    return 'bg-white border-gray-200';
  };

  const getStatusIcon = () => {
    if (status === 'visited') {
      return <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />;
    }
    if (status === 'in_progress') {
      return <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />;
    }
    return <MapPin className="w-5 h-5 text-gray-600 flex-shrink-0" />;
  };

  const getStatusLabel = () => {
    if (status === 'visited') return 'Visita Concluída';
    if (status === 'in_progress') return 'Em Visita';
    return 'Pendente';
  };

  return (
    <Card className={`transition-all ${getCardStyles()}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {getStatusIcon()}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg">{postName}</CardTitle>
              <CardDescription className="mt-1">
                {postAddress && <span className="block text-sm">{postAddress}</span>}
                <span className={`inline-block font-semibold text-xs mt-1 px-2 py-1 rounded ${
                  status === 'visited' ? 'bg-green-100 text-green-800' :
                  status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {getStatusLabel()}
                </span>
              </CardDescription>
            </div>
          </div>

          {/* Action Buttons - Responsive Layout */}
          <div className="flex flex-row md:flex-col gap-2 flex-shrink-0 w-full md:w-auto">
            {status === 'pending' && (
              <Button
                onClick={handleCheckIn}
                disabled={isCheckingIn || isLoading}
                className="bg-green-600 hover:bg-green-700 text-white flex-1 md:flex-none"
                size="sm"
              >
                {isCheckingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    <span className="hidden sm:inline">Chegando...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Chegada</span>
                    <span className="sm:hidden">Chegar</span>
                  </>
                )}
              </Button>
            )}

            {status === 'in_progress' && (
              <>
                <Button
                  onClick={handleCheckOut}
                  disabled={isCheckingOut || isLoading}
                  className="bg-red-600 hover:bg-red-700 text-white flex-1 md:flex-none"
                  size="sm"
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      <span className="hidden sm:inline">Saindo...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Saída</span>
                      <span className="sm:hidden">Sair</span>
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => onOpenChecklist(id)}
                  disabled={isLoading}
                  variant="outline"
                  className="text-blue-600 border-blue-600 flex-1 md:flex-none"
                  size="sm"
                >
                  <span className="hidden sm:inline">Checklist</span>
                  <span className="sm:hidden">Check</span>
                </Button>
              </>
            )}

            {status === 'visited' && (
              <Button
                onClick={() => onOpenChecklist(id)}
                disabled={isLoading}
                variant="outline"
                className="text-gray-600 border-gray-300 flex-1 md:flex-none"
                size="sm"
              >
                <span className="hidden sm:inline">Ver Detalhes</span>
                <span className="sm:hidden">Detalhes</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Time Info */}
      {(arrivalTime || departureTime) && (
        <CardContent className="pt-0">
          <div className="flex gap-4 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            {arrivalTime && (
              <div>
                <span className="font-semibold">Chegada:</span> {formatTime(arrivalTime)}
              </div>
            )}
            {departureTime && (
              <div>
                <span className="font-semibold">Saída:</span> {formatTime(departureTime)}
              </div>
            )}
          </div>
        </CardContent>
      )}

      {/* Observations */}
      {observations && (
        <CardContent className="pt-0">
          <p className="text-sm text-gray-700">
            <strong>Observações:</strong> {observations}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
