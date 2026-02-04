'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import { supabase } from '../../lib/supabase';
import { useCategories } from '../../hooks/useCategories';
import { ArrowLeftIcon } from '@heroicons/react/24/solid';
import LoadingSpinner from '../../components/LoadingSpinner';

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

interface TripDetails {
    id: string;
    store: string;
    store_id: string;
    started_at: string;
    ended_at: string | null;
    household_code: string;
    totalCost: number;
    itemCount: number;
    duration: string;
    events: TripEvent[];
}

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { getCategoryName, getCategoryColorById } = useCategories();
    const [trip, setTrip] = useState<TripDetails | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTripDetails();
    }, [id]);

    const loadTripDetails = async () => {
        try {
            // 1. Get Trip
            const { data: tripData, error: tripError } = await supabase
                .from('trips')
                .select('*')
                .eq('id', id)
                .single();

            if (tripError || !tripData) throw new Error("Trip not found");

            // 2. Get Events
            const { data: eventsData, error: eventsError } = await supabase
                .from('shopping_list_events')
                .select('trip_id, item_id, quantity, checked_at, price, unit, is_weighted')
                .eq('trip_id', id)
                .order('checked_at', { ascending: true });

            if (eventsError) throw eventsError;

            // 3. Get Items (for names/categories)
            const itemIds = [...new Set((eventsData || []).map(e => e.item_id))];
            const { data: itemsData } = await supabase
                .from('items')
                .select('id, name, category_id, unit, is_weighted')
                .in('id', itemIds);

            const itemMap: { [id: number]: { name: string; category_id: number; unit: string; is_weighted: boolean } } = {};
            itemsData?.forEach(item => {
                itemMap[item.id] = {
                    name: item.name,
                    category_id: item.category_id ?? -1,
                    unit: item.unit || 'each',
                    is_weighted: item.is_weighted || false
                };
            });

            // 4. Transform
            const eventsWithDetails: TripEvent[] = (eventsData || []).map(event => {
                const info = itemMap[event.item_id];
                return {
                    item_id: event.item_id,
                    item_name: info?.name || 'Unknown Item',
                    quantity: event.quantity,
                    checked_at: event.checked_at,
                    category_id: info?.category_id ?? -1,
                    price: event.price,
                    unit: info?.unit || event.unit,
                    is_weighted: info?.is_weighted ?? event.is_weighted
                };
            });

            const totalCost = eventsWithDetails.reduce((sum, e) => sum + ((e.price || 0) * e.quantity), 0);

            // Calc Duration
            let duration = 'In Progress';
            if (tripData.ended_at) {
                const start = new Date(tripData.started_at);
                const end = new Date(tripData.ended_at);
                const diffMins = Math.floor((end.getTime() - start.getTime()) / 60000);
                if (diffMins < 60) duration = `${diffMins} min`;
                else duration = `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
            }

            const itemCount = eventsWithDetails.reduce((sum, event) => {
                if (event.is_weighted || event.unit === 'lb' || event.unit === 'oz') return sum + 1;
                return sum + (event.quantity || 1);
            }, 0);

            setTrip({
                ...tripData,
                events: eventsWithDetails,
                totalCost,
                itemCount,
                duration
            });

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const formatMoney = (amount: number) => amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

    // Helper to group events
    const groupByCategory = (events: TripEvent[]) => {
        const grouped: { [id: number]: TripEvent[] } = {};
        events.forEach(e => {
            if (!grouped[e.category_id]) grouped[e.category_id] = [];
            grouped[e.category_id].push(e);
        });
        return grouped;
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <LoadingSpinner message="Loading Trip..." />
        </div>
    );

    if (!trip) return (
        <div className="min-h-screen bg-gray-50 p-8 text-center pt-20">
            <h1 className="text-xl font-bold text-gray-800">Trip Not Found</h1>
            <Link href="/trips" className="text-blue-600 mt-4 block">Back to Trips</Link>
        </div>
    );

    const groupedEvents = groupByCategory(trip.events);
    const categoryIds = Object.keys(groupedEvents).map(Number).sort((a, b) => getCategoryName(a).localeCompare(getCategoryName(b)));

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <Header currentPage="Trip Details" />

            <main className="max-w-3xl mx-auto px-4 pt-6">
                {/* Back Link */}
                <Link href="/trips" className="inline-flex items-center text-gray-500 hover:text-gray-900 mb-6">
                    <ArrowLeftIcon className="w-4 h-4 mr-1" />
                    Back to History
                </Link>

                {/* Trip Card */}
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-8">
                    {/* Hero Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 md:p-8 text-white">
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-3xl font-bold mb-2">{trip.store}</h1>
                                <p className="opacity-90 font-medium flex items-center gap-2">
                                    <span className="bg-white/20 px-2 py-0.5 rounded text-sm">{formatDate(trip.started_at)}</span>
                                    <span>•</span>
                                    <span>{trip.duration}</span>
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-4xl font-bold">{formatMoney(trip.totalCost)}</p>
                                <p className="opacity-80 mt-1">{trip.itemCount} items</p>
                            </div>
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="p-0">
                        {categoryIds.map(catId => {
                            const catName = getCategoryName(catId);
                            const catEvents = groupedEvents[catId];
                            const catTotal = catEvents.reduce((s, e) => s + ((e.price || 0) * e.quantity), 0);
                            const catColor = getCategoryColorById(catId); // e.g. bg-red-100 text-red-800 border-red-200

                            return (
                                <div key={catId} className="border-b border-gray-100 last:border-0">
                                    {/* Category Header */}
                                    <div className={`px-6 py-3 flex justify-between items-center ${catColor} bg-opacity-15`}>
                                        <h3 className="font-bold text-sm uppercase tracking-wide opacity-80">{catName}</h3>
                                        <span className="font-bold text-sm opacity-80">{formatMoney(catTotal)}</span>
                                    </div>

                                    {/* Items */}
                                    <div className="divide-y divide-gray-50">
                                        {catEvents.map((event, idx) => (
                                            <div key={idx} className="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                                                <div>
                                                    <p className="font-semibold text-gray-900 text-lg">
                                                        {event.item_name}
                                                    </p>
                                                    {event.quantity > 1 && (
                                                        <p className="text-gray-500 text-sm">Qty: {event.quantity}</p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    {event.price ? (
                                                        <>
                                                            <p className="font-bold text-gray-900">{formatMoney(event.price * event.quantity)}</p>
                                                            {event.quantity > 1 && (
                                                                <p className="text-xs text-gray-400">{formatMoney(event.price)}/ea</p>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-300 italic text-sm">No price</span>
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
            </main>
        </div>
    );
}
