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
  const [searchTerm, setSearchTerm] = useState('');

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

  const addItem = async (itemName: string) => {
    // Check if already in list
    if (listItems.find(li => li.item_name === itemName)) {
      alert('Item already in list');
      return;
    }

    await supabase
      .from('shopping_list')
      .insert({
        item_name: itemName,
        quantity: 1,
        user_id: SHARED_USER_ID,
        checked: false,
        added_at: new Date().toISOString()
      });
    
    setSearchTerm('');
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

  const filteredItems = items.filter(item => 
    item.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !listItems.find(li => li.item_name === item)
  ).sort((a, b) => {
    // Favorites first
    const aIsFav = favorites.includes(a);
    const bIsFav = favorites.includes(b);
    if (aIsFav && !bIsFav) return -1;
    if (!aIsFav && bIsFav) return 1;
    // Then alphabetically
    return a.localeCompare(b);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* White Header Box */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="hidden md:block text-2xl md:text-4xl font-bold text-gray-800">Shopping List</h1>
              <p className="hidden md:block text-xs md:text-sm text-gray-600 mt-2">Plan your shopping trip and save money</p>
            </div>
            <Header currentPage="List" />
          </div>
        </div>

        {/* Add Items Section */}
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Add Items</h2>
          
          {/* Add All Favorites Button */}
          {favorites.length > 0 && favorites.some(fav => !listItems.find(li => li.item_name === fav)) && (
            <button
              onClick={addFavorites}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-3 rounded-lg font-semibold transition cursor-pointer mb-4 flex items-center justify-center gap-2"
            >
              <span className="text-xl">⭐</span>
              Add All Favorites ({favorites.filter(fav => !listItems.find(li => li.item_name === fav)).length} items)
            </button>
          )}

          {/* Search and Add Individual Items */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setSearchTerm(searchTerm || ' ')}
              onBlur={() => {
                setTimeout(() => {
                  if (searchTerm === ' ') setSearchTerm('');
                }, 200);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
            />
            {searchTerm && filteredItems.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredItems.slice(0, 10).map(item => {
                  const isFavorite = favorites.includes(item);
                  return (
                    <button
                      key={item}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addItem(item);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-100 transition text-gray-800 border-b last:border-b-0 flex items-center gap-2"
                    >
                      {isFavorite && <span className="text-yellow-500 text-lg">⭐</span>}
                      {item}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
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
                <button
                  onClick={clearList}
                  className="text-red-600 hover:text-red-800 font-semibold cursor-pointer text-sm"
                >
                  Clear All
                </button>
              </div>
              
              {/* Group items by best store */}
              {(() => {
                // Group items by which store has the best price
                const itemsByStore: {[store: string]: ListItem[]} = {};
                const itemsWithoutPrice: ListItem[] = [];
                
                listItems
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

            {/* Best Store Recommendation */}
            {sortedStores.length > 0 && (
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
            {favorites.length > 0 && (
              <button
                onClick={addFavorites}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-lg font-semibold transition cursor-pointer inline-flex items-center gap-2"
              >
                <span className="text-xl">⭐</span>
                Add Favorites to Get Started
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}