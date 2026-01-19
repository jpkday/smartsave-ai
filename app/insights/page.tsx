'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import Header from '../components/Header';
import { getCategoryColor } from '../lib/categoryColors';

type FrequentItem = {
  item_name: string;
  item_id: number;
  category: string;
  purchase_count: number;
  last_purchased: string;
  avg_price_paid: string;
};

type PriceTrend = {
  item_name: string;
  category: string;
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
  const [loading, setLoading] = useState(true);
  const [householdCode, setHouseholdCode] = useState<string | null>(null);

  // Load household code from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const code = localStorage.getItem('household_code');
      setHouseholdCode(code);
    }
  }, []);

  // Load insights when household code is available
  useEffect(() => {
    if (householdCode) {
      loadInsights();
    }
  }, [householdCode]);

  async function loadInsights() {
    if (!householdCode) return;

    const { data: frequent } = await supabase.rpc('get_frequent_items', {
      household: householdCode
    });

    const { data: trends } = await supabase.rpc('get_price_trends');

    if (frequent) setFrequentItems(frequent.slice(0, 10));
    if (trends) setPriceTrends(trends);
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
                      const categoryStyle = getCategoryColor(item.category);
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
                <p className="text-gray-600">No frequently purchased items yet. Buy items multiple times to see patterns!</p>
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
                    const categoryStyle = getCategoryColor(item.category);
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
                    const categoryStyle = getCategoryColor(item.category);
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