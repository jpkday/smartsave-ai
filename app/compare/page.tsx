'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';

const STORES = ['Acme', 'Giant', 'Walmart', 'Costco', 'Aldi'];
// TODO: Replace with actual user_id from auth system
// Currently all users share data (single household mode)
const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

export default function Compare() {
  const [prices, setPrices] = useState<{[key: string]: string}>({});
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [filterLetter, setFilterLetter] = useState<string>('All');
  const [multiSelectMode, setMultiSelectMode] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Load items
    const { data: itemsData } = await supabase
      .from('items')
      .select('name')
      .order('name');
    
    if (itemsData) {
      setItems(itemsData.map(i => i.name));
    }

    // Load prices
    const { data: pricesData } = await supabase
      .from('prices')
      .select('*')
      .eq('user_id', SHARED_USER_ID);
    
    if (pricesData) {
      const pricesObj: {[key: string]: string} = {};
      pricesData.forEach(p => {
        pricesObj[`${p.store}-${p.item_name}`] = p.price;
      });
      setPrices(pricesObj);

      // Get most recent update time
      if (pricesData.length > 0) {
        const latest = pricesData.reduce((a, b) => 
          new Date(a.updated_at) > new Date(b.updated_at) ? a : b
        );
        setLastUpdated(new Date(latest.updated_at).toLocaleString());
      }
    }
  };

  // Deselect items when filter changes and they're no longer visible
  useEffect(() => {
    if (filterLetter !== 'All') {
      setSelectedItems(prevSelected => 
        prevSelected.filter(item => item.toUpperCase().startsWith(filterLetter))
      );
    }
  }, [filterLetter]);

  // Clear selections when switching out of multi-select mode
  useEffect(() => {
    if (!multiSelectMode) {
      setSelectedItems([]);
    }
  }, [multiSelectMode]);

  const toggleItem = (item: string) => {
    if (multiSelectMode) {
      // Multi-select mode: toggle on/off
      if (selectedItems.includes(item)) {
        setSelectedItems(selectedItems.filter(i => i !== item));
      } else {
        setSelectedItems([...selectedItems, item]);
      }
    } else {
      // Single-select mode: replace selection
      if (selectedItems.includes(item) && selectedItems.length === 1) {
        setSelectedItems([]); // Deselect if clicking same item
      } else {
        setSelectedItems([item]); // Replace with new item
      }
    }
  };

  const calculateBestStore = () => {
    const storeTotals: {[store: string]: number} = {};
    
    STORES.forEach(store => {
      let total = 0;
      selectedItems.forEach(item => {
        const price = parseFloat(prices[`${store}-${item}`] || '0');
        total += price;
      });
      storeTotals[store] = total;
    });

    return storeTotals;
  };

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const filteredItems = filterLetter === 'All' 
    ? items.sort() 
    : items.sort().filter(item => item.toUpperCase().startsWith(filterLetter));
  const storeTotals = calculateBestStore();
  const sortedStores = Object.entries(storeTotals)
    .sort(([,a], [,b]) => a - b)
    .filter(([, total]) => total > 0);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Header currentPage="Compare" />
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Compare by Item</h1>
          {lastUpdated && (
            <p className="text-sm text-gray-600 mt-2">Prices last updated: {lastUpdated}</p>
          )}
        </div>

        {/* Alphabet Filter */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => setFilterLetter('All')}
              className={`px-3 py-1 rounded font-semibold cursor-pointer transition ${
                filterLetter === 'All'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {alphabet.filter(letter => 
              items.some(item => item.toUpperCase().startsWith(letter))
            ).map(letter => (
              <button
                key={letter}
                onClick={() => setFilterLetter(letter)}
                className={`px-3 py-1 rounded font-semibold cursor-pointer transition ${
                  filterLetter === letter
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>

        {/* Shopping List */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Select Items</h2>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={multiSelectMode}
                onChange={(e) => setMultiSelectMode(e.target.checked)}
                className="w-4 h-4 mr-2 cursor-pointer"
              />
              <span className="text-gray-700 font-medium">Multi-select mode</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {filteredItems.map(item => (
              <button
                key={item}
                onClick={() => toggleItem(item)}
                className={`p-3 rounded-lg border-2 transition cursor-pointer font-semibold ${
                  selectedItems.includes(item)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {selectedItems.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Best Stores for Your List</h2>
            
            {sortedStores.length > 0 ? (
              <div className="space-y-3">
                {sortedStores.map(([store, total], idx) => (
                  <div
                    key={store}
                    className={`p-4 rounded-lg border-2 ${
                      idx === 0
                        ? 'bg-green-50 border-green-500'
                        : 'bg-gray-50 border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className="font-bold text-xl text-gray-800">{store}</span>
                          {idx === 0 && (
                            <span className="ml-3 text-sm bg-green-500 text-white px-3 py-1 rounded-full">
                              Best Deal!
                            </span>
                          )}
                        </div>
                        {selectedItems.length > 0 && (
                          <p className="text-sm text-gray-600 mt-1">
                            {selectedItems.join(', ')}
                          </p>
                        )}
                      </div>
                      <span className="text-2xl font-bold text-gray-800">
                        ${total.toFixed(2)}
                      </span>
                    </div>
                    {idx === 0 && sortedStores.length > 1 && (
                      <p className="text-sm text-green-700 mt-2">
                        Save ${(sortedStores[1][1] - total).toFixed(2)} vs {sortedStores[1][0]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                <p className="text-lg font-semibold text-yellow-800 mb-2">No price data available</p>
                <p className="text-sm text-yellow-700">
                  Please add prices for {selectedItems.join(', ')} in the{' '}
                  <Link href="/prices" className="text-blue-600 hover:underline font-semibold">
                    Price Database
                  </Link>
                </p>
              </div>
            )}
          </div>
        )}

        {selectedItems.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-500 text-lg">Select items above to compare prices</p>
          </div>
        )}
      </div>
    </div>
  );
}