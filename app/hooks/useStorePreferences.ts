import { useState, useEffect, useCallback } from 'react';

type StoreChoice = 'AUTO' | string;

/**
 * Custom hook for managing item-specific store preferences
 * Stores preferences in localStorage per household
 *
 * Store preferences control which store to use when showing prices
 * - 'AUTO': Use the cheapest available store
 * - Store name: Use a specific store
 *
 * @param householdCode - The household code to scope preferences to
 *
 * @example
 * const { storePrefs, setItemStorePreference } = useStorePreferences(householdCode);
 *
 * // Get preference for an item
 * const pref = storePrefs['Milk (gallon)']; // 'AUTO' or 'Walmart'
 *
 * // Set preference
 * setItemStorePreference('Milk (gallon)', 'Walmart');
 *
 * // Reset to auto
 * setItemStorePreference('Milk (gallon)', 'AUTO');
 */
export const useStorePreferences = (householdCode: string | null) => {
  const [storePrefs, setStorePrefs] = useState<Record<string, StoreChoice>>({});

  // Load preferences from localStorage
  useEffect(() => {
    if (!householdCode || typeof window === 'undefined') return;

    const key = `store_prefs_${householdCode}`;
    const stored = localStorage.getItem(key);

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setStorePrefs(parsed);
      } catch (e) {
        console.error('Failed to parse store preferences:', e);
        setStorePrefs({});
      }
    } else {
      setStorePrefs({});
    }
  }, [householdCode]);

  /**
   * Set store preference for a specific item
   * Persists to localStorage automatically
   */
  const setItemStorePreference = useCallback((itemName: string, choice: StoreChoice) => {
    setStorePrefs(prev => {
      const updated = { ...prev, [itemName]: choice };

      // Persist to localStorage
      if (householdCode && typeof window !== 'undefined') {
        const key = `store_prefs_${householdCode}`;
        try {
          localStorage.setItem(key, JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to save store preferences:', e);
        }
      }

      return updated;
    });
  }, [householdCode]);

  /**
   * Clear all store preferences for the current household
   */
  const clearAllPreferences = useCallback(() => {
    if (householdCode && typeof window !== 'undefined') {
      const key = `store_prefs_${householdCode}`;
      localStorage.removeItem(key);
    }
    setStorePrefs({});
  }, [householdCode]);

  /**
   * Get preference for a specific item
   * Returns 'AUTO' if no preference is set
   */
  const getItemPreference = useCallback((itemName: string): StoreChoice => {
    return storePrefs[itemName] || 'AUTO';
  }, [storePrefs]);

  return {
    storePrefs,
    setItemStorePreference,
    clearAllPreferences,
    getItemPreference
  };
};
