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

    // Obtener configuración de billing (Planes de preapproval_plan_id generados previamente en MP)
    // Puede venir via DB desde billing_provider_configs o Variables de Entorno.
    // Para efectos de escalabilidad de Mercado Pago Subscriptions nativas usamos variables inyectadas.
    const planEnvKey = `MP_PLAN_${plan_code.toUpperCase()}_${billing_cycle.toUpperCase()}`;
    const preapprovalPlanId = Deno.env.get(planEnvKey);

    if (!preapprovalPlanId) {
      throw new Error(`Configuración de Plan (preapproval_plan_id) no encontrada en entorno: ${planEnvKey}`);
    }

    // Preparar el Payload para Mercado Pago Subscriptions Api (/preapproval)
    const preapprovalData = {
      preapproval_plan_id: preapprovalPlanId,
      payer_email: user.email,
      back_url: 'https://casaclara.app/app/suscripcion?status=success',
      reason: `Suscripción ${plan_code} ${billing_cycle} - Casa Clara`,
      external_reference: household_id, // clave para machear en el webhook al hogar exacto
      status: 'pending' // pending autoriza el checkout para captar la tarjeta
    };

    const mpResp = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
      },
      body: JSON.stringify(preapprovalData)
    });

    const mpData = await mpResp.json();
    if (!mpResp.ok) throw new Error(mpData.message || 'Error creando preapproval');

    // La respuesta en preapprovals nativos devuelve un init_point 
    return new Response(JSON.stringify({ 
      id: mpData.id, 
      init_point: mpData.init_point
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Create subscription error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
