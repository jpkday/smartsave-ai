import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { STOCK_UP_RULES, StockUpItem, stockUpRuleFor, stockUpStatus } from '../../../lib/stockUp';

// Bulk staples from the household's purchase history, with when each is due again.
// "Got it" marks (household_on_hand status "have") count as a restock.

const STATUS_ORDER = { due: 0, soon: 1, stocked: 2 } as const;

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
    const today = /^\d{4}-\d{2}-\d{2}$/.test(String(body.today || '')) ? String(body.today) : new Date().toISOString().slice(0, 10);
    if (!householdCode) return NextResponse.json({ error: 'household_code is required' }, { status: 400 });

    const { data: household } = await supabase.from('households').select('code').eq('code', householdCode).maybeSingle();
    if (!household) return NextResponse.json({ error: 'Unknown household' }, { status: 404 });

    const [{ data: events }, { data: marks }, { data: listRows }] = await Promise.all([
      supabase
        .from('shopping_list_events')
        .select('item_name, checked_at, store')
        .eq('household_code', householdCode)
        .not('item_name', 'is', null)
        .not('checked_at', 'is', null)
        .order('checked_at', { ascending: true })
        .limit(5000),
      supabase.from('household_on_hand').select('item_name, status, marked_at').eq('household_code', householdCode).eq('status', 'have'),
      supabase.from('shopping_list').select('item_name').eq('household_code', householdCode).eq('checked', false),
    ]);

    // Latest purchase per kind (events are oldest first, so later ones overwrite)
    const latest = new Map<string, { item_name: string; date: string; store: string | null }>();
    (events ?? []).forEach((e) => {
      const rule = stockUpRuleFor(e.item_name as string);
      if (rule) latest.set(rule.label, { item_name: e.item_name as string, date: (e.checked_at as string).slice(0, 10), store: (e.store as string) ?? null });
    });
    // "Got it" counts as a restock when it's newer than the last logged purchase
    (marks ?? []).forEach((m) => {
      const rule = stockUpRuleFor(m.item_name as string);
      const current = rule ? latest.get(rule.label) : undefined;
      const day = (m.marked_at as string).slice(0, 10);
      if (rule && current && day > current.date) latest.set(rule.label, { ...current, date: day, store: null });
    });

    const onList = (listRows ?? []).map((r) => r.item_name as string);
    const items: StockUpItem[] = STOCK_UP_RULES.filter((r) => latest.has(r.label)).map((rule) => {
      const last = latest.get(rule.label)!;
      const daysSince = Math.floor((Date.parse(today) - Date.parse(last.date)) / 86400000);
      return {
        label: rule.label,
        item_name: last.item_name,
        last_date: last.date,
        store: last.store,
        days: rule.days,
        status: stockUpStatus(daysSince, rule.days),
        on_list: onList.some((n) => rule.match.test(n)),
      };
    });
    items.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.last_date.localeCompare(b.last_date));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error building stock-up list:', error);
    return NextResponse.json({ error: 'Could not load stock-up items' }, { status: 500 });
  }
}
