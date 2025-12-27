'use client';
import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';

interface Store {
  id: string;
  name: string;
  created_at: string;
}

export default function Stores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [newStore, setNewStore] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error loading stores:', error);
      return;
    }
    
    if (data) {
      setStores(data);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingId !== null) {
        const target = event.target as HTMLElement;
        if (!target.closest('.editing-row')) {
          cancelEdit();
        }
      }
    };
  
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingId]);

  const addStore = async () => {
    if (!newStore.trim()) {
      alert('Please enter a store name');
      return;
    }

    if (stores.find(s => s.name.toLowerCase() === newStore.trim().toLowerCase())) {
      alert('A store with this name already exists');
      return;
    }

    const { error } = await supabase
      .from('stores')
      .insert({ name: newStore.trim() });
    
    if (error) {
      console.error('Error adding store:', error);
      alert('Failed to add store');
      return;
    }
    
    setNewStore('');
    loadStores();
  };

  const deleteStore = async (storeId: string, storeName: string) => {
    if (!confirm(`Delete "${storeName}"? This will also remove all price data for this store.`)) {
      return;
    }

    // Delete all price history for this store
    await supabase
      .from('price_history')
      .delete()
      .eq('store', storeName);

    // Delete the store
    const { error } = await supabase
      .from('stores')
      .delete()
      .eq('id', storeId);
    
    if (error) {
      console.error('Error deleting store:', error);
      alert('Failed to delete store');
      return;
    }

    loadStores();
  };

  const startEdit = (storeId: string, storeName: string) => {
    setEditingId(storeId);
    setEditingValue(storeName);
  };
  
  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue('');
  };
  
  const saveEdit = async (storeId: string, oldName: string) => {
    if (!editingValue.trim() || editingValue === oldName) {
      cancelEdit();
      return;
    }
  
    // Check if new name already exists
    if (stores.find(s => s.name.toLowerCase() === editingValue.trim().toLowerCase() && s.id !== storeId)) {
      alert('A store with this name already exists');
      return;
    }

    // Update store in database
    const { error: storeError } = await supabase
      .from('stores')
      .update({ name: editingValue.trim() })
      .eq('id', storeId);
    
    if (storeError) {
      console.error('Error updating store:', storeError);
      alert('Failed to update store');
      return;
    }

    // Update all price history with new store name
    const { error: priceError } = await supabase
      .from('price_history')
      .update({ store: editingValue.trim() })
      .eq('store', oldName);
    
    if (priceError) {
      console.error('Error updating price history:', priceError);
      alert('Failed to update price history');
      return;
    }
  
    loadStores();
    cancelEdit();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* White Header Box */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="hidden md:block text-2xl md:text-4xl font-bold text-gray-800">Manage Stores</h1>
              <p className="hidden md:block text-xs md:text-sm text-gray-600 mt-2">Add, edit, or remove stores you shop at</p>
            </div>
            <Header currentPage="Stores" />
          </div>
        </div>

        {/* Add New Store */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <h2 className="text-xl font-bold mb-3 text-gray-800">Add Store</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g., Trader Joe's"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
              value={newStore}
              onChange={(e) => setNewStore(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addStore()}
            />
            <button
              onClick={addStore}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 cursor-pointer transition whitespace-nowrap"
            >
              Add
            </button>
          </div>
        </div>

        {/* Stores List */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Your Stores ({stores.length})</h2>
          
          {stores.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No stores yet. Add your first store above!</p>
          ) : (
            <div className="space-y-2">
              {stores.map((store) => (
                <div
                  key={store.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                >
                  {editingId === store.id ? (
                    <div className="editing-row flex items-center flex-1 justify-between w-full">
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && saveEdit(store.id, store.name)}
                        className="flex-1 px-3 py-2 border border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-200 text-gray-800 font-medium"
                        autoFocus
                      />
                      <button
                        onClick={() => saveEdit(store.id, store.name)}
                        className="text-green-600 hover:text-green-800 font-semibold cursor-pointer px-3 ml-2"
                      >
                        ✓
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-gray-800 font-medium flex-1 flex items-center gap-3">
                        {store.name}
                        <button
                          onClick={() => startEdit(store.id, store.name)}
                          className="ml-3 text-gray-400 hover:text-blue-600 cursor-pointer"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </span>
                      <button
                        onClick={() => deleteStore(store.id, store.name)}
                        className="text-red-600 hover:text-red-800 cursor-pointer"
                        title="Delete store"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}