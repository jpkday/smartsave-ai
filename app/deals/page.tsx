'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { getCategoryColor } from '../lib/categoryColors';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

interface Deal {
  item_name: string;
  item_id: string;
  category: string;
  store: string;
  price: number;
  recorded_date: string;
  dealQuality: 'good' | 'great' | 'best';
  historicalLow: number;
  historicalHigh: number;
  historicalAvg: number;
  typicalHighPrice: number; // 75th percentile price
  discountPercent: number;
  isOnList: boolean;
  valid_from: string | null;
  valid_until: string | null;
}

export default function Deals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [stores, setStores] = useState<string[]>([]);
  const householdCode = typeof window !== 'undefined' ? localStorage.getItem('household_code') || '' : '';

  useEffect(() => {
    loadDeals();
  }, [householdCode]);

  const loadDeals = async () => {
    setLoading(true);

    const currentHouseholdCode = typeof window !== 'undefined' ? localStorage.getItem('household_code') || '' : '';

    // Get all price history from the last 7 days (recent flyer entries)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const { data: recentPrices, error: recentError } = await supabase
      .from('price_history')
      .select('*')
      .eq('user_id', SHARED_USER_ID)
      .gte('recorded_date', cutoffDate)
      .or(`valid_until.gte.${today},valid_until.is.null`) // Only valid prices or prices without validity dates
      .order('recorded_date', { ascending: false });

    if (recentError) {
      console.error('Error loading recent prices:', recentError);
      setLoading(false);
      return;
    }

    // Get ALL historical prices to calculate averages
    const { data: allPrices, error: allError } = await supabase
      .from('price_history')
      .select('item_name, price')
      .eq('user_id', SHARED_USER_ID);

    if (allError) {
      console.error('Error loading historical prices:', allError);
      setLoading(false);
      return;
    }

    // Get item categories
    const { data: itemsData, error: itemsError } = await supabase
      .from('items')
      .select('id, name, category')
      .eq('user_id', SHARED_USER_ID);

    if (itemsError) {
      console.error('Error loading items:', itemsError);
    }

    // Build item lookup for category
    const itemLookup: Record<string, { id: string; category: string }> = {};
    (itemsData || []).forEach((item: any) => {
      itemLookup[item.name] = {
        id: item.id,
        category: item.category || 'Other',
      };
    });

    // Build historical data per item
    const itemHistory: Record<string, number[]> = {};
    (allPrices || []).forEach((p: any) => {
      if (!itemHistory[p.item_name]) itemHistory[p.item_name] = [];
      itemHistory[p.item_name].push(p.price);
    });

    // Calculate deal quality and discount % for each recent price
    const dealsMap = new Map<string, Deal>();
    const storeSet = new Set<string>();

    (recentPrices || []).forEach((p: any) => {
      const history = itemHistory[p.item_name] || [];
      if (history.length < 2) return; // Need at least 2 prices to compare

      const itemInfo = itemLookup[p.item_name];
      if (!itemInfo) return; // Skip if item not found

      const currentPrice = p.price;

      // Sort prices to calculate percentiles
      const sorted = [...history].sort((a, b) => a - b);
      const low = sorted[0];
      const high = sorted[sorted.length - 1];

      // Calculate 75th percentile (typical high price)
      const p75Index = Math.floor(sorted.length * 0.75);
      const typicalHighPrice = sorted[p75Index];

      // Calculate discount % from typical high price
      const discountPercent = ((typicalHighPrice - currentPrice) / typicalHighPrice) * 100;

      console.log(`${p.item_name}: $${currentPrice} vs typical $${typicalHighPrice.toFixed(2)} = ${discountPercent.toFixed(1)}% off`);

      // Skip if discount is less than 5%
      if (discountPercent < 5) return;

      // Calculate average price
      const sum = history.reduce((acc, val) => acc + val, 0);
      const avg = sum / history.length;

      // Calculate percentile (where does this price rank?)
      const belowCount = sorted.filter(x => x < currentPrice).length;
      const percentile = (belowCount / sorted.length) * 100;

      let dealQuality: 'good' | 'great' | 'best';
      if (currentPrice === low) {
        dealQuality = 'best';
      } else if (percentile <= 10) {
        dealQuality = 'great';
      } else if (percentile <= 25) {
        dealQuality = 'good';
      } else {
        return; // Not a deal, skip it
      }

      storeSet.add(p.store);

      const deal: Deal = {
        item_name: p.item_name,
        item_id: itemInfo.id,
        category: itemInfo.category,
        store: p.store,
        price: currentPrice,
        recorded_date: p.recorded_date,
        dealQuality,
        historicalLow: low,
        historicalHigh: high,
        historicalAvg: avg,
        typicalHighPrice: typicalHighPrice,
        discountPercent,
        isOnList: false, // Will be updated later
        valid_from: p.valid_from || null,
        valid_until: p.valid_until || null,
      };

      // Only keep the most recent entry per item (item_name is unique identifier)
      const existingDeal = dealsMap.get(p.item_name);
      if (!existingDeal || new Date(p.recorded_date) > new Date(existingDeal.recorded_date)) {
        dealsMap.set(p.item_name, deal);
      }
    });

    // Convert map to array
    const dealsData = Array.from(dealsMap.values());

    console.log('Checking shopping list for household:', currentHouseholdCode);
    console.log('Number of deals:', dealsData.length);

    // Check which items are already on the shopping list
    if (currentHouseholdCode) {
      const itemIds = dealsData.map(d => d.item_id);
      console.log('Item IDs to check:', itemIds);

      const { data: listItems, error: listError } = await supabase
        .from('shopping_list')
        .select('item_id, item_name')
        .eq('household_code', currentHouseholdCode)
        .in('item_id', itemIds);

      console.log('Items on list:', listItems);
      if (listError) console.error('Error checking list:', listError);

      const onListSet = new Set((listItems || []).map((item: any) => item.item_id));
      console.log('Items on list (Set):', Array.from(onListSet));

      // Mark which deals are already on the list
      dealsData.forEach(deal => {
        deal.isOnList = onListSet.has(deal.item_id);
        if (deal.isOnList) {
          console.log(`${deal.item_name} is on the list`);
        }
      });
    } else {
      console.log('No household code, marking all as not on list');
      // No household code, mark all as not on list
      dealsData.forEach(deal => {
        deal.isOnList = false;
      });
    }

    // Sort by discount % descending (biggest savings first)
    dealsData.sort((a, b) => b.discountPercent - a.discountPercent);

    setDeals(dealsData);
    setStores(Array.from(storeSet).sort());
    setLoading(false);
  };

  const addToList = async (itemName: string, itemId: string) => {
    if (!householdCode) {
      alert('Please enter your household code on the home page');
      return;
    }

    // Check if already in list (use maybeSingle to avoid 406 error)
    const { data: existing, error: checkError } = await supabase
      .from('shopping_list')
      .select('id')
      .eq('household_code', householdCode)
      .eq('item_id', itemId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking list:', checkError);
    }

    if (existing) {
      alert('Already in your list!');
      return;
    }

    // Add to list (insert into shopping_list)
    const { error: insertError } = await supabase
      .from('shopping_list')
      .insert({
        household_code: householdCode,
        item_id: itemId,
        item_name: itemName,
        quantity: 1,
        added_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error adding to list:', insertError);
      alert('Failed to add to list');
      return;
    }

    // Update the deals state to mark this item as on list
    setDeals(prevDeals =>
      prevDeals.map(deal =>
        deal.item_id === itemId
          ? { ...deal, isOnList: true }
          : deal
      )
    );

    alert('Added to your list!');
  };

  const filteredDeals = selectedStore === 'all'
    ? deals
    : deals.filter(d => d.store === selectedStore);

  const getDealBadge = (quality: 'good' | 'great' | 'best') => {
    switch (quality) {
      case 'best':
        return { bg: 'bg-red-100', text: 'text-red-800', label: '🔥 BEST PRICE', border: 'border-red-300' };
      case 'great':
        return { bg: 'bg-orange-100', text: 'text-orange-800', label: '⭐ GREAT DEAL', border: 'border-orange-300' };
      case 'good':
        return { bg: 'bg-green-100', text: 'text-green-800', label: '✓ GOOD PRICE', border: 'border-green-300' };
    }
  };

  return (
    <div className="min-h-screen bg-blue-500 bg-gradient-to-br from-blue-500 to-green-400 pb-20 md:pb-0">
      <div className="sticky top-0 z-50 bg-white shadow-sm w-full">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="hidden md:flex items-center gap-2">
              <Link href="/" className="text-xl font-bold text-gray-800 hover:text-indigo-600 transition flex items-center gap-2">
                <span className="text-2xl">ᯓ</span>
                <span className="hidden sm:inline">SmartSaveAI</span>
              </Link>
            </div>
            <div className="w-full">
              <Header currentPage="Local Deals" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-2 sm:px-4 md:px-8 pt-6">

        {/* Store Filter */}
        <div className="px-2 sm:px-4 md:px-0 mb-4">
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Filter by Store
            </label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold cursor-pointer"
            >
              <option value="all">All Stores ({filteredDeals.length} deals)</option>
              {stores.map(store => {
                const storeCount = deals.filter(d => d.store === store).length;
                return (
                  <option key={store} value={store}>
                    {store} ({storeCount} deals)
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Deals List */}
        <div className="px-2 sm:px-4 md:px-0">
          {loading ? (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <p className="text-gray-600">Loading deals...</p>
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <p className="text-gray-600 mb-2">No deals found</p>
              <p className="text-sm text-gray-500">
                Enter flyer prices on the Receipts page to see deals here!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDeals.map((deal, idx) => {
                const badge = getDealBadge(deal.dealQuality);
                const categoryStyle = getCategoryColor(deal.category);
                return (
                  <Link
                    key={idx}
                    href={`/history?item=${encodeURIComponent(JSON.stringify(deal.item_name))}&store=${encodeURIComponent(JSON.stringify(deal.store))}`}
                    className="block"
                  >
                    <div
                      className={`bg-white rounded-2xl shadow-lg p-4 border-2 ${categoryStyle} hover:shadow-xl transition cursor-pointer`}
                    >
                      {/* Header Row */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 pr-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${categoryStyle}`}>
                              {deal.category}
                            </span>
                          </div>
                          <h3 className="text-xl font-bold text-gray-800 mb-1">
                            {deal.item_name}
                          </h3>
                          <p className="text-sm font-semibold text-gray-600">{deal.store}</p>
                        </div>

                        {/* Discount Badge */}
                        <div className="flex-shrink-0">
                          <div className="bg-red-500 text-white rounded-xl px-4 py-2 text-center">
                            <div className="text-2xl font-bold leading-tight">
                              {deal.discountPercent.toFixed(0)}%
                            </div>
                            <div className="text-xs font-semibold">OFF</div>
                          </div>
                        </div>
                      </div>

                      {/* Price Row */}
                      <div className="flex items-baseline gap-3 mb-3">
                        <div className="text-3xl font-bold text-green-600">
                          ${deal.price.toFixed(2)}
                        </div>
                        {deal.typicalHighPrice && (
                          <>
                            <div className="text-lg font-semibold text-gray-400 line-through">
                              ${deal.typicalHighPrice.toFixed(2)}
                            </div>
                            <div className="text-sm font-semibold text-gray-600">
                              (typical)
                            </div>
                          </>
                        )}
                      </div>

                      {/* Deal Quality Badge */}
                      <div className="mb-3">
                        <span className={`inline-block text-xs px-3 py-1.5 rounded-full ${badge.bg} ${badge.text} font-semibold border ${badge.border}`}>
                          {badge.label}
                        </span>
                      </div>

                      {/* Details and Button Row */}
                      <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-500">
                          <div className="font-semibold">
                            Range: ${deal.historicalLow.toFixed(2)} - ${deal.historicalHigh.toFixed(2)}
                          </div>
                          <div>
                            {deal.valid_from && deal.valid_until ? (
                              <span className="text-green-600 font-semibold">
                                Valid: {new Date(deal.valid_from).toLocaleDateString()} - {new Date(deal.valid_until).toLocaleDateString()}
                              </span>
                            ) : (
                              <span>
                                Added: {new Date(deal.recorded_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!deal.isOnList) {
                              addToList(deal.item_name, deal.item_id);
                            }
                          }}
                          disabled={deal.isOnList}
                          className={`px-4 py-2 rounded-xl font-semibold transition cursor-pointer text-sm ${deal.isOnList
                            ? 'bg-gray-400 text-white cursor-default'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >
                          {deal.isOnList ? '✓ On List' : '+ Add to List'}
                        </button>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Info Card */}
        {!loading && filteredDeals.length > 0 && (
          <div className="px-2 sm:px-4 md:px-0 mt-6">
            <div className="bg-blue-50 rounded-2xl shadow-lg p-4 border-2 border-blue-200">
              <h3 className="font-bold text-blue-900 mb-2">How Deal Quality Works</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p><span className="font-semibold">🔥 BEST PRICE:</span> Lowest price we've ever seen</p>
                <p><span className="font-semibold">⭐ GREAT DEAL:</span> Better than 90% of recorded prices</p>
                <p><span className="font-semibold">✓ GOOD PRICE:</span> Better than 75% of recorded prices</p>
              </div>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs font-semibold text-blue-900">
                  Showing deals with at least 5% savings compared to typical high prices (75th percentile). Only showing currently valid flyer prices.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
