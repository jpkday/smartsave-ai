'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { useCategories } from '../hooks/useCategories';


const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

interface Deal {
  item_name: string;
  item_id: string;
  category_id: number;
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
  /* Refactored to use dynamic categories */
  const { getCategoryName, getCategoryColorById } = useCategories();
  const householdCode = typeof window !== 'undefined' ? localStorage.getItem('household_code') || '' : '';
  const [hasFavorites, setHasFavorites] = useState(true);

  useEffect(() => {
    loadDeals();
  }, [householdCode]);

  const loadDeals = async () => {
    setLoading(true);

    const currentHouseholdCode = typeof window !== 'undefined' ? localStorage.getItem('household_code') || '' : '';

    if (!currentHouseholdCode) {
      setLoading(false);
      setHasFavorites(false);
      return;
    }

    // 1. Fetch User's Favorited Stores
    const { data: favoritesData } = await supabase
      .from('household_store_favorites')
      .select('store_id')
      .eq('household_code', currentHouseholdCode);

    const favStoreIds = favoritesData?.map((f: any) => f.store_id) || [];

    if (favStoreIds.length === 0) {
      setHasFavorites(false);
      setDeals([]);
      setStores([]);
      setLoading(false);
      return;
    }

    setHasFavorites(true);

    // 2. Use Store IDs for Filtering
    const favStoreIdSet = new Set(favStoreIds);

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

    // FILTER PRICES BY FAVORITE STORE IDs (Exact Match)
    const relevantPrices = (recentPrices || []).filter((p: any) => favStoreIdSet.has(p.store_id));

    if (relevantPrices.length === 0) {
      setDeals([]);
      setStores([]);
      setLoading(false);
      return;
    }

    // Get ALL historical prices to calculate averages (Global context, not just favorites because we want accurate stats)
    // Actually, maybe we only care about stats for items present in relevantPrices? 
    // Optimization: filtering logic is fine.

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
      .select('id, name, category_id')
      .eq('user_id', SHARED_USER_ID);

    if (itemsError) {
      console.error('Error loading items:', itemsError);
    }

    // Build item lookup for category
    const itemLookup: Record<string, { id: string; category_id: number }> = {};
    (itemsData || []).forEach((item: any) => {
      itemLookup[item.name] = {
        id: item.id,
        category_id: item.category_id !== null ? item.category_id : -1,
      };
    });

    // Build historical data per item
    const itemHistory: Record<string, number[]> = {};
    (allPrices || []).forEach((p: any) => {
      const price = parseFloat(p.price);
      if (!isNaN(price)) { // Ensure price is a valid number
        if (!itemHistory[p.item_name]) {
          itemHistory[p.item_name] = [];
        }
        itemHistory[p.item_name].push(price);
      }
    });

    // Store map
    const storeSet = new Set<string>();

    const dealList: Deal[] = [];

    // Process RELEVANT prices only
    relevantPrices.forEach((p: any) => {
      const currentPrice = parseFloat(p.price);
      if (isNaN(currentPrice)) return; // Skip if current price is not a valid number

      // Check if we have history
      const history = itemHistory[p.item_name] || [];
      if (history.length < 3) return; // Need some history to judge deal?? 

      // Calculate stats
      const sortedHistory = [...history].sort((a, b) => a - b);
      const min = sortedHistory[0];
      const max = sortedHistory[sortedHistory.length - 1];
      const avg = sortedHistory.reduce((a, b) => a + b, 0) / sortedHistory.length;

      // 75th percentile (typical high)
      const p75Index = Math.floor(sortedHistory.length * 0.75);
      const typicalHigh = sortedHistory[p75Index];

      // Criteria for a "Deal":
      if (currentPrice >= typicalHigh) return; // Not a deal

      const savings = typicalHigh - currentPrice;
      const discountPercent = (savings / typicalHigh) * 100;

      if (discountPercent < 5) return; // Ignore small noise

      let quality: 'good' | 'great' | 'best' = 'good';
      if (currentPrice <= min) quality = 'best';
      else if (currentPrice <= avg * 0.9) quality = 'great'; // 10% below average
      else if (discountPercent > 25) quality = 'great';

      storeSet.add(p.store);

      const lookup = itemLookup[p.item_name];
      if (!lookup) return; // Skip if item not found in lookup

      dealList.push({
        item_name: p.item_name,
        item_id: lookup.id,
        category_id: lookup.category_id,
        store: p.store,
        price: currentPrice,
        recorded_date: p.recorded_date,
        dealQuality: quality,
        historicalLow: min,
        historicalHigh: max,
        historicalAvg: avg,
        typicalHighPrice: typicalHigh,
        discountPercent: discountPercent,
        isOnList: false, // will check list next
        valid_from: p.valid_from,
        valid_until: p.valid_until,
      });
    });

    // Check shopping list status
    const { data: listData } = await supabase
      .from('shopping_list')
      .select('item_name')
      .eq('household_code', currentHouseholdCode);

    const listSet = new Set(listData?.map((l: any) => l.item_name) || []);

    dealList.forEach(d => {
      d.isOnList = listSet.has(d.item_name);
    });

    // Sort by discount % descending (biggest savings first)
    dealList.sort((a, b) => b.discountPercent - a.discountPercent);

    setDeals(dealList);
    setStores([...storeSet].sort());
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

  const getDealBadge = (quality: string) => {
    switch (quality) {
      case 'best': return { label: '🔥 BEST PRICE', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' };
      case 'great': return { label: '⭐ GREAT DEAL', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' };
      default: return { label: '✓ GOOD PRICE', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' };
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
          ) : !hasFavorites ? (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <span className="text-4xl block mb-2">⭐</span>
              <p className="text-gray-800 font-bold mb-2">No favorite stores yet</p>
              <p className="text-sm text-gray-500 mb-4">
                Favorite your local stores to see their best deals here!
              </p>
              <Link href="/stores" className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold inline-block hover:scale-105 transition">
                Manage Stores
              </Link>
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <p className="text-gray-600 mb-2">No deals found for your stores</p>
              <p className="text-sm text-gray-500">
                We haven't found any exceptional deals at your favorited stores recently.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDeals.map((deal, idx) => {
                const badge = getDealBadge(deal.dealQuality);
                const categoryStyle = getCategoryColorById(deal.category_id);
                const categoryName = getCategoryName(deal.category_id);

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
                              {categoryName}
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
