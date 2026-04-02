import {
  canAccessControlModule,
  dedupeControlRoles,
  getPrimaryControlRole,
  type ControlModuleKey,
  type ControlRole,
} from '../../../shared/control.ts';

type SupabaseServiceClient = {
  auth: {
    getUser: (token: string) => Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: { message?: string } | null;
    }>;
  };
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string | boolean) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message?: string } | null }>;
        single: () => Promise<{ data: Record<string, unknown> | null; error: { message?: string } | null }>;
      };
    };
  };
};

export interface ControlViewer {
  userId: string;
  email: string | null;
  fullName: string | null;
  roles: ControlRole[];
  primaryRole: ControlRole | null;
  isLegacyAdminFallback: boolean;
}

export async function getControlViewer(
  supabase: SupabaseServiceClient,
  authHeader: string | null,
): Promise<ControlViewer> {
  if (!authHeader) throw new Error('Unauthorized');

  const token = authHeader.replace('Bearer ', '').trim();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, is_admin')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('Forbidden');
  }

  const { data: roleAssignments, error: roleError } = await supabase
    .from('control_role_assignments')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true) as unknown as Promise<{
      data: Array<{ role: ControlRole }> | null;
      error: { message?: string } | null;
    }>;

  if (roleError && !profile.is_admin) {
    throw new Error(roleError.message || 'No pudimos validar tus roles internos');
  }

  const roles = dedupeControlRoles([
    ...((roleAssignments ?? []).map((assignment) => assignment.role)),
    profile.is_admin ? 'BREAK_GLASS' : null,
  ]);

  if (roles.length === 0) {
    throw new Error('Forbidden');
  }

  return {
    userId: user.id,
    email: typeof profile.email === 'string' ? profile.email : user.email ?? null,
    fullName: typeof profile.full_name === 'string' ? profile.full_name : null,
    roles,
    primaryRole: getPrimaryControlRole(roles),
    isLegacyAdminFallback: profile.is_admin === true && !(roleAssignments ?? []).some((assignment) => assignment.role === 'BREAK_GLASS'),
  };
}

export function assertControlModuleAccess(viewer: ControlViewer, module: ControlModuleKey) {
  if (!canAccessControlModule(viewer.roles, module)) {
    throw new Error('Forbidden');
  }
}
