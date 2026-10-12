'use client';

import { Fragment, useRef } from 'react';
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
  recentItemMeta: Record<number, { checked_at: string; store: string | null }>;
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
  onCloseAutocomplete: () => void;

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
  recentItemMeta,
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
  onCloseAutocomplete,
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

  // Filter by search query (newItem)
  if (newItem.trim()) {
    const searchTerm = newItem.trim().toLowerCase();
    list = list.filter((it) => it.name.toLowerCase().includes(searchTerm));
  }

  // Show all items (no limit) - use search/filters to narrow down
  const renderList = list;

  // Group recent items by the trip they were last bought on (local day + store)
  const getRecentTripGroup = (itemId: number): { key: string; label: string } | null => {
    const meta = recentItemMeta[itemId];
    if (!meta) return null;
    const d = new Date(meta.checked_at);
    const dayKey = d.toLocaleDateString('en-CA');
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const dayLabel =
      dayKey === today.toLocaleDateString('en-CA') ? 'Today'
        : dayKey === yesterday.toLocaleDateString('en-CA') ? 'Yesterday'
          : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return {
      key: `${dayKey}|${meta.store ?? ''}`,
      label: meta.store ? `${dayLabel} · ${meta.store}` : dayLabel,
    };
  };

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
    <div className="bg-bb-panel border border-bb-line rounded-2xl shadow-sm p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-semibold text-bb-cream">
          My Pantry <span className="text-sm text-bb-muted font-normal">({list.length.toLocaleString()})</span>
        </h2>
      </div>

      {/* Search Bar */}
      <div className="mb-3">
        <SearchItemInput
          value={newItem}
          onChange={onNewItemChange}
          onFocus={onSearchFocus}
          placeholder="Search items..."
          showAutocomplete={showAutocomplete}
          autocompleteItems={autocompleteItems}
          onSelectAutocomplete={(itemName) => {
            // Just set the search value to filter the list, don't auto-add
            onNewItemChange(itemName);
          }}
          onCloseAutocomplete={onCloseAutocomplete}
          showSubmitButton={false}
        />

        {/* Show "Create & Add" button when search doesn't match any existing items */}
        {newItem.trim() && !allItems.some(item => item.name.toLowerCase() === newItem.trim().toLowerCase()) && (
          <button
            onClick={onAddNewItem}
            className="mt-2 w-full bg-bb-gold hover:brightness-110 text-bb-navy px-4 py-2 rounded-2xl font-semibold cursor-pointer transition flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create & Add "{newItem.trim()}"
          </button>
        )}
      </div>

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
          className="hidden md:flex items-center justify-center w-8 h-8 rounded-full border border-bb-line bg-white/5 hover:bg-white/10 text-bb-muted hover:text-bb-cream cursor-pointer transition flex-shrink-0"
          aria-label="Scroll left"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        {/* Pinned "All" Button */}
        <button
          onClick={() => onFilterLetterChange('All')}
          className={`px-2.5 py-1.5 md:px-3 md:py-1 rounded text-sm md:text-base font-semibold cursor-pointer transition whitespace-nowrap flex-shrink-0 ${filterLetter === 'All' ? 'bg-bb-gold text-bb-navy' : 'bg-white/5 text-bb-muted hover:text-bb-cream hover:bg-white/10'
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
                className={`min-w-[2.25rem] md:min-w-[2.5rem] flex items-center justify-center px-2.5 py-1.5 md:px-3 md:py-1 rounded text-sm md:text-base font-semibold cursor-pointer transition whitespace-nowrap ${filterLetter === letter ? 'bg-bb-gold text-bb-navy' : 'bg-white/5 text-bb-muted hover:text-bb-cream hover:bg-white/10'
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
          className="hidden md:flex items-center justify-center w-8 h-8 rounded-full border border-bb-line bg-white/5 hover:bg-white/10 text-bb-muted hover:text-bb-cream cursor-pointer transition flex-shrink-0"
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
            ? 'bg-bb-gold text-bb-navy border-bb-gold'
            : 'bg-transparent text-bb-muted border-bb-line hover:bg-white/5 hover:text-bb-cream'
            }`}
        >
          Favorites
        </button>

        {/* 2. Frequent */}
        <button
          onClick={() => toggleFilter('FREQUENT')}
          className={`py-1.5 rounded-2xl border transition text-sm font-bold truncate cursor-pointer ${selectItemsFilter === 'FREQUENT'
            ? 'bg-bb-gold text-bb-navy border-bb-gold'
            : 'bg-transparent text-bb-muted border-bb-line hover:bg-white/5 hover:text-bb-cream'
            }`}
        >
          Frequent
        </button>

        {/* 3. Recent */}
        <button
          onClick={() => toggleFilter('RECENT')}
          className={`py-1.5 rounded-2xl border transition text-sm font-bold truncate cursor-pointer ${selectItemsFilter === 'RECENT'
            ? 'bg-bb-gold text-bb-navy border-bb-gold'
            : 'bg-transparent text-bb-muted border-bb-line hover:bg-white/5 hover:text-bb-cream'
            }`}
        >
          Recent
        </button>
      </div>

      {/* Item List */}
      {list.length === 0 ? (
        <div className="text-bb-muted text-center py-8">
          {selectItemsFilter === 'FAVORITES' ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">⭐</span>
              <p className="font-semibold text-bb-cream">No favorites yet</p>
              <p className="text-sm">Star items to easily find them here. Click the Favorites tab again to clear the filter.</p>
            </div>
          ) : selectItemsFilter === 'FREQUENT' ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">📈</span>
              <p className="font-semibold text-bb-cream">No frequently bought items</p>
              <p className="text-sm">Items you buy often will appear here. Click the Frequent tab again to clear the filter.</p>
            </div>
          ) : selectItemsFilter === 'RECENT' ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">🕒</span>
              <p className="font-semibold text-bb-cream">No recent items</p>
              <p className="text-sm">Items you've bought recently will appear here. Click the Recent tab again to clear the filter.</p>
            </div>
          ) : (
            <div className="text-sm">Loading items...</div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 max-h-[400px] md:max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar pr-2">
          {renderList.map((it: ItemRow, idx: number) => {
            const isFavorite = favorites.includes(it.name);

            // Recent view: header above each trip (purchase day + store)
            const tripGroup = selectItemsFilter === 'RECENT' ? getRecentTripGroup(it.id) : null;
            const showTripHeader =
              tripGroup !== null && (idx === 0 || getRecentTripGroup(renderList[idx - 1].id)?.key !== tripGroup.key);

            // Price logic
            const effStore = getEffectiveStore(it.name);
            const storeId = effStore ? storesByName[effStore] : null;

            // Try ID-based key first (stable even if renamed), then fallback to name-based
            const idKey = storeId ? `id:${storeId}-${it.id}` : null;
            const nameKey = effStore ? `${effStore}-${it.name}` : null;

            const priceData = (idKey && prices[idKey]) || (nameKey ? prices[nameKey] : null);
            const price = priceData?.price ? parseFloat(priceData.price) : 0;

            return (
              <Fragment key={it.id}>
              {showTripHeader && (
                <div className={`text-xs font-bold text-bb-muted uppercase tracking-wider px-1 ${idx === 0 ? '' : 'pt-2'}`}>
                  {tripGroup!.label}
                </div>
              )}
              <div
                className={`flex flex-wrap items-center gap-3 p-3 rounded-2xl border transition ${isFavorite
                  ? 'bg-white/[0.03] border-bb-gold/30 hover:bg-white/5'
                  : 'bg-white/[0.03] border-bb-line hover:bg-white/5'
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
                      });
                    }}
                    className="font-medium text-bb-cream hover:text-bb-gold cursor-pointer text-left break-words"
                  >
                    {it.name}
                  </button>

                  <div className="mt-1 flex items-center gap-2">
                    {(priceData && price > 0) ? (
                      <p className="text-xs text-bb-cream">
                        {formatMoney(price)}{' '}
                        <span className="text-bb-muted ml-1">
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
                        }, 'price')}
                        className="text-bb-gold text-xs font-semibold hover:underline cursor-pointer transition inline-block"
                      >
                        Add Price
                      </button>
                    )}

                    {(priceData && price > 0) && (() => {
                      const unitPrice = getFormattedUnitPrice(it.name, price);
                      return unitPrice ? (
                        <span className="text-bb-muted text-xs font-medium">• {unitPrice}</span>
                      ) : null;
                    })()}
                  </div>

                  {/* Active Note Preview */}
                  {it.active_note && (
                    <div className="mt-1 flex items-start gap-1 p-1 bg-bb-gold/10 border border-bb-gold/20 rounded text-xs text-bb-gold max-w-fit">
                      <span className="select-none text-xs">⚠️</span>
                      <div className="flex-1">
                        <span className="font-semibold line-clamp-1">{it.active_note.note}</span>
                        {it.active_note.store_id && (
                          <div className="text-[10px] text-bb-gold/80">
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
                    className="flex items-center justify-center gap-1 bg-transparent hover:bg-bb-red/10 text-bb-muted hover:text-bb-red border border-bb-line hover:border-bb-red/30 text-sm font-semibold px-3 py-1.5 rounded-xl transition cursor-pointer"
                    title="Remove from list"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={() => onToggleItemById(it.id, it.name)}
                    className="bg-bb-gold hover:brightness-110 text-bb-navy text-sm font-semibold px-3.5 py-1.5 rounded-xl transition cursor-pointer"
                  >
                    Add
                  </button>
                )}
              </div>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
