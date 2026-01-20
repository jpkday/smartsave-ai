'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import Header from '../components/Header';
import { useCategories } from '../hooks/useCategories';

type FrequentItem = {
  item_name: string;
  item_id: number;
  category_id: number;
  purchase_count: number;
  last_purchased: string;
  avg_price_paid: string;
};

type PriceTrend = {
  item_name: string;
  category_id: number;
  store_id: string;
  store_name: string;
  price_30_days_ago: string;
  first_date: string;
  current_price: string;
  last_date: string;
  price_change: string;
  pct_change: string;
};

export default function InsightsPage() {
  const [frequentItems, setFrequentItems] = useState<FrequentItem[]>([]);
  const [priceTrends, setPriceTrends] = useState<PriceTrend[]>([]);
  /* Refactored to use dynamic categories */
  const { getCategoryName, getCategoryColorById } = useCategories();
  const [loading, setLoading] = useState(true);
  const [householdCode, setHouseholdCode] = useState<string | null>(null);
  const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const code = localStorage.getItem('household_code');
      setHouseholdCode(code);
      if (!code) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (householdCode) {
      loadInsights();
    }
  }, [householdCode]);

  async function loadInsights() {
    if (!householdCode) {
      setLoading(false);
      return;
    }

    const { data: frequent } = await supabase.rpc('get_frequent_items', {
      household: householdCode
    });

    const { data: trends } = await supabase.rpc('get_price_trends');

    // Fetch User's Favorited Stores for Filtering
    const { data: favoritesData } = await supabase
      .from('household_store_favorites')
      .select('store_id')
      .eq('household_code', householdCode);

    const favStoreIds = new Set(favoritesData?.map((f: any) => f.store_id) || []);

    // Fetch items to get dynamic category IDs
    const { data: itemsData } = await supabase
      .from('items')
      .select('id, name, category_id')
      .eq('user_id', SHARED_USER_ID);

    const itemMap = new Map<string, number>();
    const itemIdMap = new Map<number, number>();

    if (itemsData) {
      itemsData.forEach((i: any) => {
        const catId = i.category_id !== null ? i.category_id : -1;
        itemMap.set(i.name, catId);
        itemIdMap.set(i.id, catId);
      });
    }

    if (frequent) {
      const mappedFrequent: FrequentItem[] = frequent.slice(0, 10).map((i: any) => ({
        ...i,
        category_id: itemIdMap.get(i.item_id) ?? -1
      }));
      setFrequentItems(mappedFrequent);
    }

    if (trends) {
      // Filter trends by favorite stores AND map categories
      const mappedTrends: PriceTrend[] = trends
        .filter((t: any) => favStoreIds.has(t.store_id))
        .map((t: any) => ({
          ...t,
          category_id: itemMap.get(t.item_name) ?? -1
        }));
      setPriceTrends(mappedTrends);
    }

    setLoading(false);
  }

  const priceDecreases = priceTrends.filter(item => parseFloat(item.pct_change) < 0);
  const priceIncreases = priceTrends.filter(item => parseFloat(item.pct_change) > 0).reverse();

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
              <Header currentPage="Insights" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-2 sm:px-4 md:px-8 pt-6">

        {loading ? (
          <div className="px-2 sm:px-4 md:px-0">
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <p className="text-gray-600">Loading insights...</p>
            </div>
          </div>
        ) : !householdCode ? (
          <div className="px-2 sm:px-4 md:px-0">
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <p className="text-gray-600">Please set your household code to view insights.</p>
            </div>
          </div>
        ) : (frequentItems.filter(i => i.purchase_count > 1).length === 0 && priceTrends.length === 0) ? (
          <div className="px-4 py-12 md:py-20 text-center">
            <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 max-w-2xl mx-auto shadow-xl border border-white/50">
              <div className="text-6xl mb-6">📊</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Unlock Your Spending Insights</h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                As you shop and track prices, we'll analyze your data to help you save more.
                Here's what you'll see here soon:
              </p>

              <div className="grid md:grid-cols-3 gap-6 mb-8 text-left">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <span className="text-2xl mb-2 block">🛒</span>
                  <h3 className="font-bold text-blue-900 mb-1">Top Items</h3>
                  <p className="text-sm text-blue-800">See what you buy most often.</p>
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                  <span className="text-2xl mb-2 block">📉</span>
                  <h3 className="font-bold text-green-900 mb-1">Price Drops</h3>
                  <p className="text-sm text-green-800">Catch items getting cheaper.</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                  <span className="text-2xl mb-2 block">💰</span>
                  <h3 className="font-bold text-purple-900 mb-1">Spending</h3>
                  <p className="text-sm text-purple-800">Track your habits over time.</p>
                </div>
              </div>

              <Link
                href="/list"
                className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-lg font-bold px-8 py-4 rounded-2xl hover:bg-blue-700 hover:scale-105 transition shadow-lg w-full md:w-auto"
              >
                Start Shopping
              </Link>
            </div>
          </div>
        ) : (
          <div className="px-2 sm:px-4 md:px-0">

            {/* Most Purchased Items */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                🛒 Frequently Purchased
              </h2>
              {frequentItems.filter(item => item.purchase_count > 1).length > 0 ? (
                <div className="max-h-64 overflow-y-auto space-y-3">
                  {frequentItems
                    .filter(item => item.purchase_count > 1)
                    .sort((a, b) => b.purchase_count - a.purchase_count)
                    .map((item) => {
                      const categoryStyle = getCategoryColorById(item.category_id);
                      return (
                        <div
                          key={item.item_id}
                          className={`flex items-center justify-between p-3 rounded-lg border hover:opacity-80 transition-colors ${categoryStyle}`}
                        >
                          <div className="flex-1">
                            <Link
                              href={`/history?item=${encodeURIComponent(item.item_name)}`}
                              className="hover:text-blue-600 hover:underline"
                            >
                              <p className="font-medium text-gray-800">{item.item_name}</p>
                            </Link>
                            <p className="text-sm text-gray-600">
                              Avg paid: ${parseFloat(item.avg_price_paid).toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-gray-800">
                              {item.purchase_count}
                            </p>
                            <p className="text-xs text-gray-600">times</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-gray-600">No frequently purchased items yet. Shop with the app or enter your receipts to see patterns!</p>
              )}
            </div>

            {/* Price Decreases */}
            {priceDecreases.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  📉 Prices Going Down (Last 30 Days)
                </h2>
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {priceDecreases.map((item, idx) => {
                    const categoryStyle = getCategoryColorById(item.category_id);
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-lg border ${categoryStyle}`}
                      >
                        <div className="flex-1">
                          <Link
                            href={`/history?item=${encodeURIComponent(item.item_name)}`}
                            className="hover:text-blue-600 hover:underline"
                          >
                            <p className="font-medium text-gray-800">{item.item_name}</p>
                          </Link>
                          <p className="text-sm text-gray-600">
                            {item.store_name}: ${item.price_30_days_ago} → ${item.current_price}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-green-600">
                            {Math.round(parseFloat(item.pct_change))}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price Increases */}
            {priceIncreases.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  📈 Prices Going Up (Last 30 Days)
                </h2>
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {priceIncreases.map((item, idx) => {
                    const categoryStyle = getCategoryColorById(item.category_id);
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-lg border ${categoryStyle}`}
                      >
                        <div className="flex-1">
                          <Link
                            href={`/history?item=${encodeURIComponent(item.item_name)}`}
                            className="hover:text-blue-600 hover:underline"
                          >
                            <p className="font-medium text-gray-800">{item.item_name}</p>
                          </Link>
                          <p className="text-sm text-gray-600">
                            {item.store_name}: ${item.price_30_days_ago} → ${item.current_price}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-red-600">
                            +{Math.round(parseFloat(item.pct_change))}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No Changes Message */}
            {priceDecreases.length === 0 && priceIncreases.length === 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  📊 Price Trends
                </h2>
                <p className="text-gray-600">
                  No significant price changes in the last 30 days. Keep checking back!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}