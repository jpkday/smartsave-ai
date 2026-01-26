'use client';

import StoreSection from './StoreSection';
import CategoryGroup from './CategoryGroup';
import SearchItemInput from './SearchItemInput';
import { DEFAULT_ITEMS } from '../../lib/constants';

interface ItemNote {
  id: string;
  item_id: number;
  note: string;
  store_id?: string;
  created_at: string;
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

interface Category {
  id: number;
  name: string;
  sort_order: number;
}

interface ShoppingListPanelProps {
  // State
  loading: boolean;
  listItems: ListItem[];
  showCheckedItems: boolean;
  showPriorityOnly: boolean;
  isMobile: boolean;
  mobileMode: 'store' | 'build';

  // Data
  favorites: string[];
  dealsItemNames: Set<string>;
  prices: { [key: string]: PriceData };
  storesByName: { [name: string]: string };
  storePrefs: Record<string, string>;
  categories: Category[];
  categoryOrder: Record<string, number>;
  activeTrips: { [store_id: string]: string };
  myActiveStoreId: string | null;

  // Search state (for quick add and empty state)
  newItem: string;
  showAutocomplete: boolean;
  autocompleteItems: string[];
  onNewItemChange: (value: string) => void;
  onSearchFocus: () => void;
  onAddNewItem: () => void;
  onSelectItem: (itemName: string) => void;

  // Actions
  onToggleShowChecked: () => void;
  onToggleShowPriority: () => void;
  onStartTrip: (storeId: string, storeName: string) => void;
  onEndTrip: (tripId: string, storeId: string) => void;
  onOpenPricePhotoCapture: () => void;
  onAddFavorites: () => void;

  // Item actions (passed through to children)
  onToggleChecked: (id: string) => void;
  onTogglePriority: (id: string) => void;
  onOpenEdit: (item: ListItem, focusField?: 'name' | 'price' | 'category' | 'note') => void;
  onOpenStoreModal: (itemName: string) => void;
  onRemove: (id: string) => void;
  onClearNote: (itemId: number, noteId: string) => void;

  // Helper functions
  getCategoryColorById: (id: number | null | undefined) => string;
  getCategoryName: (id?: number | null) => string;
  getEffectiveStore: (itemName: string) => string | null;
  getDaysAgo: (dateString: string) => string;
  formatMoney: (amount: number) => string;
}

export default function ShoppingListPanel({
  loading,
  listItems,
  showCheckedItems,
  showPriorityOnly,
  isMobile,
  mobileMode,
  favorites,
  dealsItemNames,
  prices,
  storesByName,
  storePrefs,
  categories,
  categoryOrder,
  activeTrips,
  myActiveStoreId,
  newItem,
  showAutocomplete,
  autocompleteItems,
  onNewItemChange,
  onSearchFocus,
  onAddNewItem,
  onSelectItem,
  onToggleShowChecked,
  onToggleShowPriority,
  onStartTrip,
  onEndTrip,
  onOpenPricePhotoCapture,
  onAddFavorites,
  onToggleChecked,
  onTogglePriority,
  onOpenEdit,
  onOpenStoreModal,
  onRemove,
  onClearNote,
  getCategoryColorById,
  getCategoryName,
  getEffectiveStore,
  getDaysAgo,
  formatMoney,
}: ShoppingListPanelProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
        <p className="text-slate-500 mt-4">Loading Shopping List...</p>
      </div>
    );
  }

  if (listItems.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-emerald-500 p-8 md:p-12 text-center text-white">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4 backdrop-blur-sm">
            <span className="text-3xl">🛒</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold mb-2 leading-tight">
            Your shopping list is empty
          </h2>
          <p className="text-base text-teal-50 opacity-90 max-w-2xl mx-auto font-medium">
            Add items below to start comparing prices and saving money.
          </p>
        </div>

        <div className="p-6 md:p-10 space-y-10">
          {/* Hero Search Section */}
          <div className="max-w-2xl mx-auto">
            <SearchItemInput
              value={newItem}
              onChange={onNewItemChange}
              onSubmit={onAddNewItem}
              placeholder="What do you need to buy?"
              showAutocomplete={showAutocomplete}
              autocompleteItems={autocompleteItems}
              onSelectAutocomplete={onSelectItem}
              variant="hero"
            />
          </div>

          {/* Suggestions Grid */}
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wider">Common Items</h3>
              {favorites.length > 0 && (
                <button
                  onClick={onAddFavorites}
                  className="text-amber-600 font-bold text-sm hover:underline cursor-pointer flex items-center gap-1"
                >
                  ⭐ Add all Favorites
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DEFAULT_ITEMS.map((name) => (
                <button
                  key={name}
                  onClick={() => onSelectItem(name)}
                  className="flex flex-col items-center justify-center p-4 bg-white border-2 border-gray-100 rounded-2xl hover:border-teal-400 hover:bg-teal-50 transition-all group shadow-sm hover:shadow-md cursor-pointer active:scale-95"
                >
                  <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">
                    {name.includes('Milk') ? '🥛' : name.includes('Eggs') ? '🥚' : name.includes('Cheese') ? '🧀' : name.includes('Apple') ? '🍎' : name.includes('Chicken') ? '🍗' : name.includes('Beef') ? '🥩' : name.includes('Bread') ? '🍞' : name.includes('Butter') ? '🧈' : '🛒'}
                  </span>
                  <span className="text-xs font-bold text-gray-700 text-center line-clamp-1">{name.split(' (')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Group items by effective store
  const itemsByStore: { [store: string]: ListItem[] } = {};
  const itemsWithoutPrice: ListItem[] = [];

  let displayItems = !showCheckedItems ? listItems.filter((item) => !item.checked) : listItems;

  // Priority Filter
  if (showPriorityOnly) {
    displayItems = displayItems.filter((item) => item.is_priority);
  }

  displayItems
    .sort((a, b) => {
      const aIsFav = favorites.includes(a.item_name);
      const bIsFav = favorites.includes(b.item_name);
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;
      return a.item_name.localeCompare(b.item_name);
    })
    .forEach((item) => {
      const effStore = getEffectiveStore(item.item_name);
      if (effStore) {
        if (!itemsByStore[effStore]) itemsByStore[effStore] = [];
        itemsByStore[effStore].push(item);
      } else {
        itemsWithoutPrice.push(item);
      }
    });

  const storeEntries = Object.entries(itemsByStore).sort(([storeA], [storeB]) => {
    const storeIdA = storesByName[storeA];
    const storeIdB = storesByName[storeB];

    const hasActiveTripA = storeIdA && activeTrips[storeIdA];
    const hasActiveTripB = storeIdB && activeTrips[storeIdB];

    if (hasActiveTripA && !hasActiveTripB) return -1;
    if (!hasActiveTripA && hasActiveTripB) return 1;

    return storeA.localeCompare(storeB);
  });

  return (
    <>
      {/* SHOPPING LIST HEADER */}
      <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">
            Shopping List <span className="text-xl text-gray-500 font-normal">({listItems.filter((i) => !i.checked && (!showPriorityOnly || i.is_priority)).length})</span>
          </h2>
          <div className="flex gap-2 items-center">
            {/* Camera Scan button */}
            {isMobile && mobileMode === 'store' && (
              <button
                onClick={onOpenPricePhotoCapture}
                className="bg-teal-600 text-white px-4 py-2 rounded-2xl font-semibold hover:bg-teal-700 cursor-pointer transition whitespace-nowrap flex items-center gap-2"
                title="Scan price tag"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                <span className="hidden md:inline">Scan</span>
              </button>
            )}

            <button
              onClick={onToggleShowPriority}
              className={`text-sm px-4 py-2 rounded-2xl font-semibold transition flex items-center gap-2 cursor-pointer ${showPriorityOnly
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'
                }`}
              title="Show Urgent Items Only"
            >
              <svg className="w-5 h-5" fill={showPriorityOnly ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V5h13l-3 4 3 4H3" />
              </svg>
            </button>

            {listItems.some((i) => i.checked) && (
              <button
                onClick={onToggleShowChecked}
                className="text-xs text-gray-600 hover:text-gray-800 font-semibold cursor-pointer"
              >
                {showCheckedItems ? 'Hide Checked' : 'Show Checked'}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6 md:max-h-[785px] overflow-y-auto custom-scrollbar pr-2">
          {/* Show First: Active trip stores */}
          {storeEntries
            .filter(([store]) => {
              const storeId = storesByName[store];
              return storeId && activeTrips[storeId];
            })
            .sort(([storeA], [storeB]) => {
              const idA = storesByName[storeA];
              const idB = storesByName[storeB];
              const isPinnedA = idA === myActiveStoreId;
              const isPinnedB = idB === myActiveStoreId;

              if (isPinnedA && !isPinnedB) return -1;
              if (!isPinnedA && isPinnedB) return 1;

              return storeA.localeCompare(storeB);
            })
            .map(([store, storeItems]) => {
              const storeId = storesByName[store];
              const hasActiveTrip = !!(storeId && activeTrips[storeId]);
              const isPinned = storeId === myActiveStoreId;
              const tripId = storeId ? activeTrips[storeId] : undefined;

              return (
                <StoreSection
                  key={store}
                  store={store}
                  storeId={storeId}
                  storeItems={storeItems}
                  hasActiveTrip={hasActiveTrip}
                  isPinned={isPinned}
                  tripId={tripId}
                  mobileMode={mobileMode}
                  isMobile={isMobile}
                  onEndTrip={onEndTrip}
                  categories={categories}
                  favorites={favorites}
                  dealsItemNames={dealsItemNames}
                  prices={prices}
                  storesByName={storesByName}
                  storePrefs={storePrefs}
                  getCategoryColorById={getCategoryColorById}
                  getCategoryName={getCategoryName}
                  getEffectiveStore={getEffectiveStore}
                  getDaysAgo={getDaysAgo}
                  onToggleChecked={onToggleChecked}
                  onTogglePriority={onTogglePriority}
                  onOpenEdit={onOpenEdit}
                  onOpenStoreModal={onOpenStoreModal}
                  onRemove={onRemove}
                  onClearNote={onClearNote}
                  activeTripsCount={Object.keys(activeTrips).length}
                />
              );
            })}

          {/* Second: All other stores alphabetically */}
          {storeEntries
            .filter(([store]) => {
              const storeId = storesByName[store];
              return !(storeId && activeTrips[storeId]);
            })
            .sort(([storeA], [storeB]) => {
              if (storeA === 'No Price Data' || storeA === 'Other Stores') return 1;
              if (storeB === 'No Price Data' || storeB === 'Other Stores') return -1;
              return storeA.localeCompare(storeB);
            })
            .map(([store, storeItems]) => {
              const storeId = storesByName[store];

              return (
                <StoreSection
                  key={store}
                  store={store}
                  storeId={storeId}
                  storeItems={storeItems}
                  hasActiveTrip={false}
                  mobileMode={mobileMode}
                  isMobile={isMobile}
                  onStartTrip={onStartTrip}
                  categories={categories}
                  favorites={favorites}
                  dealsItemNames={dealsItemNames}
                  prices={prices}
                  storesByName={storesByName}
                  storePrefs={storePrefs}
                  getCategoryColorById={getCategoryColorById}
                  getCategoryName={getCategoryName}
                  getEffectiveStore={getEffectiveStore}
                  getDaysAgo={getDaysAgo}
                  onToggleChecked={onToggleChecked}
                  onTogglePriority={onTogglePriority}
                  onOpenEdit={onOpenEdit}
                  onOpenStoreModal={onOpenStoreModal}
                  onRemove={onRemove}
                  onClearNote={onClearNote}
                  activeTripsCount={Object.keys(activeTrips).length}
                />
              );
            })}

          {/* Third: Items without price data */}
          {itemsWithoutPrice.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-700 mb-2 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-gray-400 text-white px-3 py-1 rounded-full text-sm">No Price Data</span>
                  <span className="text-sm text-gray-500">
                    {itemsWithoutPrice.length} {itemsWithoutPrice.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
              </h3>

              {/* Group items by category */}
              <div className="rounded-2xl border-2 border-gray-300 bg-white shadow-sm p-3 space-y-4">
                {Object.entries(
                  itemsWithoutPrice.reduce((acc: Record<number, typeof itemsWithoutPrice>, item) => {
                    const catId = item.category_id !== null && item.category_id !== undefined ? item.category_id : -1;
                    (acc[catId] ||= []).push(item);
                    return acc;
                  }, {})
                )
                  .sort(([catIdA], [catIdB]) => {
                    const idA = parseInt(catIdA);
                    const idB = parseInt(catIdB);
                    const orderA = categories.find(c => c.id === idA)?.sort_order || 999;
                    const orderB = categories.find(c => c.id === idB)?.sort_order || 999;
                    return orderA - orderB;
                  })
                  .map(([catIdStr, categoryItems]) => {
                    const catId = parseInt(catIdStr);
                    return (
                      <CategoryGroup
                        key={catId}
                        categoryId={catId}
                        categoryItems={categoryItems}
                        store="No Price Data"
                        storeId={undefined}
                        hasActiveTrip={false}
                        mobileMode={mobileMode}
                        activeTripsCount={Object.keys(activeTrips).length}
                        favorites={favorites}
                        dealsItemNames={dealsItemNames}
                        prices={prices}
                        storesByName={storesByName}
                        storePrefs={storePrefs}
                        getCategoryColorById={getCategoryColorById}
                        getCategoryName={getCategoryName}
                        getEffectiveStore={getEffectiveStore}
                        getDaysAgo={getDaysAgo}
                        onToggleChecked={onToggleChecked}
                        onTogglePriority={onTogglePriority}
                        onOpenEdit={onOpenEdit}
                        onOpenStoreModal={onOpenStoreModal}
                        onRemove={onRemove}
                        onClearNote={onClearNote}
                      />
                    );
                  })}
              </div>
            </div>
          )}

          {showPriorityOnly && displayItems.length === 0 && (
            <div className="mt-1 pt-1">
              <div className="py-12 px-6 text-center rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V5h13l-3 4 3 4H3" />
                </svg>
                <p className="text-xl font-bold text-gray-700 mb-2">No flagged items found</p>
                <p className="text-base text-gray-500 max-w-sm mx-auto">Flag important items so they don't get buried or forgotten.</p>
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 border-t-2 border-dashed border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-gray-800">Total</span>
              <span className="text-2xl font-bold text-teal-600">
                {formatMoney(
                  listItems
                    .filter(item => !item.checked)
                    .filter(item => showPriorityOnly ? item.is_priority : true)
                    .reduce((sum, item) => {
                      const effStore = getEffectiveStore(item.item_name);
                      if (!effStore) return sum;

                      const storeId = storesByName[effStore];
                      const idKey = (storeId && item.item_id) ? `id:${storeId}-${item.item_id}` : null;
                      const nameKey = `${effStore}-${item.item_name}`;

                      const pd = (idKey && prices[idKey]) || prices[nameKey];
                      const p = pd ? parseFloat(pd.price) : 0;
                      return sum + p * item.quantity;
                    }, 0)
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add to List Widget (Mobile-Store mode only) */}
      {(isMobile && mobileMode === 'store') && (
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <h2 className="text-xl font-semibold mb-1 text-gray-800">Quick Add to List</h2>

          <SearchItemInput
            value={newItem}
            onChange={onNewItemChange}
            onSubmit={onAddNewItem}
            onFocus={onSearchFocus}
            placeholder="Search items or add new"
            showAutocomplete={showAutocomplete}
            autocompleteItems={autocompleteItems}
            onSelectAutocomplete={onSelectItem}
          />
        </div>
      )}
    </>
  );
}
