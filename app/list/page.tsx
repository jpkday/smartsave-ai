'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { useWakeLock } from '../hooks/useWakeLock';
import { useCategories } from '../hooks/useCategories';
import { useStatusModal } from '../hooks/useStatusModal';
import { useHouseholdCode } from '../hooks/useHouseholdCode';
import { useStorePreferences } from '../hooks/useStorePreferences';
import Link from 'next/link';
import { getFormattedUnitPrice } from '../utils/unitPrice';
import PricePhotoCapture from '../components/PricePhotoCapture';
import PriceReviewModal from '../components/PriceReviewModal';
import StatusModal from '../components/StatusModal';
import UndoToast from '../components/shopping-list/UndoToast';
import ItemLibrary from '../components/shopping-list/ItemLibrary';
import ShoppingListPanel from '../components/shopping-list/ShoppingListPanel';
import StoreModal from '../components/shopping-list/StoreModal';
import EditItemModal from '../components/shopping-list/EditItemModal';
import { SHARED_USER_ID, DEFAULT_ITEMS } from '../lib/constants';


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
  const router = useRouter();
  const { request: requestWakeLock } = useWakeLock();

  useEffect(() => {
    requestWakeLock();
  }, [requestWakeLock]);

  const { categories, loading: categoriesLoading, getCategoryName, getCategoryColorById } = useCategories();

  // New custom hooks
  const { modal: statusModal, show: showStatus, close: closeStatusModal } = useStatusModal();
  const { householdCode, loading: householdCodeLoading } = useHouseholdCode();
  const { storePrefs, setItemStorePreference } = useStorePreferences(householdCode);

  const [activeTrips, setActiveTrips] = useState<{ [store_id: string]: string }>({});
  const [stores, setStores] = useState<string[]>([]);
  const [storesByName, setStoresByName] = useState<{ [name: string]: string }>({});

  const [allItems, setAllItems] = useState<ItemRow[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentItemIds, setRecentItemIds] = useState<number[]>([]);
  const [favoritesIds, setFavoritesIds] = useState<number[]>([]);
  const [dealsItemNames, setDealsItemNames] = useState<Set<string>>(new Set());

  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [prices, setPrices] = useState<{ [key: string]: PriceData }>({});
  const [filterLetter, setFilterLetter] = useState<string>('All');
  const [newItem, setNewItem] = useState('');
  const [showCheckedItems, setShowCheckedItems] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPriorityOnly, setShowPriorityOnly] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  type SelectItemsFilter = 'FAVORITES' | 'RECENT' | 'FREQUENT' | null;
  const [selectItemsFilter, setSelectItemsFilter] = useState<SelectItemsFilter>(null);
  const [frequentItemCounts, setFrequentItemCounts] = useState<Record<string, number>>({});

  // Price Photo Capture State
  const [showPricePhotoCapture, setShowPricePhotoCapture] = useState(false);
  const [showPriceReviewModal, setShowPriceReviewModal] = useState(false);
  const [extractedPriceData, setExtractedPriceData] = useState<any>(null);
  const [priceSubmissionId, setPriceSubmissionId] = useState<number | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [currentScanStore, setCurrentScanStore] = useState<{ id: string; name: string } | null>(null);

  // =========================
  // Mobile Mode Toggle (Store vs Build)
  // =========================
  const [mobileMode, setMobileMode] = useState<'store' | 'build'>('store');

  // Load view settings from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
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
      showStatus('Undo Failed', 'Failed to undo. Check your connection and try again.', 'error');
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
      showStatus('Undo Failed', 'Failed to undo. Check your connection and try again.', 'error');
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
      showStatus('Undo Failed', 'Failed to undo. Check your connection and try again.', 'error');
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
        showStatus('Start Trip Failed', data.error || 'Failed to start trip. Please try again.', 'error');
        // If it failed, unpin just in case? No, we haven't pinned yet.
      }

    } catch (error) {
      console.error('Error starting trip:', error);
      showStatus('Start Trip Failed', 'Failed to start trip. Please try again.', 'error');
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
      showStatus('End Trip Failed', 'Failed to end trip. Please try again.', 'error');
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
  // Store preferences are now managed by useStorePreferences hook

  const getPriceForStore = (store: string, itemName: string): number | null => {
    // Debug logging for salmon
    const isSalmon = itemName?.toLowerCase().includes('salmon');

    // Try ID-based lookup first (handles renamed items)
    const storeId = storesByName[store];
    const item = allItems.find(i => i.name === itemName);

    if (isSalmon) {
      console.log('🔍 Looking up salmon price:', {
        store,
        itemName,
        storeId,
        itemId: item?.id,
        hasStoreId: !!storeId,
        hasItem: !!item
      });
    }

    if (storeId && item) {
      const idKey = `id:${storeId}-${item.id}`;
      const pdById = prices[idKey];

      if (isSalmon) {
        console.log('🔍 ID-based lookup:', {
          idKey,
          foundById: !!pdById,
          price: pdById?.price
        });
      }

      if (pdById) {
        const n = parseFloat(pdById.price);
        if (Number.isFinite(n)) return n;
      }
    }

    // Fall back to name-based lookup (backwards compatibility)
    const nameKey = `${store}-${itemName}`;
    const pdByName = prices[nameKey];

    if (isSalmon) {
      console.log('🔍 Name-based lookup:', {
        nameKey,
        foundByName: !!pdByName,
        price: pdByName?.price
      });
    }

    if (!pdByName) return null;
    const n = parseFloat(pdByName.price);
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
  const [editModalCategoryId, setEditModalCategoryId] = useState<number | null>(null);
  const [editModalQuantity, setEditModalQuantity] = useState<string>('1');
  const [editModalStore, setEditModalStore] = useState('');
  const [editModalPrice, setEditModalPrice] = useState('');
  const [editModalOriginalPrice, setEditModalOriginalPrice] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const storeOptions = editModalItem ? getStoreOptionsForItem(editModalItem.item_name) : [];
  const [editModalFocusField, setEditModalFocusField] = useState<'name' | 'price' | 'category' | 'note'>('name');
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
    setEditModalCategoryId(item.category_id ?? null);
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
    setEditModalCategoryId(null);
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
          showStatus('Duplicate Item', 'An item with this name already exists.', 'warning');
          setSavingEdit(false);
          return;
        }

        const categoryName = getCategoryName(editModalCategoryId);

        const { error: itemError } = await supabase
          .from('items')
          .update({
            name: newName,
            category: categoryName,
            category_id: editModalCategoryId
          })
          .eq('id', editModalItem.item_id)
          .eq('user_id', SHARED_USER_ID);
        if (itemError) throw itemError;

        const { error: listError } = await supabase
          .from('shopping_list')
          .update({ item_name: newName })
          .or(`item_id.eq.${editModalItem.item_id},item_name.eq."${oldName}"`);

        if (listError) throw listError;

        const { error: phError } = await supabase
          .from('price_history')
          .update({ item_name: newName })
          .or(`item_id.eq.${editModalItem.item_id},item_name.eq."${oldName}"`);

        if (phError) throw phError;
      } else {
        // no rename — just update category
        const categoryName = getCategoryName(editModalCategoryId);

        const { error: catErr } = await supabase
          .from('items')
          .update({
            category: categoryName,
            category_id: editModalCategoryId
          })
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

      // ✅ Optimistic Update
      const categoryName = getCategoryName(editModalCategoryId);

      setListItems((prev) =>
        prev.map((li) => {
          if (li.item_id === editModalItem.item_id) {
            return {
              ...li,
              item_name: newName,
              quantity: qtyNum,
              category: categoryName,
              category_id: editModalCategoryId
            };
          }
          return li;
        })
      );

      setAllItems((prev) =>
        prev.map((i) =>
          i.id === editModalItem.item_id
            ? { ...i, name: newName, category: categoryName, category_id: editModalCategoryId || undefined }
            : i
        )
      );

      if (newName !== oldName) {
        setItems((prev) => prev.map((n) => (n === oldName ? newName : n)));
      }

      closeEditModal();
      await loadData();
    } catch (error) {
      console.error('Error saving edit:', error);
      showStatus('Save Failed', 'Failed to save changes. Check your connection and try again.', 'error');
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
        showStatus('Update Failed', 'Failed to update favorite. Check your connection and try again.', 'error');
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
        showStatus('Update Failed', 'Failed to update favorite. Check your connection and try again.', 'error');
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

  const handleOpenEditModalForPrice = (itemName: string, store: string) => {
    const item = listItems.find((i) => i.item_name === itemName);
    if (item) {
      closeStoreModal();
      setEditModalItem(item);
      setEditModalName(item.item_name);
      setEditModalQuantity(String(item.quantity ?? 1));
      setEditModalStore(store);
      setEditModalPrice('');
      setEditModalOriginalPrice('');
      setEditModalOpen(true);
    }
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
    // Store preferences are now loaded automatically by useStorePreferences hook

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
    let itemsQuery = supabase
      .from('items')
      .select('id, name, category, category_id')
      .eq('user_id', SHARED_USER_ID)
      .order('name');

    // Filter out 'TEST' items for regular users
    if (householdCode !== 'TEST') {
      itemsQuery = itemsQuery.or('household_code.neq.TEST,household_code.is.null');
    }

    const { data: itemsData, error: itemsError } = await itemsQuery;



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
      if (listData.length === 0 && !localStorage.getItem('has_seen_onboarding')) {
        router.push('/welcome');
        return;
      }
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
        // Create both ID-based and name-based keys for backwards compatibility
        const nameKey = `${p.store}-${p.item_name}`;
        const idKey = p.store_id && p.item_id ? `id:${p.store_id}-${p.item_id}` : null;

        // Debug logging for salmon
        if (p.item_name?.toLowerCase().includes('salmon')) {
          console.log('🐟 Salmon price record:', {
            item_name: p.item_name,
            item_id: p.item_id,
            store: p.store,
            store_id: p.store_id,
            price: p.price,
            nameKey,
            idKey
          });
        }

        // Update name-based key
        if (!latestPrices[nameKey] ||
          new Date(p.recorded_date) > new Date(latestPrices[nameKey].recorded_date) ||
          (p.recorded_date === latestPrices[nameKey].recorded_date && new Date(p.created_at || 0) > new Date(latestPrices[nameKey].created_at || 0))
        ) {
          latestPrices[nameKey] = p;
          pricesObj[nameKey] = { price: p.price, date: p.recorded_date };
        }

        // Also store by ID key if available (for renamed items)
        if (idKey) {
          if (!latestPrices[idKey] ||
            new Date(p.recorded_date) > new Date(latestPrices[idKey].recorded_date) ||
            (p.recorded_date === latestPrices[idKey].recorded_date && new Date(p.created_at || 0) > new Date(latestPrices[idKey].created_at || 0))
          ) {
            latestPrices[idKey] = p;
            pricesObj[idKey] = { price: p.price, date: p.recorded_date };
          }
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
      showStatus('Update Failed', 'Failed to update list. Check your connection and try again.', 'error');
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

  const handleSearchFocus = () => {
    const listIds = new Set(listItems.map((li) => li.item_id).filter((v) => typeof v === 'number'));
    const available = allItems.filter((it) => !listIds.has(it.id)).map((it) => it.name);

    setAutocompleteItems(available);
    setShowAutocomplete(available.length > 0);
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
      showStatus('Add Failed', 'Failed to add item. Check your connection and try again.', 'error');
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
      showStatus('Add Failed', 'Failed to add item. Check your connection and try again.', 'error');
    }
  };

  // Price Photo Capture Handlers
  const handleImageCaptured = async (imageData: string) => {
    setIsAnalyzingPhoto(true);
    setShowPricePhotoCapture(false);

    try {
      // Get list of all available items for AI matching
      const candidateItems = allItems.map(item => item.name);

      const response = await fetch('/api/prices/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-household-code': householdCode || '',
        },
        body: JSON.stringify({
          image: imageData,
          candidateItems: candidateItems
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze price tag');
      }

      if (data.success && data.extracted) {
        setExtractedPriceData(data.extracted);
        setPriceSubmissionId(data.submission_id);
        setShowPriceReviewModal(true);
      }
    } catch (error: any) {
      console.error('Error analyzing price tag:', error);
      showStatus(
        'Analysis Failed',
        error.message || 'We couldn\'t read the price tag. Please try a clearer photo.',
        'error'
      );
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  const handlePriceConfirm = async (confirmData: any) => {
    try {
      const response = await fetch('/api/prices/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-household-code': householdCode || '',
        },
        body: JSON.stringify(confirmData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save price');
      }

      // Success!
      setShowPriceReviewModal(false);
      setExtractedPriceData(null);
      setPriceSubmissionId(null);

      // Reload data to show new price
      await loadData();

      showStatus('Success', `Price added for ${confirmData.item_name}! 🎉`, 'success');
    } catch (error: any) {
      console.error('Error confirming price:', error);
      // Let the PriceReviewModal handle its own display, but we can set
      // a generic error here if it bubbles up unexpectedly.
      showStatus(
        'Save Failed',
        error.message || 'Something went wrong while saving the price.',
        'error'
      );
      throw error;
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
      showStatus('Add Favorites Failed', 'Failed to add favorites. Check your connection and try again.', 'error');
    }
  };

  const handleOpenPricePhotoCapture = () => {
    // If there's an active store, use it; otherwise no default
    const activeStoreEntry = Object.entries(activeTrips).find(([_, tripId]) => tripId);
    if (activeStoreEntry) {
      const [storeId, _] = activeStoreEntry;
      const storeName = Object.keys(storesByName).find(name => storesByName[name] === storeId);
      setCurrentScanStore({ id: storeId, name: storeName || '' });
    } else {
      setCurrentScanStore(null);
    }
    setShowPricePhotoCapture(true);
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
      showStatus('Update Failed', 'Failed to update quantity. Check your connection and try again.', 'error');
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
      showStatus('Update Failed', 'Failed to update priority. Check your connection and try again.', 'error');
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
      showStatus('Check Failed', 'Failed to check item. Check your connection and try again.', 'error');
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
        showStatus('Remove Failed', 'Failed to remove item. Check your connection and try again.', 'error');
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

  const dismissRemoveToast = () => {
    if (removedFromListToastTimeout) clearTimeout(removedFromListToastTimeout);
    setUndoRemoveItem(null);
    setUndoRemoveTimeout(null);
  };

  const dismissAddToast = () => {
    if (addedToListToastTimeout) clearTimeout(addedToListToastTimeout);
    setUndoAddItem(null);
    setUndoAddTimeout(null);
  };

  const dismissCheckToast = () => {
    if (checkedOffListToastTimeout) clearTimeout(checkedOffListToastTimeout);
    setUndoCheckItem(null);
    setUndoCheckTimeout(null);
  };

  const dismissTripCompleteToast = () => {
    if (tripCompleteToastTimeout) clearTimeout(tripCompleteToastTimeout);
    setTripCompleteToastStore(null);
    setTripCompleteToastTimeout(null);
    tripCompleteToastLockRef.current = null;
  };

  const dismissTripStartedToast = () => {
    if (tripStartedToastTimeout) clearTimeout(tripStartedToastTimeout);
    setTripStartedToastStore(null);
    setTripStartedToastTripId(null);
    setTripStartedToastTimeout(null);
  };

  const clearList = async () => {
    if (!confirm('Clear entire shopping list?')) return;

    try {
      const { error } = await supabase.from('shopping_list').delete().eq('user_id', SHARED_USER_ID).eq('household_code', householdCode);
      if (error) throw new Error(`Failed to clear list: ${error.message}`);
      setListItems([]);
    } catch (error) {
      console.error('Error clearing list:', error);
      showStatus('Clear List Failed', 'Failed to clear list. Check your connection and try again.', 'error');
    }
  };

  const clearItemNote = async (itemId: number, noteId: string) => {
    // Optimistic clear
    setListItems(prev => prev.map(li => li.item_id === itemId ? { ...li, active_note: undefined } : li));
    await supabase.from('item_notes').update({ is_active: false }).eq('id', noteId);
  };

  const getDaysAgo = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return '1d';
    if (diffDays < 7) return `${diffDays}d`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1w' : `${weeks}w`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1mo' : `${months}mo`;
    }
    const years = Math.floor(diffDays / 365);
    return years === 1 ? '1y' : `${years}y`;
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

            {/* UNIFIED ITEM LIBRARY - Desktop + Mobile (Build Mode only) */}
            {(!isMobile || mobileMode === 'build') && (
              <ItemLibrary
                allItems={allItems}
                buildModeAvailableAll={buildModeAvailableAll}
                favorites={favorites}
                recentRank={recentRank}
                frequentItemCounts={frequentItemCounts}
                prices={prices}
                storesByName={storesByName}
                filterLetter={filterLetter}
                selectItemsFilter={selectItemsFilter}
                onFilterLetterChange={setFilterLetter}
                onSelectItemsFilterChange={setSelectItemsFilter}
                newItem={newItem}
                showAutocomplete={showAutocomplete}
                autocompleteItems={autocompleteItems}
                onNewItemChange={handleInputChange}
                onSearchFocus={handleSearchFocus}
                onToggleFavorite={toggleFavorite}
                onToggleItemById={toggleItemById}
                onAddNewItem={addNewItem}
                onSelectItem={selectItem}
                onOpenEditModal={openEditModal}
                getEffectiveStore={getEffectiveStore}
                formatMoney={formatMoney}
                getDaysAgo={getDaysAgo}
                getFormattedUnitPrice={getFormattedUnitPrice}
              />
            )}

          </div>

          {/* RIGHT COLUMN: Shopping List */}
          <div className="w-full md:w-3/5 mt-2 md:mt-0">
            <ShoppingListPanel
              loading={loading}
              listItems={listItems}
              showCheckedItems={showCheckedItems}
              showPriorityOnly={showPriorityOnly}
              isMobile={isMobile}
              mobileMode={mobileMode}
              favorites={favorites}
              dealsItemNames={dealsItemNames}
              prices={prices}
              storesByName={storesByName}
              storePrefs={storePrefs}
              categories={categories}
              categoryOrder={categoryOrder}
              activeTrips={activeTrips}
              myActiveStoreId={myActiveStoreId}
              newItem={newItem}
              showAutocomplete={showAutocomplete}
              autocompleteItems={autocompleteItems}
              onNewItemChange={handleInputChange}
              onSearchFocus={handleSearchFocus}
              onAddNewItem={addNewItem}
              onSelectItem={selectItem}
              onToggleShowChecked={() => setShowCheckedItems(!showCheckedItems)}
              onToggleShowPriority={() => setShowPriorityOnly(!showPriorityOnly)}
              onStartTrip={startTrip}
              onEndTrip={endTrip}
              onOpenPricePhotoCapture={handleOpenPricePhotoCapture}
              onAddFavorites={addFavorites}
              onToggleChecked={toggleChecked}
              onTogglePriority={togglePriority}
              onOpenEdit={openEditModal}
              onOpenStoreModal={openStoreModal}
              onRemove={removeItem}
              onClearNote={clearItemNote}
              getCategoryColorById={getCategoryColorById}
              getCategoryName={getCategoryName}
              getEffectiveStore={getEffectiveStore}
              getDaysAgo={getDaysAgo}
              formatMoney={formatMoney}
            />
          </div> {/* End Right Column */}
        </div> {/* End Flex Container */}

        {/* SWAP STORE MODAL */}
        <StoreModal
          isOpen={storeModalOpen && !!activeItemForStoreModal}
          onClose={closeStoreModal}
          itemName={activeItemForStoreModal}
          currentPreference={activeItemForStoreModal ? (storePrefs[activeItemForStoreModal] || 'AUTO') : 'AUTO'}
          storeOptions={activeItemForStoreModal ? getStoreOptionsForItem(activeItemForStoreModal) : []}
          allStores={stores}
          onSelectStore={setItemStorePreference}
          onOpenEditModalForPrice={handleOpenEditModalForPrice}
          formatMoney={formatMoney}
        />

        {/* EDIT ITEM MODAL */}
        <EditItemModal
          isOpen={editModalOpen}
          onClose={closeEditModal}
          item={editModalItem}
          itemName={editModalName}
          categoryId={editModalCategoryId}
          quantity={editModalQuantity}
          note={editModalNote}
          noteStore={editModalNoteStore}
          price={editModalPrice}
          store={editModalStore}
          originalPrice={editModalOriginalPrice}
          priceDirty={editModalPriceDirty}
          onItemNameChange={setEditModalName}
          onCategoryChange={setEditModalCategoryId}
          onQuantityChange={setEditModalQuantity}
          onNoteChange={setEditModalNote}
          onNoteStoreChange={setEditModalNoteStore}
          onPriceChange={setEditModalPrice}
          onPriceDirtyChange={setEditModalPriceDirty}
          onStoreChange={(newStore) => {
            setEditModalStore(newStore);
            if (newStore) setNeedsStoreHint(false);
            if (editModalItem && newStore) {
              setItemStorePreference(editModalItem.item_name, newStore);
            }
          }}
          onSave={saveEdit}
          onToggleFavorite={toggleFavorite}
          categories={categories}
          stores={stores}
          favorites={favorites}
          saving={savingEdit}
          focusField={editModalFocusField}
          storeRequiredOpen={storeRequiredOpen}
          onStoreRequiredClose={() => setStoreRequiredOpen(false)}
          getCategoryColorById={getCategoryColorById}
        />


        {/* TOAST: Item removed from shopping list */}
        <UndoToast
          isVisible={mounted && !!removedFromListToastItem}
          message={removedFromListToastItem ? `Removed "${removedFromListToastItem.item_name}" from your shopping list.` : ''}
          onUndo={undoRemove}
          onDismiss={dismissRemoveToast}
        />

        {/* TOAST: Item added to shopping list */}
        <UndoToast
          isVisible={mounted && !!addedToListToastItem}
          message={addedToListToastItem ? `Added "${addedToListToastItem.item_name}" to your shopping list.` : ''}
          onUndo={undoAdd}
          onDismiss={dismissAddToast}
        />

        {/* TOAST: Item checked off shopping list */}
        <UndoToast
          isVisible={mounted && !!checkedOffListToastItem}
          message={checkedOffListToastItem ? `Checked off "${checkedOffListToastItem.item_name}" from your shopping list!` : ''}
          onUndo={undoCheck}
          onDismiss={dismissCheckToast}
        />

        {/* TOAST: Trip complete */}
        <UndoToast
          isVisible={mounted && !!tripCompleteToastStore}
          message={tripCompleteToastStore ? `Your trip at ${tripCompleteToastStore} is complete!` : ''}
          onDismiss={dismissTripCompleteToast}
          variant="success"
          emoji="🎉"
        />

        {/* TOAST: Trip started */}
        <UndoToast
          isVisible={mounted && !!tripStartedToastStore}
          message={tripStartedToastStore ? `Trip started at ${tripStartedToastStore}!` : ''}
          onUndo={undoTripStart}
          onDismiss={dismissTripStartedToast}
          variant="success"
          emoji="🚀"
        />

      </div>

      {/* Price Photo Capture Modal */}
      {showPricePhotoCapture && (
        <PricePhotoCapture
          onImageCaptured={handleImageCaptured}
          onClose={() => setShowPricePhotoCapture(false)}
        />
      )}

      {/* Price Review Modal */}
      {showPriceReviewModal && extractedPriceData && priceSubmissionId && householdCode && (
        <PriceReviewModal
          extractedData={extractedPriceData}
          submissionId={priceSubmissionId}
          onConfirm={handlePriceConfirm}
          onCancel={() => {
            setShowPriceReviewModal(false);
            setExtractedPriceData(null);
            setPriceSubmissionId(null);
          }}
          householdCode={householdCode}
          defaultStore={currentScanStore}
          showStatus={showStatus}
        />
      )}

      {/* Analyzing Loading Indicator */}
      {isAnalyzingPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-teal-600"></div>
            <p className="text-lg font-semibold text-gray-900">Analyzing price tag...</p>
            <p className="text-sm text-gray-600">This may take a few seconds</p>
          </div>
        </div>
      )}

      <StatusModal
        isOpen={statusModal.isOpen}
        onClose={closeStatusModal}
        title={statusModal.title}
        message={statusModal.message}
        type={statusModal.type}
      />
    </div >
  );
}
