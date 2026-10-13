import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Records that the household has ("have") or needs ("need") an item, overriding the
// guess from recent purchases. Shared by everyone using the household code.

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    if (!supabase) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });

    const body = await request.json();
    const householdCode = String(body.household_code || '').toUpperCase();
    const itemName = String(body.item_name || '').trim().slice(0, 120);
    const status = body.status === 'have' || body.status === 'need' ? body.status : null;
    if (!householdCode || !itemName || !status) {
      return NextResponse.json({ error: 'household_code, item_name and status are required' }, { status: 400 });
    }
    const { data: household } = await supabase.from('households').select('code').eq('code', householdCode).maybeSingle();
    if (!household) return NextResponse.json({ error: 'Unknown household' }, { status: 404 });

    const { error } = await supabase.from('household_on_hand').upsert(
      { household_code: householdCode, item_key: itemName.toLowerCase(), item_name: itemName, status, marked_at: new Date().toISOString() },
      { onConflict: 'household_code,item_key' }
    );
    if (error) return NextResponse.json({ error: 'Could not save' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving on-hand item:', error);
    return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  }
}
