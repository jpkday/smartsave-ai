// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    console.log('[CLEANUP] Starting cleanup job at', new Date().toISOString());
    console.log('[CLEANUP] Looking for trips ended before', twoHoursAgo);

    // 1. Find trips ended more than 2 hours ago
    const { data: oldTrips, error: tripsError } = await supabase
      .from('trips')
      .select('id, household_code, store, ended_at')
      .not('ended_at', 'is', null)
      .lt('ended_at', twoHoursAgo);
    
    if (tripsError) {
      console.error('[CLEANUP] Error finding old trips:', tripsError);
      throw tripsError;
    }

    if (!oldTrips || oldTrips.length === 0) {
      console.log('[CLEANUP] No old trips found - nothing to clean');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No trips to clean',
          cleaned: 0 
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CLEANUP] Found ${oldTrips.length} old trips`);
    const oldTripIds = oldTrips.map(t => t.id);

    // 2. Get all checked items from shopping_list_events for these trips
    const { data: checkedEvents, error: eventsError } = await supabase
      .from('shopping_list_events')
      .select('item_name, household_code')
      .in('trip_id', oldTripIds)
      .not('checked_at', 'is', null);
    
    if (eventsError) {
      console.error('[CLEANUP] Error finding checked events:', eventsError);
      throw eventsError;
    }

    if (!checkedEvents || checkedEvents.length === 0) {
      console.log('[CLEANUP] No checked items found in old trips');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No items to clean',
          cleaned: 0 
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CLEANUP] Found ${checkedEvents.length} checked events to clean`);

    // 3. Delete checked items from shopping_list that match these events
    let totalDeleted = 0;
    const byHousehold: { [key: string]: number } = {};

    for (const event of checkedEvents) {
      const { data: deleted, error: deleteError } = await supabase
        .from('shopping_list')
        .delete()
        .eq('user_id', SHARED_USER_ID)
        .eq('household_code', event.household_code)
        .eq('item_name', event.item_name)
        .eq('checked', true)
        .select('id');
      
      if (deleteError) {
        console.error(`[CLEANUP] Error deleting ${event.item_name}:`, deleteError);
        continue;
      }

      if (deleted && deleted.length > 0) {
        totalDeleted += deleted.length;
        byHousehold[event.household_code] = (byHousehold[event.household_code] || 0) + deleted.length;
      }
    }

    console.log(`[CLEANUP] Successfully removed ${totalDeleted} checked items`);
    console.log('[CLEANUP] Items per household:', byHousehold);

    return new Response(
      JSON.stringify({ 
        success: true,
        trips_processed: oldTrips.length,
        items_cleaned: totalDeleted,
        by_household: byHousehold,
        timestamp: new Date().toISOString()
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CLEANUP] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});