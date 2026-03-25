import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

export function createServiceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    throw new Error('Missing Supabase service credentials');
  }

  return createClient(url, key);
}
