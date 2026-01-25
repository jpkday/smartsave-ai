'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import Header from '../components/Header';
import { useCategories } from '../hooks/useCategories';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import {
  CurrencyDollarIcon,
  ShoppingCartIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  SparklesIcon
} from '@heroicons/react/24/solid';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

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
  current_price: string;
  pct_change: string;
};

type SpendByStore = {
  name: string;
  value: number;
};

type Recommendation = {
  id: string;
  type: 'switch_store' | 'stock_up' | 'generic';
  title: string;
  message: string;
  impact_score: number; // For sorting
  icon?: React.ReactNode;
};

export default function InsightsPage() {
  const [frequentItems, setFrequentItems] = useState<FrequentItem[]>([]);
  const [priceTrends, setPriceTrends] = useState<PriceTrend[]>([]);
  const [spendByStore, setSpendByStore] = useState<SpendByStore[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  /* Refactored to use dynamic categories */
  /* Refactored to use dynamic categories */
  const { getCategoryName, getCategoryColorById } = useCategories();
  const [loading, setLoading] = useState(true);
  const [householdCode, setHouseholdCode] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<7 | 14 | 30 | 60>(30);
  const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkMobile = () => setIsMobile(window.innerWidth < 768);
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }
  }, []);

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
  }, [householdCode, timeRange]);

  async function loadInsights() {
    if (!householdCode) {
      setLoading(false);
      return;
    }


    // Use original name and no params to avoid 404 if SQL didn't run
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
    const itemIdToName = new Map<number, string>();

    if (itemsData) {
      itemsData.forEach((i: any) => {
        const catId = i.category_id !== null ? i.category_id : -1;
        itemMap.set(i.name.toLowerCase(), catId);
        itemIdMap.set(i.id, catId);
        itemIdToName.set(i.id, i.name);
      });
    }


    if (trends) {
      // Filter trends by favorite stores AND map categories
      const mappedTrends: PriceTrend[] = trends
        .filter((t: any) => favStoreIds.has(t.store_id))
        .map((t: any) => ({
          ...t,
          category_id: itemMap.get(t.item_name.toLowerCase()) ?? -1,
          price_30_days_ago: String(t.price_30_days_ago || t.start_price || '0'),
          current_price: String(t.current_price || '0'),
          pct_change: String(t.pct_change || '0')
        }));
      setPriceTrends(mappedTrends);
    }

    // Fetch recent shopping trips for Spend by Store
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRange);

    // 1. Fetch Trips to get Store Names
    const { data: tripsData } = await supabase
      .from('trips')
      .select('id, store, started_at')
      .eq('household_code', householdCode)
      .gte('started_at', startDate.toISOString());

    if (tripsData && tripsData.length > 0) {
      const tripIds = tripsData.map((t: any) => t.id);
      const tripStoreMap = new Map<string, string>(); // tripId -> storeName
      tripsData.forEach((t: any) => tripStoreMap.set(t.id, t.store));

      // 2. Fetch Events for these trips to get Prices
      const { data: eventsData, error: eventsError } = await supabase
        .from('shopping_list_events')
        .select('trip_id, price, quantity, item_id')
        .in('trip_id', tripIds);

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
      } else if (eventsData) {
        const spendMap = new Map<string, number>();
        const itemPrices = new Map<number, { store: string; price: number; date: string }[]>();
        const frequencyMap = new Map<number, { count: number; last_date: string; total_price: number; price_count: number }>();

        eventsData.forEach((event: any) => {
          const storeName = tripStoreMap.get(event.trip_id);
          const priceVal = parseFloat(String(event.price));
          const quantity = event.quantity || 1;
          const itemName = itemIdToName.get(event.item_id);
          const tripDate = tripsData.find((t: any) => t.id === event.trip_id)?.started_at || '';

          if (storeName && !isNaN(priceVal)) {
            // Aggregate Spend
            const currentSpend = spendMap.get(storeName) || 0;
            spendMap.set(storeName, currentSpend + (priceVal * quantity));

            // Collect Item Prices for AI Analysis (using ID)
            if (event.item_id) {
              const itemId = event.item_id;
              const existing = itemPrices.get(itemId) || [];
              existing.push({ store: storeName, price: priceVal / quantity, date: tripDate });
              itemPrices.set(itemId, existing);
            }
          }

          // Track Frequency
          if (event.item_id) {
            const currentFreq = frequencyMap.get(event.item_id) || { count: 0, last_date: '', total_price: 0, price_count: 0 };
            currentFreq.count += 1;
            if (!currentFreq.last_date || tripDate > currentFreq.last_date) {
              currentFreq.last_date = tripDate;
            }
            if (!isNaN(priceVal) && priceVal > 0) {
              currentFreq.total_price += priceVal;
              currentFreq.price_count += 1;
            }
            frequencyMap.set(event.item_id, currentFreq);
          }
        });

        // Set Frequent Items state
        const mappedFrequent: FrequentItem[] = Array.from(frequencyMap.entries()).map(([itemId, stats]) => ({
          item_id: itemId,
          item_name: itemIdToName.get(itemId) || 'Unknown Item',
          category_id: itemIdMap.get(itemId) ?? -1,
          purchase_count: stats.count,
          last_purchased: stats.last_date,
          avg_price_paid: stats.price_count > 0 ? (stats.total_price / stats.price_count).toFixed(2) : '0.00'
        }));
        setFrequentItems(mappedFrequent);

        // Generate AI Recommendations
        const newRecs: Recommendation[] = [];

        // 1. Store Switcher Logic (ID-driven)
        itemPrices.forEach((observations, itemId) => {
          if (observations.length < 2) return;

          // Group by store to find average price per store
          const storeAvg = new Map<string, { total: number; count: number }>();
          observations.forEach(obs => {
            const current = storeAvg.get(obs.store) || { total: 0, count: 0 };
            current.total += obs.price;
            current.count += 1;
            storeAvg.set(obs.store, current);
          });

          // If we have distinct stores
          if (storeAvg.size > 1) {
            let minStore = '';
            let minPrice = Infinity;
            let maxStore = '';
            let maxPrice = -Infinity;

            storeAvg.forEach((data, store) => {
              const avg = data.total / data.count;
              if (avg < minPrice) { minPrice = avg; minStore = store; }
              if (avg > maxPrice) { maxPrice = avg; maxStore = store; }
            });

            // If significantly cheaper (> 20% difference)
            if (minPrice > 0 && maxPrice > 0 && minStore !== maxStore) {
              const diffPct = ((maxPrice - minPrice) / maxPrice) * 100;
              if (diffPct > 20) {
                const itemName = itemIdToName.get(itemId) || 'Unknown Item';
                newRecs.push({
                  id: `switch-${itemId}`,
                  type: 'switch_store',
                  title: 'Better Price Available',
                  message: `You bought ${itemName} at ${maxStore} ($${maxPrice.toFixed(2)}), but likely cheaper at ${minStore} (~$${minPrice.toFixed(2)}).`,
                  impact_score: diffPct
                });
              }
            }
          }
        });

        // 2. Stock Up Logic (Significant Price Drops)
        // Use mappedTrends which are easier
        if (trends) {
          const mappedTrends: PriceTrend[] = trends
            .filter((t: any) => favStoreIds.has(t.store_id))
            .map((t: any) => ({
              ...t,
              category_id: itemMap.get(t.item_name.toLowerCase()) ?? -1,
              price_30_days_ago: String(t.price_30_days_ago || t.start_price || '0'),
              current_price: String(t.current_price || '0'),
              pct_change: String(t.pct_change || '0')
            }));

          mappedTrends.forEach(trend => {
            if (parseFloat(trend.pct_change) < -15) {
              newRecs.push({
                id: `stock-${trend.item_name}-${trend.store_id}`,
                type: 'stock_up',
                title: 'Stock Up Opportunity',
                message: `${trend.item_name} at ${trend.store_name} is down ${Math.round(Math.abs(parseFloat(trend.pct_change)))}% (now $${parseFloat(trend.current_price).toFixed(2)}).`,
                impact_score: Math.abs(parseFloat(trend.pct_change)) + 50 // Boost priority
              });
            }
          });
        }

        // Sort by impact and take top 3
        setRecommendations(newRecs.sort((a, b) => b.impact_score - a.impact_score).slice(0, 3));

        const spendData: SpendByStore[] = Array.from(spendMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value); // Sort by highest spend

        setSpendByStore(spendData);
      }
    }

    setLoading(false);
  }

  const priceDecreases = priceTrends.filter(item => parseFloat(item.pct_change) < 0);
  const priceIncreases = priceTrends
    .filter(item => parseFloat(item.pct_change) > 0)
    .sort((a, b) => parseFloat(b.pct_change) - parseFloat(a.pct_change));

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
        ) : (frequentItems.filter(i => i.purchase_count > 1).length === 0 && priceTrends.length === 0 && spendByStore.length === 0) ? (
          <div className="px-4 py-12 md:py-20 text-center">
            <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 max-w-2xl mx-auto shadow-xl border border-white/50">
              <div className="flex justify-center mb-6">
                <ChartBarIcon className="h-20 w-20 text-gray-800" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Unlock Your Spending Insights</h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                As you shop and track prices, we'll analyze your data to help you save more.
                Here's what you'll see here soon:
              </p>

              <div className="grid md:grid-cols-3 gap-6 mb-8 text-left">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <ShoppingCartIcon className="h-8 w-8 text-blue-600 mb-2" />
                  <h3 className="font-bold text-blue-900 mb-1">Top Items</h3>
                  <p className="text-sm text-blue-800">See what you buy most often.</p>
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                  <ArrowTrendingDownIcon className="h-8 w-8 text-green-600 mb-2" />
                  <h3 className="font-bold text-green-900 mb-1">Price Drops</h3>
                  <p className="text-sm text-green-800">Catch items getting cheaper.</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                  <CurrencyDollarIcon className="h-8 w-8 text-purple-600 mb-2" />
                  <h3 className="font-bold text-purple-900 mb-1">Spending</h3>
                  <p className="text-sm text-purple-800">Track your habits over time.</p>
                </div>
              </div>

              <Link
                href="/receipts?scan=true"
                className="inline-flex items-center justify-center gap-3 bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-lg font-bold px-10 py-5 rounded-3xl hover:bg-blue-700 hover:scale-105 transition shadow-2xl w-full md:w-auto overflow-hidden group relative"
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <PhotoIcon className="h-8 w-8 text-blue-100" />
                <span>{isMobile ? 'Snap a Receipt' : 'Upload a Receipt'}</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="px-2 sm:px-4 md:px-0">



            {/* Global Filters */}
            <div className="flex bg-white/50 backdrop-blur-sm rounded-2xl p-2 mb-8 items-center justify-between shadow-sm border border-white/20">
              <span className="text-sm font-bold text-gray-600 ml-3 uppercase tracking-wider">Analysis period</span>
              <div className="flex bg-gray-100/80 p-1 rounded-xl">
                {([7, 14, 30, 60] as const).map((days) => (
                  <button
                    key={days}
                    onClick={() => setTimeRange(days)}
                    className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${timeRange === days
                      ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                      : 'text-gray-500 hover:text-gray-900'
                      }`}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            </div>

            {/* AI Savings Coach */}
            {recommendations.length > 0 && (
              <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl shadow-xl p-6 mb-8 text-white">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <SparklesIcon className="h-6 w-6 text-yellow-300 animate-pulse" />
                  AI Savings Coach
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 hover:bg-white/20 transition">
                      <h3 className="font-bold text-yellow-200 text-sm mb-1 uppercase tracking-wide">{rec.title}</h3>
                      <p className="text-sm leading-relaxed text-white/90">{rec.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spend by Store Chart */}
            {spendByStore.length > 0 && (
              <div className="bg-white rounded-3xl shadow-xl p-6 mb-8">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <CurrencyDollarIcon className="h-6 w-6 text-purple-600" />
                    Spend by Store
                  </h2>
                  <p className="text-sm text-gray-500 font-normal ml-8 mt-0.5">Last {timeRange} days</p>
                </div>
                <div className="flex flex-col md:flex-row items-center gap-8">
                  {/* Ranked List */}
                  <div className="w-full md:w-1/3">
                    <ul className="space-y-3">
                      {spendByStore.map((store, index) => (
                        <li key={store.name} className="flex justify-between items-center text-base border-b border-gray-100 pb-2 last:border-0">
                          <div className="flex items-center gap-2 font-medium">
                            <span className="w-5 text-gray-400">{index + 1}.</span>
                            <span style={{ color: COLORS[index % COLORS.length] }}>{store.name}</span>
                          </div>
                          <span className="font-bold" style={{ color: COLORS[index % COLORS.length] }}>
                            ${store.value.toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Chart */}
                  <div className="w-full md:w-2/3 min-w-0" style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
                      <PieChart>
                        <Pie
                          data={spendByStore}
                          cx="50%"
                          cy="50%"
                          innerRadius={isMobile ? 50 : 60}
                          outerRadius={isMobile ? 70 : 80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => isMobile ? name : `${name}: $${value.toFixed(2)}`}
                          labelLine={!isMobile}
                        >
                          {spendByStore.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number | undefined) => value !== undefined ? `$${value.toFixed(2)}` : ''} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Most Purchased Items */}
            <div className="bg-white rounded-3xl shadow-xl p-6 mb-8">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <ShoppingCartIcon className="h-6 w-6 text-blue-600" />
                  Frequently Purchased
                </h2>
                <p className="text-sm text-gray-500 font-normal ml-8 mt-0.5">Last {timeRange} days</p>
              </div>
              {frequentItems.filter(item => item.purchase_count > 1).length > 0 ? (
                <div className="max-h-64 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                  {frequentItems
                    .filter(item => item.purchase_count > 1)
                    .sort((a, b) => b.purchase_count - a.purchase_count)
                    .map((item) => {
                      const categoryStyle = getCategoryColorById(item.category_id);
                      return (
                        <div
                          key={item.item_id}
                          className={`flex items-center justify-between border p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 ${categoryStyle}`}
                        >
                          <div className="flex-1">
                            <Link
                              href={`/history?item=${encodeURIComponent(item.item_name)}`}
                              className="hover:text-blue-600 hover:underline"
                            >
                              <p className="font-medium opacity-90">{item.item_name}</p>
                            </Link>
                            <p className="text-sm opacity-70">
                              Avg paid: ${parseFloat(item.avg_price_paid).toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold opacity-90">
                              {item.purchase_count}
                            </p>
                            <p className="text-xs opacity-70">times</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="bg-gray-50/50 rounded-2xl p-6 text-center border-2 border-dashed border-gray-100">
                  <p className="text-gray-500 font-medium italic">
                    {frequentItems.length === 0
                      ? `No items purchased in the last ${timeRange} days.`
                      : `No items were purchased more than once in the last ${timeRange} days.`
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Price Decreases */}
            {priceDecreases.length > 0 && (
              <div className="bg-white rounded-3xl shadow-xl p-6 mb-8">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <ArrowTrendingDownIcon className="h-6 w-6 text-green-600" />
                    Prices Going Down
                  </h2>
                  <p className="text-sm text-gray-500 font-normal ml-8 mt-0.5">Last {timeRange} days</p>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                  {priceDecreases.map((item, idx) => {
                    const categoryStyle = getCategoryColorById(item.category_id);
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between border p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 ${categoryStyle}`}
                      >
                        <div className="flex-1">
                          <Link
                            href={`/history?item=${encodeURIComponent(item.item_name)}`}
                            className="hover:text-blue-600 hover:underline"
                          >
                            <p className="font-medium opacity-90">{item.item_name}</p>
                          </Link>
                          <p className="text-sm opacity-70">
                            {item.store_name}: ${parseFloat(item.price_30_days_ago).toFixed(2)} → ${parseFloat(item.current_price).toFixed(2)}
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
              <div className="bg-white rounded-3xl shadow-xl p-6 mb-8">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <ArrowTrendingUpIcon className="h-6 w-6 text-red-600" />
                    Prices Going Up
                  </h2>
                  <p className="text-sm text-gray-500 font-normal ml-8 mt-0.5">Last {timeRange} days</p>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                  {priceIncreases.map((item, idx) => {
                    const categoryStyle = getCategoryColorById(item.category_id);
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between border p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 ${categoryStyle}`}
                      >
                        <div className="flex-1">
                          <Link
                            href={`/history?item=${encodeURIComponent(item.item_name)}`}
                            className="hover:text-blue-600 hover:underline"
                          >
                            <p className="font-medium opacity-90">{item.item_name}</p>
                          </Link>
                          <p className="text-sm opacity-70">
                            {item.store_name}: ${parseFloat(item.price_30_days_ago).toFixed(2)} → ${parseFloat(item.current_price).toFixed(2)}
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
              <div className="bg-white rounded-3xl shadow-xl p-6 mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <ChartBarIcon className="h-6 w-6 text-gray-600" />
                  Price Trends
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