-- ==========================================
-- Casa Clara - RLS Policies
-- ==========================================

-- Enable RLS maps
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_calendar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_provider_configs ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can edit their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. HOUSEHOLDS
CREATE POLICY "Members can view their households" ON public.households FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_members.household_id = households.id
    AND household_members.user_id = auth.uid()
    AND household_members.invitation_status = 'accepted'
  )
);
CREATE POLICY "Owners can update their households" ON public.households FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_members.household_id = households.id
    AND household_members.user_id = auth.uid()
    AND household_members.role = 'owner'
  )
);
CREATE POLICY "Authenticated users can create households" ON public.households FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 3. HOUSEHOLD MEMBERS
CREATE POLICY "Members can view members of same household" ON public.household_members FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.household_members AS me
    WHERE me.household_id = household_members.household_id
    AND me.user_id = auth.uid()
  )
);
CREATE POLICY "Authenticated users can create member for themselves" ON public.household_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update members" ON public.household_members FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.household_members AS me
    WHERE me.household_id = household_members.household_id
    AND me.user_id = auth.uid()
    AND me.role = 'owner'
  )
);

-- 4. SUBSCRIPTIONS
CREATE POLICY "Members can view household subscription" ON public.subscriptions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_members.household_id = subscriptions.household_id
    AND household_members.user_id = auth.uid()
  )
);
-- Mutaciones en subscriptions están reservadas a service_role (Edge Functions) excepto insert inicial seguro.

-- 5 a 11. TABLAS COMUNES (Transacciones, Metas, Categorías, etc.)
-- Helper policy for full CRUD for accepted members
DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN SELECT unnest(ARRAY[
    'categories', 'transactions', 'recurring_transactions', 
    'payment_calendar_items', 'savings_goals', 'monthly_reviews', 'csv_imports'
  ])
  LOOP
    EXECUTE format('
      CREATE POLICY "Members can select from %1$I" ON public.%1$I FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.household_members WHERE household_id = %1$I.household_id AND user_id = auth.uid() AND invitation_status = ''accepted'')
      );
      CREATE POLICY "Members can insert to %1$I" ON public.%1$I FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.household_members WHERE household_id = %1$I.household_id AND user_id = auth.uid() AND invitation_status = ''accepted'')
      );
      CREATE POLICY "Members can update %1$I" ON public.%1$I FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.household_members WHERE household_id = %1$I.household_id AND user_id = auth.uid() AND invitation_status = ''accepted'')
      );
      CREATE POLICY "Members can delete from %1$I" ON public.%1$I FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.household_members WHERE household_id = %1$I.household_id AND user_id = auth.uid() AND invitation_status = ''accepted'')
      );
    ', table_name);
  END LOOP;
END
$$;

-- 12. INVITATION TOKENS
CREATE POLICY "Users can create invitations for their household" ON public.invitation_tokens FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.household_members WHERE household_id = invitation_tokens.household_id AND user_id = auth.uid() AND role = 'owner')
);
CREATE POLICY "Invited users can view their token via edge function mostly, or by matching email" ON public.invitation_tokens FOR SELECT USING (
  invited_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.household_members WHERE household_id = invitation_tokens.household_id AND user_id = auth.uid())
);

-- Las tablas webhook_events, audit_logs y billing_provider_configs no tienen políticas genéricas públicas,
-- solo accesibles para Postgres/Service Role.
