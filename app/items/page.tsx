'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import Header from '../components/Header';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useSearchParams } from 'next/navigation';
import { useCategories } from '../hooks/useCategories';
import GlobalItemEditModal from '../components/GlobalItemEditModal';
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
  id: number;
  name: string;
  category_id?: number | null;
  household_code?: string;
  unit: string;
  is_weighted: boolean;
}


function ItemsContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoritedIds, setFavoritedIds] = useState<Set<number>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());

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

  // View Filter: ALL (default), FAVORITES, or HIDDEN
  const [viewFilter, setViewFilter] = useState<'ALL' | 'FAVORITES' | 'HIDDEN'>('ALL');

  // Modal edit
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);

  // Desktop inline edit
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [inlineSaving, setInlineSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const editRowRef = useRef<HTMLDivElement | null>(null);

  const { categories, getCategoryName } = useCategories();
  // Sort categories alphabetically or however desired
  const categoryOptions = categories.map(c => c.name).sort();

  useEffect(() => {
    loadItems();
  }, [householdCode]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalOpen) closeModal();
      if (e.key === 'Escape' && editingName) cancelInlineEdit();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen, editingName]);

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

  // Handle URL param for direct item editing
  useEffect(() => {
    if (items.length === 0 || !searchParams) return;

    const itemParam = searchParams.get('item');
    if (!itemParam) return;

    try {
      const itemName = JSON.parse(itemParam);
      const found = items.find(i => i.name === itemName);
      if (found) {
        openModal(found);
      }
    } catch (e) {
      console.error('Invalid item param:', e);
    }
  }, [items, searchParams]);


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
    if (!householdCode) return;
    setLoading(true);

    let query = supabase
      .from('items')
      .select('id, name, category_id, household_code, unit, is_weighted')
      .order('name');

    if (householdCode !== 'TEST') {
      query = query.or('household_code.neq.TEST,household_code.is.null');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading items:', error);
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      setItems(
        data.map((x: any) => ({
          id: x.id,
          name: x.name,
          category_id: x.category_id,
          household_code: x.household_code,
          unit: x.unit || 'each',
          is_weighted: x.is_weighted || false,
        }))
      );
    } else {
      // Seed defaults once if empty
      for (const name of DEFAULT_ITEMS) {
        await supabase.from('items').insert({
          name,
          household_code: householdCode || 'ASDF',
        });
      }
      const defaultItems = DEFAULT_ITEMS.map((name, idx) => ({
        id: idx + 1, // temporary IDs
        name,
        category_id: null,
        household_code: householdCode || 'ASDF',
        unit: 'each',
        is_weighted: false,
      }));
      setItems(defaultItems);
    }

    // Load favorites for this household
    const { data: favData } = await supabase
      .from('household_item_favorites')
      .select('item_id')
      .eq('household_code', householdCode);

    setFavoritedIds(new Set(favData?.map(f => f.item_id) || []));

    // Load hidden items for this household
    const { data: hiddenData } = await supabase
      .from('household_item_hidden')
      .select('item_id')
      .eq('household_code', householdCode);

    setHiddenIds(new Set(hiddenData?.map(h => h.item_id) || []));

    setLoading(false);
  };


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

    // 1. Filter by View (Active vs Hidden vs Favorites)
    if (viewFilter === 'HIDDEN') {
      base = base.filter(i => hiddenIds.has(i.id));
    } else if (viewFilter === 'FAVORITES') {
      base = base.filter(i => favoritedIds.has(i.id) && !hiddenIds.has(i.id));
    } else {
      // ALL: Show everything (Active + Hidden)
      // no-op
    }

    // 2. Filter by Search Input
    if (inputValue.trim()) {
      base = base.filter((i) => i.name.toLowerCase().includes(inputValue.toLowerCase()));
    }

    // 3. Filter by Letter
    if (filterLetter === 'All') return base.sort((a, b) => a.name.localeCompare(b.name));

    return base
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((i) => i.name.toUpperCase().startsWith(filterLetter));
  }, [items, inputValue, filterLetter, viewFilter, hiddenIds, favoritedIds]);

  const favorites = useMemo(
    () => filtered.filter((i) => favoritedIds.has(i.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [filtered, favoritedIds]
  );

  const regular = useMemo(
    () => filtered.filter((i) => !favoritedIds.has(i.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [filtered, favoritedIds]
  );

  const canDeleteItem = (item: Item): boolean => {
    return isMasterAccount || item.household_code === householdCode;
  };

  const openModal = (item: Item) => {
    setSelected(item);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelected(null);
  };

  const addItem = async () => {
    const name = inputValue.trim();
    if (!name) return;

    if (items.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
      alert('That item already exists.');
      return;
    }

    const { data: newItem, error } = await supabase
      .from('items')
      .insert({
        name,
        household_code: householdCode || 'ASDF',
      })
      .select('id, name, category_id, household_code, unit, is_weighted')
      .single();

    if (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item. Check your connection and try again.');
      return;
    }

    if (newItem) {
      setItems((prev) => [...prev, {
        id: newItem.id,
        name: newItem.name,
        category_id: newItem.category_id,
        household_code: newItem.household_code,
        unit: newItem.unit || 'each',
        is_weighted: newItem.is_weighted || false,
      }]);

      if (viewFilter === 'FAVORITES') {
        toggleFavorite(newItem.id);
      }
    }

    setInputValue('');
    setShowAutocomplete(false);
    inputRef.current?.focus();
  };

  const handleSuggestionClick = async (name: string) => {
    let item = items.find(i => i.name.toLowerCase() === name.toLowerCase());

    if (!item) {
      const { data, error } = await supabase
        .from('items')
        .insert({
          name,
          household_code: householdCode || 'ASDF',
        })
        .select('id, name, category_id, household_code, unit, is_weighted')
        .single();

      if (error) {
        console.error('Error adding suggestion:', error);
        return;
      }

      item = {
        id: data.id,
        name: data.name,
        category_id: data.category_id,
        household_code: data.household_code,
        unit: data.unit || 'each',
        is_weighted: data.is_weighted || false,
      };

      setItems(prev => [...prev, item!]);
    }

    if (item && !favoritedIds.has(item.id)) {
      toggleFavorite(item.id);
    }
  };

  const toggleFavorite = async (itemId: number) => {
    if (!householdCode) return;

    const isFavorited = favoritedIds.has(itemId);

    if (isFavorited) {
      // Remove from favorites
      const { error } = await supabase
        .from('household_item_favorites')
        .delete()
        .eq('household_code', householdCode)
        .eq('item_id', itemId);

      if (error) {
        console.error('Error removing favorite:', error);
        alert('Failed to update favorite. Check your connection and try again.');
        return;
      }

      setFavoritedIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    } else {
      // Add to favorites
      const { error } = await supabase
        .from('household_item_favorites')
        .insert({
          household_code: householdCode,
          item_id: itemId,
        });

      if (error) {
        console.error('Error adding favorite:', error);
        alert('Failed to update favorite. Check your connection and try again.');
        return;
      }

      setFavoritedIds(prev => new Set([...prev, itemId]));
    }
  };

  const toggleHidden = async (itemId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!householdCode) return;

    const isHidden = hiddenIds.has(itemId);

    if (isHidden) {
      // Unhide
      const { error } = await supabase
        .from('household_item_hidden')
        .delete()
        .eq('household_code', householdCode)
        .eq('item_id', itemId);

      if (error) {
        console.error('Error unhiding item:', error);
        return;
      }

      setHiddenIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    } else {
      // Hide
      // 1. Check if it's favorited, if so remove it (user rule: can't be both)
      if (favoritedIds.has(itemId)) {
        await supabase
          .from('household_item_favorites')
          .delete()
          .eq('household_code', householdCode)
          .eq('item_id', itemId);

        setFavoritedIds(prev => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }

      // 2. Add to hidden
      const { error } = await supabase
        .from('household_item_hidden')
        .insert({
          household_code: householdCode,
          item_id: itemId,
        });

      if (error) {
        console.error('Error hiding item:', error);
        return;
      }

      setHiddenIds(prev => new Set([...prev, itemId]));
    }
  };

  const deleteItem = async (item: Item) => {
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
        .eq('item_name', item.name);

      if (shoppingListError) {
        throw shoppingListError;
      }

      const { error: priceError } = await supabase
        .from('price_history')
        .delete()
        .eq('item_name', item.name);

      if (priceError) {
        throw priceError;
      }

      // Now delete from items table (safe because no references exist)
      const { error: itemError } = await supabase
        .from('items')
        .delete()
        .eq('id', item.id);

      if (itemError) {
        throw itemError;
      }

      // Update UI
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setFavoritedIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      setHiddenIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });

      if (selected?.id === item.id) closeModal();
      if (editingName === item.name) cancelInlineEdit();

    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item. Check your connection and try again.');
    }
  };

  const renameItem = async (itemId: number, oldName: string, nextNameRaw: string) => {
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
      .eq('id', itemId);

    if (itemError) throw new Error(itemError.message);

    // Cascade rename to all historical or active references using BOTH ID and old Name for robustness
    try {
      await Promise.all([
        supabase
          .from('price_history')
          .update({ item_name: nextName })
          .or(`item_id.eq.${itemId},item_name.eq."${oldName}"`),
        supabase
          .from('shopping_list')
          .update({ item_name: nextName })
          .or(`item_id.eq.${itemId},item_name.eq."${oldName}"`),
        supabase
          .from('shopping_list_events')
          .update({ item_name: nextName })
          .or(`item_id.eq.${itemId},item_name.eq."${oldName}"`)
      ]);
    } catch (cascadeError) {
      console.error('Error cascading item rename:', cascadeError);
      // We don't throw here as the primary item update succeeded
    }

    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, name: nextName } : i)));
  };

  const handleSaveItem = (updatedItem: Item, favoriteChanged?: boolean, nextFavorite?: boolean) => {
    // Update local items list
    setItems((prev) =>
      prev.map((i) => i.id === updatedItem.id ? updatedItem : i)
    );

    // Update favorites if changed
    if (favoriteChanged) {
      setFavoritedIds((prev) => {
        const next = new Set(prev);
        if (nextFavorite) {
          next.add(updatedItem.id);
        } else {
          next.delete(updatedItem.id);
        }
        return next;
      });
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
      const itemToRename = items.find(i => i.name === editingName);
      if (itemToRename) {
        await renameItem(itemToRename.id, editingName, editingValue);
      }
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
        key={item.id}
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
            toggleFavorite(item.id);
          }}
          disabled={viewFilter === 'HIDDEN'}
          className={
            isFavorite
              ? `text-2xl leading-none flex-shrink-0 px-1 ${viewFilter === 'HIDDEN' ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`
              : `text-2xl leading-none flex-shrink-0 px-1 text-gray-300 ${viewFilter === 'HIDDEN' ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`
          }
          aria-label={isFavorite ? 'Unfavorite item' : 'Favorite item'}
          title={viewFilter === 'HIDDEN' ? 'Unhide item to favorite' : (isFavorite ? 'Remove from Favorites' : 'Add to Favorites')}
        >
          {isFavorite ? '⭐' : '☆'}
        </button>

        <button
          type="button"
          onClick={() => openModal(item)}
          className="flex-1 text-left min-w-0"
        >
          <div className="font-medium text-gray-800 truncate">{item.name}</div>
          <div className="text-xs text-gray-500">Tap to edit</div>
        </button>

        {(viewFilter === 'ALL' || viewFilter === 'FAVORITES') && (
          <button
            type="button"
            onClick={(e) => toggleHidden(item.id, e)}
            className={hiddenIds.has(item.id) ? "p-2 text-red-600 hover:text-red-700" : "p-2 text-gray-400 hover:text-red-500"}
            title={hiddenIds.has(item.id) ? "Unhide item" : "Hide item"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={hiddenIds.has(item.id) ? 3 : 2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          </button>
        )}
        {viewFilter === 'HIDDEN' && (
          <button
            type="button"
            onClick={(e) => toggleHidden(item.id, e)}
            className="p-2 text-gray-400 hover:text-green-500"
            title="Unhide item"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  const renderDesktopRow = (item: Item, isFavorite: boolean) => {
    const isEditing = editingName === item.name;
    const canDelete = canDeleteItem(item);

    return (
      <div
        key={item.id}
        ref={isEditing ? editRowRef : null}
        className={
          isFavorite
            ? 'w-full flex items-center gap-3 p-3 rounded-xl bg-yellow-50 border border-yellow-200'
            : 'w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100'
        }
      >
        <button
          type="button"
          onClick={() => toggleFavorite(item.id)}
          disabled={inlineSaving || viewFilter === 'HIDDEN'}
          className={
            isFavorite
              ? `text-2xl leading-none flex-shrink-0 px-1 ${viewFilter === 'HIDDEN' ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`
              : `text-2xl leading-none flex-shrink-0 px-1 text-gray-300 ${viewFilter === 'HIDDEN' ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`
          }
          aria-label={isFavorite ? 'Unfavorite item' : 'Favorite item'}
          title={viewFilter === 'HIDDEN' ? 'Unhide item to favorite' : (isFavorite ? 'Remove from Favorites' : 'Add to Favorites')}
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

              <div className="flex items-center gap-1">
                {(viewFilter === 'ALL' || viewFilter === 'FAVORITES') && (
                  <button
                    type="button"
                    onClick={(e) => toggleHidden(item.id, e)}
                    className={hiddenIds.has(item.id) ? "text-red-600 hover:text-red-700 p-2" : "text-gray-300 hover:text-red-500 p-2"}
                    title={hiddenIds.has(item.id) ? "Unhide item" : "Hide item"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={hiddenIds.has(item.id) ? 3 : 2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  </button>
                )}
                {viewFilter === 'HIDDEN' && (
                  <button
                    type="button"
                    onClick={(e) => toggleHidden(item.id, e)}
                    className="text-gray-300 hover:text-green-500 p-2"
                    title="Unhide item"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                )}

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => deleteItem(item)}
                    className={`text-red-600 hover:text-red-800 cursor-pointer text-xl p-2 flex-shrink-0 ${viewFilter === 'HIDDEN' ? 'opacity-30 cursor-not-allowed' : ''}`}
                    title={viewFilter === 'HIDDEN' ? 'Unhide item before deleting' : 'Delete item'}
                    disabled={inlineSaving || viewFilter === 'HIDDEN'}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const itemExists = items.some((i) => i.name.toLowerCase() === inputValue.trim().toLowerCase());

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
              <Header currentPage="Favorite Items" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-2 md:px-6 pt-4">
        <div className="max-w-5xl mx-auto space-y-3">



          {/* Alphabet Filter */}
          <div className="bg-white rounded-2xl shadow-lg p-3 md:p-4 mb-4">
            <div className="flex flex-wrap gap-1.5 md:gap-2 justify-center">
              <button
                type="button"
                onClick={() => setFilterLetter('All')}
                className={`px-2.5 py-1.5 md:px-3 md:py-1 rounded text-sm md:text-base font-semibold cursor-pointer transition ${filterLetter === 'All'
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
                    className={`px-2.5 py-1.5 md:px-3 md:py-1 rounded text-sm md:text-base font-semibold cursor-pointer transition ${filterLetter === letter
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
                      const isFavorite = itemData ? favoritedIds.has(itemData.id) : false;
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
              </div>
            </div>
          </div>

          {/* ALL ITEMS MODAL */}
          <div className="bg-white rounded-xl shadow-lg p-3 pt-2 sm:p-4">
            {loading ? (
              <div className="text-gray-600 text-sm">Loading items…</div>
            ) : (
              <>
                {/* View Filters (Moved Here) - Styled like List Build Mode */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <button
                    onClick={() => setViewFilter('ALL')}
                    className={`py-1.5 rounded-2xl border transition text-sm font-bold truncate cursor-pointer flex items-center justify-center gap-2 ${viewFilter === 'ALL'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105'
                      : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300'
                      }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    All Items
                  </button>
                  <button
                    onClick={() => setViewFilter('FAVORITES')}
                    className={`py-1.5 rounded-2xl border transition text-sm font-bold truncate cursor-pointer flex items-center justify-center gap-2 ${viewFilter === 'FAVORITES'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-md transform scale-105'
                      : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-300'
                      }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.518 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.921-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    Favorites
                  </button>
                  <button
                    onClick={() => setViewFilter('HIDDEN')}
                    className={`py-1.5 rounded-2xl border transition text-sm font-bold truncate cursor-pointer flex items-center justify-center gap-2 ${viewFilter === 'HIDDEN'
                      ? 'bg-gray-400 text-white border-gray-400 shadow-md transform scale-105'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                    Hidden
                  </button>
                </div>


                <div className="mb-4 border-b border-gray-100"></div>

                {/* List Header / Stats */}
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
                    {viewFilter === 'HIDDEN' ? 'Hidden Items' : viewFilter === 'FAVORITES' ? 'Favorite Items' : 'All Items'}
                  </h2>
                  <div className="flex items-center gap-2">
                    {(inputValue !== '' || filterLetter !== 'All') && (
                      <button
                        onClick={() => {
                          setInputValue('');
                          setFilterLetter('All');
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer animate-in fade-in slide-in-from-right-2 duration-200"
                      >
                        Reset Search
                      </button>
                    )}
                    <span className="text-xs text-gray-500">{filtered.length} shown</span>
                  </div>
                </div>

                {/* No Items State */}
                {filtered.length === 0 && (
                  <>
                    {viewFilter === 'FAVORITES' && !inputValue && filterLetter === 'All' ? (
                      <div className="py-12 px-4 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 mt-2">
                        <div className="mb-4 inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full text-amber-600">
                          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">No Favorites Yet</h3>
                        <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                          Tap the star icon on any item to save it here for quick access later!
                        </p>

                        <div className="space-y-4">
                          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Popular Suggestions</p>
                          <div className="flex flex-wrap justify-center gap-2">
                            {DEFAULT_ITEMS.map((name) => (
                              <button
                                key={name}
                                onClick={() => handleSuggestionClick(name)}
                                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-amber-400 hover:bg-amber-50 transition-all shadow-sm cursor-pointer"
                              >
                                ⭐ {name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : viewFilter === 'HIDDEN' && !inputValue && filterLetter === 'All' ? (
                      <div className="py-12 px-4 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 mt-2">
                        <div className="mb-4 inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full text-gray-500">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">No Hidden Items</h3>
                        <p className="text-gray-500 max-w-sm mx-auto">
                          Not into soda? Don&apos;t have a dog? Hide it. Remove items from your list without deleting them.
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic py-4 text-center">
                        {viewFilter === 'HIDDEN'
                          ? "No hidden items found matching your search."
                          : "No items found."}
                      </div>
                    )}
                  </>
                )}

                {/* List Content */}
                {filtered.length > 0 && (
                  <>
                    {/* Mobile List */}
                    <div className="md:hidden space-y-2 max-h-[calc(10*3.65rem)] overflow-y-auto">
                      {filtered.map((item) => {
                        const isFavorite = favoritedIds.has(item.id);
                        return renderMobileRow(item, isFavorite);
                      })}
                    </div>

                    {/* Desktop List */}
                    <div className="hidden md:block space-y-2 max-h-[calc(10*3.65rem)] overflow-y-auto">
                      {filtered.map((item) => {
                        const isFavorite = favoritedIds.has(item.id);
                        return renderDesktopRow(item, isFavorite);
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Global Item Edit Modal */}
        <GlobalItemEditModal
          isOpen={modalOpen}
          onClose={closeModal}
          item={selected}
          householdCode={householdCode}
          categories={categories}
          isFavorited={selected ? favoritedIds.has(selected.id) : false}
          onSave={handleSaveItem}
        />

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
