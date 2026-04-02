CREATE TABLE IF NOT EXISTS public.control_role_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('CEO', 'OPS_ADMIN', 'FINANCE_ADMIN', 'SUPPORT', 'BREAK_GLASS')),
  granted_by UUID REFERENCES public.profiles(id),
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_control_role_assignments_user_id
  ON public.control_role_assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_control_role_assignments_role
  ON public.control_role_assignments(role);

CREATE UNIQUE INDEX IF NOT EXISTS idx_control_role_assignments_active_unique
  ON public.control_role_assignments(user_id, role)
  WHERE is_active = true;

CREATE TRIGGER set_timestamp_control_role_assignments
BEFORE UPDATE ON public.control_role_assignments
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

ALTER TABLE public.control_role_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own control roles"
ON public.control_role_assignments
FOR SELECT
USING (auth.uid() = user_id);

WITH inserted AS (
  INSERT INTO public.control_role_assignments (
    user_id,
    role,
    note
  )
  SELECT
    profiles.id,
    'BREAK_GLASS',
    'Bootstrap legado desde profiles.is_admin'
  FROM public.profiles
  WHERE profiles.is_admin = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.control_role_assignments existing
      WHERE existing.user_id = profiles.id
        AND existing.role = 'BREAK_GLASS'
        AND existing.is_active = true
    )
  RETURNING id, user_id, role
)
INSERT INTO public.audit_logs (
  household_id,
  user_id,
  action,
  resource_type,
  resource_id,
  metadata
)
SELECT
  NULL,
  NULL,
  'control_role_bootstrapped',
  'control_role_assignment',
  inserted.id,
  jsonb_build_object(
    'target_user_id', inserted.user_id,
    'role', inserted.role,
    'source', 'legacy_is_admin'
  )
FROM inserted;
