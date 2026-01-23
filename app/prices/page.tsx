'use client';
import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { formatLocalDate } from '../utils/date';
import StatusModal from '../components/StatusModal';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

interface Store {
  id: string;
  name: string;
  location: string | null;
}

// --- Standalone ItemFilter Component ---
interface ItemFilterProps {
  items: string[];
  selectedItem: string;
  onSelect: (item: string) => void;
  onAddNew: (newItem: string) => void;
}

function ItemFilter({ items, selectedItem, onSelect, onAddNew }: ItemFilterProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync query with selected item from parent (e.g. URL load)
  useEffect(() => {
    if (selectedItem) {
      setQuery(selectedItem);
    } else {
      setQuery('');
    }
  }, [selectedItem]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedItem) {
          setQuery(selectedItem);
        } else {
          setQuery('');
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedItem]);

  const getDropdownItems = () => {
    let filtered = items;
    if (query.trim()) {
      filtered = items.filter(item => item.toLowerCase().includes(query.toLowerCase()));
    }
    return filtered.slice(0, 50);
  };

  const handleSelect = (item: string) => {
    onSelect(item);
    setIsOpen(false);
  };

  // Clear selection
  const handleClear = () => {
    onSelect('');
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search items..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={(e) => {
            setIsOpen(true);
            if (query === selectedItem && selectedItem) {
              e.currentTarget.select();
            }
          }}
          className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold bg-white pr-10"
        />
        {query && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto w-full">
          {getDropdownItems().map((item) => (
            <button
              key={item}
              onClick={() => handleSelect(item)}
              className={`w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-0 flex justify-between items-center ${selectedItem === item ? 'text-blue-600 bg-blue-50 font-semibold' : 'text-gray-700'}`}
            >
              {item}
              {selectedItem === item && <span>✓</span>}
            </button>
          ))}

          {/* "Add New" Logic */}
          {query && !items.some(i => i.toLowerCase() === query.trim().toLowerCase()) && (
            <button
              onClick={() => {
                onAddNew(query);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-3 text-blue-600 hover:bg-blue-50 font-bold border-t border-gray-100"
            >
              + Add "{query}"
            </button>
          )}

          {query && getDropdownItems().length === 0 && items.some(i => i.toLowerCase() === query.trim().toLowerCase()) && (
            <div className="px-4 py-3 text-gray-500 text-sm">Item already exists</div>
          )}

          {getDropdownItems().length === 0 && !query && (
            <div className="px-4 py-3 text-gray-500 text-sm">Type to search items...</div>
          )}
        </div>
      )}
    </div>
  );
}

function PricesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [stores, setStores] = useState<Store[]>([]);
  const [prices, setPrices] = useState<{ [key: string]: string }>({});
  const [pricesDates, setPricesDates] = useState<{ [key: string]: string }>({});
  const [lastSaved, setLastSaved] = useState<string>('');
  const [items, setItems] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedItemFilter, setSelectedItemFilter] = useState<string>(''); // Default to empty
  const [showCopied, setShowCopied] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const householdCode = typeof window !== 'undefined' ? localStorage.getItem('household_code') || '' : '';

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

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isInitialLoad || stores.length === 0) return;

    // Load from URL parameters
    const storeParam = searchParams.get('store');
    const itemParam = searchParams.get('item');

    if (storeParam || itemParam) {
      if (storeParam) {
        const storeExists = stores.some(s => s.id === storeParam);
        if (storeExists) {
          setSelectedStoreId(storeParam);
          localStorage.setItem('prices_last_store_id', storeParam);
        } else {
          setSelectedStoreId(stores[0]?.id || '');
        }
      } else if (stores.length > 0) {
        try {
          const lastStoreId = localStorage.getItem('prices_last_store_id');
          if (lastStoreId && stores.some(s => s.id === lastStoreId)) {
            setSelectedStoreId(lastStoreId);
          } else {
            setSelectedStoreId(stores[0].id);
          }
        } catch (e) {
          setSelectedStoreId(stores[0].id);
        }
      }

      if (itemParam) {
        setSelectedItemFilter(itemParam);
        localStorage.setItem('prices_last_item_filter', itemParam);
      } else {
        // Don't auto-load "All" logic anymore, just empty if not set
        try {
          const lastItemFilter = localStorage.getItem('prices_last_item_filter');
          if (lastItemFilter && lastItemFilter !== 'All') {
            setSelectedItemFilter(lastItemFilter);
          }
        } catch (e) {
          console.error('Failed to load from localStorage:', e);
        }
      }
    } else {
      try {
        const lastStoreId = localStorage.getItem('prices_last_store_id');
        const lastItemFilter = localStorage.getItem('prices_last_item_filter');

        if (lastStoreId && stores.some(s => s.id === lastStoreId)) {
          setSelectedStoreId(lastStoreId);
        } else if (stores.length > 0) {
          setSelectedStoreId(stores[0].id);
        }

        if (lastItemFilter && lastItemFilter !== 'All') {
          setSelectedItemFilter(lastItemFilter);
        }

        if (lastStoreId || lastItemFilter) {
          updateURL(lastStoreId || stores[0]?.id || '', lastItemFilter || '');
        }
      } catch (e) {
        console.error('Failed to load from localStorage:', e);
        if (stores.length > 0) {
          setSelectedStoreId(stores[0].id);
        }
      }
    }

    setIsInitialLoad(false);
  }, [searchParams, stores, isInitialLoad]);

  const loadData = async () => {
    const { data: itemsData } = await supabase
      .from('items')
      .select('name')
      .order('name');

    if (itemsData) {
      setItems(itemsData.map(i => i.name));
    }

    const { data: storesData } = await supabase
      .from('stores')
      .select('id, name, location')
      .order('name');

    if (storesData) {
      let filteredStores = storesData;

      if (householdCode) {
        const { data: favoritesData } = await supabase
          .from('household_store_favorites')
          .select('store_id')
          .eq('household_code', householdCode);

        if (favoritesData && favoritesData.length > 0) {
          const favoriteIds = new Set(favoritesData.map(f => f.store_id));
          filteredStores = storesData.filter(s => favoriteIds.has(s.id));
        }
      }

      const sorted = filteredStores.sort((a, b) => {
        if (a.name !== b.name) return a.name.localeCompare(b.name);
        return (a.location || '').localeCompare(b.location || '');
      });
      setStores(sorted);
    }

    const { data: pricesData } = await supabase
      .from('price_history')
      .select('*')
      .eq('user_id', SHARED_USER_ID)
      .order('recorded_date', { ascending: false });

    if (pricesData) {
      const pricesObj: { [key: string]: string } = {};
      const datesObj: { [key: string]: string } = {};
      const latestPrices: { [key: string]: any } = {};

      pricesData.forEach(p => {
        if (p.store_id) {
          const key = `${p.store_id}-${p.item_name}`;
          if (!latestPrices[key] || new Date(p.recorded_date) > new Date(latestPrices[key].recorded_date)) {
            latestPrices[key] = p;
            pricesObj[key] = parseFloat(p.price).toFixed(2);
            datesObj[key] = p.recorded_date;
          }
        }
      });

      setPrices(pricesObj);
      setPricesDates(datesObj);

      if (pricesData.length > 0) {
        const latest = pricesData.reduce((a, b) =>
          new Date(a.recorded_date) > new Date(b.recorded_date) ? a : b
        );
        setLastSaved(formatLocalDate(latest.recorded_date));
      }
    }
  };

  const updateURL = (storeId: string, item: string) => {
    const params = new URLSearchParams();
    if (storeId) params.set('store', storeId);
    if (item && item !== 'All') params.set('item', item);

    const newURL = params.toString() ? `/prices?${params.toString()}` : '/prices';
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

  const handlePriceChange = (storeId: string, item: string, value: string) => {
    const digits = value.replace(/\D/g, '');
    let priceValue = '';
    if (digits !== '') {
      const cents = parseInt(digits, 10);
      priceValue = (cents / 100).toFixed(2);
    }
    setPrices({ ...prices, [`${storeId}-${item}`]: priceValue });
  };

  const handlePriceSave = async (storeId: string, item: string) => {
    const priceValue = prices[`${storeId}-${item}`];
    if (!priceValue || parseFloat(priceValue) === 0) return;

    const { data: itemData } = await supabase
      .from('items')
      .select('id')
      .eq('name', item)
      .eq('user_id', SHARED_USER_ID)
      .single();

    if (!itemData) {
      console.error('Item not found:', item);
      return;
    }

    const storeObj = stores.find(s => s.id === storeId);
    if (!storeObj) return;

    await supabase
      .from('price_history')
      .insert({
        item_id: itemData.id,
        item_name: item,
        store_id: storeObj.id,
        store: storeObj.name,
        price: priceValue,
        user_id: SHARED_USER_ID,
        recorded_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      });

    const today = new Date().toISOString().split('T')[0];
    setPricesDates({ ...pricesDates, [`${storeId}-${item}`]: today });
    setLastSaved(formatLocalDate(today));
  };

  const getPriceColor = (storeId: string, item: string) => {
    const price = prices[`${storeId}-${item}`];
    const numPrice = parseFloat(price || '0');
    return numPrice > 0 ? 'text-gray-800' : 'text-gray-200';
  };

  const getDaysAgo = (storeId: string, item: string) => {
    const priceDate = pricesDates[`${storeId}-${item}`];
    if (!priceDate) return '';

    const date = new Date(priceDate);
    const today = new Date();
    const diffTime = today.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return '1d ago';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks}w ago`;
    }
    const months = Math.floor(diffDays / 30);
    return `${months}mo ago`;
  };

  const startEdit = (item: string) => {
    setEditingItem(item);
    setEditingValue(item);
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditingValue('');
  };

  const saveEdit = async (oldItem: string) => {
    if (!editingValue.trim() || editingValue === oldItem) {
      cancelEdit();
      return;
    }

    if (items.includes(editingValue.trim()) && editingValue.trim() !== oldItem) {
      showStatus('Item Exists', `An item with the name "${editingValue.trim()}" already exists.`, 'warning');
      return;
    }

    const { error: itemError } = await supabase
      .from('items')
      .update({ name: editingValue.trim() })
      .eq('name', oldItem);

    if (itemError) {
      console.error('Error updating item:', itemError);
      showStatus('Update Failed', 'Failed to update the item name. Please try again.', 'error');
      return;
    }

    await supabase
      .from('price_history')
      .update({ item_name: editingValue.trim() })
      .eq('item_name', oldItem)
      .eq('user_id', SHARED_USER_ID);

    await supabase
      .from('shopping_list')
      .update({ item_name: editingValue.trim() })
      .eq('item_name', oldItem)
      .eq('user_id', SHARED_USER_ID);

    const updatedItems = items.map(i => i === oldItem ? editingValue.trim() : i);
    setItems(updatedItems);

    const updatedPrices: { [key: string]: string } = {};
    Object.keys(prices).forEach(key => {
      if (key.endsWith(`-${oldItem}`)) {
        const storeIdPart = key.slice(0, key.lastIndexOf(`-${oldItem}`));
        const newKey = `${storeIdPart}-${editingValue.trim()}`;
        updatedPrices[newKey] = prices[key];
      } else {
        updatedPrices[key] = prices[key];
      }
    });
    setPrices(updatedPrices);

    const updatedDates: { [key: string]: string } = {};
    Object.keys(pricesDates).forEach(key => {
      if (key.endsWith(`-${oldItem}`)) {
        const storeIdPart = key.slice(0, key.lastIndexOf(`-${oldItem}`));
        const newKey = `${storeIdPart}-${editingValue.trim()}`;
        updatedDates[newKey] = pricesDates[key];
      } else {
        updatedDates[key] = pricesDates[key];
      }
    });
    setPricesDates(updatedDates);

    // If we were filtering by the old name, update the filter too
    if (selectedItemFilter === oldItem) {
      setSelectedItemFilter(editingValue.trim());
      updateURL(selectedStoreId, editingValue.trim());
    }

    cancelEdit();
  };

  const deleteItem = async (itemToDelete: string) => {
    if (!confirm(`Delete "${itemToDelete}"? This will remove all price data for this item.`)) {
      return;
    }

    const { error: itemError } = await supabase
      .from('items')
      .delete()
      .eq('name', itemToDelete);

    if (itemError) {
      console.error('Error deleting item:', itemError);
      showStatus('Delete Failed', 'Failed to delete the item. Please try again.', 'error');
      return;
    }

    await supabase
      .from('price_history')
      .delete()
      .eq('item_name', itemToDelete);

    await supabase
      .from('shopping_list')
      .delete()
      .eq('item_name', itemToDelete);

    const updatedItems = items.filter(i => i !== itemToDelete);
    setItems(updatedItems);

    // Filter cleanup if deleted item was selected
    if (selectedItemFilter === itemToDelete) {
      setSelectedItemFilter('');
      updateURL(selectedStoreId, '');
    }
  };

  const getCellColor = (storeId: string, item: string) => {
    const currentPrice = parseFloat(prices[`${storeId}-${item}`] || '0');
    if (currentPrice === 0) return 'bg-white';

    const itemPrices = stores.map(s => parseFloat(prices[`${s.id}-${item}`] || '0')).filter(p => p > 0);
    if (itemPrices.length === 0) return 'bg-white';
    if (itemPrices.length === 1) return 'bg-green-100';

    const minPrice = Math.min(...itemPrices);
    const maxPrice = Math.max(...itemPrices);

    if (currentPrice === minPrice && minPrice !== maxPrice) return 'bg-green-100';
    if (currentPrice === maxPrice && minPrice !== maxPrice) return 'bg-red-100';

    return 'bg-white';
  };

  // --- Handlers for ItemFilter ---
  const handleItemSelect = (item: string) => {
    setSelectedItemFilter(item);
    updateURL(selectedStoreId, item);
    try { localStorage.setItem('prices_last_item_filter', item); } catch (e) { }
  };

  const handleAddNewItem = async (newItemName: string) => {
    const name = newItemName.trim();
    if (!name) return;
    if (items.includes(name)) { handleItemSelect(name); return; }
    try {
      const { error } = await supabase.from('items').insert({ name: name, user_id: SHARED_USER_ID, category: 'Other' }).select().single();
      if (error) throw error;
      const newItems = [...items, name].sort((a, b) => a.localeCompare(b));
      setItems(newItems);
      handleItemSelect(name);
    } catch (e) {
      console.error('Error adding item', e);
      showStatus('Add Failed', 'Failed to add the new item. Please try again.', 'error');
    }
  };

  const sortedItems = items.sort((a, b) => a.localeCompare(b));
  const filteredItems = sortedItems.filter(item => {
    if (!selectedItemFilter) return false;
    return item === selectedItemFilter;
  });

  return (
    <div className="min-h-screen bg-blue-500 bg-gradient-to-br from-blue-500 to-green-400 p-0 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="sticky top-0 z-50 bg-white shadow-md p-4 mb-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="hidden md:block text-2xl md:text-4xl font-bold text-gray-800">Price Grid</h1>
              <div className="hidden md:flex items-center gap-3 mt-2">
                {lastSaved && (
                  <p className="text-xs md:text-sm text-gray-600">Last updated: {lastSaved}</p>
                )}
                <button
                  onClick={shareLink}
                  className="relative text-blue-500 hover:text-blue-600 transition cursor-pointer"
                  title="Share this page"
                >
                  <span className="text-base">🔗</span>
                  {showCopied && (
                    <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      Copied!
                    </span>
                  )}
                </button>
              </div>
            </div>
            <Header currentPage="Enter Prices" />
          </div>
        </div>

        {/* Mobile Filter Controls */}
        <div className="md:hidden mb-4 bg-white rounded-2xl shadow-lg p-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Select Store:</label>
          <select
            value={selectedStoreId}
            onChange={(e) => {
              setSelectedStoreId(e.target.value);
              updateURL(e.target.value, selectedItemFilter);
              try {
                localStorage.setItem('prices_last_store_id', e.target.value);
              } catch (err) {
                console.error('Failed to save to localStorage:', err);
              }
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold bg-white mb-4"
          >
            {stores.map(store => (
              <option key={store.id} value={store.id}>
                {store.name} {store.location ? `(${store.location})` : ''}
              </option>
            ))}
          </select>

          <label className="block text-sm font-semibold text-gray-700 mb-2">Filter Item:</label>
          <ItemFilter
            items={sortedItems}
            selectedItem={selectedItemFilter}
            onSelect={handleItemSelect}
            onAddNew={handleAddNewItem}
          />
        </div>

        {/* Mobile View - Item List */}
        <div className="md:hidden bg-white rounded-2xl shadow-lg">
          <div className="divide-y">
            {filteredItems.map((item, idx) => {
              const currentPrice = parseFloat(prices[`${selectedStoreId}-${item}`] || '0');
              const priceDate = pricesDates[`${selectedStoreId}-${item}`];

              // Calculate days ago
              let daysAgo = '';
              if (priceDate) {
                const date = new Date(priceDate);
                const today = new Date();
                const diffTime = today.getTime() - date.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                // ... same logic as before ...
                if (diffDays === 0) daysAgo = 'today';
                else if (diffDays === 1) daysAgo = 'yesterday';
                else if (diffDays < 7) daysAgo = `${diffDays} days ago`;
                else if (diffDays < 30) {
                  const weeks = Math.floor(diffDays / 7);
                  daysAgo = weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
                } else {
                  const months = Math.floor(diffDays / 30);
                  daysAgo = months === 1 ? '1 month ago' : `${months} months ago`;
                }
              }

              // Get all prices for this item
              const itemPrices = stores.map(store => ({
                storeName: store.name,
                price: parseFloat(prices[`${store.id}-${item}`] || '0')
              })).filter(p => p.price > 0);

              const sortedPrices = itemPrices.sort((a, b) => a.price - b.price);
              const bestPrice = sortedPrices[0];
              const isBest = currentPrice > 0 && bestPrice && currentPrice === bestPrice.price;
              const savings = currentPrice > 0 && bestPrice ? currentPrice - bestPrice.price : 0;

              const currentStoreObj = stores.find(s => s.id === selectedStoreId);

              return (
                <div key={item} className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex-1">
                      {editingItem === item ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && saveEdit(item)}
                            className="flex-1 px-2 py-1 border border-blue-500 rounded text-base"
                            autoFocus
                          />
                          <button
                            onClick={() => saveEdit(item)}
                            className="text-green-600 font-semibold cursor-pointer text-lg"
                          >
                            ✓
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-800 text-base">
                            {selectedItemFilter === 'All' && `${idx + 1}. `}{item}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEdit(item)}
                              className="text-gray-400 hover:text-blue-600 cursor-pointer p-2"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteItem(item)}
                              className="text-red-600 hover:text-red-800 cursor-pointer text-xl p-2"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center p-3 rounded-2xl bg-white">
                    <span className="text-gray-800 font-bold text-lg mr-2">$</span>
                    <div className="flex-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        style={{ MozAppearance: 'textfield' }}
                        className={`w-full px-4 py-3 border-2 border-gray-300 rounded-2xl text-right font-bold text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:text-gray-800 ${getPriceColor(selectedStoreId, item)} ${getCellColor(selectedStoreId, item)} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                        value={prices[`${selectedStoreId}-${item}`] || ''}
                        onChange={(e) => handlePriceChange(selectedStoreId, item, e.target.value)}
                        onBlur={() => handlePriceSave(selectedStoreId, item)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handlePriceSave(selectedStoreId, item);
                            e.currentTarget.blur();
                          }
                        }}
                      />
                      {prices[`${selectedStoreId}-${item}`] && parseFloat(prices[`${selectedStoreId}-${item}`]) > 0 && (
                        <div className="text-xs text-gray-500 text-right mt-1">
                          Updated {getDaysAgo(selectedStoreId, item)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price Comparison Message */}
                  {currentPrice === 0 ? null : itemPrices.length <= 1 ? (
                    <div className="mt-3 p-4 rounded-2xl border-2 bg-blue-50 border-blue-300">
                      <p className="text-sm text-blue-800 font-semibold">
                        ℹ️ Only price tracked - add prices from other stores to compare
                      </p>
                    </div>
                  ) : isBest ? (
                    <div className="mt-3 p-4 rounded-2xl border-2 bg-green-50 border-green-500">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">✅</span>
                        <div className="flex-1">
                          <p className="text-base font-bold text-green-800">Best Price!</p>
                          <p className="text-sm text-green-700">Buy now at {currentStoreObj?.name}</p>
                          {daysAgo && <p className="text-xs text-green-600 mt-1">Updated {daysAgo}</p>}
                        </div>
                      </div>
                    </div>
                  ) : savings <= 0.25 ? (
                    <div className="mt-3 p-4 rounded-2xl border-2 bg-yellow-50 border-yellow-300">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">⚠️</span>
                        <div className="flex-1">
                          <p className="text-base font-bold text-yellow-800">Close Enough</p>
                          <p className="text-sm text-yellow-700">{bestPrice.storeName} is only ${savings.toFixed(2)} cheaper</p>
                          {daysAgo && <p className="text-xs text-yellow-600 mt-1">Updated {daysAgo}</p>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 p-4 rounded-2xl border-2 bg-red-50 border-red-300">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">❌</span>
                        <div className="flex-1">
                          <p className="text-base font-bold text-red-800">Skip This One</p>
                          <p className="text-sm text-red-700">{bestPrice.storeName} has it for ${bestPrice.price.toFixed(2)} (save ${savings.toFixed(2)})</p>
                          {daysAgo && <p className="text-xs text-red-600 mt-1">Updated {daysAgo}</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop View - Full Table */}
        <div className="hidden md:block bg-white rounded-2xl shadow-lg overflow-x-auto">
          {/* Desktop Item Filter */}
          <div className="p-4 border-b bg-gray-50 flex items-center">
            <label className="inline-block text-sm font-semibold text-gray-700 mr-3">Filter Item:</label>
            <div className="w-80 relative">
              <ItemFilter
                items={sortedItems}
                selectedItem={selectedItemFilter}
                onSelect={handleItemSelect}
                onAddNew={handleAddNewItem}
              />
            </div>
          </div>

          <table className="w-full">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="p-4 text-left font-semibold">Item</th>
                {stores.map(store => (
                  <th key={store.id} className="p-4 text-center font-semibold text-sm">
                    {store.name}
                    {store.location && <div className="text-xs text-blue-100 font-normal">({store.location})</div>}
                  </th>
                ))}
                <th className="p-4 text-center font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => (
                <tr key={item} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-100'}>
                  <td className="p-4 font-medium text-gray-800">
                    {editingItem === item ? (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{idx + 1}.</span>
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && saveEdit(item)}
                          className="flex-1 px-2 py-1 border border-blue-500 rounded focus:ring-2 focus:ring-blue-200"
                          autoFocus
                        />
                        <button
                          onClick={() => saveEdit(item)}
                          className="text-green-600 hover:text-green-800 font-semibold cursor-pointer text-sm"
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <span>
                        <span className="text-gray-500 mr-2">{idx + 1}.</span>
                        {item}
                        <button
                          onClick={() => startEdit(item)}
                          className="ml-2 text-gray-400 hover:text-blue-600 cursor-pointer"
                          title="Edit"
                        >
                          <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </span>
                    )}
                  </td>

                  {stores.map(store => (
                    <td key={store.id} className="p-4">
                      <div className="flex flex-col items-end justify-center">
                        <div className="flex items-center">
                          <span className="text-gray-800 font-semibold mr-1">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder=""
                            style={{ MozAppearance: 'textfield' }}
                            className={`w-20 px-2 py-2 border border-gray-300 rounded text-right font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:text-gray-800 ${getPriceColor(store.id, item)} ${getCellColor(store.id, item)} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                            value={prices[`${store.id}-${item}`] || ''}
                            onChange={(e) => handlePriceChange(store.id, item, e.target.value)}
                            onBlur={() => handlePriceSave(store.id, item)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handlePriceSave(store.id, item);
                                e.currentTarget.blur();
                              }
                            }}
                          />
                        </div>
                        {prices[`${store.id}-${item}`] && parseFloat(prices[`${store.id}-${item}`]) > 0 && (
                          <span className="text-xs text-gray-500 mt-1">{getDaysAgo(store.id, item)}</span>
                        )}
                      </div>
                    </td>
                  ))}
                  <td className="p-4 text-center">
                    <button
                      onClick={() => deleteItem(item)}
                      className="text-red-600 hover:text-red-800 cursor-pointer"
                      title="Delete item"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

export default function Prices() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-blue-500 bg-gradient-to-br from-blue-500 to-green-400 p-1 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-gray-500 text-lg">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <PricesContent />
    </Suspense>
  );
}