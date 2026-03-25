import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase.ts';

const supabase = createServiceClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });

  try {
    const { token } = await req.json() as { token?: string };
    if (!token) throw new Error('Token requerido');

    const { data: invitation, error } = await supabase
      .from('invitation_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error || !invitation) {
      return new Response(JSON.stringify({ status: 'invalid' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const now = new Date();
    let status = invitation.status;

    if (status === 'pending' && new Date(invitation.expires_at) < now) {
      await supabase
        .from('invitation_tokens')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      status = 'expired';
    }

    const { data: householdData } = await supabase
      .from('households')
      .select('name')
      .eq('id', invitation.household_id)
      .maybeSingle();

    return new Response(JSON.stringify({
      status,
      invited_email: invitation.invited_email,
      expires_at: invitation.expires_at,
      household_name: householdData?.name ?? 'el hogar',
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
