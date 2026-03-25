// ============================================
// Casa Clara — Auth Pages
// ============================================

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button, InputField, AlertBanner } from '../../components/ui';
import { validateEmail, validatePassword, validateRequired } from '../../utils/validators';
import { Home, ArrowLeft } from 'lucide-react';

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Home className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-text">Casa Clara</span>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Login
// ============================================
export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const redirect = searchParams.get('redirect');
  const redirectTarget = redirect && redirect.startsWith('/') ? redirect : '/app/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) return setError(emailCheck.error!);
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) return setError(pwCheck.error!);

    setLoading(true);
    try {
      const { error: authError } = await signIn(email, password);

      if (authError) {
        setError(authError === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : authError);
      } else {
        navigate(redirectTarget);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="text-xl font-bold text-text mb-2">Inicia sesión</h2>
      <p className="text-sm text-text-muted mb-6">Ingresa a tu cuenta.</p>

      {error && <div className="mb-4"><AlertBanner type="danger" message={error} /></div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" />
        <InputField label="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />

        <div className="text-right">
          <Link to="/recuperar-clave" className="text-xs text-primary hover:text-primary-light">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <Button type="submit" className="w-full" loading={loading}>Iniciar sesión</Button>
      </form>

      <p className="text-sm text-text-muted text-center mt-6">
        ¿No tienes cuenta?{' '}
        <Link to={`/registro${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="text-primary font-medium hover:text-primary-light">Regístrate</Link>
      </p>
    </AuthLayout>
  );
}

// ============================================
// Register
// ============================================
export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const redirect = searchParams.get('redirect');
  const redirectTarget = redirect && redirect.startsWith('/') ? redirect : '/onboarding';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const nameCheck = validateRequired(fullName, 'Tu nombre');
    if (!nameCheck.valid) return setError(nameCheck.error!);
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) return setError(emailCheck.error!);
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) return setError(pwCheck.error!);

    setLoading(true);
    try {
      const { error: authError, needsEmailConfirmation } = await signUp(email, password, fullName);

      if (authError) {
        setError(authError);
      } else if (needsEmailConfirmation) {
        setSuccess(true);
      } else {
        navigate(redirectTarget);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="h-16 w-16 rounded-full bg-success-bg flex items-center justify-center mx-auto mb-4">
            <Home className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-xl font-bold text-text mb-2">Revisa tu correo</h2>
          <p className="text-sm text-text-muted mb-6">
            Te enviamos un enlace de verificación a <strong>{email}</strong>.
          </p>
          <Link to={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="text-primary text-sm font-medium hover:text-primary-light">
            Ir a iniciar sesión
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2 className="text-xl font-bold text-text mb-2">Crea tu cuenta</h2>
      <p className="text-sm text-text-muted mb-6">Crea tu acceso a Casa Clara.</p>

      {error && <div className="mb-4"><AlertBanner type="danger" message={error} /></div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField label="Nombre completo" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ej: Ana Pérez" />
        <InputField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" />
        <InputField label="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" hint="Mínimo 8 caracteres" />

        <Button type="submit" className="w-full" loading={loading}>Crear cuenta</Button>
      </form>

      <p className="text-sm text-text-muted text-center mt-6">
        ¿Ya tienes cuenta?{' '}
        <Link to={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="text-primary font-medium hover:text-primary-light">Inicia sesión</Link>
      </p>
    </AuthLayout>
  );
}

// ============================================
// Forgot Password
// ============================================
export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const check = validateEmail(email);
    if (!check.valid) return setError(check.error!);

    setLoading(true);
    try {
      const { error: err } = await resetPassword(email);

      if (err) setError(err);
      else setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Link to="/login" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text mb-4">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      {sent ? (
        <div className="text-center">
          <h2 className="text-xl font-bold text-text mb-2">Revisa tu correo</h2>
          <p className="text-sm text-text-muted">
            Si existe una cuenta con <strong>{email}</strong>, recibirás un enlace para restablecer tu contraseña.
          </p>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold text-text mb-2">Recuperar contraseña</h2>
          <p className="text-sm text-text-muted mb-6">Te enviaremos un enlace para cambiar tu contraseña.</p>

          {error && <div className="mb-4"><AlertBanner type="danger" message={error} /></div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <InputField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" />
            <Button type="submit" className="w-full" loading={loading}>Enviar enlace</Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}

// ============================================
// Reset Password
// ============================================
export function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const check = validatePassword(password);
    if (!check.valid) return setError(check.error!);
    if (password !== confirm) return setError('Las contraseñas no coinciden');

    setLoading(true);
    try {
      const { error: err } = await updatePassword(password);

      if (err) setError(err);
      else navigate('/app/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="text-xl font-bold text-text mb-2">Nueva contraseña</h2>
      <p className="text-sm text-text-muted mb-6">Define tu nueva contraseña.</p>

      {error && <div className="mb-4"><AlertBanner type="danger" message={error} /></div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField label="Nueva contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
        <InputField label="Confirmar contraseña" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repetir contraseña" />
        <Button type="submit" className="w-full" loading={loading}>Guardar contraseña</Button>
      </form>
    </AuthLayout>
  );
}

// ============================================
// Verify Email
// ============================================
export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const redirectTarget = redirect && redirect.startsWith('/') ? redirect : '/login';

  return (
    <AuthLayout>
      <div className="text-center">
        <div className="h-16 w-16 rounded-full bg-success-bg flex items-center justify-center mx-auto mb-4">
          <Home className="h-8 w-8 text-success" />
        </div>
        <h2 className="text-xl font-bold text-text mb-2">Correo verificado</h2>
        <p className="text-sm text-text-muted mb-6">
          Tu cuenta ya está lista. Ahora puedes iniciar sesión.
        </p>
        <Button onClick={() => navigate(redirectTarget)}>Iniciar sesión</Button>
      </div>
    </AuthLayout>
  );
}
