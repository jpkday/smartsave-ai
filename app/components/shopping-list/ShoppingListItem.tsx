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
  // Determine if checkbox should be disabled (only in build mode)
  const isCheckboxDisabled = mobileMode === 'build';

  return (
    <div
      className={`flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-lg border transition ${
        item.checked
          ? 'bg-white/[0.02] border-bb-line'
          : isFavorite
            ? 'bg-white/[0.03] border-bb-gold/30 hover:bg-white/5'
            : 'bg-white/[0.03] border-bb-line hover:bg-white/5'
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
        className={`w-6 h-6 rounded transition flex-shrink-0 accent-[#c9a96e] [color-scheme:dark] ${
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
            className={`font-medium hover:text-bb-gold text-left cursor-pointer ${
              item.checked ? 'text-bb-muted line-through' : 'text-bb-cream'
            }`}
          >
            {isDealsItem && (
              <FireIcon className="w-4 h-4 text-bb-gold mr-1 inline-block" title="On sale today!" />
            )}
            {item.item_name}
            {item.quantity > 1 && (
              <span className="ml-1 font-bold text-bb-cream">
                (Qty: {item.quantity})
              </span>
            )}
          </button>
        </div>

        {/* Price Info & Action Buttons */}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {price > 0 ? (
            <p className="text-xs text-bb-cream min-w-0">
              {formatMoney(price)}{' '}
              {item.quantity > 1 && `× ${item.quantity} = ${formatMoney(price * item.quantity)}`}
              {priceData?.date ? (
                <span className="text-bb-muted ml-1">({getDaysAgo(priceData.date)}, {effectiveStore})</span>
              ) : null}
              {(() => {
                const unitPrice = getFormattedUnitPrice(item.item_name, price);
                return unitPrice ? (
                  <span className="text-bb-muted ml-1">
                    • {unitPrice}
                  </span>
                ) : null;
              })()}
            </p>
          ) : (
            <button
              onClick={() => onOpenEdit(item, 'price')}
              className="text-bb-gold text-xs font-semibold hover:underline cursor-pointer transition inline-block"
            >
              Add Price
            </button>
          )}
          {missingCategory && (
            <button
              onClick={() => onOpenEdit(item, 'category')}
              className="text-bb-muted hover:text-bb-cream text-xs font-semibold hover:underline cursor-pointer transition inline-block"
            >
              Add Category
            </button>
          )}
        </div>

        {/* Active Note Display */}
        {item.active_note && (!item.active_note.store_id || item.active_note.store_id === storeId) && (
          <div className="mt-1 flex items-start gap-1 p-2 bg-bb-gold/10 border border-bb-gold/20 rounded-lg text-sm text-bb-gold">
            <span className="text-base select-none">⚠️</span>
            <div className="flex-1">
              <span className="font-semibold">{item.active_note.note}</span>
              <div className="text-xs text-bb-gold/80 flex gap-2 mt-0.5">
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
                  className="text-bb-gold hover:text-bb-cream underline ml-auto"
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
              ? 'text-bb-red hover:brightness-110'
              : 'text-slate-600 hover:text-bb-red'
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
              ? 'text-bb-gold hover:brightness-110'
              : 'text-slate-600 hover:text-bb-muted'
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
          className="text-bb-muted hover:text-bb-red cursor-pointer text-lg font-bold ml-1 transition-colors px-1"
          title="Remove from list"
          aria-label="Remove from list"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
