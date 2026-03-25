import { supabase } from './supabase';

export async function syncRecurringItems(householdId: string) {
  const { error, data } = await supabase.functions.invoke('sync-recurring-items', {
    body: { householdId },
  });

  if (error) throw error;
  return data;
}
