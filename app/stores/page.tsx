'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';


// Helper Icon
const PencilIcon = ({ className }: { className?: string }) => (
  <svg className={className ?? 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
    />
  </svg>
);

interface Store {
  id: string;
  name: string;
  location: string | null;
  created_at: string;
  is_favorite?: boolean;
}

export default function Stores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [newStore, setNewStore] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingLocation, setEditingLocation] = useState('');
  const [householdCode, setHouseholdCode] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const code = localStorage.getItem('household_code') || '';
      setHouseholdCode(code);
    }
  }, []);

  useEffect(() => {
    if (householdCode) {
      loadStores();
    }
  }, [householdCode]);

  const loadStores = async () => {
    // Load all stores
    const { data: storesData, error } = await supabase
      .from('stores')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading stores:', error);
      return;
    }

    // Load favorited stores for this household
    const { data: favoritesData } = await supabase
      .from('household_store_favorites')
      .select('store_id')
      .eq('household_code', householdCode);

    const favoritedIds = new Set(favoritesData?.map((f: any) => f.store_id) || []);

    // Mark stores as favorited and sort (favorites first)
    const storesWithFavorites = (storesData || []).map((s: any) => ({
      ...s,
      is_favorite: favoritedIds.has(s.id)
    }));

    // Sort: favorited first, then alphabetically
    storesWithFavorites.sort((a, b) => {
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      return a.name.localeCompare(b.name);
    });

    setStores(storesWithFavorites);
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

    if (stores.find(s => s.name.toLowerCase() === newStore.trim().toLowerCase() &&
      s.location === (newLocation.trim() || null))) {
      alert('A store with this name and location already exists');
      return;
    }

    const { error } = await supabase
      .from('stores')
      .insert({
        name: newStore.trim(),
        location: newLocation.trim() || null
      });

    if (error) {
      console.error('Error adding store:', error);
      alert('Failed to add store');
      return;
    }

    setNewStore('');
    setNewLocation('');
    loadStores();
  };

  const deleteStore = async (storeId: string, storeName: string) => {
    if (!confirm(`Delete "${storeName}"? This will also remove all price data for this store.`)) {
      return;
    }

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

  const startEdit = (store: Store) => {
    setEditingId(store.id);
    setEditingValue(store.name);
    setEditingLocation(store.location || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue('');
    setEditingLocation('');
  };

  const saveEdit = async (storeId: string) => {
    if (!editingValue.trim()) {
      alert('Store name cannot be empty');
      return;
    }

    const { error } = await supabase
      .from('stores')
      .update({
        name: editingValue.trim(),
        location: editingLocation.trim() || null
      })
      .eq('id', storeId);

    if (error) {
      console.error('Error updating store:', error);
      alert('Failed to update store');
      return;
    }

    setEditingId(null);
    setEditingValue('');
    setEditingLocation('');
    loadStores();
  };

  const toggleFavorite = async (storeId: string, isFavorite: boolean) => {
    if (isFavorite) {
      // Remove from favorites
      const { error } = await supabase
        .from('household_store_favorites')
        .delete()
        .eq('household_code', householdCode)
        .eq('store_id', storeId);

      if (error) {
        console.error('Error removing favorite:', error);
        alert('Failed to remove favorite');
        return;
      }
    } else {
      // Add to favorites
      const { error } = await supabase
        .from('household_store_favorites')
        .insert({
          household_code: householdCode,
          store_id: storeId
        });

      if (error) {
        console.error('Error adding favorite:', error);
        alert('Failed to add favorite');
        return;
      }
    }

    loadStores();
  };

  const favoritedStores = stores.filter(s => s.is_favorite);
  const otherStores = stores.filter(s => !s.is_favorite);

  return (
    <div className="min-h-screen bg-blue-500 bg-gradient-to-br from-blue-500 to-green-400 pb-20 md:pb-0">
      <div className="sticky top-0 z-50 bg-white shadow-sm w-full">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-3">
          <div className="flex justify-between items-center">
            <div className="hidden md:flex items-center gap-2">
              <Link href="/" className="text-xl font-bold text-gray-800 hover:text-indigo-600 transition flex items-center gap-2">
                <span className="text-2xl">ᯓ</span>
                <span className="hidden sm:inline">SmartSaveAI</span>
              </Link>
            </div>
            <div className="w-full">
              <Header currentPage="Manage Stores" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-2 sm:px-4 md:px-8 pt-6">
        <div className="bg-white rounded-2xl shadow-lg p-6">

          {/* Add Store Form */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-3">Add New Store</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={newStore}
                onChange={(e) => setNewStore(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addStore()}
                placeholder="Name (e.g., Costco)"
                className="px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-400"
              />
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addStore()}
                placeholder="Location (e.g., KOP)"
                className="px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
              />
              <button
                onClick={addStore}
                className="bg-blue-600 text-white px-4 py-3 rounded-2xl font-semibold hover:bg-blue-700 transition cursor-pointer"
              >
                Add Store
              </button>
            </div>
          </div>

          {/* Favorited Stores Section */}
          {favoritedStores.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-3">⭐ Your Stores</h2>
              <div className="space-y-2">
                {favoritedStores.map(store => (
                  <div key={store.id} className="editing-row">
                    {editingId === store.id ? (
                      <div className="flex flex-col sm:flex-row gap-2 p-3 bg-blue-50 rounded-2xl border-2 border-blue-300">
                        <div className="flex gap-2 flex-1">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && saveEdit(store.id)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold min-w-0"
                            autoFocus
                            placeholder="Store Name"
                          />
                          <input
                            type="text"
                            value={editingLocation}
                            onChange={(e) => setEditingLocation(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && saveEdit(store.id)}
                            placeholder="Location (opt)"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 min-w-0"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => saveEdit(store.id)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition cursor-pointer"
                          >
                            ✓
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-400 transition cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-2xl border-2 border-yellow-200 hover:border-yellow-300 transition">
                        <button
                          onClick={() => toggleFavorite(store.id, store.is_favorite || false)}
                          className="text-2xl leading-none flex-shrink-0 cursor-pointer text-yellow-500 hover:scale-110 transition-transform"
                        >
                          ⭐
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-800 truncate">{store.name}</div>
                          {store.location && (
                            <div className="text-sm text-gray-500 truncate">{store.location}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(store)}
                            className="p-2 text-gray-400 hover:text-blue-600 transition cursor-pointer"
                            title="Edit"
                          >
                            <PencilIcon />
                          </button>
                          <button
                            onClick={() => deleteStore(store.id, store.name)}
                            className="p-2 text-gray-400 hover:text-red-600 transition cursor-pointer text-xl leading-none"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other Stores Section */}
          {otherStores.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-3">All Stores</h2>
              <div className="space-y-2">
                {otherStores.map(store => (
                  <div key={store.id} className="editing-row">
                    {editingId === store.id ? (
                      <div className="flex flex-col sm:flex-row gap-2 p-3 bg-blue-50 rounded-2xl border-2 border-blue-300">
                        <div className="flex gap-2 flex-1">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && saveEdit(store.id)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold min-w-0"
                            autoFocus
                            placeholder="Store Name"
                          />
                          <input
                            type="text"
                            value={editingLocation}
                            onChange={(e) => setEditingLocation(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && saveEdit(store.id)}
                            placeholder="Location (opt)"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 min-w-0"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => saveEdit(store.id)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition cursor-pointer"
                          >
                            ✓
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-400 transition cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border-2 border-gray-200 hover:border-gray-300 transition">
                        <button
                          onClick={() => toggleFavorite(store.id, store.is_favorite || false)}
                          className="text-2xl leading-none flex-shrink-0 cursor-pointer text-gray-300 hover:text-yellow-400 transition-colors"
                        >
                          ☆
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-800 truncate">{store.name}</div>
                          {store.location && (
                            <div className="text-sm text-gray-500 truncate">{store.location}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(store)}
                            className="p-2 text-gray-400 hover:text-blue-600 transition cursor-pointer"
                            title="Edit"
                          >
                            <PencilIcon />
                          </button>
                          <button
                            onClick={() => deleteStore(store.id, store.name)}
                            className="p-2 text-gray-400 hover:text-red-600 transition cursor-pointer text-xl leading-none"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {stores.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No stores yet. Add your first store above!
            </div>
          )}
        </div>
      </div>
    </div>

  );
}
