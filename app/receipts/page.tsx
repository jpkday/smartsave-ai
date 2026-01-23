'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { getFuzzyMatch } from '../lib/utils';
import { PlusIcon } from '@heroicons/react/24/solid';
import StatusModal from '../components/StatusModal';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';
const RECEIPT_DRAFT_KEY = 'receipt_draft_v1';

type ReceiptDraft = {
  store: string;
  date: string;
  tripEndLocal: string;
  receiptItems: ReceiptItem[];
};

interface ReceiptItem {
  item: string;
  quantity: string;
  price: string;
  sku: string;
  priceDirty?: boolean;
  originalName?: string; // OCR name for alias learning
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
  const [itemAliases, setItemAliases] = useState<{ alias: string; itemName: string }[]>([]);
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
  const [showManualMobile, setShowManualMobile] = useState(false);
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  // Alias Modal Removed


  // No validity dates for receipts
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
    // Determine date from local time
    setDate(local.split('T')[0]);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(RECEIPT_DRAFT_KEY);
    if (!raw) return;

    try {
      const draft: ReceiptDraft = JSON.parse(raw);

      if (draft.store) {
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
      receiptItems
    };

    localStorage.setItem(RECEIPT_DRAFT_KEY, JSON.stringify(draft));
  }, [selectedStoreId, date, tripEndLocal, receiptItems]);

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

    // 4. Load Item Aliases
    const { data: aliasesData } = await supabase
      .from('item_aliases')
      .select('alias, items!inner(name)');

    if (aliasesData) {
      const mappedAliases = aliasesData.map((a: any) => ({
        alias: a.alias,
        itemName: a.items.name
      }));
      setItemAliases(mappedAliases);
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

  // Removed saveAlias and handleItemSelect as they correspond to legacy modal learning.
  // Reconciliation is now handled on /receipts/import/[id]

  const handleItemSelect = (index: number, selectedItem: string) => {
    updateItem(index, 'item', selectedItem);
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

  // Helper to resize image
  const resizeImage = (input: File | string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 1024;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Compress to JPEG 0.7 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = reject;

      if (typeof input === 'string') {
        img.src = input;
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(input);
      }
    });
  };

  const processReceiptImage = async (rawBase64: string) => {
    setScanning(true);
    let finalBase64 = rawBase64;

    try {
      // Try to resize (safari/chrome handle standard formats)
      // IF HEIC, this might fail or browser might not render it to canvas
      finalBase64 = await resizeImage(rawBase64);
    } catch (resizeErr) {
      console.warn("Image resize failed (likely HEIC/unsupported format), sending original:", resizeErr);
      // Fallback to original
      finalBase64 = rawBase64;
    }

    // Always try to set preview. Mobile browsers (iOS) can typically render HEIC.
    setScanPreview(finalBase64);

    try {
      const response = await fetch('/api/receipts/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-household-code': householdCode
        },
        body: JSON.stringify({
          image: finalBase64,
          candidateItems: items // Inject known items for AI matching
        }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse API response:", text);
        throw new Error(`Server returned invalid response: ${text.slice(0, 100)}...`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze receipt');
      }

      if (data.success && data.importId) {
        // Redirect to reconciliation page
        router.push(`/receipts/import/${data.importId}`);
      } else {
        setStatusModal({
          isOpen: true,
          title: 'Analysis Problem',
          message: 'Unexpected response from analysis. Please try again.',
          type: 'warning'
        });
      }
    } catch (error: any) {
      console.error("Scan error:", error);
      setStatusModal({
        isOpen: true,
        title: 'Scan Failed',
        message: error.message,
        type: 'error'
      });
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();

      reader.onload = async (event) => {
        const rawBase64 = event.target?.result as string;
        await processReceiptImage(rawBase64);
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
      setStatusModal({
        isOpen: true,
        title: 'Store Required',
        message: 'Please select a store before saving.',
        type: 'warning'
      });
      return;
    }

    if (!tripEndLocal) {
      setStatusModal({
        isOpen: true,
        title: 'Date Required',
        message: 'Please select a trip end date/time.',
        type: 'warning'
      });
      return;
    }

    // Find store details from ID
    const selectedStore = stores.find(s => s.id === selectedStoreId);
    if (!selectedStore) {
      setStatusModal({
        isOpen: true,
        title: 'Store Not Found',
        message: 'Selected store not found in list.',
        type: 'error'
      });
      return;
    }
    const storeName = selectedStore.name;

    // Set recorded_date (Receipt = tripEndLocal)
    const recordedDate = tripEndLocal.slice(0, 10);
    const endedAtIso = toIsoFromLocalDateTime(tripEndLocal);

    if (!endedAtIso) {
      setStatusModal({
        isOpen: true,
        title: 'Invalid Date',
        message: 'The selected date/time is invalid.',
        type: 'error'
      });
      return;
    }

    const validItems = receiptItems.filter((ri) => {
      const price = parseFloat(ri.price || '0');
      const qty = parseFloat(ri.quantity || '1');
      return ri.item && !isNaN(price) && price > 0 && !isNaN(qty) && qty > 0;
    });

    if (validItems.length === 0) {
      setStatusModal({
        isOpen: true,
        title: 'No Items',
        message: 'Please add at least one item with a valid price.',
        type: 'warning'
      });
      return;
    }

    const { data: storeData, error: storeErr } = await supabase
      .from('stores')
      .select('id')
      .eq('id', selectedStoreId)
      .single();

    if (storeErr || !storeData?.id) {
      setStatusModal({
        isOpen: true,
        title: 'Error',
        message: 'Store not found in database.',
        type: 'error'
      });
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
      setStatusModal({
        isOpen: true,
        title: 'Connection Error',
        message: 'Failed to load items. Check your connection.',
        type: 'error'
      });
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
        setStatusModal({
          isOpen: true,
          title: 'Error',
          message: 'Failed to add new items. Please try again.',
          type: 'error'
        });
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
      setStatusModal({
        isOpen: true,
        title: 'Error',
        message: 'Failed to load item IDs.',
        type: 'error'
      });
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

        return priceRow;
      })
      .filter(Boolean);

    const { error: priceInsertErr } = await supabase.from('price_history').insert(priceRows as any);

    if (priceInsertErr) {
      console.error(priceInsertErr);
      setStatusModal({
        isOpen: true,
        title: 'Save Failed',
        message: 'Failed to save prices. Please try again.',
        type: 'error'
      });
      return;
    }

    if (createPastTrip) {
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
        setStatusModal({
          isOpen: true,
          title: 'Trip Error',
          message: 'Saved prices, but failed to create the trip.',
          type: 'warning'
        });
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
          setStatusModal({
            isOpen: true,
            title: 'Trip Update Error',
            message: 'Saved prices + trip, but failed to save trip items.',
            type: 'warning'
          });
        }
      }
    }

    setStatusModal({
      isOpen: true,
      title: 'Success!',
      message: `Receipt saved! Added ${validItems.length} prices for ${storeName} on ${new Date(tripEndLocal).toLocaleString()}`,
      type: 'success'
    });

    setSelectedStoreId('');
    setDate(new Date().toISOString().split('T')[0]);
    setReceiptItems([{ item: '', quantity: '1', price: '', sku: '', priceDirty: false }]);
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
              <Header currentPage="Add Receipt" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-2 sm:px-4 md:px-8 pt-6">
        <div className="bg-white rounded-2xl shadow-lg p-3">
          {/* Desktop Header */}
          <div className="hidden md:block mb-2 px-3 pt-2">
            <h1 className="text-2xl font-bold text-gray-800">Add Receipt</h1>
          </div>

          {/* Scan Receipt Button */}
          <div className="w-full bg-white p-3 mb-2 md:hidden">
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
                        <div className="text-white font-bold animate-pulse text-xl">Analyzing... </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center w-full">
                    <h3 className="font-bold text-blue-900 mb-2"></h3>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={scanning}
                      className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Scan Receipt
                    </button>
                    <p className="text-xs text-blue-700 mt-2">
                      We'll extract item and price data automatically.
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

            {/* Mobile Fallback: Add Manually instead */}
            {!showManualMobile && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowManualMobile(true)}
                  className="text-blue-600 font-semibold text-sm hover:underline flex items-center justify-center gap-1 mx-auto"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add manually instead
                </button>
              </div>
            )}
          </div>

          <div className={`w-full bg-white p-3 ${(showManualMobile ? '' : 'hidden md:block')}`}>
            <div className="border border-slate-200 rounded-2xl shadow-sm p-4">

              {/* Store and Date Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold text-gray-700">Store</label>
                    {/* Desktop Upload Button */}
                    <div className="hidden md:flex items-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={scanning}
                        className="text-xs font-bold text-blue-600 hover:text-indigo-600 flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {scanning ? (
                          <>
                            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Upload Receipt
                          </>
                        )}
                      </button>
                    </div>
                  </div>
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
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2">
                    Date & Time of Purchase
                  </label>
                  <input
                    type="datetime-local"
                    value={tripEndLocal}
                    onChange={(e) => setTripEndLocal(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Create past trip toggle */}
          <div className={`w-full bg-white p-3 ${(showManualMobile ? '' : 'hidden md:block')}`}>
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

          {/* Items Table */}
          <div className={`w-full bg-white p-3 ${(showManualMobile ? '' : 'hidden md:block')}`}>
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
                        onBlur={(e) => {
                          // Trigger alias prompt on blur if value matches a canonical item
                          if (items.includes(e.target.value) &&
                            ri.originalName &&
                            ri.originalName !== e.target.value) {
                            // Optional: handleItemSelect(idx, e.target.value);
                            // Only prompt if they explicitly selected/typed a known item
                            // Using blur might be annoying, maybe relying on datalist selection is better?
                            // Let's stick to a manual "Learn" button or just simple onChange logic? 
                            // Actually, `handleItemSelect` usage in `onChange` is hard because it triggers on every keystroke.
                            // Let's rely on the user finishing the entry.
                            handleItemSelect(idx, e.target.value);
                          }
                        }}
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

                    {/* Quantity */}
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

          {/* Total & Save */}
          <div className={`w-full bg-white p-5 ${(showManualMobile ? '' : 'hidden md:block')}`}>
            <div className="border-t pt-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-gray-800">Total:</span>
                <span className="text-2xl font-bold text-gray-800">${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="md:flex md:justify-end">
              <button
                onClick={saveReceipt}
                className="w-full md:w-auto md:px-16 bg-orange-500 text-white px-4 py-3 rounded-2xl text-base font-semibold hover:bg-indigo-700 transition cursor-pointer"
              >
                Save Receipt
              </button>
            </div>
          </div>
        </div>
      </div>

      <StatusModal
        isOpen={statusModal.isOpen}
        onClose={() => setStatusModal(prev => ({ ...prev, isOpen: false }))}
        title={statusModal.title}
        message={statusModal.message}
        type={statusModal.type}
      />
    </div>
  );
}
