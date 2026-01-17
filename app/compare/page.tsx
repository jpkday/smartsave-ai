'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_DEMO_ITEM_ID = 43; // Item ID for demo default

type PriceData = { price: string; date: string };

interface Store {
  id: string;
  name: string;
  location: string | null;
}

// Helper to format store display name
const formatStoreName = (store: Store | string, stores?: Store[]): string => {
  if (typeof store === 'string') {
    const storeObj = stores?.find(s => s.name === store);
    if (!storeObj) return store;
    return storeObj.location ? `${storeObj.name} (${storeObj.location})` : storeObj.name;
  }
  return store.location ? `${store.name} (${store.location})` : store.name;
};

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [householdCode, setHouseholdCode] = useState<string | null>(null);

  // UI data
  const [stores, setStores] = useState<Store[]>([]);
  const [storesByName, setStoresByName] = useState<{ [name: string]: string }>({});
  const [items, setItems] = useState<string[]>([]);
  const [itemsByName, setItemsByName] = useState<{ [name: string]: number }>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesIds, setFavoritesIds] = useState<Set<number>>(new Set());

  // prices keyed by `${storeName}-${itemName}`
  const [prices, setPrices] = useState<{ [key: string]: PriceData }>({});

  // selection / filters
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [filterLetter, setFilterLetter] = useState<string>('All');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [showCopied, setShowCopied] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [defaultDemoItemName, setDefaultDemoItemName] = useState<string | null>(null);

  // Search/autocomplete
  const [searchQuery, setSearchQuery] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<string[]>([]);

  // Quick Add
  const [quickAddStore, setQuickAddStore] = useState<string>('');
  const [quickAddPrice, setQuickAddPrice] = useState<string>('');

  // Load household code from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const code = localStorage.getItem('household_code');
      setHouseholdCode(code);
    }
  }, []);

  // Load data on mount (doesn't require household_code for basic functionality)
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLetter = (letter: string) => {
    setFilterLetter((prev) => (prev === letter ? 'All' : letter));
  };

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

  // Restore selected items from URL / localStorage once items are loaded
  useEffect(() => {
    if (!isInitialLoad || items.length === 0 || defaultDemoItemName === null) return;

    const itemsParam = searchParams.get('items');
    if (itemsParam) {
      try {
        const parsedItems = JSON.parse(itemsParam);
        setSelectedItems(parsedItems);
        localStorage.setItem('compare_last_items', JSON.stringify(parsedItems));
      } catch (e) {
        const split = itemsParam.split(',');
        setSelectedItems(split);
        localStorage.setItem('compare_last_items', JSON.stringify(split));
      }
    } else {
      try {
        const lastItems = localStorage.getItem('compare_last_items');
        if (lastItems) {
          const parsedLastItems = JSON.parse(lastItems);
          setSelectedItems(parsedLastItems);
          updateURL(parsedLastItems);
        } else if (defaultDemoItemName && items.includes(defaultDemoItemName)) {
          setSelectedItems([defaultDemoItemName]);
          updateURL([defaultDemoItemName]);
          localStorage.setItem('compare_last_items', JSON.stringify([defaultDemoItemName]));
        }
      } catch (e) {
        if (defaultDemoItemName && items.includes(defaultDemoItemName)) {
          setSelectedItems([defaultDemoItemName]);
          updateURL([defaultDemoItemName]);
        }
      }
    }

    setIsInitialLoad(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, items, isInitialLoad, defaultDemoItemName]);

  const updateURL = (itemsArr: string[]) => {
    if (itemsArr.length === 0) {
      router.push('/compare');
      return;
    }
    const params = new URLSearchParams();
    params.set('items', JSON.stringify(itemsArr));
    router.push(`/compare?${params.toString()}`);
  };

  const shareLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch {
      alert('Failed to copy link');
    }
  };

  const loadData = async () => {
    // -----------------------
    // Stores (id, name, location) + lookup
    // -----------------------
    const { data: storesData, error: storesError } = await supabase
      .from('stores')
      .select('id, name, location')
      .order('name');

    if (storesError) console.error('Error loading stores:', storesError);

    if (storesData) {
      setStores(storesData);
      const lookup: { [name: string]: string } = {};
      storesData.forEach((s) => (lookup[s.name] = s.id));
      setStoresByName(lookup);
    }

    // -----------------------
    // Favorites from junction table (only if household_code exists)
    // -----------------------
    if (householdCode) {
      const { data: favData } = await supabase
        .from('household_item_favorites')
        .select('item_id')
        .eq('household_code', householdCode);

      const favIds = new Set(favData?.map(f => f.item_id) || []);
      setFavoritesIds(favIds);

      // Fetch names for these specific IDs
      if (favIds.size > 0) {
        const { data: favItems } = await supabase
          .from('items')
          .select('name')
          .in('id', Array.from(favIds));

        if (favItems) {
          setFavorites(favItems.map(i => i.name));
        }
      }
    } else {
      // No household code = no favorites
      setFavoritesIds(new Set());
      setFavorites([]);
    }
  };

  // Deselect items when filter changes and they're no longer visible


  const toggleItem = (item: string) => {
    const newSelectedItems = selectedItems.includes(item)
      ? selectedItems.filter((i) => i !== item)
      : [...selectedItems, item];

    setSelectedItems(newSelectedItems);
    updateURL(newSelectedItems);

    try {
      localStorage.setItem('compare_last_items', JSON.stringify(newSelectedItems));
    } catch {
      // ignore
    }
  };

  // Helper to fetch prices for specific items
  const fetchPricesForItems = async (itemNames: string[]) => {
    if (itemNames.length === 0) return;

    // Filter out items we already have prices for (optimization)
    const itemsToFetch = itemNames.filter(name => {
      // Check if we have ANY price for this item key. 
      // This is tricky because keys are Store-Item.
      // Simplest: just check if we've fetched for this item before?
      // For now, let's just fetch. The query is fast if limited to item_name.
      return true;
    });

    if (itemsToFetch.length === 0) return;

    const { data: pricesData, error: pricesError } = await supabase
      .from('price_history')
      .select('*')
      .eq('user_id', SHARED_USER_ID)
      .in('item_name', itemsToFetch)
      .order('recorded_date', { ascending: false });

    if (pricesError) {
      console.error('Error loading prices:', pricesError);
      return;
    }

    if (pricesData) {
      setPrices(prev => {
        const next = { ...prev };
        const latestPrices: { [key: string]: any } = {};

        // Merge new data
        pricesData.forEach((p: any) => {
          const key = `${p.store}-${p.item_name}`;
          // Logic: keep existing if newer? Or overwrite? 
          // Since we are fetching *all* history for these items, we can just rebuild the latest map for these items.
          // Actually, we just need the LATEST price for the compare table.
          if (!latestPrices[key] || new Date(p.recorded_date) > new Date(latestPrices[key].recorded_date)) {
            latestPrices[key] = p;
            next[key] = {
              price: p.price,
              date: p.recorded_date,
            };
          }
        });
        return next;
      });
    }
  };

  // Lazy load prices when selection changes
  useEffect(() => {
    fetchPricesForItems(selectedItems);
  }, [selectedItems]);

  const handleSearchChange = async (value: string) => {
    setSearchQuery(value);

    if (value.trim()) {
      // Server-side search
      const { data: searchResults, error } = await supabase
        .from('items')
        .select('name')
        .ilike('name', `%${value}%`)
        .limit(10);

      if (searchResults) {
        setAutocompleteItems(searchResults.map(i => i.name));
        setShowAutocomplete(searchResults.length > 0);
      }
    } else {
      setAutocompleteItems([]);
      setShowAutocomplete(false);
    }
  };

  const selectItemFromSearch = (itemName: string) => {
    toggleItem(itemName);
    setSearchQuery('');
    setShowAutocomplete(false);
    setAutocompleteItems([]);
  };

  const calculateBestStore = () => {
    const storeData: { [store: string]: { total: number; coverage: number; itemCount: number } } = {};

    stores.forEach((store) => {
      let total = 0;
      let coverage = 0;

      selectedItems.forEach((item) => {
        const priceData = prices[`${store.name}-${item}`];
        if (priceData) {
          total += parseFloat(priceData.price);
          coverage++;
        }
      });

      storeData[store.name] = { total, coverage, itemCount: selectedItems.length };
    });

    return storeData;
  };

  const handlePriceChange = (value: string) => {
    const digits = value.replace(/\D/g, '');
    let priceValue = '';
    if (digits !== '') {
      const cents = parseInt(digits, 10);
      priceValue = (cents / 100).toFixed(2);
    }
    setQuickAddPrice(priceValue);
  };

  const handleQuickAddPrice = async () => {
    if (!householdCode) {
      alert('Missing household code. Go back to Home and set your household.');
      return;
    }

    if (selectedItems.length !== 1) {
      alert('Please select exactly one item');
      return;
    }

    if (!quickAddStore) {
      alert('Please select a store');
      return;
    }

    if (!quickAddPrice || parseFloat(quickAddPrice) === 0) {
      alert('Please enter a valid price');
      return;
    }

    const itemName = selectedItems[0];

    try {
      // store_id from lookup (same pattern as /list saveEdit)
      const storeId = storesByName[quickAddStore];
      if (!storeId) throw new Error('Store not found');

      // item_id from lookup (or fallback query if missing)
      let itemId = itemsByName[itemName];

      if (!itemId) {
        const { data: itemData, error: itemErr } = await supabase
          .from('items')
          .select('id')
          .eq('name', itemName)
          .eq('user_id', SHARED_USER_ID)
          .eq('household_code', householdCode)
          .single();

        if (itemErr || !itemData?.id) throw new Error(itemErr?.message || 'Item not found');
        itemId = itemData.id;
      }

      const priceNum = parseFloat(quickAddPrice);
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        alert('Please enter a valid price');
        return;
      }

      const { error } = await supabase.from('price_history').insert({
        item_id: itemId,
        item_name: itemName, // keep for your current UI keys
        store_id: storeId,
        store: quickAddStore, // keep for your current UI keys
        price: priceNum.toFixed(2),
        user_id: SHARED_USER_ID,
        household_code: householdCode,
        recorded_date: new Date().toISOString(), // matches /list
      });

      if (error) throw error;

      setQuickAddStore('');
      setQuickAddPrice('');
      await loadData();
    } catch (err: any) {
      console.error('Error adding price:', err);
      alert(`Failed to add price: ${err?.message ?? 'Unknown error'}`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleQuickAddPrice();
  };

  const selectAllFavorites = () => {
    const newSelectedItems = [...new Set([...selectedItems, ...favorites])];
    setSelectedItems(newSelectedItems);
    updateURL(newSelectedItems);

    try {
      localStorage.setItem('compare_last_items', JSON.stringify(newSelectedItems));
    } catch {
      // ignore
    }
  };

  const deselectAllFavorites = () => {
    const newSelectedItems = selectedItems.filter((item) => !favorites.includes(item));
    setSelectedItems(newSelectedItems);
    updateURL(newSelectedItems);

    try {
      localStorage.setItem('compare_last_items', JSON.stringify(newSelectedItems));
    } catch {
      // ignore
    }
  };

  const allFavoritesSelected = favorites.length > 0 && favorites.every((fav) => selectedItems.includes(fav));

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
      const priceData = prices[`${store.name}-${itemName}`];
      if (priceData) itemPrices.push(parseFloat(priceData.price));
    });

    if (itemPrices.length === 0) return null;

    const minPrice = Math.min(...itemPrices);
    const percentAboveMin = ((currentPrice - minPrice) / minPrice) * 100;
    const percentInt = Math.round(percentAboveMin);

    if (currentPrice === minPrice) {
      return {
        label: 'Best Price',
        mobileLabel: 'Best Price',
        emoji: '✅',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
      };
    }

    if (percentAboveMin <= 10) {
      return {
        label: `Close Enough (${percentInt}% more)`,
        mobileLabel: `Close Enough (${percentInt}% more)`,
        emoji: '➖',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
      };
    }

    return {
      label: `Skip This One (${percentInt}% more)`,
      mobileLabel: `Skip (${percentInt}% more)`,
      emoji: '❌',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    };
  };

  /* Removed alphabet/filtering logic as we no longer load all items */

  const storeData = calculateBestStore();
  const sortedStores = Object.entries(storeData)
    .filter(([, data]) => data.coverage > 0)
    .sort(([, a], [, b]) => {
      if (b.coverage !== a.coverage) return b.coverage - a.coverage;
      return a.total - b.total;
    });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400">
      <div className="sticky top-0 z-50 bg-white shadow-lg w-full">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4">
          <div className="flex justify-between items-center">
            {/* Title - Desktop Only (replaces the old headers) */}
            <Link href="/" className="text-xl font-bold text-gray-800 hover:text-indigo-600 transition flex items-center gap-2">
              <span className="text-2xl">ᯓ</span>
              <span className="hidden sm:inline">SmartSaveAI</span>
            </Link>
            <Header currentPage="Compare Items" />
          </div>
        </div>
      </div>

      {/* Title + updated info block (Now part of main content scroll, but below sticky header) */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-6 pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">Compare Prices</h1>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <p className="text-xs md:text-sm text-blue-100 bg-blue-600/30 px-3 py-1 rounded-full">Updated: {lastUpdated}</p>
              )}
              {selectedItems.length > 0 && (
                <button
                  onClick={shareLink}
                  className="relative text-white hover:text-teal-100 transition cursor-pointer flex items-center gap-1 text-sm bg-teal-600/30 px-3 py-1 rounded-full"
                  title="Share this comparison"
                >
                  <span>🔗 Share</span>
                  {showCopied && (
                    <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      Copied!
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>



      <div className="max-w-5xl mx-auto px-2 md:px-4 py-4">
        {/* Mobile search */}
        <div className="md:hidden bg-white rounded-2xl shadow-lg p-4 mb-6">
          <label className="block text-xl md:text-2xl font-bold text-gray-700 mb-2">Search</label>
          <div className="relative search-autocomplete-container">
            <input
              type="text"
              placeholder="Type to search items..."
              className="w-full px-4 py-2 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => {
                if (searchQuery.trim() && autocompleteItems.length > 0) setShowAutocomplete(true);
              }}
            />

            {showAutocomplete && autocompleteItems.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-2xl shadow-lg max-h-60 overflow-y-auto">
                {autocompleteItems.slice(0, 10).map((item) => {
                  const isSelected = selectedItems.includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => selectItemFromSearch(item)}
                      className={`w-full text-left px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 ${isSelected
                        ? 'bg-emerald-50 text-emerald-700 font-semibold'
                        : 'hover:bg-gray-50 text-gray-800'
                        }`}
                    >
                      {item} {isSelected && '✓'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedItems.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {selectedItems.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-2 bg-emerald-500 text-white px-5 py-2.5 rounded-2xl text-base font-semibold"
                >
                  {item}
                  <button
                    onClick={() => toggleItem(item)}
                    className="hover:bg-emerald-500 rounded-full px-1.5 py-0.5"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Favorites */}
        {favorites.length > 0 && (
          <div className="hidden md:block bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-4 md:mb-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg md:text-xl font-bold text-gray-800">⭐ Favorites</h2>
              <button
                onClick={allFavoritesSelected ? deselectAllFavorites : selectAllFavorites}
                className="text-sm bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-2xl font-semibold transition cursor-pointer"
              >
                {allFavoritesSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {favorites.map((item) => (
                <button
                  key={item}
                  onClick={() => toggleItem(item)}
                  className={`px-3 py-1.5 rounded-2xl border-2 transition cursor-pointer text-sm font-semibold ${selectedItems.includes(item)
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-700 border-yellow-400 hover:border-yellow-500'
                    }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Desktop item selector */}
        <div className="hidden md:block bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-4 md:mb-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-3">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">Select Items</h2>
            {selectedItems.length > 0 && (
              <button
                onClick={() => {
                  setSelectedItems([]);
                  updateURL([]);
                  try {
                    localStorage.removeItem('compare_last_items');
                  } catch {
                    // ignore
                  }
                }}
                className="text-sm text-red-600 hover:text-red-800 font-semibold cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="mb-4 relative search-autocomplete-container">
            <input
              type="text"
              placeholder="Search items..."
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => {
                if (searchQuery.trim() && autocompleteItems.length > 0) setShowAutocomplete(true);
              }}
            />

            {showAutocomplete && autocompleteItems.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-2xl shadow-lg max-h-60 overflow-y-auto">
                {autocompleteItems.slice(0, 10).map((item) => {
                  const isSelected = selectedItems.includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => selectItemFromSearch(item)}
                      className={`w-full text-left px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 ${isSelected
                        ? 'bg-emerald-50 text-emerald-700 font-semibold'
                        : 'hover:bg-gray-50 text-gray-800'
                        }`}
                    >
                      {item} {isSelected && '✓'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>


        </div>

        {/* Best stores */}
        {selectedItems.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-4 md:mb-6">
            <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">Best Stores</h2>

            {sortedStores.length > 0 ? (
              <div className="space-y-3">
                {sortedStores.map(([store, data], idx) => {
                  const coveragePercent = ((data.coverage / data.itemCount) * 100).toFixed(0);
                  const isComplete = data.coverage === data.itemCount;

                  return (
                    <div
                      key={store}
                      className={`p-4 rounded-2xl border-2 ${idx === 0 ? 'bg-green-50 border-green-500' : 'bg-gray-50 border-gray-300'
                        }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-lg md:text-xl text-gray-800">
                              {formatStoreName(store, stores)}
                            </span>
                            {idx === 0 && (
                              <span className="text-xs md:text-sm bg-green-500 text-white px-2 md:px-3 py-1 rounded-full whitespace-nowrap">
                                Best Deal!
                              </span>
                            )}
                          </div>

                          {selectedItems.length > 1 && (
                            <p
                              className={`text-xs md:text-sm mt-1 flex items-center gap-1 ${isComplete ? 'text-green-600' : 'text-orange-600'
                                }`}
                            >
                              <span>
                                {data.coverage}/{data.itemCount} items ({coveragePercent}% coverage)
                                {!isComplete && ' ⚠️'}
                              </span>
                              {isComplete && selectedItems.length > 1 && (
                                <span className="text-sm bg-blue-500 text-white px-2 py-1 rounded-full">✓</span>
                              )}
                            </p>
                          )}

                          <div className="mt-1 space-y-0.5">
                            {selectedItems.map((item) => {
                              const priceData = prices[`${store}-${item}`];
                              if (!priceData) {
                                return (
                                  <p key={item} className="text-xs text-gray-400">
                                    {item}: no price
                                  </p>
                                );
                              }

                              const price = parseFloat(priceData.price);
                              const classification = getPriceClassification(item, price);

                              return (
                                <p key={item} className="text-xs text-gray-600">
                                  {item}: ${price.toFixed(2)}
                                  <span className="text-gray-400 ml-1">({getDaysAgo(priceData.date)})</span>
                                  {classification && (
                                    <>
                                      <span className={`hidden md:inline ml-1 font-semibold ${classification.color}`}>
                                        {classification.emoji} {classification.label}
                                      </span>
                                      <span className={`md:hidden ml-1 font-semibold ${classification.color}`}>
                                        {classification.emoji} {classification.mobileLabel}
                                      </span>
                                    </>
                                  )}
                                </p>
                              );
                            })}
                          </div>
                        </div>

                        <span className="text-xl md:text-2xl font-bold text-gray-800 whitespace-nowrap">
                          ${data.total.toFixed(2)}
                        </span>
                      </div>

                      {idx === 0 &&
                        sortedStores.length > 1 &&
                        sortedStores[0][1].coverage === sortedStores[1][1].coverage && (
                          <p className="text-xs md:text-sm text-green-700 mt-2">
                            Save ${(sortedStores[1][1].total - data.total).toFixed(2)} vs {formatStoreName(sortedStores[1][0], stores)}
                          </p>
                        )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 md:p-8 text-center bg-yellow-50 border-2 border-yellow-200 rounded-2xl">
                <p className="text-base md:text-lg font-semibold text-yellow-800 mb-2">
                  No price data available
                </p>
                <p className="text-sm text-yellow-700">
                  Use the Quick Add box below to add prices for {selectedItems.join(', ')}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="md:hidden bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-gray-500 text-lg">Select an item above to compare prices</p>
          </div>
        )}

        {/* Quick Add */}
        {selectedItems.length === 1 && (
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Add Prices</h2>
            <p className="text-sm text-gray-600 mb-4">
              Adding price for: <span className="font-semibold">{selectedItems[0]}</span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Store</label>
                <select
                  value={quickAddStore}
                  onChange={(e) => setQuickAddStore(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold bg-white"
                >
                  <option value="">Select store...</option>
                  {stores.map((store) => (
                    <option key={store.id || store.name} value={store.name}>
                      {formatStoreName(store)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Price</label>
                <div className="flex items-center border border-gray-300 rounded-2xl px-3 py-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
                  <span className="text-gray-800 font-semibold mr-1">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={quickAddPrice}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full text-right font-semibold text-gray-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleQuickAddPrice}
                  className="w-full bg-blue-600 text-white px-4 py-3 rounded-2xl font-semibold hover:bg-blue-700 transition cursor-pointer"
                >
                  Add Price
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedItems.length === 0 && (
          <div className="hidden md:block bg-white rounded-2xl shadow-lg p-8 md:p-12 text-center">
            <p className="text-gray-500 text-base md:text-lg">Select items above to compare prices</p>
          </div>
        )}
      </div>
    </div>

  );
}

export default function Compare() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <p className="text-gray-500 text-lg">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
