// ============================================
// Casa Clara — HouseholdContext
// ============================================

/* eslint-disable react-refresh/only-export-components */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Household, HouseholdMember, Subscription } from '../types/database';
import { queryWithTimeout } from '../lib/async';
import {
  resolveOperationalHousehold,
  type HouseholdResolutionCandidate,
} from '../../shared/household-resolution';

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

  const fetchResolutionCandidates = useCallback(async (currentUserId: string) => {
    const { data: membershipData, error: membershipError } = await queryWithTimeout(
      (signal) => supabase
        .from('household_members')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('invitation_status', 'accepted')
        .order('created_at', { ascending: true })
        .abortSignal(signal),
      7000,
      'No pudimos cargar tu hogar.',
    );

    if (membershipError) {
      throw membershipError;
    }

    const memberships = (membershipData ?? []) as HouseholdMember[];

    if (memberships.length === 0) {
      return {
        memberships,
        candidates: [] as HouseholdResolutionCandidate[],
      };
    }

    const householdIds = [...new Set(memberships.map((member) => member.household_id))];

    const [
      { data: householdsData, error: householdsError },
      { data: subscriptionsData, error: subscriptionsError },
    ] = await Promise.all([
      queryWithTimeout(
        (signal) => supabase
          .from('households')
          .select('*')
          .in('id', householdIds)
          .abortSignal(signal),
        7000,
        'No pudimos cargar los datos del hogar.',
      ),
      queryWithTimeout(
        (signal) => supabase
          .from('subscriptions')
          .select('*')
          .in('household_id', householdIds)
          .abortSignal(signal),
        7000,
        'No pudimos cargar la suscripción del hogar.',
      ),
    ]);

    if (householdsError) {
      throw householdsError;
    }

    if (subscriptionsError) {
      throw subscriptionsError;
    }

    const householdMap = new Map(
      ((householdsData ?? []) as Household[]).map((item) => [item.id, item]),
    );
    const subscriptionMap = new Map(
      ((subscriptionsData ?? []) as Subscription[]).map((item) => [item.household_id, item]),
    );

    return {
      memberships,
      subscriptions: (subscriptionsData ?? []) as Subscription[],
      candidates: memberships.map((member) => {
        const householdData = householdMap.get(member.household_id);
        const subscriptionData = subscriptionMap.get(member.household_id);

        return {
          membershipId: member.id,
          householdId: member.household_id,
          role: member.role,
          displayName: member.display_name,
          email: member.email,
          monthlyIncome: member.monthly_income,
          householdName: householdData?.name ?? null,
          subscriptionId: subscriptionData?.id ?? null,
          subscriptionStatus: subscriptionData?.status ?? null,
          subscriptionPlanCode: subscriptionData?.plan_code ?? null,
          subscriptionBillingCycle: subscriptionData?.billing_cycle ?? null,
        };
      }),
    };
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
      const {
        memberships,
        subscriptions = [],
        candidates,
      } = await fetchResolutionCandidates(userId);
      const resolution = resolveOperationalHousehold(candidates);

      if (resolution.status === 'none') {
        resetHouseholdState();
        setLoading(false);
        return;
      }

      if (resolution.status === 'inconsistent') {
        resetHouseholdState();
        throw new Error(resolution.message);
      }

      const memberData = memberships.find((member) => member.id === resolution.candidate.membershipId) ?? null;

      if (!memberData) {
        throw new Error('No pudimos reconstruir tu contexto de hogar actual.');
      }

      setCurrentMember(memberData);

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
        'No pudimos cargar las personas del hogar.',
      );

      if (allMembers) {
        setMembers(allMembers as HouseholdMember[]);
      }

      setSubscription(
        subscriptions.find((item) => item.household_id === resolution.candidate.householdId) ?? null,
      );
    } catch (error) {
      resetHouseholdState();
      setError(error instanceof Error ? error.message : 'No pudimos cargar tu hogar.');
    } finally {
      setLoading(false);
    }
  }, [fetchResolutionCandidates, resetHouseholdState, userId]);

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
