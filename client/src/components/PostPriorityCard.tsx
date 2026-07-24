import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, MapPin } from "lucide-react";

interface PostPriorityCardProps {
  name: string;
  address?: string;
  lastVisitDate?: Date | null;
  priority?: 'red' | 'yellow' | 'green';
  daysSinceVisit?: number;
}

export function PostPriorityCard({
  name,
  address,
  lastVisitDate,
  priority = 'green',
  daysSinceVisit = 0,
}: PostPriorityCardProps) {
  const getPriorityColor = () => {
    switch (priority) {
      case 'red':
        return 'bg-red-50 border-red-200 border-l-4 border-l-red-500';
      case 'yellow':
        return 'bg-yellow-50 border-yellow-200 border-l-4 border-l-yellow-500';
      case 'green':
        return 'bg-green-50 border-green-200 border-l-4 border-l-green-500';
      default:
        return '';
    }
  };

  const getPriorityBadgeColor = () => {
    switch (priority) {
      case 'red':
        return 'bg-red-100 text-red-800 hover:bg-red-100';
      case 'yellow':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
      case 'green':
        return 'bg-green-100 text-green-800 hover:bg-green-100';
      default:
        return '';
    }
  };

  const getPriorityLabel = () => {
    switch (priority) {
      case 'red':
        return `Crítico (${daysSinceVisit}+ dias)`;
      case 'yellow':
        return `Atenção (${daysSinceVisit} dias)`;
      case 'green':
        return `Em dia (${daysSinceVisit} dias)`;
      default:
        return '';
    }
  };

  return (
    <Card className={`transition-all hover:shadow-md ${getPriorityColor()}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <MapPin className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <CardTitle className="text-lg">{name}</CardTitle>
              {address && (
                <CardDescription className="mt-1">{address}</CardDescription>
              )}
            </div>
          </div>
          <Badge className={`flex-shrink-0 ${getPriorityBadgeColor()}`}>
            {priority === 'red' && <AlertCircle className="w-3 h-3 mr-1" />}
            {getPriorityLabel()}
          </Badge>
        </div>
      </CardHeader>
      {lastVisitDate && (
        <CardContent>
          <p className="text-xs text-gray-600">
            Última visita: {new Date(lastVisitDate).toLocaleDateString('pt-BR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
