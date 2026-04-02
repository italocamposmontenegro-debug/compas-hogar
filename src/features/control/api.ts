import { supabase } from '../../lib/supabase';
import type { ControlModuleKey, ControlRole } from '../../../shared/control';

export interface ControlViewerResponse {
  userId: string;
  email: string | null;
  fullName: string | null;
  roles: ControlRole[];
  primaryRole: ControlRole | null;
  isLegacyAdminFallback: boolean;
}

export interface ControlModuleEnvelope<TData> {
  viewer: ControlViewerResponse;
  module: ControlModuleKey;
  data: TData;
}

export async function fetchControlModule<TData>(
  module: ControlModuleKey,
  payload: Record<string, unknown> = {},
) {
  const { data, error } = await supabase.functions.invoke('master-control-overview', {
    body: {
      module,
      ...payload,
    },
  });

  if (error) {
    throw error;
  }

  return data as ControlModuleEnvelope<TData>;
}
