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
  const fromName = Deno.env.get('SMTP_FROM_NAME')?.trim() || 'Casa Clara';

  if (!host || !portRaw || !user || !pass || !fromEmail) {
    return null;
  }

  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    return null;
  }

  return { host, port, user, pass, fromEmail, fromName };
}

function buildInvitationHtml(payload: InvitationEmailPayload) {
  const ownerName = escapeHtml(payload.ownerName);
  const householdName = escapeHtml(payload.householdName);
  const invitedEmail = escapeHtml(payload.invitedEmail);
  const invitationUrl = escapeHtml(payload.invitationUrl);
  const expiresAt = new Date(payload.expiresAt).toLocaleDateString('es-CL');

  return `
    <div style="margin:0;padding:32px 16px;background:#f6f2ea;font-family:'Segoe UI',system-ui,sans-serif;color:#173b45;">
      <div style="max-width:640px;margin:0 auto;background:#fffdf8;border:1px solid #d8d0bf;border-radius:24px;padding:32px;">
        <p style="margin:0 0 12px;font-size:14px;color:#5c7177;">Casa Clara</p>
        <h1 style="margin:0 0 16px;font-size:32px;line-height:1.1;color:#173b45;">${ownerName} te invitó a su hogar</h1>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#5c7177;">
          Queremos que <strong>${invitedEmail}</strong> se sume a <strong>${householdName}</strong> en Casa Clara.
        </p>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#5c7177;">
          Abre el siguiente enlace, inicia sesión o crea tu cuenta con ese mismo email y acepta la invitación.
        </p>
        <p style="margin:0 0 24px;">
          <a href="${invitationUrl}" style="display:inline-block;background:#1278a6;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:700;">
            Aceptar invitación
          </a>
        </p>
        <p style="margin:0 0 8px;font-size:14px;color:#5c7177;">Si el botón no funciona, copia este enlace:</p>
        <p style="margin:0 0 24px;word-break:break-all;font-size:14px;color:#1278a6;">${invitationUrl}</p>
        <p style="margin:0;font-size:13px;color:#5c7177;">Este enlace vence el ${expiresAt}.</p>
      </div>
    </div>
  `;
}

function buildInvitationText(payload: InvitationEmailPayload) {
  const expiresAt = new Date(payload.expiresAt).toLocaleDateString('es-CL');
  return [
    `${payload.ownerName} te invitó a unirte a ${payload.householdName} en Casa Clara.`,
    '',
    `Abre este enlace, inicia sesión o crea tu cuenta con ${payload.invitedEmail} y acepta la invitación:`,
    payload.invitationUrl,
    '',
    `Este enlace vence el ${expiresAt}.`,
  ].join('\n');
}

export async function sendInvitationEmail(payload: InvitationEmailPayload): Promise<EmailDeliveryResult> {
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
      to: payload.invitedEmail,
      subject: `${payload.ownerName} te invitó a Casa Clara`,
      text: buildInvitationText(payload),
      html: buildInvitationHtml(payload),
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
