'use client';

import { useRef } from 'react';
import SearchItemInput from './SearchItemInput';

interface ItemNote {
  id: string;
  item_id: number;
  note: string;
  store_id?: string;
  created_at: string;
}

interface ItemRow {
  id: number;
  name: string;
  category?: string;
  category_id?: number;
  active_note?: ItemNote | null;
}

interface ListItem {
  id: string;
  item_id: number;
  item_name: string;
  quantity: number;
  checked: boolean;
  is_priority: boolean;
  category_id?: number | null;
  category?: string | null;
  active_note?: ItemNote;
}

interface PriceData {
  price: string;
  date: string;
}

type SelectItemsFilter = 'FAVORITES' | 'RECENT' | 'FREQUENT' | null;

interface ItemLibraryProps {
  // Data
  allItems: ItemRow[];
  buildModeAvailableAll: ItemRow[];
  listIds: Set<number>;
  favorites: string[];
  recentRank: Map<number, number>;
  frequentItemCounts: Record<string, number> | Record<number, number>;
  prices: { [key: string]: PriceData };
  storesByName: { [name: string]: string };

  // Filter state
  filterLetter: string;
  selectItemsFilter: SelectItemsFilter;
  onFilterLetterChange: (letter: string) => void;
  onSelectItemsFilterChange: (filter: SelectItemsFilter) => void;

  // Search state
  newItem: string;
  showAutocomplete: boolean;
  autocompleteItems: string[];
  onNewItemChange: (value: string) => void;
  onSearchFocus: () => void;

  // Actions
  onToggleFavorite: (itemName: string) => void;
  onToggleItemById: (itemId: number, itemName: string) => void;
  onAddNewItem: () => void;
  onSelectItem: (itemName: string) => void;
  onOpenEditModal: (item: ListItem, focusField?: 'name' | 'price' | 'category' | 'note') => void;

  // Helper functions
  getEffectiveStore: (itemName: string) => string | null;
  formatMoney: (amount: number) => string;
  getDaysAgo: (dateString: string) => string;
  getFormattedUnitPrice: (itemName: string, price: number) => string | null;
}

export default function ItemLibrary({
  allItems,
  buildModeAvailableAll,
  listIds,
  favorites,
  recentRank,
  frequentItemCounts,
  prices,
  storesByName,
  filterLetter,
  selectItemsFilter,
  onFilterLetterChange,
  onSelectItemsFilterChange,
  newItem,
  showAutocomplete,
  autocompleteItems,
  onNewItemChange,
  onSearchFocus,
  onToggleFavorite,
  onToggleItemById,
  onAddNewItem,
  onSelectItem,
  onOpenEditModal,
  getEffectiveStore,
  formatMoney,
  getDaysAgo,
  getFormattedUnitPrice,
}: ItemLibraryProps) {
  const alphabetScrollRef = useRef<HTMLDivElement>(null);

  // Alphabet for filtering
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // Filter logic
  let list: ItemRow[] = buildModeAvailableAll;

  if (selectItemsFilter === 'FAVORITES') {
    const favSet = new Set(favorites);
    list = list.filter((it) => favSet.has(it.name));
  } else if (selectItemsFilter === 'RECENT') {
    list = list
      .filter((it) => recentRank.has(it.id))
      .sort((a, b) => (recentRank.get(a.id) ?? Infinity) - (recentRank.get(b.id) ?? Infinity));
  } else if (selectItemsFilter === 'FREQUENT') {
    const counts = frequentItemCounts as Record<number, number>;
    list = list
      .filter((it) => counts[it.id] !== undefined)
      .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
  } else {
    list = list.slice();
  }

  if (filterLetter !== 'All') {
    const L = filterLetter.toUpperCase();
    list = list.filter((it) => it.name.toUpperCase().startsWith(L));
  }

  const renderList = list.slice(0, 250);

  // Toggle filter logic
  const toggleFilter = (filter: SelectItemsFilter) => {
    if (selectItemsFilter === filter) {
      onSelectItemsFilterChange(null); // Toggle off -> All
    } else {
      onSelectItemsFilterChange(filter);
    }
  };

  const toggleLetter = (letter: string) => {
    if (filterLetter === letter) {
      onFilterLetterChange('All');
    } else {
      onFilterLetterChange(letter);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-semibold text-gray-800">
          Item Library <span className="text-sm text-gray-500 font-normal">({list.length})</span>
        </h2>
      </div>

      {/* Search Bar */}
      <SearchItemInput
        value={newItem}
        onChange={onNewItemChange}
        onSubmit={onAddNewItem}
        onFocus={onSearchFocus}
        placeholder="Search items to add..."
        showAutocomplete={showAutocomplete}
        autocompleteItems={autocompleteItems}
        onSelectAutocomplete={onSelectItem}
        className="mb-3"
      />

      {/* Alphabet Filter */}
      <div className="relative flex items-center gap-2 mb-3">
        {/* Left Arrow - Desktop Only */}
        <button
          onClick={() => {
            if (alphabetScrollRef.current) {
              const scrollAmount = alphabetScrollRef.current.clientWidth;
              alphabetScrollRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            }
          }}
          className="hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-600 cursor-pointer transition flex-shrink-0"
          aria-label="Scroll left"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        {/* Pinned "All" Button */}
        <button
          onClick={() => onFilterLetterChange('All')}
          className={`px-2.5 py-1.5 md:px-3 md:py-1 rounded text-sm md:text-base font-semibold cursor-pointer transition whitespace-nowrap flex-shrink-0 ${filterLetter === 'All' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          All
        </button>

        {/* Scrollable Alphabet Buttons */}
        <div
          ref={alphabetScrollRef}
          className="flex gap-1.5 md:gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex-1"
        >
          {alphabet
            .filter((letter) => allItems.some((it) => it.name.toUpperCase().startsWith(letter)))
            .map((letter) => (
              <button
                key={letter}
                onClick={() => toggleLetter(letter)}
                className={`min-w-[2.25rem] md:min-w-[2.5rem] flex items-center justify-center px-2.5 py-1.5 md:px-3 md:py-1 rounded text-sm md:text-base font-semibold cursor-pointer transition whitespace-nowrap ${filterLetter === letter ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {letter}
              </button>
            ))}
        </div>

        {/* Right Arrow - Desktop Only */}
        <button
          onClick={() => {
            if (alphabetScrollRef.current) {
              const scrollAmount = alphabetScrollRef.current.clientWidth;
              alphabetScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
          }}
          className="hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-600 cursor-pointer transition flex-shrink-0"
          aria-label="Scroll right"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      {/* Filter Pills (Favorites/Frequent/Recent) */}
      <div className="grid grid-cols-3 gap-2 w-full mb-2">
        {/* 1. Favorites */}
        <button
          onClick={() => toggleFilter('FAVORITES')}
          className={`py-1.5 rounded-2xl border transition text-sm font-bold truncate cursor-pointer ${selectItemsFilter === 'FAVORITES'
            ? 'bg-amber-600 text-white border-amber-600 shadow-md transform scale-105'
            : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-300'
            }`}
        >
          Favorites
        </button>

        {/* 2. Frequent */}
        <button
          onClick={() => toggleFilter('FREQUENT')}
          className={`py-1.5 rounded-2xl border transition text-sm font-bold truncate cursor-pointer ${selectItemsFilter === 'FREQUENT'
            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105'
            : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300'
            }`}
        >
          Frequent
        </button>

        {/* 3. Recent */}
        <button
          onClick={() => toggleFilter('RECENT')}
          className={`py-1.5 rounded-2xl border transition text-sm font-bold truncate cursor-pointer ${selectItemsFilter === 'RECENT'
            ? 'bg-red-500 text-white border-red-500 shadow-md transform scale-105'
            : 'bg-white text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300'
            }`}
        >
          Recent
        </button>
      </div>

      {/* Item List */}
      {list.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          {selectItemsFilter === 'FAVORITES' ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">⭐</span>
              <p className="font-semibold text-gray-700">No favorites yet</p>
              <p className="text-sm">Star items to easily find them here. Click the Favorites tab again to clear the filter.</p>
            </div>
          ) : selectItemsFilter === 'FREQUENT' ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">📈</span>
              <p className="font-semibold text-gray-700">No frequently bought items</p>
              <p className="text-sm">Items you buy often will appear here. Click the Frequent tab again to clear the filter.</p>
            </div>
          ) : selectItemsFilter === 'RECENT' ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">🕒</span>
              <p className="font-semibold text-gray-700">No recent items</p>
              <p className="text-sm">Items you've bought recently will appear here. Click the Recent tab again to clear the filter.</p>
            </div>
          ) : (
            <div className="text-sm">Loading items...</div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 max-h-[400px] md:max-h-[785px] overflow-y-auto custom-scrollbar pr-2">
          {renderList.map((it: ItemRow) => {
            const isFavorite = favorites.includes(it.name);

            // Price logic
            const effStore = getEffectiveStore(it.name);
            const storeId = effStore ? storesByName[effStore] : null;

            // Try ID-based key first (stable even if renamed), then fallback to name-based
            const idKey = storeId ? `id:${storeId}-${it.id}` : null;
            const nameKey = effStore ? `${effStore}-${it.name}` : null;

            const priceData = (idKey && prices[idKey]) || (nameKey ? prices[nameKey] : null);
            const price = priceData?.price ? parseFloat(priceData.price) : 0;

            return (
              <div
                key={it.id}
                className={`flex flex-wrap items-center gap-3 p-3 rounded-2xl border transition ${isFavorite
                  ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                  : 'bg-white border-gray-300 hover:bg-gray-50'
                  }`}
              >
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => {
                      onOpenEditModal({
                        id: '', // Virtual ID
                        item_id: it.id,
                        item_name: it.name,
                        quantity: 1, // Default
                        checked: false,
                        is_priority: false,
                        category_id: it.category_id,
                        category: it.category
                      });
                    }}
                    className="font-medium text-gray-800 hover:text-teal-600 cursor-pointer text-left break-words"
                  >
                    {it.name}
                  </button>

                  <div className="mt-1 flex items-center gap-2">
                    {(priceData && price > 0) ? (
                      <p className="text-xs text-green-600">
                        {formatMoney(price)}{' '}
                        <span className="text-gray-400 ml-1">
                          ({getDaysAgo(priceData.date)}, {effStore})
                        </span>
                      </p>
                    ) : (
                      <button
                        onClick={() => onOpenEditModal({
                          id: '', // Virtual ID
                          item_id: it.id,
                          item_name: it.name,
                          quantity: 1,
                          checked: false,
                          is_priority: false,
                          category_id: it.category_id,
                          category: it.category
                        }, 'price')}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition inline-block"
                      >
                        Add Price
                      </button>
                    )}

                    {(priceData && price > 0) && (() => {
                      const unitPrice = getFormattedUnitPrice(it.name, price);
                      return unitPrice ? (
                        <span className="text-teal-600 text-xs font-medium">• {unitPrice}</span>
                      ) : null;
                    })()}
                  </div>

                  {/* Active Note Preview */}
                  {it.active_note && (
                    <div className="mt-1 flex items-start gap-1 p-1 bg-orange-50 border border-orange-100 rounded text-xs text-orange-800 max-w-fit">
                      <span className="select-none text-xs">⚠️</span>
                      <div className="flex-1">
                        <span className="font-semibold line-clamp-1">{it.active_note.note}</span>
                        {it.active_note.store_id && (
                          <div className="text-[10px] text-orange-600">
                            at {Object.keys(storesByName).find(name => storesByName[name] === it.active_note?.store_id) || 'Unknown Store'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {listIds.has(it.id) ? (
                  <button
                    onClick={() => onToggleItemById(it.id, it.name)}
                    className="flex items-center justify-center gap-1 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 border border-gray-100 hover:border-red-100 text-sm font-bold px-3 py-2 rounded-xl transition cursor-pointer"
                    title="Remove from list"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={() => onToggleItemById(it.id, it.name)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                  >
                    Add
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
