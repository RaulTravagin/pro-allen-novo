import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MapPin, CheckCircle2, Clock, LogIn, LogOut, Loader2, Navigation, Zap } from "lucide-react";
import { useState, useMemo, memo, useCallback } from "react";

interface PostCardProps {
  id: number;
  postId: number;
  postName: string;
  postAddress?: string;
  status: 'pending' | 'in_progress' | 'visited';
  observations?: string;
  arrivalTime?: Date | null;
  departureTime?: Date | null;
  arrivalLatitude?: number | null;
  arrivalLongitude?: number | null;
  departureLatitude?: number | null;
  departureLongitude?: number | null;
  onCheckIn: (checklistId: number) => Promise<void>;
  onCheckOut: (checklistId: number) => Promise<void>;
  onOpenChecklist: (checklistId: number) => void;
  isLoading?: boolean;
  hasActiveVisit?: boolean;
  isActiveVisit?: boolean;
}

const PostCard = memo(function PostCard({
  id,
  postId,
  postName,
  postAddress,
  status,
  observations,
  arrivalTime,
  departureTime,
  arrivalLatitude,
  arrivalLongitude,
  departureLatitude,
  departureLongitude,
  onCheckIn,
  onCheckOut,
  onOpenChecklist,
  isLoading = false,
  hasActiveVisit = false,
  isActiveVisit = status === 'in_progress',
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

  const formatCoordinates = (lat?: number | null, lng?: number | null) => {
    if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const getCardStyles = () => {
    if (status === 'visited') {
      return 'bg-green-50 border-green-200 border-l-4 border-l-green-500';
    }
    if (status === 'in_progress') {
      return 'bg-emerald-50 border-emerald-200 border-l-4 border-l-emerald-500 shadow-sm shadow-emerald-100';
    }
    return 'bg-white border-gray-200';
  };

  const getStatusIcon = () => {
    if (status === 'visited') {
      return <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />;
    }
    if (status === 'in_progress') {
      return <Clock className="w-5 h-5 text-emerald-600 flex-shrink-0" />;
    }
    return <MapPin className="w-5 h-5 text-gray-600 flex-shrink-0" />;
  };

  const getStatusLabel = () => {
    if (status === 'visited') return 'Visita Concluída';
    if (status === 'in_progress') return 'Em Visita';
    return 'Pendente';
  };

  const cardStyles = useMemo(() => getCardStyles(), [status]);
  const statusIcon = useMemo(() => getStatusIcon(), [status]);
  const statusLabel = useMemo(() => getStatusLabel(), [status]);
  
  const memoizedCheckIn = useCallback(handleCheckIn, [id, onCheckIn]);
  const memoizedCheckOut = useCallback(handleCheckOut, [id, onCheckOut]);
  const memoizedOpenChecklist = useCallback(() => onOpenChecklist(id), [id, onOpenChecklist]);

  return (
    <Card className={`transition-all ${cardStyles}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {statusIcon}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg">{postName}</CardTitle>
              <CardDescription className="mt-1">
                {postAddress && <span className="block text-sm">{postAddress}</span>}
                <span className={`inline-block font-semibold text-xs mt-1 px-2 py-1 rounded ${
                  status === 'visited' ? 'bg-green-100 text-green-800' :
                  status === 'in_progress' ? 'bg-emerald-100 text-emerald-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {statusLabel}
                </span>
              </CardDescription>
            </div>
          </div>

          {/* Action Buttons - Responsive Layout */}
          <div className="flex flex-row md:flex-col gap-2 flex-shrink-0 w-full md:w-auto">
            {status === 'pending' && (
              <Button
                onClick={memoizedCheckIn}
                disabled={isCheckingIn || isLoading || hasActiveVisit}
                aria-label={`Registrar chegada em ${postName}`}
                className="bg-green-600 hover:bg-green-700 text-white flex-1 md:flex-none shadow-lg hover:shadow-xl transition-all"
                size="sm"
                title={hasActiveVisit ? "Finalize a visita ativa antes de registrar outra chegada" : "Clique para registrar sua chegada no posto"}
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
                {isActiveVisit ? (
                <Button
                  onClick={memoizedCheckOut}
                  disabled={isCheckingOut || isLoading}
                  aria-label={`Registrar saída de ${postName}`}
                  className="bg-red-600 hover:bg-red-700 text-white flex-1 md:flex-none shadow-lg hover:shadow-xl transition-all"
                  size="sm"
                  title="Clique para registrar sua saída do posto"
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
                ) : (
                  <span className="rounded-md bg-amber-100 px-3 py-2 text-xs font-medium text-amber-800" role="status">
                    Outra visita está ativa
                  </span>
                )}
                <Button
                  onClick={memoizedOpenChecklist}
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
                  aria-label={`Ver detalhes de ${postName}`}
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

      {/* Time and Location Info */}
      {(arrivalTime || departureTime || arrivalLatitude || departureLatitude) && (
        <CardContent className="pt-0 space-y-3">
          {/* Arrival Info */}
          {arrivalTime && (
            <div className="flex items-start gap-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
              <LogIn className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-900">Chegada Registrada</p>
                <p className="text-sm text-blue-800 font-mono">{formatTime(arrivalTime)}</p>
                {arrivalLatitude && arrivalLongitude && (
                  <div className="flex items-start gap-2 mt-1">
                    <Navigation className="w-3 h-3 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-700 font-mono break-all">{formatCoordinates(arrivalLatitude, arrivalLongitude)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Departure Info */}
          {departureTime && (
            <div className="flex items-start gap-3 bg-green-50 p-3 rounded-lg border border-green-100">
              <LogOut className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-green-900">Saída Registrada</p>
                <p className="text-sm text-green-800 font-mono">{formatTime(departureTime)}</p>
                {departureLatitude && departureLongitude && (
                  <div className="flex items-start gap-2 mt-1">
                    <Navigation className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-green-700 font-mono break-all">{formatCoordinates(departureLatitude, departureLongitude)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Duration */}
          {arrivalTime && departureTime && (
            <div className="flex items-center gap-2 bg-purple-50 p-2 rounded-lg border border-purple-100">
              <Zap className="w-4 h-4 text-purple-600 flex-shrink-0" />
              <p className="text-xs text-purple-900">
                <span className="font-semibold">Duração:</span>{' '}
                {(() => {
                  const start = typeof arrivalTime === 'string' ? new Date(arrivalTime) : arrivalTime;
                  const end = typeof departureTime === 'string' ? new Date(departureTime) : departureTime;
                  const minutes = Math.floor((end.getTime() - start.getTime()) / 60000);
                  const hours = Math.floor(minutes / 60);
                  const mins = minutes % 60;
                  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                })()}
              </p>
            </div>
          )}
        </CardContent>
      )}

      {/* Observations */}
      {observations && (
        <CardContent className="pt-0">
          <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
            <strong>Observações:</strong> {observations}
          </p>
        </CardContent>
      )}
    </Card>
  );
});

export default PostCard;
