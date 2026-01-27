'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { parseLocalDate, getLocalDateString } from '../utils/date';
import StatusModal from '../components/StatusModal';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

interface PriceRecord {
  id: string;
  item_name: string;
  store: string;
  price: string;
  recorded_date: string;
  created_at: string;
  store_id?: string; // Add store_id to type if we need it, though PriceRecord usually comes from DB
}

interface Store {
  id: string;
  name: string;
  location: string | null;
}



function HistoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [stores, setStores] = useState<Store[]>([]);
  const [favoriteStoreIds, setFavoriteStoreIds] = useState<string[]>([]);

  const [selectedItemName, setSelectedItemName] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('All');
  const [priceHistory, setPriceHistory] = useState<PriceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [newDate, setNewDate] = useState('');
  const [showCopied, setShowCopied] = useState(false);
  const [selectedItemUnit, setSelectedItemUnit] = useState<string>('count');
  const [selectedItemIsWeighted, setSelectedItemIsWeighted] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Status Modal State
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showStatus = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setStatusModal({ isOpen: true, title, message, type });
  };

  // Search/autocomplete state
  const [searchQuery, setSearchQuery] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    loadStoresAndItems();
    // Set today's date as default for new entries (using local time)
    setNewDate(getLocalDateString());
  }, []);

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-autocomplete-container')) {
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

  useEffect(() => {
    if (!isInitialLoad) return;

    // Load from URL parameters with proper decoding
    const idParam = searchParams.get('itemId');
    const nameParam = searchParams.get('item'); // Legacy/Fallback
    const storeParam = searchParams.get('store');

    const initialize = async () => {
      let resolvedId = '';
      let resolvedName = '';

      if (idParam) {
        try {
          resolvedId = JSON.parse(idParam);
          // Fetch name for this ID
          const { data } = await supabase.from('items').select('name, unit, is_weighted').eq('id', resolvedId).single();
          if (data) {
            resolvedName = data.name;
            setSelectedItemUnit(data.unit || 'count');
            setSelectedItemIsWeighted(data.is_weighted || false);
          }
        } catch {
          resolvedId = idParam;
          const { data } = await supabase.from('items').select('name').eq('id', resolvedId).single();
          if (data) resolvedName = data.name;
        }
      } else if (nameParam) {
        // Fallback to name if ID is missing (legacy URLs)
        try {
          resolvedName = JSON.parse(nameParam);
        } catch {
          resolvedName = nameParam;
        }
        // Try to find the first ID matching this name
        const { data } = await supabase.from('items').select('id, name, unit, is_weighted').eq('name', resolvedName).limit(1).single();
        if (data) {
          resolvedId = data.id;
          resolvedName = data.name;
          setSelectedItemUnit(data.unit || 'count');
          setSelectedItemIsWeighted(data.is_weighted || false);
        }
      } else {
        // No URL params - check localStorage
        try {
          const lastId = localStorage.getItem('history_last_item_id');
          const lastItem = localStorage.getItem('history_last_item'); // Legacy

          if (lastId) {
            resolvedId = lastId;
            const { data } = await supabase.from('items').select('name, unit, is_weighted').eq('id', lastId).single();
            if (data) {
              resolvedName = data.name;
              setSelectedItemUnit(data.unit || 'count');
              setSelectedItemIsWeighted(data.is_weighted || false);
            }
          } else if (lastItem) {
            resolvedName = lastItem;
            const { data } = await supabase.from('items').select('id, name, unit, is_weighted').eq('name', lastItem).limit(1).single();
            if (data) {
              resolvedId = data.id;
              resolvedName = data.name;
              setSelectedItemUnit(data.unit || 'count');
              setSelectedItemIsWeighted(data.is_weighted || false);
            }
          }
        } catch (e) {
          console.error('Failed to load from localStorage:', e);
        }
      }

      if (resolvedId) {
        setSelectedItemName(resolvedName);
        setSelectedItemId(resolvedId);
        localStorage.setItem('history_last_item_id', resolvedId);
        localStorage.setItem('history_last_item', resolvedName);
      }

      if (storeParam) {
        try {
          const decodedStore = JSON.parse(storeParam);
          setSelectedStoreId(decodedStore);
          localStorage.setItem('history_last_store', decodedStore);
        } catch {
          setSelectedStoreId(storeParam);
          localStorage.setItem('history_last_store', storeParam);
        }
      } else if (!idParam && !nameParam) {
        const lastStore = localStorage.getItem('history_last_store');
        if (lastStore) {
          setSelectedStoreId(lastStore);
        }
      }

      if (resolvedId) {
        updateURL(resolvedId, resolvedName, storeParam || localStorage.getItem('history_last_store') || 'All');
      }
      setIsInitialLoad(false);
    };

    initialize();
  }, [searchParams, isInitialLoad]);

  // Fix for legacy store names in URL/localStorage causing 400 errors
  useEffect(() => {
    if (stores.length === 0 || selectedStoreId === 'All') return;

    // Check if current selection is a valid ID in our loaded stores
    const isValidId = stores.some(s => s.id === selectedStoreId);
    if (isValidId) return;

    // Not a valid ID. Try to fuzzy match by name (legacy support)
    const match = stores.find(s =>
      s.name === selectedStoreId ||
      (s.location && `${s.name} (${s.location})` === selectedStoreId)
    );

    if (match) {
      setSelectedStoreId(match.id);
      try {
        localStorage.setItem('history_last_store', match.id);
      } catch (e) {
        console.error('Failed to update localStorage', e);
      }
    } else {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedStoreId);
      if (!isUuid) {
        setSelectedStoreId('All');
        updateURL(selectedItemId, selectedItemName, 'All');
      }
    }
  }, [stores, selectedStoreId, selectedItemId, selectedItemName]);

  useEffect(() => {
    if (selectedItemId) {
      loadPriceHistory();
    }
  }, [selectedItemId, selectedStoreId, favoriteStoreIds.join(',')]);

  const loadStoresAndItems = async () => {
    // 1. Load all stores
    const { data: storesData } = await supabase
      .from('stores')
      .select('id, name, location')
      .order('name');

    if (!storesData) return;

    // 2. Filter by favorites if household code exists
    let filteredStores = storesData;
    let favIds: string[] = [];
    const householdCode = localStorage.getItem('household_code');

    if (householdCode) {
      const { data: favoritesData } = await supabase
        .from('household_store_favorites')
        .select('store_id')
        .eq('household_code', householdCode);

      if (favoritesData && favoritesData.length > 0) {
        favIds = favoritesData.map(f => f.store_id);
        const favoriteIdsSet = new Set(favIds);
        filteredStores = storesData.filter(s => favoriteIdsSet.has(s.id));
      } else {
        // If household code exists but no favorites, show no stores
        filteredStores = [];
      }
    }

    setFavoriteStoreIds(favIds);

    // 3. Sort by Name then Location
    const sorted = filteredStores.sort((a, b) => {
      if (a.name !== b.name) return a.name.localeCompare(b.name);
      return (a.location || '').localeCompare(b.location || '');
    });
    setStores(sorted);
  };

  const handleSearchChange = async (value: string) => {
    setSearchQuery(value);

    if (value.trim()) {
      // Server-side search
      let query = supabase
        .from('items')
        .select('id, name')
        .ilike('name', `%${value}%`);

      const householdCode = localStorage.getItem('household_code');
      if (householdCode !== 'TEST') {
        query = query.or('household_code.neq.TEST,household_code.is.null');
      }

      const { data: searchResults } = await query
        .limit(10);

      if (searchResults) {
        setAutocompleteItems(searchResults.map(i => ({ id: i.id, name: i.name })));
        setShowAutocomplete(searchResults.length > 0);
      }
    } else {
      setAutocompleteItems([]);
      setShowAutocomplete(false);
    }
  };

  const selectItemFromSearch = async (itemId: string, itemName: string) => {
    setSelectedItemName(itemName);
    setSelectedItemId(itemId);
    updateURL(itemId, itemName, selectedStoreId);

    // Fetch details
    const { data } = await supabase.from('items').select('unit, is_weighted').eq('id', itemId).single();
    if (data) {
      setSelectedItemUnit(data.unit || 'count');
      setSelectedItemIsWeighted(data.is_weighted || false);
    }

    try {
      localStorage.setItem('history_last_item_id', itemId);
      localStorage.setItem('history_last_item', itemName);
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }
    setSearchQuery('');
    setShowAutocomplete(false);
    setAutocompleteItems([]);
  };

  const updateURL = (itemId: string, itemName: string, store: string) => {
    const params = new URLSearchParams();
    if (itemId) params.set('itemId', JSON.stringify(itemId));
    if (itemName) params.set('item', JSON.stringify(itemName));
    if (store && store !== 'All') params.set('store', JSON.stringify(store));

    const newURL = params.toString() ? `/history?${params.toString()}` : '/history';
    router.push(newURL);
  };

  const shareLink = async () => {
    const url = window.location.href;

    try {
      await navigator.clipboard.writeText(url);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      showStatus('Copy Failed', 'Failed to copy the link to your clipboard.', 'error');
    }
  };

  const loadPriceHistory = async () => {
    setLoading(true);

    let query = supabase
      .from('price_history')
      .select('*')
      .eq('user_id', SHARED_USER_ID)
      .eq('item_id', selectedItemId)
      .order('recorded_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (selectedStoreId !== 'All') {
      // Validate UUID format to prevent sending names to API (prevents 400 error)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedStoreId);
      if (!isUuid) {
        // If it's not a UUID, we shouldn't send it. 
        // The useEffect above will likely resolve it to an ID or 'All' shortly.
        setLoading(false);
        return;
      }
      query = query.eq('store_id', selectedStoreId);
    } else if (favoriteStoreIds.length > 0) {
      // If "All Stores" is selected, only show favorites
      query = query.in('store_id', favoriteStoreIds);
    } else if (localStorage.getItem('household_code')) {
      // If household code exists but no favorites, return nothing
      setPriceHistory([]);
      setLoading(false);
      return;
    }
    const { data } = await query;

    if (data) {
      setPriceHistory(data);
    }

    setLoading(false);
  };

  const handlePriceChange = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');

    let priceValue = '';
    if (digits !== '') {
      // Convert to cents, then to dollars
      const cents = parseInt(digits, 10);
      priceValue = (cents / 100).toFixed(2);
    }

    setNewPrice(priceValue);
  };

  const addPriceEntry = async () => {
    if (!newPrice || parseFloat(newPrice) === 0) {
      showStatus('Invalid Price', 'Please enter a valid price greater than $0.', 'warning');
      return;
    }

    if (!newDate) {
      showStatus('Missing Date', 'Please select a date for this price entry.', 'warning');
      return;
    }

    // Register entry with selectedItemId
    const item_id = selectedItemId;
    const item_name = selectedItemName;

    if (!item_id) {
      showStatus('Item Not Found', 'Could not find the selected item ID.', 'error');
      return;
    }

    // Get store name for display/redundancy (and because DB might still want it)
    const storeObj = stores.find(s => s.id === selectedStoreId);
    if (!storeObj) {
      showStatus('Store Not Found', 'Could not find the selected store in the database.', 'error');
      return;
    }

    // Insert new price record
    const { error } = await supabase
      .from('price_history')
      .insert({
        item_id: item_id,
        item_name: item_name,
        store_id: selectedStoreId,
        store: storeObj.name,
        price: newPrice,
        unit: selectedItemUnit,
        is_weighted: selectedItemIsWeighted,
        user_id: SHARED_USER_ID,
        recorded_date: newDate,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error adding price:', error);
      showStatus('Save Failed', 'Failed to add the price entry. Please try again.', 'error');
      return;
    }

    // Clear form (using local date)
    setNewPrice('');
    setNewDate(getLocalDateString());

    // Reload history to show new entry
    loadPriceHistory();
  };

  const deletePriceEntry = async (recordId: string, recordDate: string, recordPrice: string) => {
    if (!confirm(`Delete price entry: $${parseFloat(recordPrice).toFixed(2)} from ${parseLocalDate(recordDate).toLocaleDateString()}?`)) {
      return;
    }

    const { error } = await supabase
      .from('price_history')
      .delete()
      .eq('id', recordId);

    if (error) {
      console.error('Error deleting price:', error);
      showStatus('Delete Failed', 'Failed to delete the price entry. Please try again.', 'error');
      return;
    }

    // Reload history to show updated list
    loadPriceHistory();
  };

  const confirmPrice = async (priceToConfirm: string, storeOverride?: string) => {
    try {
      // Use override store if provided (for "All Stores" view), otherwise use selectedStore
      // Note: confirmPrice is mostly used in "All Stores" view or single view.
      // If storeOverride is passed, it might be an ID or name depending on where it comes from.
      // Actually, in the list, we are iterating records. The record has store_id?
      // Wait, let's check how confirmPrice is called.
      // It's called as confirmPrice(record.price). No override passed in main view.
      // So it uses selectedStore.
      // If selectedStore is 'All', this fails.
      // But button is only shown if isLatest.
      // Actually, looking at the code:
      // {isLatest && ( <button onClick={() => confirmPrice(record.price)} ... }
      // The logic below uses `storeToUse = storeOverride || selectedStore`.
      // If we are in 'All' mode, selectedStore is 'All'. We must pass the store from the record!
      // But the current code doesn't pass storeOverride in the JSX!
      // Meaning the current "Confirm Price" button probably fails in "All Stores" mode if it relied on selectedStore.
      // OR it relies on the fact that if you are in All Stores, you see a list grouped by store.
      // Let's fix this properly. We should pass the store_id from the record if available, or just the storeID from context.
      // Since we need to look up ID, and the record might not have store_id depending on how old it is...
      // Let's assume we use the selectedStoreId.
      const storeToUse = storeOverride || selectedStoreId;

      // Use selectedItemId and selectedItemName
      const item_id = selectedItemId;
      const item_name = selectedItemName;

      if (!item_id) {
        throw new Error('Item ID missing');
      }

      // Get store_id
      const { data: storeData } = await supabase
        .from('stores')
        .select('id, name')
        .eq('id', storeToUse)
        .single();

      if (!storeData) {
        throw new Error('Store not found');
      }

      // Insert new price record with today's date
      const { error } = await supabase
        .from('price_history')
        .insert({
          item_id: item_id,
          item_name: item_name,
          store_id: storeData.id,
          store: storeData.name,
          price: priceToConfirm,
          unit: selectedItemUnit,
          is_weighted: selectedItemIsWeighted,
          user_id: SHARED_USER_ID,
          recorded_date: getLocalDateString(),
          created_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Failed to confirm price: ${error.message}`);
      }

      // Reload history to show new entry
      loadPriceHistory();
    } catch (error) {
      console.error('Error confirming price:', error);
      showStatus('Confirmation Failed', 'Failed to confirm the price. Please check your connection and try again.', 'error');
    }
  };

  const getPriceChange = (currentPrice: string, previousPrice: string) => {
    const current = parseFloat(currentPrice);
    const previous = parseFloat(previousPrice);
    const diff = current - previous;

    if (diff === 0) return null;

    return {
      amount: Math.abs(diff),
      direction: diff > 0 ? 'up' : 'down',
      percent: ((Math.abs(diff) / previous) * 100).toFixed(0)
    };
  };

  // Group by store if showing all stores
  const groupedHistory: { [store: string]: PriceRecord[] } = {};
  if (selectedStoreId === 'All') {
    priceHistory.forEach(record => {
      if (!groupedHistory[record.store]) {
        groupedHistory[record.store] = [];
      }
      groupedHistory[record.store].push(record);
    });
  }

  // Prepare data for chart (reverse order for chronological display)
  const chartData = priceHistory.slice().reverse().map(record => ({
    date: parseLocalDate(record.recorded_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    price: parseFloat(record.price),
    fullDate: record.recorded_date
  }));

  return (
    <div className="min-h-screen bg-blue-500 bg-gradient-to-br from-blue-500 to-green-400 pb-20 md:pb-0">
      <div className="sticky top-0 z-50 bg-white shadow-sm w-full">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="hidden md:flex items-center gap-2">
              <Link href="/" className="text-xl font-bold text-gray-800 hover:text-indigo-600 transition flex items-center gap-2">
                <span className="text-2xl">ᯓ</span>
                <span className="hidden sm:inline">SmartSaveAI</span>
              </Link>
            </div>
            <div className="w-full">
              <Header currentPage="Price History" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-6">

        {/* Filters - Desktop: Item then Store */}
        <div className="hidden md:block bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Select Item</label>
              <div className="relative search-autocomplete-container">
                <input
                  type="text"
                  placeholder="Search items..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => {
                    if (searchQuery.trim() && autocompleteItems.length > 0) {
                      setShowAutocomplete(true);
                    }
                  }}
                />

                {/* Autocomplete dropdown */}
                {showAutocomplete && autocompleteItems.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-2xl shadow-lg max-h-60 overflow-y-auto">
                    {autocompleteItems.slice(0, 10).map((item) => {
                      const isSelected = selectedItemId === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => selectItemFromSearch(item.id, item.name)}
                          className={`w-full text-left px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 ${isSelected
                            ? 'bg-indigo-50 text-blue-700 font-semibold'
                            : 'hover:bg-gray-50 text-gray-800'
                            }`}
                        >
                          {item.name} {isSelected && '✓'}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {selectedItemId && (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-base font-semibold">
                    {selectedItemName}
                    <button
                      onClick={() => {
                        setSelectedItemId('');
                        setSelectedItemName('');
                        updateURL('', '', selectedStoreId);
                        try {
                          localStorage.removeItem('history_last_item_id');
                          localStorage.removeItem('history_last_item');
                        } catch (err) {
                          console.error('Failed to clear localStorage:', err);
                        }
                      }}
                      className="hover:bg-indigo-700 rounded-2xl px-2 py-1"
                    >
                      ✕
                    </button>
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Store</label>
              <select
                value={selectedStoreId}
                onChange={(e) => {
                  setSelectedStoreId(e.target.value);
                  updateURL(selectedItemId, selectedItemName, e.target.value);
                  try {
                    localStorage.setItem('history_last_store', e.target.value);
                  } catch (err) {
                    console.error('Failed to save to localStorage:', err);
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold bg-white"
              >
                <option value="All">All Stores</option>
                {stores.map((store, idx) => (
                  <option key={`${store.id}-${idx}`} value={store.id}>
                    {store.name} {store.location ? `(${store.location})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Filters - Mobile: Store then Item */}
        <div className="md:hidden bg-white rounded-2xl shadow-lg p-4 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Store</label>
              <select
                value={selectedStoreId}
                onChange={(e) => {
                  setSelectedStoreId(e.target.value);
                  updateURL(selectedItemId, selectedItemName, e.target.value);
                  try {
                    localStorage.setItem('history_last_store', e.target.value);
                  } catch (err) {
                    console.error('Failed to save to localStorage:', err);
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold bg-white"
              >
                <option value="All">All Stores</option>
                {stores.map((store, idx) => (
                  <option key={`${store.id}-${idx}`} value={store.id}>
                    {store.name} {store.location ? `(${store.location})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Select Item</label>
              <div className="relative search-autocomplete-container">
                <input
                  type="text"
                  placeholder="Search items..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => {
                    if (searchQuery.trim() && autocompleteItems.length > 0) {
                      setShowAutocomplete(true);
                    }
                  }}
                />

                {/* Autocomplete dropdown */}
                {showAutocomplete && autocompleteItems.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-2xl shadow-lg max-h-60 overflow-y-auto">
                    {autocompleteItems.slice(0, 10).map((item) => {
                      const isSelected = selectedItemId === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => selectItemFromSearch(item.id, item.name)}
                          className={`w-full text-left px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 ${isSelected
                            ? 'bg-indigo-50 text-blue-700 font-semibold'
                            : 'hover:bg-gray-50 text-gray-800'
                            }`}
                        >
                          {item.name} {isSelected && '✓'}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {selectedItemId && (
                <div className="mt-3">
                  <span className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-base font-semibold">
                    {selectedItemName}
                    <button
                      onClick={() => {
                        setSelectedItemId('');
                        setSelectedItemName('');
                        updateURL('', '', selectedStoreId);
                        try {
                          localStorage.removeItem('history_last_item_id');
                          localStorage.removeItem('history_last_item');
                        } catch (err) {
                          console.error('Failed to clear localStorage:', err);
                        }
                      }}
                      className="hover:bg-indigo-700 rounded-2xl px-2 py-1"
                    >
                      ✕
                    </button>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History Display */}
        {!selectedItemId ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 text-center">
            <p className="text-gray-500 text-base md:text-lg">Select an item above to view price history</p>
          </div>
        ) : loading ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 text-center">
            <p className="text-gray-500 text-base md:text-lg">Loading...</p>
          </div>
        ) : selectedStoreId === 'All' ? (
          // Show grouped by store (All Stores view)
          priceHistory.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 text-center">
              <p className="text-gray-500 text-base md:text-lg">No price history found for {selectedItemName}</p>
              <p className="text-gray-400 text-sm mt-2">Select a specific store to add your first price entry</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedHistory).sort(([a], [b]) => a.localeCompare(b)).map(([store, records]) => (
                <div key={store} className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">{store}</h2>
                  <div className="space-y-3">
                    {records.map((record, idx) => {
                      const prevRecord = records[idx + 1];
                      const change = prevRecord ? getPriceChange(record.price, prevRecord.price) : null;
                      const isLatest = idx === 0;

                      return (
                        <div key={record.id}>
                          <div className="flex justify-between items-center gap-3">
                            <div className="flex-1 flex justify-between items-center p-3 bg-gray-50 rounded-2xl">
                              <div>
                                <p className="font-semibold text-gray-800">
                                  {parseLocalDate(record.recorded_date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </p>
                                {change && (
                                  <p className={`text-sm ${change.direction === 'up' ? 'text-red-600' : 'text-green-600'}`}>
                                    {change.direction === 'up' ? '⬆️' : '⬇️'} ${change.amount.toFixed(2)} ({change.percent}%)
                                  </p>
                                )}
                              </div>
                              <span className="text-2xl font-bold text-gray-800">${parseFloat(record.price).toFixed(2)}</span>
                            </div>
                            <button
                              onClick={() => deletePriceEntry(record.id, record.recorded_date, record.price)}
                              className="text-red-600 hover:text-red-800 cursor-pointer"
                              title="Delete entry"
                            >
                              🗑️
                            </button>
                          </div>
                          {isLatest && (
                            <div className="mt-2 flex justify-end">
                              <button
                                onClick={() => confirmPrice(record.price, record.store_id || record.store)}
                                className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-3 rounded-2xl font-semibold text-sm transition cursor-pointer flex items-center gap-1"
                                title="Confirm this price for today"
                              >
                                Confirm Price
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          // Show single store view with add entry widget
          <div className="space-y-6">
            {/* Price Graph - Shows if there's any data */}
            {priceHistory.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">
                  Price Over Time
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      domain={[0, 'dataMax + 1']}
                      tickFormatter={(value) => `$${value.toFixed(2)}`}
                    />
                    <Tooltip
                      formatter={(value: number | undefined) => value !== undefined ? [`$${value.toFixed(2)}`, 'Price'] : ['', '']}
                      labelStyle={{ color: '#1f2937' }}
                    />
                    <Line
                      type="linear"
                      dataKey="price"
                      stroke="#14b8a6"
                      strokeWidth={3}
                      dot={{ fill: '#14b8a6', r: 6 }}
                      activeDot={{ r: 8 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Timeline List - Shows existing data or helpful message */}
            {priceHistory.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">
                  {selectedItemName} at {stores.find(s => s.id === selectedStoreId)?.name || 'Unknown Store'}
                </h2>
                <div className="space-y-3">
                  {priceHistory.map((record, idx) => {
                    const prevRecord = priceHistory[idx + 1];
                    const change = prevRecord ? getPriceChange(record.price, prevRecord.price) : null;
                    const isLatest = idx === 0;

                    return (
                      <div key={record.id}>
                        <div className="flex justify-between items-center gap-3">
                          <div className="flex-1 flex justify-between items-center p-3 bg-gray-50 rounded-2xl">
                            <div>
                              <p className="font-semibold text-gray-800">
                                {parseLocalDate(record.recorded_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </p>
                              {change && (
                                <p className={`text-sm ${change.direction === 'up' ? 'text-red-600' : 'text-green-600'}`}>
                                  {change.direction === 'up' ? '⬆️' : '⬇️'} ${change.amount.toFixed(2)} ({change.percent}%)
                                </p>
                              )}
                            </div>
                            <span className="text-2xl font-bold text-gray-800">${parseFloat(record.price).toFixed(2)}</span>
                          </div>
                          <button
                            onClick={() => deletePriceEntry(record.id, record.recorded_date, record.price)}
                            className="text-red-600 hover:text-red-800 cursor-pointer"
                            title="Delete entry"
                          >
                            🗑️
                          </button>
                        </div>
                        {isLatest && (
                          <div className="mt-2 flex justify-end">
                            <button
                              onClick={() => confirmPrice(record.price)}
                              className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-3 rounded-2xl font-semibold transition cursor-pointer"
                              title="Confirm this price for today"
                            >
                              Confirm Price
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 text-center">
                <p className="text-gray-500 text-base md:text-lg">No price history yet for {selectedItemName} at {stores.find(s => s.id === selectedStoreId)?.name}</p>
                <p className="text-gray-400 text-sm mt-2">Add your first entry below to start tracking prices! 📊</p>
              </div>
            )}

            {/* Add Price Entry Widget - At bottom */}
            <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-2">Add Latest Price</h2>
              <p className="text-sm text-gray-600 mb-4">
                Adding price for: <span className="font-semibold">{selectedItemName}</span> at <span className="font-semibold">{stores.find(s => s.id === selectedStoreId)?.name}</span>
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Price</label>
                  <div className="flex items-center border border-gray-300 rounded-2xl px-3 py-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
                    <span className="text-gray-800 font-semibold mr-1">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={newPrice}
                      onChange={(e) => handlePriceChange(e.target.value)}
                      className="w-full text-right font-semibold text-gray-800 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={addPriceEntry}
                    className="w-full bg-indigo-600 text-white px-4 py-3 rounded-2xl font-semibold hover:bg-teal-600 transition cursor-pointer"
                  >
                    Add Price
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <StatusModal
        isOpen={statusModal.isOpen}
        onClose={() => setStatusModal(prev => ({ ...prev, isOpen: false }))}
        title={statusModal.title}
        message={statusModal.message}
        type={statusModal.type}
      />
    </div>
  );
}

export default function History() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-gray-500 text-lg">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <HistoryContent />
    </Suspense>
  );
}