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

  const unitPrice = price > 0 ? getFormattedUnitPrice(item.item_name, price) : null;
  const hasStorePref = !!storePrefs[item.item_name] && storePrefs[item.item_name] !== 'AUTO';
  // On phones in store mode keep the row focused on checking off; the urgent flag only shows when set
  const hideFlagOnPhone = mobileMode === 'store' && !item.is_priority;

  return (
    <div className={`flex items-start gap-3 py-2.5 ${item.checked ? 'opacity-60' : ''}`}>
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={item.checked}
        disabled={isCheckboxDisabled}
        onChange={() => {
          if (isCheckboxDisabled) return;
          onToggleChecked(item.id);
        }}
        aria-label={`Check off ${item.item_name}`}
        className={`mt-0.5 w-5 h-5 rounded transition flex-shrink-0 accent-[#c9a96e] [color-scheme:dark] ${
          isCheckboxDisabled ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
        }`}
      />

      {/* Item Details */}
      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onOpenEdit(item)}
          className={`text-[15px] leading-snug text-left hover:text-bb-gold cursor-pointer ${
            item.checked ? 'text-bb-muted line-through' : 'text-bb-cream'
          }`}
        >
          {isDealsItem && (
            <FireIcon className="w-3.5 h-3.5 text-bb-gold mr-1 inline-block -mt-0.5" title="On sale today!" />
          )}
          {isFavorite && <span className="text-bb-gold mr-1" title="Favorite">★</span>}
          {item.item_name}
          {item.quantity > 1 && <span className="ml-1.5 text-sm text-bb-muted">×{item.quantity}</span>}
        </button>

        {/* Price line */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-bb-muted tabular-nums">
          {price > 0 ? (
            <>
              <span className="text-bb-cream">
                {item.quantity > 1 ? `${formatMoney(price * item.quantity)} (${formatMoney(price)} ea)` : formatMoney(price)}
              </span>
              {unitPrice && <span>· {unitPrice}</span>}
              {priceData?.date && <span>· {getDaysAgo(priceData.date)}{effectiveStore !== store ? ` at ${effectiveStore}` : ''}</span>}
            </>
          ) : (
            <button
              onClick={() => onOpenEdit(item, 'price')}
              className="text-bb-gold font-semibold hover:underline cursor-pointer"
            >
              Add price
            </button>
          )}
          {missingCategory && (
            <button
              onClick={() => onOpenEdit(item, 'category')}
              className="hover:text-bb-cream hover:underline cursor-pointer"
            >
              · Add category
            </button>
          )}
        </div>

        {/* Active Note Display */}
        {item.active_note && (!item.active_note.store_id || item.active_note.store_id === storeId) && (
          <div className="mt-1.5 flex items-start gap-1.5 px-2 py-1.5 bg-bb-gold/10 border border-bb-gold/20 rounded-lg text-xs text-bb-gold">
            <span className="select-none">⚠️</span>
            <div className="flex-1 min-w-0">
              <span className="font-semibold">{item.active_note.note}</span>
              <div className="text-[11px] text-bb-gold/80 flex gap-2 mt-0.5">
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

      {/* Actions */}
      <div className="flex items-center -mr-1.5 flex-none">
        <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePriority(item.id);
            }}
            className={`p-1.5 cursor-pointer transition ${hideFlagOnPhone ? 'hidden md:block' : ''} ${
              item.is_priority ? 'text-bb-red hover:brightness-110' : 'text-slate-600 hover:text-bb-red'
            }`}
            title={item.is_priority ? 'Unmark urgent' : 'Mark urgent'}
            aria-label={item.is_priority ? 'Unmark urgent' : 'Mark urgent'}
          >
            <svg className="w-4 h-4" fill={item.is_priority ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V5h13l-3 4 3 4H3" />
            </svg>
          </button>
        <button
          onClick={() => onOpenStoreModal(item.item_name)}
          className={`p-1.5 cursor-pointer transition ${hasStorePref ? 'text-bb-gold hover:brightness-110' : 'text-slate-600 hover:text-bb-muted'}`}
          title="Swap store"
          aria-label="Swap store"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </button>
        <button
          onClick={() => onRemove(item.id)}
          className="p-1.5 text-slate-500 hover:text-bb-red cursor-pointer transition-colors"
          title="Remove from list"
          aria-label="Remove from list"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
