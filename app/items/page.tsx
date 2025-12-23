'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Header from '../components/Header';

const DEFAULT_ITEMS = [
  'Eggs (dozen)',
  'Milk (gallon)',
  'Cheese (lb)',
  'Apples (lb)',
  'Chicken Breast (lb)',
  'Ground Beef (lb)',
  'Bread (loaf)',
  'Butter (lb)'
];

export default function Items() {
  const [items, setItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => {
    const savedItems = localStorage.getItem('smartsave-items');
    if (savedItems) {
      setItems(JSON.parse(savedItems));
    } else {
      setItems(DEFAULT_ITEMS);
      localStorage.setItem('smartsave-items', JSON.stringify(DEFAULT_ITEMS));
    }
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      localStorage.setItem('smartsave-items', JSON.stringify(items));
    }
  }, [items]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingIndex !== null) {
        const target = event.target as HTMLElement;
        if (!target.closest('.editing-row')) {
          cancelEdit();
        }
      }
    };
  
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingIndex]);

  const addItem = () => {
    if (newItem.trim() && !items.includes(newItem.trim())) {
      setItems([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const deleteItem = (itemToDelete: string) => {
    if (confirm(`Delete "${itemToDelete}"? This will also remove all price data for this item.`)) {
      setItems(items.filter(item => item !== itemToDelete));
      
      // Also remove prices for this item
      const savedPrices = localStorage.getItem('smartsave-prices');
      if (savedPrices) {
        const prices = JSON.parse(savedPrices);
        const updatedPrices: {[key: string]: string} = {};
        Object.keys(prices).forEach(key => {
          if (!key.includes(itemToDelete)) {
            updatedPrices[key] = prices[key];
          }
        });
        localStorage.setItem('smartsave-prices', JSON.stringify(updatedPrices));
      }
    }
  };
  const startEdit = (index: number, item: string) => {
    setEditingIndex(index);
    setEditingValue(item);
  };
  
  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
  };
  
  const saveEdit = (oldItem: string) => {
    if (!editingValue.trim() || editingValue === oldItem) {
      cancelEdit();
      return;
    }
  
    // Check if new name already exists
    if (items.includes(editingValue.trim()) && editingValue.trim() !== oldItem) {
      alert('An item with this name already exists');
      return;
    }
  
    // Update items list
    const updatedItems = items.map(item => item === oldItem ? editingValue.trim() : item);
    setItems(updatedItems);
  
    // Update all prices with new item name
    const savedPrices = localStorage.getItem('smartsave-prices');
    if (savedPrices) {
      const prices = JSON.parse(savedPrices);
      const updatedPrices: {[key: string]: string} = {};
      Object.keys(prices).forEach(key => {
        if (key.includes(oldItem)) {
          const newKey = key.replace(oldItem, editingValue.trim());
          updatedPrices[newKey] = prices[key];
        } else {
          updatedPrices[key] = prices[key];
        }
      });
      localStorage.setItem('smartsave-prices', JSON.stringify(updatedPrices));
    }
  
    cancelEdit();
  };
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
      <Header currentPage="Items" />

        {/* Add Items */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Add New Item</h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="e.g., Organic Bananas (lb)"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addItem()}
            />
            <button
              onClick={addItem}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 cursor-pointer transition"
            >
              Add Item
            </button>
          </div>
        </div>

        {/* Items List */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Existing Items ({items.length})</h2>
          <div className="space-y-2">
  {items.sort().map((item, idx) => (
            <div
            key={item}
            className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
            >
{editingIndex === idx ? (
  <div className="editing-row flex items-center flex-1 justify-between w-full">
    <div className="flex items-center flex-1">
                    <span className="text-gray-500 mr-3">{idx + 1}.</span>
                    <input
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && saveEdit(item)}
                    className="flex-1 px-3 py-2 border border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-200 text-gray-800 font-medium"
                    autoFocus
                    />
                    </div>
    <button
      onClick={() => saveEdit(item)}
      className="text-green-600 hover:text-green-800 font-semibold cursor-pointer px-3"
    >
      ✓
    </button>
  </div>
            ) : (
                <>
  <span className="text-gray-800 font-medium flex-1 flex items-center">
    <span className="text-gray-500 mr-3">{idx + 1}.</span>
    {item}
    <button
  onClick={() => startEdit(idx, item)}
  className="ml-3 text-gray-400 hover:text-blue-600 cursor-pointer"
  title="Edit"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
</button>
  </span>
  <button
    onClick={() => deleteItem(item)}
    className="text-red-600 hover:text-red-800 font-semibold cursor-pointer"
  >
    Delete
  </button>
</>
            )}
            </div>
        ))}
        </div>
        </div>
      </div>
    </div>
  );
}