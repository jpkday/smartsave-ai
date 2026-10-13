'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { useCategories } from '../hooks/useCategories';
import { useHouseholdCode } from '../hooks/useHouseholdCode';
import LoadingSpinner from '../components/LoadingSpinner';
import GlobalItemEditModal from '../components/GlobalItemEditModal';

interface Trip {
  id: string;
  store: string;
  store_id: string;
  started_at: string;
  ended_at: string | null;
  household_code: string;
}

interface TripEvent {
  item_id: number;
  item_name: string;
  quantity: number;
  checked_at: string;
  category_id: number;
  price?: number;
  unit?: string;
  is_weighted?: boolean;
}

interface TripWithEvents extends Trip {
  events: TripEvent[];
  itemCount: number;
  duration: string;
  totalCost: number;
}

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

// Categories shown in the spending summary before "Show all"
const TOP_CATEGORY_COUNT = 5;

export default function TripsPage() {
  const [trips, setTrips] = useState<TripWithEvents[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysToShow, setDaysToShow] = useState(7);
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState('All');
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Load persisted filters on mount
  useEffect(() => {
    const savedDays = localStorage.getItem('trips_days_filter');
    if (savedDays) {
      const parsed = parseInt(savedDays, 10);
      if (!isNaN(parsed) && [7, 14, 30, 60].includes(parsed)) {
        setDaysToShow(parsed);
      }
    }
    const savedStore = localStorage.getItem('trips_store_filter');
    if (savedStore) {
      setSelectedStoreFilter(savedStore);
    }
    setIsInitialLoad(false);
  }, []);

  /* Refactored to use dynamic categories */
  const { categories, getCategoryName } = useCategories();
  const { householdCode, loading: householdLoading } = useHouseholdCode();

  const [hasAnyTrips, setHasAnyTrips] = useState(true);

  // Save filter changes
  useEffect(() => {
    if (!isInitialLoad) {
      localStorage.setItem('trips_days_filter', daysToShow.toString());
      localStorage.setItem('trips_store_filter', selectedStoreFilter);
    }
  }, [daysToShow, selectedStoreFilter, isInitialLoad]);

  // Category detail modal
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [itemToEdit, setItemToEdit] = useState<any | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [favoritedIds, setFavoritedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!householdLoading) {
      if (householdCode) {
        loadTrips();
        loadFavorites();
      } else {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysToShow, householdCode, householdLoading]);

  // Close category modal on ESC
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCategoryModal();
      }
    };
    if (categoryModalOpen) {
      window.addEventListener('keydown', onKeyDown);
    }
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [categoryModalOpen]);

  const toggleTrip = (tripId: string) => {
    setExpandedTrips(prev => {
      const next = new Set(prev);
      if (next.has(tripId)) {
        next.delete(tripId);
      } else {
        next.add(tripId);
      }
      return next;
    });
  };

  const openCategoryModal = (category: number) => {
    setSelectedCategory(category);
    setCategoryModalOpen(true);
  };

  const closeCategoryModal = () => {
    setCategoryModalOpen(false);
    setSelectedCategory(null);
  };

  const loadFavorites = async () => {
    if (!householdCode) return;
    const { data } = await supabase
      .from('household_item_favorites')
      .select('item_id')
      .eq('household_code', householdCode);
    setFavoritedIds(new Set(data?.map(f => f.item_id) || []));
  };

  const loadTrips = async () => {
    if (!householdCode) {
      console.error('No household code found');
      setLoading(false);
      return;
    }

    setLoading(true);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToShow);

    const { data: tripsData, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .eq('household_code', householdCode)
      .gte('started_at', startDate.toISOString())
      .order('started_at', { ascending: false });

    if (tripsError) {
      console.error('Error loading trips:', tripsError);
      setLoading(false);
      return;
    }

    if (!tripsData || tripsData.length === 0) {
      setTrips([]);

      // CHECK IF USER HAS ANY HISTORY AT ALL
      const { count } = await supabase
        .from('trips')
        .select('*', { count: 'exact', head: true })
        .eq('household_code', householdCode);

      if (count === 0) {
        setHasAnyTrips(false);
      } else {
        setHasAnyTrips(true);
      }

      setLoading(false);
      return;
    }

    setHasAnyTrips(true);

    setExpandedTrips(new Set(tripsData.map(t => t.id)));

    const tripIds = tripsData.map(t => t.id);
    let { data: eventsData, error: eventsError } = await supabase
      .from('shopping_list_events')
      .select('trip_id, item_id, quantity, checked_at, price, unit, is_weighted')
      .in('trip_id', tripIds)
      .order('checked_at', { ascending: true });

    if (eventsError) {
      console.error('Error loading events:', eventsError);
      // Fallback if migration hasn't been run yet (missing unit/is_weighted)
      if (eventsError.message?.includes('unit') || eventsError.message?.includes('is_weighted')) {
        const { data: fallbackData } = await supabase
          .from('shopping_list_events')
          .select('trip_id, item_id, quantity, checked_at, price')
          .in('trip_id', tripIds)
          .order('checked_at', { ascending: true });

        eventsData = fallbackData as any;
      }
    }

    const itemIds = [...new Set((eventsData || []).map(e => e.item_id))];

    const { data: itemsData } = await supabase
      .from('items')
      .select('id, name, category_id, unit, is_weighted')
      .in('id', itemIds);

    const itemMap: { [id: number]: { name: string; category_id: number; unit: string; is_weighted: boolean } } = {};
    if (itemsData) {
      itemsData.forEach(item => {
        itemMap[item.id] = {
          name: item.name,
          category_id: item.category_id !== null ? item.category_id : -1, // Default to -1 (Other)
          unit: item.unit || 'each',
          is_weighted: item.is_weighted || false,
        };
      });
    }

    const tripsWithEvents: TripWithEvents[] = tripsData.map(trip => {
      const tripEvents = eventsData?.filter(e => e.trip_id === trip.id) || [];

      const eventsWithDetails: TripEvent[] = tripEvents.map(event => {
        const itemInfo = itemMap[event.item_id];

        return {
          item_id: event.item_id,
          item_name: itemInfo?.name || 'Unknown Item',
          quantity: event.quantity,
          checked_at: event.checked_at,
          category_id: itemInfo?.category_id ?? -1,
          price: event.price || undefined,
          unit: itemInfo?.unit || event.unit, // Item library is source of truth
          is_weighted: itemInfo?.is_weighted ?? event.is_weighted,
        };
      });

      const totalCost = eventsWithDetails.reduce((sum, event) => {
        if (event.price) {
          return sum + (event.price * event.quantity);
        }
        return sum;
      }, 0);

      let duration = 'In Progress';
      if (trip.ended_at) {
        const start = new Date(trip.started_at);
        const end = new Date(trip.ended_at);
        const diffMs = end.getTime() - start.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 60) {
          duration = `${diffMins} min`;
        } else {
          const hours = Math.floor(diffMins / 60);
          const mins = diffMins % 60;
          duration = `${hours}h ${mins}m`;
        }
      }

      const itemCount = eventsWithDetails.reduce((sum, event) => {
        // If it's weighted (lb/oz), it counts as 1 package
        if (event.is_weighted || event.unit === 'lb' || event.unit === 'oz') {
          return sum + 1;
        }
        return sum + (event.quantity || 1);
      }, 0);

      return {
        ...trip,
        events: eventsWithDetails,
        itemCount,
        duration,
        totalCost,
      };
    });

    setTrips(tripsWithEvents);
    setLoading(false);
  };

  const handleEditItem = (event: TripEvent) => {
    setItemToEdit({
      id: event.item_id,
      name: event.item_name,
      category_id: event.category_id,
      unit: event.unit || 'each',
      is_weighted: event.is_weighted || false
    });
    setEditModalOpen(true);
  };

  const handleSaveItem = () => {
    // Reload trips to reflect data changes
    loadTrips();
    loadFavorites();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    }
  };

  const formatMoney = (amount: number) => {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  const groupByCategory = (events: TripEvent[]) => {
    const grouped: { [categoryId: number]: TripEvent[] } = {};
    events.forEach(event => {
      const catId = event.category_id;
      if (!grouped[catId]) {
        grouped[catId] = [];
      }
      grouped[catId].push(event);
    });
    return grouped;
  };



  return (
    <div className="min-h-screen app-bg pb-20 md:pb-0">
      {/* Premium Header - Sticky */}
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
              <Header currentPage="Recent Trips" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-2 md:px-8 pt-6">
        {/* Time Range Selector */}
        {hasAnyTrips && (
          <div className="inline-flex flex-wrap gap-1 mb-6 bg-white/5 border border-bb-line rounded-xl p-1">
            {[7, 14, 30, 60].map(days => (
              <button
                key={days}
                onClick={() => setDaysToShow(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer text-center min-w-[5.5rem] ${days === 60 ? 'hidden md:block' : ''
                  } ${daysToShow === days
                    ? 'bg-bb-gold text-bb-navy font-semibold'
                    : 'text-bb-muted hover:text-bb-cream'
                  }`}
              >
                {days} days
              </button>
            ))}
          </div>
        )}

        {(loading || householdLoading) ? (
          <div className="bg-bb-panel rounded-2xl border border-bb-line p-12 text-center">
            <LoadingSpinner message="Loading Trips..." color="border-bb-gold" textColor="text-bb-muted" />
          </div>
        ) : !hasAnyTrips ? (
          <div className="px-4 py-12 md:py-20 text-center">
            <div className="bg-bb-panel rounded-2xl p-8 max-w-2xl mx-auto border border-bb-line">
              <div className="text-6xl mb-6">🧾</div>
              <h2 className="text-3xl font-bold text-bb-cream mb-4">Your Shopping History</h2>
              <p className="text-lg text-bb-muted mb-8 leading-relaxed">
                Track every trip across multiple stores, compare prices, and watch your savings grow.
                When you finish shopping in the app, your receipts will be saved here automatically.
              </p>

              <div className="grid md:grid-cols-3 gap-6 mb-8 text-left">
                <div className="bg-white/[0.03] p-4 rounded-xl border border-bb-line">
                  <span className="text-2xl mb-2 block">📝</span>
                  <h3 className="font-bold text-bb-cream mb-1">Digital Receipts</h3>
                  <p className="text-sm text-bb-muted">Never lose a receipt again.</p>
                </div>
                <div className="bg-white/[0.03] p-4 rounded-xl border border-bb-line">
                  <span className="text-2xl mb-2 block">💵</span>
                  <h3 className="font-bold text-bb-cream mb-1">Price Tracking</h3>
                  <p className="text-sm text-bb-muted">Know exactly what you paid.</p>
                </div>
                <div className="bg-white/[0.03] p-4 rounded-xl border border-bb-line">
                  <span className="text-2xl mb-2 block">🕵️‍♀️</span>
                  <h3 className="font-bold text-bb-cream mb-1">Smart Analysis</h3>
                  <p className="text-sm text-bb-muted">See spending by category.</p>
                </div>
              </div>

              <Link
                href="/list"
                className="inline-flex items-center justify-center gap-2 bg-bb-gold text-bb-navy text-lg font-bold px-8 py-4 rounded-2xl hover:brightness-110 transition w-full md:w-auto"
              >
                Start a New Trip
              </Link>
            </div>
          </div>
        ) : trips.length === 0 ? (
          <div className="bg-bb-panel rounded-2xl border border-bb-line p-12 text-center">
            <div className="text-6xl mb-4">📅</div>
            <p className="text-bb-muted text-lg font-medium">No trips found in the last {daysToShow} days</p>
            <p className="text-bb-muted text-sm mt-2">Try selecting a longer time range above.</p>
          </div>
        ) : (
          <>
            {/* Summary: total spend + category breakdown */}
            {(() => {
              const filteredTrips = trips.filter(trip => selectedStoreFilter === 'All' || trip.store === selectedStoreFilter);
              const totalSpend = filteredTrips.reduce((sum, t) => sum + t.totalCost, 0);
              const itemCount = filteredTrips.reduce((sum, t) => sum + t.itemCount, 0);

              const categoryTotals: { [categoryId: number]: number } = {};
              filteredTrips.forEach(trip => {
                trip.events.forEach(event => {
                  const catId = event.category_id !== null ? event.category_id : -1;
                  if (event.price) {
                    categoryTotals[catId] = (categoryTotals[catId] || 0) + event.price * event.quantity;
                  }
                });
              });
              const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);
              const categorySum = sortedCategories.reduce((sum, [, total]) => sum + total, 0);
              const maxCategory = sortedCategories.length > 0 ? sortedCategories[0][1] : 0;

              return (
                <div className="bg-bb-panel border border-bb-line rounded-2xl mb-4">
                  <div className="px-5 pt-5 pb-4 md:px-6">
                    <div className="text-xs font-medium uppercase tracking-wider text-bb-muted">Spent</div>
                    <div className="font-serif text-4xl md:text-5xl text-bb-cream mt-1 tabular-nums">{formatMoney(totalSpend)}</div>
                    <div className="text-sm text-bb-muted mt-1.5">
                      {filteredTrips.length} {filteredTrips.length === 1 ? 'trip' : 'trips'}
                      {' · '}{itemCount} {itemCount === 1 ? 'item' : 'items'}
                      {filteredTrips.length > 1 && <>{' · '}{formatMoney(totalSpend / filteredTrips.length)} avg</>}
                    </div>
                  </div>

                  {sortedCategories.length > 0 && (
                    <div className="border-t border-bb-line px-2 py-2 md:px-3">
                      {(showAllCategories ? sortedCategories : sortedCategories.slice(0, TOP_CATEGORY_COUNT)).map(([catIdStr, total]) => {
                        const catId = parseInt(catIdStr);
                        const share = categorySum > 0 ? Math.round((total / categorySum) * 100) : 0;
                        return (
                          <button
                            key={catId}
                            onClick={() => openCategoryModal(catId)}
                            className="w-full text-left rounded-xl px-3 py-2.5 hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="text-sm text-bb-cream">{getCategoryName(catId)}</span>
                              <span className="text-sm tabular-nums">
                                <span className="text-bb-muted mr-2">{share}%</span>
                                <span className="text-bb-cream font-semibold">{formatMoney(total)}</span>
                              </span>
                            </div>
                            <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-bb-gold/70"
                                style={{ width: `${maxCategory > 0 ? (total / maxCategory) * 100 : 0}%` }}
                              />
                            </div>
                          </button>
                        );
                      })}
                      {sortedCategories.length > TOP_CATEGORY_COUNT && (
                        <button
                          onClick={() => setShowAllCategories(!showAllCategories)}
                          className="w-full flex items-center justify-center gap-1 mt-1 px-3 py-2 rounded-xl text-sm font-medium text-bb-gold hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          {showAllCategories ? 'Show less' : `Show all ${sortedCategories.length} categories`}
                          <svg className={`w-4 h-4 transition-transform ${showAllCategories ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Store Filters */}
            <div className="flex gap-1 p-1 mb-4 rounded-xl bg-white/5 border border-bb-line">
              {(() => {
                // Calculate top 3 stores
                const storeCounts: { [store: string]: number } = {};
                trips.forEach(trip => {
                  storeCounts[trip.store] = (storeCounts[trip.store] || 0) + 1;
                });

                const topStores = Object.entries(storeCounts)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 3)
                  .map(([store]) => store);

                return (
                  <>
                    <button
                      onClick={() => setSelectedStoreFilter('All')}
                      className={`flex-1 min-w-0 px-2 py-2 rounded-lg text-sm transition-colors duration-200 cursor-pointer text-center whitespace-nowrap ${selectedStoreFilter === 'All'
                        ? 'bg-bb-gold text-bb-navy font-semibold'
                        : 'text-bb-muted hover:text-bb-cream'
                        }`}
                    >
                      All
                    </button>
                    {topStores.map(store => (
                      <button
                        key={store}
                        onClick={() => setSelectedStoreFilter(store)}
                        className={`flex-1 min-w-0 px-2 py-2 rounded-lg text-sm transition-colors duration-200 cursor-pointer text-center whitespace-nowrap overflow-hidden text-ellipsis ${selectedStoreFilter === store
                          ? 'bg-bb-gold text-bb-navy font-semibold'
                          : 'text-bb-muted hover:text-bb-cream'
                          }`}
                      >
                        {store}
                      </button>
                    ))}
                  </>
                );
              })()}
            </div>

            {/* Trips list */}
            <div className="space-y-3">
              {trips
                .filter(trip => selectedStoreFilter === 'All' || trip.store === selectedStoreFilter)
                .map(trip => {
                  const isExpanded = expandedTrips.has(trip.id);
                  const eventsByCategory = groupByCategory(trip.events);
                  const categoryIds = Object.keys(eventsByCategory).map(k => parseInt(k));

                  // Sort by category name
                  categoryIds.sort((a, b) => {
                    const nameA = getCategoryName(a);
                    const nameB = getCategoryName(b);
                    return nameA.localeCompare(nameB);
                  });

                  return (
                    <div key={trip.id} className="bg-bb-panel border border-bb-line rounded-2xl overflow-hidden">
                      {/* Trip header - clickable */}
                      <button
                        onClick={() => toggleTrip(trip.id)}
                        className="w-full px-4 py-3 md:px-5 md:py-4 hover:bg-white/5 cursor-pointer transition text-left"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <svg className={`w-4 h-4 flex-none text-bb-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <h3 className="text-base md:text-lg font-semibold text-bb-cream truncate">{trip.store}</h3>
                            {!trip.ended_at && (
                              <span className="text-[10px] bg-bb-gold/10 text-bb-gold border border-bb-gold/30 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider flex-none">
                                In Progress
                              </span>
                            )}
                          </div>
                          <span className="text-lg font-semibold text-bb-cream tabular-nums flex-none">
                            {trip.totalCost > 0 ? formatMoney(trip.totalCost) : '—'}
                          </span>
                        </div>
                        <p className="text-xs text-bb-muted mt-0.5 ml-6">
                          {formatDate(trip.started_at)}
                          {trip.duration && <>{' · '}{trip.duration}</>}
                          {' · '}{trip.itemCount} {trip.itemCount === 1 ? 'item' : 'items'}
                        </p>
                      </button>

                      {/* Trip items - collapsible */}
                      {isExpanded && trip.events.length > 0 && (
                        <div className="border-t border-bb-line">
                          {/* Scrollable items section */}
                          <div className="px-4 pb-3 md:px-5 max-h-96 overflow-y-auto">
                            {categoryIds.map(categoryId => {
                              const events = eventsByCategory[categoryId];
                              const categoryName = getCategoryName(categoryId);

                              const categorySubtotal = events.reduce((sum, event) => {
                                if (event.price) {
                                  return sum + (event.price * event.quantity);
                                }
                                return sum;
                              }, 0);

                              return (
                                <div key={categoryId}>
                                  <div className="flex items-center justify-between pt-3 pb-1">
                                    <h4 className="text-[11px] font-semibold text-bb-muted uppercase tracking-wider">
                                      {categoryName}
                                    </h4>
                                    <span className="text-xs text-bb-muted tabular-nums">
                                      {formatMoney(categorySubtotal)}
                                    </span>
                                  </div>
                                  <div>
                                    {events.map((event, idx) => (
                                      <div key={idx} className="flex justify-between items-center gap-3 py-1.5 border-b border-bb-line last:border-b-0">
                                        <div className="flex-1">
                                          <span className="text-sm text-bb-cream">{event.item_name}</span>
                                          {((event.is_weighted || event.unit === 'lb' || event.unit === 'oz') || event.quantity !== 1) && (
                                            <span className="text-bb-muted text-xs ml-1.5">
                                              × {event.quantity}{event.unit && (event.unit === 'lb' || event.unit === 'oz') ? ` ${event.unit}` : ''}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-right">
                                          {event.price ? (
                                            <>
                                              <p className="text-sm text-bb-cream tabular-nums">
                                                {formatMoney(event.price * event.quantity)}
                                              </p>
                                              {((event.is_weighted || event.unit === 'lb' || event.unit === 'oz') || event.quantity !== 1) && (
                                                <p className="text-[11px] text-bb-muted tabular-nums">
                                                  {formatMoney(event.price)} {event.is_weighted || (event.unit && (event.unit === 'lb' || event.unit === 'oz')) ? `/${event.unit || 'lb'}` : 'each'}
                                                </p>
                                              )}
                                            </>
                                          ) : (
                                            <p className="text-slate-600 text-xs">No price</p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </>
        )}
        {/* Category Detail Modal */}
        {categoryModalOpen && selectedCategory !== null && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-bb-panel border border-bb-line rounded-2xl shadow-sm max-w-md w-full max-h-[80vh] flex flex-col min-h-0">
              {/* Header - Fixed */}
              <div className="flex justify-between items-start p-6 pb-4 border-b border-bb-line">
                <div>
                  <h3 className="text-xl font-bold text-bb-cream">
                    {getCategoryName(selectedCategory)} Items
                  </h3>
                  <p className="text-sm text-bb-muted mt-1">
                    Last {daysToShow} days
                  </p>
                </div>
                <button
                  onClick={closeCategoryModal}
                  className="text-bb-muted hover:text-bb-cream text-2xl cursor-pointer"
                  aria-label="Close"
                >
                  ✖
                </button>
              </div>

              {(() => {
                // Collect all items from this category across all trips
                const categoryItems: Array<TripEvent & { trip_date: string; store: string }> = [];

                trips.forEach(trip => {
                  trip.events
                    .filter(event => event.category_id === selectedCategory)
                    .forEach(event => {
                      categoryItems.push({
                        ...event,
                        trip_date: trip.started_at,
                        store: trip.store,
                      });
                    });
                });

                categoryItems.sort((a, b) => {
                  const aTime = a.checked_at ? new Date(a.checked_at).getTime() : 0;
                  const bTime = b.checked_at ? new Date(b.checked_at).getTime() : 0;
                  return bTime - aTime; // DESC
                });

                if (categoryItems.length === 0) {
                  return (
                    <p className="text-bb-muted text-center py-8">
                      No items in this category
                    </p>
                  );
                }

                const total = categoryItems.reduce(
                  (sum, item) => sum + ((item.price || 0) * item.quantity),
                  0
                );

                return (
                  <>
                    {/* Items - Scrollable */}
                    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 pb-28">
                      <div className="space-y-2">
                        {categoryItems.map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleEditItem(item)}
                            className={`w-full text-left p-3 rounded-xl border bg-white/[0.03] border-bb-line text-bb-cream hover:bg-white/5 transition-colors cursor-pointer`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-semibold flex items-center gap-2">
                                {favoritedIds.has(item.item_id) && <span>⭐</span>}
                                {item.item_name}
                                {item.quantity > 1 && (
                                  <span className="text-sm ml-1 text-bb-muted">× {item.quantity}</span>
                                )}
                              </span>
                              <span className="font-bold">
                                {item.price ? formatMoney(item.price * item.quantity) : '—'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-bb-muted">
                              <span>{item.store}</span>
                              <span>•</span>
                              <span>
                                {new Date(item.trip_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              <span>•</span>
                              <span className="text-bb-gold font-bold uppercase tracking-wider md:hidden">Tap to Edit</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Total - Fixed at Bottom */}
                    <div className={`shrink-0 p-4 border-t bg-bb-raised border-bb-line text-bb-cream rounded-b-2xl`}>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Category Total</span>
                        <span className="text-2xl font-bold">{formatMoney(total)}</span>
                      </div>
                      <p className="text-xs text-bb-muted mt-1 text-right">
                        {categoryItems.length} {categoryItems.length === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
      {/* Global Item Edit Modal */}
      <GlobalItemEditModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        item={itemToEdit}
        householdCode={householdCode}
        categories={categories}
        isFavorited={itemToEdit ? favoritedIds.has(itemToEdit.id) : false}
        onSave={handleSaveItem}
      />
    </div>
  );
}