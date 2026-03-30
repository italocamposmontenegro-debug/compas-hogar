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
    <main className="min-h-screen bg-bg px-4 py-6 sm:px-6 sm:py-8">
      <div className="page-shell flex min-h-[70vh] items-center justify-center">
        <Card padding="lg" className="max-w-lg text-center">
        {status === 'valid' && (
          <>
            <Home className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h1 className="section-heading text-2xl text-text">Invitación lista</h1>
            <p className="mt-3 text-sm leading-7 text-text-muted">
              Esta invitación fue enviada a <strong>{invitedEmail}</strong>. Si ese es tu correo, puedes unirte ahora a <strong>{householdName}</strong>.
            </p>
            <Button onClick={acceptInvitation} className="mt-6 w-full">
              Aceptar invitación
            </Button>
          </>
        )}

        {status === 'needs_auth' && (
          <>
            <Home className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h1 className="section-heading text-2xl text-text">Te invitaron a {householdName}</h1>
            <p className="mt-3 text-sm leading-7 text-text-muted">
              Esta invitación fue enviada a <strong>{invitedEmail}</strong>.
            </p>
            <div className="mt-5 rounded-2xl border border-border bg-bg/70 px-4 py-4 text-left">
              <p className="text-sm font-semibold text-text">Qué debes hacer</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-text-muted">
                <li>Si ya tienes cuenta, inicia sesión con ese mismo correo.</li>
                <li>Si no tienes cuenta, créala con ese mismo correo.</li>
                <li>No uses la cuenta de otra persona.</li>
              </ul>
            </div>
            <div className="mt-6 space-y-3">
              <Button onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/invitacion/${token}`)}`)} className="w-full">
                <LogIn className="h-4 w-4" /> Ya tengo cuenta
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/registro?redirect=${encodeURIComponent(`/invitacion/${token}`)}`)} className="w-full">
                <UserPlus className="h-4 w-4" /> Crear cuenta con este correo
              </Button>
            </div>
          </>
        )}

        {status === 'wrong_account' && (
          <>
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-warning" />
            <h1 className="section-heading text-2xl text-text">Usa la cuenta correcta</h1>
            <p className="mt-3 text-sm leading-7 text-text-muted">
              Esta invitación fue enviada a <strong>{invitedEmail}</strong>.
            </p>
            <div className="mt-5 rounded-2xl border border-border bg-bg/70 px-4 py-4 text-left">
              <p className="text-sm font-semibold text-text">Cuenta actual</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">{user?.email}</p>
              <p className="mt-4 text-sm font-semibold text-text">Siguiente paso</p>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-text-muted">
                <li>Debes entrar o crear una cuenta con ese mismo correo.</li>
                <li>No uses la cuenta de otra persona.</li>
              </ul>
            </div>
            <div className="mt-6 space-y-3">
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
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-success" />
            <h1 className="section-heading text-2xl text-text">Invitación aceptada</h1>
            <p className="mt-3 text-sm leading-7 text-text-muted">Entrando a tu hogar…</p>
          </>
        )}

        {(status === 'invalid' || status === 'error' || status === 'expired' || status === 'already_used') && (
          <>
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-warning" />
            <h1 className="section-heading text-2xl text-text">Invitación no disponible</h1>
            <p className="mt-3 text-sm leading-7 text-text-muted">
              {errorMsg || 'Esta invitación no existe, ya fue usada o expiró.'}
            </p>
            <Button variant="secondary" onClick={() => navigate(user ? '/app/dashboard' : '/')} className="mt-6">
              {user ? 'Ir al dashboard' : 'Ir al inicio'}
            </Button>
          </>
        )}
        </Card>
      </div>
    </main>
  );
}
