'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { useSearchParams } from 'next/navigation';

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
  category?: string | null;
  is_favorite: boolean;
  household_code?: string;
}


function ItemsContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const householdCode = typeof window !== 'undefined' ? localStorage.getItem('household_code') : null;
  const isMasterAccount = householdCode === 'ASDF';
  const [editModalFocusField, setEditModalFocusField] = useState<'name' | 'price'>('name');

  // Combined search + add with autocomplete
  const [inputValue, setInputValue] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<string[]>([]);

  // Alphabet filter (Compare-style)
  const [filterLetter, setFilterLetter] = useState<string>('All');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const toggleLetter = (letter: string) => {
    setFilterLetter((prev) => (prev === letter ? 'All' : letter));
  };

  // Mobile bottom sheet edit
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [editCategory, setEditCategory] = useState<string>('Other');
  const [editFavorite, setEditFavorite] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  // Desktop inline edit
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [inlineSaving, setInlineSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const editRowRef = useRef<HTMLDivElement | null>(null);

  const [selectItemsFilter, setSelectItemsFilter] =
  useState<'ALL' | 'FAVORITES'>('ALL');

  const CATEGORY_OPTIONS: string[] = [
    'Produce',
    'Pantry',
    'Dairy',
    'Beverage',
    'Meat',
    'Frozen',
    'Refrigerated',
    'Other',
  ];
  
  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sheetOpen) closeSheet();
      if (e.key === 'Escape' && editingName) cancelInlineEdit();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sheetOpen, editingName]);

  useEffect(() => {
    if (!editingName) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (editRowRef.current && !editRowRef.current.contains(e.target as Node)) {
        cancelInlineEdit();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingName]);

  // Populate edit sheet + focus name input at end
  useEffect(() => {
    if (!sheetOpen || !selected) return;

    // Initialize draft state
    setEditValue(selected.name);
    setEditCategory(selected.category ?? 'Other');
    setEditFavorite(!!selected.is_favorite);

    // Focus name input and move cursor to end (mobile-safe)
    const t = setTimeout(() => {
      const el = nameInputRef.current;
      if (!el) return;

      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }, 50);

    return () => clearTimeout(t);
  }, [sheetOpen, selected]);


  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.autocomplete-container')) {
        setShowAutocomplete(false);
      }
    };

    if (showAutocomplete) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAutocomplete]);

  const loadItems = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('items')
      .select('name, category, is_favorite, household_code')
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
          category: x.category ?? 'Other',
          is_favorite: x.is_favorite || false,
          household_code: x.household_code,
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
        household_code: householdCode || 'ASDF',
        is_favorite: false,
      });
    }
    setItems(DEFAULT_ITEMS.map((name) => ({ 
      name,
      category: 'Other',              
      is_favorite: false,
      household_code: householdCode || 'ASDF',
    })));
    setLoading(false);
  };

  // Handle URL param for direct item editing
  useEffect(() => {
    if (items.length === 0) return;
    
    const itemParam = searchParams.get('item');
    if (!itemParam) return;
    
    try {
      const itemName = JSON.parse(itemParam);
      const found = items.find(i => i.name === itemName);
      if (found) {
        if (window.innerWidth < 768) {
          openSheet(found);
        } else {
          startInlineEdit(found.name);
        }
      }
    } catch (e) {
      console.error('Invalid item param:', e);
    }
  }, [items, searchParams]);

  // Handle input change for autocomplete
  const handleInputChange = (value: string) => {
    setInputValue(value);

    if (value.trim()) {
      const filteredItems = items
        .filter((item) => item.name.toLowerCase().includes(value.toLowerCase()))
        .map((item) => item.name);
      
      setAutocompleteItems(filteredItems);
      setShowAutocomplete(filteredItems.length > 0);
    } else {
      setAutocompleteItems([]);
      setShowAutocomplete(false);
    }
  };

  // Select item from autocomplete - just sets filter
  const selectFromAutocomplete = (itemName: string) => {
    setInputValue(itemName);
    setShowAutocomplete(false);
    setFilterLetter('All'); // Show all to ensure item is visible
  };

  const filtered = useMemo(() => {
    let base = items;

    if (inputValue.trim()) {
      base = base.filter((i) => i.name.toLowerCase().includes(inputValue.toLowerCase()));
    }

    if (filterLetter === 'All') return base.sort((a, b) => a.name.localeCompare(b.name));

    return base
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((i) => i.name.toUpperCase().startsWith(filterLetter));
  }, [items, inputValue, filterLetter]);

  const favorites = useMemo(
    () => filtered.filter((i) => i.is_favorite).sort((a, b) => a.name.localeCompare(b.name)),
    [filtered]
  );

  const regular = useMemo(
    () => filtered.filter((i) => !i.is_favorite).sort((a, b) => a.name.localeCompare(b.name)),
    [filtered]
  );

  const canDeleteItem = (item: Item): boolean => {
    return isMasterAccount || item.household_code === householdCode;
  };

  type ItemWithCategory = Item & {
    category?: string | null;
  };
  
  const openSheet = (item: ItemWithCategory) => {
    setSelected(item);
    setEditValue(item.name);
  
    // ✅ now works even if Item type doesn't include category
    setEditCategory(item.category ?? 'Other');
  
    setSheetOpen(true);
    setSaving(false);
  
    setTimeout(() => {
      const el = document.getElementById('item-rename-input') as HTMLInputElement | null;
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    }, 50);
  };
  
  
  const closeSheet = () => {
    setSheetOpen(false);
    setSelected(null);
    setEditValue('');
  
    // ✅ Optional: reset category so next open doesn't carry stale state
    setEditCategory('Other');
  
    setSaving(false);
  };

  const addItem = async () => {
    const name = inputValue.trim();
    if (!name) return;

    if (items.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
      alert('That item already exists.');
      return;
    }

    const { error } = await supabase.from('items').insert({
      name,
      user_id: SHARED_USER_ID,
      household_code: householdCode || 'ASDF',
      is_favorite: false,
    });

    if (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item. Check your connection and try again.');
      return;
    }

    setItems((prev) => [...prev, { 
      name, 
      is_favorite: false,
      household_code: householdCode || 'ASDF'
    }]);
    setInputValue('');
    setShowAutocomplete(false);
    inputRef.current?.focus();
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
    const item = items.find(i => i.name === itemName);
    if (!item) return;
  
    const canDelete = canDeleteItem(item);
    
    if (!canDelete) {
      alert('You can only delete items you created.');
      return;
    }
  
    if (!confirm('Delete this item? This will also remove it from all shopping lists.')) return;
  
    try {
      // Delete from dependent tables FIRST (to avoid foreign key constraint errors)
      const { error: shoppingListError } = await supabase
        .from('shopping_list')
        .delete()
        .eq('item_name', itemName)
        .eq('user_id', SHARED_USER_ID);
  
      if (shoppingListError) {
        throw shoppingListError;
      }
  
      const { error: priceError } = await supabase
        .from('price_history')
        .delete()
        .eq('item_name', itemName)
        .eq('user_id', SHARED_USER_ID);
  
      if (priceError) {
        throw priceError;
      }
  
      // Now delete from items table (safe because no references exist)
      const { error: itemError } = await supabase
        .from('items')
        .delete()
        .eq('name', itemName)
        .eq('user_id', SHARED_USER_ID);
  
      if (itemError) {
        throw itemError;
      }
  
      // Update UI
      setItems((prev) => prev.filter((i) => i.name !== itemName));
  
      if (selected?.name === itemName) closeSheet();
      if (editingName === itemName) cancelInlineEdit();
  
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item. Check your connection and try again.');
    }
  };

  const renameItem = async (oldName: string, nextNameRaw: string) => {
    const nextName = nextNameRaw.trim();
    if (!nextName || nextName === oldName) return;

    const collision = items.some(
      (i) => i.name.toLowerCase() === nextName.toLowerCase() && i.name !== oldName
    );
    if (collision) {
      alert('An item with this name already exists.');
      return;
    }

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
  };

  const saveRename = async () => {
    if (!selected) return;
  
    const itemName = selected.name;
    const nextCategory = (editCategory || 'Other').trim() || 'Other';
    const nextFavorite = !!editFavorite;
  
    const prevItems = items;
    const prevSelected = selected;
  
    setSaving(true);
  
    // ✅ Optimistic UI update for BOTH fields
    setItems((prev) =>
      prev.map((i) =>
        i.name === itemName ? { ...i, category: nextCategory, is_favorite: nextFavorite } : i
      )
    );
    setSelected({ ...selected, category: nextCategory, is_favorite: nextFavorite });
  
    try {
      const { error } = await supabase
        .from('items')
        .update({ category: nextCategory, is_favorite: nextFavorite })
        .eq('name', itemName)
        .eq('user_id', SHARED_USER_ID);
  
      if (error) throw error;
  
      closeSheet();
    } catch (e) {
      console.error('Save failed:', e);
  
      // rollback
      setItems(prevItems);
      setSelected(prevSelected);
  
      alert('Failed to save changes. Check your connection and try again.');
      setSaving(false);
    }
  };
  

  const startInlineEdit = (name: string) => {
    setEditingName(name);
    setEditingValue(name);
    setInlineSaving(false);
  };

  const cancelInlineEdit = () => {
    setEditingName(null);
    setEditingValue('');
    setInlineSaving(false);
  };

  const commitInlineEdit = async () => {
    if (!editingName) return;
    setInlineSaving(true);
    try {
      await renameItem(editingName, editingValue);
      cancelInlineEdit();
    } catch (e) {
      console.error('Inline rename failed:', e);
      alert('Failed to save changes. Check your connection and try again.');
      setInlineSaving(false);
    }
  };

  const PencilIcon = ({ className }: { className?: string }) => (
    <svg className={className ?? 'w-4 h-4 inline'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );

  const renderMobileRow = (item: Item, isFavorite: boolean) => {
    return (
      <div
        key={item.name}
        className={
          isFavorite
            ? 'w-full flex items-center gap-3 p-3 rounded-xl bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 transition'
            : 'w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition'
        }
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(item.name);
          }}
          className={
            isFavorite
              ? 'text-2xl leading-none flex-shrink-0 px-1 cursor-pointer'
              : 'text-2xl leading-none flex-shrink-0 px-1 text-gray-300 cursor-pointer'
          }
          aria-label={isFavorite ? 'Unfavorite item' : 'Favorite item'}
        >
          {isFavorite ? '⭐' : '☆'}
        </button>

        <button
          type="button"
          onClick={() => {
            const full = items.find((it) => it.name === item.name);
            openSheet(full ?? item);
          }}
          className="flex-1 text-left min-w-0"
        >

          <div className="font-medium text-gray-800 truncate">{item.name}</div>
          <div className="text-xs text-gray-500">Tap to edit</div>
        </button>

        <span className="text-gray-400 flex-shrink-0">›</span>
      </div>
    );
  };

  const renderDesktopRow = (item: Item, isFavorite: boolean) => {
    const isEditing = editingName === item.name;
    const canDelete = canDeleteItem(item);

    return (
      <div
        key={item.name}
        ref={isEditing ? editRowRef : null}
        className={
          isFavorite
            ? 'w-full flex items-center gap-3 p-3 rounded-xl bg-yellow-50 border border-yellow-200'
            : 'w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100'
        }
      >
        <button
          type="button"
          onClick={() => toggleFavorite(item.name)}
          className={
            isFavorite
              ? 'text-2xl leading-none flex-shrink-0 px-1 cursor-pointer'
              : 'text-2xl leading-none flex-shrink-0 px-1 text-gray-300 cursor-pointer'
          }
          aria-label={isFavorite ? 'Unfavorite item' : 'Favorite item'}
          disabled={inlineSaving}
        >
          {isFavorite ? '⭐' : '☆'}
        </button>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitInlineEdit();
                  if (e.key === 'Escape') cancelInlineEdit();
                }}
                className="flex-1 px-2 py-1 border border-blue-500 rounded text-base focus:ring-2 focus:ring-blue-200"
                autoFocus
              />
              <button
                type="button"
                onClick={commitInlineEdit}
                className="text-green-600 font-semibold cursor-pointer text-lg"
                disabled={inlineSaving}
                title="Save"
              >
                ✓
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="font-medium text-gray-800 text-base truncate">
                {item.name}
                <button
                  type="button"
                  onClick={() => startInlineEdit(item.name)}
                  className="ml-2 text-gray-400 hover:text-blue-600 cursor-pointer"
                  title="Edit"
                  disabled={inlineSaving}
                >
                  <PencilIcon className="w-4 h-4 inline" />
                </button>
              </span>

              {canDelete && (
                <button
                  type="button"
                  onClick={() => deleteItem(item.name)}
                  className="text-red-600 hover:text-red-800 cursor-pointer text-xl p-2 flex-shrink-0"
                  title="Delete item"
                  disabled={inlineSaving}
                >
                  🗑️
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const itemExists = items.some((i) => i.name.toLowerCase() === inputValue.trim().toLowerCase());

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 p-0 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="sticky top-0 z-50 bg-white shadow-md p-4 mb-3">
          <div className="flex justify-between items-start">
            <div className="min-w-0 hidden sm:block">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Items</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">{/* intentionally blank */}</p>
            </div>
            <Header currentPage="Manage Items" />
          </div>
        </div>

<div className="px-2 md:px-6 py-0">
<div className="max-w-5xl mx-auto space-y-3">

 {/* Alphabet Filter */}
 <div className="bg-white rounded-2xl shadow-lg p-3 md:p-4 mb-1 md:mb-6">
          <div className="flex flex-wrap gap-1.5 md:gap-2 justify-center">
            <button
              type="button"
              onClick={() => setFilterLetter('All')}
              className={`px-2.5 py-1.5 md:px-3 md:py-1 rounded text-sm md:text-base font-semibold cursor-pointer transition ${
                filterLetter === 'All'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>

            {alphabet
              .filter((letter) => items.some((it) => it.name.toUpperCase().startsWith(letter)))
              .map((letter) => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => toggleLetter(letter)}
                  className={`px-2.5 py-1.5 md:px-3 md:py-1 rounded text-sm md:text-base font-semibold cursor-pointer transition ${
                    filterLetter === letter
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {letter}
                </button>
              ))}
          </div>
        </div>

      {/* SEARCH ITEMS MODAL */}

        <div className="-mx-3 sm:mx-0 px-3 sm:px-0 pt-2 pb-0">
          <div className="bg-white rounded-xl shadow-lg p-3">
            <div className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">Search Items</div>

            <div className="relative autocomplete-container">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addItem()}
                  placeholder="Search or add new item"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
                />
                <button
                  type="button"
                  onClick={addItem}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-2xl font-semibold hover:bg-indigo-700 transition whitespace-nowrap"
                >
                  Add
                </button>
              </div>

              {showAutocomplete && autocompleteItems.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-2xl shadow-lg max-h-60 overflow-y-auto">
                  {autocompleteItems.slice(0, 10).map((item) => {
                    const itemData = items.find((i) => i.name === item);
                    const isFavorite = itemData?.is_favorite || false;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => selectFromAutocomplete(item)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-gray-800 flex items-center gap-2"
                      >
                        {isFavorite && <span className="text-yellow-500 text-lg">⭐</span>}
                        {item}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-2 text-xs text-gray-500 flex justify-between">
              <span>
                {inputValue.trim() && !itemExists
                  ? `"${inputValue}" will be added as a new item`
                  : loading
                  ? 'Loading…'
                  : `${filtered.length} shown / ${items.length} total`}
              </span>
              <span className="hidden sm:inline">Tip: search → tap item → rename</span>
            </div>
          </div>
        </div>

        {/* ALL ITEMS MODAL */}
        <div className="bg-white rounded-xl shadow-lg p-3 pt-2 sm:p-4">
          {loading ? (
            <div className="text-gray-600 text-sm">Loading items…</div>
          ) : (
            (() => {
              const isFavoritesView = selectItemsFilter === 'FAVORITES';

              // One unified list:
              // - ALL: favorites + regular, but sorted alphabetically (no favorites-on-top)
              // - FAVORITES: favorites only
              const unifiedItems = (isFavoritesView ? favorites : [...favorites, ...regular])
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name));

              const listClassMobile = 'max-h-[520px] overflow-y-auto';
              const listClassDesktop = 'max-h-[520px] overflow-y-auto';
              const LIST_MAX = 'max-h-[calc(10*3.65rem)] overflow-y-auto';

              return (
                <>
                  {/* Filters - All Items and Favorites */}
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
                      {isFavoritesView ? 'Favorites' : 'All Items'}
                    </h2>
                    <span className="text-xs text-gray-500">{unifiedItems.length} shown</span>
                  </div>

                  <div className="grid grid-flow-col auto-cols-fr gap-2 mb-3">
                    <button
                      onClick={() => setSelectItemsFilter('ALL')}
                      className={`px-3 py-1 rounded-full text-sm font-semibold border transition cursor-pointer ${
                        selectItemsFilter === 'ALL'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-gray-200 hover:bg-slate-50'
                      }`}
                    >
                      All Items
                    </button>

                    <button
                      onClick={() => setSelectItemsFilter('FAVORITES')}
                      className={`px-3 py-1 rounded-full text-sm font-semibold border transition cursor-pointer ${
                        selectItemsFilter === 'FAVORITES'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'
                      }`}
                    >
                      Favorites
                    </button>
                  </div>

                  {/* Empty states */}
                  {isFavoritesView && favorites.length === 0 ? (
                    <div className="text-sm text-gray-500 italic">
                      Favorite your high-frequency items to keep them on top.
                    </div>
                  ) : !isFavoritesView && unifiedItems.length === 0 ? (
                    <div className="text-sm text-gray-500 italic">No matches. Try a different search.</div>
                  ) : (
                    <>
                      {/* ONE list (mobile + desktop), preserves favorite styling + star behavior */}
                      <div className={`md:hidden space-y-2 ${LIST_MAX}`}>
                        {unifiedItems.map((item) => {
                          const isFavorite = favorites.some((f) => f.name === item.name);
                          return renderMobileRow(item, isFavorite);
                        })}
                      </div>

                      <div className={`hidden md:block space-y-2 ${LIST_MAX}`}>
                        {unifiedItems.map((item) => {
                          const isFavorite = favorites.includes(item);
                          return renderDesktopRow(item, isFavorite);
                        })}
                      </div>
                    </>
                  )}
                </>
              );
            })()
          )}
        </div>
      </div>

{/* EDIT ITEM bottom-slideup (mobile only) */}
{sheetOpen && selected && (
  <div className="fixed inset-0 z-50 md:hidden" aria-modal="true" role="dialog">
    <div className="absolute inset-0 bg-black/40" onClick={closeSheet} />

    <div
      className="absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-2xl p-4"
      style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
    >
      <div className="max-h-[85vh] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={closeSheet}
            className="px-3 py-1 rounded-2xl border border-gray-200 text-gray-700 hover:bg-gray-50"
            aria-label="Close"
            disabled={saving}
          >
            ✕
          </button>

          <div className="font-semibold text-gray-800">Edit Item</div>

          {canDeleteItem(selected) && (
            <button
              type="button"
              onClick={() => deleteItem(selected.name)}
              className="px-3 py-1 rounded-2xl border border-red-200 text-red-700 hover:bg-red-50 font-semibold"
              disabled={saving}
            >
              Delete
            </button>
          )}
          {!canDeleteItem(selected) && <div className="w-16"></div>}
        </div>

        {/* Name + Favorite Star */}
        <div className="mt-3">
          <label className="text-sm font-semibold text-gray-700">Favorite & Item Name</label>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditFavorite((p) => !p)}
              className={
                editFavorite
                  ? 'text-4xl leading-none flex-shrink-0 px-1 cursor-pointer'
                  : 'text-4xl leading-none flex-shrink-0 px-1 text-gray-300 cursor-pointer'
              }
              
              aria-label={editFavorite ? 'Unfavorite item' : 'Favorite item'}
              title={editFavorite ? 'Unfavorite' : 'Favorite'}
              disabled={saving}
            >
              {editFavorite ? '⭐' : '☆'}
            </button>

            <input
              ref={nameInputRef}
              id="item-rename-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveRename()}
              className="flex-1 px-3 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 text-base"
              placeholder="e.g., Grapefruit (ct)"
              disabled={saving}
            />
          </div>
        </div>

        {/* Category Select */}
        <div className="mt-3">
          <label className="text-sm font-semibold text-gray-700">Category</label>
          <select
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value)}
            className="w-full mt-1 px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-200 bg-white text-gray-800 text-base"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        
        {/* Save Button */}
        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={saveRename}
            className="w-1/2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  </div>
)}

    </div>
  </div>
</div>
  );
}

export default function ItemsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <ItemsContent />
    </Suspense>
  );
}