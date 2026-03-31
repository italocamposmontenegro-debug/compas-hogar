-- ==========================================
-- Compás Hogar - Household resolution v1
-- ==========================================

CREATE OR REPLACE FUNCTION public.resolve_current_household_context(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  membership_id UUID,
  household_id UUID,
  role TEXT,
  display_name TEXT,
  email TEXT,
  monthly_income INTEGER,
  household_name TEXT,
  subscription_id UUID,
  subscription_status TEXT,
  subscription_plan_code TEXT,
  subscription_billing_cycle TEXT,
  accepted_household_count INTEGER,
  active_household_count INTEGER,
  resolution_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_accepted_count INTEGER := 0;
  v_active_count INTEGER := 0;
BEGIN
  WITH accepted_candidates AS (
    SELECT
      hm.id AS membership_id,
      hm.household_id,
      hm.role,
      hm.display_name,
      hm.email,
      hm.monthly_income,
      h.name AS household_name,
      sub.id AS subscription_id,
      sub.status AS subscription_status,
      sub.plan_code AS subscription_plan_code,
      sub.billing_cycle AS subscription_billing_cycle
    FROM public.household_members hm
    JOIN public.households h
      ON h.id = hm.household_id
    LEFT JOIN LATERAL (
      SELECT
        s.id,
        s.status,
        s.plan_code,
        s.billing_cycle
      FROM public.subscriptions s
      WHERE s.household_id = hm.household_id
      ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC, s.id DESC
      LIMIT 1
    ) sub ON TRUE
    WHERE hm.user_id = p_user_id
      AND hm.invitation_status = 'accepted'
  )
  SELECT COUNT(*)
    INTO v_accepted_count
  FROM accepted_candidates;

  IF v_accepted_count = 0 THEN
    RETURN;
  END IF;

  WITH accepted_candidates AS (
    SELECT
      hm.id AS membership_id,
      hm.household_id,
      hm.role,
      hm.display_name,
      hm.email,
      hm.monthly_income,
      h.name AS household_name,
      sub.id AS subscription_id,
      sub.status AS subscription_status,
      sub.plan_code AS subscription_plan_code,
      sub.billing_cycle AS subscription_billing_cycle
    FROM public.household_members hm
    JOIN public.households h
      ON h.id = hm.household_id
    LEFT JOIN LATERAL (
      SELECT
        s.id,
        s.status,
        s.plan_code,
        s.billing_cycle
      FROM public.subscriptions s
      WHERE s.household_id = hm.household_id
      ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC, s.id DESC
      LIMIT 1
    ) sub ON TRUE
    WHERE hm.user_id = p_user_id
      AND hm.invitation_status = 'accepted'
  )
  SELECT COUNT(*)
    INTO v_active_count
  FROM accepted_candidates
  WHERE subscription_status = 'active';

  IF v_active_count > 1 THEN
    RAISE EXCEPTION 'Tu cuenta tiene más de un hogar con suscripción activa. Compás Hogar v1 admite un solo hogar operativo por usuario.';
  END IF;

  IF v_active_count = 1 THEN
    RETURN QUERY
    WITH accepted_candidates AS (
      SELECT
        hm.id AS membership_id,
        hm.household_id,
        hm.role,
        hm.display_name,
        hm.email,
        hm.monthly_income,
        h.name AS household_name,
        sub.id AS subscription_id,
        sub.status AS subscription_status,
        sub.plan_code AS subscription_plan_code,
        sub.billing_cycle AS subscription_billing_cycle
      FROM public.household_members hm
      JOIN public.households h
        ON h.id = hm.household_id
      LEFT JOIN LATERAL (
        SELECT
          s.id,
          s.status,
          s.plan_code,
          s.billing_cycle
        FROM public.subscriptions s
        WHERE s.household_id = hm.household_id
        ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC, s.id DESC
        LIMIT 1
      ) sub ON TRUE
      WHERE hm.user_id = p_user_id
        AND hm.invitation_status = 'accepted'
    )
    SELECT
      membership_id,
      household_id,
      role,
      display_name,
      email,
      monthly_income,
      household_name,
      subscription_id,
      subscription_status,
      subscription_plan_code,
      subscription_billing_cycle,
      v_accepted_count AS accepted_household_count,
      v_active_count AS active_household_count,
      'single_active_subscription'::TEXT AS resolution_reason
    FROM accepted_candidates
    WHERE subscription_status = 'active'
    LIMIT 1;

    RETURN;
  END IF;

  IF v_accepted_count = 1 THEN
    RETURN QUERY
    WITH accepted_candidates AS (
      SELECT
        hm.id AS membership_id,
        hm.household_id,
        hm.role,
        hm.display_name,
        hm.email,
        hm.monthly_income,
        h.name AS household_name,
        sub.id AS subscription_id,
        sub.status AS subscription_status,
        sub.plan_code AS subscription_plan_code,
        sub.billing_cycle AS subscription_billing_cycle
      FROM public.household_members hm
      JOIN public.households h
        ON h.id = hm.household_id
      LEFT JOIN LATERAL (
        SELECT
          s.id,
          s.status,
          s.plan_code,
          s.billing_cycle
        FROM public.subscriptions s
        WHERE s.household_id = hm.household_id
        ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC, s.id DESC
        LIMIT 1
      ) sub ON TRUE
      WHERE hm.user_id = p_user_id
        AND hm.invitation_status = 'accepted'
    )
    SELECT
      membership_id,
      household_id,
      role,
      display_name,
      email,
      monthly_income,
      household_name,
      subscription_id,
      subscription_status,
      subscription_plan_code,
      subscription_billing_cycle,
      v_accepted_count AS accepted_household_count,
      v_active_count AS active_household_count,
      'single_accepted_membership'::TEXT AS resolution_reason
    FROM accepted_candidates
    LIMIT 1;

    RETURN;
  END IF;

  RAISE EXCEPTION 'Tu cuenta tiene más de un hogar aceptado. Compás Hogar v1 admite un solo hogar operativo por usuario.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_current_household_context(UUID) TO authenticated;

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

  SELECT rc.household_id
    INTO v_existing_household_id
  FROM public.resolve_current_household_context(v_user_id) rc
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_household_members_single_operational_household
  ON public.household_members(user_id)
  WHERE user_id IS NOT NULL AND invitation_status = 'accepted';
