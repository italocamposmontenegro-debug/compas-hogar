import { useState, type ChangeEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Shield, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { AlertBanner, Button, InputField } from '../../components/ui';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { APP_TAGLINE } from '../../lib/constants';
import { trackEvent } from '../../lib/analytics';
import { validateEmail, validatePassword, validateRequired } from '../../utils/validators';

const AUTH_TEXTS = {
  login: {
    title: 'Entra al hogar con claridad.',
    description: 'Accede para revisar el mes y seguir lo que requiere atención.',
  },
  register: {
    title: 'Crea tu hogar.',
    description: 'Empieza con una base clara para ingresos, pagos, metas y acuerdos.',
  },
  forgotPassword: {
    title: 'Recupera tu acceso.',
    description: 'Te enviaremos un enlace para restablecer tu contraseña.',
  },
  resetPassword: {
    title: 'Define una contraseña nueva.',
    description: 'Usa una clave segura y vuelve al hogar sin fricción.',
  },
};

function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-bg px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="ui-panel ui-panel-subtle hidden p-8 lg:flex lg:flex-col lg:justify-between xl:p-10">
          <div>
            <div className="eyebrow">Claridad compartida para el hogar</div>
            <div className="mt-8 flex justify-center">
              <BrandLogo mode="full" className="h-14 w-auto max-w-[260px]" />
            </div>
            <h1 className="section-heading mt-8 max-w-[11ch] text-[clamp(2.35rem,4vw,4rem)] text-text">
              Una entrada clara y confiable al hogar.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-text-muted">{APP_TAGLINE}</p>
          </div>

          <div className="space-y-4">
            <AuthSignal
              icon={<Users className="h-4 w-4" />}
              title="Los dos ven el mismo mes"
              description="Ingresos, pagos y prioridades del hogar en una lectura compartida desde el primer día."
            />
            <AuthSignal
              icon={<Shield className="h-4 w-4" />}
              title="Menos fricción para decidir"
              description="Cuando el mes está claro, es más fácil ponerse de acuerdo y avanzar con calma en lo que están construyendo juntos."
            />
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-lg items-center justify-center lg:max-w-none">
          <div className="ui-panel w-full p-5 sm:p-8 lg:p-9">
            <div className="mb-8 lg:hidden">
              <div className="flex justify-center">
                <BrandLogo mode="full" className="h-11 w-auto max-w-[220px]" />
              </div>
            </div>

            <header className="max-w-xl">
              <h1 className="section-heading text-[clamp(2rem,5vw,2.7rem)] text-text">{title}</h1>
              <p className="mt-3 text-sm leading-7 text-text-muted">{description}</p>
            </header>
            <div className="mt-8">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthSignal({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="ui-panel overflow-hidden p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-bg text-primary">{icon}</div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-text">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-text-muted">{description}</p>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  autoComplete,
  required,
}: {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  hint?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <InputField
      label={label}
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      hint={hint}
      autoComplete={autoComplete}
      required={required}
      action={{
        label: visible ? 'Ocultar' : 'Mostrar',
        onClick: () => setVisible((current) => !current),
        ariaLabel: visible ? 'Ocultar contraseña' : 'Mostrar contraseña',
      }}
    />
  );
}

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const redirect = searchParams.get('redirect');
  const redirectTarget = redirect && redirect.startsWith('/') ? redirect : '/app/resumen';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) return setError(emailCheck.error || 'Revisa el email.');
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) return setError(passwordCheck.error || 'Revisa la contraseña.');

    setLoading(true);
    try {
      const { error: authError } = await signIn(email, password);
      if (authError) {
        setError(authError === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : authError);
      } else {
        navigate(redirectTarget);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title={AUTH_TEXTS.login.title} description={AUTH_TEXTS.login.description}>
      <div className="space-y-6">
        {error ? <AlertBanner type="danger" message={error} /> : null}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <InputField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
            required
          />
          <PasswordField
            label="Contraseña"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />

          <div className="flex justify-end">
            <Link to="/recuperar-clave" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Iniciar sesión
          </Button>
        </form>

        <p className="text-center text-sm text-text-muted">
          ¿No tienes cuenta?{' '}
          <Link
            to={`/registro${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Crear cuenta
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const nameCheck = validateRequired(fullName, 'Tu nombre');
    if (!nameCheck.valid) return setError(nameCheck.error || 'Completa tu nombre.');
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) return setError(emailCheck.error || 'Revisa el email.');
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) return setError(passwordCheck.error || 'Revisa la contraseña.');

    trackEvent('signup_started', { source: 'register-page', redirect: redirectTarget });
    setLoading(true);
    try {
      const { error: authError, needsEmailConfirmation } = await signUp(email, password, fullName);
      if (authError) {
        setError(authError);
      } else if (needsEmailConfirmation) {
        trackEvent('signup_completed', { source: 'register-page', confirmation_required: true });
        setSuccess(true);
      } else {
        trackEvent('signup_completed', { source: 'register-page', confirmation_required: false });
        navigate(redirectTarget);
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <AuthLayout title="Revisa tu correo." description="Tu cuenta ya quedó creada. Solo falta verificar el email para entrar al hogar.">
        <div className="rounded-2xl border border-success/18 bg-success-bg px-5 py-5">
          <p className="text-sm leading-7 text-text-secondary">
            Enviamos un enlace de verificación a <strong>{email}</strong>.
          </p>
        </div>
        <div className="mt-6">
          <Link
            to={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Ir a iniciar sesión
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={AUTH_TEXTS.register.title} description={AUTH_TEXTS.register.description}>
      <div className="space-y-6">
        {error ? <AlertBanner type="danger" message={error} /> : null}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <InputField
            label="Nombre completo"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Ej: Ana Pérez"
            autoComplete="name"
            required
          />
          <InputField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
            required
          />
          <PasswordField
            label="Contraseña"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mínimo 8 caracteres"
            hint="Usa al menos 8 caracteres."
            autoComplete="new-password"
            required
          />

          <Button type="submit" className="w-full" loading={loading}>
            Crear cuenta
          </Button>
        </form>

        <p className="text-center text-sm text-text-muted">
          ¿Ya tienes cuenta?{' '}
          <Link
            to={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Iniciar sesión
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) return setError(emailCheck.error || 'Revisa el email.');

    setLoading(true);
    try {
      const { error: resetError } = await resetPassword(email);
      if (resetError) setError(resetError);
      else setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title={AUTH_TEXTS.forgotPassword.title} description={AUTH_TEXTS.forgotPassword.description}>
      <div className="space-y-5">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-text-muted underline-offset-4 hover:text-text hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>

        {sent ? (
          <div className="rounded-2xl border border-success/18 bg-success-bg px-5 py-5">
            <p className="text-sm leading-7 text-text-secondary">
              Si existe una cuenta con <strong>{email}</strong>, recibirás un enlace para restablecer el acceso.
            </p>
          </div>
        ) : (
          <>
            {error ? <AlertBanner type="danger" message={error} /> : null}
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <InputField
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                required
              />
              <Button type="submit" className="w-full" loading={loading}>
                Enviar enlace
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) return setError(passwordCheck.error || 'Revisa la contraseña.');
    if (password !== confirm) return setError('Las contraseñas no coinciden.');

    setLoading(true);
    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) setError(updateError);
      else navigate('/app/resumen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title={AUTH_TEXTS.resetPassword.title} description={AUTH_TEXTS.resetPassword.description}>
      <div className="space-y-5">
        {error ? <AlertBanner type="danger" message={error} /> : null}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <PasswordField
            label="Nueva contraseña"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            required
          />
          <PasswordField
            label="Confirmar contraseña"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Repite la contraseña"
            autoComplete="new-password"
            required
          />
          <Button type="submit" className="w-full" loading={loading}>
            Guardar contraseña
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const redirectTarget = redirect && redirect.startsWith('/') ? redirect : '/login';

  return (
    <AuthLayout title="Correo verificado." description="Tu cuenta ya está lista para entrar a Compás Hogar.">
      <div className="rounded-2xl border border-success/18 bg-success-bg px-5 py-5">
        <p className="text-sm leading-7 text-text-secondary">Ya puedes iniciar sesión y entrar al hogar.</p>
      </div>
      <div className="mt-6">
        <Button onClick={() => navigate(redirectTarget)}>Iniciar sesión</Button>
      </div>
    </AuthLayout>
  );
}
