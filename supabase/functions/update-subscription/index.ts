import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN_SANDBOX')!;
const DB_URL = Deno.env.get('SUPABASE_URL')!;
const DB_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(DB_URL, DB_SERVICE_KEY);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) throw new Error('Unauthorized');

    const { household_id, plan_code, billing_cycle } = await req.json();

    // Verificación de ownership
    const { data: householdMember } = await supabase.from('household_members').select('role').eq('household_id', household_id).eq('user_id', user.id).single();
    if (!householdMember || householdMember.role !== 'owner') {
      throw new Error('Solo el owner puede modificar la suscripción nativa.');
    }

    const { data: sub } = await supabase.from('subscriptions').select('provider_subscription_id').eq('household_id', household_id).single();
    if (!sub?.provider_subscription_id) {
      throw new Error('Suscripción activa no encontrada');
    }

    const planEnvKey = `MP_PLAN_${plan_code.toUpperCase()}_${billing_cycle.toUpperCase()}`;
    const newPreapprovalPlanId = Deno.env.get(planEnvKey);
    if (!newPreapprovalPlanId) throw new Error('Nuevo plan no configurado');

    // Muta el preapproval directo para upgrade/downgrade
    const mpResp = await fetch(`https://api.mercadopago.com/preapproval/${sub.provider_subscription_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        preapproval_plan_id: newPreapprovalPlanId,
        reason: `Upgrade/Downgrade a ${plan_code} ${billing_cycle}`
      })
    });

    const mpData = await mpResp.json();
    if (!mpResp.ok) throw new Error(mpData.message || 'Error actualizando preapproval en MP');

    return new Response(JSON.stringify({ success: true }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 400 });
  }
});
