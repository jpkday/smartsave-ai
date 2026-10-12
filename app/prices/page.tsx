'use client';
import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { useStatusModal } from '../hooks/useStatusModal';
import { useHouseholdCode } from '../hooks/useHouseholdCode';
import { SHARED_USER_ID } from '../lib/constants';
import { formatLocalDate } from '../utils/date';
import StatusModal from '../components/StatusModal';
import { filterToHouseholdStores } from '../lib/stores';

interface Store {
  id: string;
  name: string;
  location: string | null;
}

// --- Standalone ItemFilter Component ---
interface ItemFilterProps {
  items: { id: string; name: string }[];
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
      filtered = items.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
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
          className="w-full px-4 py-3 border border-bb-line rounded-2xl focus:border-bb-gold/50 focus:ring-2 focus:ring-bb-gold/50 text-bb-cream font-semibold bg-bb-raised placeholder:text-slate-500 focus:outline-none pr-10"
        />
        {query && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-bb-muted hover:text-bb-cream p-1 rounded-full hover:bg-white/5"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-bb-panel rounded-xl shadow-sm border border-bb-line max-h-60 overflow-y-auto w-full">
          {getDropdownItems().map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item.name)}
              className={`w-full text-left px-4 py-3 hover:bg-white/5 border-b border-bb-line last:border-0 flex justify-between items-center ${selectedItem === item.name ? 'text-bb-gold bg-bb-gold/10 font-semibold' : 'text-bb-cream'}`}
            >
              {item.name}
              {selectedItem === item.name && <span>✓</span>}
            </button>
          ))}

          {/* "Add New" Logic */}
          {query && !items.some(i => i.name.toLowerCase() === query.trim().toLowerCase()) && (
            <button
              onClick={() => {
                onAddNew(query);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-3 text-bb-gold hover:bg-white/5 font-bold border-t border-bb-line"
            >
              + Add "{query}"
            </button>
          )}

          {query && getDropdownItems().length === 0 && items.some(i => i.name.toLowerCase() === query.trim().toLowerCase()) && (
            <div className="px-4 py-3 text-bb-muted text-sm">Item already exists</div>
          )}

          {getDropdownItems().length === 0 && !query && (
            <div className="px-4 py-3 text-bb-muted text-sm">Type to search items...</div>
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
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [editingItem, setEditingItem] = useState<{ id: string; name: string } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedItemFilter, setSelectedItemFilter] = useState<string>('');
  const [showCopied, setShowCopied] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  /* Use custom hooks */
  const { householdCode } = useHouseholdCode();
  const { modal: statusModal, show: showStatus, close: closeStatus } = useStatusModal();

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
      // Standard load from localStorage if no URL params
      if (stores.length > 0) {
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
      try {
        const lastItemFilter = localStorage.getItem('prices_last_item_filter');
        if (lastItemFilter && lastItemFilter !== 'All') {
          setSelectedItemFilter(lastItemFilter);
        }
      } catch (e) { }
    }
    setIsInitialLoad(false);
  }, [stores, isInitialLoad, searchParams]);

  const loadData = async () => {
    // 1. Stores
    const { data: storesData } = await supabase.from('stores').select('*');
    if (storesData) {
      setStores(await filterToHouseholdStores(storesData));
    }

    // 2. Items
    const { data: itemsData } = await supabase
      .from('items')
      .select('id, name');

    if (itemsData) {
      const loadedItems = itemsData.map((d: any) => ({ id: d.id.toString(), name: d.name }));
      setItems(loadedItems);
    }

    // 3. Price History to build the grid
    const { data: historyData } = await supabase.from('price_history').select('*');
    if (historyData && itemsData) {
      const newPrices: { [key: string]: string } = {};
      const newDates: { [key: string]: string } = {};

      historyData.forEach((h: any) => {
        const item = itemsData.find((i: any) => i.id === h.item_id); // Match by ID
        if (item) {
          const key = `${h.store_id}-${item.name}`; // Key by Name
          // If multiple, take latest?
          // For now just taking any. Ideally we filter distinct or something.
          // The table has multiple entries. We want the latest for each store-item combo.
          // But our SQL query didn't sort.
          // Let's assume the latest is what we want, need logic.
          // Actually, we can just overwrite. The latest one processed 'wins' if unsorted, random.
          // Better: check dates.
          const existingDate = newDates[key];
          if (!existingDate || new Date(h.created_at) > new Date(existingDate)) {
            newPrices[key] = h.price.toString();
            newDates[key] = h.created_at;
          }
        }
      });
      setPrices(newPrices);
      setPricesDates(newDates);
    }
  };

  const updateURL = (storeId: string, itemFilter: string) => {
    const params = new URLSearchParams();
    if (storeId) params.set('store', storeId);
    if (itemFilter) params.set('item', itemFilter);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const shareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    });
  };

  const handlePriceChange = (storeId: string, item: string, value: string) => {
    // allow typing
    setPrices(prev => ({
      ...prev,
      [`${storeId}-${item}`]: value
    }));
  };

  const handlePriceSave = async (storeId: string, itemName: string) => {
    const priceStr = prices[`${storeId}-${itemName}`];
    // Allow empty string to mean 'no price' or ignore?
    // If empty/invalid, maybe don't save or delete?
    // For now, only save if valid number.
    const price = parseFloat(priceStr);
    if (isNaN(price)) return; // Don't save invalid

    // Find item ID
    const itemObj = items.find(i => i.name === itemName);
    if (!itemObj) return;

    const { error } = await supabase.from('price_history').insert({
      store_id: storeId,
      item_id: parseInt(itemObj.id),
      price: price,
      user_id: SHARED_USER_ID,
      unit: 'unit' // default
    });

    if (error) {
      console.error('Error saving price:', error);
      showStatus('Save Failed', 'Could not save the price.', 'error');
    } else {
      setLastSaved(new Date().toLocaleTimeString());
      setPricesDates(prev => ({ ...prev, [`${storeId}-${itemName}`]: new Date().toISOString() }));
    }
  };

  const startEdit = (item: { id: string; name: string }) => {
    setEditingItem(item);
    setEditingValue(item.name);
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditingValue('');
  };

  const saveEdit = async (itemObj: { id: string; name: string }) => {
    const newName = editingValue.trim();
    if (!newName || newName === itemObj.name) {
      cancelEdit();
      return;
    }

    // Rename in DB
    const { error } = await supabase
      .from('items')
      .update({ name: newName })
      .eq('id', parseInt(itemObj.id));

    if (error) {
      console.error('Error renaming item:', error);
      showStatus('Rename Failed', 'Could not rename item.', 'error');
      return;
    }

    // Update Local State
    setItems(prev => prev.map(i => i.id === itemObj.id ? { ...i, name: newName } : i));

    // Update Prices Map Keys (expensive but necessary if keyed by name)
    const newPrices: { [key: string]: string } = {};
    const updatedDates: { [key: string]: string } = {};

    Object.keys(prices).forEach(key => {
      const [storeIdPart, ...nameParts] = key.split('-');
      const oldNameKey = nameParts.join('-'); // item name could have dashes
      if (oldNameKey === itemObj.name) {
        const newKey = `${storeIdPart}-${newName}`;
        newPrices[newKey] = prices[key];
      } else {
        newPrices[key] = prices[key];
      }
    });
    setPrices(newPrices);

    Object.keys(pricesDates).forEach(key => {
      const [storeIdPart, ...nameParts] = key.split('-');
      const oldNameKey = nameParts.join('-');
      if (oldNameKey === itemObj.name) {
        const newKey = `${storeIdPart}-${newName}`;
        updatedDates[newKey] = pricesDates[key];
      } else {
        updatedDates[key] = pricesDates[key];
      }
    });
    setPricesDates(updatedDates);

    // If we were filtering by the old name, update the filter too
    if (selectedItemFilter === itemObj.name) {
      setSelectedItemFilter(newName);
      updateURL(selectedStoreId, newName);
    }

    cancelEdit();
  };

  const deleteItem = async (itemObj: { id: string; name: string }) => {
    if (!confirm(`Delete "${itemObj.name}"? This will remove all price data for this item.`)) {
      return;
    }

    const { error: itemError } = await supabase
      .from('items')
      .delete()
      .eq('id', parseInt(itemObj.id));

    if (itemError) {
      console.error('Error deleting item:', itemError);
      showStatus('Delete Failed', 'Failed to delete the item. Please try again.', 'error');
      return;
    }

    await supabase
      .from('price_history')
      .delete()
      .eq('item_id', parseInt(itemObj.id));

    await supabase
      .from('shopping_list')
      .delete()
      .eq('item_id', parseInt(itemObj.id));

    setItems(prev => prev.filter(i => i.id !== itemObj.id));

    // Filter cleanup if deleted item was selected
    if (selectedItemFilter === itemObj.name) {
      setSelectedItemFilter('');
      updateURL(selectedStoreId, '');
    }
  };


  const getPriceColor = (storeId: string, itemName: string) => {
    const price = prices[`${storeId}-${itemName}`];
    const numPrice = parseFloat(price || '0');
    return numPrice > 0 ? 'text-bb-cream' : 'text-slate-600';
  };

  const getDaysAgo = (storeId: string, itemName: string) => {
    const priceDate = pricesDates[`${storeId}-${itemName}`];
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

  const getCellColor = (storeId: string, itemName: string) => {
    const currentPrice = parseFloat(prices[`${storeId}-${itemName}`] || '0');
    if (currentPrice === 0) return 'bg-bb-raised';

    const itemPrices = stores.map(s => parseFloat(prices[`${s.id}-${itemName}`] || '0')).filter(p => p > 0);
    if (itemPrices.length === 0) return 'bg-bb-raised';
    if (itemPrices.length === 1) return 'bg-bb-green/10';

    const minPrice = Math.min(...itemPrices);
    const maxPrice = Math.max(...itemPrices);

    if (currentPrice === minPrice && minPrice !== maxPrice) return 'bg-bb-green/10';
    if (currentPrice === maxPrice && minPrice !== maxPrice) return 'bg-bb-red/10';

    return 'bg-bb-raised';
  };

  // --- Handlers for ItemFilter ---
  const handleItemSelect = (itemName: string) => {
    setSelectedItemFilter(itemName);
    updateURL(selectedStoreId, itemName);
    try { localStorage.setItem('prices_last_item_filter', itemName); } catch (e) { }
  };

  const handleAddNewItem = async (newItemName: string) => {
    const name = newItemName.trim();
    if (!name) return;
    if (items.some(i => i.name === name)) { handleItemSelect(name); return; }
    try {
      const { data, error } = await supabase.from('items').insert({ name: name }).select().single();
      if (error) throw error;
      const newItem = { id: data.id.toString(), name: data.name };
      setItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
      handleItemSelect(name);
    } catch (e) {
      console.error('Error adding item', e);
      showStatus('Add Failed', 'Failed to add the new item. Please try again.', 'error');
    }
  };

  const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name));
  const filteredItems = sortedItems.filter(item => {
    if (!selectedItemFilter) return false;
    return item.name === selectedItemFilter;
  });

  return (
    <div className="min-h-screen app-bg p-0 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="sticky top-0 z-50 app-header p-4 mb-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="hidden md:block text-2xl md:text-4xl font-bold text-bb-cream">Price Grid</h1>
              <div className="hidden md:flex items-center gap-3 mt-2">
                {lastSaved && (
                  <p className="text-xs md:text-sm text-bb-muted">Last updated: {lastSaved}</p>
                )}
                <button
                  onClick={shareLink}
                  className="relative text-bb-muted hover:text-bb-cream transition cursor-pointer"
                  title="Share this page"
                >
                  <span className="text-base">🔗</span>
                  {showCopied && (
                    <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-bb-green text-bb-navy text-xs px-2 py-1 rounded whitespace-nowrap">
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
        <div className="md:hidden mb-4 bg-bb-panel border border-bb-line rounded-2xl shadow-sm p-4">
          <label className="block text-sm font-semibold text-bb-cream mb-2">Select Store:</label>
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
            className="w-full px-4 py-3 border border-bb-line rounded-2xl focus:border-bb-gold/50 focus:ring-2 focus:ring-bb-gold/50 text-bb-cream font-semibold bg-bb-raised focus:outline-none mb-4"
          >
            {stores.map(store => (
              <option key={store.id} value={store.id}>
                {store.name} {store.location ? `(${store.location})` : ''}
              </option>
            ))}
          </select>

          <label className="block text-sm font-semibold text-bb-cream mb-2">Filter Item:</label>
          <ItemFilter
            items={sortedItems}
            selectedItem={selectedItemFilter}
            onSelect={handleItemSelect}
            onAddNew={handleAddNewItem}
          />
        </div>

        {/* Mobile View - Item List */}
        <div className="md:hidden bg-bb-panel border border-bb-line rounded-2xl shadow-sm">
          <div className="divide-y divide-bb-line">
            {filteredItems.map((item, idx) => {
              const currentPrice = parseFloat(prices[`${selectedStoreId}-${item.name}`] || '0');
              const priceDate = pricesDates[`${selectedStoreId}-${item.name}`];

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
                price: parseFloat(prices[`${store.id}-${item.name}`] || '0')
              })).filter(p => p.price > 0);

              const sortedPrices = itemPrices.sort((a, b) => a.price - b.price);
              const bestPrice = sortedPrices[0];
              const isBest = currentPrice > 0 && bestPrice && currentPrice === bestPrice.price;
              const savings = currentPrice > 0 && bestPrice ? currentPrice - bestPrice.price : 0;

              const currentStoreObj = stores.find(s => s.id === selectedStoreId);

              return (
                <div key={item.id} className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex-1">
                      {editingItem?.id === item.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && saveEdit(item)}
                            className="flex-1 px-2 py-1 border border-bb-gold rounded text-base bg-bb-raised text-bb-cream focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => saveEdit(item)}
                            className="text-bb-green font-semibold cursor-pointer text-lg"
                          >
                            ✓
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-bb-cream text-base">
                            {selectedItemFilter === 'All' && `${idx + 1}. `}{item.name}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEdit(item)}
                              className="text-bb-muted hover:text-bb-cream cursor-pointer p-2"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteItem(item)}
                              className="text-bb-red hover:opacity-80 cursor-pointer text-xl p-2"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center p-3 rounded-2xl bg-white/[0.03]">
                    <span className="text-bb-cream font-bold text-lg mr-2">$</span>
                    <div className="flex-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        style={{ MozAppearance: 'textfield' }}
                        className={`w-full px-4 py-3 border-2 border-bb-line rounded-2xl text-right font-bold text-lg focus:border-bb-gold/50 focus:ring-2 focus:ring-bb-gold/50 focus:outline-none focus:text-bb-cream ${getPriceColor(selectedStoreId, item.name)} ${getCellColor(selectedStoreId, item.name)} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                        value={prices[`${selectedStoreId}-${item.name}`] || ''}
                        onChange={(e) => handlePriceChange(selectedStoreId, item.name, e.target.value)}
                        onBlur={() => handlePriceSave(selectedStoreId, item.name)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handlePriceSave(selectedStoreId, item.name);
                            e.currentTarget.blur();
                          }
                        }}
                      />
                      {prices[`${selectedStoreId}-${item.name}`] && parseFloat(prices[`${selectedStoreId}-${item.name}`]) > 0 && (
                        <div className="text-xs text-bb-muted text-right mt-1">
                          Updated {getDaysAgo(selectedStoreId, item.name)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price Comparison Message */}
                  {currentPrice === 0 ? null : itemPrices.length <= 1 ? (
                    <div className="mt-3 p-4 rounded-2xl border-2 bg-white/[0.03] border-bb-line">
                      <p className="text-sm text-bb-muted font-semibold">
                        ℹ️ Only price tracked - add prices from other stores to compare
                      </p>
                    </div>
                  ) : isBest ? (
                    <div className="mt-3 p-4 rounded-2xl border-2 bg-bb-green/10 border-bb-green/40">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">✅</span>
                        <div className="flex-1">
                          <p className="text-base font-bold text-bb-green">Best Price!</p>
                          <p className="text-sm text-bb-green">Buy now at {currentStoreObj?.name}</p>
                          {daysAgo && <p className="text-xs text-bb-green mt-1">Updated {daysAgo}</p>}
                        </div>
                      </div>
                    </div>
                  ) : savings <= 0.25 ? (
                    <div className="mt-3 p-4 rounded-2xl border-2 bg-bb-gold/10 border-bb-gold/30">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">⚠️</span>
                        <div className="flex-1">
                          <p className="text-base font-bold text-bb-gold">Close Enough</p>
                          <p className="text-sm text-bb-gold">{bestPrice.storeName} is only ${savings.toFixed(2)} cheaper</p>
                          {daysAgo && <p className="text-xs text-bb-gold mt-1">Updated {daysAgo}</p>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 p-4 rounded-2xl border-2 bg-bb-red/10 border-bb-red/30">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">❌</span>
                        <div className="flex-1">
                          <p className="text-base font-bold text-bb-red">Skip This One</p>
                          <p className="text-sm text-bb-red">{bestPrice.storeName} has it for ${bestPrice.price.toFixed(2)} (save ${savings.toFixed(2)})</p>
                          {daysAgo && <p className="text-xs text-bb-red mt-1">Updated {daysAgo}</p>}
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
        <div className="hidden md:block bg-bb-panel border border-bb-line rounded-2xl shadow-sm overflow-x-auto">
          {/* Desktop Item Filter */}
          <div className="p-4 border-b border-bb-line bg-bb-raised flex items-center">
            <label className="inline-block text-sm font-semibold text-bb-cream mr-3">Filter Item:</label>
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
            <thead className="bg-bb-raised text-bb-cream border-b border-bb-line">
              <tr>
                <th className="p-4 text-left font-semibold">Item</th>
                {stores.map(store => (
                  <th key={store.id} className="p-4 text-center font-semibold text-sm">
                    {store.name}
                    {store.location && <div className="text-xs text-bb-muted font-normal">({store.location})</div>}
                  </th>
                ))}
                <th className="p-4 text-center font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => (
                <tr key={item.id} className={idx % 2 === 0 ? 'bg-bb-panel border-b border-bb-line' : 'bg-bb-panel border-b border-bb-line'}>
                  <td className="p-4 font-medium text-bb-cream">
                    {editingItem?.id === item.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-bb-muted">{idx + 1}.</span>
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && saveEdit(item)}
                          className="flex-1 px-2 py-1 border border-bb-gold rounded bg-bb-raised text-bb-cream focus:outline-none focus:ring-2 focus:ring-bb-gold/50"
                          autoFocus
                        />
                        <button
                          onClick={() => saveEdit(item)}
                          className="text-bb-green hover:opacity-80 font-semibold cursor-pointer text-sm"
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <span>
                        <span className="text-bb-muted mr-2">{idx + 1}.</span>
                        {item.name}
                        <button
                          onClick={() => startEdit(item)}
                          className="ml-2 text-bb-muted hover:text-bb-cream cursor-pointer"
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
                          <span className="text-bb-cream font-semibold mr-1">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder=""
                            style={{ MozAppearance: 'textfield' }}
                            className={`w-20 px-2 py-2 border border-bb-line rounded text-right font-semibold focus:border-bb-gold/50 focus:ring-2 focus:ring-bb-gold/50 focus:outline-none focus:text-bb-cream ${getPriceColor(store.id, item.name)} ${getCellColor(store.id, item.name)} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                            value={prices[`${store.id}-${item.name}`] || ''}
                            onChange={(e) => handlePriceChange(store.id, item.name, e.target.value)}
                            onBlur={() => handlePriceSave(store.id, item.name)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handlePriceSave(store.id, item.name);
                                e.currentTarget.blur();
                              }
                            }}
                          />
                        </div>
                        {prices[`${store.id}-${item.name}`] && parseFloat(prices[`${store.id}-${item.name}`]) > 0 && (
                          <span className="text-xs text-bb-muted mt-1">{getDaysAgo(store.id, item.name)}</span>
                        )}
                      </div>
                    </td>
                  ))}
                  <td className="p-4 text-center">
                    <button
                      onClick={() => deleteItem(item)}
                      className="text-bb-red hover:opacity-80 cursor-pointer"
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
        onClose={closeStatus}
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
      <div className="min-h-screen app-bg p-1 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-bb-panel border border-bb-line rounded-2xl shadow-sm p-8 text-center">
            <p className="text-bb-muted text-lg">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <PricesContent />
    </Suspense>
  );
}