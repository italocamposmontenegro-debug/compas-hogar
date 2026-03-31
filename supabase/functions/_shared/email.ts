import nodemailer from 'npm:nodemailer@6.10.1';

export interface InvitationEmailPayload {
  invitedEmail: string;
  invitationUrl: string;
  householdName: string;
  ownerName: string;
  expiresAt: string;
}

export interface EmailDeliveryResult {
  attempted: boolean;
  sent: boolean;
  reason?: 'smtp_not_configured';
  error?: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

type MailContent = {
  subject: string;
  previewLabel?: string;
  heading: string;
  intro: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  footnote?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getSmtpConfig(): SmtpConfig | null {
  const host = Deno.env.get('SMTP_HOST')?.trim();
  const portRaw = Deno.env.get('SMTP_PORT')?.trim();
  const user = Deno.env.get('SMTP_USER')?.trim();
  const pass = Deno.env.get('SMTP_PASS')?.trim();
  const fromEmail = Deno.env.get('SMTP_FROM_EMAIL')?.trim();
  const fromName = Deno.env.get('SMTP_FROM_NAME')?.trim() || 'Compás Hogar';

  if (!host || !portRaw || !user || !pass || !fromEmail) {
    return null;
  }

  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    return null;
  }

  return { host, port, user, pass, fromEmail, fromName };
}

function buildEmailHtml(content: MailContent) {
  const previewLabel = content.previewLabel ? escapeHtml(content.previewLabel) : 'Compás Hogar';
  const heading = escapeHtml(content.heading);
  const intro = escapeHtml(content.intro);
  const body = escapeHtml(content.body);
  const actionLabel = content.actionLabel ? escapeHtml(content.actionLabel) : null;
  const actionUrl = content.actionUrl ? escapeHtml(content.actionUrl) : null;
  const footnote = content.footnote ? escapeHtml(content.footnote) : null;

  return `
    <div style="margin:0;padding:32px 16px;background:#f6f2ea;font-family:'Segoe UI',system-ui,sans-serif;color:#173b45;">
      <div style="max-width:640px;margin:0 auto;background:#fffdf8;border:1px solid #d8d0bf;border-radius:24px;padding:32px;">
        <p style="margin:0 0 12px;font-size:14px;color:#5c7177;">${previewLabel}</p>
        <h1 style="margin:0 0 16px;font-size:32px;line-height:1.1;color:#173b45;">${heading}</h1>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#5c7177;">${intro}</p>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#5c7177;">${body}</p>
        ${actionLabel && actionUrl ? `
          <p style="margin:0 0 24px;">
            <a href="${actionUrl}" style="display:inline-block;background:#1278a6;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:700;">
              ${actionLabel}
            </a>
          </p>
          <p style="margin:0 0 8px;font-size:14px;color:#5c7177;">Si el botón no funciona, copia este enlace:</p>
          <p style="margin:0 0 24px;word-break:break-all;font-size:14px;color:#1278a6;">${actionUrl}</p>
        ` : ''}
        ${footnote ? `<p style="margin:0;font-size:13px;color:#5c7177;">${footnote}</p>` : ''}
      </div>
    </div>
  `;
}

function buildEmailText(content: MailContent) {
  return [
    content.heading,
    '',
    content.intro,
    '',
    content.body,
    content.actionLabel && content.actionUrl ? '' : null,
    content.actionLabel && content.actionUrl ? `${content.actionLabel}:` : null,
    content.actionUrl ?? null,
    content.footnote ? '' : null,
    content.footnote ?? null,
  ].filter(Boolean).join('\n');
}

async function sendMail(to: string, content: MailContent): Promise<EmailDeliveryResult> {
  const config = getSmtpConfig();

  if (!config) {
    return {
      attempted: false,
      sent: false,
      reason: 'smtp_not_configured',
    };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  try {
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject: content.subject,
      text: buildEmailText(content),
      html: buildEmailHtml(content),
    });

    return {
      attempted: true,
      sent: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No pudimos enviar el correo';
    console.error('Invitation email failed', message);

    return {
      attempted: true,
      sent: false,
      error: message,
    };
  }
}

export async function sendInvitationEmail(payload: InvitationEmailPayload): Promise<EmailDeliveryResult> {
  const expiresAt = new Date(payload.expiresAt).toLocaleDateString('es-CL');

  return sendMail(payload.invitedEmail, {
    subject: `${payload.ownerName} te invitó a Compás Hogar`,
    previewLabel: 'Compás Hogar',
    heading: `${payload.ownerName} te invitó a su hogar`,
    intro: `Queremos que ${payload.invitedEmail} se sume a ${payload.householdName} en Compás Hogar.`,
    body: `Abre el siguiente enlace, inicia sesión o crea tu cuenta con ese mismo email y acepta la invitación.`,
    actionLabel: 'Aceptar invitación',
    actionUrl: payload.invitationUrl,
    footnote: `Este enlace vence el ${expiresAt}.`,
  });
}

export interface SubscriptionLifecycleEmailPayload {
  recipientEmail: string;
  householdName: string;
  planName: string;
  billingCycleLabel: string;
  manageUrl: string;
  type: 'activated' | 'payment_issue' | 'cancelled';
}

export async function sendSubscriptionLifecycleEmail(
  payload: SubscriptionLifecycleEmailPayload,
): Promise<EmailDeliveryResult> {
  const contentByType: Record<SubscriptionLifecycleEmailPayload['type'], MailContent> = {
    activated: {
      subject: `Tu plan ${payload.planName} ya está activo en Compás Hogar`,
      previewLabel: 'Compás Hogar',
      heading: 'Tu suscripción quedó activa',
      intro: `${payload.householdName} ya tiene acceso al plan ${payload.planName}.`,
      body: `El ciclo actual es ${payload.billingCycleLabel}. Ya puedes usar las funciones incluidas en tu plan desde la pantalla de suscripción.`,
      actionLabel: 'Ver mi plan',
      actionUrl: payload.manageUrl,
    },
    payment_issue: {
      subject: `Hubo un problema con el cobro de ${payload.householdName}`,
      previewLabel: 'Compás Hogar',
      heading: 'No pudimos confirmar el último cobro',
      intro: `${payload.householdName} necesita revisar el estado de su suscripción.`,
      body: 'Abre la pantalla de suscripción para verificar el cobro, sincronizar el estado o volver a iniciar el checkout si hace falta.',
      actionLabel: 'Revisar suscripción',
      actionUrl: payload.manageUrl,
    },
    cancelled: {
      subject: `La suscripción de ${payload.householdName} fue cancelada`,
      previewLabel: 'Compás Hogar',
      heading: 'Tu plan quedó cancelado',
      intro: `${payload.householdName} volvió al plan Free.`,
      body: 'Puedes seguir entrando a la app y reactivar un plan más adelante desde la pantalla de suscripción.',
      actionLabel: 'Ver suscripción',
      actionUrl: payload.manageUrl,
    },
  };

  return sendMail(payload.recipientEmail, contentByType[payload.type]);
}
