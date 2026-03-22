// Casa Clara — Admin Page
import { Card, EmptyState } from '../../components/ui';
import { Shield } from 'lucide-react';

export function AdminPage() {
  return (
    <div className="min-h-screen bg-bg p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-text">Panel de administración</h1>
        </div>
        <Card>
          <EmptyState
            icon={<Shield className="h-8 w-8" />}
            title="Panel admin"
            description="Este panel estará disponible para gestionar hogares, suscripciones y métricas del sistema."
          />
        </Card>
      </div>
    </div>
  );
}
