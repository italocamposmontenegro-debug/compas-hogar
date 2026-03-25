-- ==========================================
-- Casa Clara - Runtime fixes
-- ==========================================

-- Idempotency for Mercado Pago webhooks.
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_external_id_unique
  ON public.webhook_events(provider, external_event_id);

-- Fast helper for guards and future server logic.
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE household_id = p_household_id
      AND status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(UUID) TO authenticated;

-- Onboarding bootstrap used by the client flow.
CREATE OR REPLACE FUNCTION public.create_household_setup(
  p_name TEXT,
  p_split_rule TEXT DEFAULT 'fifty_fifty',
  p_monthly_income INTEGER DEFAULT 0,
  p_goal_name TEXT DEFAULT NULL,
  p_goal_amount INTEGER DEFAULT 0,
  p_goal_date DATE DEFAULT NULL,
  p_partner_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing_household_id UUID;
  v_household_id UUID;
  v_owner_name TEXT;
  v_owner_email TEXT;
  v_split_rule TEXT;
  v_goal_name TEXT := NULLIF(BTRIM(p_goal_name), '');
  v_partner_email TEXT := NULLIF(BTRIM(p_partner_email), '');
  v_goal_date DATE := COALESCE(p_goal_date, (CURRENT_DATE + INTERVAL '6 months')::DATE);
  v_invitation_token TEXT;
  v_invitation_token_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT hm.household_id
    INTO v_existing_household_id
  FROM public.household_members hm
  WHERE hm.user_id = v_user_id
    AND hm.invitation_status = 'accepted'
  ORDER BY hm.created_at DESC
  LIMIT 1;

  IF v_existing_household_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'household_id', v_existing_household_id,
      'invitation_token_id', NULL
    );
  END IF;

  SELECT
    COALESCE(p.full_name, split_part(a.email, '@', 1), 'Usuario'),
    COALESCE(p.email, a.email)
  INTO v_owner_name, v_owner_email
  FROM auth.users a
  LEFT JOIN public.profiles p ON p.id = a.id
  WHERE a.id = v_user_id;

  IF v_owner_email IS NULL THEN
    RAISE EXCEPTION 'No se pudo resolver el email del usuario';
  END IF;

  v_split_rule := LOWER(COALESCE(NULLIF(BTRIM(p_split_rule), ''), 'fifty_fifty'));
  IF v_split_rule = '50_50' THEN
    v_split_rule := 'fifty_fifty';
  END IF;
  IF v_split_rule NOT IN ('fifty_fifty', 'proportional', 'fixed_amount', 'custom_percent') THEN
    v_split_rule := 'fifty_fifty';
  END IF;

  INSERT INTO public.households (
    name,
    split_rule_type,
    split_rule_config,
    currency,
    timezone,
    created_by
  ) VALUES (
    p_name,
    v_split_rule,
    '{}'::jsonb,
    'CLP',
    'America/Santiago',
    v_user_id
  )
  RETURNING id INTO v_household_id;

  INSERT INTO public.household_members (
    household_id,
    user_id,
    role,
    display_name,
    email,
    monthly_income,
    invited_by,
    invitation_status
  ) VALUES (
    v_household_id,
    v_user_id,
    'owner',
    v_owner_name,
    v_owner_email,
    COALESCE(p_monthly_income, 0),
    NULL,
    'accepted'
  );

  INSERT INTO public.categories (household_id, name, icon, color, is_default, sort_order)
  VALUES
    (v_household_id, 'Supermercado', '🛒', '#059669', true, 0),
    (v_household_id, 'Vivienda', '🏠', '#2563EB', true, 1),
    (v_household_id, 'Servicios básicos', '💡', '#D97706', true, 2),
    (v_household_id, 'Transporte', '🚗', '#7C3AED', true, 3),
    (v_household_id, 'Salud', '❤️', '#DC2626', true, 4),
    (v_household_id, 'Educación', '📚', '#0891B2', true, 5),
    (v_household_id, 'Ocio', '🎬', '#DB2777', true, 6),
    (v_household_id, 'Suscripciones', '📱', '#6366F1', true, 7),
    (v_household_id, 'Mascotas', '🐾', '#EA580C', true, 8),
    (v_household_id, 'Ahorro', '💰', '#16A34A', true, 9),
    (v_household_id, 'Otros', '📦', '#6B7280', true, 10);

  IF v_goal_name IS NOT NULL AND p_goal_amount > 0 THEN
    INSERT INTO public.savings_goals (
      household_id,
      name,
      target_amount_clp,
      current_amount_clp,
      target_date,
      is_primary,
      status
    ) VALUES (
      v_household_id,
      v_goal_name,
      p_goal_amount,
      0,
      v_goal_date,
      true,
      'active'
    );
  END IF;

  IF v_partner_email IS NOT NULL THEN
    v_invitation_token := replace(uuid_generate_v4()::text, '-', '') || replace(uuid_generate_v4()::text, '-', '');

    INSERT INTO public.invitation_tokens (
      household_id,
      token,
      invited_email,
      invited_by,
      status,
      expires_at
    ) VALUES (
      v_household_id,
      v_invitation_token,
      v_partner_email,
      v_user_id,
      'pending',
      NOW() + INTERVAL '7 days'
    )
    RETURNING id INTO v_invitation_token_id;
  END IF;

  RETURN jsonb_build_object(
    'household_id', v_household_id,
    'invitation_token_id', v_invitation_token_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_household_setup(TEXT, TEXT, INTEGER, TEXT, INTEGER, DATE, TEXT) TO authenticated;
