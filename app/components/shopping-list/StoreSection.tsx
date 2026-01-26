'use client';

import CategoryGroup from './CategoryGroup';

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

interface StoreSectionProps {
  store: string;
  storeId?: string;
  storeItems: ListItem[];
  hasActiveTrip: boolean;
  isPinned?: boolean;
  tripId?: string;
  mobileMode: 'store' | 'build';
  isMobile: boolean;

  // Store actions
  onStartTrip?: (storeId: string, storeName: string) => void;
  onEndTrip?: (tripId: string, storeId: string) => void;

  // Category data
  categories: Category[];

  // Data access
  favorites: string[];
  dealsItemNames: Set<string>;
  prices: { [key: string]: PriceData };
  storesByName: { [name: string]: string };
  storePrefs: Record<string, string>;

  // Helper functions
  getCategoryColorById: (id: number | null | undefined) => string;
  getCategoryName: (id?: number | null) => string;
  getEffectiveStore: (itemName: string) => string | null;
  getDaysAgo: (dateString: string) => string;

  // Item handlers (passed through to CategoryGroup)
  onToggleChecked: (id: string) => void;
  onTogglePriority: (id: string) => void;
  onOpenEdit: (item: ListItem, focusField?: 'name' | 'price' | 'category' | 'note') => void;
  onOpenStoreModal: (itemName: string) => void;
  onRemove: (id: string) => void;
  onClearNote: (itemId: number, noteId: string) => void;

  activeTripsCount: number;
}

export default function StoreSection({
  store,
  storeId,
  storeItems,
  hasActiveTrip,
  isPinned,
  tripId,
  mobileMode,
  isMobile,
  onStartTrip,
  onEndTrip,
  categories,
  favorites,
  dealsItemNames,
  prices,
  storesByName,
  storePrefs,
  getCategoryColorById,
  getCategoryName,
  getEffectiveStore,
  getDaysAgo,
  onToggleChecked,
  onTogglePriority,
  onOpenEdit,
  onOpenStoreModal,
  onRemove,
  onClearNote,
  activeTripsCount
}: StoreSectionProps) {
  // Calculate store total
  const storeTotal = storeItems.reduce((sum, item) => {
    const effStore = getEffectiveStore(item.item_name) || store;
    const priceData = prices[`${effStore}-${item.item_name}`];
    const price = priceData?.price ? parseFloat(priceData.price) : 0;
    return sum + price * item.quantity;
  }, 0);

  // Group items by category
  const itemsByCategory = storeItems.reduce((acc, item) => {
    const catId = item.category_id !== null && item.category_id !== undefined ? item.category_id : -1;
    if (!acc[catId]) acc[catId] = [];
    acc[catId].push(item);
    return acc;
  }, {} as { [key: number]: ListItem[] });

  // Sort categories by sort_order
  const sortedCategories = Object.entries(itemsByCategory).sort(([catIdA], [catIdB]) => {
    const idA = parseInt(catIdA);
    const idB = parseInt(catIdB);
    const orderA = categories.find(c => c.id === idA)?.sort_order || 999;
    const orderB = categories.find(c => c.id === idB)?.sort_order || 999;
    return orderA - orderB;
  });

  return (
    <div
      className={`rounded-2xl ${
        hasActiveTrip
          ? 'border-2 border-indigo-300 bg-white shadow-sm overflow-hidden'
          : 'border border-gray-200 bg-white shadow-sm overflow-hidden'
      }`}
    >
      {/* Store Header */}
      <h3
        className={`text-lg font-bold text-gray-700 flex items-center gap-2 justify-between ${
          hasActiveTrip ? 'bg-indigo-50 p-3.5 border-b border-indigo-100' : 'bg-gray-50 p-3.5 border-b border-gray-200'
        }`}
      >
        {hasActiveTrip ? (
          // Active trip header
          <>
            <div className="flex items-center gap-3">
              <span className="bg-indigo-500 text-white font-bold px-4 py-1.5 rounded-full text-sm flex items-center shadow-sm">
                {isPinned && <span className="mr-1.5" title="Pinned to top">📍</span>}
                {store}
                <span className="font-bold ml-1">(Active)</span>
              </span>

              {onEndTrip && tripId && storeId && (
                <button
                  onClick={() => onEndTrip(tripId, storeId)}
                  className="bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm"
                >
                  End
                </button>
              )}
              <span className="text-sm text-gray-500 font-medium">
                {storeItems.length} {storeItems.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <span className="text-xl font-bold text-teal-700">${storeTotal.toFixed(2)}</span>
          </>
        ) : (
          // Inactive store header
          <div className="flex items-center justify-between gap-3 w-full">
            {/* Left: Start Trip button + Store name */}
            <div className="flex items-center gap-3">
              {/* Start Trip button (mobile only) */}
              {isMobile && mobileMode === 'store' && onStartTrip && storeId && (
                <button
                  onClick={() => onStartTrip(storeId, store)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-2xl font-semibold hover:bg-indigo-700 cursor-pointer transition whitespace-nowrap flex items-center gap-2"
                  title="Start Trip"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                  </svg>
                  <span className="hidden md:inline">Start</span>
                </button>
              )}

              {/* Store name */}
              <span className="text-lg font-bold text-gray-800">{store}</span>
            </div>

            {/* Right: Total and item count */}
            <div className="flex flex-col items-end">
              <span className="text-xl font-bold text-teal-700">${storeTotal.toFixed(2)}</span>
              <span className="text-sm text-gray-500 font-normal">
                ({storeItems.length} {storeItems.length === 1 ? 'item' : 'items'})
              </span>
            </div>
          </div>
        )}
      </h3>

      {/* Store Items - Grouped by Category */}
      <div className="p-3 space-y-4">
        {sortedCategories.map(([catIdStr, categoryItems]) => {
          const catId = parseInt(catIdStr);

          return (
            <CategoryGroup
              key={catId}
              categoryId={catId}
              categoryItems={categoryItems}
              store={store}
              storeId={storeId}
              hasActiveTrip={hasActiveTrip}
              mobileMode={mobileMode}
              activeTripsCount={activeTripsCount}
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
  );
}
