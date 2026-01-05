'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

interface ListItem {
  id: string; // shopping_list row id
  item_id: number; // items table id (FK) ✅
  item_name: string;
  quantity: number;
  checked: boolean;
}

interface ItemRow {
  id: number;
  name: string;
  is_favorite: boolean | null;
}

interface PriceData {
  price: string;
  date: string;
}

type StoreChoice = 'AUTO' | string;

export default function ShoppingList() {
  const [activeTrips, setActiveTrips] = useState<{ [store_id: string]: string }>({});
  const [stores, setStores] = useState<string[]>([]);
  const [storesByName, setStoresByName] = useState<{ [name: string]: string }>({});

  // ✅ Keep full items with IDs so selection can be ID-based
  const [allItems, setAllItems] = useState<ItemRow[]>([]);
  // Keep names too (handy for filtering/autocomplete UI)
  const [items, setItems] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

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
  const [editModalFocusField, setEditModalFocusField] = useState<'name' | 'price'>('name');
  const [recentItems, setRecentItems] = useState<string[]>([]);
  const [recentItemIds, setRecentItemIds] = useState<string[]>([]);

  const recentItemSet = new Set(recentItems.map((s) => s.toLowerCase()));
  const favoriteSet = new Set(favorites.map((s) => s.toLowerCase()));

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  type SelectItemsFilter = 'ALL' | 'FAVORITES' | 'RECENT';
  const [selectItemsFilter, setSelectItemsFilter] = useState<SelectItemsFilter>('ALL');

  // =========================
  // Mobile Mode Toggle (Store vs Build)
  // =========================
  const [mobileMode, setMobileMode] = useState<'store' | 'build'>('store');

  // Load household code from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const code = localStorage.getItem('household_code');
      setHouseholdCode(code);
    }
  }, []);

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
    }, 5000);

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
    }, 5000);

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
  

  useEffect(() => {
    const stored = localStorage.getItem('last_price_store');
    if (stored && stores.includes(stored)) {
      setLastUsedStore(stored);
    }
  }, [stores]);

  // =========================
  // Store preference override
  // =========================
  const [storePrefs, setStorePrefs] = useState<Record<string, StoreChoice>>({});
  const STORE_PREF_KEY = 'store_prefs_by_item';

  const loadStorePrefs = () => {
    try {
      const raw = localStorage.getItem(STORE_PREF_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, StoreChoice>;
      return {};
    } catch {
      return {};
    }
  };

  const persistStorePrefs = (prefs: Record<string, StoreChoice>) => {
    try {
      localStorage.setItem(STORE_PREF_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  };

  const setItemStorePreference = (itemName: string, choice: StoreChoice) => {
    setStorePrefs((prev) => {
      const next = { ...prev, [itemName]: choice };
      persistStorePrefs(next);
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
  const [editModalQuantity, setEditModalQuantity] = useState(1);
  const [editModalStore, setEditModalStore] = useState('');
  const [editModalPrice, setEditModalPrice] = useState('');
  const [editModalOriginalPrice, setEditModalOriginalPrice] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditModal = (item: ListItem, focusField: 'name' | 'price' = 'name') => {
    setEditModalItem(item);
    setEditModalName(item.item_name);
    setEditModalQuantity(item.quantity);
    setEditModalFocusField(focusField);

    const effStore = getEffectiveStore(item.item_name);
    if (effStore) {
      setEditModalStore(effStore);
      const priceData = prices[`${effStore}-${item.item_name}`];
      if (priceData) {
        setEditModalPrice(priceData.price);
        setEditModalOriginalPrice(priceData.price);
      } else {
        setEditModalPrice('');
        setEditModalOriginalPrice('');
      }
    } else {
      setEditModalStore(lastUsedStore || stores[0] || '');
      setEditModalPrice('');
      setEditModalOriginalPrice('');
    }

    setEditModalOpen(true);
    setSavingEdit(false);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditModalItem(null);
    setEditModalName('');
    setEditModalQuantity(1);
    setEditModalStore('');
    setEditModalPrice('');
    setEditModalOriginalPrice('');
    setSavingEdit(false);
  };

  const saveEdit = async () => {
    if (!editModalItem || !editModalName.trim()) return;

    const newName = editModalName.trim();
    const oldName = editModalItem.item_name;

    setSavingEdit(true);

    try {
      if (newName !== oldName) {
        const { data: existingItem } = await supabase
          .from('items')
          .select('id')
          .eq('name', newName)
          .eq('user_id', SHARED_USER_ID)
          .maybeSingle();

        if (existingItem && existingItem.id !== editModalItem.item_id) {
          alert('An item with this name already exists.');
          setSavingEdit(false);
          return;
        }

        const { error: itemError } = await supabase
          .from('items')
          .update({ name: newName })
          .eq('id', editModalItem.item_id)
          .eq('user_id', SHARED_USER_ID);
        if (itemError) throw itemError;

        const { error: listError } = await supabase
          .from('shopping_list')
          .update({ item_name: newName })
          .eq('item_id', editModalItem.item_id)
          .eq('user_id', SHARED_USER_ID);
        if (listError) throw listError;

        const { error: priceError } = await supabase
          .from('price_history')
          .update({ item_name: newName })
          .eq('item_id', editModalItem.item_id)
          .eq('user_id', SHARED_USER_ID);
        if (priceError) throw priceError;
      }

      if (editModalQuantity !== editModalItem.quantity) {
        const { error: qtyError } = await supabase
          .from('shopping_list')
          .update({ quantity: editModalQuantity })
          .eq('id', editModalItem.id)
          .eq('user_id', SHARED_USER_ID);
        if (qtyError) throw qtyError;
      }

      if (editModalPrice && editModalPrice !== editModalOriginalPrice) {
        const priceNum = parseFloat(editModalPrice);
        if (!isNaN(priceNum) && priceNum > 0) {
          const storeId = storesByName[editModalStore];
          if (!storeId) throw new Error('Store not found');

          const { error: priceError } = await supabase.from('price_history').insert({
            item_id: editModalItem.item_id,
            item_name: newName,
            store_id: storeId,
            store: editModalStore,
            price: priceNum.toFixed(2),
            user_id: SHARED_USER_ID,
            household_code: householdCode,
            recorded_date: new Date().toISOString(),
          });

          if (priceError) throw priceError;

          setLastUsedStore(editModalStore);
          localStorage.setItem('last_price_store', editModalStore);
        }
      }

      await loadData();
      closeEditModal();
    } catch (error) {
      console.error('Error saving edit:', error);
      alert('Failed to save changes. Check your connection and try again.');
      setSavingEdit(false);
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
      setStorePrefs(loadStorePrefs());
    }

    if (householdCode) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdCode]);

  const loadData = async () => {
    const { data: storesData, error: storesError } = await supabase.from('stores').select('id, name').order('name');
    if (storesError) console.error('Error loading stores:', storesError);

    if (storesData) {
      setStores(storesData.map((s) => s.name));
      const lookup: { [name: string]: string } = {};
      storesData.forEach((s) => (lookup[s.name] = s.id));
      setStoresByName(lookup);
    }

    const { data: tripsData, error: tripsError } = await supabase
      .from('trips')
      .select('id, store_id')
      .eq('household_code', householdCode)
      .is('ended_at', null)
      .order('started_at', { ascending: false });

    if (tripsError) {
      console.error('Error loading trips:', tripsError);
    } else if (tripsData) {
      const tripsByStore: { [store_id: string]: string } = {};
      tripsData.forEach((trip) => {
        if (trip.store_id && !tripsByStore[trip.store_id]) tripsByStore[trip.store_id] = trip.id;
      });
      setActiveTrips(tripsByStore);
    }

    // ✅ Load all items with IDs
    const { data: itemsData, error: itemsError } = await supabase
      .from('items')
      .select('id, name, is_favorite')
      .eq('user_id', SHARED_USER_ID)
      .order('name');

    if (itemsError) console.error('Error loading items:', itemsError);

    let itemNameById: Record<string, string> = {};
    if (itemsData) {
      const rows = itemsData as ItemRow[];
      setAllItems(rows);
      setItems(rows.map((i) => i.name));
      setFavorites(rows.filter((i) => i.is_favorite === true).map((i) => i.name));

      itemNameById = rows.reduce<Record<string, string>>((acc, i) => {
        if (i?.id && i?.name) acc[String(i.id)] = i.name;
        return acc;
      }, {});
    }

    const { data: listData, error: listError } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('user_id', SHARED_USER_ID)
      .eq('household_code', householdCode);

    if (listError) console.error('Error loading shopping list:', listError);
    if (listData) setListItems(listData as ListItem[]);

    const { data: pricesData, error: pricesError } = await supabase
      .from('price_history')
      .select('*')
      .eq('user_id', SHARED_USER_ID)
      .order('recorded_date', { ascending: false });

    if (pricesError) console.error('Error loading prices:', pricesError);

    if (pricesData) {
      const pricesObj: { [key: string]: { price: string; date: string } } = {};
      const latestPrices: { [key: string]: any } = {};

      pricesData.forEach((p) => {
        const key = `${p.store}-${p.item_name}`;
        if (!latestPrices[key] || new Date(p.recorded_date) > new Date(latestPrices[key].recorded_date)) {
          latestPrices[key] = p;
          pricesObj[key] = { price: p.price, date: p.recorded_date };
        }
      });

      setPrices(pricesObj);
    }

    // =========================
    // Recent items — item_id based ✅
    // =========================
    if (!householdCode) {
      setRecentItems([]);
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
        setRecentItems([]);
        setRecentItemIds([]);
      } else {
        const seen = new Set<string>();
        const uniqueIds = (recentData ?? [])
          .map((r: any) => r.item_id)
          .filter((id: any): id is string | number => (typeof id === 'string' || typeof id === 'number') && String(id).length > 0)
          .map((id: any) => String(id))
          .filter((id: string) => (seen.has(id) ? false : (seen.add(id), true)))
          .slice(0, 25);

        setRecentItemIds(uniqueIds);

        const uniqueNames = uniqueIds.map((id) => (itemNameById[id] ?? '').trim()).filter((n) => n.length > 0);
        setRecentItems(uniqueNames);
      }
    }

    setLoading(false);
  };

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
      const listIds = new Set(listItems.map((li) => li.item_id));

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

  const toggleChecked = async (id: string) => {
    const item = listItems.find((li) => li.id === id);
    if (!item) return;

    const newCheckedState = !item.checked;

    try {
      setListItems(listItems.map((li) => (li.id === id ? { ...li, checked: newCheckedState } : li)));

      if (newCheckedState) {
        const effectiveStoreName = getEffectiveStore(item.item_name);
        const effectiveStoreId = effectiveStoreName ? storesByName[effectiveStoreName] : null;

        const response = await fetch('/api/shopping-list/check-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopping_list_id: id,
            store_id: effectiveStoreId,
          }),
        });

        if (!response.ok) throw new Error('Failed to check item');

        await loadData();
          // 🔔 SHOW TOAST
        showCheckedOffListToast(item);

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
        const { error } = await supabase.from('shopping_list').delete().eq('id', id).eq('user_id', SHARED_USER_ID);
        if (error) throw new Error(`Failed to remove item: ${error.message}`);
      } catch (error) {
        console.error('Error removing item:', error);
        setListItems((prev) => [...prev, item]);
        alert('Failed to remove item. Check your connection and try again.');
      } finally {
        setUndoRemoveItem(null);
        setUndoRemoveTimeout(null);
      }
    }, 5000);

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

  // ✅ Build-mode available items are now ID-based (rename-safe)
  const buildModeAvailableAll = filteredItemRows.filter((it) => !listItemIdsSet.has(it.id));

  const buildModeAllCount = buildModeAvailableAll.length;
  const buildModeFavoritesCount = buildModeAvailableAll.filter((it) => favoriteSet.has(it.name.toLowerCase())).length;
  const buildModeRecentCount = buildModeAvailableAll.filter((it) => recentItemIds.includes(String(it.id))).length;

  const buildModeAvailableItems =
    selectItemsFilter === 'FAVORITES'
      ? buildModeAvailableAll.filter((it) => favoriteSet.has(it.name.toLowerCase()))
      : selectItemsFilter === 'RECENT'
      ? buildModeAvailableAll.filter((it) => recentItemIds.includes(String(it.id)))
      : buildModeAvailableAll;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 p-0 md:p-8">
      <div className="sticky top-0 z-50 bg-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4">
          <div className="flex justify-between items-center">
            <Header currentPage="Shopping List" />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-2 md:px-4 py-4">
        {/* Mobile-only mode toggle */}
        <div className="md:hidden rounded-lg p-2 mb-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMobileMode('build')}
              className={`py-2 rounded-lg font-bold text-sm cursor-pointer transition ${
                mobileMode === 'build' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Build Mode
            </button>
            <button
              onClick={() => setMobileMode('store')}
              className={`py-2 rounded-lg font-bold text-sm cursor-pointer transition ${
                mobileMode === 'store' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Store Mode
            </button>
          </div>
        </div>

        {/* Alphabet Filter - Desktop + Mobile (Build Mode only) */}
        <div
          className={`${isMobile ? (mobileMode === 'build' ? 'block' : 'hidden') : 'hidden md:block'} bg-white rounded-2xl shadow-lg p-3 md:p-4 mb-4 md:mb-6`}
        >
          <div className="flex flex-wrap gap-1.5 md:gap-2 justify-center">
            <button
              onClick={() => setFilterLetter('All')}
              className={`px-2.5 py-1.5 md:px-3 md:py-1 rounded text-sm md:text-base font-semibold cursor-pointer transition ${
                filterLetter === 'All' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                  className={`px-2.5 py-1.5 md:px-3 md:py-1 rounded text-sm md:text-base font-semibold cursor-pointer transition ${
                    filterLetter === letter ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {letter}
                </button>
              ))}
          </div>
        </div>

        {/* Add to List Widget - Desktop + Mobile(Build) */}
        {(!isMobile || mobileMode === 'build') && (
          <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
            <h2 className="text-xl font-semibold mb-3 text-gray-800">Search Items</h2>
            <div className="relative autocomplete-container">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Select existing or add new"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
                  value={newItem}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addNewItem()}
                  onFocus={() => {
                    const listIds = new Set(listItems.map((li) => li.item_id));
                    const available = allItems.filter((it) => !listIds.has(it.id)).map((it) => it.name);
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
            <p className="text-xs text-gray-500 mt-2">{newItem.trim() && !items.includes(newItem.trim()) ? `"${newItem}" will be added as a new item` : ''}</p>
          </div>
        )}

        {/* Build Mode: Select Items (Mobile Only) */}
        {isMobile && mobileMode === 'build' && (
          <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold text-gray-800">Select Items</h2>
              <span className="text-xs text-gray-500">{buildModeAvailableItems.length} available</span>
            </div>

            <div className="grid grid-flow-col auto-cols-fr gap-2 mb-3">
              <button
                onClick={() => setSelectItemsFilter('ALL')}
                className={`px-3 py-1 rounded-full text-sm font-semibold border transition cursor-pointer ${
                  selectItemsFilter === 'ALL'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-gray-200 hover:bg-slate-50'
                }`}
              >
                All Items
              </button>

              <button
                onClick={() => setSelectItemsFilter('FAVORITES')}
                className={`px-3 py-1 rounded-full text-sm font-semibold border transition cursor-pointer ${
                  selectItemsFilter === 'FAVORITES'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'
                }`}
              >
                Favorites
              </button>

              <button
                onClick={() => setSelectItemsFilter('RECENT')}
                className={`px-3 py-1 rounded-full text-sm font-semibold border transition cursor-pointer ${
                  selectItemsFilter === 'RECENT'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white text-rose-600 border-rose-200 hover:bg-slate-50'
                }`}
              >
                Recent
              </button>
            </div>

            {buildModeAvailableItems.length === 0 ? (
              <div className="text-sm text-gray-500">All items added for this letter.</div>
            ) : (
              <div className="space-y-2 max-h-114 overflow-y-auto">
                {buildModeAvailableItems.slice(0, 250).map((it) => {
                  const isFavorite = favorites.includes(it.name);
                  return (
                    <div
                      key={it.id}
                      className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition
                        ${isFavorite ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{it.name}</div>
                      </div>

                      <button
                        onClick={() => toggleItemById(it.id, it.name)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition"
                      >
                        Add
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Favorites Widget - Hidden on Mobile */}
        {filteredFavorites.length > 0 && (
          <div className="hidden md:block bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-4 md:mb-6">
            <div className="flex justify-between items-center mb-3">
              <button
                onClick={() => setShowFavorites(!showFavorites)}
                className="flex items-center gap-2 text-lg md:text-xl font-bold text-gray-800 cursor-pointer hover:text-blue-600 transition"
              >
                <span className="text-gray-400">{showFavorites ? '▼' : '▶'}</span>
                <span>⭐ Select Favorites</span>
              </button>
              <button
                onClick={
                  allFavoritesSelected
                    ? () => {
                        favorites.forEach((fav) => {
                          const row = allItems.find((it) => it.name === fav);
                          if (row) toggleItemById(row.id, row.name);
                        });
                      }
                    : addFavorites
                }
                className="text-sm bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-2xl font-semibold transition cursor-pointer"
              >
                {allFavoritesSelected ? 'Deselect All' : 'Add All'}
              </button>
            </div>
            {showFavorites && (
              <div className="flex flex-wrap gap-2">
                {filteredFavorites.map((name) => {
                  const row = allItems.find((it) => it.name === name);
                  const isInList = row ? listItems.some((li) => li.item_id === row.id) : listItems.find((li) => li.item_name === name);
                  return (
                    <button
                      key={name}
                      onClick={() => {
                        if (row) toggleItemById(row.id, row.name);
                        else selectItem(name);
                      }}
                      className={`px-3 py-1.5 rounded-2xl border-2 transition cursor-pointer text-sm font-semibold ${
                        isInList
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-yellow-400 hover:border-yellow-500 bg-white text-gray-700 hover:bg-yellow-50'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Add Items Section - Hidden on Mobile */}
        <div className="hidden md:block bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
          <button
            onClick={() => setShowAddItems(!showAddItems)}
            className="flex items-center gap-2 text-xl font-bold mb-4 text-gray-800 cursor-pointer hover:text-blue-600 transition"
          >
            <span className="text-gray-400">{showAddItems ? '▼' : '▶'}</span>
            <span>Select Items</span>
          </button>

          {showAddItems && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 overflow-y-auto" style={{ maxHeight: '252px' }}>
              {filteredItemRows.map((it) => {
                const isFavorite = favorites.includes(it.name);
                const isInList = listItems.some((li) => li.item_id === it.id);

                return (
                  <button
                    key={it.id}
                    onClick={() => toggleItemById(it.id, it.name)}
                    className={`p-4 md:p-3 rounded-2xl border-2 transition cursor-pointer font-semibold text-base ${
                      isInList
                        ? 'bg-blue-600 text-white border-blue-600'
                        : isFavorite
                        ? 'bg-yellow-50 border-yellow-200 text-gray-700 hover:bg-yellow-100'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                    }`}
                  >
                    {it.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Shopping List */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
            <p className="text-slate-500 mt-4">Loading Shopping List...</p>
          </div>
        ) : listItems.length > 0 ? (
          <>
            {/* List Items */}
            <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                  Your List ({listItems.filter((i) => !i.checked).length} items)
                </h2>
                <div className="flex gap-2">
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

                const displayItems = !showCheckedItems ? listItems.filter((item) => !item.checked) : listItems;

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
                    {/* First: Active trip stores */}
                    {storeEntries
                      .filter(([store]) => {
                        const storeId = storesByName[store];
                        return storeId && activeTrips[storeId];
                      })
                      .sort(([storeA], [storeB]) => storeA.localeCompare(storeB))
                      .map(([store, storeItems]) => {
                        const storeId = storesByName[store];
                        const hasActiveTrip = storeId && activeTrips[storeId];

                        return (
                          <div key={store}>
                            <h3 className="text-lg font-bold text-gray-700 mb-2 flex items-center gap-2 justify-between">
                              <div className="flex items-center gap-2">
                                <span className="bg-indigo-500 text-white font-bold px-3 py-1 rounded-full text-sm">{store} (Active Store)</span>
                                <span className="text-sm text-gray-500">
                                  {storeItems.length} {storeItems.length === 1 ? 'item' : 'items'}
                                </span>
                              </div>
                              <span className="text-lg font-bold text-teal-600">
                                $
                                {storeItems
                                  .reduce((sum, item) => {
                                    const priceData = prices[`${store}-${item.item_name}`];
                                    const price = priceData ? parseFloat(priceData.price) : 0;
                                    return sum + price * item.quantity;
                                  }, 0)
                                  .toFixed(2)}
                              </span>
                            </h3>

                            <div className="space-y-2">
                              {storeItems.map((item) => {
                                const isFavorite = favorites.includes(item.item_name);
                                const effStore = getEffectiveStore(item.item_name) || store;
                                const priceData = prices[`${effStore}-${item.item_name}`];
                                const price = priceData ? parseFloat(priceData.price) : 0;

                                return (
                                  <div
                                    key={item.id}
                                    className={`flex items-center gap-3 p-3 rounded-2xl border transition ${
                                      item.checked
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
                                      className={`w-5 h-5 rounded transition ${mobileMode == 'build' ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}`}
                                    ></input>

                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                          type="button"
                                          onClick={() => openEditModal(item)}
                                          className={`font-medium hover:text-teal-600 text-left cursor-pointer ${
                                            item.checked ? 'text-gray-500 line-through' : 'text-gray-800'
                                          }`}
                                        >
                                          {item.item_name}
                                          {item.quantity > 1 ? ` (${item.quantity})` : ''}
                                        </button>
                                      </div>

                                      {priceData ? (
                                        <p className="text-xs text-green-600 mt-0.5">
                                          {formatMoney(price)}{' '}
                                          {item.quantity > 1 && `× ${item.quantity} = ${formatMoney(price * item.quantity)}`}
                                          <span className="text-gray-400 ml-1">({getDaysAgo(priceData.date)})</span>
                                        </p>
                                      ) : (
                                        <p className="text-xs text-gray-400 mt-0.5">No price data available</p>
                                      )}
                                    </div>

                                    <div className="hidden md:flex items-center gap-2">
                                      <button
                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                        className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold cursor-pointer"
                                      >
                                        −
                                      </button>
                                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                                      <button
                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                        className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold cursor-pointer"
                                      >
                                        +
                                      </button>
                                    </div>

                                    <button
                                      onClick={() => openStoreModal(item.item_name)}
                                      className={`cursor-pointer text-xl ml-1 transition ${
                                        storePrefs[item.item_name] && storePrefs[item.item_name] !== 'AUTO'
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
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                    {/* Second: Items without price data */}
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

                        <div className="space-y-2">
                          {itemsWithoutPrice.map((item) => {
                            const isFavorite = favorites.includes(item.item_name);

                            return (
                              <div
                                key={item.id}
                                className={`flex items-center gap-3 p-3 rounded-2xl border transition ${
                                  item.checked
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
                                  className={`w-5 h-5 rounded transition ${mobileMode == 'build' ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}`}
                                ></input>

                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {isFavorite && <span className="text-yellow-500 text-xl">⭐</span>}
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(item)}
                                      className={`font-medium hover:text-teal-600 text-left cursor-pointer ${
                                        item.checked ? 'text-gray-500 line-through' : 'text-gray-800'
                                      }`}
                                    >
                                      {item.item_name}
                                      {item.quantity > 1 ? ` (${item.quantity})` : ''}
                                    </button>
                                  </div>
                                  <button
                                    onClick={() => openEditModal(item, 'price')}
                                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition inline-block mt-0.5"
                                  >
                                    Add Price
                                  </button>
                                </div>

                                <button
                                  onClick={() => openStoreModal(item.item_name)}
                                  className={`cursor-pointer ml-1 transition ${
                                    storePrefs[item.item_name] && storePrefs[item.item_name] !== 'AUTO'
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
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Third: All other stores alphabetically */}
                    {storeEntries
                      .filter(([store]) => {
                        const storeId = storesByName[store];
                        return !(storeId && activeTrips[storeId]);
                      })
                      .sort(([storeA], [storeB]) => storeA.localeCompare(storeB))
                      .map(([store, storeItems]) => {
                        return (
                          <div key={store}>
                            <h3 className="text-lg font-bold text-gray-700 mb-2 flex items-center gap-2 justify-between">
                              <div className="flex items-center gap-2">
                                <span className="bg-teal-500 text-white px-3 py-1 rounded-full text-sm">{store}</span>
                                <span className="text-sm text-gray-500">
                                  {storeItems.length} {storeItems.length === 1 ? 'item' : 'items'}
                                </span>
                              </div>
                              <span className="text-lg font-bold text-teal-600">
                                $
                                {storeItems
                                  .reduce((sum, item) => {
                                    const priceData = prices[`${store}-${item.item_name}`];
                                    const price = priceData ? parseFloat(priceData.price) : 0;
                                    return sum + price * item.quantity;
                                  }, 0)
                                  .toFixed(2)}
                              </span>
                            </h3>

                            <div className="space-y-2">
                              {storeItems.map((item) => {
                                const isFavorite = favorites.includes(item.item_name);
                                const effStore = getEffectiveStore(item.item_name) || store;
                                const priceData = prices[`${effStore}-${item.item_name}`];
                                const price = priceData ? parseFloat(priceData.price) : 0;

                                return (
                                  <div
                                    key={item.id}
                                    className={`flex items-center gap-3 p-3 rounded-2xl border transition ${
                                      item.checked
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
                                      className={`w-5 h-5 rounded transition ${mobileMode == 'build' ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}`}
                                    ></input>

                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                          type="button"
                                          onClick={() => openEditModal(item)}
                                          className={`font-medium hover:text-teal-600 text-left cursor-pointer ${
                                            item.checked ? 'text-gray-500 line-through' : 'text-gray-800'
                                          }`}
                                        >
                                          {item.item_name}
                                          {item.quantity > 1 ? ` (${item.quantity})` : ''}
                                        </button>
                                      </div>

                                      {priceData ? (
                                        <p className="text-xs text-green-600 mt-0.5">
                                          {formatMoney(price)}{' '}
                                          {item.quantity > 1 && `× ${item.quantity} = ${formatMoney(price * item.quantity)}`}
                                          <span className="text-gray-400 ml-1">({getDaysAgo(priceData.date)})</span>
                                        </p>
                                      ) : (
                                        <p className="text-xs text-gray-400 mt-0.5">No price data available</p>
                                      )}
                                    </div>

                                    <div className="hidden md:flex items-center gap-2">
                                      <button
                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                        className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold cursor-pointer"
                                      >
                                        −
                                      </button>
                                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                                      <button
                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                        className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold cursor-pointer"
                                      >
                                        +
                                      </button>
                                    </div>

                                    <button
                                      onClick={() => openStoreModal(item.item_name)}
                                      className={`cursor-pointer text-xl ml-1 transition ${
                                        storePrefs[item.item_name] && storePrefs[item.item_name] !== 'AUTO'
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
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })()}

              <div className="mt-1 pt-1">
                <p className="text-sm text-gray-500 text-left">Click an item to rename, update quantity or set the latest price.</p>
              </div>

              <div className="mt-6 pt-4 border-t-2 border-gray-300">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-gray-800">Total</span>
                  <span className="text-2xl font-bold text-teal-600">
                    {formatMoney(
                      listItems.reduce((sum, item) => {
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

            {/* Best Store Recommendation - Desktop Only */}
            {sortedStores.length > 0 && (
              <div className="hidden md:block bg-white rounded-2xl shadow-lg p-4 md:p-6">
                <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">Best Single Store</h2>
                <div className="space-y-3">
                  {sortedStores.map(([store, data], idx) => {
                    const coveragePercent = ((data.coverage / data.itemCount) * 100).toFixed(0);
                    const isComplete = data.coverage === data.itemCount;

                    return (
                      <div key={store} className={`p-4 rounded-2xl border-2 ${idx === 0 ? 'bg-green-50 border-green-500' : 'bg-gray-50 border-gray-300'}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xl text-gray-800">{store}</span>
                              {idx === 0 && <span className="text-sm bg-green-500 text-white px-3 py-1 rounded-full">Best Deal!</span>}
                            </div>
                            {listItems.length > 1 && (
                              <p className={`text-xs md:text-sm mt-1 flex items-center gap-1 ${isComplete ? 'text-green-600' : 'text-orange-600'}`}>
                                <span>
                                  {data.coverage}/{data.itemCount} items ({coveragePercent}% coverage)
                                  {!isComplete && ' ⚠️'}
                                </span>
                                {isComplete && listItems.length > 1 && <span className="text-sm bg-blue-500 text-white px-2 py-1 rounded-full">✓</span>}
                              </p>
                            )}
                            {listItems.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {listItems.map((item) => {
                                  const priceData = prices[`${store}-${item.item_name}`];
                                  if (priceData) {
                                    const price = parseFloat(priceData.price);
                                    const classification = getPriceClassification(item.item_name, price);
                                    return (
                                      <p key={item.id} className="text-xs text-gray-600">
                                        {item.item_name}: {formatMoney(price)}
                                        {item.quantity > 1 && ` × ${item.quantity}`}
                                        <span className="text-gray-400 ml-1">({getDaysAgo(priceData.date)})</span>
                                        {classification && (
                                          <span className={`ml-1 font-semibold ${classification.color}`}>
                                            {classification.emoji} {classification.label}
                                          </span>
                                        )}
                                      </p>
                                    );
                                  }
                                  return (
                                    <p key={item.id} className="text-xs text-gray-400">
                                      {item.item_name}: no price
                                    </p>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <span className="text-2xl font-bold text-gray-800">{formatMoney(data.total)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">Your shopping list is empty</p>
            {favorites.length > 0 && (
              <button
                onClick={addFavorites}
                className="hidden md:inline-flex bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-2xl font-semibold transition cursor-pointer items-center gap-2"
              >
                <span className="text-xl">⭐</span>
                Add Favorites to Get Started
              </button>
            )}

            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 mt-6 max-w-2xl mx-auto">
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
                      if (!isMobile) {
                        const listIds = new Set(listItems.map((li) => li.item_id));
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

        {/* ========================= */}
        {/* Store Picker Modal */}
        {/* ========================= */}
        {storeModalOpen && activeItemForStoreModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-5 max-w-md w-full">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    🔁 Swap Store
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {activeItemForStoreModal}
                  </p>
                </div>
                <button
                  onClick={closeStoreModal}
                  className="text-gray-300 hover:text-gray-500 cursor-pointer text-xl"
                  aria-label="Close"
                >
                  ✖️
                </button>
              </div>

              {(() => {
                const options = getStoreOptionsForItem(activeItemForStoreModal);
                if (options.length === 0) {
                  return (
                    <p className="text-sm text-gray-500">
                      No price data available for this item yet.
                    </p>
                  );
                }

                return (
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setItemStorePreference(activeItemForStoreModal, 'AUTO');
                        closeStoreModal();
                      }}
                      className="w-full text-left px-4 py-3 rounded-xl border border-gray-300 hover:bg-gray-50 font-semibold"
                    >
                      🤖 Auto (Cheapest)
                    </button>

                    {options.map(({ store, price }) => (
                      <button
                        key={store}
                        onClick={() => {
                          setItemStorePreference(activeItemForStoreModal, store);
                          closeStoreModal();
                        }}
                        className="w-full text-left px-4 py-3 rounded-xl border border-gray-300 hover:bg-gray-50"
                      >
                        {store} — {formatMoney(price)}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ========================= */}
        {/* Unified Edit Modal */}
        {/* ========================= */}
        {editModalOpen && editModalItem && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-gray-800">Edit Item</h3>
                <button
                  onClick={closeEditModal}
                  className="text-gray-300 hover:text-gray-500 cursor-pointer text-xl"
                >
                  ✖️
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="text-sm font-semibold text-gray-700">Name</label>
                  <input
                    autoFocus={editModalFocusField === 'name'}
                    type="text"
                    value={editModalName}
                    onChange={(e) => setEditModalName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label className="text-sm font-semibold text-gray-700">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={editModalQuantity}
                    onChange={(e) => setEditModalQuantity(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-xl"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Latest Price ({editModalStore || 'Store'})
                  </label>
                  <input
                    autoFocus={editModalFocusField === 'price'}
                    type="number"
                    step="0.01"
                    value={editModalPrice}
                    onChange={(e) => setEditModalPrice(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-xl"
                  />
                </div>
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
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingEdit ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================= */}
        {/* Item Removed from Shopping List Toast (with Undo button) */}
        {/* ========================= */}
        {mounted && removedFromListToastItem && (
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
      )}

        {/* ========================= */}
        {/* Item Added to Shopping List Toast (with Undo button) */}
        {/* ========================= */}
        {mounted && addedToListToastItem && (
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
        )}

        {/* ========================= */}
        {/* Checked Item Toast (with Undo button) */}
        {/* ========================= */}
        {mounted && checkedOffListToastItem && (
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
        )}


      </div>
    </div>
  );
}
