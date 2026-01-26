'use client';

import { FireIcon } from '@heroicons/react/24/solid';
import { getFormattedUnitPrice } from '../../utils/unitPrice';

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

interface ShoppingListItemProps {
  item: ListItem;
  isFavorite: boolean;
  hasActiveTrip: boolean;
  store: string;
  storeId?: string;
  priceData?: PriceData | null;
  price: number;
  effectiveStore: string;
  isDealsItem: boolean;
  missingCategory: boolean;
  mobileMode: 'store' | 'build';
  activeTripsCount: number;

  // Handlers
  onToggleChecked: (id: string) => void;
  onTogglePriority: (id: string) => void;
  onOpenEdit: (item: ListItem, focusField?: 'name' | 'price' | 'category' | 'note') => void;
  onOpenStoreModal: (itemName: string) => void;
  onRemove: (id: string) => void;
  onClearNote: (itemId: number, noteId: string) => void;

  // Data access
  storesByName: { [name: string]: string };
  storePrefs: Record<string, string>;
  getDaysAgo: (dateString: string) => string;
}

const formatMoney = (n: number) => `$${n.toFixed(2)}`;

export default function ShoppingListItem({
  item,
  isFavorite,
  hasActiveTrip,
  store,
  storeId,
  priceData,
  price,
  effectiveStore,
  isDealsItem,
  missingCategory,
  mobileMode,
  activeTripsCount,
  onToggleChecked,
  onTogglePriority,
  onOpenEdit,
  onOpenStoreModal,
  onRemove,
  onClearNote,
  storesByName,
  storePrefs,
  getDaysAgo
}: ShoppingListItemProps) {
  // Determine if checkbox should be disabled
  const isCheckboxDisabled = mobileMode === 'build' || (mobileMode === 'store' && activeTripsCount === 0);

  return (
    <div
      className={`flex flex-wrap items-center gap-3 p-3 rounded-2xl border transition ${
        item.checked
          ? 'bg-gray-100 border-gray-300'
          : isFavorite
            ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
            : 'bg-white border-gray-300 hover:bg-gray-50'
      }`}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={item.checked}
        disabled={isCheckboxDisabled}
        onChange={() => {
          if (isCheckboxDisabled) return;
          onToggleChecked(item.id);
        }}
        className={`w-6 h-6 rounded transition ${
          isCheckboxDisabled ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
        }`}
      />

      {/* Item Details */}
      <div className="flex-1 min-w-[160px]">
        {/* Item Name */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onOpenEdit(item)}
            className={`font-medium hover:text-teal-600 text-left cursor-pointer ${
              item.checked ? 'text-gray-500 line-through' : 'text-gray-800'
            }`}
          >
            {isDealsItem && (
              <FireIcon className="w-4 h-4 text-red-500 mr-1 inline-block" title="On sale today!" />
            )}
            {item.item_name}
            {item.quantity > 1 && (
              <span className="ml-1 font-bold text-indigo-600">
                (Qty: {item.quantity})
              </span>
            )}
          </button>
        </div>

        {/* Price Info & Action Buttons */}
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          {price > 0 ? (
            <p className="text-xs text-green-600 min-w-0">
              {formatMoney(price)}{' '}
              {item.quantity > 1 && `× ${item.quantity} = ${formatMoney(price * item.quantity)}`}
              {priceData?.date ? (
                <span className="text-gray-400 ml-1">({getDaysAgo(priceData.date)}, {effectiveStore})</span>
              ) : null}
              {(() => {
                const unitPrice = getFormattedUnitPrice(item.item_name, price);
                return unitPrice ? (
                  <span className="text-teal-600 ml-1">
                    • {unitPrice}
                  </span>
                ) : null;
              })()}
            </p>
          ) : (
            <button
              onClick={() => onOpenEdit(item, 'price')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition inline-block"
            >
              Add Price
            </button>
          )}
          {missingCategory && (
            <button
              onClick={() => onOpenEdit(item, 'category')}
              className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition inline-block"
            >
              Add Category
            </button>
          )}
        </div>

        {/* Active Note Display */}
        {item.active_note && (!item.active_note.store_id || item.active_note.store_id === storeId) && (
          <div className="mt-1 flex items-start gap-1 p-2 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
            <span className="text-base select-none">⚠️</span>
            <div className="flex-1">
              <span className="font-semibold">{item.active_note.note}</span>
              <div className="text-xs text-orange-600 flex gap-2 mt-0.5">
                {item.active_note.store_id && (
                  <span>at {Object.keys(storesByName).find(name => storesByName[name] === item.active_note?.store_id) || 'Unknown Store'}</span>
                )}
                <span>• {new Date(item.active_note.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!item.active_note) return;
                    onClearNote(item.item_id, item.active_note.id);
                  }}
                  className="text-orange-700 hover:text-orange-900 underline ml-auto"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Priority Flag */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePriority(item.id);
          }}
          className={`cursor-pointer ml-1 transition ${
            item.is_priority
              ? 'text-red-600 hover:text-red-700'
              : 'text-gray-300 hover:text-red-400'
          }`}
          title={item.is_priority ? "Unmark Urgent" : "Mark Urgent"}
        >
          <svg className="w-5 h-5" fill={item.is_priority ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V5h13l-3 4 3 4H3" />
          </svg>
        </button>

        {/* Store Swap */}
        <button
          onClick={() => onOpenStoreModal(item.item_name)}
          className={`cursor-pointer text-xl ml-1 transition ${
            storePrefs[item.item_name] && storePrefs[item.item_name] !== 'AUTO'
              ? 'text-indigo-600 hover:text-indigo-700'
              : 'text-gray-300 hover:text-gray-500'
          }`}
          title="Swap store"
          aria-label="Swap store"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
        </button>

        {/* Remove */}
        <button
          onClick={() => onRemove(item.id)}
          className="text-gray-600 hover:text-red-500 cursor-pointer text-lg font-bold ml-1 transition-colors px-1"
          title="Remove from list"
          aria-label="Remove from list"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
