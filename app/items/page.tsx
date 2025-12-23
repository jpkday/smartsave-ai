'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';

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
    loadItems();
  }, []);
  
  const loadItems = async () => {
    const { data, error } = await supabase
      .from('items')
      .select('name')
      .order('name');
    
    if (error) {
      console.error('Error loading items:', error);
      return;
    }
    
    if (data && data.length > 0) {
      setItems(data.map(item => item.name));
    } else {
      // If no items exist, seed with defaults
      const defaultItems = DEFAULT_ITEMS;
      for (const item of defaultItems) {
        await supabase.from('items').insert({ name: item, user_id: '00000000-0000-0000-0000-000000000000' });
      }
      setItems(defaultItems);
    }
  };

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

  const addItem = async () => {
    if (newItem.trim() && !items.includes(newItem.trim())) {
      const { error } = await supabase
        .from('items')
        .insert({ name: newItem.trim(), user_id: '00000000-0000-0000-0000-000000000000' });
      
      if (error) {
        console.error('Error adding item:', error);
        alert('Failed to add item');
        return;
      }
      
      setItems([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const deleteItem = async (itemToDelete: string) => {
    if (!confirm(`Delete "${itemToDelete}"? This will also remove all price data for this item.`)) {
      return;
    }

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('name', itemToDelete);
    
    if (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
      return;
    }

    // Also delete all prices for this item
    await supabase
      .from('prices')
      .delete()
      .eq('item_name', itemToDelete);

    setItems(items.filter(item => item !== itemToDelete));
  };

  const startEdit = (index: number, item: string) => {
    setEditingIndex(index);
    setEditingValue(item);
  };
  
  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
  };
  
  const saveEdit = async (oldItem: string) => {
    if (!editingValue.trim() || editingValue === oldItem) {
      cancelEdit();
      return;
    }
  
    // Check if new name already exists
    if (items.includes(editingValue.trim()) && editingValue.trim() !== oldItem) {
      alert('An item with this name already exists');
      return;
    }

    // Update item in database
    const { error: itemError } = await supabase
      .from('items')
      .update({ name: editingValue.trim() })
      .eq('name', oldItem);
    
    if (itemError) {
      console.error('Error updating item:', itemError);
      alert('Failed to update item');
      return;
    }

    // Update all prices with new item name
    await supabase
      .from('prices')
      .update({ item_name: editingValue.trim() })
      .eq('item_name', oldItem);
  
    // Update local state
    const updatedItems = items.map(item => item === oldItem ? editingValue.trim() : item);
    setItems(updatedItems);
  
    cancelEdit();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* White Header Box */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="hidden md:block text-2xl md:text-4xl font-bold text-gray-800">Manage Items</h1>
              <p className="hidden md:block text-xs md:text-sm text-gray-600 mt-2">Add, edit, or delete items from your shopping list</p>
            </div>
            <Header currentPage="Items" />
          </div>
        </div>

        {/* Add New Item */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <h2 className="text-xl font-bold mb-3 text-gray-800">Add Item</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g., Organic bananas"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addItem()}
            />
            <button
              onClick={addItem}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 cursor-pointer transition whitespace-nowrap"
            >
              Add
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
                      className="text-red-600 hover:text-red-800 cursor-pointer"
                      title="Delete item"
                    >
                      🗑️
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