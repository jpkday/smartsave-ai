'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

interface PriceRecord {
  id: string;
  item_name: string;
  store: string;
  price: string;
  recorded_date: string;
  created_at: string;
}

function HistoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [stores, setStores] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [selectedStore, setSelectedStore] = useState<string>('All');
  const [priceHistory, setPriceHistory] = useState<PriceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [newDate, setNewDate] = useState('');
  const [showCopied, setShowCopied] = useState(false);

  useEffect(() => {
    loadStoresAndItems();
    // Set today's date as default for new entries
    setNewDate(new Date().toISOString().split('T')[0]);
    
    // Load from URL parameters with proper decoding
    const itemParam = searchParams.get('item');
    const storeParam = searchParams.get('store');
    
    if (itemParam) {
      try {
        // Try to parse as JSON first (new format)
        const decodedItem = JSON.parse(itemParam);
        setSelectedItem(decodedItem);
      } catch {
        // Fallback to direct string (old format)
        setSelectedItem(itemParam);
      }
    }
    
    if (storeParam) {
      try {
        // Try to parse as JSON first (new format)
        const decodedStore = JSON.parse(storeParam);
        setSelectedStore(decodedStore);
      } catch {
        // Fallback to direct string (old format)
        setSelectedStore(storeParam);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedItem) {
      loadPriceHistory();
    }
  }, [selectedItem, selectedStore]);

  const loadStoresAndItems = async () => {
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

  const updateURL = (item: string, store: string) => {
    const params = new URLSearchParams();
    // Use JSON encoding to handle commas in names
    if (item) params.set('item', JSON.stringify(item));
    if (store && store !== 'All') params.set('store', JSON.stringify(store));
    
    const newURL = params.toString() ? `/history?${params.toString()}` : '/history';
    router.push(newURL);
  };

  const shareLink = async () => {
    const url = window.location.href;
    
    try {
      await navigator.clipboard.writeText(url);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      alert('Failed to copy link');
    }
  };

  const loadPriceHistory = async () => {
    setLoading(true);
    
    let query = supabase
      .from('price_history')
      .select('*')
      .eq('user_id', SHARED_USER_ID)
      .eq('item_name', selectedItem)
      .order('recorded_date', { ascending: false });
    
    if (selectedStore !== 'All') {
      query = query.eq('store', selectedStore);
    }
    
    const { data } = await query;
    
    if (data) {
      setPriceHistory(data);
    }
    
    setLoading(false);
  };

  const handlePriceChange = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    let priceValue = '';
    if (digits !== '') {
      // Convert to cents, then to dollars
      const cents = parseInt(digits, 10);
      priceValue = (cents / 100).toFixed(2);
    }
    
    setNewPrice(priceValue);
  };

  const addPriceEntry = async () => {
    if (!newPrice || parseFloat(newPrice) === 0) {
      alert('Please enter a valid price');
      return;
    }

    if (!newDate) {
      alert('Please select a date');
      return;
    }

    // Insert new price record
    const { error } = await supabase
      .from('price_history')
      .insert({
        item_name: selectedItem,
        store: selectedStore,
        price: newPrice,
        user_id: SHARED_USER_ID,
        recorded_date: newDate,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error adding price:', error);
      alert('Failed to add price entry');
      return;
    }

    // Clear form
    setNewPrice('');
    setNewDate(new Date().toISOString().split('T')[0]);

    // Reload history to show new entry
    loadPriceHistory();
  };

  const deletePriceEntry = async (recordId: string, recordDate: string, recordPrice: string) => {
    if (!confirm(`Delete price entry: $${parseFloat(recordPrice).toFixed(2)} from ${new Date(recordDate).toLocaleDateString()}?`)) {
      return;
    }

    const { error } = await supabase
      .from('price_history')
      .delete()
      .eq('id', recordId);

    if (error) {
      console.error('Error deleting price:', error);
      alert('Failed to delete price entry');
      return;
    }

    // Reload history to show updated list
    loadPriceHistory();
  };

  const getPriceChange = (currentPrice: string, previousPrice: string) => {
    const current = parseFloat(currentPrice);
    const previous = parseFloat(previousPrice);
    const diff = current - previous;
    
    if (diff === 0) return null;
    
    return {
      amount: Math.abs(diff),
      direction: diff > 0 ? 'up' : 'down',
      percent: ((Math.abs(diff) / previous) * 100).toFixed(0)
    };
  };

  // Group by store if showing all stores
  const groupedHistory: {[store: string]: PriceRecord[]} = {};
  if (selectedStore === 'All') {
    priceHistory.forEach(record => {
      if (!groupedHistory[record.store]) {
        groupedHistory[record.store] = [];
      }
      groupedHistory[record.store].push(record);
    });
  }

  // Prepare data for chart (reverse order for chronological display)
  const chartData = priceHistory.slice().reverse().map(record => ({
    date: new Date(record.recorded_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    price: parseFloat(record.price),
    fullDate: record.recorded_date
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* White Header Box */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="hidden md:block text-2xl md:text-4xl font-bold text-gray-800">Price History</h1>
              <div className="hidden md:flex items-center gap-3 mt-2">
                <p className="text-xs md:text-sm text-gray-600">Track how prices change over time</p>
                <button
                  onClick={shareLink}
                  className="relative text-teal-500 hover:text-teal-600 transition cursor-pointer"
                  title="Share this page"
                >
                  <span className="text-base">🔗</span>
                  {showCopied && (
                    <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      Copied!
                    </span>
                  )}
                </button>
              </div>
            </div>
            <Header currentPage="History" />
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Select Item</label>
              <select
                value={selectedItem}
                onChange={(e) => {
                  setSelectedItem(e.target.value);
                  updateURL(e.target.value, selectedStore);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold bg-white"
              >
                <option value="">Choose an item...</option>
                {items.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Store</label>
              <select
                value={selectedStore}
                onChange={(e) => {
                  setSelectedStore(e.target.value);
                  updateURL(selectedItem, e.target.value);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold bg-white"
              >
                <option value="All">All Stores</option>
                {stores.map(store => (
                  <option key={store} value={store}>{store}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* History Display */}
        {!selectedItem ? (
          <div className="bg-white rounded-lg shadow-lg p-8 md:p-12 text-center">
            <p className="text-gray-500 text-base md:text-lg">Select an item above to view price history</p>
          </div>
        ) : loading ? (
          <div className="bg-white rounded-lg shadow-lg p-8 md:p-12 text-center">
            <p className="text-gray-500 text-base md:text-lg">Loading...</p>
          </div>
        ) : selectedStore === 'All' ? (
          // Show grouped by store (All Stores view)
          priceHistory.length === 0 ? (
            <div className="bg-white rounded-lg shadow-lg p-8 md:p-12 text-center">
              <p className="text-gray-500 text-base md:text-lg">No price history found for {selectedItem}</p>
              <p className="text-gray-400 text-sm mt-2">Select a specific store to add your first price entry</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedHistory).sort(([a], [b]) => a.localeCompare(b)).map(([store, records]) => (
                <div key={store} className="bg-white rounded-lg shadow-lg p-4 md:p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">{store}</h2>
                  <div className="space-y-3">
                    {records.map((record, idx) => {
                      const prevRecord = records[idx + 1];
                      const change = prevRecord ? getPriceChange(record.price, prevRecord.price) : null;
                      
                      return (
                        <div key={record.id} className="flex justify-between items-center gap-3">
                          <div className="flex-1 flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-semibold text-gray-800">
                                {new Date(record.recorded_date).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })}
                              </p>
                              {change && (
                                <p className={`text-sm ${change.direction === 'up' ? 'text-red-600' : 'text-green-600'}`}>
                                  {change.direction === 'up' ? '⬆️' : '⬇️'} ${change.amount.toFixed(2)} ({change.percent}%)
                                </p>
                              )}
                            </div>
                            <span className="text-2xl font-bold text-gray-800">${parseFloat(record.price).toFixed(2)}</span>
                          </div>
                          <button
                            onClick={() => deletePriceEntry(record.id, record.recorded_date, record.price)}
                            className="text-red-600 hover:text-red-800 cursor-pointer"
                            title="Delete entry"
                          >
                            🗑️
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          // Show single store view with add entry widget
          <div className="space-y-6">
            {/* Price Graph - Only shows if there's data */}
            {priceHistory.length > 1 && (
              <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">
                  Price Over Time
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      domain={[0, 'dataMax + 1']}
                      tickFormatter={(value) => `$${value.toFixed(2)}`}
                    />
                    <Tooltip 
                      formatter={(value: number | undefined) => value !== undefined ? [`$${value.toFixed(2)}`, 'Price'] : ['', '']}
                      labelStyle={{ color: '#1f2937' }}
                    />
                    <Line 
                      type="linear" 
                      dataKey="price" 
                      stroke="#14b8a6" 
                      strokeWidth={3}
                      dot={{ fill: '#14b8a6', r: 6 }}
                      activeDot={{ r: 8 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            
            {/* Timeline List - Shows existing data or helpful message */}
            {priceHistory.length > 0 ? (
              <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">
                  {selectedItem} at {selectedStore}
                </h2>
                <div className="space-y-3">
                  {priceHistory.map((record, idx) => {
                    const prevRecord = priceHistory[idx + 1];
                    const change = prevRecord ? getPriceChange(record.price, prevRecord.price) : null;
                    
                    return (
                      <div key={record.id} className="flex justify-between items-center gap-3">
                        <div className="flex-1 flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-semibold text-gray-800">
                              {new Date(record.recorded_date).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </p>
                            {change && (
                              <p className={`text-sm ${change.direction === 'up' ? 'text-red-600' : 'text-green-600'}`}>
                                {change.direction === 'up' ? '⬆️' : '⬇️'} ${change.amount.toFixed(2)} ({change.percent}%)
                              </p>
                            )}
                          </div>
                          <span className="text-2xl font-bold text-gray-800">${parseFloat(record.price).toFixed(2)}</span>
                        </div>
                        <button
                          onClick={() => deletePriceEntry(record.id, record.recorded_date, record.price)}
                          className="text-red-600 hover:text-red-800 cursor-pointer"
                          title="Delete entry"
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-8 md:p-12 text-center">
                <p className="text-gray-500 text-base md:text-lg">No price history yet for {selectedItem} at {selectedStore}</p>
                <p className="text-gray-400 text-sm mt-2">Add your first entry below to start tracking prices! 📊</p>
              </div>
            )}

            {/* Add Price Entry Widget - At bottom */}
            <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Add Price Entry</h2>
              <p className="text-sm text-gray-600 mb-4">
                Adding price for: <span className="font-semibold">{selectedItem}</span> at <span className="font-semibold">{selectedStore}</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Price</label>
                  <div className="flex items-center border border-gray-300 rounded-lg px-3 py-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
                    <span className="text-gray-800 font-semibold mr-1">$</span>
                    <input
                      type="text"
                      placeholder="0.00"
                      value={newPrice}
                      onChange={(e) => handlePriceChange(e.target.value)}
                      className="w-full text-right font-semibold text-gray-800 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={addPriceEntry}
                    className="w-full bg-teal-500 text-white px-4 py-3 rounded-lg font-semibold hover:bg-teal-600 transition cursor-pointer"
                  >
                    Add Entry
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function History() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-gray-500 text-lg">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <HistoryContent />
    </Suspense>
  );
}