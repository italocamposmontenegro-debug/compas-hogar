const FALLBACK_HOUSEHOLD_NAME = 'tu hogar';

type SupabaseAdminClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq?: never;
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
        order: (column: string, options: { ascending: boolean }) => {
          limit: (value: number) => {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
          };
        };
      };
      in?: never;
    };
  };
};

export async function getHouseholdName(
  supabase: SupabaseAdminClient,
  householdId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('households')
    .select('name')
    .eq('id', householdId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return typeof data?.name === 'string' && data.name.trim()
    ? data.name
    : FALLBACK_HOUSEHOLD_NAME;
}

export async function getHouseholdOwnerContact(
  supabase: SupabaseAdminClient,
  householdId: string,
): Promise<{ email: string | null; name: string }> {
  const { data, error } = await supabase
    .from('household_members')
    .select('display_name, email')
    .eq('household_id', householdId)
    .eq('role', 'owner')
    .eq('invitation_status', 'accepted')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const email = typeof data?.email === 'string' && data.email.trim() ? data.email : null;
  const name = typeof data?.display_name === 'string' && data.display_name.trim()
    ? data.display_name
    : email ?? 'Owner del hogar';

  return { email, name };
}
