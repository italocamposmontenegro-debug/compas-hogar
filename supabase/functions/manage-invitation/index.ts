import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { requireOperationalOwnerHouseholdId } from '../_shared/current-household.ts';
import { sendInvitationEmail } from '../_shared/email.ts';

const supabase = createServiceClient();
const MAX_HOUSEHOLD_MEMBERS = 2;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Action = 'get' | 'create' | 'refresh' | 'revoke' | 'send';

function normalizeBaseUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Base URL requerida');
  }

  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Base URL no válida');
  }

  return url.toString().replace(/\/$/, '');
}

function buildInvitationUrl(baseUrl: string, token: string) {
  return `${baseUrl}/invitacion/${token}`;
}

function formatInvitation(invitation: Record<string, unknown>, baseUrl: string) {
  return {
    ...invitation,
    invitation_url: buildInvitationUrl(baseUrl, String(invitation.token)),
  };
}

function generateInvitationToken() {
  return crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
}

async function getOwnerMembership(userId: string) {
  return requireOperationalOwnerHouseholdId(
    supabase,
    userId,
    'Solo el owner del hogar puede gestionar invitaciones',
  );
}

async function getAcceptedMembersCount(householdId: string) {
  const { count, error } = await supabase
    .from('household_members')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .eq('invitation_status', 'accepted');

  if (error) throw error;
  return count ?? 0;
}

async function getPendingInvitation(householdId: string) {
  const { data, error } = await supabase
    .from('invitation_tokens')
    .select('*')
    .eq('household_id', householdId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getInvitationById(householdId: string, invitationId: string) {
  const { data, error } = await supabase
    .from('invitation_tokens')
    .select('*')
    .eq('id', invitationId)
    .eq('household_id', householdId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getHouseholdName(householdId: string) {
  const { data, error } = await supabase
    .from('households')
    .select('name')
    .eq('id', householdId)
    .maybeSingle();

  if (error) throw error;
  return data?.name ?? 'tu hogar';
}

async function revokePendingInvitations(householdId: string) {
  const { error } = await supabase
    .from('invitation_tokens')
    .update({ status: 'revoked' })
    .eq('household_id', householdId)
    .eq('status', 'pending');

  if (error) throw error;
}

async function createInvitation(householdId: string, invitedEmail: string) {
  const normalizedEmail = invitedEmail.trim().toLowerCase();

  const acceptedMembersCount = await getAcceptedMembersCount(householdId);
  if (acceptedMembersCount >= MAX_HOUSEHOLD_MEMBERS) {
    throw new Error('Tu hogar ya alcanzó el máximo de miembros.');
  }

  const { data: existingAcceptedMember, error: memberError } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', householdId)
    .eq('email', normalizedEmail)
    .eq('invitation_status', 'accepted')
    .maybeSingle();

  if (memberError) throw memberError;
  if (existingAcceptedMember) {
    throw new Error('Ese email ya pertenece a un miembro activo del hogar.');
  }

  await revokePendingInvitations(householdId);

  const { data, error } = await supabase
    .from('invitation_tokens')
    .insert({
      household_id: householdId,
      token: generateInvitationToken(),
      invited_email: normalizedEmail,
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('No pudimos crear la invitación');

  return data;
}

async function deliverInvitationEmail(
  invitation: Record<string, unknown>,
  householdId: string,
  baseUrl: string,
  ownerName: string,
) {
  const householdName = await getHouseholdName(householdId);
  const invitationUrl = buildInvitationUrl(baseUrl, String(invitation.token));

  const emailDelivery = await sendInvitationEmail({
    invitedEmail: String(invitation.invited_email),
    invitationUrl,
    householdName,
    ownerName,
    expiresAt: String(invitation.expires_at),
  });

  return {
    invitation: {
      ...invitation,
      invitation_url: invitationUrl,
    },
    email_delivery: emailDelivery,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) throw new Error('Unauthorized');

    const { action, invitedEmail, invitationId, baseUrl } = await req.json() as {
      action: Action;
      invitedEmail?: string;
      invitationId?: string;
      baseUrl?: string;
    };

    const householdId = await getOwnerMembership(user.id);
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const ownerName =
      user.user_metadata?.full_name
      || user.user_metadata?.name
      || user.email
      || 'Tu pareja';

    if (action === 'get') {
      const pendingInvitation = await getPendingInvitation(householdId);
      const acceptedMembersCount = await getAcceptedMembersCount(householdId);

      return new Response(JSON.stringify({
        pending_invitation: pendingInvitation ? formatInvitation(pendingInvitation, normalizedBaseUrl) : null,
        accepted_members_count: acceptedMembersCount,
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (action === 'create') {
      if (!invitedEmail) throw new Error('Email requerido');
      if ((user.email ?? '').toLowerCase() === invitedEmail.trim().toLowerCase()) {
        throw new Error('No puedes invitar tu propio email.');
      }

      const invitation = await createInvitation(householdId, invitedEmail);
      const payload = await deliverInvitationEmail(invitation, householdId, normalizedBaseUrl, ownerName);

      return new Response(JSON.stringify(payload), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (action === 'refresh') {
      const currentInvitation = invitationId
        ? await supabase
          .from('invitation_tokens')
          .select('*')
          .eq('id', invitationId)
          .eq('household_id', householdId)
          .maybeSingle()
        : { data: await getPendingInvitation(householdId), error: null };

      if (currentInvitation.error || !currentInvitation.data) {
        throw new Error('No encontramos la invitación para renovarla.');
      }

      const invitation = await createInvitation(householdId, currentInvitation.data.invited_email);
      const payload = await deliverInvitationEmail(invitation, householdId, normalizedBaseUrl, ownerName);

      return new Response(JSON.stringify(payload), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (action === 'send') {
      const invitation = invitationId
        ? await getInvitationById(householdId, invitationId)
        : await getPendingInvitation(householdId);

      if (!invitation) {
        throw new Error('No encontramos la invitación para enviarla.');
      }

      if (invitation.status !== 'pending') {
        throw new Error('Solo podemos enviar invitaciones que sigan pendientes.');
      }

      const payload = await deliverInvitationEmail(invitation, householdId, normalizedBaseUrl, ownerName);

      return new Response(JSON.stringify(payload), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (action === 'revoke') {
      if (!invitationId) throw new Error('Invitación requerida');

      const { error } = await supabase
        .from('invitation_tokens')
        .update({ status: 'revoked' })
        .eq('id', invitationId)
        .eq('household_id', householdId)
        .eq('status', 'pending');

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    throw new Error('Acción no soportada');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: message === 'Unauthorized' ? 401 : 400,
    });
  }
});
