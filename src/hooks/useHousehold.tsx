// ============================================
// Casa Clara — HouseholdContext
// ============================================

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Household, HouseholdMember, Subscription } from '../types/database';

interface HouseholdContextValue {
  household: Household | null;
  members: HouseholdMember[];
  currentMember: HouseholdMember | null;
  subscription: Subscription | null;
  loading: boolean;
  hasHousehold: boolean;
  refetch: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [currentMember, setCurrentMember] = useState<HouseholdMember | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchHouseholdData() {
    if (!user) {
      setHousehold(null);
      setMembers([]);
      setCurrentMember(null);
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Get user's household membership
      const { data: memberData } = await supabase
        .from('household_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('invitation_status', 'accepted')
        .limit(1)
        .single();

      if (!memberData) {
        setLoading(false);
        return;
      }

      setCurrentMember(memberData as HouseholdMember);

      // Get household
      const { data: householdData } = await supabase
        .from('households')
        .select('*')
        .eq('id', memberData.household_id)
        .single();

      if (householdData) {
        setHousehold(householdData as Household);
      }

      // Get all members
      const { data: allMembers } = await supabase
        .from('household_members')
        .select('*')
        .eq('household_id', memberData.household_id)
        .eq('invitation_status', 'accepted');

      if (allMembers) {
        setMembers(allMembers as HouseholdMember[]);
      }

      // Get subscription
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('household_id', memberData.household_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subData) {
        setSubscription(subData as Subscription);
      }
    } catch {
      // User might not have a household yet
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHouseholdData();
  }, [user]);

  return (
    <HouseholdContext.Provider value={{
      household,
      members,
      currentMember,
      subscription,
      loading,
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
