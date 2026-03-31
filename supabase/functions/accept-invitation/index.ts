import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { listAcceptedHouseholdIds } from '../_shared/current-household.ts';

const supabase = createServiceClient();
const MAX_HOUSEHOLD_MEMBERS = 2;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { token } = await req.json();
    if (!token) throw new Error('Token requerido');

    const { data: invitation, error: invitationError } = await supabase
      .from('invitation_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (invitationError || !invitation) {
      throw new Error('La invitacion no existe o ya no es valida');
    }

    const now = new Date();
    if (new Date(invitation.expires_at) < now) {
      await supabase
        .from('invitation_tokens')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      throw new Error('Esta invitacion ha expirado');
    }

    if (invitation.status === 'revoked') {
      throw new Error('Esta invitacion fue revocada');
    }

    const invitedEmail = invitation.invited_email.toLowerCase();
    const userEmail = (user.email ?? '').toLowerCase();
    if (invitedEmail !== userEmail) {
      throw new Error('Esta invitacion no corresponde a tu cuenta');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    const displayName =
      profile?.full_name
      || user.user_metadata?.full_name
      || user.email
      || invitation.invited_email;

    const acceptedHouseholdIds = await listAcceptedHouseholdIds(supabase, user.id);
    const alreadyAcceptedInTargetHousehold = acceptedHouseholdIds.includes(invitation.household_id);
    const hasAcceptedHouseholdConflict = acceptedHouseholdIds.some((householdId) => householdId !== invitation.household_id);

    if (hasAcceptedHouseholdConflict) {
      throw new Error('Tu cuenta ya pertenece a otro hogar. Usa otra cuenta o sal de ese hogar antes de aceptar esta invitación.');
    }

    const { count: acceptedMembersCount, error: countError } = await supabase
      .from('household_members')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', invitation.household_id)
      .eq('invitation_status', 'accepted');

    if (countError) throw countError;
    if (!alreadyAcceptedInTargetHousehold && (acceptedMembersCount ?? 0) >= MAX_HOUSEHOLD_MEMBERS) {
      throw new Error('Este hogar ya alcanzó el máximo de miembros.');
    }

    if (!alreadyAcceptedInTargetHousehold) {
      const { error: memberError } = await supabase.from('household_members').upsert(
        {
          household_id: invitation.household_id,
          user_id: user.id,
          role: 'member',
          display_name: displayName,
          email: user.email ?? invitation.invited_email,
          monthly_income: 0,
          invited_by: invitation.invited_by,
          invitation_status: 'accepted',
        },
        { onConflict: 'household_id,email' },
      );

      if (memberError) throw memberError;
    }

    const { error: invitationUpdateError } = await supabase
      .from('invitation_tokens')
      .update({
        status: 'accepted',
        accepted_at: now.toISOString(),
      })
      .eq('id', invitation.id);

    if (invitationUpdateError) throw invitationUpdateError;

    return new Response(JSON.stringify({ success: true, household_id: invitation.household_id }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: message === 'Unauthorized' ? 401 : 400,
    });
  }
});
