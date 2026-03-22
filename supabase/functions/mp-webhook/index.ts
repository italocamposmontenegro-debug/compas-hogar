import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN_SANDBOX')!;
const DB_URL = Deno.env.get('SUPABASE_URL')!;
const DB_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(DB_URL, DB_SERVICE_KEY);

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('data.id') || url.searchParams.get('id');
    const type = url.searchParams.get('type') || url.searchParams.get('topic');

    // Clave de idempotencia validando que sea inmutable.
    const idempotencyKey = `${type}:${action}`;
    const body = await req.json();

    const { data: webhookEvent, error: insertError } = await supabase
      .from('webhook_events')
      .insert({
        provider: 'mercadopago',
        external_event_id: idempotencyKey,
        event_type: type || 'unknown',
        resource_id: action,
        payload_raw: body,
        processing_status: 'received'
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') return new Response('Already processed', { status: 200 });
      throw insertError;
    }

    // Mercado Pago Preapproval Events type es "subscription_preapproval"
    if (type === 'subscription_preapproval' && action) {
      
      // Consultamos a MP la preapproval real para hidratar data confiable (estado real del proveedor)
      const mpResp = await fetch(`https://api.mercadopago.com/preapproval/${action}`, {
        headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
      });
      
      if (!mpResp.ok) throw new Error('No se pudo verificar el preapproval real');
      const preapprovalData = await mpResp.json();
      
      // external_reference inyectamos household_id en su creación
      const householdId = preapprovalData.external_reference; 
      const mpStatus = preapprovalData.status;

      if (householdId) {
        let newStatus = 'pending';
        // 'authorized' es activo y con pago exitoso
        if (mpStatus === 'authorized') newStatus = 'active';
        else if (mpStatus === 'cancelled') newStatus = 'cancelled';
        // Corrección exigida: usar 'inactive' para pause
        else if (mpStatus === 'paused') newStatus = 'inactive';

        const { error: subErr } = await supabase
          .from('subscriptions')
          .update({ 
            status: newStatus,
            provider_subscription_id: preapprovalData.id,
            last_payment_status: mpStatus,
            updated_at: new Date().toISOString()
          })
          .eq('household_id', householdId);

        if (!subErr) {
          await supabase.from('webhook_events').update({ processing_status: 'processed', processed_at: new Date().toISOString() }).eq('id', webhookEvent.id);
        } else {
           throw subErr;
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' }, status: 200 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { 'Content-Type': 'application/json' }, status: 400 });
  }
});
