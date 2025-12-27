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

interface Item {
  name: string;
  is_favorite: boolean;
}

export default function Items() {
  const [items, setItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => {
    loadItems();
  }, []);
  
  const loadItems = async () => {
    const { data, error } = await supabase
      .from('items')
      .select('name, is_favorite')
      .order('name');
    
    if (error) {
      console.error('Error loading items:', error);
      return;
    }
    
    if (data && data.length > 0) {
      setItems(data.map(item => ({
        name: item.name,
        is_favorite: item.is_favorite || false
      })));
    } else {
      // If no items exist, seed with defaults
      const defaultItems = DEFAULT_ITEMS;
      for (const item of defaultItems) {
        await supabase.from('items').insert({ 
          name: item, 
          user_id: '00000000-0000-0000-0000-000000000000',
          is_favorite: false 
        });
      }
      setItems(defaultItems.map(name => ({ name, is_favorite: false })));
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
    if (newItem.trim() && !items.find(i => i.name === newItem.trim())) {
      const { error } = await supabase
        .from('items')
        .insert({ 
          name: newItem.trim(), 
          user_id: '00000000-0000-0000-0000-000000000000',
          is_favorite: false
        });
      
      if (error) {
        console.error('Error adding item:', error);
        alert('Failed to add item');
        return;
      }
      
      setItems([...items, { name: newItem.trim(), is_favorite: false }]);
      setNewItem('');
    }
  };

  const toggleFavorite = async (itemName: string) => {
    const item = items.find(i => i.name === itemName);
    if (!item) return;
    
    const newFavoriteStatus = !item.is_favorite;
    
    const { error } = await supabase
      .from('items')
      .update({ is_favorite: newFavoriteStatus })
      .eq('name', itemName);
    
    if (error) {
      console.error('Error updating favorite:', error);
      return;
    }
    
    setItems(items.map(i => 
      i.name === itemName ? { ...i, is_favorite: newFavoriteStatus } : i
    ));
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

    // Also delete all price history for this item
    await supabase
      .from('price_history')
      .delete()
      .eq('item_name', itemToDelete);

    setItems(items.filter(item => item.name !== itemToDelete));
  };

  const startEdit = (index: number, itemName: string) => {
    setEditingIndex(index);
    setEditingValue(itemName);
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
    if (items.find(i => i.name === editingValue.trim()) && editingValue.trim() !== oldItem) {
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

    // Update all price history with new item name
    const { error: priceError } = await supabase
      .from('price_history')
      .update({ item_name: editingValue.trim() })
      .eq('item_name', oldItem)
      .eq('user_id', '00000000-0000-0000-0000-000000000000');
    
    if (priceError) {
      console.error('Error updating price history:', priceError);
      alert('Failed to update price history');
      return;
    }
  
    // Update local state
    setItems(items.map(item => 
      item.name === oldItem ? { ...item, name: editingValue.trim() } : item
    ));
  
    cancelEdit();
  };

  const favoriteItems = items.filter(i => i.is_favorite).sort((a, b) => a.name.localeCompare(b.name));
  const regularItems = items.filter(i => !i.is_favorite).sort((a, b) => a.name.localeCompare(b.name));

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
          {/* Favorites Section */}
          <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="text-2xl">⭐</span> Favorites ({favoriteItems.length > 0 ? favoriteItems.length : 'none'})
          </h3>
          {favoriteItems.length === 0 ? (
            <p className="text-sm text-gray-500 mb-6 italic">
              Star your favorite items below to quickly add them to your shopping list!
            </p>
          ) : (
            <div className="space-y-2 mb-6">
                {favoriteItems.map((item, idx) => (
                  <div
                    key={item.name}
                    className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition border border-yellow-200"
                  >
                    {editingIndex === items.findIndex(i => i.name === item.name) ? (
                      <div className="editing-row flex items-center flex-1 justify-between w-full">
                        <div className="flex items-center flex-1 gap-3">
                          <button
                            onClick={() => toggleFavorite(item.name)}
                            className="text-2xl cursor-pointer hover:scale-110 transition"
                          >
                            ⭐
                          </button>
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && saveEdit(item.name)}
                            className="flex-1 px-3 py-2 border border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-200 text-gray-800 font-medium"
                            autoFocus
                          />
                        </div>
                        <button
                          onClick={() => saveEdit(item.name)}
                          className="text-green-600 hover:text-green-800 font-semibold cursor-pointer px-3"
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-gray-800 font-medium flex-1 flex items-center gap-3">
                          <button
                            onClick={() => toggleFavorite(item.name)}
                            className="text-2xl cursor-pointer hover:scale-110 transition"
                            title="Remove from favorites"
                          >
                            ⭐
                          </button>
                          {item.name}
                          <button
                            onClick={() => startEdit(items.findIndex(i => i.name === item.name), item.name)}
                            className="ml-3 text-gray-400 hover:text-blue-600 cursor-pointer"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        </span>
                        <button
                          onClick={() => toggleFavorite(item.name)}
                          className="text-gray-300 hover:text-gray-500 cursor-pointer text-xl"
                          title="Unfavorite (star icon to remove from favorites)"
                        >
                          ✖️
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          
          {/* Other Items Section */}
          <h3 className="text-lg font-semibold text-gray-700 mb-3">All Items ({regularItems.length})</h3>
          <div className="space-y-2">
            {regularItems.map((item, idx) => (
              <div
                key={item.name}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                {editingIndex === items.findIndex(i => i.name === item.name) ? (
                  <div className="editing-row flex items-center flex-1 justify-between w-full">
                    <div className="flex items-center flex-1 gap-3">
                      <button
                        onClick={() => toggleFavorite(item.name)}
                        className="text-2xl cursor-pointer hover:scale-110 transition opacity-30 hover:opacity-100"
                      >
                        ☆
                      </button>
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && saveEdit(item.name)}
                        className="flex-1 px-3 py-2 border border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-200 text-gray-800 font-medium"
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={() => saveEdit(item.name)}
                      className="text-green-600 hover:text-green-800 font-semibold cursor-pointer px-3"
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-gray-800 font-medium flex-1 flex items-center gap-3">
                      <button
                        onClick={() => toggleFavorite(item.name)}
                        className="text-2xl cursor-pointer hover:scale-110 transition opacity-30 hover:opacity-100"
                        title="Add to favorites"
                      >
                        ☆
                      </button>
                      {item.name}
                      <button
                        onClick={() => startEdit(items.findIndex(i => i.name === item.name), item.name)}
                        className="ml-3 text-gray-400 hover:text-blue-600 cursor-pointer"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </span>
                    <button
                      onClick={() => deleteItem(item.name)}
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