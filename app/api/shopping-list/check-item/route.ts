import { supabase } from '../../../lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

export async function POST(request: NextRequest) {
  try {
    const { shopping_list_id, store_id, last_trip_id } = await request.json();

    if (!shopping_list_id) {
      return NextResponse.json(
        { error: 'shopping_list_id is required' },
        { status: 400 }
      );
    }

    // 1. Get the shopping list item
    const { data: listItem, error: itemError } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('id', shopping_list_id)
      .single();

    if (itemError || !listItem) {
      return NextResponse.json(
        { error: 'Shopping list item not found' },
        { status: 404 }
      );
    }

    // 2. Update checked status immediately
    const { error: updateError } = await supabase
      .from('shopping_list')
      .update({ checked: true })
      .eq('id', shopping_list_id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update item' },
        { status: 500 }
      );
    }

    // 3. If no store provided, we're done (bought elsewhere or manual entry)
    if (!store_id) {
      return NextResponse.json({
        success: true,
        message: 'Item checked (no store tracking)'
      });
    }

    // 4. Get store name for denormalization in events
    const { data: store } = await supabase
      .from('stores')
      .select('name')
      .eq('id', store_id)
      .single();

    const storeName = store?.name || 'Unknown Store';

    // 5. Get current price for this item at this store
    const { data: priceData } = await supabase
      .from('price_history')
      .select('price')
      .eq('item_id', listItem.item_id)
      .eq('store_id', store_id)
      .eq('user_id', SHARED_USER_ID)
      .order('recorded_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentPrice = priceData ? parseFloat(priceData.price) : null;

    // 6. Find or create today's trip for this household + store
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    let { data: trip } = await supabase
      .from('trips')
      .select('*')
      .eq('household_code', listItem.household_code)
      .eq('store_id', store_id)
      .gte('started_at', `${today}T00:00:00`)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Create new trip OR RE-OPEN recent one if none actively running
    if (!trip) {
      // GRACE PERIOD: Check for a recently closed trip to re-open (within 30 mins)
      const GRACE_PERIOD_MS = 30 * 60 * 1000;
      const graceCutoff = new Date(Date.now() - GRACE_PERIOD_MS).toISOString();

      const { data: recentClosedTrip } = await supabase
        .from('trips')
        .select('*')
        .eq('household_code', listItem.household_code)
        .eq('store_id', store_id)
        .gte('started_at', `${today}T00:00:00`)
        .not('ended_at', 'is', null)
        .gt('ended_at', graceCutoff) // Closed recently
        .order('ended_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentClosedTrip) {
        console.log(`[TRIP RE-OPEN] Re-opening trip ${recentClosedTrip.id} (closed < 30m ago)`);

        const { data: reopenedTrip, error: reopenError } = await supabase
          .from('trips')
          .update({ ended_at: null }) // Re-open
          .eq('id', recentClosedTrip.id)
          .select()
          .single();

        if (!reopenError && reopenedTrip) {
          trip = reopenedTrip;
        }
      }

      // If still no trip (didn't re-open one), create a NEW one
      if (!trip) {
        const { data: newTrip, error: tripError } = await supabase
          .from('trips')
          .insert({
            household_code: listItem.household_code,
            store_id: store_id,
            store: storeName,
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (tripError) {
          console.error('Failed to create trip:', tripError);
          return NextResponse.json(
            { error: 'Failed to create trip' },
            { status: 500 }
          );
        }

        trip = newTrip;
      }
    }

    // 7. Create shopping_list_event WITH PRICE
    const { error: eventError } = await supabase
      .from('shopping_list_events')
      .insert({
        household_code: listItem.household_code,
        item_id: listItem.item_id,
        item_name: listItem.item_name,
        quantity: listItem.quantity || 1,
        store_id: store_id,
        store: storeName,
        trip_id: trip.id,
        checked_at: new Date().toISOString(),
        price: currentPrice, // STORE THE PRICE SNAPSHOT
      });

    if (eventError) {
      console.error('Failed to create event:', eventError);
      // Don't fail the request - item is already checked
    }

    // 7b. IMPLICIT PRICE CONFIRMATION
    // Logic: If we checked it off at this store, and we already know the price,
    // we confirm that price is still valid for today by inserting a fresh history record.
    if (currentPrice !== null) {
      const { error: historyError } = await supabase.from('price_history').insert({
        item_id: listItem.item_id,
        item_name: listItem.item_name,
        store_id: store_id,
        store: storeName,
        price: currentPrice,
        user_id: SHARED_USER_ID,
        household_code: listItem.household_code,
        recorded_date: today, // YYYY-MM-DD
        created_at: new Date().toISOString(), // Full timestamp
      });

      if (historyError) {
        console.error('Failed to update price history on check:', historyError);
      } else {
        console.log(`[PRICE CONFIRM] Confirmed price ${currentPrice} for ${listItem.item_name} at ${storeName}`);
      }
    }

    // 8. Check if ALL items for this store are now checked
    // NOTE: We no longer auto-close trips. Trips must be explicitly ended by the user.
    // This allows for "forgotten item" scenarios without fragmenting trips.

    let tripEnded = false;

    // The logic below is preserved but disabled/modified to just log status without closing

    // Get ALL unchecked items still on the shopping list for this household
    const { data: allUncheckedItems, error: uncheckedError } = await supabase
      .from('shopping_list')
      .select('item_id, item_name')
      .eq('household_code', listItem.household_code)
      .eq('user_id', SHARED_USER_ID)
      .eq('checked', false);

    if (uncheckedError) {
      console.error('Error checking remaining items:', uncheckedError);
    } else if (allUncheckedItems) {
      // Get all item_ids that have prices at this store
      const { data: storeItemPrices } = await supabase
        .from('price_history')
        .select('item_id')
        .eq('store_id', store_id)
        .eq('user_id', SHARED_USER_ID);

      if (storeItemPrices) {
        const storeItemIds = new Set(storeItemPrices.map(p => p.item_id));

        // Count unchecked items that belong to this store
        const uncheckedForThisStore = allUncheckedItems.filter(item =>
          storeItemIds.has(item.item_id)
        );

        console.log(`[TRIP CHECK] Store: ${storeName}, Unchecked items for this store: ${uncheckedForThisStore.length}`);

        // AUTO-CLOSE DISABLED
        // if (uncheckedForThisStore.length === 0) { ... }
      }
    }

    return NextResponse.json({
      success: true,
      trip_id: trip.id,
      trip_ended: false, // Always false now
      trip_created: trip.id !== last_trip_id
    });

  } catch (error) {
    console.error('Check item error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}