'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_DEMO_ITEM_ID = 43; // Item ID for demo default

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [stores, setStores] = useState<string[]>([]);
  const [prices, setPrices] = useState<{[key: string]: {price: string, date: string}}>({});
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [filterLetter, setFilterLetter] = useState<string>('All');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [showCopied, setShowCopied] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [defaultDemoItemName, setDefaultDemoItemName] = useState<string | null>(null);
  
  // Search/autocomplete state
  const [searchQuery, setSearchQuery] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<string[]>([]);
  
  // Quick Add state
  const [quickAddStore, setQuickAddStore] = useState<string>('');
  const [quickAddPrice, setQuickAddPrice] = useState<string>('');

  const toggleLetter = (letter: string) => {
    setFilterLetter((prev) => (prev === letter ? 'All' : letter));
  };
  

  useEffect(() => {
    loadData();
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
    if (!isInitialLoad || items.length === 0 || defaultDemoItemName === null) return;
    
    // Load from URL parameters
    const itemsParam = searchParams.get('items');
    if (itemsParam) {
      try {
        const parsedItems = JSON.parse(itemsParam);
        setSelectedItems(parsedItems);
        // Save to localStorage
        localStorage.setItem('compare_last_items', JSON.stringify(parsedItems));
      } catch (e) {
        setSelectedItems(itemsParam.split(','));
        localStorage.setItem('compare_last_items', JSON.stringify(itemsParam.split(',')));
      }
    } else {
      // No URL params - check localStorage first, then default to demo item
      try {
        const lastItems = localStorage.getItem('compare_last_items');
        if (lastItems) {
          const parsedLastItems = JSON.parse(lastItems);
          setSelectedItems(parsedLastItems);
          updateURL(parsedLastItems);
        } else if (defaultDemoItemName && items.includes(defaultDemoItemName)) {
          // Default to demo item for first-time users
          setSelectedItems([defaultDemoItemName]);
          updateURL([defaultDemoItemName]);
          localStorage.setItem('compare_last_items', JSON.stringify([defaultDemoItemName]));
        }
      } catch (e) {
        // If localStorage fails, just default to demo item
        if (defaultDemoItemName && items.includes(defaultDemoItemName)) {
          setSelectedItems([defaultDemoItemName]);
          updateURL([defaultDemoItemName]);
        }
      }
    }
    
    setIsInitialLoad(false);
  }, [searchParams, items, isInitialLoad, defaultDemoItemName]);

  const updateURL = (items: string[]) => {
    if (items.length === 0) {
      router.push('/compare');
      return;
    }
    
    const params = new URLSearchParams();
    params.set('items', JSON.stringify(items));
    
    router.push(`/compare?${params.toString()}`);
  };

  const shareLink = async () => {
    const url = window.location.href;
    
    try {
      await navigator.clipboard.writeText(url);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      alert('Failed to copy link');
    }
  };

  const loadData = async () => {
    // Load stores
    const { data: storesData } = await supabase
      .from('stores')
      .select('name')
      .order('name');
    
    if (storesData) {
      setStores(storesData.map(s => s.name));
    }

    // Load items (including ID to find demo item)
    const { data: itemsData } = await supabase
      .from('items')
      .select('id, name, is_favorite')
      .eq('user_id', SHARED_USER_ID)
      .order('name');
    
    if (itemsData) {
      setItems(itemsData.map(i => i.name));
      const favs = itemsData.filter(i => i.is_favorite === true).map(i => i.name);
      setFavorites(favs);
      
      // Find the demo item by ID
      const demoItem = itemsData.find(i => i.id === DEFAULT_DEMO_ITEM_ID);
      if (demoItem) {
        setDefaultDemoItemName(demoItem.name);
      }
    }

    // Load latest prices from price_history
    const { data: pricesData } = await supabase
      .from('price_history')
      .select('*')
      .eq('user_id', SHARED_USER_ID)
      .order('recorded_date', { ascending: false });
    
    if (pricesData) {
      const pricesObj: {[key: string]: {price: string, date: string}} = {};
      const latestPrices: {[key: string]: any} = {};
      
      // Get the most recent price for each item/store combination
      pricesData.forEach(p => {
        const key = `${p.store}-${p.item_name}`;
        if (!latestPrices[key] || new Date(p.recorded_date) > new Date(latestPrices[key].recorded_date)) {
          latestPrices[key] = p;
          pricesObj[key] = {
            price: p.price,
            date: p.recorded_date
          };
        }
      });
      
      setPrices(pricesObj);

      // Get most recent update time
      if (pricesData.length > 0) {
        const latest = pricesData.reduce((a, b) => 
          new Date(a.recorded_date) > new Date(b.recorded_date) ? a : b
        );
        setLastUpdated(new Date(latest.recorded_date).toLocaleDateString());
      }
    }
  };

  // Deselect items when filter changes and they're no longer visible
  useEffect(() => {
    if (filterLetter !== 'All') {
      setSelectedItems(prevSelected => 
        prevSelected.filter(item => item.toUpperCase().startsWith(filterLetter))
      );
    }
  }, [filterLetter]);

  const toggleItem = (item: string) => {
    let newSelectedItems: string[];
    
    // Always use multi-select behavior: toggle on/off
    if (selectedItems.includes(item)) {
      newSelectedItems = selectedItems.filter(i => i !== item);
    } else {
      newSelectedItems = [...selectedItems, item];
    }
    
    setSelectedItems(newSelectedItems);
    updateURL(newSelectedItems);
    
    // Save to localStorage
    try {
      localStorage.setItem('compare_last_items', JSON.stringify(newSelectedItems));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    if (value.trim()) {
      // Filter items that match the search
      const matchingItems = items.filter(item => 
        item.toLowerCase().includes(value.toLowerCase())
      );
      setAutocompleteItems(matchingItems);
      setShowAutocomplete(matchingItems.length > 0);
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
    const storeData: {[store: string]: {total: number, coverage: number, itemCount: number}} = {};
    
    stores.forEach(store => {
      let total = 0;
      let coverage = 0;
      
      selectedItems.forEach(item => {
        const priceData = prices[`${store}-${item}`];
        if (priceData) {
          const price = parseFloat(priceData.price);
          total += price;
          coverage++;
        }
      });
      
      storeData[store] = {
        total,
        coverage,
        itemCount: selectedItems.length
      };
    });

    return storeData;
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
    
    setQuickAddPrice(priceValue);
  };

  const handleQuickAddPrice = async () => {
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

    const item = selectedItems[0];
    
    const { error } = await supabase
      .from('price_history')
      .insert({
        item_name: item,
        store: quickAddStore,
        price: quickAddPrice,
        user_id: SHARED_USER_ID,
        recorded_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error adding price:', error);
      alert(`Failed to add price for ${item}`);
      return;
    }

    // Clear form
    setQuickAddStore('');
    setQuickAddPrice('');

    // Reload data to show updated prices
    loadData();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleQuickAddPrice();
    }
  };

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const filteredItems = filterLetter === 'All' 
    ? items.sort() 
    : items.sort().filter(item => item.toUpperCase().startsWith(filterLetter));
  
  const filteredFavorites = filterLetter === 'All'
    ? favorites
    : favorites.filter(fav => fav.toUpperCase().startsWith(filterLetter));

  const selectAllFavorites = () => {
    const newSelectedItems = [...new Set([...selectedItems, ...filteredFavorites])];
    setSelectedItems(newSelectedItems);
    updateURL(newSelectedItems);
    try {
      localStorage.setItem('compare_last_items', JSON.stringify(newSelectedItems));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  };

  const deselectAllFavorites = () => {
    const newSelectedItems = selectedItems.filter(item => !filteredFavorites.includes(item));
    setSelectedItems(newSelectedItems);
    updateURL(newSelectedItems);
    try {
      localStorage.setItem('compare_last_items', JSON.stringify(newSelectedItems));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  };

  const allFavoritesSelected = filteredFavorites.length > 0 && filteredFavorites.every(fav => selectedItems.includes(fav));

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
    // Get all prices for this item across all stores
    const itemPrices: number[] = [];
    stores.forEach(store => {
      const priceData = prices[`${store}-${itemName}`];
      if (priceData) {
        itemPrices.push(parseFloat(priceData.price));
      }
    });

    if (itemPrices.length === 0) return null;

    const minPrice = Math.min(...itemPrices);
    
    // Calculate percentage above minimum
    const percentAboveMin = ((currentPrice - minPrice) / minPrice) * 100;
    const percentInt = Math.round(percentAboveMin);

    // Best price = show "Best Price"
    if (currentPrice === minPrice) {
      return { 
        label: 'Best Price', 
        mobileLabel: 'Best Price',
        emoji: '✅', 
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      };
    }
    
    // 1-10% above minimum = "Close Enough"
    if (percentAboveMin <= 10) {
      return { 
        label: `Close Enough (${percentInt}% more)`, 
        mobileLabel: `Close Enough (${percentInt}% more)`,
        emoji: '➖', 
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50'
      };
    }
    
    // More than 10% above minimum = "Skip" with percentage
    return { 
      label: `Skip This One (${percentInt}% more)`, 
      mobileLabel: `Skip (${percentInt}% more)`,
      emoji: '❌', 
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    };
  };

  const storeData = calculateBestStore();
  const sortedStores = Object.entries(storeData)
    .filter(([, data]) => data.coverage > 0)
    .sort(([, a], [, b]) => {
      if (b.coverage !== a.coverage) {
        return b.coverage - a.coverage;
      }
      return a.total - b.total;
    });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 p-0 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="sticky top-0 z-50 bg-white shadow-md p-4 mb-6">
          <div className="hidden md:flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-2xl md:text-4xl font-bold text-gray-800">Compare by Item</h1>
              <div className="flex items-center gap-3 mt-2">
                {lastUpdated && (
                  <p className="text-xs md:text-sm text-gray-600">Prices last updated: {lastUpdated}</p>
                )}
                {selectedItems.length > 0 && (
                  <button
                    onClick={shareLink}
                    className="relative text-teal-500 hover:text-teal-600 transition cursor-pointer"
                    title="Share this comparison"
                  >
                    <span className="text-base">🔗</span>
                    {showCopied && (
                      <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        Copied!
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
            <Header currentPage="Compare Items" />
          </div>
          <div className="md:hidden">
            <Header currentPage="Compare Items" />
          </div>
        </div>

        <div className="hidden md:block bg-white rounded-2xl shadow-lg p-3 md:p-4 mb-4 md:mb-6">
          <div className="flex flex-wrap gap-1.5 md:gap-2 justify-center">
            <button
              onClick={() => setFilterLetter('All')}
              className={`px-2.5 py-1.5 md:px-3 md:py-1 rounded text-sm md:text-base font-semibold cursor-pointer transition ${
                filterLetter === 'All'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {alphabet.filter(letter => 
              items.some(item => item.toUpperCase().startsWith(letter))
            ).map(letter => (
              <button
                key={letter}
                onClick={() => toggleLetter(letter)}
                className={`px-2.5 py-1.5 md:px-3 md:py-1 rounded text-sm md:text-base font-semibold cursor-pointer transition ${
                  filterLetter === letter
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>

        <div className="md:hidden bg-white rounded-2xl shadow-lg p-4 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Search Items to Compare</label>
          <div className="relative search-autocomplete-container">
            <input
              type="text"
              placeholder="Type to search items..."
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
                  const isSelected = selectedItems.includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => selectItemFromSearch(item)}
                      className={`w-full text-left px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                        isSelected 
                          ? 'bg-indigo-50 text-blue-700 font-semibold'
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
              {selectedItems.map(item => (
                <span
                  key={item}
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-base font-semibold"
                >
                  {item}
                  <button
                    onClick={() => toggleItem(item)}
                    className="hover:bg-blue-700 rounded-full px-1.5 py-0.5"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {filteredFavorites.length > 0 && (
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
              {filteredFavorites.map(item => (
                <button
                  key={item}
                  onClick={() => toggleItem(item)}
                  className={`px-3 py-1.5 rounded-2xl border-2 transition cursor-pointer text-sm font-semibold ${
                    selectedItems.includes(item)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-yellow-400 hover:border-yellow-500'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

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
                  } catch (e) {
                    console.error('Failed to clear localStorage:', e);
                  }
                }}
                className="text-sm text-red-600 hover:text-red-800 font-semibold cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>
          
          {/* Search box */}
          <div className="mb-4 relative search-autocomplete-container">
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
                  const isSelected = selectedItems.includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => selectItemFromSearch(item)}
                      className={`w-full text-left px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                        isSelected 
                          ? 'bg-blue-50 text-blue-700 font-semibold'
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
            {filteredItems.map(item => (
              <button
                key={item}
                onClick={() => toggleItem(item)}
                className={`p-4 md:p-3 rounded-2xl border-2 transition cursor-pointer font-semibold text-base ${
                  selectedItems.includes(item)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

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
                      className={`p-4 rounded-2xl border-2 ${
                        idx === 0
                          ? 'bg-green-50 border-green-500'
                          : 'bg-gray-50 border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-lg md:text-xl text-gray-800">{store}</span>
                            {idx === 0 && (
                              <span className="text-xs md:text-sm bg-green-500 text-white px-2 md:px-3 py-1 rounded-full whitespace-nowrap">
                                Best Deal!
                              </span>
                            )}
                          </div>
                          {selectedItems.length > 1 && (
                            <p className={`text-xs md:text-sm mt-1 flex items-center gap-1 ${
                              isComplete ? 'text-green-600' : 'text-orange-600'
                            }`}>
                              <span>
                                {data.coverage}/{data.itemCount} items ({coveragePercent}% coverage)
                                {!isComplete && ' ⚠️'}
                              </span>
                              {isComplete && selectedItems.length > 1 && (
                                <span className="text-sm bg-blue-500 text-white px-2 py-1 rounded-full">
                                  ✓
                                </span>
                              )}
                            </p>
                          )}
                          {selectedItems.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {selectedItems.map(item => {
                                const priceData = prices[`${store}-${item}`];
                                if (priceData) {
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
                                } else {
                                  return (
                                    <p key={item} className="text-xs text-gray-400">
                                      {item}: no price
                                    </p>
                                  );
                                }
                              })}
                            </div>
                          )}
                        </div>
                        <span className="text-xl md:text-2xl font-bold text-gray-800 whitespace-nowrap">
                          ${data.total.toFixed(2)}
                        </span>
                      </div>
                      {idx === 0 && sortedStores.length > 1 && sortedStores[0][1].coverage === sortedStores[1][1].coverage && (
                        <p className="text-xs md:text-sm text-green-700 mt-2">
                          Save ${(sortedStores[1][1].total - data.total).toFixed(2)} vs {sortedStores[1][0]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 md:p-8 text-center bg-yellow-50 border-2 border-yellow-200 rounded-2xl">
                <p className="text-base md:text-lg font-semibold text-yellow-800 mb-2">No price data available</p>
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

        {selectedItems.length === 1 && (
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Add Price</h2>
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
                  {stores.map(store => (
                    <option key={store} value={store}>{store}</option>
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
                  className="w-full bg-indigo-500 text-white px-4 py-3 rounded-2xl font-semibold hover:bg-teal-600 transition cursor-pointer"
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
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-gray-500 text-lg">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}