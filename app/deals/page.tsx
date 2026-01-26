'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { useCategories } from '../hooks/useCategories';
import { useStatusModal } from '../hooks/useStatusModal';
import { useHouseholdCode } from '../hooks/useHouseholdCode';
import { SHARED_USER_ID } from '../lib/constants';
import { formatLocalDate, parseLocalDate } from '../utils/date';
import StatusModal from '../components/StatusModal';
import {
  BuildingStorefrontIcon,
  ShoppingBagIcon,
  FireIcon,
  SparklesIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  TagIcon,
  ArrowTrendingDownIcon,
  PlusIcon,
  StarIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/solid';

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
  const [hasFavorites, setHasFavorites] = useState(true);

  /* Refactored to use dynamic categories */
  const { getCategoryName, getCategoryColorById } = useCategories();

  /* Use custom hooks */
  const { householdCode } = useHouseholdCode();
  const { modal: statusModal, show: showStatus, close: closeStatus } = useStatusModal();

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
      .eq('user_id', SHARED_USER_ID)
      .in('store_id', favStoreIds);

    if (allError) {
      console.error('Error loading historical prices:', allError);
      setLoading(false);
      return;
    }

    // Get item categories
    // Get item categories
    let itemsQuery = supabase
      .from('items')
      .select('id, name, category_id')
      .eq('user_id', SHARED_USER_ID);

    if (currentHouseholdCode !== 'TEST') {
      itemsQuery = itemsQuery.or('household_code.neq.TEST,household_code.is.null');
    }

    const { data: itemsData, error: itemsError } = await itemsQuery;

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

    // Store map for store filter
    const storeSet = new Set<string>();

    const dealMap = new Map<string, Deal>();

    // Process RELEVANT prices only
    relevantPrices.forEach((p: any) => {
      const currentPrice = parseFloat(p.price);
      if (isNaN(currentPrice)) return;

      // Check if we have history
      const history = itemHistory[p.item_name] || [];
      if (history.length < 3) return;

      // Calculate stats
      const sortedHistory = [...history].sort((a, b) => a - b);
      const min = sortedHistory[0];
      const max = sortedHistory[sortedHistory.length - 1];
      const avg = sortedHistory.reduce((a, b) => a + b, 0) / sortedHistory.length;

      // 75th percentile (typical high)
      const p75Index = Math.floor(sortedHistory.length * 0.75);
      const typicalHigh = sortedHistory[p75Index];

      // Criteria for a "Deal":
      if (currentPrice >= typicalHigh) return;

      const savings = typicalHigh - currentPrice;
      const discountPercent = (savings / typicalHigh) * 100;

      if (discountPercent < 5) return;

      let quality: 'good' | 'great' | 'best' = 'good';
      if (currentPrice <= min) quality = 'best';
      else if (currentPrice <= avg * 0.9) quality = 'great';
      else if (discountPercent > 25) quality = 'great';

      const lookup = itemLookup[p.item_name];
      if (!lookup) return;

      const dealKey = `${p.item_name}-${p.store}`;
      const existing = dealMap.get(dealKey);

      // Keep only the lowest price for this item at this store
      if (!existing || currentPrice < existing.price) {
        storeSet.add(p.store);
        dealMap.set(dealKey, {
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
          isOnList: false,
          valid_from: p.valid_from,
          valid_until: p.valid_until,
        });
      }
    });

    const dealList = Array.from(dealMap.values());

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
      showStatus('Missing Household Code', 'Please enter your household code on the home page to add items to your list.', 'warning');
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
      showStatus('Already on List', `"${itemName}" is already in your shopping list!`, 'info');
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
      showStatus('Add Failed', 'Failed to add the item to your list. Please try again.', 'error');
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

    showStatus('Added to List! 🎉', `"${itemName}" has been added to your shopping list.`, 'success');
  };

  const removeFromList = async (itemName: string, itemId: string) => {
    if (!householdCode) return;

    // Remove from shopping_list
    const { error: deleteError } = await supabase
      .from('shopping_list')
      .delete()
      .eq('household_code', householdCode)
      .eq('item_id', itemId);

    if (deleteError) {
      console.error('Error removing from list:', deleteError);
      showStatus('Remove Failed', 'Failed to remove the item from your list. Please try again.', 'error');
      return;
    }

    // Update the deals state
    setDeals(prevDeals =>
      prevDeals.map(deal =>
        deal.item_id === itemId
          ? { ...deal, isOnList: false }
          : deal
      )
    );

    showStatus('Removed', `"${itemName}" removed from your list.`, 'info');
  };

  const filteredDeals = selectedStore === 'all'
    ? deals
    : deals.filter(d => d.store === selectedStore);

  // Group deals by store
  const groupedDeals = filteredDeals.reduce((acc, deal) => {
    if (!acc[deal.store]) acc[deal.store] = [];
    acc[deal.store].push(deal);
    return acc;
  }, {} as Record<string, Deal[]>);

  const getItemEmoji = (itemName: string) => {
    const lowerName = itemName.toLowerCase();
    if (lowerName.includes('milk')) return '🥛';
    if (lowerName.includes('egg')) return '🥚';
    if (lowerName.includes('cheese')) return '🧀';
    if (lowerName.includes('butter')) return '🧈';
    if (lowerName.includes('bread') || lowerName.includes('bun')) return '🍞';
    if (lowerName.includes('chicken') && lowerName.includes('breast')) return '🍗'; // Keeping generic chicken leg for now, user requested different one but standard chicken emojis are limited. Using poultry leg.  Actually, let's try '🥘' (pan of food) or just generic meat '🥩' if specific breast is needed? User asked for "different one". Let's stick to poultry leg '🍗' or rooster '🐓'. Let's try '🐓' for whole bird, or '🥘' for dish. Wait, 'chicken breast' usually implies raw or cooked meat. '🍗' is best fit but maybe '🥩' (cut of meat). Let's go with '🥩' if they want "different", or '🥗' if it's a salad. Let's try '🐓' to be different from '🍗'.
    // User specifically asked for "different one".
    if (lowerName.includes('chicken breast')) return '🥩'; // Using meat cut for breast to differentiate from wings
    if (lowerName.includes('chicken') || lowerName.includes('wing')) return '🍗';
    if (lowerName.includes('beef') || lowerName.includes('steak') || lowerName.includes('roast')) return '🥩';
    if (lowerName.includes('pork') || lowerName.includes('bacon') || lowerName.includes('ham')) return '🥓';
    if (lowerName.includes('apple')) return '🍎';
    if (lowerName.includes('banana')) return '🍌';
    if (lowerName.includes('grape')) return '🍇';
    if (lowerName.includes('orange') || lowerName.includes('citrus')) return '🍊';
    if (lowerName.includes('berry') || lowerName.includes('straw')) return '🍓';
    if (lowerName.includes('potato') || lowerName.includes('fry')) return '🍟';
    if (lowerName.includes('tomato')) return '🍅';
    if (lowerName.includes('lettuce') || lowerName.includes('salad') || lowerName.includes('spinach')) return '🥬';
    if (lowerName.includes('carrot')) return '🥕';
    if (lowerName.includes('onion') || lowerName.includes('garlic')) return '🧅';
    if (lowerName.includes('pepper')) return '🌶️';
    if (lowerName.includes('corn')) return '🌽';
    if (lowerName.includes('rice')) return '🍚';
    if (lowerName.includes('pasta') || lowerName.includes('noodle')) return '🍝';
    if (lowerName.includes('pizza')) return '🍕';
    if (lowerName.includes('bagel')) return '🥯';
    if (lowerName.includes('cream') && lowerName.includes('heavy')) return '🥛'; // Heavy cream
    if (lowerName.includes('cream') || lowerName.includes('yogurt')) return '🍦';
    if (lowerName.includes('grape') && lowerName.includes('green')) return '🍇'; // Green grapes (still grapes emoji usually, but maybe '🍈' melon for green-ish? No, keep grapes)
    if (lowerName.includes('turkey')) return '🦃';
    if (lowerName.includes('blueberry') || lowerName.includes('blueberries')) return '🫐';
    if (lowerName.includes('salsa')) return '💃'; // Funny but maybe '🥣' or '🍅' is better? Let's use '🥣' (bowl/soup) or just '🍅'. User asked for specific. '🫐' for blueberries is good.
    if (lowerName.includes('salsa')) return '🥣';
    return '🛒';
  };

  const getDealBadge = (quality: string) => {
    switch (quality) {
      case 'best': return { label: 'Best Price', flames: 3, glow: true };
      case 'great': return { label: 'Great Deal', flames: 2, glow: false };
      default: return { label: 'Good Price', flames: 1, glow: false };
    }
  };

  // Pre-calculate visible stores and deals for stats
  const visibleGroups = Object.entries(groupedDeals)
    .map(([storeName, storeDeals]) => {
      // Sort deals by quality (Flames) descending: Best -> Great -> Good
      const qualityScore = (q: string) => {
        if (q === 'best') return 3;
        if (q === 'great') return 2;
        return 1;
      };

      const sortedDeals = [...storeDeals].sort((a, b) => {
        const scoreA = qualityScore(a.dealQuality);
        const scoreB = qualityScore(b.dealQuality);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return b.discountPercent - a.discountPercent;
      });

      const totalSavings = sortedDeals.reduce((sum, deal) => {
        const savings = deal.typicalHighPrice ? (deal.typicalHighPrice - deal.price) : 0;
        // Assume buying 2 lbs for weight-based items
        const isWeightBased = deal.item_name.toLowerCase().includes('(lb)') || deal.item_name.toLowerCase().includes('(1 lb)');
        const multiplier = isWeightBased ? 2 : 1;
        return sum + (savings * multiplier);
      }, 0);
      return { storeName, storeDeals: sortedDeals, totalSavings };
    })
    .filter(group => group.totalSavings >= 2)
    .sort((a, b) => b.totalSavings - a.totalSavings);

  const visibleDeals = visibleGroups.flatMap(g => g.storeDeals);
  const totalVisibleDeals = visibleDeals.length;
  const topDiscount = visibleDeals.length > 0 ? Math.max(...visibleDeals.map(d => d.discountPercent)).toFixed(0) : '0';
  const bestPriceCount = visibleDeals.filter(d => d.dealQuality === 'best').length;


  return (
    <div className="min-h-screen bg-blue-500 bg-gradient-to-br from-blue-500 to-green-400 pb-32">
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



        {/* Deals Grouped by Store */}
        <div className="px-2 sm:px-4 md:px-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/80">
              <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin mb-4" />
              <p className="font-medium tracking-widest uppercase text-[10px]">Loading Deals...</p>
            </div>
          ) : !hasFavorites ? (
            <div className="relative overflow-hidden rounded-[2.5rem] p-12 text-center border border-white/20 shadow-2xl">
              {/* Glassmorphism Background */}
              <div className="absolute inset-0 bg-white/10 backdrop-blur-3xl z-0"></div>
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-indigo-500/30 rounded-full blur-3xl z-0"></div>
              <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-emerald-500/30 rounded-full blur-3xl z-0"></div>

              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-3xl mb-6 backdrop-blur-md shadow-inner border border-white/40">
                  <span className="text-4xl animate-pulse">💎</span>
                </div>
                <h2 className="text-4xl font-black text-white mb-4 tracking-tight drop-shadow-sm">
                  Personalize Your Savings
                </h2>
                <p className="text-blue-50 text-lg mb-10 max-w-lg mx-auto font-medium leading-relaxed opacity-90">
                  Add your favorite local stores to unlock exclusive AI-powered insights, historical price tracking, and "Market Low" alerts.
                </p>
                <div className="flex justify-center">
                  <Link
                    href="/stores"
                    className="bg-white text-indigo-600 px-10 py-4 rounded-2xl font-black shadow-xl hover:bg-indigo-50 hover:scale-105 active:scale-95 transition-all text-lg flex items-center gap-3"
                  >
                    <BuildingStorefrontIcon className="w-6 h-6" />
                    Manage Stores
                  </Link>
                </div>
              </div>
            </div>
          ) : visibleGroups.length === 0 ? (
            <div className="relative overflow-hidden rounded-[2.5rem] p-16 text-center border border-white/20 shadow-2xl">
              <div className="absolute inset-0 bg-white/10 backdrop-blur-3xl z-0"></div>
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-full mb-4">
                  <SparklesIcon className="w-8 h-8 text-white/50" />
                </div>
                <p className="text-2xl font-bold text-white/90">Curating new deals for you...</p>
                <p className="text-white/60 text-base mt-3 font-medium">No big savings found yet at your favorited stores.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8 pb-0">
              <div className="py-4">

                {visibleGroups
                  .map(({ storeName, storeDeals, totalSavings }) => (
                    <div key={storeName} className="mb-6">
                      {/* Store Header Container */}
                      <div className="bg-white rounded-t-[2rem] p-6 pb-4 border-b border-gray-100 flex items-center justify-between shadow-sm relative z-10">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center border border-yellow-200 text-2xl shadow-sm text-yellow-500">
                            <StarIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                              {storeName}
                            </h2>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                              {storeDeals.length} Deals Found
                            </div>
                          </div>
                        </div>
                        <div className="bg-emerald-50 text-emerald-800 px-5 py-3 rounded-2xl flex items-center gap-3 shadow-sm border border-emerald-100">
                          <div className="bg-white p-2 text-emerald-600 rounded-full shadow-sm">
                            <ShoppingCartIcon className="w-6 h-6" />
                          </div>
                          <div className="flex flex-col items-end text-right">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 leading-none mb-1">Basket Savings</span>
                            <span className="text-2xl font-black leading-none">${totalSavings.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Deals List */}
                      <div className="bg-white rounded-b-[2rem] p-4 pt-2 shadow-xl shadow-indigo-900/5 space-y-3">
                        {storeDeals.map((deal, idx) => {
                          const badge = getDealBadge(deal.dealQuality);
                          const emoji = getItemEmoji(deal.item_name);

                          return (
                            <div key={`${storeName}-${idx}`} className="group relative">
                              <Link
                                href={`/history?item=${encodeURIComponent(JSON.stringify(deal.item_name))}&store=${encodeURIComponent(JSON.stringify(deal.store))}`}
                                className="block"
                              >
                                <div className={`
                                relative rounded-2xl p-3 sm:p-4 transition-all duration-300 border flex flex-row items-center gap-2 sm:gap-4
                                ${badge.glow
                                    ? 'bg-gradient-to-r from-indigo-50/50 to-white border-indigo-100 shadow-[0_0_20px_rgba(99,102,241,0.15)] hover:shadow-[0_0_25px_rgba(99,102,241,0.25)] hover:border-indigo-200'
                                    : 'bg-white border-gray-50 hover:border-gray-200 hover:bg-gray-50/50 hover:shadow-lg hover:shadow-gray-200/50'
                                  }
                              `}>
                                  {/* Left: Name & Rating */}
                                  <div className="flex-1 flex items-center gap-4 min-w-0">
                                    <div className="min-w-0 flex-1">
                                      <h3 className="text-lg font-bold text-gray-800 leading-tight group-hover:text-indigo-600 transition-colors truncate">
                                        {deal.item_name}
                                      </h3>
                                      <div className="flex items-center gap-2 mt-1">
                                        <div className="flex">
                                          {[...Array(badge.flames)].map((_, i) => (
                                            <FireIcon key={i} className={`w-5 h-5 ${badge.glow ? 'text-red-600 animate-pulse' : 'text-orange-500'} drop-shadow-sm`} />
                                          ))}
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-wider ${badge.glow ? 'text-indigo-600' : 'text-gray-400'}`}>
                                          {badge.label}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right: Price & Action */}
                                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-6 flex-none">
                                    <div className="text-right block">
                                      <div className="flex items-center justify-end gap-1 sm:gap-2">
                                        <span className="text-lg sm:text-2xl font-black text-gray-900 tracking-tight">
                                          ${deal.price.toFixed(2)}
                                        </span>
                                        <span className="bg-emerald-100 text-emerald-700 text-[10px] sm:text-xs font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg">
                                          -{deal.discountPercent.toFixed(0)}%
                                        </span>
                                      </div>
                                      {deal.typicalHighPrice && (
                                        <div className="text-[10px] sm:text-xs font-medium text-gray-400 line-through hidden sm:block">
                                          Was ${deal.typicalHighPrice.toFixed(2)}
                                        </div>
                                      )}
                                    </div>

                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (deal.isOnList) {
                                          removeFromList(deal.item_name, deal.item_id);
                                        } else {
                                          addToList(deal.item_name, deal.item_id);
                                        }
                                      }}
                                      className={`
                                       w-24 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all active:scale-95 shadow-sm cursor-pointer whitespace-nowrap
                                       ${deal.isOnList
                                          ? 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100'
                                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 hover:shadow-indigo-300'
                                        }
                                     `}
                                    >
                                      {deal.isOnList ? 'Remove' : 'Add'}
                                    </button>
                                  </div>
                                </div>
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Info Legend Card */}
        {!loading && Object.keys(groupedDeals).length > 0 && (
          <div className="px-2 sm:px-4 md:px-0 mt-4 mb-24">
            <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl">
              <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-indigo-500" />
                Understanding Savvy Savings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">

                  <h4 className="font-bold text-gray-900 text-medium flex items-center gap-2">
                    <div className="flex text-red-600 animate-pulse">
                      <FireIcon className="w-4 h-4" />
                      <FireIcon className="w-4 h-4" />
                      <FireIcon className="w-4 h-4" />
                    </div>
                    Best Price
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed font-medium">The lowest price point ever recorded for this specific item in our database.</p>
                </div>
                <div className="space-y-2">

                  <h4 className="font-bold text-gray-900 text-medium flex items-center gap-2">
                    <div className="flex text-orange-500">
                      <FireIcon className="w-4 h-4" />
                      <FireIcon className="w-4 h-4" />
                    </div>
                    Great Deal
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed font-medium">Pricing that sits in the top 10% of historical savings across all retailers.</p>
                </div>
                <div className="space-y-2">

                  <h4 className="font-bold text-gray-900 text-medium flex items-center gap-2">
                    <div className="flex text-orange-500">
                      <FireIcon className="w-4 h-4" />
                    </div>
                    Good Price
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed font-medium">Reliable savings that beat the typical high-season market pricing.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <StatusModal
        isOpen={statusModal.isOpen}
        onClose={closeStatus}
        title={statusModal.title}
        message={statusModal.message}
        type={statusModal.type}
      />
    </div >
  );
}
