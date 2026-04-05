-- ==========================================
-- Compas Hogar - Product refactor foundations
-- ==========================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS flow_type TEXT,
  ADD COLUMN IF NOT EXISTS affects_household_balance BOOLEAN,
  ADD COLUMN IF NOT EXISTS balance_excluded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS balance_adjusted_manually BOOLEAN,
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.savings_goals(id) ON DELETE SET NULL;

UPDATE public.transactions
SET
  flow_type = CASE
    WHEN type = 'income' THEN 'income'
    WHEN category_id IN (
      SELECT id
      FROM public.categories
      WHERE LOWER(name) IN ('ahorro', 'ahorro libre', 'fondo de emergencia', 'meta del hogar', 'inversion', 'inversión')
    ) THEN 'ahorro'
    WHEN category_id IN (
      SELECT id
      FROM public.categories
      WHERE LOWER(name) IN ('ocio', 'salidas')
    ) THEN 'ocio'
    WHEN category_id IN (
      SELECT id
      FROM public.categories
      WHERE LOWER(name) IN ('imprevistos', 'imprevisto')
    ) THEN 'imprevisto'
    WHEN expense_type = 'fixed' THEN 'pago_obligatorio'
    ELSE 'gasto_variable'
  END,
  affects_household_balance = CASE
    WHEN type <> 'expense' THEN false
    WHEN scope <> 'shared' THEN false
    ELSE true
  END,
  balance_adjusted_manually = COALESCE(balance_adjusted_manually, false)
WHERE flow_type IS NULL
   OR affects_household_balance IS NULL
   OR balance_adjusted_manually IS NULL;

ALTER TABLE public.transactions
  ALTER COLUMN flow_type SET DEFAULT 'gasto_variable',
  ALTER COLUMN flow_type SET NOT NULL,
  ALTER COLUMN affects_household_balance SET DEFAULT false,
  ALTER COLUMN affects_household_balance SET NOT NULL,
  ALTER COLUMN balance_adjusted_manually SET DEFAULT false,
  ALTER COLUMN balance_adjusted_manually SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transactions_flow_type_check'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_flow_type_check
      CHECK (
        flow_type IN (
          'income',
          'pago_obligatorio',
          'gasto_variable',
          'ahorro',
          'inversion',
          'ocio',
          'imprevisto',
          'abono_saldo_hogar'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_household_flow_date
  ON public.transactions(household_id, flow_type, occurred_on)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_goal_id
  ON public.transactions(goal_id)
  WHERE goal_id IS NOT NULL;

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
    (v_household_id, 'Agua', '🚰', '#0F766E', true, 0),
    (v_household_id, 'Luz', '💡', '#D97706', true, 1),
    (v_household_id, 'Gas', '🔥', '#DC2626', true, 2),
    (v_household_id, 'Internet', '📶', '#2563EB', true, 3),
    (v_household_id, 'Telefonía móvil', '📱', '#4F46E5', true, 4),
    (v_household_id, 'TV / Streaming / suscripciones esenciales', '📺', '#7C3AED', true, 5),
    (v_household_id, 'TAG / Autopistas', '🛣️', '#0EA5E9', true, 6),
    (v_household_id, 'Arriendo / Dividendo', '🏠', '#1D4ED8', true, 7),
    (v_household_id, 'Gastos comunes', '🏢', '#7C3AED', true, 8),
    (v_household_id, 'Seguros', '🛡️', '#1D4ED8', true, 9),
    (v_household_id, 'Créditos / Tarjetas / Cuotas', '💳', '#B45309', true, 10),
    (v_household_id, 'Educación', '📚', '#0284C7', true, 11),
    (v_household_id, 'Salud fija', '🩺', '#DC2626', true, 12),
    (v_household_id, 'Otros pagos obligatorios', '🧾', '#6B7280', true, 13),
    (v_household_id, 'Alimentación', '🍽️', '#16A34A', true, 14),
    (v_household_id, 'Supermercado', '🛒', '#059669', true, 15),
    (v_household_id, 'Transporte / Locomoción', '🚌', '#0891B2', true, 16),
    (v_household_id, 'Bencina', '⛽', '#0F766E', true, 17),
    (v_household_id, 'Farmacia / Remedios', '💊', '#DB2777', true, 18),
    (v_household_id, 'Salud variable', '💟', '#EC4899', true, 19),
    (v_household_id, 'Compras del hogar', '🧺', '#64748B', true, 20),
    (v_household_id, 'Ocio', '🎉', '#A21CAF', true, 21),
    (v_household_id, 'Salidas', '🍷', '#9333EA', true, 22),
    (v_household_id, 'Mascotas', '🐾', '#EA580C', true, 23),
    (v_household_id, 'Imprevistos', '⚠️', '#EF4444', true, 24),
    (v_household_id, 'Otros gastos variables', '📦', '#6B7280', true, 25),
    (v_household_id, 'Ahorro libre', '💰', '#16A34A', true, 26),
    (v_household_id, 'Fondo de emergencia', '🛟', '#0EA5E9', true, 27),
    (v_household_id, 'Meta del hogar', '🎯', '#0F766E', true, 28),
    (v_household_id, 'Inversión', '📈', '#15803D', true, 29);

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
