'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

interface ListItem {
  id: string;
  item_name: string;
  quantity: number;
  checked: boolean;
}

interface PriceData {
  price: string;
  date: string;
}

export default function ShoppingList() {
  const [stores, setStores] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [prices, setPrices] = useState<{[key: string]: PriceData}>({});
  const [filterLetter, setFilterLetter] = useState<string>('All');
  const [showFavorites, setShowFavorites] = useState(true);
  const [showAddItems, setShowAddItems] = useState(true);
  const [newItem, setNewItem] = useState('');
  const [showCheckedItems, setShowCheckedItems] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<string[]>([]);

  // Detect if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // 768px is Tailwind's md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Load stores
    const { data: storesData, error: storesError } = await supabase
      .from('stores')
      .select('name')
      .order('name');
    
    if (storesError) {
      console.error('Error loading stores:', storesError);
    }
    
    if (storesData) {
      setStores(storesData.map(s => s.name));
    }

    // Load all items and favorites
    const { data: itemsData, error: itemsError } = await supabase
      .from('items')
      .select('name, is_favorite')
      .eq('user_id', SHARED_USER_ID)
      .order('name');
    
    if (itemsError) {
      console.error('Error loading items:', itemsError);
    }
    
    if (itemsData) {
      setItems(itemsData.map(i => i.name));
      const favs = itemsData.filter(i => i.is_favorite === true).map(i => i.name);
      setFavorites(favs);
    }

    // Load shopping list
    const { data: listData, error: listError } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('user_id', SHARED_USER_ID);
    
    if (listError) {
      console.error('Error loading shopping list:', listError);
    }
    
    if (listData) {
      setListItems(listData);
    }

    // Load latest prices
    const { data: pricesData, error: pricesError } = await supabase
      .from('price_history')
      .select('*')
      .eq('user_id', SHARED_USER_ID)
      .order('recorded_date', { ascending: false });
    
    if (pricesError) {
      console.error('Error loading prices:', pricesError);
    }
    
    if (pricesData) {
      const pricesObj: {[key: string]: {price: string, date: string}} = {};
      const latestPrices: {[key: string]: any} = {};
      
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
    }
  };

  const handleInputChange = (value: string) => {
    setNewItem(value);
    
    if (value.trim()) {
      // Filter items that aren't already in the list and match the search
      const availableItems = items.filter(item => 
        !listItems.find(li => li.item_name === item) &&
        item.toLowerCase().includes(value.toLowerCase())
      );
      setAutocompleteItems(availableItems);
      setShowAutocomplete(availableItems.length > 0);
    } else {
      setAutocompleteItems([]);
      setShowAutocomplete(false);
    }
  };

  const selectItem = (itemName: string) => {
    setNewItem(itemName);
    setShowAutocomplete(false);
    setAutocompleteItems([]);
  };

  const addNewItem = async () => {
    if (!newItem.trim()) return;
    
    const itemName = newItem.trim();
    
    try {
      // Check if item already exists
      if (!items.find(i => i === itemName)) {
        // Create new item
        const { error: itemError } = await supabase
          .from('items')
          .insert({ 
            name: itemName, 
            user_id: SHARED_USER_ID,
            is_favorite: false
          });
        
        if (itemError) {
          throw new Error(`Failed to create item: ${itemError.message}`);
        }
      }
      
      // Add to shopping list (whether it's a new item or existing)
      const alreadyInList = listItems.find(li => li.item_name === itemName);
      if (!alreadyInList) {
        const { error: listError } = await supabase
          .from('shopping_list')
          .insert({
            item_name: itemName,
            quantity: 1,
            user_id: SHARED_USER_ID,
            checked: false,
            added_at: new Date().toISOString()
          });
        
        if (listError) {
          throw new Error(`Failed to add to shopping list: ${listError.message}`);
        }
      }
      
      setNewItem('');
      setShowAutocomplete(false);
      setAutocompleteItems([]);
      
      // Reload data to refresh everything
      loadData();
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item. Check your connection and try again.');
    }
  };

  const addFavorites = async () => {
    try {
      for (const item of favorites) {
        // Check if already in list
        if (listItems.find(li => li.item_name === item)) continue;
        
        const { error } = await supabase
          .from('shopping_list')
          .insert({
            item_name: item,
            quantity: 1,
            user_id: SHARED_USER_ID,
            checked: false,
            added_at: new Date().toISOString()
          });
        
        if (error) {
          throw new Error(`Failed to add ${item}: ${error.message}`);
        }
      }
      
      loadData();
    } catch (error) {
      console.error('Error adding favorites:', error);
      alert('Failed to add favorites. Check your connection and try again.');
    }
  };

  const toggleItem = async (itemName: string) => {
    const isInList = listItems.find(li => li.item_name === itemName);
    
    try {
      if (isInList) {
        // Remove from list
        const { error } = await supabase
          .from('shopping_list')
          .delete()
          .eq('id', isInList.id)
          .eq('user_id', SHARED_USER_ID);
        
        if (error) {
          throw new Error(`Failed to remove item: ${error.message}`);
        }
      } else {
        // Add to list
        const { error } = await supabase
          .from('shopping_list')
          .insert({
            item_name: itemName,
            quantity: 1,
            user_id: SHARED_USER_ID,
            checked: false,
            added_at: new Date().toISOString()
          });
        
        if (error) {
          throw new Error(`Failed to add item: ${error.message}`);
        }
      }
      
      loadData();
    } catch (error) {
      console.error('Error toggling item:', error);
      alert('Failed to update list. Check your connection and try again.');
    }
  };

  const updateQuantity = async (id: string, quantity: number) => {
    if (quantity < 1) return;
    
    try {
      const { error } = await supabase
        .from('shopping_list')
        .update({ quantity })
        .eq('id', id)
        .eq('user_id', SHARED_USER_ID);
      
      if (error) {
        throw new Error(`Failed to update quantity: ${error.message}`);
      }
      
      // Only update local state if database succeeded
      setListItems(listItems.map(item => 
        item.id === id ? {...item, quantity} : item
      ));
    } catch (error) {
      console.error('Error updating quantity:', error);
      alert('Failed to update quantity. Check your connection and try again.');
    }
  };

  const toggleChecked = async (id: string) => {
    const item = listItems.find(li => li.id === id);
    if (!item) return;
    
    try {
      const { error } = await supabase
        .from('shopping_list')
        .update({ checked: !item.checked })
        .eq('id', id)
        .eq('user_id', SHARED_USER_ID);
      
      if (error) {
        throw new Error(`Failed to check item: ${error.message}`);
      }
      
      // Only update local state if database succeeded
      setListItems(listItems.map(li => 
        li.id === id ? {...li, checked: !li.checked} : li
      ));
    } catch (error) {
      console.error('Error checking item:', error);
      alert('Failed to check item. Check your connection and try again.');
    }
  };

  const removeItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('shopping_list')
        .delete()
        .eq('id', id)
        .eq('user_id', SHARED_USER_ID);
      
      if (error) {
        throw new Error(`Failed to remove item: ${error.message}`);
      }
      
      // Only update local state if database succeeded
      setListItems(listItems.filter(li => li.id !== id));
    } catch (error) {
      console.error('Error removing item:', error);
      alert('Failed to remove item. Check your connection and try again.');
    }
  };

  const clearList = async () => {
    if (!confirm('Clear entire shopping list?')) return;
    
    try {
      const { error } = await supabase
        .from('shopping_list')
        .delete()
        .eq('user_id', SHARED_USER_ID);
      
      if (error) {
        throw new Error(`Failed to clear list: ${error.message}`);
      }
      
      // Only update local state if database succeeded
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
    const percentAboveMin = ((currentPrice - minPrice) / minPrice) * 100;
    const percentInt = Math.round(percentAboveMin);

    // Best price
    if (currentPrice === minPrice) {
      return { 
        label: 'Best Price', 
        mobileLabel: 'Best Price',
        emoji: '✅', 
        color: 'text-green-600' 
      };
    }
    
    // 1-10% above minimum = "Close Enough"
    if (percentAboveMin <= 10) {
      return { 
        label: `Close Enough (${percentInt}% more)`, 
        mobileLabel: `Close Enough (${percentInt}% more)`,
        emoji: '➖', 
        color: 'text-yellow-600'
      };
    }
    
    // More than 10% above minimum = "Skip"
    return { 
      label: `Skip This One (${percentInt}% more)`, 
      mobileLabel: `Skip (${percentInt}% more)`,
      emoji: '❌', 
      color: 'text-red-600'
    };
  };

  // Calculate best store with coverage-first sorting
  const calculateBestStore = () => {
    const storeData: {[store: string]: {total: number, coverage: number, itemCount: number}} = {};
    
    stores.forEach(store => {
      let total = 0;
      let coverage = 0;
      
      listItems.forEach(item => {
        const priceData = prices[`${store}-${item.item_name}`];
        if (priceData) {
          const price = parseFloat(priceData.price);
          total += price * item.quantity;
          coverage++;
        }
      });
      
      storeData[store] = {
        total,
        coverage,
        itemCount: listItems.length
      };
    });

    return storeData;
  };

  const storeData = calculateBestStore();
  const sortedStores = Object.entries(storeData)
    .filter(([, data]) => data.coverage > 0)
    .sort(([, a], [, b]) => {
      // Primary sort: coverage (descending)
      if (b.coverage !== a.coverage) {
        return b.coverage - a.coverage;
      }
      // Secondary sort: price (ascending)
      return a.total - b.total;
    });

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const filteredItems = filterLetter === 'All' 
    ? items.sort() 
    : items.sort().filter(item => item.toUpperCase().startsWith(filterLetter));
  
  const filteredFavorites = filterLetter === 'All'
    ? favorites
    : favorites.filter(item => item.toUpperCase().startsWith(filterLetter));

  const allFavoritesSelected = favorites.length > 0 && favorites.every(fav => 
    listItems.find(li => li.item_name === fav)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* White Header Box */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          {/* Desktop: Title/Subtitle on left, Nav on right */}
          <div className="hidden md:flex justify-between items-start">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-gray-800">Shopping List</h1>
              <p className="text-xs md:text-sm text-gray-600 mt-2">Plan your shopping trip and save money</p>
            </div>
            <Header currentPage="Shopping List" />
          </div>
          
          {/* Mobile: Just Header Nav */}
          <div className="md:hidden">
            <Header currentPage="Shopping List" />
          </div>
        </div>

        {/* Alphabet Filter - Hidden on Mobile */}
        <div className="hidden md:block bg-white rounded-lg shadow-lg p-3 md:p-4 mb-4 md:mb-6">
          <div className="flex flex-wrap gap-1.5 md:gap-2 justify-center">
            <button
              onClick={() => setFilterLetter('All')}
              className={`px-2.5 py-1.5 md:px-3 md:py-1 rounded text-sm md:text-base font-semibold cursor-pointer transition ${
                filterLetter === 'All'
                  ? 'bg-blue-600 text-white'
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
                onClick={() => setFilterLetter(letter)}
                className={`px-2.5 py-1.5 md:px-3 md:py-1 rounded text-sm md:text-base font-semibold cursor-pointer transition ${
                  filterLetter === letter
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>

        {/* Favorites Widget - Hidden on Mobile */}
        {filteredFavorites.length > 0 && (
          <div className="hidden md:block bg-white rounded-lg shadow-lg p-4 md:p-6 mb-4 md:mb-6">
            <div className="flex justify-between items-center mb-3">
              <button
                onClick={() => setShowFavorites(!showFavorites)}
                className="flex items-center gap-2 text-lg md:text-xl font-bold text-gray-800 cursor-pointer hover:text-blue-600 transition"
              >
                <span className="text-gray-400">{showFavorites ? '▼' : '▶'}</span>
                <span>⭐ Select Favorites</span>
              </button>
              <button
                onClick={allFavoritesSelected ? () => {
                  favorites.forEach(fav => {
                    const item = listItems.find(li => li.item_name === fav);
                    if (item) toggleItem(fav);
                  });
                } : addFavorites}
                className="text-sm bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer"
              >
                {allFavoritesSelected ? 'Deselect All' : 'Add All'}
              </button>
            </div>
            {showFavorites && (
              <div className="flex flex-wrap gap-2">
                {filteredFavorites.map(item => {
                  const isInList = listItems.find(li => li.item_name === item);
                  return (
                    <button
                      key={item}
                      onClick={() => toggleItem(item)}
                      className={`px-3 py-1.5 rounded-lg border-2 transition cursor-pointer text-sm font-semibold ${
                        isInList
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-yellow-400 hover:border-yellow-500 bg-white text-gray-700 hover:bg-yellow-50'
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Add Items Section - Hidden on Mobile */}
        <div className="hidden md:block bg-white rounded-lg shadow-lg p-4 md:p-6 mb-6">
          <button
            onClick={() => setShowAddItems(!showAddItems)}
            className="flex items-center gap-2 text-xl font-bold mb-4 text-gray-800 cursor-pointer hover:text-blue-600 transition"
          >
            <span className="text-gray-400">{showAddItems ? '▼' : '▶'}</span>
            <span>Select Items</span>
          </button>
          {showAddItems && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 overflow-y-auto" style={{ maxHeight: '252px' }}>
              {filteredItems.map(item => {
                const isFavorite = favorites.includes(item);
                const isInList = listItems.find(li => li.item_name === item);
                return (
                  <button
                    key={item}
                    onClick={() => toggleItem(item)}
                    className={`p-4 md:p-3 rounded-lg border-2 transition cursor-pointer font-semibold text-base ${
                      isInList
                        ? 'bg-blue-600 text-white border-blue-600'
                        : isFavorite
                        ? 'border-yellow-400 hover:border-yellow-500 bg-yellow-50 text-gray-700 hover:bg-yellow-100'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                    }`}
                  >
                    {isFavorite && !isInList && <span className="text-yellow-500 text-lg mr-1">⭐</span>}
                    {item}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Add to List Widget - Hidden on Mobile (shows below list on mobile) */}
        <div className="hidden md:block bg-white rounded-lg shadow-lg p-4 mb-6">
          <h2 className="text-xl font-bold mb-3 text-gray-800">Add to List</h2>
          <div className="relative autocomplete-container">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Select existing or add new"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
                value={newItem}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addNewItem()}
                onFocus={() => {
                  if (newItem.trim() && autocompleteItems.length > 0) {
                    setShowAutocomplete(true);
                  }
                }}
              />
              <button
                onClick={addNewItem}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 cursor-pointer transition whitespace-nowrap"
              >
                Add
              </button>
            </div>
            
            {/* Autocomplete dropdown */}
            {showAutocomplete && autocompleteItems.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {autocompleteItems.slice(0, 10).map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      selectItem(item);
                      // Auto-add on select
                      setTimeout(() => addNewItem(), 100);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-gray-800"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {newItem.trim() && !items.includes(newItem.trim()) 
              ? `"${newItem}" will be added as a new item`
              : 'Type to search existing items or add new ones'
            }
          </p>
        </div>

        {/* Shopping List */}
        {listItems.length > 0 ? (
          <>
            {/* List Items */}
            <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                  Your List ({listItems.filter(i => !i.checked).length} items)
                </h2>
                <div className="flex gap-2">
                  {/* Show/Hide Checked Items - Mobile Only */}
                  {isMobile && listItems.some(i => i.checked) && (
                    <button
                      onClick={() => setShowCheckedItems(!showCheckedItems)}
                      className="text-xs text-gray-600 hover:text-gray-800 font-semibold cursor-pointer"
                    >
                      {showCheckedItems ? 'Hide Checked' : 'Show Checked'}
                    </button>
                  )}
                  <button
                    onClick={clearList}
                    className="text-red-600 hover:text-red-800 font-semibold cursor-pointer text-sm"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              
              {/* Group items by best store */}
              {(() => {
                // Group items by which store has the best price
                const itemsByStore: {[store: string]: ListItem[]} = {};
                const itemsWithoutPrice: ListItem[] = [];
                
                // Filter items: on mobile hide checked items (unless showCheckedItems is true)
                const displayItems = isMobile && !showCheckedItems 
                  ? listItems.filter(item => !item.checked)
                  : listItems;
                
                displayItems
                  .sort((a, b) => {
                    // First sort by favorite status
                    const aIsFav = favorites.includes(a.item_name);
                    const bIsFav = favorites.includes(b.item_name);
                    if (aIsFav && !bIsFav) return -1;
                    if (!aIsFav && bIsFav) return 1;
                    // Then alphabetically
                    return a.item_name.localeCompare(b.item_name);
                  })
                  .forEach(item => {
                    // Find best price for this item
                    const itemPrices = stores.map(store => ({
                      store,
                      price: parseFloat(prices[`${store}-${item.item_name}`]?.price || '0')
                    })).filter(p => p.price > 0);
                    
                    if (itemPrices.length > 0) {
                      const bestStore = itemPrices.sort((a, b) => a.price - b.price)[0].store;
                      if (!itemsByStore[bestStore]) {
                        itemsByStore[bestStore] = [];
                      }
                      itemsByStore[bestStore].push(item);
                    } else {
                      itemsWithoutPrice.push(item);
                    }
                  });
                
                return (
                  <div className="space-y-6">
                    {Object.entries(itemsByStore).map(([store, storeItems]) => (
                      <div key={store}>
                        <h3 className="text-lg font-bold text-gray-700 mb-2 flex items-center gap-2 justify-between">
                          <div className="flex items-center gap-2">
                            <span className="bg-teal-500 text-white px-3 py-1 rounded-full text-sm">
                              {store}
                            </span>
                            <span className="text-sm text-gray-500">
                              {storeItems.length} {storeItems.length === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                          <span className="text-lg font-bold text-teal-600">
                            ${storeItems.reduce((sum, item) => {
                              const priceData = prices[`${store}-${item.item_name}`];
                              const price = priceData ? parseFloat(priceData.price) : 0;
                              return sum + (price * item.quantity);
                            }, 0).toFixed(2)}
                          </span>
                        </h3>
                        <div className="space-y-2">
                          {storeItems.map(item => {
                            const isFavorite = favorites.includes(item.item_name);
                            const priceData = prices[`${store}-${item.item_name}`];
                            const price = priceData ? parseFloat(priceData.price) : 0;
                            
                            return (
                              <div
                                key={item.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition ${
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
                                  onChange={() => toggleChecked(item.id)}
                                  className="w-5 h-5 cursor-pointer"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-1">
                                    {isFavorite && <span className="text-yellow-500 text-xl">⭐</span>}
                                    <Link 
                                      href={`/history?item=${encodeURIComponent(JSON.stringify(item.item_name))}&store=${encodeURIComponent(JSON.stringify(store))}`}
                                      className={`font-medium hover:text-teal-600 hover:underline transition ${item.checked ? 'text-gray-500 line-through' : 'text-gray-800'}`}
                                    >
                                      {item.item_name}
                                    </Link>
                                  </div>
                                  {priceData && (
                                    <p className="text-xs text-green-600 mt-0.5">
                                      ${price.toFixed(2)} {item.quantity > 1 && `× ${item.quantity} = $${(price * item.quantity).toFixed(2)}`}
                                    </p>
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
                                  onClick={() => removeItem(item.id)}
                                  className="text-gray-300 hover:text-gray-500 cursor-pointer text-xl ml-2"
                                  title="Remove from list"
                                >
                                  ✖️
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    
                    {/* Items without price data */}
                    {itemsWithoutPrice.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-gray-700 mb-2 flex items-center gap-2 justify-between">
                          <div className="flex items-center gap-2">
                            <span className="bg-gray-400 text-white px-3 py-1 rounded-full text-sm">
                              No Price Data
                            </span>
                            <span className="text-sm text-gray-500">
                              {itemsWithoutPrice.length} {itemsWithoutPrice.length === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                          <span className="text-lg font-bold text-red-600">
                            To Be Calculated
                          </span>
                        </h3>
                        <div className="space-y-2">
                          {itemsWithoutPrice.map(item => {
                            const isFavorite = favorites.includes(item.item_name);
                            
                            return (
                              <div
                                key={item.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition ${
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
                                  onChange={() => toggleChecked(item.id)}
                                  className="w-5 h-5 cursor-pointer"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-1">
                                    {isFavorite && <span className="text-yellow-500 text-xl">⭐</span>}
                                    <Link 
                                      href={`/history?item=${encodeURIComponent(JSON.stringify(item.item_name))}`}
                                      className={`font-medium hover:text-teal-600 hover:underline transition ${item.checked ? 'text-gray-500 line-through' : 'text-gray-800'}`}
                                    >
                                      {item.item_name}
                                    </Link>
                                  </div>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    No price data available
                                  </p>
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
                                  onClick={() => removeItem(item.id)}
                                  className="text-gray-300 hover:text-gray-500 cursor-pointer text-xl ml-2"
                                  title="Remove from list"
                                >
                                  ✖️
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              
              {/* Total */}
              <div className="mt-6 pt-4 border-t-2 border-gray-300">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-gray-800">Total</span>
                  <span className="text-2xl font-bold text-teal-600">
                    ${listItems.reduce((sum, item) => {
                      // Find best price for this item across all stores
                      const itemPrices = stores.map(store => {
                        const priceData = prices[`${store}-${item.item_name}`];
                        return priceData ? parseFloat(priceData.price) : 0;
                      }).filter(p => p > 0);
                      
                      const bestPrice = itemPrices.length > 0 ? Math.min(...itemPrices) : 0;
                      return sum + (bestPrice * item.quantity);
                    }, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Add to List Widget - Mobile Only, shown below list */}
            <div className="md:hidden bg-white rounded-lg shadow-lg p-4 mt-6">
              <h2 className="text-xl font-bold mb-3 text-gray-800">Add to List</h2>
              <div className="relative autocomplete-container">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Select existing or add new"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
                    value={newItem}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addNewItem()}
                    onFocus={() => {
                      if (newItem.trim() && autocompleteItems.length > 0) {
                        setShowAutocomplete(true);
                      }
                    }}
                  />
                  <button
                    onClick={addNewItem}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 cursor-pointer transition whitespace-nowrap"
                  >
                    Add
                  </button>
                </div>
                
                {/* Autocomplete dropdown */}
                {showAutocomplete && autocompleteItems.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {autocompleteItems.slice(0, 10).map((item) => (
                      <button
                        key={item}
                        onClick={() => {
                          selectItem(item);
                          // Auto-add on select
                          setTimeout(() => addNewItem(), 100);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-gray-800"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {newItem.trim() && !items.includes(newItem.trim()) 
                  ? `"${newItem}" will be added as a new item`
                  : ''
                }
              </p>
            </div>

            {/* Best Store Recommendation - Desktop Only */}
            {sortedStores.length > 0 && (
              <div className="hidden md:block bg-white rounded-lg shadow-lg p-4 md:p-6">
                <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">Best Single Store</h2>
                <div className="space-y-3">
                  {sortedStores.map(([store, data], idx) => {
                    const coveragePercent = ((data.coverage / data.itemCount) * 100).toFixed(0);
                    const isComplete = data.coverage === data.itemCount;
                    
                    return (
                      <div
                        key={store}
                        className={`p-4 rounded-lg border-2 ${
                          idx === 0
                            ? 'bg-green-50 border-green-500'
                            : 'bg-gray-50 border-gray-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xl text-gray-800">{store}</span>
                              {idx === 0 && (
                                <span className="text-sm bg-green-500 text-white px-3 py-1 rounded-full">
                                  Best Deal!
                                </span>
                              )}
                            </div>
                            {listItems.length > 1 && (
                              <p className={`text-xs md:text-sm mt-1 flex items-center gap-1 ${
                                isComplete ? 'text-green-600' : 'text-orange-600'
                              }`}>
                                <span>
                                  {data.coverage}/{data.itemCount} items ({coveragePercent}% coverage)
                                  {!isComplete && ' ⚠️'}
                                </span>
                                {isComplete && listItems.length > 1 && (
                                  <span className="text-sm bg-blue-500 text-white px-2 py-1 rounded-full">
                                    ✓
                                  </span>
                                )}
                              </p>
                            )}
                            {listItems.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {listItems.map(item => {
                                  const priceData = prices[`${store}-${item.item_name}`];
                                  if (priceData) {
                                    const price = parseFloat(priceData.price);
                                    const classification = getPriceClassification(item.item_name, price);
                                    return (
                                      <p key={item.id} className="text-xs text-gray-600">
                                        {item.item_name}: ${price.toFixed(2)} 
                                        {item.quantity > 1 && ` × ${item.quantity}`}
                                        <span className="text-gray-400 ml-1">({getDaysAgo(priceData.date)})</span>
                                        {classification && (
                                          <span className={`ml-1 font-semibold ${classification.color}`}>
                                            {classification.emoji} {classification.label}
                                          </span>
                                        )}
                                      </p>
                                    );
                                  } else {
                                    return (
                                      <p key={item.id} className="text-xs text-gray-400">
                                        {item.item_name}: no price
                                      </p>
                                    );
                                  }
                                })}
                              </div>
                            )}
                          </div>
                          <span className="text-2xl font-bold text-gray-800">${data.total.toFixed(2)}</span>
                        </div>
                        {idx === 0 && sortedStores.length > 1 && sortedStores[0][1].coverage === sortedStores[1][1].coverage && (
                          <p className="text-sm text-green-700 mt-2">
                            Save ${(sortedStores[1][1].total - data.total).toFixed(2)} vs {sortedStores[1][0]}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8 md:p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">Your shopping list is empty</p>
            {favorites.length > 0 && (
              <button
                onClick={addFavorites}
                className="hidden md:inline-flex bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-lg font-semibold transition cursor-pointer items-center gap-2"
              >
                <span className="text-xl">⭐</span>
                Add Favorites to Get Started
              </button>
            )}
            
            {/* Add to List when list is empty - Always visible */}
            <div className="bg-white rounded-lg shadow-lg p-4 mt-6 max-w-md mx-auto">
              <h2 className="text-xl font-bold mb-3 text-gray-800">Add to List</h2>
              <div className="relative autocomplete-container">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Select or type new item..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
                    value={newItem}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addNewItem()}
                    onFocus={() => {
                      if (newItem.trim() && autocompleteItems.length > 0) {
                        setShowAutocomplete(true);
                      }
                    }}
                  />
                  <button
                    onClick={addNewItem}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 cursor-pointer transition whitespace-nowrap"
                  >
                    Add
                  </button>
                </div>
                
                {/* Autocomplete dropdown */}
                {showAutocomplete && autocompleteItems.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {autocompleteItems.slice(0, 10).map((item) => (
                      <button
                        key={item}
                        onClick={() => {
                          selectItem(item);
                          // Auto-add on select
                          setTimeout(() => addNewItem(), 100);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-gray-800"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {newItem.trim() && !items.includes(newItem.trim()) 
                  ? `"${newItem}" will be added as a new item`
                  : ''
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}