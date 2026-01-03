'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';

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
  category?: string;
  price?: number;
}

interface TripWithEvents extends Trip {
  events: TripEvent[];
  itemCount: number;
  duration: string;
  totalCost: number;
}

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

export default function TripsPage() {
  const [trips, setTrips] = useState<TripWithEvents[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysToShow, setDaysToShow] = useState(7);
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());

  // Category detail modal
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const householdCode = typeof window !== 'undefined' ? localStorage.getItem('household_code') : null;

  useEffect(() => {
    loadTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysToShow]);

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

  const openCategoryModal = (category: string) => {
    setSelectedCategory(category);
    setCategoryModalOpen(true);
  };

  const closeCategoryModal = () => {
    setCategoryModalOpen(false);
    setSelectedCategory(null);
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
      setLoading(false);
      return;
    }

    setExpandedTrips(new Set(tripsData.map(t => t.id)));

    const tripIds = tripsData.map(t => t.id);
    const { data: eventsData, error: eventsError } = await supabase
      .from('shopping_list_events')
      .select('trip_id, item_id, quantity, checked_at, price')
      .in('trip_id', tripIds)
      .order('checked_at', { ascending: true });

    if (eventsError) {
      console.error('Error loading events:', eventsError);
    }

    const itemIds = [...new Set(eventsData?.map(e => e.item_id) || [])];

    const { data: itemsData } = await supabase
      .from('items')
      .select('id, name, category')
      .in('id', itemIds);

    const itemMap: { [id: number]: { name: string; category: string } } = {};
    if (itemsData) {
      itemsData.forEach(item => {
        itemMap[item.id] = {
          name: item.name,
          category: item.category || 'Other',
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
          category: itemInfo?.category || 'Other',
          price: event.price || undefined,
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

      return {
        ...trip,
        events: eventsWithDetails,
        itemCount: eventsWithDetails.length,
        duration,
        totalCost,
      };
    });

    setTrips(tripsWithEvents);
    setLoading(false);
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
    return `$${amount.toFixed(2)}`;
  };

  const groupByCategory = (events: TripEvent[]) => {
    const grouped: { [category: string]: TripEvent[] } = {};
    events.forEach(event => {
      const cat = event.category || 'Other';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(event);
    });
    return grouped;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Produce': 'bg-emerald-50 border-emerald-200 text-emerald-700',
      'Pantry': 'bg-amber-50 border-amber-200 text-amber-700',
      'Dairy': 'bg-purple-50 border-purple-200 text-purple-700',
      'Beverage': 'bg-blue-50 border-blue-200 text-blue-700',
      'Meat': 'bg-red-50 border-red-200 text-red-700',
      'Frozen': 'bg-cyan-50 border-cyan-200 text-cyan-700',
      'Bakery': 'bg-orange-50 border-orange-200 text-orange-700',
      'Snacks': 'bg-yellow-50 border-yellow-200 text-yellow-700',
      'Health': 'bg-pink-50 border-pink-200 text-pink-700',
      'Other': 'bg-slate-50 border-slate-200 text-slate-700',
    };
    return colors[category] || 'bg-slate-50 border-slate-200 text-slate-700';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 p-4 md:p-8">
      {/* Premium Header */}
      <div className="bg-white rounded-2xl shadow-lg">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4">
          <div className="flex justify-between items-center">
            <Header currentPage="Recent Trips" />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        {/* Time Range Selector */}
        <div className="flex gap-2 mb-8">
          {[7, 14, 30].map(days => (
            <button
              key={days}
              onClick={() => setDaysToShow(days)}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                daysToShow === days
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {days} days
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
            <p className="text-slate-500 mt-4">Loading trips...</p>
          </div>
        ) : trips.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
            <div className="text-6xl mb-4">🛒</div>
            <p className="text-slate-600 text-lg font-medium">No trips found</p>
            <p className="text-slate-400 text-sm mt-2">Start shopping and checking off items to track your trips!</p>
          </div>
        ) : (
          <>
{/* Summary Stats */}
<div className="grid grid-cols-4 gap-4 mb-8">
  <div className="col-span-1 bg-white rounded-2xl shadow-lg border border-slate-100 p-4 hover:shadow-md transition-shadow duration-200 text-right">
    <div className="text-3xl font-bold text-indigo-500">{trips.length}</div>
    <div className="text-xs font-medium text-slate-500 tracking-wide mt-1">Trips</div>
  </div>
  <div className="col-span-1 bg-white rounded-2xl shadow-lg border border-slate-100 p-4 hover:shadow-md transition-shadow duration-200 text-right">
    <div className="text-3xl font-bold text-purple-600">
      {trips.reduce((sum, t) => sum + t.itemCount, 0)}
    </div>
    <div className="text-xs font-medium text-slate-500 tracking-wide mt-1">Items</div>
  </div>
  <div className="col-span-2 bg-white rounded-2xl shadow-lg border border-slate-100 p-4 hover:shadow-md transition-shadow duration-200 text-right">
    <div className="text-3xl font-bold text-emerald-600">
      {formatMoney(trips.reduce((sum, t) => sum + t.totalCost, 0))}
    </div>
    <div className="text-xs font-medium text-slate-500 tracking-wide mt-1">Total Spend</div>
  </div>
</div>

{/* Category Breakdown */}
<div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
  <div className="bg-gradient-to-r from-indigo-500 to-indigo-500 px-6 md:px-8 py-4">
    <h2 className="text-lg font-bold text-white">Spending by Category</h2>
  </div>
  <div className="p-6 md:p-8">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {(() => {
        const categoryTotals: { [category: string]: number } = {};
        
        trips.forEach(trip => {
          trip.events.forEach(event => {
            const cat = event.category || 'Other';
            if (event.price) {
              if (!categoryTotals[cat]) {
                categoryTotals[cat] = 0;
              }
              categoryTotals[cat] += event.price * event.quantity;
            }
          });
        });

        const sortedCategories = Object.entries(categoryTotals)
          .sort(([, a], [, b]) => b - a);

        return sortedCategories.map(([category, total]) => (
          <button
            key={category}
            onClick={() => openCategoryModal(category)}
            className={`rounded-xl p-4 border transition-all duration-200 hover:scale-105 text-right cursor-pointer ${getCategoryColor(category)}`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide mb-2 opacity-75">{category}</div>
            <div className="text-2xl font-bold">{formatMoney(total)}</div>
          </button>
        ));
      })()}
    </div>
  </div>
</div>

            {/* Trips list */}
            <div className="space-y-4">
              {trips.map(trip => {
                const isExpanded = expandedTrips.has(trip.id);
                const eventsByCategory = groupByCategory(trip.events);
                const categories = Object.keys(eventsByCategory).sort();

                return (
                  <div key={trip.id} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    {/* Trip header - clickable */}
                    <button
                      onClick={() => toggleTrip(trip.id)}
                      className="w-full bg-gradient-to-r from-teal-500 to-teal-600 p-4 md:p-5 hover:from-teal-600 hover:to-teal-700 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div className="text-left">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white text-xl">{isExpanded ? '▼' : '▶'}</span>
                            <h3 className="text-xl md:text-2xl font-bold text-white">{trip.store}</h3>
                            {!trip.ended_at && (
                              <span className="text-xs bg-white text-teal-600 px-2 py-1 rounded-full font-semibold">
                                In Progress
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-teal-100 ml-8">{formatDate(trip.started_at)}</p>
                          <p className="text-s text-indigo-600 mt-1 ml-8 text-left"><b>{trip.duration}</b></p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl md:text-3xl font-bold text-white">
                            {trip.totalCost > 0 ? formatMoney(trip.totalCost) : '—'}
                          </p>
                          <p className="text-sm text-teal-100">{trip.itemCount} items</p>
                        </div>
                      </div>
                    </button>

                    {/* Trip items - collapsible */}
                    {isExpanded && trip.events.length > 0 && (
                      <div className="relative">
                        <div className="p-4 md:p-5 max-h-80 overflow-y-auto pb-20">
                          {categories.map(category => {
                            const categorySubtotal = eventsByCategory[category].reduce((sum, event) => {
                              if (event.price) {
                                return sum + (event.price * event.quantity);
                              }
                              return sum;
                            }, 0);

                            return (
                              <div key={category} className="mb-4 last:mb-0">
                                <div className="flex items-center justify-between bg-gray-100 py-2 rounded-md mb-2 -mx-4 md:-mx-5 px-4 md:px-5">
                                  <h4 className="text-sm font-bold text-gray-700 uppercase">
                                    {category}
                                  </h4>
                                  <span className="text-sm font-bold text-gray-700">
                                    {formatMoney(categorySubtotal)}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {eventsByCategory[category].map((event, idx) => (
                                    <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                                      <div className="flex-1">
                                        <span className="text-gray-800 font-medium">{event.item_name}</span>
                                        {event.quantity > 1 && (
                                          <span className="text-gray-500 text-sm ml-2">× {event.quantity}</span>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        {event.price ? (
                                          <>
                                            <p className="font-semibold text-gray-800">
                                              {formatMoney(event.price * event.quantity)}
                                            </p>
                                            {event.quantity > 1 && (
                                              <p className="text-xs text-gray-500">
                                                {formatMoney(event.price)} each
                                              </p>
                                            )}
                                          </>
                                        ) : (
                                          <p className="text-gray-400 text-sm">No price</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}

                        {/* Trip total - positioned absolutely at bottom */}
                        {trip.totalCost > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 bg-white border-t-2 border-gray-300 px-4 md:px-5 py-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                            <div className="flex justify-between items-center">
                              <span className="text-lg font-bold text-gray-800">Total</span>
                              <span className="text-2xl font-bold text-teal-600">{formatMoney(trip.totalCost)}</span>
                            </div>
                            </div>
                          )}
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
{categoryModalOpen && selectedCategory && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col overflow-hidden">
              {/* Header - Fixed */}
              <div className="flex justify-between items-start p-6 pb-4 border-b border-gray-200">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">
                    {selectedCategory} Items
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Last {daysToShow} days
                  </p>
                </div>
                <button
                  onClick={closeCategoryModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
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
                    .filter(event => (event.category || 'Other') === selectedCategory)
                    .forEach(event => {
                      categoryItems.push({
                        ...event,
                        trip_date: trip.started_at,
                        store: trip.store,
                      });
                    });
                });

                // Sort alphabetically by item name
                categoryItems.sort((a, b) => 
                  a.item_name.localeCompare(b.item_name)
                );

                if (categoryItems.length === 0) {
                  return (
                    <p className="text-gray-500 text-center py-8">
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
                    <div className="flex-1 overflow-y-auto p-6 py-4">
                      <div className="space-y-2">
                        {categoryItems.map((item, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border ${getCategoryColor(selectedCategory)}`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-semibold">
                                {item.item_name}
                                {item.quantity > 1 && (
                                  <span className="text-sm ml-1 opacity-75">× {item.quantity}</span>
                                )}
                              </span>
                              <span className="font-bold">
                                {item.price ? formatMoney(item.price * item.quantity) : '—'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs opacity-75">
                              <span>{item.store}</span>
                              <span>•</span>
                              <span>
                                {new Date(item.checked_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              <span>•</span>
                              <span>
                                {new Date(item.checked_at).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Total - Fixed at Bottom */}
                    <div className={`p-4 border-t-2 ${getCategoryColor(selectedCategory)}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Category Total</span>
                        <span className="text-2xl font-bold">
                          {formatMoney(total)}
                        </span>
                      </div>
                      <p className="text-xs opacity-75 mt-1 text-right">
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
    </div>
  );
}