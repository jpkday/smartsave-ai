'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';
const RECEIPT_DRAFT_KEY = 'receipt_draft_v1';
const MODE_KEY = 'receipt_mode_v1';

type SkuMapping = {
  item_id: number;
  store_sku: string;
  items: { name: string };
};

type ReceiptMode = 'receipt' | 'flyer';

type ReceiptDraft = {
  store: string;
  date: string;
  tripEndLocal: string;
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
export default function Receipts() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-blue-500 bg-gradient-to-br from-blue-500 to-green-400 p-8 flex items-center justify-center"><div className="text-white text-xl">Loading...</div></div>}>
      <ReceiptsContent />
    </Suspense>
  );
}

function ReceiptsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [date, setDate] = useState('');
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([
    { item: '', quantity: '1', price: '', sku: '', priceDirty: false }
  ]);
  const [skuMappings, setSkuMappings] = useState<Record<string, string>>({}); // itemName -> sku
  const itemRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [createPastTrip, setCreatePastTrip] = useState(true);
  const [favoritedStoreIds, setFavoritedStoreIds] = useState<Set<string>>(new Set());
  const householdCode = typeof window !== 'undefined' ? localStorage.getItem('household_code') || '' : '';
  const [tripEndLocal, setTripEndLocal] = useState('');
  const [storePriceLookup, setStorePriceLookup] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<ReceiptMode>('receipt');
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

    const now = new Date();
    now.setSeconds(0, 0);
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    setTripEndLocal(local);

    // Check URL query parameter first (priority), then localStorage
    const urlMode = searchParams.get('mode');
    if (urlMode === 'flyer' || urlMode === 'receipt') {
      setMode(urlMode);
    } else {
      const savedMode = localStorage.getItem(MODE_KEY);
      if (savedMode === 'flyer' || savedMode === 'receipt') {
        setMode(savedMode);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (mode === 'flyer') {
      // Set default validity dates: today to 7 days from today
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10);
      setValidFrom(dateStr);
      const sixDaysLater = new Date(today);
      sixDaysLater.setDate(sixDaysLater.getDate() + 6);
      setValidUntil(sixDaysLater.toISOString().slice(0, 10));
    }
  }, [mode]);

  useEffect(() => {
    const raw = localStorage.getItem(RECEIPT_DRAFT_KEY);
    if (!raw) return;

    try {
      const draft: ReceiptDraft = JSON.parse(raw);

      if (draft.store) {
        // Legacy draft might have store name string. Try to map to ID if possible, or just ignore.
        // For now, let's assume if it's a valid ID it works, if it's a name, we might lose it unless we lookup.
        // Let's just try to set it. If it doesn't match an ID in the list, it won't show selected.
        // Actually, we load stores async. We might need to wait.
        // Better: store the ID in draft from now on.
        setSelectedStoreId(draft.store);
      }
      if (draft.date) setDate(draft.date);
      if (draft.tripEndLocal) setTripEndLocal(draft.tripEndLocal);
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
      date,
      tripEndLocal,
      receiptItems,
      validFrom,
      validUntil,
    };

    localStorage.setItem(RECEIPT_DRAFT_KEY, JSON.stringify(draft));
  }, [selectedStoreId, date, tripEndLocal, receiptItems, validFrom, validUntil]);

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    const loadLatestPricesForStore = async () => {
      if (!selectedStoreId) {
        setStorePriceLookup({});
        return;
      }

      // We can query by store_id if the column exists, or we might have to use store name if schema is older.
      // Schema has store_id.
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
      // Note: householdCode is already in state/props context or we can read it directly
      // In this component, householdCode is defined at top level: const householdCode = ...
      // However, it's defined as: localStorage.getItem('household_code') || ''

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

  const toIsoFromLocalDateTime = (local: string) => {
    const [datePart, timePart] = local.split('T');
    if (!datePart || !timePart) return null;

    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm] = timePart.split(':').map(Number);

    const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
    return dt.toISOString();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();

      setScanning(true);

      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setScanPreview(base64);

        try {
          const response = await fetch('/api/receipts/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to analyze receipt');
          }

          if (confirm(`Scanned ${data.items?.length || 0} items from ${data.store || 'store'}. Load them?`)) {
            // Map API items to frontend ReceiptItem format
            const mappedItems: ReceiptItem[] = (data.items || []).map((apiItem: any) => ({
              item: apiItem.name,
              quantity: String(apiItem.quantity || 1),
              price: String(apiItem.price || ''),
              sku: apiItem.sku || '',
              priceDirty: true, // Mark as dirty so we don't auto-overwrite with old db prices immediately
            }));

            // If we got items, update state
            if (mappedItems.length > 0) {
              setReceiptItems(mappedItems);
            }

            // Attempt to match store
            if (data.store) {
              // Simple fuzzy match or partial inclusion
              const match = stores.find(s =>
                s.name.toLowerCase().includes(data.store.toLowerCase()) ||
                data.store.toLowerCase().includes(s.name.toLowerCase())
              );
              if (match) {
                setSelectedStoreId(match.id);
              } else {
                // If no ID match, user will have to select manually, but we captured the name
                console.log("Could not auto-match store:", data.store);
              }
            }

            // Set date
            if (data.date) {
              setDate(data.date);
              // reset time to noon to avoid timezone shifts if possible, or just keep date part
              // tripEndLocal is datetime-local 'YYYY-MM-DDTHH:mm'
              setTripEndLocal(`${data.date}T12:00`);
            }
          }

        } catch (error: any) {
          console.error("Scan error:", error);
          alert(`Scan failed: ${error.message}`);
        } finally {
          setScanning(false);
          if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input so same file can be selected again
        }
      };

      reader.readAsDataURL(file);
    }
  };

  const clearScan = () => {
    setScanPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const saveReceipt = async () => {
    if (!selectedStoreId) {
      alert('Please select a store');
      return;
    }

    // Validate based on mode
    if (mode === 'flyer') {
      if (!validFrom || !validUntil) {
        alert('Please specify when these prices are valid');
        return;
      }
      if (validFrom > validUntil) {
        alert('Valid From date must be before Valid Until date');
        return;
      }
    } else {
      if (!tripEndLocal) {
        alert('Please select a trip end date/time');
        return;
      }
    }

    // Find store details from ID
    const selectedStore = stores.find(s => s.id === selectedStoreId);
    if (!selectedStore) {
      alert('Selected store not found in list');
      return;
    }
    const storeName = selectedStore.name;

    // Set recorded_date based on mode
    const recordedDate = mode === 'flyer' ? validFrom : tripEndLocal.slice(0, 10);

    const endedAtIso = mode === 'receipt' ? toIsoFromLocalDateTime(tripEndLocal) : null;
    if (mode === 'receipt' && !endedAtIso) {
      alert('Please select a trip end date/time');
      return;
    }

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

    const storeId = storeData.id;

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
        };

        // Add validity dates for flyer mode
        if (mode === 'flyer') {
          priceRow.valid_from = validFrom;
          priceRow.valid_until = validUntil;
        }

        return priceRow;
      })
      .filter(Boolean);

    const { error: priceInsertErr } = await supabase.from('price_history').insert(priceRows as any);

    if (priceInsertErr) {
      console.error(priceInsertErr);
      alert('Failed to save prices. Check your connection and try again.');
      return;
    }

    if (mode === 'receipt' && createPastTrip && endedAtIso) {
      const startedAtIso = new Date(new Date(endedAtIso).getTime() - 20 * 60 * 1000).toISOString();

      const { data: tripRow, error: tripErr } = await supabase
        .from('trips')
        .insert({
          household_code: householdCode,
          store_id: selectedStoreId,
          store: storeName,
          started_at: startedAtIso,
          ended_at: endedAtIso,
        })
        .select('id')
        .single();

      if (tripErr || !tripRow?.id) {
        console.error(tripErr);
        alert('Saved prices, but failed to create the trip.');
      } else {
        const tripId = tripRow.id;

        const eventRows = validItems
          .map((ri) => {
            const itemId = itemIdByName[ri.item];
            if (!itemId) return null;

            const qtyNum = parseFloat(ri.quantity || '1') || 1;
            const priceNum = parseFloat(ri.price || '0') || 0;

            // Upsert SKU if provided
            const sku = ri.sku?.trim();
            if (sku) {
              supabase.from('store_item_sku').upsert(
                {
                  store_id: storeId,
                  item_id: itemId,
                  store_sku: sku
                },
                { onConflict: 'store_id,item_id' }
              ).then(({ error }) => {
                if (error) console.error('Error upserting SKU:', error);
              });
            }

            return {
              trip_id: tripId,
              household_code: householdCode,
              store_id: selectedStoreId,
              store: storeName,
              item_id: itemId,
              item_name: ri.item,
              quantity: qtyNum,
              price: priceNum,
              checked_at: endedAtIso
            };
          })
          .filter(Boolean);

        const { error: eventsErr } = await supabase
          .from('shopping_list_events')
          .insert(eventRows as any);

        if (eventsErr) {
          console.error(eventsErr);
          alert('Saved prices + trip, but failed to save trip items.');
        }
      }
    }

    if (mode === 'flyer') {
      alert(
        `Flyer prices saved! Updated ${validItems.length} prices for ${storeName} (valid ${new Date(
          validFrom
        ).toLocaleDateString()} - ${new Date(validUntil).toLocaleDateString()})`
      );
    } else {
      alert(
        `Receipt saved! Added ${validItems.length} prices for ${storeName} on ${new Date(
          tripEndLocal
        ).toLocaleString()}`
      );
    }

    setSelectedStoreId('');
    setDate(new Date().toISOString().split('T')[0]);
    setReceiptItems([{ item: '', quantity: '1', price: '', sku: '', priceDirty: false }]);
    setValidFrom('');
    setValidUntil('');
    localStorage.removeItem(RECEIPT_DRAFT_KEY);

    loadData();
  };

  const total = receiptItems.reduce((sum, ri) => {
    const price = parseFloat(ri.price || '0') || 0;
    const qty = parseFloat(ri.quantity || '1') || 1;
    return sum + price * qty;
  }, 0);

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
              {/* Dynamic Header title passed via prop or handled inside Header?
                  Actually Header just takes `currentPage`.
                  The title "Enter Receipt" or "Add Flyer" was previously shown.
                  User said "remove page headers... make it clean".
                  So I will remove the dynamic title text.
              */}
              <Header currentPage={mode === 'flyer' ? 'Add Flyer' : 'Add Receipt'} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-2 sm:px-4 md:px-8 pt-6">
        <div className="bg-white rounded-2xl shadow-lg p-3">

          {/* Mode Toggle */}
          <div className="w-full bg-white p-3 mb-2">
            <div className="border border-slate-200 rounded-2xl shadow-sm p-4">
              <div className="flex gap-2">
                <button
                  onClick={() => router.replace('/receipts?mode=receipt', { scroll: false })}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition cursor-pointer ${mode === 'receipt'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  🧾 Receipt Mode
                </button>
                <button
                  onClick={() => router.replace('/receipts?mode=flyer', { scroll: false })}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition cursor-pointer ${mode === 'flyer'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  ✄ Flyer Mode
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                {mode === 'flyer'
                  ? '💡 Use Flyer Mode to quickly update prices from weekly ads - no trip tracking needed.'
                  : '🧾 Use Receipt Mode to log actual purchases and track shopping trips.'
                }
              </p>
            </div>
          </div>

          {/* Scan Receipt Button - Only in Receipt Mode */}
          {mode === 'receipt' && (
            <div className="w-full bg-white p-3 mb-2">
              <div className="border border-slate-200 rounded-2xl shadow-sm p-4 bg-blue-50">
                <div className="flex flex-col items-center justify-center gap-4">

                  {scanPreview ? (
                    <div className="relative w-full max-w-md">
                      <img src={scanPreview} alt="Receipt Preview" className="w-full rounded-lg shadow-lg" />
                      <button
                        onClick={clearScan}
                        className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-md"
                      >
                        ✕
                      </button>
                      {scanning && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                          <div className="text-white font-bold animate-pulse text-xl">Analyzing... 🤖</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center w-full">
                      <h3 className="font-bold text-blue-900 mb-2">🚀 Speed up entry</h3>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={scanning}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] transition flex items-center justify-center gap-2"
                      >
                        <span className="text-2xl">📸</span>
                        Scan Receipt
                      </button>
                      <p className="text-xs text-blue-700 mt-2">
                        We'll extract items, prices, and date automatically.
                      </p>
                    </div>
                  )}

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          )}

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
                {mode === 'receipt' && (
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2">
                      Date & Time of Purchase
                    </label>
                    <input
                      type="datetime-local"
                      value={tripEndLocal}
                      onChange={(e) => setTripEndLocal(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold"
                    />
                  </div>
                )}
              </div>

              {/* Validity Dates - Only show in Flyer Mode */}
              {mode === 'flyer' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Valid From
                    </label>
                    <input
                      type="date"
                      value={validFrom}
                      onChange={(e) => setValidFrom(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Valid Until
                    </label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Create past trip toggle - ONLY show in receipt mode */}
          {mode === 'receipt' && (
            <div className="w-full bg-white p-3">
              <div className="border border-slate-200 rounded-2xl shadow-md p-4">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={createPastTrip}
                    onChange={(e) => setCreatePastTrip(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 cursor-pointer"
                  />
                  <span className="text-s font-semibold text-gray-700">
                    Save Receipt to your Recent Trips
                  </span>
                </label>
                <p className="text-s text-gray-500 mt-2">
                  Use this to track purchases made outside the app.
                </p>
              </div>
            </div>
          )}

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

                    {/* Quantity (only show in receipt mode) */}
                    {mode === 'receipt' && (
                      <div className="w-16">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="1"
                          value={ri.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold text-right"
                        />
                      </div>
                    )}

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

          {/* Total - only show in receipt mode */}
          {mode === 'receipt' && (
            <div className="w-full bg-white p-5">
              <div className="border-t pt-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-gray-800">Total:</span>
                  <span className="text-2xl font-bold text-gray-800">${total.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={saveReceipt}
                className="w-full bg-orange-500 text-white px-4 py-3 rounded-2xl text-base font-semibold hover:bg-indigo-700 transition cursor-pointer"
              >
                Save Receipt
              </button>
            </div>
          )}

          {/* Flyer mode - just save button, no total */}
          {mode === 'flyer' && (
            <div className="w-full bg-white p-5">
              <button
                onClick={saveReceipt}
                className="w-full bg-indigo-600 text-white px-4 py-3 rounded-2xl text-base font-semibold hover:bg-indigo-700 transition cursor-pointer"
              >
                Save Flyer Prices
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
