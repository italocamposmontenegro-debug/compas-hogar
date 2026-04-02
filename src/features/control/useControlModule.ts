import { useCallback, useEffect, useState } from 'react';
import { fetchControlModule, type ControlModuleEnvelope } from './api';
import type { ControlModuleKey } from '../../../shared/control';

export function useControlModule<TData>(
  module: ControlModuleKey,
  payload: Record<string, unknown> = {},
) {
  const payloadKey = JSON.stringify(payload);
  const [response, setResponse] = useState<ControlModuleEnvelope<TData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextPayload = payloadKey ? JSON.parse(payloadKey) as Record<string, unknown> : {};
      const data = await fetchControlModule<TData>(module, nextPayload);
      setResponse(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No pudimos cargar este módulo.');
    } finally {
      setLoading(false);
    }
  }, [module, payloadKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    data: response?.data ?? null,
    viewer: response?.viewer ?? null,
    loading,
    error,
    reload: load,
  };
}
