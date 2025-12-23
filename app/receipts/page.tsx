'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Header from '../components/Header';

const STORES = ['Acme', 'Giant', 'Walmart', 'Costco', 'Aldi'];

interface ReceiptItem {
  item: string;
  price: string;
}

export default function Receipts() {
  const [items, setItems] = useState<string[]>([]);
  const [store, setStore] = useState('');
  const [date, setDate] = useState('');
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([{ item: '', price: '' }]);
  const itemRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const savedItems = localStorage.getItem('smartsave-items');
    if (savedItems) {
      setItems(JSON.parse(savedItems));
    }
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
  }, []);

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

  const saveReceipt = () => {
    if (!store) {
      alert('Please select a store');
      return;
    }

    // Filter out empty rows
    const validItems = receiptItems.filter(ri => ri.item && parseFloat(ri.price || '0') > 0);
    
    if (validItems.length === 0) {
      alert('Please add at least one item with a price');
      return;
    }

    // Update prices in the database
    const savedPrices = localStorage.getItem('smartsave-prices');
    const prices = savedPrices ? JSON.parse(savedPrices) : {};

    // Add any new items to the items list
    const currentItems = [...items];
    let itemsUpdated = false;
    validItems.forEach(ri => {
    if (!currentItems.includes(ri.item)) {
        currentItems.push(ri.item);
        itemsUpdated = true;
    }
    });
    if (itemsUpdated) {
    localStorage.setItem('smartsave-items', JSON.stringify(currentItems));
    setItems(currentItems);
    }

    validItems.forEach(ri => {
    prices[`${store}-${ri.item}`] = ri.price;
    });

    validItems.forEach(ri => {
      prices[`${store}-${ri.item}`] = ri.price;
    });

    localStorage.setItem('smartsave-prices', JSON.stringify(prices));
    const now = new Date().toLocaleString();
    localStorage.setItem('smartsave-last-updated', now);

    // Save receipt history
    const receipts = localStorage.getItem('smartsave-receipts');
    const receiptHistory = receipts ? JSON.parse(receipts) : [];
    receiptHistory.push({
      store,
      date,
      items: validItems,
      total: validItems.reduce((sum, ri) => sum + parseFloat(ri.price), 0),
      timestamp: now
    });
    localStorage.setItem('smartsave-receipts', JSON.stringify(receiptHistory));

    alert(`Receipt saved! Updated ${validItems.length} prices for ${store}`);
    
    // Reset form
    setStore('');
    setDate(new Date().toISOString().split('T')[0]);
    setReceiptItems([{ item: '', price: '' }]);
  };

  const total = receiptItems.reduce((sum, ri) => {
    return sum + parseFloat(ri.price || '0');
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
      <Header currentPage="Receipts" />
      <h1 className="text-4xl font-bold text-gray-800 mb-8">Enter Receipt</h1>

        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Store and Date Selection */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Store</label>
              <select
                value={store}
                onChange={(e) => setStore(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold cursor-pointer"
              >
                <option value="">Select a store...</option>
                {STORES.sort().map(s => (
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
                        />
                    <datalist id={`items-${idx}`}>
                        {items.sort().map(item => (
                        <option key={item} value={item} />
                        ))}
                    </datalist>
                    </div>
                  <div className="w-32">
                    <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
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
              className="mt-3 text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
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
            className="w-full bg-blue-600 text-white px-6 py-4 rounded-lg text-xl font-semibold hover:bg-blue-700 transition cursor-pointer"
          >
            Save Receipt & Update Prices
          </button>
        </div>
      </div>
    </div>
  );
}