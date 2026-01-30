'use client';

import { useRef } from 'react';

interface ListItem {
  id: string;
  item_id: number;
  item_name: string;
  quantity: number;
  checked: boolean;
  is_priority: boolean;
  category_id?: number | null;
  category?: string | null;
}

interface Category {
  id: number;
  name: string;
  color: string;
  sort_order: number;
}

interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ListItem | null;

  // Form state
  itemName: string;
  categoryId: number | null;
  quantity: string;
  note: string;
  noteStore: string;
  price: string;
  store: string;
  originalPrice: string;
  priceDirty: boolean;

  // Form handlers
  onItemNameChange: (value: string) => void;
  onCategoryChange: (value: number | null) => void;
  onQuantityChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onNoteStoreChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onPriceDirtyChange: (value: boolean) => void;
  onStoreChange: (store: string) => void;

  // Actions
  onSave: () => void;
  onToggleFavorite: (itemName: string) => void;

  // Data
  categories: Category[];
  stores: string[];
  favorites: string[];
  saving: boolean;
  focusField?: 'name' | 'price' | 'category' | 'note';

  // Store required modal
  storeRequiredOpen: boolean;
  onStoreRequiredClose: () => void;

  // Helper
  getCategoryColorById: (id: number | null | undefined) => string;
}

export default function EditItemModal({
  isOpen,
  onClose,
  item,
  itemName,
  categoryId,
  quantity,
  note,
  noteStore,
  price,
  store,
  originalPrice,
  priceDirty,
  onItemNameChange,
  onCategoryChange,
  onQuantityChange,
  onNoteChange,
  onNoteStoreChange,
  onPriceChange,
  onPriceDirtyChange,
  onStoreChange,
  onSave,
  onToggleFavorite,
  categories,
  stores,
  favorites,
  saving,
  focusField,
  storeRequiredOpen,
  onStoreRequiredClose,
  getCategoryColorById,
}: EditItemModalProps) {
  const storeSelectRef = useRef<HTMLSelectElement>(null);

  if (!isOpen || !item) return null;

  const isFavorite = favorites.includes(item?.item_name || itemName);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-5">
            <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit Item Details
            </h3>
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-gray-500 cursor-pointer text-xl -mt-1"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {/* Details Section */}
            <div
              className={`rounded-2xl p-4 border transition-colors ${getCategoryColorById(categoryId)
                .split(' ')
                .filter(c => c.startsWith('bg-') || c.startsWith('border-'))
                .join(' ')
                }`}
            >
              <div className="space-y-3">
                {/* Name + Favorite Star */}
                <div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(item?.item_name || itemName)}
                      className={
                        isFavorite
                          ? 'text-4xl leading-none cursor-pointer'
                          : 'text-4xl leading-none text-gray-300 cursor-pointer'
                      }
                      aria-label={isFavorite ? 'Unfavorite item' : 'Favorite item'}
                      title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                    >
                      {isFavorite ? '⭐' : '☆'}
                    </button>
                    <label className="text-sm font-semibold text-gray-700">Favorite & Item Name</label>
                  </div>
                  <div className="mt-1">
                    <input
                      autoFocus={focusField === 'name'}
                      type="text"
                      value={itemName}
                      onChange={(e) => onItemNameChange(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 text-base bg-white"
                      placeholder="e.g., Grapefruit (ct)"
                    />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="text-sm font-semibold text-gray-700">Category</label>
                  <select
                    autoFocus={focusField === 'category'}
                    value={(categories.find(c => c.id === categoryId)?.name.trim().toLowerCase() === 'other') ? '' : (categoryId ?? '')}
                    onChange={(e) => {
                      const value = e.target.value;
                      onCategoryChange(value === '' ? null : parseInt(value, 10));
                    }}
                    className="w-full mt-1 px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-200 bg-white"
                  >
                    <option value="">Other</option>
                    {categories
                      .filter(cat => cat.name.trim().toLowerCase() !== 'other')
                      .map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="text-sm font-semibold text-gray-700">Quantity</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="1"
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^\d*\.?\d*$/.test(val)) {
                        onQuantityChange(val);
                      }
                    }}
                    className="w-full mt-1 px-3 py-3 border border-gray-200 rounded-xl bg-white
                        font-semibold text-gray-800
                        focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                  />
                </div>

                {/* Note */}
                <div>
                  <label className="text-sm font-semibold text-gray-700">Note (Optional)</label>
                  <div className="flex gap-2">
                    <select
                      value={note}
                      onChange={(e) => onNoteChange(e.target.value)}
                      className={`w-full mt-1 px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-200 ${note ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}
                    >
                      <option value="">No note</option>
                      <option value="Poor quality item">Poor quality item</option>
                      <option value="Out of stock!">Out of stock!</option>
                      <option value="Wrong price at register!">Wrong price at register!</option>
                    </select>
                  </div>
                  <div className="mt-1 w-full">
                    <select
                      value={noteStore}
                      onChange={(e) => onNoteStoreChange(e.target.value)}
                      className="w-full text-s bg-white border border-gray-200 rounded-xl px-3 py-3"
                    >
                      <option value="Any">Any Store</option>
                      {stores.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Price Section */}
            <div className="rounded-2xl border border-blue-300 bg-blue-100 p-4 shadow-sm">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Price</label>
                  <div className="mt-1 flex items-center border border-gray-300 rounded-xl px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 bg-white">
                    <span className="text-gray-600 font-semibold mr-1">$</span>

                    <input
                      autoFocus={focusField === 'price'}
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={price || ''}
                      onChange={(e) => {
                        onPriceDirtyChange(true);
                        const digits = e.target.value.replace(/\D/g, '');
                        let priceValue = '';
                        if (digits !== '') {
                          const cents = parseInt(digits, 10);
                          priceValue = (cents / 100).toFixed(2);
                        }

                        onPriceChange(priceValue);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (!store) {
                            e.preventDefault();

                            // guide user to store selection
                            setTimeout(() => {
                              storeSelectRef.current?.focus();
                            }, 50);
                          }
                        }
                      }}
                      className="w-full text-right font-semibold text-gray-600 focus:outline-none"
                      aria-label="Price"
                    />
                  </div>
                </div>

                {/* Store Selection */}
                <div>
                  <label className="text-sm font-semibold text-gray-700">Store</label>
                  <select
                    ref={storeSelectRef}
                    value={store}
                    onChange={(e) => {
                      const newStore = e.target.value;
                      onStoreChange(newStore);
                    }}
                    className="w-full mt-1 px-3 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-200"
                  >
                    <option value="">Select a store</option>
                    {stores.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {originalPrice && price !== originalPrice && (
                <p className="text-xs text-gray-700 mt-2">
                  Was <span className="font-semibold">${originalPrice}</span>
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Store Required Modal */}
      {storeRequiredOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" aria-modal="true" role="dialog">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={onStoreRequiredClose}
          />

          {/* Card */}
          <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">Store Required</h3>
                <p className="text-sm text-gray-600 mt-1">
                  You found{' '}
                  <span className="font-semibold text-gray-900">
                    {itemName}
                  </span>
                  {' for'}
                  <span className="font-semibold text-gray-900">
                    {' $'}{price}
                  </span>
                  ? Awesome!
                  Let me know what store that applies to.
                </p>
              </div>

              <button
                onClick={onStoreRequiredClose}
                className="text-gray-300 hover:text-gray-500 cursor-pointer text-xl -mt-1"
                aria-label="Close"
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  onStoreRequiredClose();
                  setTimeout(() => storeSelectRef.current?.focus(), 50);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
              >
                Choose Store
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
