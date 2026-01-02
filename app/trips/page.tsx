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

  const householdCode = typeof window !== 'undefined' ? localStorage.getItem('household_code') : null;

  useEffect(() => {
    loadTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysToShow]);

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

  const loadTrips = async () => {
    if (!householdCode) {
      console.error('No household code found');
      setLoading(false);
      return;
    }
  
    setLoading(true);
  
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToShow);
  
    // Load trips
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
  
    // Auto-expand all trips initially
    setExpandedTrips(new Set(tripsData.map(t => t.id)));
  
    // Load events for all trips
    const tripIds = tripsData.map(t => t.id);
    const { data: eventsData, error: eventsError } = await supabase
      .from('shopping_list_events')
      .select('trip_id, item_id, quantity, checked_at, price')
      .in('trip_id', tripIds)
      .order('checked_at', { ascending: true });
  
    if (eventsError) {
      console.error('Error loading events:', eventsError);
    }
  
    // Get unique item IDs from events
    const itemIds = [...new Set(eventsData?.map(e => e.item_id) || [])];
  
    // Load FRESH item details (names and categories) from items table
    const { data: itemsData } = await supabase
      .from('items')
      .select('id, name, category')
      .in('id', itemIds);
  
    // Build item lookup: item_id -> { name, category }
    const itemMap: { [id: number]: { name: string; category: string } } = {};
    if (itemsData) {
      itemsData.forEach(item => {
        itemMap[item.id] = {
          name: item.name,
          category: item.category || 'Other',
        };
      });
    }
  
    // Combine trips with their events and fresh item data
    const tripsWithEvents: TripWithEvents[] = tripsData.map(trip => {
      const tripEvents = eventsData?.filter(e => e.trip_id === trip.id) || [];
      
      // Add fresh item names, categories, and snapshot prices to events
      const eventsWithDetails: TripEvent[] = tripEvents.map(event => {
        const itemInfo = itemMap[event.item_id];
        
        return {
          item_id: event.item_id,
          item_name: itemInfo?.name || 'Unknown Item', // FRESH NAME
          quantity: event.quantity,
          checked_at: event.checked_at,
          category: itemInfo?.category || 'Other', // FRESH CATEGORY
          price: event.price || undefined, // SNAPSHOT PRICE from event
        };
      });
  
      // Calculate total cost from snapshot prices
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

  // Group events by category
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-400 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="hidden md:flex justify-between items-start">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-gray-800">Recent Trips</h1>
              <p className="text-xs md:text-sm text-gray-600 mt-2">Your shopping trip history</p>
            </div>
            <Header currentPage="Recent Trips" />
          </div>

          <div className="md:hidden">
            <Header currentPage="Recent Trips" />
          </div>
        </div>

        {/* Time range selector */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <div className="flex gap-2 justify-center">
            {[7, 14, 30].map(days => (
              <button
                key={days}
                onClick={() => setDaysToShow(days)}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  daysToShow === days
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>

{/* Summary Stats */}
{!loading && trips.length > 0 && (
  <>
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="col-span-1 bg-white rounded-lg shadow-lg p-4 text-center">
        <p className="text-3xl font-bold text-blue-500">{trips.length}</p>
        <p className="text-sm font-bold text-blue-800 mt-1">Trips</p>
      </div>
      <div className="col-span-1 bg-white rounded-lg shadow-lg p-4 text-center">
        <p className="text-3xl font-bold text-rose-500">
          {trips.reduce((sum, t) => sum + t.itemCount, 0)}
        </p>
        <p className="text-sm font-bold text-rose-800 mt-1">Items</p>
      </div>
      <div className="col-span-2 bg-white rounded-lg shadow-lg p-4 text-center">
        <p className="text-3xl font-bold text-emerald-500">
          {formatMoney(trips.reduce((sum, t) => sum + t.totalCost, 0))}
        </p>
        <p className="text-sm font-bold text-emerald-800 mt-1">Total Spend</p>
      </div>
    </div>

{/* Category Breakdown */}
<div className="bg-white rounded-lg shadow-lg p-4 md:p-6 mb-6">
  <h2 className="text-xl font-bold text-gray-800 mb-4">Spending by Category</h2>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {(() => {
      // Aggregate spending by category across all trips
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

      // Sort by spending (highest first)
      const sortedCategories = Object.entries(categoryTotals)
        .sort(([, a], [, b]) => b - a);

      // Category color mapping
      const getCategoryColor = (category: string) => {
        const colors: { [key: string]: string } = {
          'Produce': 'bg-green-100 border-green-200 text-green-800',
          'Pantry': 'bg-amber-100 border-amber-200 text-amber-800',
          'Dairy': 'bg-purple-100 border-purple-200 text-purple-800',
          'Beverages': 'bg-blue-100 border-blue-200 text-blue-800',
          'Meat': 'bg-red-100 border-red-200 text-red-800',
          'Frozen': 'bg-cyan-100 border-cyan-200 text-cyan-800',
          'Bakery': 'bg-orange-100 border-orange-200 text-orange-800',
          'Snacks': 'bg-yellow-100 border-yellow-200 text-yellow-800',
          'Health': 'bg-pink-100 border-pink-200 text-pink-800',
          'Other': 'bg-gray-100 border-gray-200 text-gray-800',
        };
        return colors[category] || 'bg-gray-100 border-gray-300 text-gray-800';
      };

      return sortedCategories.map(([category, total]) => (
        <div key={category} className={`rounded-lg p-3 text-center border-2 ${getCategoryColor(category)}`}>
          <p className="text-xs font-semibold uppercase mb-1">{category}</p>
          <p className="text-xl font-bold">{formatMoney(total)}</p>
        </div>
      ));
    })()}
  </div>
</div>
  </>
)}

        {/* Trips list */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-gray-500">Loading trips...</p>
          </div>
        ) : trips.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-gray-500 text-lg">No trips found in the last {daysToShow} days</p>
            <p className="text-gray-400 text-sm mt-2">Start shopping and checking off items to track your trips!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {trips.map(trip => {
              const isExpanded = expandedTrips.has(trip.id);
              const eventsByCategory = groupByCategory(trip.events);
              const categories = Object.keys(eventsByCategory).sort();

              return (
                <div key={trip.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
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
                        <p className="text-xs text-teal-200 mt-1 ml-8">{trip.duration}</p>
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
                    {/* Scrollable container with padding at bottom for total */}
                    <div className="p-4 md:p-5 max-h-80 overflow-y-auto pb-20">
                    {categories.map(category => {
                        // Calculate category subtotal
                        const categorySubtotal = eventsByCategory[category].reduce((sum, event) => {
                        if (event.price) {
                            return sum + (event.price * event.quantity);
                        }
                        return sum;
                        }, 0);

                        return (
                        <div key={category} className="mb-4 last:mb-0">
                        {/* Category header with subtotal */}
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
                    </div>

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
                )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}