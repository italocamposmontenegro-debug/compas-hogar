// ============================================
// Casa Clara — Invitation Acceptance Page
// ============================================

import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button, Card, LoadingPage } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { Home, CheckCircle, AlertTriangle, LogIn, UserPlus } from 'lucide-react';

export function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'valid' | 'needs_auth' | 'invalid' | 'accepted' | 'error' | 'wrong_account' | 'expired' | 'already_used'>('loading');
  const [householdName, setHouseholdName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [invitedEmail, setInvitedEmail] = useState('');

  const checkToken = useCallback(async () => {
    if (!token) { setStatus('invalid'); return; }

    const { data, error } = await supabase.functions.invoke('preview-invitation', {
      body: { token },
    });

    if (error || !data) {
      setStatus('error');
      setErrorMsg(error?.message || 'No pudimos revisar esta invitación.');
      return;
    }

    if (data.status === 'invalid') {
      setStatus('invalid');
      return;
    }

    if (data.status === 'expired') {
      setStatus('expired');
      setErrorMsg('Esta invitación ha expirado.');
      return;
    }

    if (data.status === 'accepted') {
      setStatus('already_used');
      setErrorMsg('Esta invitación ya fue aceptada.');
      return;
    }

    if (data.status === 'revoked') {
      setStatus('invalid');
      setErrorMsg('Esta invitación fue revocada.');
      return;
    }

    setInvitedEmail(data.invited_email);
    setHouseholdName(data.household_name || 'el hogar');

    if (!user) {
      setStatus('needs_auth');
      return;
    }

    if (user.email && user.email.toLowerCase() !== data.invited_email.toLowerCase()) {
      setStatus('wrong_account');
      setErrorMsg(`Esta invitación fue enviada a ${data.invited_email}. Ahora mismo estás con ${user.email}.`);
      return;
    }

    setStatus('valid');
  }, [token, user]);

  useEffect(() => {
    void checkToken();
  }, [checkToken]);

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
    } catch (error: unknown) {
      setStatus('error');
      setErrorMsg(error instanceof Error ? error.message : 'No pudimos aceptar la invitación');
    }
  }

  async function switchAccount() {
    await signOut();
    navigate(`/login?redirect=${encodeURIComponent(`/invitacion/${token}`)}`);
  }

  if (status === 'loading') return <LoadingPage />;

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <Card padding="lg" className="max-w-md text-center">
        {status === 'valid' && (
          <>
            <Home className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-bold text-text mb-2">Invitación lista</h2>
            <p className="text-sm text-text-muted mb-6">
              Te invitaron a unirte a <strong>{householdName}</strong> con <strong>{invitedEmail}</strong>.
            </p>
            <Button onClick={acceptInvitation} className="w-full">
              Aceptar invitación
            </Button>
          </>
        )}

        {status === 'needs_auth' && (
          <>
            <Home className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-bold text-text mb-2">Te invitaron a {householdName}</h2>
            <p className="text-sm text-text-muted mb-6">
              Esta invitación fue enviada a <strong>{invitedEmail}</strong>. Inicia sesión o crea una cuenta con ese mismo correo.
            </p>
            <div className="space-y-3">
              <Button onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/invitacion/${token}`)}`)} className="w-full">
                <LogIn className="h-4 w-4" /> Iniciar sesión
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/registro?redirect=${encodeURIComponent(`/invitacion/${token}`)}`)} className="w-full">
                <UserPlus className="h-4 w-4" /> Crear cuenta
              </Button>
            </div>
          </>
        )}

        {status === 'wrong_account' && (
          <>
            <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
            <h2 className="text-xl font-bold text-text mb-2">Usa la cuenta correcta</h2>
            <p className="text-sm text-text-muted mb-6">{errorMsg}</p>
            <div className="space-y-3">
              <Button onClick={switchAccount} className="w-full">
                Cambiar de cuenta
              </Button>
              <Button variant="secondary" onClick={() => navigate('/app/dashboard')} className="w-full">
                Volver al dashboard
              </Button>
            </div>
          </>
        )}

        {status === 'accepted' && (
          <>
            <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-text mb-2">Invitación aceptada</h2>
            <p className="text-sm text-text-muted">Entrando a tu hogar...</p>
          </>
        )}

        {(status === 'invalid' || status === 'error' || status === 'expired' || status === 'already_used') && (
          <>
            <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
            <h2 className="text-xl font-bold text-text mb-2">Invitación no disponible</h2>
            <p className="text-sm text-text-muted mb-6">
              {errorMsg || 'Esta invitación no existe, ya fue usada o expiró.'}
            </p>
            <Button variant="secondary" onClick={() => navigate(user ? '/app/dashboard' : '/')}>
              {user ? 'Ir al dashboard' : 'Ir al inicio'}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
