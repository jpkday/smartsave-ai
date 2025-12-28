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
  const [storeMode, setStoreMode] = useState(false);
  const [showCheckedItems, setShowCheckedItems] = useState(false);

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
      .order('name');
    
    if (itemsError) {
      console.error('Error loading items:', itemsError);
    }
    
    if (itemsData) {
      setItems(itemsData.map(i => i.name));
      const favs = itemsData.filter(i => i.is_favorite === true).map(i => i.name);
      console.log('Loaded favorites:', favs);
      setFavorites(favs);
    }

    // Load shopping list
    const { data: listData, error: listError } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('user_id', SHARED_USER_ID);
    
    if (listError) {
      console.error('Error loading shopping list:', listError);
      alert(`Shopping List Error: ${listError.message} - ${JSON.stringify(listError)}`);
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

  const addNewItem = async () => {
    if (!newItem.trim()) return;
    
    const itemName = newItem.trim();
    
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
        console.error('Error adding item:', itemError);
        alert('Failed to add item');
        return;
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
        console.error('Error adding to shopping list:', listError);
        alert('Failed to add to shopping list');
        return;
      }
    }
    
    setNewItem('');
    
    // Reload data to refresh everything
    loadData();
  };

  const addFavorites = async () => {
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
        console.error('Error adding favorite:', item, error);
        alert(`Error adding ${item}: ${error.message}`);
        return;
      }
    }
    
    loadData();
  };

  const toggleItem = async (itemName: string) => {
    const isInList = listItems.find(li => li.item_name === itemName);
    
    if (isInList) {
      // Remove from list
      await supabase
        .from('shopping_list')
        .delete()
        .eq('id', isInList.id);
    } else {
      // Add to list
      await supabase
        .from('shopping_list')
        .insert({
          item_name: itemName,
          quantity: 1,
          user_id: SHARED_USER_ID,
          checked: false,
          added_at: new Date().toISOString()
        });
    }
    
    loadData();
  };

  const updateQuantity = async (id: string, quantity: number) => {
    if (quantity < 1) return;
    
    await supabase
      .from('shopping_list')
      .update({ quantity })
      .eq('id', id);
    
    setListItems(listItems.map(item => 
      item.id === id ? {...item, quantity} : item
    ));
  };

  const toggleChecked = async (id: string) => {
    const item = listItems.find(li => li.id === id);
    if (!item) return;
    
    await supabase
      .from('shopping_list')
      .update({ checked: !item.checked })
      .eq('id', id);
    
    setListItems(listItems.map(li => 
      li.id === id ? {...li, checked: !li.checked} : li
    ));
  };

  const removeItem = async (id: string) => {
    await supabase
      .from('shopping_list')
      .delete()
      .eq('id', id);
    
    setListItems(listItems.filter(li => li.id !== id));
  };

  const clearList = async () => {
    if (!confirm('Clear entire shopping list?')) return;
    
    await supabase
      .from('shopping_list')
      .delete()
      .eq('user_id', SHARED_USER_ID);
    
    setListItems([]);
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
    const maxPrice = Math.max(...itemPrices);
    const range = maxPrice - minPrice;

    // If all prices are the same, it's neutral
    if (range === 0) return null;

    const threshold = range * 0.33;

    if (currentPrice <= minPrice + threshold) {
      return { 
        label: 'Best Price!', 
        mobileLabel: 'Best Price!',
        emoji: '✅', 
        color: 'text-green-600' 
      };
    } else if (currentPrice >= maxPrice - threshold) {
      return { 
        label: 'Skip This One', 
        mobileLabel: 'Skip',
        emoji: '❌', 
        color: 'text-red-600' 
      };
    } else {
      return { 
        label: 'Close Enough', 
        mobileLabel: 'Close Enough',
        emoji: '➖', 
        color: 'text-yellow-600' 
      };
    }
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
          
          {/* Mobile: Header Nav and Store Mode Toggle on same row */}
          <div className="md:hidden flex items-center gap-3">
            <button
              onClick={() => setStoreMode(!storeMode)}
              className={`px-4 py-3 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
                storeMode
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {storeMode ? '🛒 Store Mode ON' : '📝 Store Mode OFF'}
            </button>
            <div className="flex-1">
              <Header currentPage="Shopping List" />
            </div>
          </div>
        </div>

        {/* Alphabet Filter - Hidden in Store Mode on Mobile */}
        {!storeMode && (
          <div className="bg-white rounded-lg shadow-lg p-3 md:p-4 mb-4 md:mb-6">
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
        )}

        {/* Favorites Widget - Hidden in Store Mode on Mobile */}
        {!storeMode && filteredFavorites.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 mb-4 md:mb-6">
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

        {/* Add Items Section - Hidden in Store Mode on Mobile */}
        {!storeMode && (
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 mb-6">
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
        )}

        {/* Add New Item Widget - Position based on Store Mode */}
        {!storeMode && (
        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <h2 className="text-xl font-bold mb-3 text-gray-800">Add New Item</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g., Organic bananas"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addNewItem()}
            />
            <button
              onClick={addNewItem}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 cursor-pointer transition whitespace-nowrap"
            >
              Add
            </button>
          </div>
        </div>
        )}

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
                  {/* Show/Hide Checked Items (Store Mode Only on Mobile) */}
                  {storeMode && listItems.some(i => i.checked) && (
                    <button
                      onClick={() => setShowCheckedItems(!showCheckedItems)}
                      className="text-xs md:text-sm text-gray-600 hover:text-gray-800 font-semibold cursor-pointer md:hidden"
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
                
                // Filter items based on store mode
                const displayItems = storeMode && !showCheckedItems 
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
                                      href={`/history?item=${encodeURIComponent(item.item_name)}&store=${encodeURIComponent(store)}`}
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
                                      href={`/history?item=${encodeURIComponent(item.item_name)}`}
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

            {/* Add New Item Widget - In Store Mode, show below list */}
            {storeMode && (
              <div className="bg-white rounded-lg shadow-lg p-4 mt-6">
                <h2 className="text-xl font-bold mb-3 text-gray-800">Add New Item</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., Organic bananas"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addNewItem()}
                  />
                  <button
                    onClick={addNewItem}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 cursor-pointer transition whitespace-nowrap"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {/* Best Store Recommendation - Hidden in Store Mode on Mobile */}
            {!storeMode && sortedStores.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
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
                            <p className={`text-xs md:text-sm mt-1 flex items-center gap-1 ${
                              isComplete ? 'text-green-600' : 'text-orange-600'
                            }`}>
                              <span>
                                {data.coverage}/{data.itemCount} items ({coveragePercent}% coverage)
                                {!isComplete && ' ⚠️'}
                              </span>
                              {isComplete && (
                                <span className="text-sm bg-blue-500 text-white px-2 py-1 rounded-full">
                                  ✓
                                </span>
                              )}
                            </p>
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
            {favorites.length > 0 && !storeMode && (
              <button
                onClick={addFavorites}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-lg font-semibold transition cursor-pointer inline-flex items-center gap-2"
              >
                <span className="text-xl">⭐</span>
                Add Favorites to Get Started
              </button>
            )}
            
            {/* Add New Item in Store Mode when list is empty */}
            {storeMode && (
              <div className="bg-white rounded-lg shadow-lg p-4 mt-6 max-w-md mx-auto">
                <h2 className="text-xl font-bold mb-3 text-gray-800">Add New Item</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., Organic bananas"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addNewItem()}
                  />
                  <button
                    onClick={addNewItem}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 cursor-pointer transition whitespace-nowrap"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}