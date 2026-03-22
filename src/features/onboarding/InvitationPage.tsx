// ============================================
// Casa Clara — Invitation Acceptance Page
// ============================================

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button, Card, LoadingPage } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { Home, CheckCircle, AlertTriangle } from 'lucide-react';

export function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'accepted' | 'error'>('loading');
  const [householdName, setHouseholdName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    checkToken();
  }, [token]);

  async function checkToken() {
    if (!token) { setStatus('invalid'); return; }

    const { data, error } = await supabase
      .from('invitation_tokens')
      .select('*, households(name)')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (error || !data) {
      setStatus('invalid');
      return;
    }

    if (new Date(data.expires_at) < new Date()) {
      setStatus('invalid');
      setErrorMsg('Esta invitación ha expirado.');
      return;
    }

    setHouseholdName((data as any).households?.name || 'el hogar');
    setStatus('valid');
  }

  async function acceptInvitation() {
    if (!token || !user) return;
    setStatus('loading');

    try {
      // Call Edge Function for secure acceptance
      const { error } = await supabase.functions.invoke('accept-invitation', {
        body: { token },
      });

      if (error) throw error;
      setStatus('accepted');
      setTimeout(() => navigate('/app/dashboard'), 2000);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Error al aceptar la invitación');
    }
  }

  if (status === 'loading') return <LoadingPage />;

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <Card padding="lg" className="max-w-md text-center">
        {status === 'valid' && (
          <>
            <Home className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-bold text-text mb-2">¡Te invitaron a un hogar!</h2>
            <p className="text-sm text-text-muted mb-6">
              Has sido invitado/a a unirte a <strong>{householdName}</strong> en Casa Clara.
            </p>
            <Button onClick={acceptInvitation} className="w-full">
              Aceptar invitación
            </Button>
          </>
        )}

        {status === 'accepted' && (
          <>
            <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-text mb-2">¡Bienvenido/a!</h2>
            <p className="text-sm text-text-muted">Redirigiendo al dashboard...</p>
          </>
        )}

        {(status === 'invalid' || status === 'error') && (
          <>
            <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
            <h2 className="text-xl font-bold text-text mb-2">Invitación no válida</h2>
            <p className="text-sm text-text-muted mb-6">
              {errorMsg || 'Esta invitación no existe, ya fue usada o expiró.'}
            </p>
            <Button variant="secondary" onClick={() => navigate('/app/dashboard')}>
              Ir al dashboard
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
