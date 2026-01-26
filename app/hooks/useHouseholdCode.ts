import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing household code from localStorage
 * Provides client-side safe access to the household code
 *
 * @example
 * const { householdCode, loading, updateCode } = useHouseholdCode();
 *
 * if (loading) return <Loading />;
 * if (!householdCode) return <HouseholdSelector />;
 *
 * // Use household code in queries
 * const { data } = await supabase
 *   .from('shopping_list')
 *   .select('*')
 *   .eq('household_code', householdCode);
 */
export const useHouseholdCode = () => {
  const [householdCode, setHouseholdCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Client-side only check
    if (typeof window !== 'undefined') {
      const code = localStorage.getItem('household_code');
      setHouseholdCode(code);
      setLoading(false);
    }
  }, []);

  /**
   * Update the household code in localStorage and state
   */
  const updateCode = useCallback((code: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('household_code', code);
      setHouseholdCode(code);
    }
  }, []);

  /**
   * Clear the household code from localStorage and state
   */
  const clearCode = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('household_code');
      setHouseholdCode(null);
    }
  }, []);

  return { householdCode, loading, updateCode, clearCode };
};
