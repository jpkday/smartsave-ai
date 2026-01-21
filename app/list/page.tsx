'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { useWakeLock } from '../hooks/useWakeLock';
import { useCategories } from '../hooks/useCategories';
import Link from 'next/link';
const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';


interface ItemNote {
  id: string;
  item_id: number;
  note: string;
  store_id?: string;
  created_at: string;
}

interface ListItem {
  id: string; // shopping_list row id
  item_id: number; // items table id (FK)
  item_name: string;
  quantity: number;
  checked: boolean;
  is_priority: boolean;
  category_id?: number | null; // Add category_id
  category?: string | null; // Add category string for fallback
  active_note?: ItemNote; // Active note for this item
}
interface ItemRow {
  id: number;
  name: string;
  category?: string; // String fallback
  category_id?: number; // FK ID
  active_note?: ItemNote | null;
}
interface PriceData {
  price: string;
  date: string;
}
type StoreChoice = 'AUTO' | string;

export default function ShoppingList() {
  const { request: requestWakeLock } = useWakeLock();

  useEffect(() => {
    requestWakeLock();
  }, [requestWakeLock]);

  const { categoryOptions, categories, loading: categoriesLoading, getCategoryName, getCategoryColor, getCategoryColorById } = useCategories();

  const [activeTrips, setActiveTrips] = useState<{ [store_id: string]: string }>({});
  const [stores, setStores] = useState<string[]>([]);
  const [storesByName, setStoresByName] = useState<{ [name: string]: string }>({});

  const [allItems, setAllItems] = useState<ItemRow[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentItemIds, setRecentItemIds] = useState<number[]>([]);
  const [favoritesIds, setFavoritesIds] = useState<number[]>([]);
  const [storeFilter, setStoreFilter] = useState<string>('All');
  const [dealsItemNames, setDealsItemNames] = useState<Set<string>>(new Set());

  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [prices, setPrices] = useState<{ [key: string]: PriceData }>({});
  const [filterLetter, setFilterLetter] = useState<string>('All');
  const [showFavorites, setShowFavorites] = useState(true);
  const [showAddItems, setShowAddItems] = useState(true);
  const [newItem, setNewItem] = useState('');
  const [showCheckedItems, setShowCheckedItems] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [householdCode, setHouseholdCode] = useState<string | null>(null);
  const [showPriorityOnly, setShowPriorityOnly] = useState(false);

  // const [itemCategoryByName, setItemCategoryByName] = useState<Record<string, string>>({}); // Removed as we use IDs
  // const CATEGORY_OPTIONS = ['Produce', 'Pantry', 'Dairy', 'Beverage', 'Meat', 'Frozen', 'Refrigerated', 'Other']; // Removed
  //const itemsWithoutCategory = listItems.filter(item => {const cat = itemCategoryByName[item.item_name];return !cat || cat === 'Other' || cat.trim() === '';});



  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  type SelectItemsFilter = 'FAVORITES' | 'RECENT' | 'FREQUENT' | null;
  const [selectItemsFilter, setSelectItemsFilter] = useState<SelectItemsFilter>(null);
  const [frequentItemCounts, setFrequentItemCounts] = useState<Record<string, number>>({});

  // =========================
  // Mobile Mode Toggle (Store vs Build)
  // =========================
  const [mobileMode, setMobileMode] = useState<'store' | 'build'>('store');

  // Load household code from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const code = localStorage.getItem('household_code');
      setHouseholdCode(code);

      // Load view settings
      const storedShowChecked = localStorage.getItem('view_showCheckedItems');
      if (storedShowChecked !== null) {
        setShowCheckedItems(storedShowChecked === 'true');
      }

      const storedShowPriority = localStorage.getItem('view_showPriorityOnly');
      if (storedShowPriority !== null) {
        setShowPriorityOnly(storedShowPriority === 'true');
      }
    }
  }, []);

  // Persist view settings on change
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('view_showCheckedItems', String(showCheckedItems));
    }
  }, [showCheckedItems, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('view_showPriorityOnly', String(showPriorityOnly));
    }
  }, [showPriorityOnly, mounted]);

  // Load frequent items
  useEffect(() => {
    async function loadFrequent() {
      if (!householdCode) return;
      const { data } = await supabase.rpc('get_frequent_items', { household: householdCode });
      if (data) {
        // Filter for items with > 1 purchase to be "Frequent" (staples)
        const counts: Record<string, number> = {};
        data
          .filter((d: any) => d.purchase_count > 1)
          .forEach((d: any) => {
            counts[d.item_name] = d.purchase_count;
          });
        setFrequentItemCounts(counts);
      }
    }

    if (mounted && householdCode) {
      loadFrequent();
    }
  }, [householdCode, mounted]);




  // Helper for name-based color lookup (for grouped headers)


  // CATEGORY SORT ORDER (used for "By Store" grouping when multiple items exist)
  const categoryOrder = useMemo(() => {
    const order: Record<string, number> = {};
    categories.forEach((c) => {
      order[c.name] = c.sort_order;
    });
    return order;
  }, [categories]);

  // Remember last store used for price entry
  const [lastUsedStore, setLastUsedStore] = useState<string>('');

  // ITEM ADDED TO SHOPPING LIST (to feed toast notification)
  const [addedToListToastItem, setUndoAddItem] = useState<ListItem | null>(null);
  const [addedToListToastTimeout, setUndoAddTimeout] = useState<NodeJS.Timeout | null>(null);
  const showUndoAddToast = (item: ListItem) => {
    if (addedToListToastTimeout) clearTimeout(addedToListToastTimeout);

    setUndoAddItem(item);

    const timeout = setTimeout(() => {
      setUndoAddItem(null);
      setUndoAddTimeout(null);
    }, 2500);

    setUndoAddTimeout(timeout);
  };

  const undoAdd = async () => {
    if (!addedToListToastItem) return;

    if (addedToListToastTimeout) {
      clearTimeout(addedToListToastTimeout);
      setUndoAddTimeout(null);
    }

    try {
      const { error } = await supabase.from('shopping_list').delete().eq('id', addedToListToastItem.id).eq('user_id', SHARED_USER_ID);
      if (error) throw error;
      await loadData();
    } catch (e) {
      console.error('Error undoing add:', e);
      alert('Failed to undo. Check your connection and try again.');
    } finally {
      setUndoAddItem(null);
    }
  };

  // ITEM REMOVED FROM SHOPPING LIST (to feed toast notification)
  const [removedFromListToastItem, setUndoRemoveItem] = useState<ListItem | null>(null);
  const [removedFromListToastTimeout, setUndoRemoveTimeout] = useState<NodeJS.Timeout | null>(null);

  // ITEM CHECKED OFF SHOPPING LIST (to feed toast notification)
  const [checkedOffListToastItem, setUndoCheckItem] = useState<ListItem | null>(null);
  const [checkedOffListToastTimeout, setUndoCheckTimeout] = useState<NodeJS.Timeout | null>(null);

  const showCheckedOffListToast = (item: ListItem) => {
    if (checkedOffListToastTimeout) clearTimeout(checkedOffListToastTimeout);

    setUndoCheckItem(item);

    const timeout = setTimeout(() => {
      setUndoCheckItem(null);
      setUndoCheckTimeout(null);
    }, 2500);

    setUndoCheckTimeout(timeout);
  };

  const undoCheck = async () => {
    if (!checkedOffListToastItem) return;

    if (checkedOffListToastTimeout) {
      clearTimeout(checkedOffListToastTimeout);
      setUndoCheckTimeout(null);
    }

    try {
      const { error } = await supabase
        .from('shopping_list')
        .update({ checked: false })
        .eq('id', checkedOffListToastItem.id)
        .eq('user_id', SHARED_USER_ID);

      if (error) throw error;

      await loadData();
    } catch (e) {
      console.error('Error undoing check:', e);
      alert('Failed to undo. Check your connection and try again.');
    } finally {
      setUndoCheckItem(null);
    }
  };

  // TRIP COMPLETE toast (all items for a store are checked)
  const [tripCompleteToastStore, setTripCompleteToastStore] = useState<string | null>(null);
  const [tripCompleteToastTimeout, setTripCompleteToastTimeout] = useState<NodeJS.Timeout | null>(null);
  const TRIP_COMPLETE_DELAY_MS = 5000;

  // Prevent double-firing for the same store while the toast is visible
  const tripCompleteToastLockRef = useRef<string | null>(null);

  const showTripCompleteToast = (storeName: string) => {
    // lock per-store so we don't fire twice due to re-renders / loadData
    if (tripCompleteToastLockRef.current === storeName) return;

    if (tripCompleteToastTimeout) clearTimeout(tripCompleteToastTimeout);

    tripCompleteToastLockRef.current = storeName;
    setTripCompleteToastStore(storeName);

    const t = setTimeout(() => {
      setTripCompleteToastStore(null);
      setTripCompleteToastTimeout(null);
      tripCompleteToastLockRef.current = null;
    }, 5000);

    setTripCompleteToastTimeout(t);
  };

  // TRIP STARTED TOAST
  const [tripStartedToastStore, setTripStartedToastStore] = useState<string | null>(null);
  const [tripStartedToastTripId, setTripStartedToastTripId] = useState<string | null>(null); // For undo
  const [tripStartedToastTimeout, setTripStartedToastTimeout] = useState<NodeJS.Timeout | null>(null);
  const [lastImplicitStartItemId, setLastImplicitStartItemId] = useState<string | null>(null); // To undo check if needed

  const showTripStartedToast = (storeName: string, tripId: string, item_id: string | null = null) => {
    if (tripStartedToastTimeout) clearTimeout(tripStartedToastTimeout);

    setTripStartedToastStore(storeName);
    setTripStartedToastTripId(tripId);
    setLastImplicitStartItemId(item_id);

    const t = setTimeout(() => {
      setTripStartedToastStore(null);
      setTripStartedToastTripId(null);
      setLastImplicitStartItemId(null);
      setTripStartedToastTimeout(null);
    }, 5000);

    setTripStartedToastTimeout(t);
  };

  const undoTripStart = async () => {
    if (!tripStartedToastTripId) return;

    if (tripStartedToastTimeout) {
      clearTimeout(tripStartedToastTimeout);
      setTripStartedToastTimeout(null);
    }

    try {
      // 1. Delete the trip (cascade should handle events if DB configured, but let's be safe)
      // Actually, if we just delete the trip, we might leave events without a trip_id or delete them?
      // For now, let's just delete the trip record.
      const response = await fetch('/api/trips/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripStartedToastTripId }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete trip');
      }


      // 2. If this was implicit (via item check), uncheck that item
      if (lastImplicitStartItemId) {
        await supabase.from('shopping_list').update({ checked: false }).eq('id', lastImplicitStartItemId);
      }

      // 3. Unpin store
      localStorage.removeItem('my_active_store_id');
      setMyActiveStoreId(null);

      await loadData();
    } catch (e) {
      console.error('Error undoing trip start:', e);
      alert('Failed to undo. Check your connection and try again.');
    } finally {
      setTripStartedToastStore(null);
      setTripStartedToastTripId(null);
      setLastImplicitStartItemId(null);
    }
  };

  const startTrip = async (storeId: string, storeName: string) => {
    try {
      const response = await fetch('/api/trips/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, household_code: householdCode }),
      });
      const data = await response.json();

      if (data.success && data.trip) {
        pinStore(storeId);
        await loadData();
        showTripStartedToast(storeName, data.trip.id, null); // Explicit start, no implicit item
      } else {
        console.error('Start trip failed:', data);
        alert(data.error || 'Failed to start trip. Please try again.');
        // If it failed, unpin just in case? No, we haven't pinned yet.
      }

    } catch (error) {
      console.error('Error starting trip:', error);
      alert('Failed to start trip. Please try again.');
    }
  };

  const endTrip = async (tripId: string, storeId: string) => {
    if (!confirm('End trip and clear purchased items?')) return;

    try {
      const response = await fetch('/api/trips/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId, store_id: storeId, household_code: householdCode }),
      });
      const data = await response.json();

      if (data.success) {
        localStorage.removeItem('my_active_store_id');
        setMyActiveStoreId(null);
        await loadData();
      }
    } catch (error) {
      console.error('Error ending trip:', error);
      alert('Failed to end trip. Please try again.');
    }
  };


  // =========================
  // LOCAL STORE PINNING (Concurrent Shopping Fix)
  // =========================
  const [myActiveStoreId, setMyActiveStoreId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('my_active_store_id');
      if (stored) setMyActiveStoreId(stored);
    }
  }, []);

  const pinStore = (storeId: string) => {
    console.log('Pinning store:', storeId);
    setMyActiveStoreId(storeId);
    localStorage.setItem('my_active_store_id', storeId);
  };

  useEffect(() => {
    const stored = localStorage.getItem('last_price_store');
    if (stored && stores.includes(stored)) {
      setLastUsedStore(stored);
    }
  }, [stores]);

  // =========================
  // SMART AUTO-PIN (Device Handoff & Single Trip Convenience)
  // If I open the app and there is exactly one active trip (and I haven't pinned anything else),
  // assume that is my trip and pin it.
  // =========================
  useEffect(() => {
    if (!myActiveStoreId && !loading) {
      const activeStoreIds = Object.keys(activeTrips);
      // Only auto-pin if there is NO ambiguity (exactly one active trip)
      if (activeStoreIds.length === 1) {
        const singleStoreId = activeStoreIds[0];
        // Double check valid id
        if (singleStoreId && singleStoreId.length > 0) {
          console.log('Smart Auto-Pin: Claiming single active trip', singleStoreId);
          pinStore(singleStoreId);
        }
      }
    }
  }, [activeTrips, myActiveStoreId, loading]);

  // =========================
  // Store preference override
  // =========================
  const [storePrefs, setStorePrefs] = useState<Record<string, StoreChoice>>({});
  const STORE_PREF_KEY = 'store_prefs_by_item';

  const loadStorePrefs = (currentHouseholdCode?: string | null) => {
    try {
      // If we have a household code, use that specific key
      // Otherwise fallback to global key (legacy behavior or no-household)
      const key = currentHouseholdCode
        ? `${STORE_PREF_KEY}_${currentHouseholdCode}`
        : STORE_PREF_KEY;

      const raw = localStorage.getItem(key);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, StoreChoice>;
      return {};
    } catch {
      return {};
    }
  };

  const persistStorePrefs = (prefs: Record<string, StoreChoice>, currentHouseholdCode?: string | null) => {
    try {
      const key = currentHouseholdCode
        ? `${STORE_PREF_KEY}_${currentHouseholdCode}`
        : STORE_PREF_KEY;

      localStorage.setItem(key, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  };

  const setItemStorePreference = (itemName: string, choice: StoreChoice) => {
    setStorePrefs((prev) => {
      const next = { ...prev, [itemName]: choice };
      persistStorePrefs(next, householdCode);
      return next;
    });
  };

  const getPriceForStore = (store: string, itemName: string): number | null => {
    const pd = prices[`${store}-${itemName}`];
    if (!pd) return null;
    const n = parseFloat(pd.price);
    return Number.isFinite(n) ? n : null;
  };

  const getStoreOptionsForItem = (itemName: string) => {
    const options = stores
      .map((store) => ({ store, price: getPriceForStore(store, itemName) }))
      .filter((o) => o.price !== null) as Array<{ store: string; price: number }>;
    options.sort((a, b) => a.price - b.price);
    return options;
  };

  const formatMoney = (n: number) => `$${n.toFixed(2)}`;

  const getCheapestStoreForItem = (itemName: string): string | null => {
    const options = getStoreOptionsForItem(itemName);
    return options.length ? options[0].store : null;
  };

  const getEffectiveStore = (itemName: string): string | null => {
    const pref = storePrefs[itemName] || 'AUTO';
    if (pref !== 'AUTO') return pref;
    return getCheapestStoreForItem(itemName);
  };

  // =========================
  // Unified Edit modal state
  // =========================
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalItem, setEditModalItem] = useState<ListItem | null>(null);
  const [editModalName, setEditModalName] = useState('');
  const [editModalCategory, setEditModalCategory] = useState('');
  const [editModalQuantity, setEditModalQuantity] = useState<string>('1');
  const [editModalStore, setEditModalStore] = useState('');
  const [editModalPrice, setEditModalPrice] = useState('');
  const [editModalOriginalPrice, setEditModalOriginalPrice] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const storeOptions = editModalItem ? getStoreOptionsForItem(editModalItem.item_name) : [];
  const [editModalFocusField, setEditModalFocusField] = useState<'name' | 'price' | 'category' | 'note'>('name');
  const storeSelectRef = useRef<HTMLSelectElement | null>(null);
  const [needsStoreHint, setNeedsStoreHint] = useState(false);
  const [storeRequiredOpen, setStoreRequiredOpen] = useState(false);
  const [editModalPriceDirty, setEditModalPriceDirty] = useState(false);
  const [editModalNote, setEditModalNote] = useState('');
  const [editModalNoteStore, setEditModalNoteStore] = useState<string>('Any');

  // New Effect: Fetch note for virtual items (not on list) when modal opens
  useEffect(() => {
    if (editModalOpen && editModalItem && !editModalItem.id) {
      // This is a master item, note not pre-loaded. Fetch it.
      supabase.from('item_notes')
        .select('*')
        .eq('item_id', editModalItem.item_id)
        .eq('household_code', householdCode)
        .eq('is_active', true)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setEditModalNote(data.note);
            if (data.store_id) {
              const storeName = Object.keys(storesByName).find(key => storesByName[key] === data.store_id);
              setEditModalNoteStore(storeName || 'Any');
            }
          }
        });
    }
  }, [editModalOpen, editModalItem, householdCode, storesByName]);


  const openEditModal = (item: ListItem, focusField: 'name' | 'price' | 'category' | 'note' = 'name') => {
    setEditModalItem(item);
    setEditModalName(item.item_name);
    let initialCategory = 'Other';
    const catNameFromId = getCategoryName(item.category_id ?? -1);

    // 1. Try ID-based name
    if (catNameFromId && catNameFromId !== 'Other') {
      initialCategory = catNameFromId;
    }
    // 2. Fallback to string name if ID gave 'Other' (or nothing) and we have a specific string
    else if (item.category && item.category !== 'Other') {
      initialCategory = item.category;
    }

    console.log('catName resolved:', initialCategory);
    setEditModalCategory(initialCategory);
    setEditModalQuantity(String(item.quantity ?? 1));
    setEditModalFocusField(focusField);
    setEditModalPriceDirty(false);
    setNeedsStoreHint(false);

    const effStore = getEffectiveStore(item.item_name);
    let resolvedStore = '';

    if (effStore) {
      resolvedStore = effStore || lastUsedStore || '';
      setEditModalStore(resolvedStore);
      const priceData = prices[`${effStore}-${item.item_name}`];
      if (priceData) {
        setEditModalPrice(priceData.price);
        setEditModalOriginalPrice(priceData.price);
      } else {
        setEditModalPrice('');
        setEditModalOriginalPrice('');
      }
    } else {
      setEditModalStore('');
      setEditModalPrice('');
      setEditModalOriginalPrice('');
    }

    // Note State
    setEditModalNote(item.active_note?.note || '');
    if (item.active_note?.store_id) {
      // Reverse lookup store ID to Name
      const storeName = Object.keys(storesByName).find(key => storesByName[key] === item.active_note?.store_id);
      setEditModalNoteStore(storeName || 'Any');
    } else {
      // Default to the store selected in the price section if available, otherwise 'Any'
      setEditModalNoteStore(resolvedStore || 'Any');
    }

    setEditModalOpen(true);
    setSavingEdit(false);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditModalItem(null);
    setEditModalName('');
    setEditModalCategory('');
    setEditModalQuantity('1');
    setEditModalStore('');
    setEditModalPrice('');
    setEditModalOriginalPrice('');
    setSavingEdit(false);
    setEditModalPriceDirty(false);
    setNeedsStoreHint(false);
  };

  // SAVE EDIT FUNCTION
  const saveEdit = async () => {
    if (!editModalItem || !editModalName.trim()) return;

    const newName = editModalName.trim();
    const oldName = editModalItem.item_name;

    setSavingEdit(true);

    try {
      // 1) Rename + category update (items table)
      if (newName !== oldName) {
        const { data: existingItem, error: existingErr } = await supabase
          .from('items')
          .select('id')
          .eq('name', newName)
          .eq('user_id', SHARED_USER_ID)
          .maybeSingle();

        if (existingErr) throw existingErr;

        if (existingItem && existingItem.id !== editModalItem.item_id) {
          alert('An item with this name already exists.');
          setSavingEdit(false);
          return;
        }

        const { error: itemError } = await supabase
          .from('items')
          .update({ name: newName, category: editModalCategory || 'Other' })
          .eq('id', editModalItem.item_id)
          .eq('user_id', SHARED_USER_ID);

        if (itemError) throw itemError;

        const { error: listError } = await supabase
          .from('shopping_list')
          .update({ item_name: newName })
          .eq('item_id', editModalItem.item_id)
          .eq('user_id', SHARED_USER_ID);

        if (listError) throw listError;

        const { error: phError } = await supabase
          .from('price_history')
          .update({ item_name: newName })
          .eq('item_id', editModalItem.item_id)
          .eq('user_id', SHARED_USER_ID);

        if (phError) throw phError;
      } else {
        // no rename — just update category
        const { error: catErr } = await supabase
          .from('items')
          .update({ category: editModalCategory || 'Other' })
          .eq('id', editModalItem.item_id)
          .eq('user_id', SHARED_USER_ID);

        if (catErr) throw catErr;
      }

      // 2) Quantity update
      const qtyNum = parseFloat(editModalQuantity || '0');

      // Only update shopping_list if the item is incorrectly on the list (has an ID)
      if (editModalItem.id && !isNaN(qtyNum) && qtyNum !== editModalItem.quantity) {
        const { error: qtyError } = await supabase
          .from('shopping_list')
          .update({ quantity: qtyNum })
          .eq('id', editModalItem.id)
          .eq('user_id', SHARED_USER_ID);

        if (qtyError) throw qtyError;
      }


      // ✅ GUARD: Price changed but no store selected → show modal instead of crashing
      const priceChanged = !!editModalPrice && editModalPrice !== editModalOriginalPrice;
      const storeMissing = !editModalStore || editModalStore.trim() === '';
      if (priceChanged && storeMissing) {
        setSavingEdit(false);
        setStoreRequiredOpen(true);
        return;
      }

      // 3) Price insert
      if (editModalPrice && editModalPrice !== editModalOriginalPrice) {
        const priceNum = parseFloat(editModalPrice);
        if (!isNaN(priceNum) && priceNum > 0) {
          const storeId = storesByName[editModalStore];
          if (!storeId) throw new Error('Store not found');

          const recordedDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

          const { error: priceError } = await supabase.from('price_history').insert({
            item_id: editModalItem.item_id,
            item_name: newName, // safe (same as oldName if no rename)
            store_id: storeId,
            store: editModalStore,
            price: priceNum.toFixed(2),
            user_id: SHARED_USER_ID,
            household_code: householdCode,
            recorded_date: recordedDate,
            created_at: new Date().toISOString(),
          });

          if (priceError) throw priceError;

          setLastUsedStore(editModalStore);
          localStorage.setItem('last_price_store', editModalStore);
        }
      }

      // 3. Save Note if changed
      const originalNote = editModalItem.active_note?.note || '';

      // Resolve original store name from ID for comparison
      let originalNoteStoreName = 'Any';
      if (editModalItem.active_note?.store_id) {
        const foundName = Object.keys(storesByName).find(key => storesByName[key] === editModalItem.active_note!.store_id);
        if (foundName) originalNoteStoreName = foundName;
      }

      const noteTextChanged = editModalNote.trim() !== originalNote.trim();
      const noteStoreChanged = editModalNoteStore !== originalNoteStoreName;

      if (noteTextChanged || noteStoreChanged) {
        const noteStoreId = editModalNoteStore === 'Any' ? null : storesByName[editModalNoteStore]; // Lookup ID

        // Deactivate old note if exists
        if (editModalItem.active_note?.id) {
          await supabase.from('item_notes').update({ is_active: false }).eq('id', editModalItem.active_note.id);
        }

        // Insert new note if not empty
        if (editModalNote.trim()) {
          const { error: noteError } = await supabase.from('item_notes').insert({
            item_id: editModalItem.item_id,
            household_code: householdCode,
            store_id: noteStoreId,
            note: editModalNote.trim(),
            is_active: true
          });
          if (noteError) throw noteError;
        }
      }

      // ✅ Optimistic Update (Fix "Name not sticking")
      // Update local state immediately so UI reflects changes while we re-fetch in background
      setListItems((prev) =>
        prev.map((li) => {
          // Update all instances of this item (in case of duplicates or same item_id)
          if (li.item_id === editModalItem.item_id) {
            return { ...li, item_name: newName, quantity: qtyNum };
          }
          return li;
        })
      );

      if (newName !== oldName) {
        // Find category ID
        const newCatName = editModalCategory || 'Other';
        const newCat = categories.find(c => c.name === newCatName);
        const newCatId = newCat ? newCat.id : -1;

        setAllItems((prev) =>
          prev.map((i) => (i.id === editModalItem.item_id ? { ...i, name: newName, category: editModalCategory, category_id: newCatId } : i))
        );
        // items is just string array of names
        setItems((prev) => prev.map((n) => (n === oldName ? newName : n)));
      }

      closeEditModal();
      await loadData();
    } catch (error) {
      console.error('Error saving edit:', error);
      alert('Failed to save changes. Check your connection and try again.');
      setSavingEdit(false);
    }
  };

  const toggleFavorite = async (itemName: string) => {
    if (!householdCode) return;

    // Find item ID
    const item = allItems.find(i => i.name === itemName);
    if (!item) return;

    const isFav = favorites.includes(itemName);

    // Optimistically update UI
    if (isFav) {
      setFavorites(prev => prev.filter(n => n !== itemName));
      setFavoritesIds(prev => prev.filter(id => id !== item.id));
    } else {
      setFavorites(prev => [...prev, itemName]);
      setFavoritesIds(prev => [...prev, item.id]);
    }

    // Update database
    if (isFav) {
      const { error } = await supabase
        .from('household_item_favorites')
        .delete()
        .eq('household_code', householdCode)
        .eq('item_id', item.id);

      if (error) {
        // Rollback on error
        setFavorites(prev => [...prev, itemName]);
        setFavoritesIds(prev => [...prev, item.id]);
        alert('Failed to update favorite. Check your connection and try again.');
      }
    } else {
      const { error } = await supabase
        .from('household_item_favorites')
        .insert({
          household_code: householdCode,
          item_id: item.id,
        });

      if (error) {
        // Rollback
        setFavorites(prev => prev.filter(n => n !== itemName));
        setFavoritesIds(prev => prev.filter(id => id !== item.id));
        alert('Failed to update favorite. Check your connection and try again.');
      }
    }
  };



  // =========================
  // Store picker modal state
  // =========================
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [activeItemForStoreModal, setActiveItemForStoreModal] = useState<string | null>(null);

  const openStoreModal = (itemName: string) => {
    setActiveItemForStoreModal(itemName);
    setStoreModalOpen(true);
  };

  const closeStoreModal = () => {
    setStoreModalOpen(false);
    setActiveItemForStoreModal(null);
  };

  const toggleLetter = (letter: string) => {
    setFilterLetter((prev) => (prev === letter ? 'All' : letter));
  };

  // Detect if we're on mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Persist / restore mobile mode (mobile only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isMobile) return;
    try {
      const saved = localStorage.getItem('list_mobile_mode');
      if (saved === 'store' || saved === 'build') setMobileMode(saved);
    } catch {
      // ignore
    }
  }, [isMobile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isMobile) return;
    try {
      localStorage.setItem('list_mobile_mode', mobileMode);
    } catch {
      // ignore
    }
  }, [isMobile, mobileMode]);

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.autocomplete-container')) {
        setShowAutocomplete(false);
      }
    };

    if (showAutocomplete) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAutocomplete]);

  // Close modals on ESC
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeStoreModal();
        closeEditModal();
      }
    };
    if (storeModalOpen || editModalOpen) {
      window.addEventListener('keydown', onKeyDown);
    }
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [storeModalOpen, editModalOpen]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setStorePrefs(loadStorePrefs(householdCode));
    }

    if (householdCode) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdCode]);

  // IN EDIT ITEM, WHEN STORE SELECTED, UPDATE PRICE IMMEDIATELY
  useEffect(() => {
    if (!editModalOpen || !editModalItem) return;

    // ✅ If user has started typing a new price, never overwrite it
    if (editModalPriceDirty) return;

    // No store selected → clear price context
    if (!editModalStore) {
      setEditModalOriginalPrice('');
      setEditModalPrice('');
      return;
    }

    const key = `${editModalStore}-${editModalItem.item_name}`;
    const priceData = prices[key];

    if (priceData?.price) {
      setEditModalPrice(priceData.price);
      setEditModalOriginalPrice(priceData.price);
    } else {
      setEditModalPrice('');
      setEditModalOriginalPrice('');
    }
  }, [editModalStore, editModalOpen, editModalItem, prices, editModalPriceDirty]);


  // LOAD DATA CONSTANT

  const loadData = useCallback(async () => {
    // Load favorited stores for this household
    const { data: householdFavorites } = await supabase
      .from('household_store_favorites')
      .select('store_id')
      .eq('household_code', householdCode);

    const favoriteStoreIds = new Set(householdFavorites?.map((f: any) => f.store_id) || []);
    const hasFavorites = favoriteStoreIds.size > 0;

    const { data: storesData, error: storesError } = await supabase.from('stores').select('id, name').order('name');
    if (storesError) console.error('Error loading stores:', storesError);

    if (storesData) {
      // Filter stores if user has favorites, otherwise show all (legacy/fallback)
      const filteredStores = hasFavorites
        ? storesData.filter(s => favoriteStoreIds.has(s.id))
        : storesData;

      setStores(filteredStores.map((s) => s.name));
      const lookup: { [name: string]: string } = {};
      filteredStores.forEach((s) => (lookup[s.name] = s.id));
      setStoresByName(lookup);
    }

    const { data: tripsData, error: tripsError } = await supabase
      .from('trips')
      .select('id, store_id, started_at')
      .eq('household_code', householdCode)
      .is('ended_at', null)
      .order('started_at', { ascending: false });

    if (tripsError) {
      console.error('Error loading trips:', tripsError);
      setActiveTrips({});
    } else {
      const tripsByStore: { [store_id: string]: string } = {};
      const STALE_TRIP_MS = 12 * 60 * 60 * 1000; // 12 hours (User requirement)
      const now = new Date();

      (tripsData ?? []).forEach((trip) => {
        const startTime = new Date(trip.started_at).getTime();
        const isStale = (now.getTime() - startTime) > STALE_TRIP_MS;

        if (isStale) {
          supabase.from('trips').update({ ended_at: now.toISOString() }).eq('id', trip.id).then(({ error }) => {
            if (error) console.error('Failed to auto-close stale trip:', trip.id, error);
            else console.log('Auto-closed stale trip:', trip.id);
          });
        } else {
          // Valid trip
          if (!tripsByStore[trip.store_id]) {
            tripsByStore[trip.store_id] = trip.id;
          }
        }
      });


      setActiveTrips(tripsByStore);
    }

    // Define fetchShoppingList here as it's used within loadData
    // Fetch active notes FIRST so we can use them for both lists
    // Fetch active notes GLOBALLY via API (bypass RLS)
    let notesData: any[] | null = null;
    try {
      const res = await fetch('/api/notes/global');
      if (res.ok) {
        const json = await res.json();
        notesData = json.notes;
      }
    } catch (e) {
      console.error('Failed to load global notes', e);
    }



    // Create lookup for notes
    const notesLookup: Record<number, ItemNote> = {};
    if (notesData) {
      notesData.forEach((n) => {
        notesLookup[n.item_id] = n;
      });
    }



    // ✅ Load all items with IDs
    const { data: itemsData, error: itemsError } = await supabase
      .from('items')
      .select('id, name, category, category_id')
      .eq('user_id', SHARED_USER_ID)
      .order('name');



    if (itemsError) console.error('Error loading items:', itemsError);

    if (itemsData) {
      const itemsWithNotes = (itemsData as ItemRow[]).map(item => ({
        ...item,
        active_note: notesLookup[item.id] || null
      }));
      setAllItems(itemsWithNotes);
      setItems(itemsData.map((i) => i.name));
    }

    // Load favorites from junction table
    const { data: favData } = await supabase
      .from('household_item_favorites')
      .select('item_id')
      .eq('household_code', householdCode);

    const favIds = favData?.map(f => f.item_id) || [];
    setFavoritesIds(favIds);

    // Convert IDs to names for UI
    if (itemsData) {
      const favNames = itemsData.filter((i) => favIds.includes(i.id)).map((i) => i.name);
      setFavorites(favNames);
    }


    // Load Shopping List with Category ID (Join)
    const { data: listData, error: listError } = await supabase
      .from('shopping_list')
      .select(`
        *,
        items!inner (
           category_id,
           category
        )

      `)
      .eq('user_id', SHARED_USER_ID)
      .eq('household_code', householdCode);

    if (listError) console.error('Error loading shopping list:', listError);

    if (listData) {
      if (listData.length > 0) console.log('Raw listData[0]:', listData[0]);
      const transformed: ListItem[] = listData.map((row: any) => {
        // DEBUG LOG first item items join
        if (row.id === listData[0].id) console.log('First row items:', row.items);
        const itemData = Array.isArray(row.items) ? row.items[0] : row.items;
        return {
          id: row.id,
          item_id: row.item_id,
          item_name: row.item_name,
          quantity: row.quantity,
          checked: row.checked,
          is_priority: row.is_priority,
          category_id: itemData?.category_id,
          category: itemData?.category,
          active_note: notesLookup[row.item_id] || null
        };
      });
      setListItems(transformed);
    }

    // Filter prices query by favorite stores if needed
    let pricesQuery = supabase
      .from('price_history')
      .select('*')
      .eq('user_id', SHARED_USER_ID)
      .order('recorded_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (hasFavorites) {
      // Use Array.from because Supabase .in() expects an array, not a Set
      pricesQuery = pricesQuery.in('store_id', Array.from(favoriteStoreIds));
    }

    const { data: pricesData, error: pricesError } = await pricesQuery;

    if (pricesError) console.error('Error loading prices:', pricesError);

    if (pricesData) {
      const pricesObj: { [key: string]: { price: string; date: string } } = {};
      const latestPrices: { [key: string]: any } = {};

      pricesData.forEach((p) => {
        const key = `${p.store}-${p.item_name}`;
        if (!latestPrices[key] ||
          new Date(p.recorded_date) > new Date(latestPrices[key].recorded_date) ||
          (p.recorded_date === latestPrices[key].recorded_date && new Date(p.created_at || 0) > new Date(latestPrices[key].created_at || 0))
        ) {
          latestPrices[key] = p;
          pricesObj[key] = { price: p.price, date: p.recorded_date };
        }
      });

      setPrices(pricesObj);
    }

    // Load deals - items with valid flyer prices that are good deals
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let flyerQuery = supabase
      .from('price_history')
      .select('*')
      .gte('valid_until', today.toISOString())
      .order('recorded_date', { ascending: false });

    if (hasFavorites) {
      flyerQuery = flyerQuery.in('store_id', Array.from(favoriteStoreIds));
    }

    const { data: flyerPrices } = await flyerQuery;

    if (flyerPrices && flyerPrices.length > 0) {
      const dealItems = new Set<string>();

      flyerPrices.forEach((flyer: any) => {
        const itemName = flyer.item_name;
        const flyerPrice = parseFloat(flyer.price);

        // Get all regular prices for this item from price_history
        const itemRegularPrices = pricesData?.filter((p: any) => p.item_name === itemName) || [];
        const itemPrices = itemRegularPrices
          .map((p: any) => parseFloat(p.price))
          .filter((p: number) => !isNaN(p) && p > 0);

        if (itemPrices.length > 0) {
          // Calculate 75th percentile (typical price)
          const sorted = [...itemPrices].sort((a, b) => a - b);
          const index = Math.ceil(sorted.length * 0.75) - 1;
          const percentile75 = sorted[Math.max(0, index)];

          // If flyer price is better than typical price, it's a deal
          if (flyerPrice < percentile75) {
            dealItems.add(itemName);
          }
        }
      });

      setDealsItemNames(dealItems);
    }

    // =========================
    // Recent items (ID-based; preserves checked_at desc order)
    // =========================
    if (!householdCode) {
      setRecentItemIds([]);
    } else {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: recentData, error: recentErr } = await supabase
        .from('shopping_list_events')
        .select('item_id, checked_at')
        .eq('household_code', householdCode)
        .not('checked_at', 'is', null)
        .gte('checked_at', thirtyDaysAgo)
        .order('checked_at', { ascending: false })
        .limit(250);

      if (recentErr) {
        console.error('[RECENT] query error:', recentErr);
        setRecentItemIds([]);
      } else {
        const seen = new Set<number>();
        const uniqueRecentIds = (recentData ?? [])
          .map((r) => r.item_id)
          .filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
          .filter((id) => {
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          })
          .slice(0, 50);

        setRecentItemIds(uniqueRecentIds);
      }
    }


    setLoading(false);
  }, [householdCode]);

  // =========================
  // ✅ ID-based list toggling (so selection doesn’t break on rename)
  // =========================
  const toggleItemById = async (itemId: number, itemName: string) => {
    const inList = listItems.find((li) => li.item_id === itemId);

    try {
      if (inList) {
        const { error } = await supabase.from('shopping_list').delete().eq('id', inList.id).eq('user_id', SHARED_USER_ID);
        if (error) throw new Error(`Failed to remove item: ${error.message}`);
      } else {
        const { data: inserted, error: listErr } = await supabase
          .from('shopping_list')
          .insert({
            item_id: itemId,
            item_name: itemName,
            quantity: 1,
            user_id: SHARED_USER_ID,
            household_code: householdCode,
            checked: false,
            added_at: new Date().toISOString(),
          })
          .select('id, item_id, item_name, quantity, checked')
          .single();

        if (listErr) throw new Error(`Failed to add item: ${listErr.message}`);
        if (inserted) showUndoAddToast(inserted as ListItem);
      }

      await loadData();
    } catch (error) {
      console.error('Error toggling item:', error);
      alert('Failed to update list. Check your connection and try again.');
    }
  };

  const handleInputChange = (value: string) => {
    setNewItem(value);

    if (value.trim()) {
      const listIds = new Set(listItems.map((li) => li.item_id).filter((v) => typeof v === 'number'));

      const availableItems = allItems
        .filter((it) => !listIds.has(it.id))
        .filter((it) => it.name.toLowerCase().includes(value.toLowerCase()))
        .map((it) => it.name);

      setAutocompleteItems(availableItems);
      setShowAutocomplete(availableItems.length > 0);
    } else {
      setAutocompleteItems([]);
      setShowAutocomplete(false);
    }
  };

  // Realtime Subscription
  useEffect(() => {
    if (!householdCode) return;

    const channel = supabase
      .channel('shopping_list_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopping_list',
          filter: `household_code=eq.${householdCode}`,
        },
        () => {
          console.log('Realtime update received');
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdCode, loadData]);

  const selectItem = async (itemName: string) => {
    setShowAutocomplete(false);
    setAutocompleteItems([]);
    setNewItem('');

    try {
      let itemId: number | null = null;

      const { data: existingItem } = await supabase
        .from('items')
        .select('id')
        .eq('name', itemName)
        .eq('user_id', SHARED_USER_ID)
        .maybeSingle();

      if (existingItem) {
        itemId = existingItem.id;
      } else {
        const { data: newItemData, error: itemError } = await supabase
          .from('items')
          .insert({
            name: itemName,
            user_id: SHARED_USER_ID,
            household_code: householdCode,
            is_favorite: false,
          })
          .select('id')
          .single();

        if (itemError || !newItemData) throw new Error('Failed to create item');
        itemId = newItemData.id;
      }

      if (itemId) {
        const alreadyInList = listItems.some((li) => li.item_id === itemId);
        if (!alreadyInList) {
          const { data: inserted, error: listError } = await supabase
            .from('shopping_list')
            .insert({
              item_id: itemId,
              item_name: itemName,
              quantity: 1,
              user_id: SHARED_USER_ID,
              household_code: householdCode,
              checked: false,
              added_at: new Date().toISOString(),
            })
            .select('id, item_id, item_name, quantity, checked')
            .single();

          if (listError) throw new Error(`Failed to add to shopping list: ${listError.message}`);
          if (inserted) showUndoAddToast(inserted as ListItem);
        }
      }

      await loadData();
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to add item. Check your connection and try again.');
    }
  };

  const addNewItem = async () => {
    if (!newItem.trim()) return;

    const itemName = newItem.trim();

    try {
      let itemId: number | null = null;

      const { data: existingItem } = await supabase
        .from('items')
        .select('id')
        .eq('name', itemName)
        .eq('user_id', SHARED_USER_ID)
        .maybeSingle();

      if (existingItem) {
        itemId = existingItem.id;
      } else {
        const { data: newItemData, error: itemError } = await supabase
          .from('items')
          .insert({
            name: itemName,
            user_id: SHARED_USER_ID,
            household_code: householdCode,
            is_favorite: false,
          })
          .select('id')
          .single();

        if (itemError || !newItemData) throw new Error(`Failed to create item: ${itemError?.message}`);
        itemId = newItemData.id;
      }

      if (itemId) {
        const alreadyInList = listItems.some((li) => li.item_id === itemId);
        if (!alreadyInList) {
          const { data: inserted, error: listError } = await supabase
            .from('shopping_list')
            .insert({
              item_id: itemId,
              item_name: itemName,
              quantity: 1,
              user_id: SHARED_USER_ID,
              household_code: householdCode,
              checked: false,
              added_at: new Date().toISOString(),
            })
            .select('id, item_id, item_name, quantity, checked')
            .single();

          if (listError) throw new Error(`Failed to add to shopping list: ${listError.message}`);
          if (inserted) showUndoAddToast(inserted as ListItem);
        }
      }

      setNewItem('');
      setShowAutocomplete(false);
      setAutocompleteItems([]);

      await loadData();
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item. Check your connection and try again.');
    }
  };

  const addFavorites = async () => {
    try {
      // Use ID-based list membership where possible (still sourced from names)
      for (const itemName of favorites) {
        // Find the itemId from allItems first (fast path)
        const match = allItems.find((it) => it.name === itemName);
        const itemId = match?.id;

        if (!itemId) {
          // fallback (in case allItems not loaded yet for some reason)
          const { data: item } = await supabase.from('items').select('id').eq('name', itemName).eq('user_id', SHARED_USER_ID).single();
          if (!item?.id) continue;
          if (listItems.some((li) => li.item_id === item.id)) continue;

          const { error } = await supabase.from('shopping_list').insert({
            item_id: item.id,
            item_name: itemName,
            quantity: 1,
            user_id: SHARED_USER_ID,
            household_code: householdCode,
            checked: false,
            added_at: new Date().toISOString(),
          });
          if (error) throw new Error(`Failed to add ${itemName}: ${error.message}`);
          continue;
        }

        if (listItems.some((li) => li.item_id === itemId)) continue;

        const { error } = await supabase.from('shopping_list').insert({
          item_id: itemId,
          item_name: itemName,
          quantity: 1,
          user_id: SHARED_USER_ID,
          household_code: householdCode,
          checked: false,
          added_at: new Date().toISOString(),
        });
        if (error) throw new Error(`Failed to add ${itemName}: ${error.message}`);
      }

      loadData();
    } catch (error) {
      console.error('Error adding favorites:', error);
      alert('Failed to add favorites. Check your connection and try again.');
    }
  };

  const PencilIcon = ({ className }: { className?: string }) => (
    <svg className={className ?? 'w-4 h-4 inline'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );

  const updateQuantity = async (id: string, quantity: number) => {
    if (quantity < 1) return;

    try {
      const { error } = await supabase.from('shopping_list').update({ quantity }).eq('id', id).eq('user_id', SHARED_USER_ID);
      if (error) throw new Error(`Failed to update quantity: ${error.message}`);

      setListItems(listItems.map((item) => (item.id === id ? { ...item, quantity } : item)));
    } catch (error) {
      console.error('Error updating quantity:', error);
      alert('Failed to update quantity. Check your connection and try again.');
    }
  };

  const togglePriority = async (id: string) => {
    const item = listItems.find((li) => li.id === id);
    if (!item) return;

    const newPriority = !item.is_priority;

    try {
      const { error } = await supabase
        .from('shopping_list')
        .update({ is_priority: newPriority })
        .eq('id', id)
        .eq('user_id', SHARED_USER_ID);

      if (error) throw error;

      setListItems(listItems.map((li) => (li.id === id ? { ...li, is_priority: newPriority } : li)));
    } catch (error) {
      console.error('Error toggling priority:', error);
      alert('Failed to update priority. Check your connection and try again.');
    }
  };

  const toggleChecked = async (id: string) => {
    const item = listItems.find((li) => li.id === id);
    if (!item) return;

    const newCheckedState = !item.checked;

    try {
      const nextListItems = listItems.map((li) =>
        li.id === id ? { ...li, checked: newCheckedState } : li
      );
      setListItems(nextListItems);

      if (newCheckedState) {
        let effectiveStoreName = getEffectiveStore(item.item_name);

        // IMPLICIT STORE SWAP: If we have an active pinned store AND it has a verified active trip in DB
        // This prevents swapping when just "looking" at a pinned store or if the trip is stale
        if (myActiveStoreId && effectiveStoreName && activeTrips[myActiveStoreId]) {
          const activeStoreName = Object.keys(storesByName).find(key => storesByName[key] === myActiveStoreId);

          if (activeStoreName && activeStoreName !== effectiveStoreName) {
            console.log(`Implicitly swapping ${item.item_name} from ${effectiveStoreName} to active store ${activeStoreName}`);
            setItemStorePreference(item.item_name, activeStoreName);
            effectiveStoreName = activeStoreName; // Override for downstream logic
          }
        }

        if (effectiveStoreName) {
          // AUTO-PIN: When checking an item, pin this store locally
          const storeId = storesByName[effectiveStoreName];
          if (storeId) pinStore(storeId);

          const uncheckedRemainingForStore = nextListItems.some((li) => {
            const s = getEffectiveStore(li.item_name);
            // Check implicit swap consequences in local state calculation? 
            // We just updated pref, so getEffectiveStore might not reflect immediately in render 
            // but for this calculation we should assume the swap happened.
            // Actually getEffectiveStore uses `storePrefs` state which was just set via setItemStorePreference...
            // React state updates aren't immediate.
            // However, `setItemStorePreference` updates the `storePrefs` state asynchronously.
            // For the purpose of "Trip Complete" toast, this might be slightly off for one frame, 
            // but the Critical part is sending the correct store_id to the API.
            return s === effectiveStoreName && !li.checked;
          });

          if (!uncheckedRemainingForStore) {
            setTimeout(() => {
              showTripCompleteToast(effectiveStoreName);
              // Optional: Clear pin when trip complete? 
              // keeping it pinned might be safer until they explicitly move or leave.
            }, TRIP_COMPLETE_DELAY_MS);
          }
        }

        const effectiveStoreId = effectiveStoreName ? storesByName[effectiveStoreName] : null;

        const response = await fetch('/api/shopping-list/check-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopping_list_id: id,
            store_id: effectiveStoreId,
            last_trip_id: activeTrips[effectiveStoreId || ''] // pass current trip ID if exists to detect new one
          }),
        });

        const data = await response.json();

        if (!response.ok) throw new Error('Failed to check item');

        await loadData();

        // Check if we created a NEW trip implicitly (only if we didn't have one before)
        if (data.trip_created && data.trip_id && effectiveStoreName) {
          showTripStartedToast(effectiveStoreName, data.trip_id, id);
        } else {
          // 🔔 SHOW TOAST (Standard check off)
          showCheckedOffListToast(item);
        }

      } else {
        const { error } = await supabase.from('shopping_list').update({ checked: false }).eq('id', id);
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling item:', error);
      setListItems(listItems.map((li) => (li.id === id ? { ...li, checked: !newCheckedState } : li)));
      alert('Failed to check item. Check your connection and try again.');
    }
  };

  const removeItem = async (id: string) => {
    const item = listItems.find((li) => li.id === id);
    if (!item) return;

    setListItems(listItems.filter((li) => li.id !== id));
    setUndoRemoveItem(item);

    if (removedFromListToastTimeout) clearTimeout(removedFromListToastTimeout);

    const timeout = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('shopping_list')
          .delete()
          .eq('id', id)
          .eq('household_code', householdCode); // Changed from user_id + SHARED_USER_ID

        if (error) throw new Error(`Failed to remove item: ${error.message}`);
      } catch (error) {
        console.error('Error removing item:', error);
        setListItems((prev) => [...prev, item]);
        alert('Failed to remove item. Check your connection and try again.');
      } finally {
        setUndoRemoveItem(null);
        setUndoRemoveTimeout(null);
      }
    }, 2500);

    setUndoRemoveTimeout(timeout);
  };

  const undoRemove = () => {
    if (!removedFromListToastItem) return;

    if (removedFromListToastTimeout) {
      clearTimeout(removedFromListToastTimeout);
      setUndoRemoveTimeout(null);
    }

    setListItems((prev) => [...prev, removedFromListToastItem]);
    setUndoRemoveItem(null);
  };

  const clearList = async () => {
    if (!confirm('Clear entire shopping list?')) return;

    try {
      const { error } = await supabase.from('shopping_list').delete().eq('user_id', SHARED_USER_ID).eq('household_code', householdCode);
      if (error) throw new Error(`Failed to clear list: ${error.message}`);
      setListItems([]);
    } catch (error) {
      console.error('Error clearing list:', error);
      alert('Failed to clear list. Check your connection and try again.');
    }
  };

  const getDaysAgo = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    }
    const years = Math.floor(diffDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  };

  const getPriceClassification = (itemName: string, currentPrice: number) => {
    const itemPrices: number[] = [];
    stores.forEach((store) => {
      const priceData = prices[`${store}-${itemName}`];
      if (priceData) itemPrices.push(parseFloat(priceData.price));
    });

    if (itemPrices.length === 0) return null;

    const minPrice = Math.min(...itemPrices);
    const percentAboveMin = ((currentPrice - minPrice) / minPrice) * 100;
    const percentInt = Math.round(percentAboveMin);

    if (currentPrice === minPrice) {
      return { label: 'Best Price', mobileLabel: 'Best Price', emoji: '✅', color: 'text-green-600' };
    }

    if (percentAboveMin <= 10) {
      return { label: `Close Enough (${percentInt}% more)`, mobileLabel: `Close Enough (${percentInt}% more)`, emoji: '➖', color: 'text-yellow-600' };
    }

    return { label: `Skip This One (${percentInt}% more)`, mobileLabel: `Skip (${percentInt}% more)`, emoji: '❌', color: 'text-red-600' };
  };

  const calculateBestStore = () => {
    const storeData: { [store: string]: { total: number; coverage: number; itemCount: number } } = {};

    stores.forEach((store) => {
      let total = 0;
      let coverage = 0;

      listItems.forEach((item) => {
        const priceData = prices[`${store}-${item.item_name}`];
        if (priceData) {
          const price = parseFloat(priceData.price);
          total += price * item.quantity;
          coverage++;
        }
      });

      storeData[store] = { total, coverage, itemCount: listItems.length };
    });

    return storeData;
  };

  const storeData = calculateBestStore();
  const sortedStores = Object.entries(storeData)
    .filter(([, data]) => data.coverage > 0)
    .sort(([, a], [, b]) => {
      if (b.coverage !== a.coverage) return b.coverage - a.coverage;
      return a.total - b.total;
    });

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // ✅ letter filter now works on allItems rows
  const filteredItemRows =
    filterLetter === 'All'
      ? [...allItems].sort((a, b) => a.name.localeCompare(b.name))
      : [...allItems]
        .filter((it) => it.name.toUpperCase().startsWith(filterLetter))
        .sort((a, b) => a.name.localeCompare(b.name));

  const filteredItems = filteredItemRows.map((it) => it.name);

  const filteredFavorites = filterLetter === 'All' ? favorites : favorites.filter((item) => item.toUpperCase().startsWith(filterLetter));
  const allFavoritesSelected = favorites.length > 0 && favorites.every((fav) => listItems.find((li) => li.item_name === fav));

  // ✅ ID-based “already on list” set
  const listItemIdsSet = new Set(listItems.map((li) => li.item_id));

  // =========================
  // Build Mode (ID-based)
  // =========================

  // 1) IDs already on the shopping list
  const listIds = new Set<number>(
    listItems
      .map((li) => li.item_id)
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
  );

  // 2) available items = all items minus what’s already on the list
  const buildModeAvailableAll = allItems.filter((it) => !listIds.has(it.id));

  // 3) recent ranking (0 = most recent)
  const recentRank = new Map<number, number>();
  recentItemIds.forEach((id, idx) => recentRank.set(id, idx));

  // 4) filter pills logic
  const favoriteIdSet = new Set<number>(favoritesIds);

  const buildModeAllCount = buildModeAvailableAll.length;
  const buildModeFavoritesCount = buildModeAvailableAll.filter((it) => favoriteIdSet.has(it.id)).length;
  const buildModeRecentCount = buildModeAvailableAll.filter((it) => recentRank.has(it.id)).length;

  const favoriteNameSet = new Set(favorites);

  const buildModeAvailableItems =
    selectItemsFilter === 'FAVORITES'
      ? buildModeAvailableAll.filter((it) => favoriteNameSet.has(it.name))
      : selectItemsFilter === 'RECENT'
        ? buildModeAvailableAll
          .filter((it) => recentRank.has(it.id))
          .sort((a, b) => (recentRank.get(a.id) ?? Infinity) - (recentRank.get(b.id) ?? Infinity))
        : buildModeAvailableAll;


  return (
    <div className="min-h-screen bg-blue-500 bg-gradient-to-br from-blue-500 to-green-400">
      <div className="sticky top-0 z-50 bg-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-xl font-bold text-gray-800 hover:text-indigo-600 transition flex items-center gap-2">
              <span className="text-2xl hidden lg:inline">ᯓ</span>
              <span className="hidden lg:inline">SmartSaveAI</span>
            </Link>
            <Header currentPage="Shopping List" />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-2 md:px-4 py-4">
        {/* Mobile-only mode toggle */}
        <div className="md:hidden rounded-lg p-2 mb-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMobileMode('build')}
              className={`py-2 rounded-lg text-sm cursor-pointer transition ${mobileMode === 'build' ? 'bg-indigo-600 text-white font-bold text-lg' : 'bg-gray-50 text-gray-400 text-base'
                }`}
            >
              Build Mode
            </button>
            <button
              onClick={() => setMobileMode('store')}
              className={`py-2 rounded-lg text-sm cursor-pointer transition ${mobileMode === 'store' ? 'bg-indigo-600 text-white font-bold text-lg' : 'bg-gray-50 text-gray-400 text-base'
                }`}
            >
              Store Mode
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:gap-6 md:items-start">
          {/* LEFT COLUMN: Filter, Search, Select Items */}
          <div className="w-full md:w-2/5 space-y-4">

            {/* Alphabet Filter - Desktop + Mobile (Build Mode only) */}
            <div
              className={`${isMobile ? (mobileMode === 'build' ? 'block' : 'hidden') : 'hidden md:block'} bg-white rounded-2xl shadow-lg p-3 md:p-4`}
            >
              <div className="flex flex-wrap gap-1.5 md:gap-2 justify-center">
                <button
                  onClick={() => setFilterLetter('All')}
                  className={`px-2.5 py-1.5 md:px-3 md:py-1 rounded text-sm md:text-base font-semibold cursor-pointer transition ${filterLetter === 'All' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  All
                </button>
                {alphabet
                  .filter((letter) => allItems.some((it) => it.name.toUpperCase().startsWith(letter)))
                  .map((letter) => (
                    <button
                      key={letter}
                      onClick={() => toggleLetter(letter)}
                      className={`px-2.5 py-1.5 md:px-3 md:py-1 rounded text-sm md:text-base font-semibold cursor-pointer transition ${filterLetter === letter ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      {letter}
                    </button>
                  ))}
              </div>
            </div>

            {/* Add to List Widget - Desktop + Mobile(Build) */}
            {(!isMobile || mobileMode === 'build') && (
              <div className="bg-white rounded-2xl shadow-lg p-4">
                <h2 className="text-xl font-semibold mb-3 text-gray-800">Search Items</h2>

                <div className="relative autocomplete-container">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search items or add new"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
                      value={newItem}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addNewItem()}
                      onFocus={() => {
                        const listIds = new Set(
                          listItems.map((li) => li.item_id).filter((v) => typeof v === 'number')
                        );
                        const available = allItems
                          .filter((it) => !listIds.has(it.id))
                          .map((it) => it.name);

                        setAutocompleteItems(available);
                        setShowAutocomplete(available.length > 0);
                      }}
                    />

                    <button
                      onClick={addNewItem}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-2xl font-semibold hover:bg-indigo-700 cursor-pointer transition whitespace-nowrap"
                    >
                      Add
                    </button>
                  </div>

                  {showAutocomplete && autocompleteItems.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-2xl shadow-lg max-h-60 overflow-y-auto">
                      {autocompleteItems.slice(0, 10).map((item) => (
                        <button
                          key={item}
                          onClick={() => selectItem(item)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-gray-800"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Combined Select Items Widget - Desktop + Mobile(Build) */}
            {((isMobile && mobileMode === 'build') || !isMobile) && (
              <div className="bg-white rounded-2xl shadow-lg p-4">
                {(() => {
                  // ------------------------------------------------------------
                  // Make build mode respect the Alphabet Filter (filterLetter)
                  // across ALL 3 filters: ALL / FAVORITES / RECENT
                  // ------------------------------------------------------------

                  let list: ItemRow[] = buildModeAvailableAll;


                  if (selectItemsFilter === 'FAVORITES') {
                    const favSet = new Set(favorites);
                    list = list.filter((it) => favSet.has(it.name));
                  } else if (selectItemsFilter === 'RECENT') {
                    list = list
                      .filter((it) => recentRank.has(it.id))
                      .sort((a, b) => (recentRank.get(a.id) ?? Infinity) - (recentRank.get(b.id) ?? Infinity));
                  } else if (selectItemsFilter === 'FREQUENT') {
                    list = list
                      .filter((it) => frequentItemCounts[it.name] !== undefined)
                      .sort((a, b) => (frequentItemCounts[b.name] || 0) - (frequentItemCounts[a.name] || 0));
                  } else {
                    list = list.slice();
                  }

                  if (filterLetter !== 'All') {
                    const L = filterLetter.toUpperCase();
                    list = list.filter((it) => it.name.toUpperCase().startsWith(L));
                  }

                  const renderList = list.slice(0, 250);

                  const toggleFavorite = async (itemName: string) => {
                    if (!householdCode) return;

                    // Find item ID
                    const item = allItems.find(i => i.name === itemName);
                    if (!item) return;

                    const isFav = favorites.includes(itemName);

                    // Optimistically update UI
                    if (isFav) {
                      setFavorites(prev => prev.filter(n => n !== itemName));
                      setFavoritesIds(prev => prev.filter(id => id !== item.id));
                    } else {
                      setFavorites(prev => [...prev, itemName]);
                      setFavoritesIds(prev => [...prev, item.id]);
                    }

                    // Update database
                    if (isFav) {
                      const { error } = await supabase
                        .from('household_item_favorites')
                        .delete()
                        .eq('household_code', householdCode)
                        .eq('item_id', item.id);

                      if (error) {
                        // Rollback on error
                        setFavorites(prev => [...prev, itemName]);
                        setFavoritesIds(prev => [...prev, item.id]);
                        alert('Failed to update favorite. Check your connection and try again.');
                      }
                    } else {
                      const { error } = await supabase
                        .from('household_item_favorites')
                        .insert({
                          household_code: householdCode,
                          item_id: item.id,
                        });

                      if (error) {
                        // Rollback on error
                        setFavorites(prev => prev.filter(n => n !== itemName));
                        setFavoritesIds(prev => prev.filter(id => id !== item.id));
                        alert('Failed to update favorite. Check your connection and try again.');
                      }
                    }
                  };

                  // Filter Counts
                  const countFav = buildModeAvailableAll.filter((it) => favorites.includes(it.name)).length;
                  const countRecent = buildModeAvailableAll.filter((it) => recentRank.has(it.id)).length;
                  const countFrequent = buildModeAvailableAll.filter((it) => frequentItemCounts[it.name] !== undefined).length;

                  // Toggle Logic
                  const toggleFilter = (filter: SelectItemsFilter) => {
                    if (selectItemsFilter === filter) {
                      setSelectItemsFilter(null); // Toggle off -> All
                    } else {
                      setSelectItemsFilter(filter);
                    }
                  };

                  return (
                    <>
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center mb-1">
                          <h2 className="text-xl font-semibold text-gray-800">Select Items</h2>
                          <span className="text-xs text-gray-500">{list.length} available</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 w-full mb-4">
                          {/* 1. Favorites */}
                          <button
                            onClick={() => toggleFilter('FAVORITES')}
                            className={`py-1.5 rounded-2xl border transition text-sm font-bold truncate cursor-pointer ${selectItemsFilter === 'FAVORITES'
                              ? 'bg-amber-600 text-white border-amber-600 shadow-md transform scale-105'
                              : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-300'
                              }`}
                          >
                            Favorites
                          </button>

                          {/* 2. Frequent */}
                          <button
                            onClick={() => toggleFilter('FREQUENT')}
                            className={`py-1.5 rounded-2xl border transition text-sm font-bold truncate cursor-pointer ${selectItemsFilter === 'FREQUENT'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105'
                              : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300'
                              }`}
                          >
                            Frequent
                          </button>

                          {/* 3. Recent */}
                          <button
                            onClick={() => toggleFilter('RECENT')}
                            className={`py-1.5 rounded-2xl border transition text-sm font-bold truncate cursor-pointer ${selectItemsFilter === 'RECENT'
                              ? 'bg-red-500 text-white border-red-500 shadow-md transform scale-105'
                              : 'bg-white text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300'
                              }`}
                          >
                            Recent
                          </button>
                        </div>


                      </div>

                      {list.length === 0 ? (
                        <div className="text-gray-500 text-center py-8">
                          {selectItemsFilter === 'FAVORITES' ? (
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-4xl">⭐</span>
                              <p className="font-semibold text-gray-700">No favorites yet</p>
                              <p className="text-sm">Star items to easily find them here.</p>
                              <p className="text-sm">Click the Favorites tab again to clear the filter.</p>
                            </div>
                          ) : selectItemsFilter === 'FREQUENT' ? (
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-4xl">📈</span>
                              <p className="font-semibold text-gray-700">No frequently bought items</p>
                              <p className="text-sm">Items you buy often will appear here.</p>
                              <p className="text-sm">Click the Frequent tab again to clear the filter.</p>
                            </div>
                          ) : selectItemsFilter === 'RECENT' ? (
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-4xl">🕒</span>
                              <p className="font-semibold text-gray-700">No recent items</p>
                              <p className="text-sm">Items you've bought recently will appear here.</p>
                              <p className="text-sm">Click the Recent tab again to clear the filter.</p>
                            </div>
                          ) : (
                            <div className="text-sm">All items for this letter are already in your list.</div>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 max-h-96 md:max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                          {renderList.map((it: ItemRow) => {
                            const isFavorite = favorites.includes(it.name);

                            // ✅ Price logic
                            const effStore = getEffectiveStore(it.name);
                            const priceData = effStore ? prices[`${effStore}-${it.name}`] : null;
                            const price = priceData?.price ? parseFloat(priceData.price) : 0;

                            return (
                              <div
                                key={it.id}
                                className={`flex flex-wrap items-center gap-3 p-3 rounded-2xl border transition ${isFavorite
                                  ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                                  : 'bg-white border-gray-300 hover:bg-gray-50'
                                  }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <button
                                    onClick={() => {
                                      openEditModal({
                                        id: '', // Virtual ID
                                        item_id: it.id,
                                        item_name: it.name,
                                        quantity: 1, // Default
                                        checked: false,
                                        is_priority: false,
                                        category_id: it.category_id,
                                        category: it.category
                                      });
                                    }}
                                    className="font-medium text-gray-800 hover:text-teal-600 cursor-pointer text-left break-words"
                                  >
                                    {it.name}
                                  </button>

                                  {priceData ? (
                                    <p className="text-xs text-green-600 mt-0.5">
                                      {formatMoney(price)}{' '}
                                      <span className="text-gray-400 ml-1">
                                        ({getDaysAgo(priceData.date)}, {effStore})
                                      </span>
                                    </p>
                                  ) : (
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      No price data available
                                    </p>
                                  )}

                                  {/* Active Note Preview */}
                                  {it.active_note && (
                                    <div className="mt-1 flex items-start gap-1 p-1 bg-orange-50 border border-orange-100 rounded text-xs text-orange-800 max-w-fit">
                                      <span className="select-none text-xs">⚠️</span>
                                      <div className="flex-1">
                                        <span className="font-semibold line-clamp-1">{it.active_note.note}</span>
                                        {it.active_note.store_id && (
                                          <div className="text-[10px] text-orange-600">
                                            at {Object.keys(storesByName).find(name => storesByName[name] === it.active_note?.store_id) || 'Unknown Store'}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <button
                                  onClick={() => toggleItemById(it.id, it.name)}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition cursor-pointer"

                                >
                                  Add
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

          </div>

          {/* RIGHT COLUMN: Shopping List */}
          <div className="w-full md:w-3/5 mt-2 md:mt-0">

            {/* SHOPPING LIST MODAL */}

            {loading ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
                <p className="text-slate-500 mt-4">Loading Shopping List...</p>
              </div>
            ) : listItems.length > 0 ? (
              <>
                {/* SHOPPING LIST HEADER */}
                <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                      <span className="block">Shopping List</span>
                      <span className="block text-base font-normal text-gray-600">({listItems.filter((i) => !i.checked && (!showPriorityOnly || i.is_priority)).length} items)</span>

                    </h2>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => setShowPriorityOnly(!showPriorityOnly)}
                        className={`text-sm px-3 py-1 rounded-full font-bold transition flex items-center gap-1.5 cursor-pointer ${showPriorityOnly
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'
                          }`}
                        title="Show Urgent Items Only"
                      >
                        <svg className="w-4 h-4" fill={showPriorityOnly ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V5h13l-3 4 3 4H3" />
                        </svg>
                        {showPriorityOnly ? 'Flagged Only' : 'Flagged'}
                      </button>

                      {listItems.some((i) => i.checked) && (
                        <button
                          onClick={() => setShowCheckedItems(!showCheckedItems)}
                          className="text-xs text-gray-600 hover:text-gray-800 font-semibold cursor-pointer"
                        >
                          {showCheckedItems ? 'Hide Checked' : 'Show Checked'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Group items by effective store (Auto or override) */}
                  {(() => {
                    const itemsByStore: { [store: string]: ListItem[] } = {};
                    const itemsWithoutPrice: ListItem[] = [];

                    let displayItems = !showCheckedItems ? listItems.filter((item) => !item.checked) : listItems;

                    // ✅ Priority Filter
                    if (showPriorityOnly) {
                      displayItems = displayItems.filter((item) => item.is_priority);
                    }

                    displayItems
                      .sort((a, b) => {
                        const aIsFav = favorites.includes(a.item_name);
                        const bIsFav = favorites.includes(b.item_name);
                        if (aIsFav && !bIsFav) return -1;
                        if (!aIsFav && bIsFav) return 1;
                        return a.item_name.localeCompare(b.item_name);
                      })
                      .forEach((item) => {
                        const effStore = getEffectiveStore(item.item_name);
                        if (effStore) {
                          if (!itemsByStore[effStore]) itemsByStore[effStore] = [];
                          itemsByStore[effStore].push(item);
                        } else {
                          itemsWithoutPrice.push(item);
                        }
                      });

                    const storeEntries = Object.entries(itemsByStore).sort(([storeA], [storeB]) => {
                      const storeIdA = storesByName[storeA];
                      const storeIdB = storesByName[storeB];

                      const hasActiveTripA = storeIdA && activeTrips[storeIdA];
                      const hasActiveTripB = storeIdB && activeTrips[storeIdB];

                      if (hasActiveTripA && !hasActiveTripB) return -1;
                      if (!hasActiveTripA && hasActiveTripB) return 1;

                      return storeA.localeCompare(storeB);
                    });

                    return (
                      <div className="space-y-6">

                        {/* Show First: Active trip stores */}
                        {storeEntries
                          .filter(([store]) => {
                            const storeId = storesByName[store];
                            return storeId && activeTrips[storeId];
                          })
                          .sort(([storeA], [storeB]) => {
                            const idA = storesByName[storeA];
                            const idB = storesByName[storeB];
                            const isPinnedA = idA === myActiveStoreId;
                            const isPinnedB = idB === myActiveStoreId;

                            if (isPinnedA && !isPinnedB) return -1;
                            if (!isPinnedA && isPinnedB) return 1;

                            return storeA.localeCompare(storeB);
                          })
                          .map(([store, storeItems]) => {
                            const storeId = storesByName[store];
                            const hasActiveTrip = !!(storeId && activeTrips[storeId]);
                            const isPinned = storeId === myActiveStoreId;

                            return (
                              <div key={store} className="rounded-2xl border-2 border-indigo-300 bg-white shadow-sm overflow-hidden">
                                <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2 justify-between bg-indigo-50 p-3.5 border-b border-indigo-100">
                                  <div className="flex items-center gap-3">
                                    <span className="bg-indigo-500 text-white font-bold px-4 py-1.5 rounded-full text-sm flex items-center shadow-sm">
                                      {isPinned && <span className="mr-1.5" title="Pinned to top">📍</span>}
                                      {store}
                                      <span className="font-bold ml-1">(Active)</span>
                                    </span>

                                    <button
                                      onClick={() => endTrip(activeTrips[storeId], storeId)}
                                      className="bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm"
                                    >
                                      Complete
                                    </button>
                                    <span className="text-sm text-gray-500 font-medium">
                                      {storeItems.length} {storeItems.length === 1 ? 'item' : 'items'}
                                    </span>
                                  </div>
                                  <span className="text-xl font-bold text-teal-700">
                                    $
                                    {storeItems
                                      .reduce((sum, item) => {
                                        const priceData = prices[`${store}-${item.item_name}`];
                                        const price = priceData?.price ? parseFloat(priceData.price) : 0;
                                        return sum + price * item.quantity;
                                      }, 0)
                                      .toFixed(2)}
                                  </span>
                                </h3>

                                {/* ONE cohesive store panel, categories are sections inside */}
                                <div className="p-3 space-y-4">
                                  {Object.entries(
                                    storeItems.reduce((acc: Record<string, typeof storeItems>, item) => {
                                      const cat = getCategoryName(item.category_id ?? -1);
                                      (acc[cat] ||= []).push(item);
                                      return acc;
                                    }, {})
                                  )
                                    // Sort categories by rank
                                    .sort(([catA], [catB]) => {
                                      const orderA = categoryOrder[catA || 'Other'] || 999;
                                      const orderB = categoryOrder[catB || 'Other'] || 999;
                                      if (orderA !== orderB) return orderA - orderB;
                                      return catA.localeCompare(catB);
                                    })
                                    .map(([category, categoryItems]) => {
                                      // Items within category: unchecked first, then alpha
                                      categoryItems.sort((a, b) => {
                                        if (a.checked !== b.checked) return a.checked ? 1 : -1;
                                        return a.item_name.localeCompare(b.item_name);
                                      });

                                      const categoryTotal = categoryItems.reduce((sum, item) => {
                                        const effStore = getEffectiveStore(item.item_name) || store;
                                        const priceData = prices[`${effStore}-${item.item_name}`];
                                        const price = priceData?.price ? parseFloat(priceData.price) : 0;
                                        return sum + price * item.quantity;
                                      }, 0);

                                      return (
                                        <div key={category} className="space-y-2">
                                          {/* Category header bar (tinted), NOT a separate card */}
                                          <div
                                            className={`flex items-center justify-between px-3 py-2 rounded-xl border ${getCategoryColor(
                                              category
                                            )}`}
                                          >
                                            <div className="font-bold text-gray-700">{category}</div>
                                            <div className="text-sm font-bold text-teal-600">${categoryTotal.toFixed(2)}</div>
                                          </div>

                                          {/* Items */}
                                          <div className="space-y-2">
                                            {categoryItems.map((item) => {
                                              const isFavorite = !hasActiveTrip && favorites.includes(item.item_name);
                                              const effStore = getEffectiveStore(item.item_name) || store;
                                              const priceData = prices[`${effStore}-${item.item_name}`];
                                              const price = priceData?.price ? parseFloat(priceData.price) : 0;
                                              const cat = getCategoryName(item.category_id ?? -1);
                                              const missingCategory = !cat || cat.trim() === '' || cat === 'Other';

                                              return (
                                                <div
                                                  key={item.id}
                                                  className={`flex flex-wrap items-center gap-3 p-3 rounded-2xl border transition ${item.checked
                                                    ? 'bg-gray-100 border-gray-300'
                                                    : isFavorite
                                                      ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                                                      : 'bg-white border-gray-300 hover:bg-gray-50'
                                                    }`}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={item.checked}
                                                    disabled={mobileMode == 'build'}
                                                    onChange={() => {
                                                      if (mobileMode == 'build') return;
                                                      toggleChecked(item.id);
                                                    }}
                                                    className={`w-5 h-5 rounded transition ${mobileMode == 'build' ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
                                                      }`}
                                                  />

                                                  <div className="flex-1 min-w-[160px]">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      <button
                                                        type="button"
                                                        onClick={() => openEditModal(item)}
                                                        className={`font-medium hover:text-teal-600 text-left cursor-pointer ${item.checked ? 'text-gray-500 line-through' : 'text-gray-800'
                                                          }`}
                                                      >
                                                        {dealsItemNames.has(item.item_name) && (
                                                          <span className="mr-1" title="On sale today!">🔥</span>
                                                        )}
                                                        {item.item_name}
                                                        {item.quantity > 1 && (
                                                          <span className="ml-1 font-bold text-indigo-600">
                                                            (Qty: {item.quantity})
                                                          </span>
                                                        )}
                                                      </button>
                                                    </div>

                                                    <div className="mt-0.5 flex items-center gap-2">
                                                      <p className="text-xs text-green-600 min-w-0">
                                                        {formatMoney(price)}{' '}
                                                        {item.quantity > 1 && `× ${item.quantity} = ${formatMoney(price * item.quantity)}`}
                                                        {priceData?.date ? (
                                                          <span className="text-gray-400 ml-1">({getDaysAgo(priceData.date)})</span>
                                                        ) : null}
                                                      </p>

                                                      {missingCategory && (
                                                        <button
                                                          onClick={() => openEditModal(item, 'category')}
                                                          className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition inline-block"
                                                        >
                                                          Add Category
                                                        </button>
                                                      )}
                                                    </div>

                                                    {/* Active Note Display */}
                                                    {item.active_note && (!item.active_note.store_id || item.active_note.store_id === storeId) && (
                                                      <div className="mt-1 flex items-start gap-1 p-2 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
                                                        <span className="text-base select-none">⚠️</span>
                                                        <div className="flex-1">
                                                          <span className="font-semibold">{item.active_note.note}</span>
                                                          <div className="text-xs text-orange-600 flex gap-2 mt-0.5">
                                                            {item.active_note.store_id && (
                                                              <span>at {Object.keys(storesByName).find(name => storesByName[name] === item.active_note?.store_id) || 'Unknown Store'}</span>
                                                            )}
                                                            <span>• {new Date(item.active_note.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                                            <button
                                                              onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (!item.active_note) return;
                                                                // Optimistic clear
                                                                setListItems(prev => prev.map(li => li.id === item.id ? { ...li, active_note: undefined } : li));
                                                                await supabase.from('item_notes').update({ is_active: false }).eq('id', item.active_note.id);
                                                              }}
                                                              className="text-orange-700 hover:text-orange-900 underline ml-auto"
                                                            >
                                                              Clear
                                                            </button>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>

                                                  <div className="flex items-center gap-3 ml-auto">


                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        togglePriority(item.id);
                                                      }}
                                                      className={`cursor-pointer ml-1 transition ${item.is_priority
                                                        ? 'text-red-600 hover:text-red-700'
                                                        : 'text-gray-300 hover:text-red-400'
                                                        }`}
                                                      title={item.is_priority ? "Unmark Urgent" : "Mark Urgent"}
                                                    >
                                                      <svg className="w-5 h-5" fill={item.is_priority ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V5h13l-3 4 3 4H3" />
                                                      </svg>
                                                    </button>

                                                    <button
                                                      onClick={() => openStoreModal(item.item_name)}
                                                      className={`cursor-pointer text-xl ml-1 transition ${storePrefs[item.item_name] && storePrefs[item.item_name] !== 'AUTO'
                                                        ? 'text-indigo-600 hover:text-indigo-700'
                                                        : 'text-gray-300 hover:text-gray-500'
                                                        }`}
                                                      title="Swap store"
                                                      aria-label="Swap store"
                                                    >
                                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path
                                                          strokeLinecap="round"
                                                          strokeLinejoin="round"
                                                          strokeWidth={2}
                                                          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                                                        />
                                                      </svg>
                                                    </button>

                                                    <button
                                                      onClick={() => removeItem(item.id)}
                                                      className="text-gray-300 hover:text-gray-500 cursor-pointer text-xl ml-1"
                                                      title="Remove from list"
                                                      aria-label="Remove from list"
                                                    >
                                                      ✖️
                                                    </button>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            );
                          })}

                        {/* Second: All other stores alphabetically - WITH CATEGORY GROUPING */}
                        {storeEntries
                          .filter(([store]) => {
                            const storeId = storesByName[store];
                            return !(storeId && activeTrips[storeId]);
                          })
                          .sort(([storeA], [storeB]) => {
                            if (storeA === 'No Price Data' || storeA === 'Other Stores') return 1;
                            if (storeB === 'No Price Data' || storeB === 'Other Stores') return -1;
                            return storeA.localeCompare(storeB);
                          })

                          .map(([store, storeItems]) => {
                            // Calculate store total
                            const storeTotal = storeItems.reduce((sum, item) => {
                              const effStore = getEffectiveStore(item.item_name) || store;
                              const priceData = prices[`${effStore}-${item.item_name}`];
                              const price = priceData?.price ? parseFloat(priceData.price) : 0;
                              return sum + price * item.quantity;
                            }, 0);

                            // Group items by category
                            const itemsByCategory = storeItems.reduce((acc: Record<string, typeof storeItems>, item) => {
                              const cat = getCategoryName(item.category_id ?? -1);
                              (acc[cat] ||= []).push(item);
                              return acc;
                            }, {});

                            return (
                              <div key={store} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                                <h3 className="text-lg font-bold text-gray-700 bg-gray-50 p-3.5 border-b border-gray-200">
                                  {/* First row: Store name + Shop button */}
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="bg-teal-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm">{store}</span>

                                    {(!isMobile || mobileMode === 'store') && (
                                      <button
                                        onClick={() => {
                                          const id = storesByName[store];
                                          if (id) startTrip(id, store);
                                        }}
                                        className="bg-white border border-indigo-200 hover:bg-indigo-200 text-indigo-700 text-sm font-bold px-4 py-2 rounded-xl transition shadow-md cursor-pointer flex items-center gap-1.5"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                                        </svg>
                                        Shop
                                      </button>
                                    )}
                                  </div>

                                  {/* Second row: Item count + Total */}
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500 font-normal">
                                      ({storeItems.length} {storeItems.length === 1 ? 'item' : 'items'})
                                    </span>
                                    <span className="text-xl font-bold text-teal-700">
                                      ${storeTotal.toFixed(2)}
                                    </span>
                                  </div>
                                </h3>

                                {/* ONE cohesive store panel with categories inside */}
                                <div className="p-3 space-y-4">
                                  {/* Group items by category ID */}
                                  {Object.entries(
                                    storeItems.reduce((acc, item) => {
                                      // Use category_id for grouping, fallback to -1 (Other)
                                      const catId = item.category_id !== null && item.category_id !== undefined ? item.category_id : -1;
                                      if (!acc[catId]) acc[catId] = [];
                                      acc[catId].push(item);
                                      return acc;
                                    }, {} as { [key: number]: ListItem[] })
                                  )
                                    .sort(([catIdA], [catIdB]) => {
                                      // Sort by sort_order
                                      const idA = parseInt(catIdA);
                                      const idB = parseInt(catIdB);
                                      const orderA = categories.find(c => c.id === idA)?.sort_order || 999;
                                      const orderB = categories.find(c => c.id === idB)?.sort_order || 999;
                                      return orderA - orderB;
                                    })
                                    .map(([catIdStr, categoryItems]) => {
                                      const catId = parseInt(catIdStr);
                                      const categoryName = getCategoryName(catId);

                                      // Sort items: unchecked first, then alphabetical
                                      categoryItems.sort((a, b) => {
                                        if (a.checked !== b.checked) return a.checked ? 1 : -1;
                                        return a.item_name.localeCompare(b.item_name);
                                      });

                                      // Calculate category subtotal
                                      const categoryTotal = categoryItems.reduce((sum, item) => {
                                        const effStore = getEffectiveStore(item.item_name) || store;
                                        const priceData = prices[`${effStore}-${item.item_name}`];
                                        const price = priceData?.price ? parseFloat(priceData.price) : 0;
                                        return sum + price * item.quantity;
                                      }, 0);

                                      return (
                                        <div key={catId} className="space-y-2">
                                          {/* Category header */}
                                          <div
                                            className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${getCategoryColorById(
                                              catId
                                            )}`}
                                          >
                                            <div className="font-bold text-gray-800 text-base">{categoryName}</div>
                                            <div className="text-sm font-bold text-teal-700 opacity-90">${categoryTotal.toFixed(2)}</div>
                                          </div>

                                          {/* Category items */}
                                          <div className="space-y-2">
                                            {categoryItems.map((item) => {
                                              const isFavorite = favorites.includes(item.item_name);
                                              const effStore = getEffectiveStore(item.item_name) || store;
                                              const priceData = prices[`${effStore}-${item.item_name}`];
                                              const price = priceData?.price ? parseFloat(priceData.price) : 0;
                                              const cat = getCategoryName(item.category_id ?? -1);
                                              const missingCategory = !cat || cat.trim() === '' || cat === 'Other';

                                              return (
                                                <div
                                                  key={item.id}
                                                  onClick={() => {
                                                    if (mobileMode == 'build') return;
                                                    toggleChecked(item.id);
                                                  }}
                                                  className={`flex flex-wrap items-center gap-3 p-3.5 rounded-2xl border transition cursor-pointer active:scale-[0.99] ${item.checked
                                                    ? 'bg-gray-100 border-gray-300'
                                                    : isFavorite
                                                      ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                                                      : 'bg-white border-gray-300 hover:bg-gray-50'
                                                    } ${mobileMode == 'build' ? 'cursor-default' : 'cursor-pointer'
                                                    }`}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={item.checked}
                                                    disabled={mobileMode == 'build'}
                                                    onChange={() => { }} // Supress React warning, logic handled by parent click or custom handler below
                                                    onClick={(e) => {
                                                      // Prevent double-toggle when clicking the checkbox directly
                                                      // Actually let's just let the row handle it and make this purely visual/controlled
                                                      // But for a checkbox, native behavior is weird.
                                                      // Best: e.stopPropagation() and call toggleChecked here manually?
                                                      // OR: e.stopPropagation() and let the native change happen?
                                                      // With React controlled components, we need to call logic.
                                                      e.stopPropagation();
                                                      if (mobileMode == 'build') return;
                                                      toggleChecked(item.id);
                                                    }}
                                                    className={`w-6 h-6 rounded-lg border-2 border-gray-300 text-teal-600 focus:ring-teal-500 transition ${mobileMode == 'build' ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
                                                      }`}
                                                  />

                                                  <div className="flex-1 min-w-[160px]">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          openEditModal(item);
                                                        }}
                                                        className={`font-medium hover:text-teal-600 text-left cursor-pointer ${item.checked ? 'text-gray-500 line-through' : 'text-gray-800'
                                                          }`}
                                                      >
                                                        {dealsItemNames.has(item.item_name) && (
                                                          <span className="mr-1" title="On sale today!">🔥</span>
                                                        )}
                                                        {item.item_name}
                                                        {item.quantity > 1 && (
                                                          <span className="ml-1 font-bold text-indigo-600">
                                                            (Qty: {item.quantity})
                                                          </span>
                                                        )}
                                                      </button>
                                                    </div>

                                                    <div className="mt-0.5 flex items-center gap-2">
                                                      <p className="text-xs text-green-600 min-w-0">
                                                        {formatMoney(price)}{' '}
                                                        {item.quantity > 1 && `× ${item.quantity} = ${formatMoney(price * item.quantity)}`}
                                                        {priceData?.date ? (
                                                          <span className="text-gray-400 ml-1">({getDaysAgo(priceData.date)})</span>
                                                        ) : null}
                                                      </p>

                                                      {missingCategory && (
                                                        <button
                                                          onClick={() => openEditModal(item, 'category')}
                                                          className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition inline-block"
                                                        >
                                                          Add Category
                                                        </button>
                                                      )}
                                                    </div>

                                                    {/* Active Note Display */}
                                                    {item.active_note && (!item.active_note.store_id || item.active_note.store_id === storesByName[store]) && (
                                                      <div className="mt-1 flex items-start gap-1 p-2 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
                                                        <span className="text-base select-none">⚠️</span>
                                                        <div className="flex-1">
                                                          <span className="font-semibold">{item.active_note.note}</span>
                                                          <div className="text-xs text-orange-600 flex gap-2 mt-0.5">
                                                            {item.active_note.store_id && (
                                                              <span>at {Object.keys(storesByName).find(name => storesByName[name] === item.active_note?.store_id) || 'Unknown Store'}</span>
                                                            )}
                                                            <span>• {new Date(item.active_note.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                                            <button
                                                              onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (!item.active_note) return;
                                                                // Optimistic clear
                                                                setListItems(prev => prev.map(li => li.id === item.id ? { ...li, active_note: undefined } : li));
                                                                await supabase.from('item_notes').update({ is_active: false }).eq('id', item.active_note.id);
                                                              }}
                                                              className="text-orange-700 hover:text-orange-900 underline ml-auto"
                                                            >
                                                              Clear
                                                            </button>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>

                                                  <div className="flex items-center gap-3 ml-auto">



                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        togglePriority(item.id);
                                                      }}
                                                      className={`cursor-pointer ml-1 transition ${item.is_priority
                                                        ? 'text-red-600 hover:text-red-700'
                                                        : 'text-gray-300 hover:text-red-400'
                                                        }`}
                                                      title={item.is_priority ? "Unmark Urgent" : "Mark Urgent"}
                                                    >
                                                      <svg className="w-5 h-5" fill={item.is_priority ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V5h13l-3 4 3 4H3" />
                                                      </svg>
                                                    </button>

                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        openStoreModal(item.item_name);
                                                      }}
                                                      className={`cursor-pointer ml-1 transition ${storePrefs[item.item_name] && storePrefs[item.item_name] !== 'AUTO'
                                                        ? 'text-indigo-600 hover:text-indigo-700'
                                                        : 'text-gray-300 hover:text-gray-500'
                                                        }`}
                                                      title="Swap store"
                                                      aria-label="Swap store"
                                                    >
                                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path
                                                          strokeLinecap="round"
                                                          strokeLinejoin="round"
                                                          strokeWidth={2}
                                                          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                                                        />
                                                      </svg>
                                                    </button>

                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeItem(item.id);
                                                      }}
                                                      className="text-gray-300 hover:text-gray-500 cursor-pointer text-xl ml-1"
                                                      title="Remove from list"
                                                      aria-label="Remove from list"
                                                    >
                                                      ✖️
                                                    </button>
                                                  </div>
                                                </div>
                                              );
                                            })}              </div>
                                        </div>
                                      );
                                    })}

                                </div>
                              </div>
                            );
                          })}

                        {/* Third: Items without price data - WITH CATEGORY GROUPING */}
                        {itemsWithoutPrice.length > 0 && (
                          <div>
                            <h3 className="text-lg font-bold text-gray-700 mb-2 flex items-center gap-2 justify-between">
                              <div className="flex items-center gap-2">
                                <span className="bg-gray-400 text-white px-3 py-1 rounded-full text-sm">No Price Data</span>
                                <span className="text-sm text-gray-500">
                                  {itemsWithoutPrice.length} {itemsWithoutPrice.length === 1 ? 'item' : 'items'}
                                </span>
                              </div>
                            </h3>

                            {/* Group items by category */}
                            <div className="rounded-2xl border-2 border-gray-300 bg-white shadow-sm p-3 space-y-4">
                              {Object.entries(
                                itemsWithoutPrice.reduce((acc: Record<string, typeof itemsWithoutPrice>, item) => {
                                  const cat = getCategoryName(item.category_id ?? -1);
                                  (acc[cat] ||= []).push(item);
                                  return acc;
                                }, {})
                              )
                                .sort(([catA], [catB]) => {
                                  // Otherwise sort by category
                                  const orderA = categoryOrder[catA || 'Other'] || 999;
                                  const orderB = categoryOrder[catB || 'Other'] || 999;
                                  if (orderA !== orderB) return orderA - orderB;

                                  return catA.localeCompare(catB);
                                })
                                .map(([category, categoryItems]) => {
                                  // Sort items: unchecked first, then alphabetical
                                  categoryItems.sort((a, b) => {
                                    if (a.checked !== b.checked) return a.checked ? 1 : -1;
                                    return a.item_name.localeCompare(b.item_name);
                                  });

                                  return (
                                    <div key={category} className="space-y-2">
                                      {/* Category header */}
                                      <div
                                        className={`flex items-center justify-between px-3 py-2 rounded-xl border ${getCategoryColor(
                                          category
                                        )}`}
                                      >
                                        <div className="font-bold text-gray-700">{category}</div>
                                      </div>

                                      {/* Category items */}
                                      <div className="space-y-2">
                                        {categoryItems.map((item) => {
                                          const isFavorite = favorites.includes(item.item_name);
                                          const cat = getCategoryName(item.category_id ?? -1);
                                          const missingCategory = !cat || cat.trim() === '' || cat === 'Other';
                                          const effStore = getEffectiveStore(item.item_name);
                                          const priceData = effStore ? prices[`${effStore}-${item.item_name}`] : null;
                                          const missingPrice = !priceData;

                                          return (
                                            <div
                                              key={item.id}
                                              className={`flex flex-wrap items-center gap-3 p-3 rounded-2xl border transition ${item.checked
                                                ? 'bg-gray-100 border-gray-300'
                                                : isFavorite
                                                  ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                                                  : 'bg-white border-gray-300 hover:bg-gray-50'
                                                }`}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={item.checked}
                                                disabled={mobileMode == 'build'}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={() => {
                                                  if (mobileMode == 'build') return;
                                                  toggleChecked(item.id);
                                                }}
                                                className={`w-5 h-5 rounded transition ${mobileMode == 'build' ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
                                                  }`}
                                              />

                                              <div className="flex-1 min-w-[160px]">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      openEditModal(item);
                                                    }}
                                                    className={`font-medium hover:text-teal-600 text-left cursor-pointer ${item.checked ? 'text-gray-500 line-through' : 'text-gray-800'
                                                      }`}
                                                  >
                                                    {dealsItemNames.has(item.item_name) && (
                                                      <span className="mr-1" title="On sale today!">🔥</span>
                                                    )}
                                                    {item.item_name}
                                                    {item.quantity > 1 && (
                                                      <span className="ml-1 font-bold text-indigo-600">
                                                        (Qty: {item.quantity})
                                                      </span>
                                                    )}
                                                  </button>
                                                </div>

                                                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                                  {missingPrice && (
                                                    <button
                                                      onClick={() => openEditModal(item, 'price')}
                                                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition inline-block"
                                                    >
                                                      Add Price
                                                    </button>
                                                  )}

                                                  {missingCategory && (
                                                    <button
                                                      onClick={() => openEditModal(item, 'category')}
                                                      className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition inline-block"
                                                    >
                                                      Add Category
                                                    </button>
                                                  )}
                                                </div>

                                                {/* Active Note Display */}
                                                {item.active_note && (!item.active_note.store_id) && (!item.active_note.store_id) && (
                                                  <div className="mt-1 flex items-start gap-1 p-2 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
                                                    <span className="text-base select-none">⚠️</span>
                                                    <div className="flex-1">
                                                      <span className="font-semibold">{item.active_note.note}</span>
                                                      <div className="text-xs text-orange-600 flex gap-2 mt-0.5">
                                                        {item.active_note.store_id && (
                                                          <span>at {Object.keys(storesByName).find(name => storesByName[name] === item.active_note?.store_id) || 'Unknown Store'}</span>
                                                        )}
                                                        <span>• {new Date(item.active_note.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                                        <button
                                                          onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (!item.active_note) return;
                                                            // Optimistic clear
                                                            setListItems(prev => prev.map(li => li.id === item.id ? { ...li, active_note: undefined } : li));
                                                            await supabase.from('item_notes').update({ is_active: false }).eq('id', item.active_note.id);
                                                          }}
                                                          className="text-orange-700 hover:text-orange-900 underline ml-auto"
                                                        >
                                                          Clear
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>

                                              <div className="flex items-center gap-3 ml-auto">


                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    togglePriority(item.id);
                                                  }}
                                                  className={`cursor-pointer ml-1 transition ${item.is_priority
                                                    ? 'text-red-600 hover:text-red-700'
                                                    : 'text-gray-300 hover:text-red-400'
                                                    }`}
                                                  title={item.is_priority ? "Unmark Urgent" : "Mark Urgent"}
                                                >
                                                  <svg className="w-5 h-5" fill={item.is_priority ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V5h13l-3 4 3 4H3" />
                                                  </svg>
                                                </button>

                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    openStoreModal(item.item_name);
                                                  }}
                                                  className={`cursor-pointer ml-1 transition ${storePrefs[item.item_name] && storePrefs[item.item_name] !== 'AUTO'
                                                    ? 'text-indigo-600 hover:text-indigo-700'
                                                    : 'text-gray-300 hover:text-gray-500'
                                                    }`}
                                                  title="Swap store"
                                                  aria-label="Swap store"
                                                >
                                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      strokeWidth={2}
                                                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                                                    />
                                                  </svg>
                                                </button>

                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeItem(item.id);
                                                  }}
                                                  className="text-gray-300 hover:text-gray-500 cursor-pointer text-xl ml-1"
                                                  title="Remove from list"
                                                  aria-label="Remove from list"
                                                >
                                                  ✖️
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}                             </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )
                        }

                        <div className="mt-1 pt-1">
                          <p className="text-sm text-gray-500 text-left">Click an item to rename, update quantity or set the latest price.</p>
                        </div>

                        <div className="mt-6 pt-4 border-t-2 border-gray-300">
                          <div className="flex justify-between items-center">
                            <span className="text-xl font-bold text-gray-800">Total</span>
                            <span className="text-2xl font-bold text-teal-600">
                              {formatMoney(
                                listItems
                                  .filter(item => !item.checked)
                                  .filter(item => showPriorityOnly ? item.is_priority : true)
                                  .reduce((sum, item) => {
                                    const effStore = getEffectiveStore(item.item_name);
                                    if (!effStore) return sum;
                                    const pd = prices[`${effStore}-${item.item_name}`];
                                    const p = pd ? parseFloat(pd.price) : 0;
                                    return sum + p * item.quantity;
                                  }, 0)
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Quick Add to List Widget (Mobile-Store mode only) */}
                {(isMobile && mobileMode === 'store') && (
                  <div className="bg-white rounded-2xl shadow-lg p-4">
                    <h2 className="text-xl font-semibold mb-1 text-gray-800">Quick Add to List</h2>

                    <div className="relative autocomplete-container">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Search items or add new"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
                          value={newItem}
                          onChange={(e) => handleInputChange(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addNewItem()}
                          onFocus={() => {
                            const listIds = new Set(
                              listItems.map((li) => li.item_id).filter((v) => typeof v === 'number')
                            );
                            const available = allItems
                              .filter((it) => !listIds.has(it.id))
                              .map((it) => it.name);

                            setAutocompleteItems(available);
                            setShowAutocomplete(available.length > 0);
                          }}
                        />

                        <button
                          onClick={addNewItem}
                          className="bg-indigo-600 text-white px-4 py-2 rounded-2xl font-semibold hover:bg-indigo-700 cursor-pointer transition whitespace-nowrap"
                        >
                          Add
                        </button>
                      </div>

                      {showAutocomplete && autocompleteItems.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-2xl shadow-lg max-h-60 overflow-y-auto">
                          {autocompleteItems.slice(0, 10).map((item) => (
                            <button
                              key={item}
                              onClick={() => selectItem(item)}
                              className="w-full text-left px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-gray-800"
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 text-center">
                <p className="text-gray-500 text-lg mb-4">🛒 Your shopping list is empty.</p>
                {favorites.length > 0 && (
                  <button
                    onClick={addFavorites}
                    className="hidden md:inline-flex bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-2xl font-semibold transition cursor-pointer items-center gap-2"
                  >
                    <span className="text-xl">⭐</span>
                    Add Favorites to Get Started
                  </button>
                )}

                <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-4 mt-6 max-w-2xl mx-auto">
                  <h2 className="text-xl font-bold mb-3 text-gray-800">Add to List</h2>
                  <div className="relative autocomplete-container">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Select or add new item..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
                        value={newItem}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addNewItem()}
                        onFocus={() => {
                          {
                            const listIds = new Set(listItems.map((li) => li.item_id).filter((v) => typeof v === 'number'));
                            const available = allItems.filter((it) => !listIds.has(it.id)).map((it) => it.name);
                            setAutocompleteItems(available);
                            setShowAutocomplete(available.length > 0);
                          }
                        }}
                      />
                      <button onClick={addNewItem} className="bg-blue-600 text-white px-4 py-2 rounded-2xl font-semibold hover:bg-blue-700 cursor-pointer transition whitespace-nowrap">
                        Add
                      </button>
                    </div>

                    {showAutocomplete && autocompleteItems.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-2xl shadow-lg max-h-60 overflow-y-auto">
                        {autocompleteItems.slice(0, 10).map((item) => (
                          <button
                            key={item}
                            onClick={() => selectItem(item)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-gray-800"
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{newItem.trim() && !items.includes(newItem.trim()) ? `"${newItem}" will be added as a new item` : ''}</p>
                </div>
              </div>
            )}

          </div> {/* End Right Column */}
        </div> {/* End Flex Container */}

        {/* SWAP STORE MODAL      */}
        {/* ===================== */}
        {
          storeModalOpen && activeItemForStoreModal && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                        />
                      </svg>
                      <span>Swap Store</span>
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{activeItemForStoreModal}</p>
                  </div>
                  <button
                    onClick={closeStoreModal}
                    className="text-gray-300 hover:text-gray-500 cursor-pointer text-xl"
                    title="Close"
                    aria-label="Close"
                  >
                    ✖️
                  </button>
                </div>

                {(() => {
                  const options = getStoreOptionsForItem(activeItemForStoreModal);
                  const pref = storePrefs[activeItemForStoreModal] || 'AUTO';

                  // Find stores WITHOUT price data
                  const storesWithoutPrice = stores.filter(
                    (store) => !options.find((opt) => opt.store === store)
                  );

                  if (options.length === 0) {
                    return (
                      <p className="text-gray-500 text-sm">No stores with price data available.</p>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        {/* Auto option */}
                        <button
                          onClick={() => {
                            setItemStorePreference(activeItemForStoreModal, 'AUTO');
                            closeStoreModal();
                          }}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition text-left ${pref === 'AUTO' ? 'border-blue-600 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">Auto (cheapest)</span>
                            <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">{options[0].store}</span>
                          </div>
                          <span className="font-bold text-gray-800">{formatMoney(options[0].price)}</span>
                        </button>

                        {/* Store options - only stores with prices */}
                        {options.map(({ store, price }, idx) => {
                          const isSelected = pref === store;
                          const isBestPrice = idx === 0;

                          return (
                            <button
                              key={store}
                              onClick={() => {
                                setItemStorePreference(activeItemForStoreModal, store);
                                closeStoreModal();
                              }}
                              className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition text-left ${isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-800">{store}</span>
                                {isBestPrice && (
                                  <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                                    Best Price
                                  </span>
                                )}
                              </div>
                              <span className="font-bold text-gray-800">{formatMoney(price)}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Add Price For section */}
                      {storesWithoutPrice.length > 0 && (
                        <div className="pt-3 border-t-2 border-dashed border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-600 mb-2">Add Price For:</h4>
                          <div className="space-y-2">
                            {storesWithoutPrice.map((store) => (
                              <button
                                key={store}
                                onClick={() => {
                                  // Find the item in the list
                                  const item = listItems.find((i) => i.item_name === activeItemForStoreModal);
                                  if (item) {
                                    // Close swap modal and open edit modal with this store pre-selected
                                    closeStoreModal();
                                    setEditModalItem(item);
                                    setEditModalName(item.item_name);
                                    setEditModalQuantity(String(item.quantity ?? 1));
                                    setEditModalStore(store);
                                    setEditModalPrice('');
                                    setEditModalOriginalPrice('');
                                    setEditModalOpen(true);
                                  }
                                }}
                                className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-dashed border-gray-300 hover:bg-gray-50 transition text-left"
                              >
                                <span className="font-semibold text-gray-800">{store}</span>
                                <span className="text-sm text-indigo-600 font-semibold">+ Add Price</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )
        }

        {/* ========================= */}
        {/* EDIT ITEM MODAL */}
        {/* ========================= */}
        {
          editModalOpen && editModalItem && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-5">
                  <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit Item Details
                  </h3>
                  <button
                    onClick={closeEditModal}
                    className="text-gray-300 hover:text-gray-500 cursor-pointer text-xl -mt-1"
                    aria-label="Close"
                  >
                    ✖️
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Details Section */}
                  <div
                    className={`rounded-2xl p-4 border transition-colors ${getCategoryColor(editModalCategory)
                      .split(' ')
                      .filter(c => c.startsWith('bg-') || c.startsWith('border-'))
                      .join(' ')
                      }`}
                  >

                    <div className="space-y-3">
                      {/* Name + Favorite Star */}
                      <div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(editModalItem?.item_name || editModalName)}
                            className={
                              favorites.includes(editModalItem?.item_name || editModalName)
                                ? 'text-4xl leading-none cursor-pointer'
                                : 'text-4xl leading-none text-gray-300 cursor-pointer'
                            }
                            aria-label={favorites.includes(editModalItem?.item_name || editModalName) ? 'Unfavorite item' : 'Favorite item'}
                            title={favorites.includes(editModalItem?.item_name || editModalName) ? "Remove from Favorites" : "Add to Favorites"}
                          >
                            {favorites.includes(editModalItem?.item_name || editModalName) ? '⭐' : '☆'}
                          </button>
                          <label className="text-sm font-semibold text-gray-700">Favorite & Item Name</label>
                        </div>
                        <div className="mt-1">
                          <input
                            autoFocus={editModalFocusField === 'name'}
                            type="text"
                            value={editModalName}
                            onChange={(e) => setEditModalName(e.target.value)}
                            className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 text-base bg-white"
                            placeholder="e.g., Grapefruit (ct)"

                          />
                        </div>
                      </div>

                      {/* Category */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700">Category</label>
                        <select
                          autoFocus={editModalFocusField === 'category'}
                          value={editModalCategory}
                          onChange={(e) => setEditModalCategory(e.target.value)}
                          className="w-full mt-1 px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-200 bg-white"
                        >
                          {Array.from(new Set([...categoryOptions, editModalCategory])).filter(Boolean).map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700">Quantity</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="1"
                          value={editModalQuantity}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (/^\d*\.?\d*$/.test(val)) {
                              setEditModalQuantity(val);
                            }
                          }}
                          className="w-full mt-1 px-3 py-3 border border-gray-200 rounded-xl bg-white
                              font-semibold text-gray-800
                              focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                        />
                      </div>

                      {/* Note */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700">Note (Optional)</label>
                        <div className="flex gap-2">
                          <select
                            value={editModalNote}
                            onChange={(e) => setEditModalNote(e.target.value)}
                            className={`w-full mt-1 px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-200 ${editModalNote ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}
                          >
                            <option value="">No note</option>
                            <option value="Poor quality item">Poor quality item</option>
                            <option value="Out of stock!">Out of stock!</option>
                            <option value="Wrong price at register!">Wrong price at register!</option>
                          </select>
                        </div>
                        <div className="mt-1 w-full">
                          <select
                            value={editModalNoteStore}
                            onChange={(e) => setEditModalNoteStore(e.target.value)}
                            className="w-full text-s bg-white border border-gray-200 rounded-xl px-3 py-3"
                          >
                            <option value="Any">Any Store</option>
                            {stores.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Price Section */}
                  <div className="rounded-2xl border border-blue-300 bg-blue-100 p-4 shadow-sm">
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-semibold text-gray-700">Price</label>
                        <div className="mt-1 flex items-center border border-gray-300 rounded-xl px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 bg-white">
                          <span className="text-gray-600 font-semibold mr-1">$</span>

                          <input
                            autoFocus={editModalFocusField === 'price'}
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={editModalPrice || ''}
                            onChange={(e) => {
                              setEditModalPriceDirty(true);
                              const digits = e.target.value.replace(/\D/g, '');
                              let priceValue = '';
                              if (digits !== '') {
                                const cents = parseInt(digits, 10);
                                priceValue = (cents / 100).toFixed(2);
                              }

                              setEditModalPrice(priceValue);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (!editModalStore) {
                                  e.preventDefault();

                                  // show friendly guidance
                                  setNeedsStoreHint(true);

                                  // guide user to store selection
                                  setTimeout(() => {
                                    storeSelectRef.current?.focus();
                                  }, 50);
                                }
                              }
                            }}
                            className="w-full text-right font-semibold text-gray-600 focus:outline-none"
                            aria-label="Price"
                          />
                        </div>
                      </div>

                      {/* Store Selection */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700">Store</label>
                        <select
                          ref={storeSelectRef}
                          value={editModalStore}
                          onChange={(e) => {
                            const newStore = e.target.value;
                            setEditModalStore(newStore);

                            // clear hint once resolved
                            if (newStore) setNeedsStoreHint(false);

                            if (editModalItem && newStore) {
                              setItemStorePreference(editModalItem.item_name, newStore);
                            }
                          }}

                          className="w-full mt-1 px-3 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-200"
                        >
                          <option value="">Select a store</option>
                          {stores.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {editModalOriginalPrice && editModalPrice !== editModalOriginalPrice && (
                      <p className="text-xs text-gray-700 mt-2">
                        Was <span className="font-semibold">${editModalOriginalPrice}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <button
                      onClick={closeEditModal}
                      className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={savingEdit}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {savingEdit ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>


              {/* ========================= */}
              {/* EDIT ITEM MODAL - SAVE PRICE WITHOUT STORE ERROR MESSAGE */}
              {/* ========================= */}
              {storeRequiredOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" aria-modal="true" role="dialog">
                  {/* Backdrop */}
                  <div
                    className="absolute inset-0 bg-black/70"
                    onClick={() => setStoreRequiredOpen(false)}
                  />

                  {/* Card */}
                  <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-extrabold text-gray-900">Store Required</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          You found{' '}
                          <span className="font-semibold text-gray-900">
                            {editModalName}
                          </span>
                          {' for'}
                          <span className="font-semibold text-gray-900">
                            {' $'}{editModalPrice}
                          </span>
                          ? Awesome!
                          Let me know what store that applies to.
                        </p>
                      </div>

                      <button
                        onClick={() => setStoreRequiredOpen(false)}
                        className="text-gray-300 hover:text-gray-500 cursor-pointer text-xl -mt-1"
                        aria-label="Close"
                        type="button"
                      >
                        ✖️
                      </button>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                      <button
                        type="button"
                        onClick={() => {
                          setStoreRequiredOpen(false);
                          setTimeout(() => storeSelectRef.current?.focus(), 50);
                        }}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                      >
                        Choose Store
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        }


        {/* =========================
        TOAST NOTIFICATION

        ITEM REMOVED FROM SHOPPING LIST
        (WITH UNDO BUTTON)
        ========================= */}
        {
          mounted && removedFromListToastItem && (
            <div key={removedFromListToastItem.id} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-xl">
              <div className="bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-up">
                <span className="flex-1 font-medium">Removed "{removedFromListToastItem.item_name}" from your shopping list.</span>

                <button
                  onClick={undoRemove}
                  className="bg-blue-500 hover:bg-blue-600 px-6 py-2 rounded-xl font-semibold transition whitespace-nowrap"
                >
                  Undo
                </button>

                <button
                  onClick={() => {
                    if (removedFromListToastTimeout) clearTimeout(removedFromListToastTimeout);
                    setUndoRemoveItem(null);
                    setUndoRemoveTimeout(null);
                  }}
                  className="text-gray-400 hover:text-white text-xl"
                  aria-label="Dismiss"
                >
                  ✖
                </button>
              </div>
            </div>
          )
        }

        {/* =========================
        TOAST NOTIFICATION
        
        ITEM ADDED TO SHOPPING LIST
        (WITH UNDO BUTTON)
        ========================= */}
        {
          mounted && addedToListToastItem && (
            <div key={addedToListToastItem.id} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-xl">
              <div className="bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-up">
                <span className="flex-1 font-medium">Added "{addedToListToastItem.item_name}" to your shopping list.</span>

                <button
                  onClick={undoAdd}
                  className="bg-blue-500 hover:bg-blue-600 px-6 py-2 rounded-xl font-semibold transition whitespace-nowrap"
                >
                  Undo
                </button>

                <button
                  onClick={() => {
                    if (addedToListToastTimeout) clearTimeout(addedToListToastTimeout);
                    setUndoAddItem(null);
                    setUndoAddTimeout(null);
                  }}
                  className="text-gray-400 hover:text-white text-xl"
                  aria-label="Dismiss"
                >
                  ✖
                </button>
              </div>
            </div>
          )
        }

        {/* =========================
        TOAST NOTIFICATION
        
        CHECKED ITEM OFF SHOPPING LIST
        (WITH UNDO BUTTON)
        ========================= */}
        {
          mounted && checkedOffListToastItem && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-xl">
              <div className="bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-up">
                <span className="flex-1 font-medium">
                  Checked off "{checkedOffListToastItem.item_name}" from your shopping list!
                </span>

                <button
                  onClick={undoCheck}
                  className="bg-blue-500 hover:bg-blue-600 px-6 py-2 rounded-xl font-semibold transition whitespace-nowrap"
                >
                  Undo
                </button>

                <button
                  onClick={() => {
                    if (checkedOffListToastTimeout) clearTimeout(checkedOffListToastTimeout);
                    setUndoCheckItem(null);
                    setUndoCheckTimeout(null);
                  }}
                  className="text-gray-400 hover:text-white text-xl"
                  aria-label="Dismiss"
                >
                  ✖
                </button>
              </div>
            </div>
          )
        }

        {/* =========================
        TOAST NOTIFICATION
        
        TRIP COMPLETE AT ACTIVE STORE
        ========================= */}

        {
          mounted && tripCompleteToastStore && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-xl">
              <div className="bg-gray-900 text-white px-12 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-up">
                <span className="flex-1 font-semibold text-xl">
                  <span className="text-xl mr-1">🎉</span> Your trip at {tripCompleteToastStore} is complete!
                </span>

                <button
                  onClick={() => {
                    if (tripCompleteToastTimeout) clearTimeout(tripCompleteToastTimeout);
                    setTripCompleteToastStore(null);
                    setTripCompleteToastTimeout(null);
                    tripCompleteToastLockRef.current = null;
                  }}
                  className="text-gray-400 hover:text-white text-xl"
                  aria-label="Dismiss"
                >
                  ✖
                </button>
              </div>
            </div>
          )
        }

        {/* =========================
        TOAST NOTIFICATION
        
        TRIP STARTED
        (WITH UNDO BUTTON)
        ========================== */}
        {
          mounted && tripStartedToastStore && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-xl">
              <div className="bg-gray-900 text-white px-10 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-up">
                <span className="flex-1 font-semibold text-xl">
                  <span className="text-xl mr-1">🚀</span> Trip started at {tripStartedToastStore}!
                </span>


                <button
                  onClick={undoTripStart}
                  className="bg-blue-500 hover:bg-blue-600 px-6 py-2 rounded-xl font-semibold transition whitespace-nowrap cursor-pointer"
                >
                  Undo
                </button>

                <button
                  onClick={() => {
                    if (tripStartedToastTimeout) clearTimeout(tripStartedToastTimeout);
                    setTripStartedToastStore(null);
                    setTripStartedToastTripId(null);
                    setTripStartedToastTimeout(null);
                  }}
                  className="text-gray-400 hover:text-white text-xl cursor-pointer"
                  aria-label="Dismiss"
                >
                  ✖
                </button>
              </div>
            </div>
          )
        }

      </div>
    </div >
  );
}
