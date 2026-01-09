'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';
const RECEIPT_DRAFT_KEY = 'receipt_draft_v1';
const MODE_KEY = 'receipt_mode_v1';

type ReceiptMode = 'receipt' | 'flyer';

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
  priceDirty?: boolean; // user edited manually
}


export default function Receipts() {
  const [stores, setStores] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [store, setStore] = useState('');
  const [date, setDate] = useState('');
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([
    { item: '', quantity: '1', price: '', priceDirty: false }
  ]);
  const itemRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [createPastTrip, setCreatePastTrip] = useState(true);
  const householdCode = typeof window !== 'undefined' ? localStorage.getItem('household_code') || '' : '';
  const [tripEndLocal, setTripEndLocal] = useState(''); // "YYYY-MM-DDTHH:mm"
  const [storePriceLookup, setStorePriceLookup] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<ReceiptMode>('receipt');
  

  useEffect(() => {
    loadData();
  
    // default: now (rounded to nearest minute)
    const now = new Date();
    now.setSeconds(0, 0);
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16); // YYYY-MM-DDTHH:mm
  
    setTripEndLocal(local);

    // Load saved mode
    const savedMode = localStorage.getItem(MODE_KEY);
    if (savedMode === 'flyer' || savedMode === 'receipt') {
      setMode(savedMode);
    }
  }, []);

  // Update date format when mode changes
  useEffect(() => {
    if (mode === 'flyer') {
      // Set to today's date at noon for flyer mode
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10);
      setTripEndLocal(dateStr + 'T12:00');
    }
  }, [mode]);
  
  useEffect(() => {
    const raw = localStorage.getItem(RECEIPT_DRAFT_KEY);
    if (!raw) return;
  
    try {
      const draft: ReceiptDraft = JSON.parse(raw);
  
      if (draft.store) setStore(draft.store);
      if (draft.date) setDate(draft.date);
      if (draft.tripEndLocal) setTripEndLocal(draft.tripEndLocal);
      if (draft.receiptItems?.length) setReceiptItems(draft.receiptItems);
    } catch (e) {
      console.warn('Failed to restore receipt draft', e);
      localStorage.removeItem(RECEIPT_DRAFT_KEY);
    }
  }, []);
  
  useEffect(() => {
    const draft: ReceiptDraft = {
      store,
      date,
      tripEndLocal,
      receiptItems,
    };
  
    localStorage.setItem(RECEIPT_DRAFT_KEY, JSON.stringify(draft));
  }, [store, date, tripEndLocal, receiptItems]);
  
  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    const loadLatestPricesForStore = async () => {
      if (!store) {
        setStorePriceLookup({});
        return;
      }
  
      const { data, error } = await supabase
        .from('price_history')
        .select('item_name, price, recorded_date')
        .eq('user_id', SHARED_USER_ID)
        .eq('store', store)
        .order('recorded_date', { ascending: false });
  
      if (error) {
        console.error('Error loading store prices:', error);
        setStorePriceLookup({});
        return;
      }
  
      // Keep only latest price per item_name (data is already newest-first)
      const lookup: Record<string, string> = {};
      for (const row of data || []) {
        if (!lookup[row.item_name]) lookup[row.item_name] = String(row.price);
      }
  
      setStorePriceLookup(lookup);
      applySuggestedPricesForCurrentStore(lookup);
    };
  
    loadLatestPricesForStore();
  }, [store]);
  

  const loadData = async () => {
    // Load stores
    const { data: storesData } = await supabase
      .from('stores')
      .select('name')
      .order('name');
    
    if (storesData) {
      setStores(storesData.map(s => s.name));
    }

    // Load items
    const { data: itemsData } = await supabase
      .from('items')
      .select('name')
      .order('name');
    
    if (itemsData) {
      setItems(itemsData.map(i => i.name));
    }
  };

  const addRow = () => {
    setReceiptItems([...receiptItems, { item: '', quantity: '1', price: '', priceDirty: false }]);
    setTimeout(() => {
      const newIndex = receiptItems.length;
      itemRefs.current[newIndex]?.focus();
    }, 100);
  };
  

  const removeRow = (index: number) => {
    setReceiptItems((prev) => {
      if (prev.length <= 1) {
        // Never allow 0 rows — reset to a single blank row
        return [{ item: '', price: '', quantity: '1' } as any];
      }
      return prev.filter((_, i) => i !== index);
    });
  
    // Optional: keep the UX snappy
    setTimeout(() => itemRefs.current[0]?.focus(), 50);
  };
  

  const applySuggestedPricesForCurrentStore = (lookup: Record<string, string>) => {
    setReceiptItems((prev) =>
      prev.map((row) => {
        const itemName = (row.item || '').trim();
        if (!itemName) return row;
  
        // don't overwrite user-entered prices
        if (row.priceDirty) return row;
  
        const suggested = lookup[itemName];
        if (!suggested) {
          // optional: clear if no known price and user hasn't overridden
          return { ...row, price: '' };
        }
  
        const num = parseFloat(suggested);
        const normalized = !isNaN(num) ? num.toFixed(2) : suggested;
  
        return { ...row, price: normalized };
      })
    );
  };
  

  const updateItem = (index: number, field: 'item' | 'quantity' | 'price', value: string) => {
    setReceiptItems((prev) => {
      const updated = [...prev];
      const row = { ...updated[index] };
  
      if (field === 'price') {
        row.priceDirty = true;
  
        const digits = value.replace(/\D/g, '');
        if (digits === '') {
          row.price = '';
        } else {
          const cents = parseInt(digits, 10);
          row.price = (cents / 100).toFixed(2);
        }
      } else if (field === 'quantity') {
        // ✅ allow decimals, keep as string
        if (/^\d*\.?\d*$/.test(value)) {
          row.quantity = value;
        }
      } else {
        row.item = value;
  
        // ✅ auto-fill price when item selected (only if not overridden)
        const suggested = storePriceLookup[value];
        if (!row.priceDirty && suggested) {
          row.price = suggested;
        }
      }
  
      updated[index] = row;
      return updated;
    });
  };
  
    // Converts "YYYY-MM-DDTHH:mm" (from datetime-local) into a real UTC ISO timestamp
    const toIsoFromLocalDateTime = (local: string) => {
      // local example: "2026-01-07T18:30"
      const [datePart, timePart] = local.split('T');
      if (!datePart || !timePart) return null;
  
      const [y, m, d] = datePart.split('-').map(Number);
      const [hh, mm] = timePart.split(':').map(Number);
  
      // Month is 0-based in JS Date
      const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
      return dt.toISOString();
    };

  const saveReceipt = async () => {
    if (!store) {
      alert('Please select a store');
      return;
    }
  
    if (!tripEndLocal) {
      alert(mode === 'flyer' ? 'Please select a flyer date' : 'Please select a trip end date/time');
      return;
    }

    const recordedDate = tripEndLocal.slice(0, 10); // "YYYY-MM-DD"
  
    // Trip end timestamp (timestampz) - only used in receipt mode
    const endedAtIso = mode === 'receipt' ? toIsoFromLocalDateTime(tripEndLocal) : null;
    if (mode === 'receipt' && !endedAtIso) {
      alert('Please select a trip end date/time');
      return;
    }
  
    // Filter out empty rows
    const validItems = receiptItems.filter((ri) => {
      const price = parseFloat(ri.price || '0');
      const qty = parseFloat(ri.quantity || '1');
      return ri.item && !isNaN(price) && price > 0 && !isNaN(qty) && qty > 0;
    });
  
    if (validItems.length === 0) {
      alert('Please add at least one item with a price');
      return;
    }
  
    // Get store_id
    const { data: storeData, error: storeErr } = await supabase
      .from('stores')
      .select('id')
      .eq('name', store)
      .single();
  
    if (storeErr || !storeData?.id) {
      alert('Store not found');
      return;
    }
  
    const storeId = storeData.id;
  
    // 1) Ensure items exist + build itemId map (so we don't re-query per item)
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
  
    // Re-select to get ids for everything (existing + newly inserted)
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
  
    // 2) Insert prices into price_history (never update - always insert)
    const createdAt = new Date().toISOString();
  
    const priceRows = validItems
    .map((ri) => {
      const itemId = itemIdByName[ri.item];
      if (!itemId) return null;
      return {
        item_id: itemId,
        item_name: ri.item,
        store_id: storeId,
        store,
        price: ri.price,
        user_id: SHARED_USER_ID,
        household_code: householdCode,  // ← ADD THIS LINE
        recorded_date: recordedDate,
        created_at: createdAt,
      };
    })
    .filter(Boolean);
  
    const { error: priceInsertErr } = await supabase.from('price_history').insert(priceRows as any);
  
    if (priceInsertErr) {
      console.error(priceInsertErr);
      alert('Failed to save prices. Check your connection and try again.');
      return;
    }
  
    // 3) OPTIONAL: Create a completed trip + checked items (past trip) - ONLY in receipt mode
    if (mode === 'receipt' && createPastTrip && endedAtIso) {
      // Make started_at a few minutes before ended_at
      const startedAtIso = new Date(new Date(endedAtIso).getTime() - 5 * 60 * 1000).toISOString();
  
      const { data: tripRow, error: tripErr } = await supabase
        .from('trips')
        .insert({
          household_code: householdCode,
          store_id: storeId,
          store,              // ✅ trips table has store (text)
          started_at: startedAtIso,
          ended_at: endedAtIso, // ✅ ensures it is NOT an active trip
        })
        .select('id')
        .single();
  
      if (tripErr || !tripRow?.id) {
        console.error(tripErr);
        alert('Saved prices, but failed to create the trip.');
        // don't return — prices already saved
      } else {
        const tripId = tripRow.id;
  
        const eventRows = validItems
          .map((ri) => {
            const itemId = itemIdByName[ri.item];
            if (!itemId) return null;
  
            const qtyNum = parseFloat(ri.quantity || '1') || 1;
            const priceNum = parseFloat(ri.price || '0') || 0;
  
            return {
              trip_id: tripId,
              household_code: householdCode,
              store_id: storeId,
              store,                 // ✅ shopping_list_events has store (text)
              item_id: itemId,
              item_name: ri.item,
              quantity: qtyNum,      // ✅ from UI
              price: priceNum,       // ✅ store-specific price captured on receipt
              checked_at: endedAtIso // ✅ "completed" at trip end
            };
          })
          .filter(Boolean);
  
        const { error: eventsErr } = await supabase
          .from('shopping_list_events')
          .insert(eventRows as any);
  
        if (eventsErr) {
          console.error(eventsErr);
          alert('Saved prices + trip, but failed to save trip items.');
          // don't return — trip exists, prices exist
        }
      }
    }
  
    // Success message based on mode
    if (mode === 'flyer') {
      alert(
        `Flyer prices saved! Updated ${validItems.length} prices for ${store} from ${new Date(
          tripEndLocal
        ).toLocaleDateString()}`
      );
    } else {
      alert(
        `Receipt saved! Added ${validItems.length} prices for ${store} on ${new Date(
          tripEndLocal
        ).toLocaleString()}`
      );
    }
    
  
    // Reset form
    setStore('');
    setDate(new Date().toISOString().split('T')[0]);
    setReceiptItems([{ item: '', quantity: '1', price: '', priceDirty: false }]);
    localStorage.removeItem(RECEIPT_DRAFT_KEY);

    loadData();
  };
  

  const total = receiptItems.reduce((sum, ri) => {
    const price = parseFloat(ri.price || '0') || 0;
    const qty = parseFloat(ri.quantity || '1') || 1;
    return sum + price * qty;
  }, 0);
  



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 p-0 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="sticky top-0 z-50 bg-white shadow-md p-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="hidden md:block text-2xl md:text-4xl font-bold text-gray-800">
                {mode === 'flyer' ? 'Enter Flyer Prices' : 'Enter Receipt'}
              </h1>
              <p className="hidden md:block text-xs md:text-sm text-gray-600 mt-2">
                {mode === 'flyer' 
                  ? 'Quickly update prices from store flyers and ads'
                  : 'Quickly update prices from your shopping receipts'
                }
              </p>
            </div>
            <Header currentPage={mode === 'flyer' ? 'Add Flyer' : 'Add Receipt'} />
          </div>
        </div>
      </div>
      
      <div className="max-w-5xl mx-auto px-2 sm:px-4 md:px-0 mt-6">
        <div className="bg-white rounded-2xl shadow-lg p-3">
          
          {/* Mode Toggle */}
          <div className="w-full bg-white p-3 mb-2">
            <div className="border border-slate-200 rounded-2xl shadow-sm p-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('receipt')}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition cursor-pointer ${
                    mode === 'receipt'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  🧾 Receipt Mode
                </button>
                <button
                  onClick={() => setMode('flyer')}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition cursor-pointer ${
                    mode === 'flyer'
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

          <div className="w-full bg-white p-3">
          <div className="border border-slate-200 rounded-2xl shadow-sm p-4">
          
          {/* Store and Date Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Store</label>
              <select
                value={store}
                onChange={(e) => setStore(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold cursor-pointer"
              >
                <option value="">Select</option>
                {stores.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2">
                {mode === 'flyer' ? 'Flyer Date' : 'Date & Time of Purchase'}
              </label>
              <input
                type={mode === 'flyer' ? 'date' : 'datetime-local'}
                value={mode === 'flyer' ? tripEndLocal.slice(0, 10) : tripEndLocal}
                onChange={(e) => {
                  if (mode === 'flyer') {
                    // For flyer mode, append default time
                    setTripEndLocal(e.target.value + 'T12:00');
                  } else {
                    setTripEndLocal(e.target.value);
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold"
              />
            </div>
          </div>
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

                  {/* ✅ Quantity (only show in receipt mode) */}
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

            {/* Save Button */}
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
