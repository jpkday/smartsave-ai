'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';
const RECEIPT_DRAFT_KEY = 'receipt_draft_v1';

type ReceiptMode = 'receipt' | 'flyer';

type ReceiptDraft = {
  store: string;
  receiptItems: ReceiptItem[];
  validFrom?: string;
  validUntil?: string;
};

interface ReceiptItem {
  item: string;
  quantity: string;
  price: string;
  sku: string;
  priceDirty?: boolean;
}

interface Store {
  id: string;
  name: string;
  location: string | null;
}

// Wrapper component with Suspense for useSearchParams
export default function Flyers() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-blue-500 bg-gradient-to-br from-blue-500 to-green-400 p-8 flex items-center justify-center"><div className="text-white text-xl">Loading...</div></div>}>
      <FlyersContent />
    </Suspense>
  );
}

function FlyersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([
    { item: '', quantity: '1', price: '', sku: '', priceDirty: false }
  ]);
  const [skuMappings, setSkuMappings] = useState<Record<string, string>>({}); // itemName -> sku
  const itemRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [favoritedStoreIds, setFavoritedStoreIds] = useState<Set<string>>(new Set());
  const householdCode = typeof window !== 'undefined' ? localStorage.getItem('household_code') || '' : '';
  const [storePriceLookup, setStorePriceLookup] = useState<Record<string, string>>({});

  // Hardcoded Mode
  const mode: ReceiptMode = 'flyer';

  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');

  // Fetch SKUs when store changes
  useEffect(() => {
    if (!selectedStoreId) {
      setSkuMappings({});
      return;
    }

    const fetchSkus = async () => {
      const { data } = await supabase
        .from('store_item_sku')
        .select(`
          store_sku,
          items!inner(name)
        `)
        .eq('store_id', selectedStoreId);

      if (data) {
        const map: Record<string, string> = {};
        data.forEach((row: any) => {
          if (row.items?.name) {
            map[row.items.name] = row.store_sku;
          }
        });
        setSkuMappings(map);
      }
    };

    fetchSkus();
  }, [selectedStoreId]);

  useEffect(() => {
    loadData();

    // Set default validity dates: today to 7 days from today
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    setValidFrom(dateStr);
    const sixDaysLater = new Date(today);
    sixDaysLater.setDate(sixDaysLater.getDate() + 6);
    setValidUntil(sixDaysLater.toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(RECEIPT_DRAFT_KEY);
    if (!raw) return;

    try {
      const draft: ReceiptDraft = JSON.parse(raw);

      if (draft.store) {
        setSelectedStoreId(draft.store);
      }
      if (draft.receiptItems) {
        // Ensure SKU exists for old drafts
        const itemsWithSku = draft.receiptItems.map(item => ({
          ...item,
          sku: item.sku || ''
        }));
        setReceiptItems(itemsWithSku);
      }
      if (draft.validFrom) setValidFrom(draft.validFrom);
      if (draft.validUntil) setValidUntil(draft.validUntil);
    } catch (e) {
      console.warn('Failed to restore receipt draft', e);
      localStorage.removeItem(RECEIPT_DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    const draft: ReceiptDraft = {
      store: selectedStoreId,
      receiptItems,
      validFrom,
      validUntil,
    };

    localStorage.setItem(RECEIPT_DRAFT_KEY, JSON.stringify(draft));
  }, [selectedStoreId, receiptItems, validFrom, validUntil]);



  useEffect(() => {
    const loadLatestPricesForStore = async () => {
      if (!selectedStoreId) {
        setStorePriceLookup({});
        return;
      }

      const { data, error } = await supabase
        .from('price_history')
        .select('item_name, price, recorded_date')
        .eq('user_id', SHARED_USER_ID)
        .eq('store_id', selectedStoreId)
        .order('recorded_date', { ascending: false });

      if (error) {
        console.error('Error loading store prices:', error);
        setStorePriceLookup({});
        return;
      }

      const lookup: Record<string, string> = {};
      for (const row of data || []) {
        if (!lookup[row.item_name]) lookup[row.item_name] = String(row.price);
      }

      setStorePriceLookup(lookup);
      applySuggestedPricesForCurrentStore(lookup);
    };

    loadLatestPricesForStore();
  }, [selectedStoreId]);

  const loadData = async () => {
    // 1. Load all stores
    const { data: storesData } = await supabase
      .from('stores')
      .select('id, name, location')
      .order('name');

    if (storesData) {
      // 2. Filter by favorites if household code exists
      let filteredStores = storesData;

      if (householdCode) {
        const { data: favoritesData } = await supabase
          .from('household_store_favorites')
          .select('store_id')
          .eq('household_code', householdCode);

        if (favoritesData && favoritesData.length > 0) {
          const favoriteIds = new Set(favoritesData.map(f => f.store_id));
          filteredStores = storesData.filter(s => favoriteIds.has(s.id));
        }
      }

      // 3. Sort by Name then Location
      const sorted = filteredStores.sort((a, b) => {
        if (a.name !== b.name) return a.name.localeCompare(b.name);
        return (a.location || '').localeCompare(b.location || '');
      });
      setStores(sorted);
    }

    const { data: itemsData } = await supabase
      .from('items')
      .select('name')
      .order('name');

    if (itemsData) {
      setItems(itemsData.map(i => i.name));
    }
  };

  const addRow = () => {
    setReceiptItems([...receiptItems, { item: '', quantity: '1', price: '', sku: '', priceDirty: false }]);
    setTimeout(() => {
      const newIndex = receiptItems.length;
      itemRefs.current[newIndex]?.focus();
    }, 100);
  };

  const removeRow = (index: number) => {
    setReceiptItems((prev) => {
      if (prev.length <= 1) {
        return [{ item: '', price: '', quantity: '1' } as any];
      }
      return prev.filter((_, i) => i !== index);
    });

    setTimeout(() => itemRefs.current[0]?.focus(), 50);
  };

  const applySuggestedPricesForCurrentStore = (lookup: Record<string, string>) => {
    setReceiptItems((prev) =>
      prev.map((row) => {
        const itemName = (row.item || '').trim();
        if (!itemName) return row;

        if (row.priceDirty) return row;

        const suggested = lookup[itemName];
        if (!suggested) {
          return { ...row, price: '' };
        }

        const num = parseFloat(suggested);
        const normalized = !isNaN(num) ? num.toFixed(2) : suggested;

        return { ...row, price: normalized };
      })
    );
  };

  const updateItem = (index: number, field: 'item' | 'quantity' | 'price' | 'sku', value: string) => {
    setReceiptItems((prev) => {
      const newItems = [...prev];
      const currentRow = { ...newItems[index] };

      if (field === 'price') {
        currentRow.priceDirty = true;
        const digits = value.replace(/\D/g, '');
        if (digits === '') {
          currentRow.price = '';
        } else {
          const cents = parseInt(digits, 10);
          currentRow.price = (cents / 100).toFixed(2);
        }
      } else if (field === 'quantity') {
        if (/^\d*\.?\d*$/.test(value)) {
          currentRow.quantity = value;
        }
      } else if (field === 'item') {
        currentRow.item = value;
        // Auto-populate price and SKU on item name match (if empty)
        const suggestedPrice = storePriceLookup[value];
        if (!currentRow.priceDirty && suggestedPrice) {
          currentRow.price = suggestedPrice;
        }
        if (skuMappings[value]) {
          currentRow.sku = skuMappings[value];
        } else {
          currentRow.sku = ''; // Clear SKU if no mapping found for new item
        }
      } else if (field === 'sku') {
        currentRow.sku = value;
      }

      newItems[index] = currentRow;
      return newItems;
    });
  };

  const saveReceipt = async () => {
    if (!selectedStoreId) {
      alert('Please select a store');
      return;
    }

    // Validate Flyer Mode (Always)
    if (!validFrom || !validUntil) {
      alert('Please specify when these prices are valid');
      return;
    }
    if (validFrom > validUntil) {
      alert('Valid From date must be before Valid Until date');
      return;
    }

    // Find store details from ID
    const selectedStore = stores.find(s => s.id === selectedStoreId);
    if (!selectedStore) {
      alert('Selected store not found in list');
      return;
    }
    const storeName = selectedStore.name;

    // Set recorded_date (Flyer = validFrom)
    const recordedDate = validFrom;

    const validItems = receiptItems.filter((ri) => {
      const price = parseFloat(ri.price || '0');
      const qty = parseFloat(ri.quantity || '1');
      return ri.item && !isNaN(price) && price > 0 && !isNaN(qty) && qty > 0;
    });

    if (validItems.length === 0) {
      alert('Please add at least one item with a price');
      return;
    }

    const { data: storeData, error: storeErr } = await supabase
      .from('stores')
      .select('id')
      .eq('id', selectedStoreId)
      .single();

    if (storeErr || !storeData?.id) {
      alert('Store not found');
      return;
    }

    const uniqueNames = Array.from(new Set(validItems.map((x) => x.item)));

    const { data: existingItems, error: existingItemsErr } = await supabase
      .from('items')
      .select('id, name')
      .eq('user_id', SHARED_USER_ID)
      .in('name', uniqueNames);

    if (existingItemsErr) {
      console.error(existingItemsErr);
      alert('Failed to load items. Check your connection and try again.');
      return;
    }

    const existingSet = new Set((existingItems || []).map((x: any) => x.name));
    const missing = uniqueNames.filter((n) => !existingSet.has(n));

    if (missing.length > 0) {
      const { error: insertItemsErr } = await supabase.from('items').insert(
        missing.map((name) => ({
          name,
          user_id: SHARED_USER_ID,
          household_code: householdCode,
        }))
      );

      if (insertItemsErr) {
        console.error('Error inserting items:', insertItemsErr);
        alert('Failed to add new items. Check your connection and try again.');
        return;
      }

      setItems((prev) => Array.from(new Set([...prev, ...missing])));
    }

    const { data: allItemsData, error: allItemsErr } = await supabase
      .from('items')
      .select('id, name')
      .eq('user_id', SHARED_USER_ID)
      .in('name', uniqueNames);

    if (allItemsErr) {
      console.error(allItemsErr);
      alert('Failed to load item ids. Check your connection and try again.');
      return;
    }

    const itemIdByName: Record<string, any> = {};
    (allItemsData || []).forEach((it: any) => {
      itemIdByName[it.name] = it.id;
    });

    const createdAt = new Date().toISOString();

    const priceRows = validItems
      .map((ri) => {
        const itemId = itemIdByName[ri.item];
        if (!itemId) return null;

        const priceRow: any = {
          item_id: itemId,
          item_name: ri.item,
          store_id: selectedStoreId,
          store: storeName,
          price: ri.price,
          user_id: SHARED_USER_ID,
          household_code: householdCode,
          recorded_date: recordedDate,
          created_at: createdAt,
          valid_from: validFrom,
          valid_until: validUntil,
        };

        return priceRow;
      })
      .filter(Boolean);

    const { error: priceInsertErr } = await supabase.from('price_history').insert(priceRows as any);

    if (priceInsertErr) {
      console.error(priceInsertErr);
      alert('Failed to save prices. Check your connection and try again.');
      return;
    }

    alert(
      `Flyer prices saved! Updated ${validItems.length} prices for ${storeName} (valid ${new Date(
        validFrom
      ).toLocaleDateString()} - ${new Date(validUntil).toLocaleDateString()})`
    );

    setSelectedStoreId('');
    setReceiptItems([{ item: '', quantity: '1', price: '', sku: '', priceDirty: false }]);
    setValidFrom('');
    setValidUntil('');
    localStorage.removeItem(RECEIPT_DRAFT_KEY);

    loadData();
  };

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
              <Header currentPage="Add Flyer" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-2 sm:px-4 md:px-8 pt-6">
        <div className="bg-white rounded-2xl shadow-lg p-3">

          {/* Intro / Instructions */}
          <div className="mb-6 px-2 text-center">
            <h2 className="text-gray-600 text-sm">Enter deals from your local flyers manually.</h2>
          </div>

          <div className="w-full bg-white p-3">
            <div className="border border-slate-200 rounded-2xl shadow-sm p-4">

              {/* Store and Date Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Store</label>
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold cursor-pointer"
                  >
                    <option value="">Select</option>
                    {stores.map((s, idx) => (
                      <option key={`${s.id}-${idx}`} value={s.id}>
                        {s.name} {s.location ? `(${s.location})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Validity Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Valid From</label>
                    <input
                      type="date"
                      value={validFrom}
                      onChange={(e) => setValidFrom(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Valid Until</label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="w-full bg-white p-3">
            <div className="border border-slate-200 rounded-2xl shadow-sm p-4">
              <h2 className="text-xl font-bold text-gray-800 mb-3">Items</h2>
              <div className="space-y-3">
                {receiptItems.map((ri, idx) => (
                  <div key={idx} className="flex gap-3 items-center">
                    <div className="flex-1">
                      <input
                        type="text"
                        list={`items-${idx}`}
                        value={ri.item}
                        onChange={(e) => updateItem(idx, 'item', e.target.value)}
                        placeholder="Type or select item..."
                        ref={(el) => { if (el) itemRefs.current[idx] = el; }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
                      />
                      <datalist id={`items-${idx}`}>
                        {items.sort().map(item => (
                          <option key={item} value={item} />
                        ))}
                      </datalist>
                    </div>

                    {/* SKU Input */}
                    <div className="w-24">
                      <input
                        type="text"
                        placeholder="SKU"
                        value={ri.sku || ''}
                        onChange={(e) => updateItem(idx, 'sku', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
                      />
                    </div>

                    <div className="w-28">
                      <div className="flex items-center border border-gray-300 rounded-2xl px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
                        <span className="text-gray-800 font-semibold mr-1">$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={ri.price}
                          onChange={(e) => updateItem(idx, 'price', e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && ri.item && ri.price) {
                              e.preventDefault();
                              if (idx === receiptItems.length - 1) addRow();
                            }
                          }}
                          className="w-full text-right font-semibold text-gray-800 focus:outline-none"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeRow(idx)}
                      className="text-gray-300 hover:text-gray-500 cursor-pointer text-xl -mt-1"
                      aria-label="Close"
                      title="Remove"
                    >
                      ✖️
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addRow}
                className="mt-3 text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
              >
                + Add Item
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div className="w-full bg-white p-5">
            <button
              onClick={saveReceipt}
              className="w-full bg-indigo-600 text-white px-4 py-3 rounded-2xl text-base font-semibold hover:bg-indigo-700 transition cursor-pointer"
            >
              Save Flyer Prices
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
