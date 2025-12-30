'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  'Butter (lb)',
];

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

interface Item {
  name: string;
  is_favorite: boolean;
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  // Search + quick add
  const [query, setQuery] = useState('');
  const [newItem, setNewItem] = useState('');

  // Alphabet filter
  const [filterLetter, setFilterLetter] = useState<string>('All');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // Bottom sheet edit
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const addRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sheetOpen) closeSheet();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sheetOpen]);

  const loadItems = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('items')
      .select('name, is_favorite')
      .eq('user_id', SHARED_USER_ID)
      .order('name');

    if (error) {
      console.error('Error loading items:', error);
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      setItems(
        data.map((x: any) => ({
          name: x.name,
          is_favorite: x.is_favorite || false,
        }))
      );
      setLoading(false);
      return;
    }

    // Seed defaults once if empty
    for (const name of DEFAULT_ITEMS) {
      await supabase.from('items').insert({
        name,
        user_id: SHARED_USER_ID,
        is_favorite: false,
      });
    }
    setItems(DEFAULT_ITEMS.map((name) => ({ name, is_favorite: false })));
    setLoading(false);
  };

  const normalizedQuery = query.trim().toLowerCase();

const filtered = useMemo(() => {
  let base = items;

  if (query.trim()) {
    base = base.filter(i => i.name.toLowerCase().includes(query.toLowerCase()));
  }

  if (filterLetter === 'All') return base.sort((a,b) => a.name.localeCompare(b.name));

  return base
    .sort((a,b) => a.name.localeCompare(b.name))
    .filter(i => i.name.toUpperCase().startsWith(filterLetter));
}, [items, query, filterLetter]);

const toggleLetter = (letter: string) => {
  setFilterLetter((prev) => (prev === letter ? 'All' : letter));
};


  const favorites = useMemo(
    () =>
      filtered
        .filter((i) => i.is_favorite)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [filtered]
  );

  const regular = useMemo(
    () =>
      filtered
        .filter((i) => !i.is_favorite)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [filtered]
  );

  const openSheet = (item: Item) => {
    setSelected(item);
    setEditValue(item.name);
    setSheetOpen(true);
    setSaving(false);

    setTimeout(() => {
      const el = document.getElementById('item-rename-input') as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }, 50);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setSelected(null);
    setEditValue('');
    setSaving(false);
  };

  const addItem = async () => {
    const name = newItem.trim();
    if (!name) return;

    if (items.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
      alert('That item already exists.');
      return;
    }

    const { error } = await supabase.from('items').insert({
      name,
      user_id: SHARED_USER_ID,
      is_favorite: false,
    });

    if (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item. Check your connection and try again.');
      return;
    }

    setItems((prev) => [...prev, { name, is_favorite: false }]);
    setNewItem('');
    addRef.current?.focus();
  };

  const toggleFavorite = async (itemName: string) => {
    const item = items.find((i) => i.name === itemName);
    if (!item) return;
    
    const next = !item.is_favorite;

    const { error } = await supabase
      .from('items')
      .update({ is_favorite: next })
      .eq('name', itemName)
      .eq('user_id', SHARED_USER_ID);

    if (error) {
      console.error('Error updating favorite:', error);
      alert('Failed to update favorite. Check your connection and try again.');
      return;
    }

    setItems((prev) => prev.map((i) => (i.name === itemName ? { ...i, is_favorite: next } : i)));

    if (selected?.name === itemName) {
      setSelected({ ...selected, is_favorite: next });
    }
  };

  const deleteItem = async (itemName: string) => {
    if (!confirm(`Delete "${itemName}"?\n\nThis will also remove all price data for this item.`)) return;

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('name', itemName)
      .eq('user_id', SHARED_USER_ID);

    if (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item. Check your connection and try again.');
      return;
    }

    // Clean up dependent tables (best-effort)
    await supabase.from('price_history').delete().eq('item_name', itemName).eq('user_id', SHARED_USER_ID);
    await supabase.from('shopping_list').delete().eq('item_name', itemName).eq('user_id', SHARED_USER_ID);

    setItems((prev) => prev.filter((i) => i.name !== itemName));
    closeSheet();
  };

  const saveRename = async () => {
    if (!selected) return;

    const oldName = selected.name;
    const nextName = editValue.trim();

    if (!nextName || nextName === oldName) {
      closeSheet();
      return;
    }

    const collision = items.some(
      (i) => i.name.toLowerCase() === nextName.toLowerCase() && i.name !== oldName
    );
    if (collision) {
      alert('An item with this name already exists.');
      return;
    }

    setSaving(true);

    try {
      const { error: itemError } = await supabase
        .from('items')
        .update({ name: nextName })
        .eq('name', oldName)
        .eq('user_id', SHARED_USER_ID);

      if (itemError) throw new Error(itemError.message);

      const { error: phError } = await supabase
        .from('price_history')
        .update({ item_name: nextName })
        .eq('item_name', oldName)
        .eq('user_id', SHARED_USER_ID);

      if (phError) throw new Error(phError.message);

      const { error: slError } = await supabase
        .from('shopping_list')
        .update({ item_name: nextName })
        .eq('item_name', oldName)
        .eq('user_id', SHARED_USER_ID);

      if (slError) throw new Error(slError.message);

      setItems((prev) => prev.map((i) => (i.name === oldName ? { ...i, name: nextName } : i)));
      closeSheet();
    } catch (e) {
      console.error('Rename failed:', e);
      alert('Failed to save changes. Check your connection and try again.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400">
      <div className="max-w-3xl mx-auto p-3 sm:p-4 pb-24">
        {/* Top header */}
        <div className="bg-white rounded-xl shadow-md p-3 sm:p-4 mb-3">
          <div className="flex justify-between items-start">
            {/* Hide title/subheader on mobile */}
            <div className="min-w-0 hidden sm:block">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Items</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {/* Search, rename, and favorite items fast (mobile-first). */}
              </p>
            </div>

            <Header currentPage="Items" />
          </div>
        </div>

        {/* Sticky search + quick add */}
        <div className="sticky top-0 z-10 -mx-3 sm:mx-0 px-3 sm:px-0 pt-2 pb-3 bg-gradient-to-br from-blue-500 to-green-400">
          <div className="bg-white rounded-xl shadow-lg p-3">
            <div className="text-lg font-semibold text-gray-700 mb-2">
              Manage Items
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search existing"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
                />
              </div>
              <button
                onClick={() => {
                  setQuery('');
                  setTimeout(() => searchRef.current?.focus(), 0);
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                title="Clear search"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2 mt-2">
              <input
                ref={addRef}
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
                placeholder="Add a new item"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
              />
              <button
                onClick={addItem}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition whitespace-nowrap"
              >
                Add
              </button>
            </div>

            <div className="mt-2 text-xs text-gray-500 flex justify-between">
              <span>{loading ? 'Loading…' : `${filtered.length} shown / ${items.length} total`}</span>
              <span className="hidden sm:inline">Tip: search → tap item → rename</span>
            </div>
          </div>
        </div>

        {/* Alphabet Filter */}
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
              items.some(item => item.name.toUpperCase().startsWith(letter))
            ).map(letter => (
              <button
                key={letter}
                onClick={() => toggleLetter(letter)}
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

        {/* List */}
        <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4">
          {loading ? (
            <div className="text-gray-600 text-sm">Loading items…</div>
          ) : (
            <>
              {/* Favorites */}
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="text-2xl">⭐</span>
                  Favorites ({favorites.length})
                </h2>
              </div>
              {favorites.length === 0 ? (
                <div className="text-sm text-gray-500 mb-4 italic">
                  Favorite your high-frequency items to keep them on top.
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {favorites.map((item) => (
                    <div
                      key={item.name}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 transition"
                    >
                      {/* BIG tappable star */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(item.name);
                        }}
                        className="text-2xl leading-none flex-shrink-0 px-1"
                        aria-label="Unfavorite item"
                      >
                        ⭐
                      </button>

                      {/* Tap body opens editor */}
                      <button
                        onClick={() => openSheet(item)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="font-medium text-gray-800 truncate">{item.name}</div>
                        <div className="text-xs text-gray-500">Tap to edit</div>
                      </button>

                      <span className="text-gray-400 flex-shrink-0">›</span>
                    </div>
                  ))}
                </div>
              )}

              {/* All items */}
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-700 mb-2">All Items ({regular.length})</h2>
              </div>

              {regular.length === 0 ? (
                <div className="text-sm text-gray-500 italic">No matches. Try a different search.</div>
              ) : (
                <div className="space-y-2">
                  {regular.map((item) => (
                    <div
                      key={item.name}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition"
                    >
                      {/* BIG tappable star */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(item.name);
                        }}
                        className="text-2xl leading-none flex-shrink-0 px-1 text-gray-300"
                        aria-label="Favorite item"
                      >
                        ☆
                      </button>

                      {/* Tap body opens editor */}
                      <button
                        onClick={() => openSheet(item)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="font-medium text-gray-800 truncate">{item.name}</div>
                        <div className="text-xs text-gray-500">Tap to edit</div>
                      </button>

                      <span className="text-gray-400 flex-shrink-0">›</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div
        className="max-h-[85vh] overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
      {/* Bottom sheet */}
      {sheetOpen && selected && (
        <div className="fixed inset-0 z-50" aria-modal="true" role="dialog">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={closeSheet} />

          {/* Sheet */}
          <div
            className="absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-2xl p-4"
            style={{
              paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
          }}
        >
            <div className="flex items-center justify-between mb-3">
              {/* Close */}
              <button
                onClick={closeSheet}
                className="px-3 py-1 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                aria-label="Close"
                disabled={saving}
              >
                ✕
              </button>

              <div className="font-semibold text-gray-800">Edit item</div>

              {/* Delete (moved far away from Save) */}
              <button
                onClick={() => deleteItem(selected.name)}
                className="px-3 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-semibold"
                disabled={saving}
              >
                Delete
              </button>
            </div>

            <input
              id="item-rename-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveRename()}
              className="w-full mt-1 px-3 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 text-base"
              placeholder="e.g., Grapefruit (ct)"
            />

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => toggleFavorite(selected.name)}
                className="py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-800 font-semibold"
                disabled={saving}
              >
                {selected.is_favorite ? 'Unfavorite' : 'Favorite'}
              </button>

              <button
                onClick={saveRename}
                className="py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  </div>
  );
}
