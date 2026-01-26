'use client';

import ShoppingListItem from './ShoppingListItem';

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

interface CategoryGroupProps {
  categoryId: number | null;
  categoryItems: ListItem[];
  store: string;
  storeId?: string;
  hasActiveTrip: boolean;
  mobileMode: 'store' | 'build';
  activeTripsCount: number;

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

  // Item handlers
  onToggleChecked: (id: string) => void;
  onTogglePriority: (id: string) => void;
  onOpenEdit: (item: ListItem, focusField?: 'name' | 'price' | 'category' | 'note') => void;
  onOpenStoreModal: (itemName: string) => void;
  onRemove: (id: string) => void;
  onClearNote: (itemId: number, noteId: string) => void;
}

export default function CategoryGroup({
  categoryId,
  categoryItems,
  store,
  storeId,
  hasActiveTrip,
  mobileMode,
  activeTripsCount,
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
  onClearNote
}: CategoryGroupProps) {
  // Sort items: unchecked first, then alphabetical
  const sortedItems = [...categoryItems].sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    return a.item_name.localeCompare(b.item_name);
  });

  // Calculate category total
  const categoryTotal = categoryItems.reduce((sum, item) => {
    const effStore = getEffectiveStore(item.item_name) || store;

    // Stable lookup
    const storeId = storesByName[effStore];
    const idKey = (storeId && item.item_id) ? `id:${storeId}-${item.item_id}` : null;
    const nameKey = `${effStore}-${item.item_name}`;

    const priceData = (idKey && prices[idKey]) || prices[nameKey];
    const price = priceData?.price ? parseFloat(priceData.price) : 0;
    return sum + price * item.quantity;
  }, 0);

  return (
    <div className="space-y-2">
      {/* Category header */}
      <div
        className={`flex items-center justify-between px-3 py-2 rounded-xl border ${getCategoryColorById(
          categoryId
        )}`}
      >
        <div className="font-bold text-gray-700">{getCategoryName(categoryId)}</div>
        <div className="text-sm font-bold text-teal-600">${categoryTotal.toFixed(2)}</div>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {sortedItems.map((item) => {
          const isFavorite = !hasActiveTrip && favorites.includes(item.item_name);
          const effStore = getEffectiveStore(item.item_name) || store;

          // Stable lookup
          const curStoreId = storesByName[effStore];
          const idKey = (curStoreId && item.item_id) ? `id:${curStoreId}-${item.item_id}` : null;
          const nameKey = `${effStore}-${item.item_name}`;

          const priceData = (idKey && prices[idKey]) || prices[nameKey];
          const price = priceData?.price ? parseFloat(priceData.price) : 0;
          const cat = getCategoryName(item.category_id ?? -1);
          const missingCategory = !cat || cat.trim() === '' || cat === 'Other';

          return (
            <ShoppingListItem
              key={item.id}
              item={item}
              isFavorite={isFavorite}
              hasActiveTrip={hasActiveTrip}
              store={store}
              storeId={storeId}
              priceData={priceData}
              price={price}
              effectiveStore={effStore}
              isDealsItem={dealsItemNames.has(item.item_name)}
              missingCategory={missingCategory}
              mobileMode={mobileMode}
              activeTripsCount={activeTripsCount}
              onToggleChecked={onToggleChecked}
              onTogglePriority={onTogglePriority}
              onOpenEdit={onOpenEdit}
              onOpenStoreModal={onOpenStoreModal}
              onRemove={onRemove}
              onClearNote={onClearNote}
              storesByName={storesByName}
              storePrefs={storePrefs}
              getDaysAgo={getDaysAgo}
            />
          );
        })}
      </div>
    </div>
  );
}
