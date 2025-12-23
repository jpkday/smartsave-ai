'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';

const STORES = ['Acme', 'Giant', 'Walmart', 'Costco', 'Aldi'];
// TODO: Replace with actual user_id from auth system
// Currently all users share data (single household mode)
const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

export default function Prices() {
  const [prices, setPrices] = useState<{[key: string]: string}>({});
  const [lastSaved, setLastSaved] = useState<string>('');
  const [items, setItems] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [selectedStore, setSelectedStore] = useState<string>(STORES[0]); // For mobile view
  const [selectedItemFilter, setSelectedItemFilter] = useState<string>('All'); // For item filtering

  // Load items and prices when page loads
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Load items
    const { data: itemsData } = await supabase
      .from('items')
      .select('name')
      .order('name');
    
    if (itemsData) {
      setItems(itemsData.map(i => i.name));
    }

    // Load prices
    const { data: pricesData } = await supabase
      .from('prices')
      .select('*')
      .eq('user_id', SHARED_USER_ID);
    
    if (pricesData) {
      const pricesObj: {[key: string]: string} = {};
      pricesData.forEach(p => {
        pricesObj[`${p.store}-${p.item_name}`] = parseFloat(p.price).toFixed(2);
      });
      setPrices(pricesObj);

      // Get most recent update time
      if (pricesData.length > 0) {
        const latest = pricesData.reduce((a, b) => 
          new Date(a.updated_at) > new Date(b.updated_at) ? a : b
        );
        setLastSaved(new Date(latest.updated_at).toLocaleString());
      }
    }
  };

  const handlePriceChange = async (store: string, item: string, value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    let priceValue = '';
    if (digits !== '') {
      // Convert to cents, then to dollars
      const cents = parseInt(digits, 10);
      priceValue = (cents / 100).toFixed(2);
    }
    
    // Update local state immediately
    setPrices({...prices, [`${store}-${item}`]: priceValue});

    // Save to database
    if (priceValue === '') {
      // Delete if empty
      await supabase
        .from('prices')
        .delete()
        .eq('item_name', item)
        .eq('store', store)
        .eq('user_id', SHARED_USER_ID);
    } else {
      // Upsert (insert or update)
      await supabase
        .from('prices')
        .upsert({
          item_name: item,
          store: store,
          price: priceValue,
          user_id: SHARED_USER_ID,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'item_name,store,user_id'
        });
    }

    // Update last saved time
    const now = new Date().toLocaleString();
    setLastSaved(now);
  };

  const getPriceColor = (store: string, item: string) => {
    const price = prices[`${store}-${item}`];
    const numPrice = parseFloat(price || '0');
    return numPrice > 0 ? 'text-gray-800' : 'text-gray-200';
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
      alert('An item with this name already exists');
      return;
    }

    // Update in database
    const { error: itemError } = await supabase
      .from('items')
      .update({ name: editingValue.trim() })
      .eq('name', oldItem);
    
    if (itemError) {
      console.error('Error updating item:', itemError);
      alert('Failed to update item');
      return;
    }

    // Update prices with new item name
    await supabase
      .from('prices')
      .update({ item_name: editingValue.trim() })
      .eq('item_name', oldItem);

    // Update local state
    const updatedItems = items.map(i => i === oldItem ? editingValue.trim() : i);
    setItems(updatedItems);
  
    const updatedPrices: {[key: string]: string} = {};
    Object.keys(prices).forEach(key => {
      if (key.includes(oldItem)) {
        const newKey = key.replace(oldItem, editingValue.trim());
        updatedPrices[newKey] = prices[key];
      } else {
        updatedPrices[key] = prices[key];
      }
    });
    setPrices(updatedPrices);
  
    cancelEdit();
  };
  
  const deleteItem = async (itemToDelete: string) => {
    if (!confirm(`Delete "${itemToDelete}"? This will remove all price data for this item.`)) {
      return;
    }

    // Delete from database
    const { error: itemError } = await supabase
      .from('items')
      .delete()
      .eq('name', itemToDelete);
    
    if (itemError) {
      console.error('Error deleting item:', itemError);
      alert('Failed to delete item');
      return;
    }

    // Delete all prices for this item
    await supabase
      .from('prices')
      .delete()
      .eq('item_name', itemToDelete);

    // Update local state
    const updatedItems = items.filter(i => i !== itemToDelete);
    setItems(updatedItems);
  
    const updatedPrices: {[key: string]: string} = {};
    Object.keys(prices).forEach(key => {
      if (!key.includes(itemToDelete)) {
        updatedPrices[key] = prices[key];
      }
    });
    setPrices(updatedPrices);
  };

  const getCellColor = (store: string, item: string) => {
    const currentPrice = parseFloat(prices[`${store}-${item}`] || '0');
    
    if (currentPrice === 0) return 'bg-white';
    
    // Get all prices for this item across all stores
    const itemPrices = STORES.map(s => parseFloat(prices[`${s}-${item}`] || '0')).filter(p => p > 0);
    
    if (itemPrices.length === 0) return 'bg-white';
    
    // If only one price exists, make it green
    if (itemPrices.length === 1) return 'bg-green-100';
    
    const minPrice = Math.min(...itemPrices);
    const maxPrice = Math.max(...itemPrices);
    
    if (currentPrice === minPrice && minPrice !== maxPrice) return 'bg-green-100';
    if (currentPrice === maxPrice && minPrice !== maxPrice) return 'bg-red-100';
    
    return 'bg-white';
  };

  const sortedItems = items.sort().sort((a, b) => {
    // Check if items have any prices
    const aHasPrices = STORES.some(store => parseFloat(prices[`${store}-${a}`] || '0') > 0);
    const bHasPrices = STORES.some(store => parseFloat(prices[`${store}-${b}`] || '0') > 0);
    
    // Items with prices come first
    if (aHasPrices && !bHasPrices) return -1;
    if (!aHasPrices && bHasPrices) return 1;
    
    // Within each group, sort alphabetically
    return 0;
  });

  // Filter items based on selected item filter and whether they have any prices
  const filteredItems = sortedItems.filter(item => {
    // For mobile: check if item has price for the selected store
    const mobileHasPrice = parseFloat(prices[`${selectedStore}-${item}`] || '0') > 0;
    
    // For desktop: check if item has any prices entered (excluding 0.00)
    const hasAnyPrice = STORES.some(store => {
      const price = parseFloat(prices[`${store}-${item}`] || '0');
      return price > 0;
    });
    
    // On mobile (when selectedStore is used), filter by selected store's prices
    // On desktop, filter by any store having prices
    const shouldShow = window.innerWidth < 768 ? mobileHasPrice : hasAnyPrice;
    
    // If no valid prices, hide the item
    if (!shouldShow) return false;
    
    // Apply item filter
    if (selectedItemFilter === 'All') return true;
    return item === selectedItemFilter;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* White Header Box */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="hidden md:block text-2xl md:text-4xl font-bold text-gray-800">Prices by Store</h1>
              {lastSaved && (
                <p className="hidden md:block text-xs md:text-sm text-gray-600 mt-2">Last updated: {lastSaved}</p>
              )}
            </div>
            <Header currentPage="Prices" />
          </div>
        </div>

        {/* Mobile Store Selector */}
        <div className="md:hidden mb-4 bg-white rounded-lg shadow-lg p-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Select Store:</label>
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold bg-white mb-4"
          >
            {STORES.sort().map(store => (
            <option key={store} value={store}>{store}</option>
            ))}
          </select>
          
          <label className="block text-sm font-semibold text-gray-700 mb-2">Filter Item:</label>
          <select
            value={selectedItemFilter}
            onChange={(e) => setSelectedItemFilter(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold bg-white"
          >
            <option value="All">All Items</option>
            {sortedItems.map(item => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        {/* Mobile View - Single Store */}
        <div className="md:hidden bg-white rounded-lg shadow-lg">
          <div className="divide-y">
            {filteredItems.map((item, idx) => (
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
                <div className="flex items-center p-3 rounded-lg bg-white">
                  <span className="text-gray-800 font-bold text-lg mr-2">$</span>
                  <input
                    type="text"
                    placeholder="0.00"
                    style={{ MozAppearance: 'textfield' }}
                    className={`flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg text-right font-bold text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:text-gray-800 ${getPriceColor(selectedStore, item)} ${getCellColor(selectedStore, item)} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                    value={prices[`${selectedStore}-${item}`] || ''}
                    onChange={(e) => handlePriceChange(selectedStore, item, e.target.value)}
                  />
                </div>
                
                {/* Price Comparison Message */}
                {(() => {
                  const currentPrice = parseFloat(prices[`${selectedStore}-${item}`] || '0');
                  if (currentPrice === 0) return null;
                  
                  // Get all prices for this item
                  const itemPrices = STORES.map(store => ({
                    store,
                    price: parseFloat(prices[`${store}-${item}`] || '0')
                  })).filter(p => p.price > 0);
                  
                  if (itemPrices.length <= 1) {
                    return (
                      <div className="mt-3 p-4 rounded-lg border-2 bg-blue-50 border-blue-300">
                        <p className="text-sm text-blue-800 font-semibold">
                          ℹ️ Only price tracked - add prices from other stores to compare
                        </p>
                      </div>
                    );
                  }
                  
                  const sortedPrices = itemPrices.sort((a, b) => a.price - b.price);
                  const bestPrice = sortedPrices[0];
                  const isBest = currentPrice === bestPrice.price;
                  const savings = currentPrice - bestPrice.price;
                  
                  if (isBest) {
                    return (
                      <div className="mt-3 p-4 rounded-lg border-2 bg-green-50 border-green-500">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">✅</span>
                          <div>
                            <p className="text-base font-bold text-green-800">Best Price!</p>
                            <p className="text-sm text-green-700">Buy now at {selectedStore}</p>
                          </div>
                        </div>
                      </div>
                    );
                  } else if (savings <= 0.25) {
                    return (
                      <div className="mt-3 p-4 rounded-lg border-2 bg-yellow-50 border-yellow-300">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">⚠️</span>
                          <div>
                            <p className="text-base font-bold text-yellow-800">Close Enough</p>
                            <p className="text-sm text-yellow-700">{bestPrice.store} is only ${savings.toFixed(2)} cheaper</p>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="mt-3 p-4 rounded-lg border-2 bg-red-50 border-red-300">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">❌</span>
                          <div>
                            <p className="text-base font-bold text-red-800">Skip This One</p>
                            <p className="text-sm text-red-700">{bestPrice.store} has it for ${bestPrice.price.toFixed(2)} (save ${savings.toFixed(2)})</p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })()}
              </div>
            ))}
          </div>
        </div>

        {/* Desktop View - Full Table */}
        <div className="hidden md:block bg-white rounded-lg shadow-lg overflow-x-auto">
          {/* Desktop Item Filter */}
          <div className="p-4 border-b bg-gray-50">
            <label className="inline-block text-sm font-semibold text-gray-700 mr-3">Filter Item:</label>
            <select
              value={selectedItemFilter}
              onChange={(e) => setSelectedItemFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold bg-white"
            >
              <option value="All">All Items</option>
              {sortedItems.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          
          <table className="w-full">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="p-4 text-left font-semibold">Item</th>
                {STORES.sort().map(store => (
                <th key={store} className="p-4 text-center font-semibold">{store}</th>
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

                  {STORES.sort().map(store => (
                    <td key={store} className="p-4">
                      <div className="flex items-center justify-center">
                        <span className="text-gray-800 font-semibold mr-1">$</span>
                        <input
                          type="text"
                          placeholder=""
                          style={{ MozAppearance: 'textfield' }}
                          className={`w-20 px-2 py-2 border border-gray-300 rounded text-right font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:text-gray-800 ${getPriceColor(store, item)} ${getCellColor(store, item)} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                          value={prices[`${store}-${item}`] || ''}
                          onChange={(e) => handlePriceChange(store, item, e.target.value)}
                        />
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
    </div>
  );
}