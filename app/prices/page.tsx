'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../components/Header';

const STORES = ['Acme', 'Giant', 'Walmart', 'Costco', 'Aldi'];

export default function Prices() {
  const [prices, setPrices] = useState<{[key: string]: string}>({});
  const [lastSaved, setLastSaved] = useState<string>('');
  const [items, setItems] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Load prices when page loads
  useEffect(() => {
    const savedPrices = localStorage.getItem('smartsave-prices');
    const savedTime = localStorage.getItem('smartsave-last-updated');
    const savedItems = localStorage.getItem('smartsave-items');
    if (savedPrices) {
      setPrices(JSON.parse(savedPrices));
    }
    if (savedTime) {
      setLastSaved(savedTime);
    }
    if (savedItems) {
      setItems(JSON.parse(savedItems));
    }
  }, []);

  // Auto-save whenever prices change
  useEffect(() => {
    if (Object.keys(prices).length > 0) {
      localStorage.setItem('smartsave-prices', JSON.stringify(prices));
      const now = new Date().toLocaleString();
      localStorage.setItem('smartsave-last-updated', now);
      setLastSaved(now);
    }
  }, [prices]);

  const handlePriceChange = (store: string, item: string, value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    if (digits === '') {
      setPrices({...prices, [`${store}-${item}`]: ''});
      return;
    }
    
    // Convert to cents, then to dollars
    const cents = parseInt(digits, 10);
    const dollars = (cents / 100).toFixed(2);
    
    setPrices({...prices, [`${store}-${item}`]: dollars});
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
  
  const saveEdit = (oldItem: string) => {
    if (!editingValue.trim() || editingValue === oldItem) {
      cancelEdit();
      return;
    }
  
    if (items.includes(editingValue.trim()) && editingValue.trim() !== oldItem) {
      alert('An item with this name already exists');
      return;
    }
  
    const updatedItems = items.map(i => i === oldItem ? editingValue.trim() : i);
    setItems(updatedItems);
    localStorage.setItem('smartsave-items', JSON.stringify(updatedItems));
  
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
    localStorage.setItem('smartsave-prices', JSON.stringify(updatedPrices));
  
    cancelEdit();
  };
  
  const deleteItem = (itemToDelete: string) => {
    if (!confirm(`Delete "${itemToDelete}"? This will remove all price data for this item.`)) {
      return;
    }
  
    const updatedItems = items.filter(i => i !== itemToDelete);
    setItems(updatedItems);
    localStorage.setItem('smartsave-items', JSON.stringify(updatedItems));
  
    const updatedPrices: {[key: string]: string} = {};
    Object.keys(prices).forEach(key => {
      if (!key.includes(itemToDelete)) {
        updatedPrices[key] = prices[key];
      }
    });
    setPrices(updatedPrices);
    localStorage.setItem('smartsave-prices', JSON.stringify(updatedPrices));
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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <Header currentPage="Prices" />
            <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800">Prices by Store</h1>
            {lastSaved && (
                <p className="text-sm text-gray-600 mt-2">Last updated: {lastSaved}</p>
            )}
            </div>
        <div className="bg-white rounded-lg shadow-lg overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="p-4 text-left font-semibold">Item</th>
                {STORES.map(store => (
                  <th key={store} className="p-4 text-center font-semibold">{store}</th>
                ))}
                <th className="p-4 text-center font-semibold"></th>
              </tr>
            </thead>
            <tbody>
                {items.sort().sort((a, b) => {
                    // Check if items have any prices
                    const aHasPrices = STORES.some(store => parseFloat(prices[`${store}-${a}`] || '0') > 0);
                    const bHasPrices = STORES.some(store => parseFloat(prices[`${store}-${b}`] || '0') > 0);
                    
                    // Items with prices come first
                    if (aHasPrices && !bHasPrices) return -1;
                    if (!aHasPrices && bHasPrices) return 1;
                    
                    // Within each group, sort alphabetically
                    return 0;
                }).map((item, idx) => (
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

{STORES.map(store => (
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