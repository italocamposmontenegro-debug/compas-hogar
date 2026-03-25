// ============================================
// Casa Clara — HouseholdContext
// ============================================

/* eslint-disable react-refresh/only-export-components */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Household, HouseholdMember, Subscription } from '../types/database';
import { queryWithTimeout } from '../lib/async';

interface HouseholdContextValue {
  household: Household | null;
  members: HouseholdMember[];
  currentMember: HouseholdMember | null;
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  hasHousehold: boolean;
  refetch: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [currentMember, setCurrentMember] = useState<HouseholdMember | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resetHouseholdState = useCallback(() => {
    setHousehold(null);
    setMembers([]);
    setCurrentMember(null);
    setSubscription(null);
  }, []);

  const fetchHouseholdData = useCallback(async () => {
    if (!userId) {
      resetHouseholdState();
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get user's household membership
      const { data: memberData } = await queryWithTimeout(
        (signal) => supabase
          .from('household_members')
          .select('*')
          .eq('user_id', userId)
          .eq('invitation_status', 'accepted')
          .limit(1)
          .abortSignal(signal)
          .maybeSingle(),
        7000,
        'No pudimos cargar tu hogar.',
      );

      if (!memberData) {
        resetHouseholdState();
        setLoading(false);
        return;
      }

      setCurrentMember(memberData as HouseholdMember);

      // Get household
      const { data: householdData } = await queryWithTimeout(
        (signal) => supabase
          .from('households')
          .select('*')
          .eq('id', memberData.household_id)
          .abortSignal(signal)
          .single(),
        7000,
        'No pudimos cargar los datos del hogar.',
      );

      if (householdData) {
        setHousehold(householdData as Household);
      }

      // Get all members
      const { data: allMembers } = await queryWithTimeout(
        (signal) => supabase
          .from('household_members')
          .select('*')
          .eq('household_id', memberData.household_id)
          .eq('invitation_status', 'accepted')
          .abortSignal(signal),
        7000,
        'No pudimos cargar los miembros del hogar.',
      );

      if (allMembers) {
        setMembers(allMembers as HouseholdMember[]);
      }

      // Get subscription
      const { data: subData } = await queryWithTimeout(
        (signal) => supabase
          .from('subscriptions')
          .select('*')
          .eq('household_id', memberData.household_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .abortSignal(signal)
          .maybeSingle(),
        7000,
        'No pudimos cargar la suscripción del hogar.',
      );

      if (subData) {
        setSubscription(subData as Subscription);
      } else {
        setSubscription(null);
      }
    } catch (error) {
      resetHouseholdState();
      setError(error instanceof Error ? error.message : 'No pudimos cargar tu hogar.');
    } finally {
      setLoading(false);
    }
  }, [resetHouseholdState, userId]);

  useEffect(() => {
    void fetchHouseholdData();
  }, [fetchHouseholdData]);

  return (
    <HouseholdContext.Provider value={{
      household,
      members,
      currentMember,
      subscription,
      loading,
      error,
      hasHousehold: !!household,
      refetch: fetchHouseholdData,
    }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider');
  return ctx;
}
