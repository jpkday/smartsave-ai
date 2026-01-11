import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

export async function POST(request: Request) {
  try {
    const { householdCode, preferences } = await request.json();

    if (!householdCode || !preferences) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

    // Get items
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, name')
      .eq('user_id', SHARED_USER_ID);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const itemNameToId: Record<string, number> = {};
    items?.forEach(i => itemNameToId[i.name] = i.id);

    // Build records
    const records = [];
    const notFound = [];
    for (const [itemName, preferredStore] of Object.entries(preferences)) {
      const itemId = itemNameToId[itemName];
      if (itemId) {
        records.push({
          household_code: householdCode,
          item_id: itemId,
          preferred_store: preferredStore as string
        });
      } else {
        notFound.push(itemName);
      }
    }

    if (records.length === 0) {
      return NextResponse.json({ 
        success: true, 
        migrated: 0,
        message: 'No valid preferences to migrate',
        notFound
      });
    }

    // Insert
    const { error } = await supabase
      .from('household_item_store_preferences')
      .upsert(records);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      migrated: records.length,
      notFound
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}