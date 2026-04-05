-- ==========================================
-- Casa Clara - Seed Data (DEMO)
-- ==========================================

-- Para propósitos de este demo consideraremos que el usuario ya se ha registrado o usaremos un UUID quemado
DO $$
DECLARE
  demo_user_id UUID := '00000000-0000-0000-0000-000000000000'; -- reemplazar en entorno real con UUID de auth
  demo_household_id UUID := uuid_generate_v4();
  member_1_id UUID := uuid_generate_v4();
  member_2_id UUID := uuid_generate_v4();
  cat_super_id UUID := uuid_generate_v4();
  cat_arriendo_id UUID := uuid_generate_v4();
  cat_luz_id UUID := uuid_generate_v4();
BEGIN

  -- 1. Crear Hogar
  INSERT INTO public.households (id, name, split_rule_type, currency) 
  VALUES (demo_household_id, 'Hogar Demo', 'proportional', 'CLP');

  -- 2. Crear Miembros
  INSERT INTO public.household_members (id, household_id, user_id, role, display_name, email, monthly_income, invitation_status)
  VALUES 
  (member_1_id, demo_household_id, demo_user_id, 'owner', 'Usuario Inicial', 'demo@casaclara.app', 1200000, 'accepted'),
  (member_2_id, demo_household_id, NULL, 'member', 'Pareja Demo', 'pareja@casaclara.app', 800000, 'accepted');

  -- 3. Crear Suscripción asociada
  INSERT INTO public.subscriptions (household_id, plan_code, billing_cycle, status, price_amount_clp)
  VALUES (demo_household_id, 'base', 'monthly', 'active', 2990);

  -- 4. Insertar Categorias
  INSERT INTO public.categories (id, household_id, name, icon, color, is_default)
  VALUES
  (cat_super_id, demo_household_id, 'Supermercado', '🛒', '#059669', true),
  (cat_arriendo_id, demo_household_id, 'Arriendo / Dividendo', '🏠', '#1D4ED8', true),
  (cat_luz_id, demo_household_id, 'Luz', '💡', '#D97706', true);

  -- 5. Transactions de prueba
  INSERT INTO public.transactions (household_id, type, paid_by_member_id, scope, amount_clp, category_id, description, occurred_on)
  VALUES
  (demo_household_id, 'income', member_1_id, 'personal', 1200000, NULL, 'Sueldo', CURRENT_DATE),
  (demo_household_id, 'income', member_2_id, 'personal', 800000, NULL, 'Sueldo', CURRENT_DATE),
  (demo_household_id, 'expense', member_1_id, 'shared', 350000, cat_arriendo_id, 'Arriendo Mensual', CURRENT_DATE - INTERVAL '2 days'),
  (demo_household_id, 'expense', member_2_id, 'shared', 120000, cat_super_id, 'Compra del mes', CURRENT_DATE - INTERVAL '5 days');

  -- 6. Meta de Ahorro
  INSERT INTO public.savings_goals (household_id, name, target_amount_clp, current_amount_clp, target_date, is_primary, status)
  VALUES (demo_household_id, 'Fondo de Emergencia', 1000000, 200000, CURRENT_DATE + INTERVAL '6 months', true, 'active');

END $$;
