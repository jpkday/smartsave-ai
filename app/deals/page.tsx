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
import LoadingSpinner from '../components/LoadingSpinner';
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
  CheckIcon,
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
  timesBought: number; // distinct shopping days this household checked the item off
  lastBought: string | null; // YYYY-MM-DD
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

    // 1. Fetch User's Favorited Stores with sort_order
    const { data: favoritesData } = await supabase
      .from('household_store_favorites')
      .select('store_id, sort_order')
      .eq('household_code', currentHouseholdCode)
      .order('sort_order', { ascending: true });

    const favStoreIds = favoritesData?.map((f: any) => f.store_id) || [];

    // Build sort_order map by store_id
    const storeOrderById: { [store_id: string]: number } = {};
    (favoritesData || []).forEach((f: any) => {
      storeOrderById[f.store_id] = f.sort_order ?? 0;
    });

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
    let itemsQuery = supabase
      .from('items')
      .select('id, name, category_id');

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

    // Store map for store filter and name -> id mapping for sorting
    const storeSet = new Set<string>();
    const storeNameToId: { [name: string]: string } = {};

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
        if (p.store_id) storeNameToId[p.store] = p.store_id;
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
          timesBought: 0,
          lastBought: null,
        });
      }
    });

    const dealList = Array.from(dealMap.values());

    // Check shopping list status and the household's purchase history
    const [{ data: listData }, { data: purchaseData }] = await Promise.all([
      supabase
        .from('shopping_list')
        .select('item_name')
        .eq('household_code', currentHouseholdCode),
      supabase
        .from('shopping_list_events')
        .select('item_id, checked_at')
        .eq('household_code', currentHouseholdCode)
        .not('item_id', 'is', null)
        .not('checked_at', 'is', null)
        .order('checked_at', { ascending: false })
        .limit(3000),
    ]);

    const listSet = new Set(listData?.map((l: any) => l.item_name) || []);

    // Purchase days per item (events are newest first, so the first day seen is the latest)
    const purchases = new Map<string, { days: Set<string>; last: string }>();
    (purchaseData || []).forEach((e: any) => {
      const key = String(e.item_id);
      const day = e.checked_at.slice(0, 10);
      const entry = purchases.get(key) ?? { days: new Set<string>(), last: day };
      entry.days.add(day);
      purchases.set(key, entry);
    });

    dealList.forEach(d => {
      d.isOnList = listSet.has(d.item_name);
      const bought = purchases.get(String(d.item_id));
      d.timesBought = bought?.days.size ?? 0;
      d.lastBought = bought?.last ?? null;
    });

    // Sort by discount % descending (biggest savings first)
    dealList.sort((a, b) => b.discountPercent - a.discountPercent);

    setDeals(dealList);
    // Sort stores by favorite sort_order, then alphabetically
    const sortedStores = [...storeSet].sort((a, b) => {
      const idA = storeNameToId[a];
      const idB = storeNameToId[b];
      const orderA = idA ? (storeOrderById[idA] ?? Infinity) : Infinity;
      const orderB = idB ? (storeOrderById[idB] ?? Infinity) : Infinity;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    });
    setStores(sortedStores);
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
        // Items this household buys come first
        if ((a.timesBought > 0) !== (b.timesBought > 0)) return a.timesBought > 0 ? -1 : 1;
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
    <div className="min-h-screen app-bg pb-32">
      <div className="sticky top-0 z-50 app-header w-full">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="hidden md:flex items-center gap-2">
              <Link href="/" className="text-xl font-bold text-bb-cream hover:text-bb-gold transition flex items-center gap-2">
                <span className="text-2xl">ᯓ</span>
                <span className="hidden sm:inline">SmartSave</span>
              </Link>
            </div>
            <div className="w-full">
              <Header currentPage="Local Deals" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-6">

        {/* Deals Grouped by Store */}
        <div>
          {loading ? (
            <div className="py-20 bg-bb-panel rounded-2xl border border-bb-line items-center justify-center">
              <LoadingSpinner message="Loading Deals..." color="border-bb-gold" textColor="text-bb-muted" />
            </div>
          ) : !hasFavorites ? (
            <div className="rounded-2xl p-8 md:p-12 text-center bg-bb-panel border border-bb-line">
              <BuildingStorefrontIcon className="w-10 h-10 text-bb-gold mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-bb-cream mb-2">Personalize Your Savings</h2>
              <p className="text-bb-muted mb-6 max-w-md mx-auto leading-relaxed">
                Add your favorite local stores to see deals, price history and &quot;Market Low&quot; alerts.
              </p>
              <Link
                href="/stores"
                className="inline-flex items-center gap-2 bg-bb-gold text-bb-navy px-6 py-3 rounded-xl font-semibold hover:brightness-110 transition"
              >
                Manage Stores
              </Link>
            </div>
          ) : visibleGroups.length === 0 ? (
            <div className="rounded-2xl p-10 text-center bg-bb-panel border border-bb-line">
              <SparklesIcon className="w-8 h-8 text-bb-muted mx-auto mb-3" />
              <p className="text-lg font-semibold text-bb-cream">No big savings right now</p>
              <p className="text-bb-muted text-sm mt-1">Check back after new flyers or receipts are added for your stores.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-bb-panel border border-bb-line rounded-2xl px-5 py-5 md:px-6">
                <div className="text-xs font-medium uppercase tracking-wider text-bb-muted">Potential savings</div>
                <div className="font-serif text-4xl md:text-5xl text-bb-green mt-1 tabular-nums">
                  ${visibleGroups.reduce((sum, g) => sum + g.totalSavings, 0).toFixed(2)}
                </div>
                <div className="text-sm text-bb-muted mt-1.5">
                  {totalVisibleDeals} {totalVisibleDeals === 1 ? 'deal' : 'deals'} at {visibleGroups.length} {visibleGroups.length === 1 ? 'store' : 'stores'}
                  {' · '}up to {topDiscount}% off
                </div>
              </div>

              {visibleGroups.map(({ storeName, storeDeals, totalSavings }) => (
                <div key={storeName} className="bg-bb-panel border border-bb-line rounded-2xl overflow-hidden">
                  {/* Store header */}
                  <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5 border-b border-bb-line">
                    <div className="min-w-0">
                      <h2 className="text-base md:text-lg font-semibold text-bb-cream truncate">{storeName}</h2>
                      <div className="text-xs text-bb-muted">
                        {storeDeals.length} {storeDeals.length === 1 ? 'deal' : 'deals'}
                      </div>
                    </div>
                    <div className="text-right flex-none">
                      <div className="text-sm font-semibold text-bb-green tabular-nums">Save ${totalSavings.toFixed(2)}</div>
                      <div className="text-[11px] text-bb-muted">if you buy all</div>
                    </div>
                  </div>

                  {/* Deals */}
                  <div className="divide-y divide-bb-line">
                    {storeDeals.map((deal, idx) => {
                      const badge = getDealBadge(deal.dealQuality);
                      return (
                        <Link
                          key={`${storeName}-${idx}`}
                          href={`/history?item=${encodeURIComponent(JSON.stringify(deal.item_name))}&store=${encodeURIComponent(JSON.stringify(deal.store))}`}
                          className="group flex items-center gap-3 px-4 py-3 md:px-5 hover:bg-white/5 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm md:text-base text-bb-cream truncate group-hover:text-bb-gold transition-colors">
                              {deal.item_name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-xs">
                              <span className="flex text-bb-gold" aria-hidden="true">
                                {[...Array(badge.flames)].map((_, i) => (
                                  <FireIcon key={i} className="w-3.5 h-3.5" />
                                ))}
                              </span>
                              <span className={badge.glow ? 'text-bb-gold' : 'text-bb-muted'}>{badge.label}</span>
                              {deal.timesBought > 0 && (
                                <span
                                  className="text-bb-gold whitespace-nowrap"
                                  title={deal.lastBought ? `Last bought ${parseLocalDate(deal.lastBought).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : undefined}
                                >
                                  · You buy this {deal.timesBought}×
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right flex-none">
                            <div className="text-base font-semibold text-bb-cream tabular-nums">${deal.price.toFixed(2)}</div>
                            <div className="text-xs tabular-nums whitespace-nowrap">
                              <span className="text-bb-green">−{deal.discountPercent.toFixed(0)}%</span>
                              {deal.typicalHighPrice > 0 && (
                                <span className="text-bb-muted line-through ml-1.5">${deal.typicalHighPrice.toFixed(2)}</span>
                              )}
                            </div>
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
                            aria-label={deal.isOnList ? `Remove ${deal.item_name} from list` : `Add ${deal.item_name} to list`}
                            title={deal.isOnList ? 'On your list. Tap to remove' : 'Add to list'}
                            className={`w-9 h-9 flex-none flex items-center justify-center rounded-full transition-all active:scale-95 cursor-pointer ${deal.isOnList
                              ? 'border border-bb-green/40 text-bb-green hover:border-bb-red/40 hover:text-bb-red hover:bg-bb-red/10'
                              : 'bg-bb-gold text-bb-navy hover:brightness-110'
                              }`}
                          >
                            {deal.isOnList ? <CheckIcon className="w-5 h-5" /> : <PlusIcon className="w-5 h-5" />}
                          </button>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2 pt-1 text-xs text-bb-muted">
                <span className="flex items-center gap-1"><span className="flex text-bb-gold">{[0, 1, 2].map(i => <FireIcon key={i} className="w-3 h-3" />)}</span>Lowest price on record</span>
                <span className="flex items-center gap-1"><span className="flex text-bb-gold">{[0, 1].map(i => <FireIcon key={i} className="w-3 h-3" />)}</span>Well below average</span>
                <span className="flex items-center gap-1"><span className="flex text-bb-gold"><FireIcon className="w-3 h-3" /></span>Below typical price</span>
              </div>
            </div>
          )}
        </div>
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
