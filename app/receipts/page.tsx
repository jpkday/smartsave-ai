'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

interface ReceiptItem {
  item: string;
  price: string;
}

export default function Receipts() {
  const [stores, setStores] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [store, setStore] = useState('');
  const [date, setDate] = useState('');
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([{ item: '', price: '' }]);
  const itemRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    loadData();
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
  }, []);

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
    setReceiptItems([...receiptItems, { item: '', price: '' }]);
    setTimeout(() => {
      const newIndex = receiptItems.length;
      itemRefs.current[newIndex]?.focus();
    }, 100);
  };

  const removeRow = (index: number) => {
    setReceiptItems(receiptItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: 'item' | 'price', value: string) => {
    const updated = [...receiptItems];
    if (field === 'price') {
      // Use same price entry logic as main prices page
      const digits = value.replace(/\D/g, '');
      if (digits === '') {
        updated[index][field] = '';
      } else {
        const cents = parseInt(digits, 10);
        updated[index][field] = (cents / 100).toFixed(2);
      }
    } else {
      updated[index][field] = value;
    }
    setReceiptItems(updated);
  };

  const saveReceipt = async () => {
    if (!store) {
      alert('Please select a store');
      return;
    }
  
    if (!date) {
      alert('Please select a date');
      return;
    }
  
    // Filter out empty rows
    const validItems = receiptItems.filter(ri => ri.item && parseFloat(ri.price || '0') > 0);
    
    if (validItems.length === 0) {
      alert('Please add at least one item with a price');
      return;
    }
  
    // Add any new items to the database
    for (const ri of validItems) {
      if (!items.includes(ri.item)) {
        await supabase
          .from('items')
          .insert({ name: ri.item, user_id: SHARED_USER_ID });
        setItems([...items, ri.item]);
      }
    }
  
    // Get store_id
    const { data: storeData } = await supabase
      .from('stores')
      .select('id')
      .eq('name', store)
      .single();
  
    if (!storeData) {
      alert('Store not found');
      return;
    }
  
    // Insert prices into price_history (never update - always insert)
    for (const ri of validItems) {
      // Get item_id for this item
      const { data: itemData } = await supabase
        .from('items')
        .select('id')
        .eq('name', ri.item)
        .eq('user_id', SHARED_USER_ID)
        .single();
  
      if (!itemData) {
        console.error('Item not found:', ri.item);
        continue;
      }
  
      await supabase
        .from('price_history')
        .insert({
          item_id: itemData.id,
          item_name: ri.item,
          store_id: storeData.id,
          store: store,
          price: ri.price,
          user_id: SHARED_USER_ID,
          recorded_date: date, // Use the receipt date
          created_at: new Date().toISOString()
        });
    }
  
    alert(`Receipt saved! Added ${validItems.length} prices for ${store} on ${new Date(date).toLocaleDateString()}`);
    
    // Reset form
    setStore('');
    setDate(new Date().toISOString().split('T')[0]);
    setReceiptItems([{ item: '', price: '' }]);
    
    // Reload items in case new ones were added
    loadData();
  };

  const total = receiptItems.reduce((sum, ri) => {
    return sum + parseFloat(ri.price || '0');
  }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* White Header Box */}
        <div className="bg-white rounded-2xl shadow-md p-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="hidden md:block text-2xl md:text-4xl font-bold text-gray-800">Enter Receipt</h1>
              <p className="hidden md:block text-xs md:text-sm text-gray-600 mt-2">Quickly update prices from your shopping receipts</p>
            </div>
            <Header currentPage="Add Receipt" />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          {/* Store and Date Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold"
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
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
                  <div className="w-32">
                    <div className="flex items-center border border-gray-300 rounded-2xl px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
                      <span className="text-gray-800 font-semibold mr-1">$</span>
                      <input
                        type="text"
                        placeholder="0.00"
                        value={ri.price}
                        onChange={(e) => updateItem(idx, 'price', e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && ri.item && ri.price) {
                            e.preventDefault();
                            if (idx === receiptItems.length - 1) {
                              addRow();
                            }
                          }
                        }}
                        className="w-full text-right font-semibold text-gray-800 focus:outline-none"
                      />
                    </div>
                  </div>
                  {receiptItems.length > 1 && (
                    <button
                      onClick={() => removeRow(idx)}
                      className="text-red-600 hover:text-red-800 font-semibold cursor-pointer px-3"
                    >
                      ✕
                    </button>
                  )}
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

          {/* Total */}
          <div className="border-t pt-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-gray-800">Total:</span>
              <span className="text-3xl font-bold text-gray-800">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={saveReceipt}
            className="w-full bg-indigo-600 text-white px-4 py-3 rounded-2xl text-base font-semibold hover:bg-indigo-700 transition cursor-pointer"
          >
            Save Receipt
          </button>
        </div>
      </div>
    </div>
  );
}