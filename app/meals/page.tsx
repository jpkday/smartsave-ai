'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import StatusModal from '../components/StatusModal';
import { supabase } from '../lib/supabase';
import { useHouseholdCode } from '../hooks/useHouseholdCode';
import { useStatusModal } from '../hooks/useStatusModal';
import { addDays, mealKey, MealSuggestion, SuggestionIngredient, NoteImport, MealIngredients, startOfWeek, toDateStr, weekDates } from '../lib/meals';

interface Idea {
  id: string;
  name: string;
}

interface ReviewItem {
  name: string;
  checked: boolean;
  onList: boolean;
  // Date it was last bought, when recent enough that it's probably at home
  have?: string;
}

interface Suggestion extends MealSuggestion {
  id: string;
  selected: boolean;
  // Meal name the ingredient list was made for; differs after a rename until updated
  ingredientsFor: string;
  newIngredient: string;
  updating: boolean;
}

const toSuggestion = (x: MealSuggestion & Partial<Suggestion>, i: number): Suggestion => ({
  ...x,
  id: x.id || `${Date.now()}-${i}`,
  selected: false,
  ingredientsFor: x.ingredientsFor || x.meal,
  newIngredient: '',
  updating: false,
});

interface ReviewMeal {
  meal: string;
  dayLabel: string;
  source: MealIngredients['source'];
  items: ReviewItem[];
  newItem: string;
}

const ADD_ITEMS_CHUNK = 30;
const SUGGESTION_CACHE_PREFIX = 'meal-suggestions';
// Suggestions visible before "Show more"
const SUGGESTIONS_SHOWN = 3;
const SAVE_DELAY_MS = 700;

const dayName = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short' });
// Compact display name: drop size notes and keep the first two parts
// ("Vinegar, Rice, Mizkan, Mild and Mellow (12 fl oz)" → "Vinegar, Rice")
const shortName = (name: string) =>
  name.replace(/\s*\([^)]*\)?/g, '').split(',').map((p) => p.trim()).filter(Boolean).slice(0, 2).join(', ') || name;
const boughtLabel = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const rangeLabel = (start: Date) => {
  const end = addDays(start, 6);
  const fmt = (d: Date, withMonth: boolean) =>
    d.toLocaleDateString(undefined, withMonth ? { month: 'short', day: 'numeric' } : { day: 'numeric' });
  return `${fmt(start, true)} – ${fmt(end, end.getMonth() !== start.getMonth())}`;
};

// Adds grocery names to the household list through the shared add-items endpoint
async function addNamesToList(householdCode: string, names: string[]) {
  const totals = { added: 0, skipped: 0 };
  for (let i = 0; i < names.length; i += ADD_ITEMS_CHUNK) {
    const res = await fetch('/api/shopping-list/add-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ household_code: householdCode, items: names.slice(i, i + ADD_ITEMS_CHUNK).map((name) => ({ name })) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Could not add items');
    totals.added += data.added?.length ?? 0;
    totals.skipped += data.skipped?.length ?? 0;
  }
  return totals;
}

export default function MealsPage() {
  const { householdCode, loading: householdLoading } = useHouseholdCode();
  const { modal: statusModal, show: showStatus, close: closeStatus } = useStatusModal();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [days, setDays] = useState<Record<string, string>>({});
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [newIdea, setNewIdea] = useState('');
  const [loading, setLoading] = useState(true);

  const [review, setReview] = useState<ReviewMeal[] | null>(null);
  const [building, setBuilding] = useState(false);
  const [adding, setAdding] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<NoteImport | null>(null);
  const [applyingImport, setApplyingImport] = useState(false);

  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const dates = weekDates(weekStart);
  const dateStrs = dates.map(toDateStr);
  const todayStr = toDateStr(new Date());
  const thisWeekStr = toDateStr(startOfWeek(new Date()));
  const weekStr = toDateStr(weekStart);
  const plannedMeals = dateStrs.map((d) => (days[d] || '').trim()).filter(Boolean);
  const plannedMealsRef = useRef<string[]>([]);
  plannedMealsRef.current = plannedMeals;

  const weekTitle =
    weekStr === thisWeekStr ? 'This week'
      : weekStr === toDateStr(addDays(startOfWeek(new Date()), 7)) ? 'Next week'
        : weekStr === toDateStr(addDays(startOfWeek(new Date()), -7)) ? 'Last week'
          : 'Week of';

  const loadWeek = useCallback(async () => {
    if (!householdCode) return;
    const start = toDateStr(weekStart);
    const end = toDateStr(addDays(weekStart, 6));
    const [{ data: dayRows }, { data: ideaRows }] = await Promise.all([
      supabase
        .from('meal_plan_days')
        .select('plan_date, meal')
        .eq('household_code', householdCode)
        .gte('plan_date', start)
        .lte('plan_date', end),
      supabase
        .from('meal_ideas')
        .select('id, name')
        .eq('household_code', householdCode)
        .order('created_at', { ascending: true }),
    ]);
    const next: Record<string, string> = {};
    (dayRows ?? []).forEach((r) => { next[r.plan_date] = r.meal; });
    setDays(next);
    setIdeas(ideaRows ?? []);
    setLoading(false);
  }, [householdCode, weekStart]);

  useEffect(() => {
    if (householdLoading) return;
    if (!householdCode) { setLoading(false); return; }
    setLoading(true);
    loadWeek();
  }, [householdCode, householdLoading, loadWeek]);

  // Pick up the other person's edits when coming back to the app, unless mid-edit here
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (Object.keys(saveTimers.current).length > 0) return;
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
      loadWeek();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [loadWeek]);

  const saveDay = async (date: string, value: string) => {
    if (!householdCode) return;
    const meal = value.trim();
    const { error } = meal
      ? await supabase
        .from('meal_plan_days')
        .upsert({ household_code: householdCode, plan_date: date, meal, updated_at: new Date().toISOString() }, { onConflict: 'household_code,plan_date' })
      : await supabase.from('meal_plan_days').delete().eq('household_code', householdCode).eq('plan_date', date);
    if (error) {
      console.error('Error saving meal:', error);
      showStatus('Not saved', 'That meal could not be saved. Check your connection and try again.', 'error');
    }
  };

  const flushSave = (date: string, value: string) => {
    clearTimeout(saveTimers.current[date]);
    delete saveTimers.current[date];
    saveDay(date, value);
  };

  const setDay = (date: string, value: string) => {
    setDays((prev) => ({ ...prev, [date]: value }));
    clearTimeout(saveTimers.current[date]);
    saveTimers.current[date] = setTimeout(() => flushSave(date, value), SAVE_DELAY_MS);
  };

  const addIdea = async () => {
    const name = newIdea.trim();
    if (!name || !householdCode) return;
    if (ideas.some((i) => mealKey(i.name) === mealKey(name))) { setNewIdea(''); return; }
    const { data, error } = await supabase
      .from('meal_ideas')
      .insert({ household_code: householdCode, name })
      .select('id, name')
      .single();
    if (error || !data) {
      showStatus('Not saved', 'That idea could not be saved. Please try again.', 'error');
      return;
    }
    setIdeas((prev) => [...prev, data]);
    setNewIdea('');
  };

  const removeIdea = async (id: string) => {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    await supabase.from('meal_ideas').delete().eq('id', id);
  };

  // Tapping an idea drops it into the first open day of the week shown
  const placeIdea = (idea: Idea) => {
    const open = dateStrs.find((d) => !(days[d] || '').trim());
    if (!open) {
      showStatus('Week is full', 'Clear a day first, then tap the idea again.', 'info');
      return;
    }
    setDays((prev) => ({ ...prev, [open]: idea.name }));
    saveDay(open, idea.name);
  };

  const buildList = async () => {
    if (!householdCode || plannedMeals.length === 0) return;
    // Save anything still waiting so the plan matches what's built
    Object.keys(saveTimers.current).forEach((d) => flushSave(d, days[d] || ''));
    setBuilding(true);
    try {
      const res = await fetch('/api/meals/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ household_code: householdCode, meals: plannedMeals }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not build ingredients');

      const onList = new Set<string>((data.on_list ?? []).map((n: string) => n.toLowerCase()));
      const recent = new Map<string, string>(
        (data.recently_bought ?? []).map((r: { name: string; date: string }) => [r.name.toLowerCase(), r.date])
      );
      const byKey = new Map<string, MealIngredients>((data.meals ?? []).map((m: MealIngredients) => [mealKey(m.meal), m]));
      const seen = new Set<string>();
      const meals: ReviewMeal[] = [];
      dates.forEach((d) => {
        const meal = (days[toDateStr(d)] || '').trim();
        if (!meal || seen.has(mealKey(meal))) return;
        seen.add(mealKey(meal));
        const result = byKey.get(mealKey(meal));
        meals.push({
          meal,
          dayLabel: dayName(d),
          source: result?.source ?? 'none',
          items: (result?.ingredients ?? []).map((name) => {
            const isOnList = onList.has(name.toLowerCase());
            const have = isOnList ? undefined : recent.get(name.toLowerCase());
            // Probably at home or already on the list: start unchecked
            return { name, onList: isOnList, have, checked: !isOnList && !have };
          }),
          newItem: '',
        });
      });
      setReview(meals);
    } catch (err) {
      showStatus('Could not build list', err instanceof Error ? err.message : 'Please try again.', 'error');
    } finally {
      setBuilding(false);
    }
  };

  const updateReviewMeal = (index: number, update: (m: ReviewMeal) => ReviewMeal) => {
    setReview((prev) => prev && prev.map((m, i) => (i === index ? update(m) : m)));
  };

  const confirmReview = async () => {
    if (!review || !householdCode) return;
    setAdding(true);
    try {
      // Remember each meal's ingredients (checked or not) for next time
      for (const m of review) {
        const key = mealKey(m.meal);
        await supabase.from('meal_ingredients').delete().eq('household_code', householdCode).eq('meal_key', key);
        if (m.items.length > 0) {
          await supabase.from('meal_ingredients').insert(
            m.items.map((item, i) => ({ household_code: householdCode, meal_key: key, item_name: item.name, sort_order: i }))
          );
        }
      }

      const toAdd = [...new Map(
        review.flatMap((m) => m.items.filter((i) => i.checked && !i.onList).map((i) => [i.name.toLowerCase(), i.name] as const))
      ).values()];
      const totals = toAdd.length > 0 ? await addNamesToList(householdCode, toAdd) : { added: 0, skipped: 0 };
      setReview(null);
      showStatus(
        totals.added > 0 ? 'Added to your list' : 'List is up to date',
        totals.added > 0
          ? `${totals.added} ${totals.added === 1 ? 'item' : 'items'} added${totals.skipped ? `, ${totals.skipped} already on the list` : ''}. Ingredients are saved for next time.`
          : 'Everything for these meals is already on your list.',
        'success'
      );
    } catch (err) {
      showStatus('Could not add items', err instanceof Error ? err.message : 'Please try again.', 'error');
    } finally {
      setAdding(false);
    }
  };

  const readNote = async () => {
    if (!householdCode || !importText.trim()) return;
    setImporting(true);
    try {
      const res = await fetch('/api/meals/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ household_code: householdCode, text: importText, week_start: weekStr, today: todayStr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not read that note');
      setImportResult(data);
    } catch (err) {
      showStatus('Could not read note', err instanceof Error ? err.message : 'Please try again.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const applyImport = async () => {
    if (!importResult || !householdCode) return;
    setApplyingImport(true);
    try {
      for (const d of importResult.days) {
        await saveDay(d.date, d.meal);
      }
      const existing = new Set(ideas.map((i) => mealKey(i.name)));
      const freshIdeas = importResult.ideas.filter((n) => !existing.has(mealKey(n)));
      if (freshIdeas.length > 0) {
        await supabase.from('meal_ideas').insert(freshIdeas.map((name) => ({ household_code: householdCode, name })));
      }
      const totals = importResult.grocery_items.length > 0
        ? await addNamesToList(householdCode, importResult.grocery_items)
        : { added: 0, skipped: 0 };

      setImportOpen(false);
      setImportText('');
      setImportResult(null);
      await loadWeek();
      showStatus(
        'Note imported',
        [
          importResult.days.length && `${importResult.days.length} ${importResult.days.length === 1 ? 'dinner' : 'dinners'} planned`,
          freshIdeas.length && `${freshIdeas.length} ${freshIdeas.length === 1 ? 'idea' : 'ideas'} saved`,
          totals.added && `${totals.added} ${totals.added === 1 ? 'item' : 'items'} added to your list`,
        ].filter(Boolean).join(', ') + '.',
        'success'
      );
    } catch (err) {
      showStatus('Import failed', err instanceof Error ? err.message : 'Please try again.', 'error');
    } finally {
      setApplyingImport(false);
    }
  };

  const suggestionCacheKey = householdCode ? `${SUGGESTION_CACHE_PREFIX}:${householdCode}:${weekStr}` : '';
  const cacheSuggestions = (list: Suggestion[]) => {
    try { sessionStorage.setItem(suggestionCacheKey, JSON.stringify(list.map((x) => ({ ...x, selected: false })))); } catch { /* storage unavailable */ }
  };

  const fetchSuggestions = useCallback(async (force = false) => {
    if (!householdCode) return;
    const cacheKey = `${SUGGESTION_CACHE_PREFIX}:${householdCode}:${weekStr}`;
    if (!force) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) { setSuggestions(JSON.parse(cached).map(toSuggestion)); return; }
      } catch { /* storage unavailable */ }
    }
    setSuggesting(true);
    setSuggestError('');
    try {
      const res = await fetch('/api/meals/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ household_code: householdCode, exclude: plannedMealsRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not suggest dinners');
      const list: Suggestion[] = (data.suggestions ?? []).map(toSuggestion);
      setSuggestions(list);
      try { sessionStorage.setItem(cacheKey, JSON.stringify(list)); } catch { /* storage unavailable */ }
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : 'Could not suggest dinners right now.');
    } finally {
      setSuggesting(false);
    }
  }, [householdCode, weekStr]);

  // Suggest dinners automatically once the week has loaded
  useEffect(() => {
    if (loading || !householdCode) return;
    setSuggestions(null);
    fetchSuggestions();
  }, [loading, householdCode, weekStr, fetchSuggestions]);

  const updateSuggestion = (id: string, update: (x: Suggestion) => Suggestion) => {
    setSuggestions((prev) => {
      if (!prev) return prev;
      const next = prev.map((x) => (x.id === id ? update(x) : x));
      cacheSuggestions(next);
      return next;
    });
  };

  // After a rename ("Turkey tacos" → "Beef tacos"), rebuild the ingredient list for the new name
  const refreshSuggestionIngredients = async (sug: Suggestion) => {
    if (!householdCode || !sug.meal.trim()) return;
    updateSuggestion(sug.id, (x) => ({ ...x, updating: true }));
    try {
      const res = await fetch('/api/meals/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ household_code: householdCode, meals: [sug.meal.trim()] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not update ingredients');
      const onList = new Set<string>((data.on_list ?? []).map((n: string) => n.toLowerCase()));
      const recent = new Map<string, string>(
        (data.recently_bought ?? []).map((r: { name: string; date: string }) => [r.name.toLowerCase(), r.date])
      );
      const names: string[] = data.meals?.[0]?.ingredients ?? [];
      const ingredients: SuggestionIngredient[] = names.map((name) => {
        if (onList.has(name.toLowerCase())) return { name, status: 'list' };
        const bought = recent.get(name.toLowerCase());
        return bought ? { name, status: 'have', bought } : { name, status: 'buy' };
      });
      // The original reason (e.g. "Uses the ground turkey") no longer applies after a rename
      updateSuggestion(sug.id, (x) => ({ ...x, ingredients, ingredientsFor: sug.meal.trim(), reason: '', updating: false }));
    } catch (err) {
      updateSuggestion(sug.id, (x) => ({ ...x, updating: false }));
      showStatus('Could not update ingredients', err instanceof Error ? err.message : 'Please try again, or edit the list by hand.', 'error');
    }
  };

  // Puts the picked suggestions on the week's open days (from today on) and saves
  // their ingredients so Build shopping list is instant for them
  const addSuggestionsToWeek = async (only?: Suggestion) => {
    if (!suggestions || !householdCode) return;
    const picked = (only ? [only] : suggestions.filter((x) => x.selected))
      .map((x) => ({ ...x, meal: x.meal.trim() }))
      .filter((x) => x.meal);
    const open = dateStrs.filter((d) => d >= todayStr && !(days[d] || '').trim());
    if (open.length === 0) {
      showStatus('No open days', 'Every day left this week has a dinner. Clear one or switch to next week.', 'info');
      return;
    }
    const placed = picked.slice(0, open.length);
    setPlacing(true);
    try {
      const updates: Record<string, string> = {};
      for (let i = 0; i < placed.length; i++) {
        updates[open[i]] = placed[i].meal;
        await saveDay(open[i], placed[i].meal);
        const key = mealKey(placed[i].meal);
        await supabase.from('meal_ingredients').delete().eq('household_code', householdCode).eq('meal_key', key);
        await supabase.from('meal_ingredients').insert(
          placed[i].ingredients.map((ing, order) => ({ household_code: householdCode, meal_key: key, item_name: ing.name, sort_order: order }))
        );
      }
      setDays((prev) => ({ ...prev, ...updates }));
      const placedIds = new Set(placed.map((x) => x.id));
      const remaining = suggestions.filter((x) => !placedIds.has(x.id));
      setSuggestions(remaining);
      cacheSuggestions(remaining);
      if (picked.length > placed.length) {
        showStatus('Week is full', `Added ${placed.length}. There ${open.length === 1 ? 'was' : 'were'} only ${open.length} open ${open.length === 1 ? 'day' : 'days'} left.`, 'info');
      }
    } catch {
      showStatus('Not saved', 'Those dinners could not be added. Please try again.', 'error');
    } finally {
      setPlacing(false);
    }
  };

  const selectedCount = suggestions ? suggestions.filter((x) => x.selected).length : 0;

  const reviewCount = review ? new Set(review.flatMap((m) => m.items.filter((i) => i.checked && !i.onList).map((i) => i.name.toLowerCase()))).size : 0;

  return (
    <div className="min-h-screen app-bg pb-32 md:pb-12">
      <div className="sticky top-0 z-50 app-header w-full">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="hidden md:flex items-center gap-2">
              <Link href="/" className="text-xl font-bold text-bb-cream hover:text-bb-gold transition flex items-center gap-2">
                <span className="text-2xl">ᯓ</span>
                <span className="hidden sm:inline">SmartSaveAI</span>
              </Link>
            </div>
            <div className="w-full">
              <Header currentPage="Meal Plan" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-6">
        {!householdLoading && !householdCode ? (
          <div className="bg-bb-panel border border-bb-line rounded-2xl p-8 text-center">
            <p className="text-bb-cream font-semibold mb-2">Sign in to plan meals</p>
            <p className="text-bb-muted text-sm mb-5">Enter your household&apos;s beta code on the home page.</p>
            <Link href="/" className="inline-flex bg-bb-gold text-bb-navy px-5 py-2.5 rounded-xl font-semibold hover:brightness-110 transition">Go home</Link>
          </div>
        ) : (
          <div className="md:grid md:grid-cols-3 md:gap-6 md:items-start">
            <div className="md:col-span-2 space-y-4">
            {/* Suggested dinners */}
            <div className="bg-bb-panel border border-bb-line rounded-2xl">
              <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 md:px-5 border-b border-bb-line">
                <div>
                  <h2 className="text-base font-semibold text-bb-cream">Suggested dinners</h2>
                  <p className="text-xs text-bb-muted mt-0.5">Built around what you bought recently. Tap one to open and change it, or tick a few and add them to the week.</p>
                </div>
                <button
                  onClick={() => fetchSuggestions(true)}
                  disabled={suggesting}
                  className="flex-none w-9 h-9 flex items-center justify-center rounded-lg border border-bb-line text-bb-muted hover:text-bb-cream hover:bg-white/5 disabled:opacity-40 cursor-pointer"
                  aria-label="New suggestions"
                  title="New suggestions"
                >
                  <svg className={`w-4 h-4 ${suggesting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>

              {suggesting && !suggestions?.length ? (
                <div className="px-4 md:px-5 py-6 space-y-3">
                  <p className="text-sm text-bb-muted">Finding dinners that use what you have…</p>
                  {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-white/[0.03] animate-pulse" />)}
                </div>
              ) : suggestError ? (
                <div className="px-4 md:px-5 py-6 text-center">
                  <p className="text-sm text-bb-muted mb-3">{suggestError}</p>
                  <button onClick={() => fetchSuggestions(true)} className="px-4 py-2 rounded-xl border border-bb-line text-bb-cream text-sm font-semibold hover:bg-white/5 cursor-pointer">Try again</button>
                </div>
              ) : suggestions && suggestions.length === 0 ? (
                <p className="px-4 md:px-5 py-6 text-sm text-bb-muted">No more suggestions for this week. Tap refresh for new ones.</p>
              ) : (
                <div className="divide-y divide-bb-line">
                  {(suggestions ?? []).slice(0, showAllSuggestions ? undefined : SUGGESTIONS_SHOWN).map((sug) => {
                    const have = sug.ingredients.filter((i) => i.status === 'have');
                    const buy = sug.ingredients.filter((i) => i.status !== 'have');
                    const toBuy = sug.ingredients.filter((i) => i.status === 'buy').length;
                    const expanded = expandedSuggestion === sug.id;
                    const renamed = mealKey(sug.meal) !== mealKey(sug.ingredientsFor);
                    return (
                      <div key={sug.id} className={`transition-colors ${sug.selected ? 'bg-bb-gold/[0.07]' : expanded ? 'bg-white/[0.02]' : ''}`}>
                        <div className="flex gap-1 pl-2 pr-4 md:pl-3 md:pr-5">
                          <button
                            onClick={() => updateSuggestion(sug.id, (x) => ({ ...x, selected: !x.selected }))}
                            aria-pressed={sug.selected}
                            aria-label={sug.selected ? `Unpick ${sug.meal}` : `Pick ${sug.meal}`}
                            className="flex-none w-10 pt-3.5 flex justify-center cursor-pointer"
                          >
                            <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${sug.selected ? 'bg-bb-gold border-bb-gold text-bb-navy' : 'border-slate-500'}`}>
                              {sug.selected && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </span>
                          </button>
                          <button
                            onClick={() => setExpandedSuggestion(expanded ? null : sug.id)}
                            aria-expanded={expanded}
                            className="flex-1 min-w-0 text-left py-3.5 cursor-pointer"
                          >
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="text-[15px] text-bb-cream leading-snug">{sug.meal || 'Untitled dinner'}</span>
                              <span className={`text-[11px] flex-none ${toBuy === 0 ? 'text-bb-green' : 'text-bb-muted'}`}>
                                {toBuy === 0 ? 'Nothing to buy' : `${toBuy} to buy`}
                              </span>
                            </span>
                            {sug.reason && !renamed && <span className="block text-xs text-bb-muted mt-0.5">{sug.reason}</span>}
                            {!expanded && have.length > 0 && (
                              <span className="flex gap-1.5 mt-2 text-xs">
                                <span className="flex-none w-12 text-bb-green">✓ Have</span>
                                <span className="text-bb-muted">{have.map((i) => shortName(i.name)).join(' · ')}</span>
                              </span>
                            )}
                            {!expanded && buy.length > 0 && (
                              <span className="flex gap-1.5 mt-1 text-xs">
                                <span className="flex-none w-12 text-bb-gold">+ Buy</span>
                                <span className="text-bb-cream">
                                  {buy.map((i) => shortName(i.name) + (i.status === 'list' ? ' (on list)' : '')).join(' · ')}
                                </span>
                              </span>
                            )}
                          </button>
                        </div>

                        {expanded && (
                          <div className="pl-12 pr-4 md:pl-[3.25rem] md:pr-5 pb-4 space-y-3">
                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-wider text-bb-muted mb-1">Dinner</label>
                              <input
                                value={sug.meal}
                                onChange={(e) => updateSuggestion(sug.id, (x) => ({ ...x, meal: e.target.value }))}
                                maxLength={120}
                                className="w-full bg-bb-raised border border-bb-line rounded-xl px-3 py-2.5 text-[16px] md:text-sm text-bb-cream focus:outline-none focus:ring-2 focus:ring-bb-gold/50"
                              />
                              {renamed && sug.meal.trim() && (
                                <button
                                  onClick={() => refreshSuggestionIngredients(sug)}
                                  disabled={sug.updating}
                                  className="mt-2 w-full rounded-xl border border-bb-gold/40 text-bb-gold text-sm font-semibold py-2 hover:bg-bb-gold/10 disabled:opacity-50 cursor-pointer"
                                >
                                  {sug.updating ? 'Updating ingredients…' : `Update ingredients for “${sug.meal.trim()}”`}
                                </button>
                              )}
                            </div>

                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-wider text-bb-muted mb-1">Ingredients · tap Have/Buy to switch</div>
                              <div className="divide-y divide-bb-line">
                                {sug.ingredients.map((ing, ii) => (
                                  <div key={`${ing.name}-${ii}`} className="flex items-center gap-2 py-1.5">
                                    {ing.status === 'list' ? (
                                      <span className="w-16 flex-none text-center text-[10px] font-semibold uppercase tracking-wider text-bb-muted">On list</span>
                                    ) : (
                                      <button
                                        onClick={() => updateSuggestion(sug.id, (x) => ({
                                          ...x,
                                          ingredients: x.ingredients.map((y, yi) => (yi === ii ? { ...y, status: y.status === 'have' ? 'buy' : 'have' } : y)),
                                        }))}
                                        className={`w-16 flex-none rounded-full border py-1 text-[10px] font-semibold uppercase tracking-wider cursor-pointer ${ing.status === 'have'
                                          ? 'border-bb-green/30 bg-bb-green/10 text-bb-green'
                                          : 'border-bb-gold/30 bg-bb-gold/10 text-bb-gold'}`}
                                      >
                                        {ing.status === 'have' ? 'Have' : 'Buy'}
                                      </button>
                                    )}
                                    <span className={`flex-1 min-w-0 text-sm ${ing.status === 'have' ? 'text-bb-muted' : 'text-bb-cream'}`}>{shortName(ing.name)}</span>
                                    <button
                                      onClick={() => updateSuggestion(sug.id, (x) => ({ ...x, ingredients: x.ingredients.filter((_, yi) => yi !== ii) }))}
                                      className="text-slate-500 hover:text-bb-red text-lg leading-none px-1 cursor-pointer"
                                      aria-label={`Remove ${ing.name}`}
                                    >×</button>
                                  </div>
                                ))}
                              </div>
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const name = sug.newIngredient.trim();
                                  if (!name) return;
                                  updateSuggestion(sug.id, (x) => ({ ...x, newIngredient: '', ingredients: [...x.ingredients, { name, status: 'buy' }] }));
                                }}
                              >
                                <input
                                  value={sug.newIngredient}
                                  onChange={(e) => updateSuggestion(sug.id, (x) => ({ ...x, newIngredient: e.target.value }))}
                                  placeholder="+ Add ingredient"
                                  className="w-full bg-transparent py-2 text-[16px] md:text-sm text-bb-cream placeholder:text-slate-500 focus:outline-none border-b border-transparent focus:border-bb-line"
                                />
                              </form>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => addSuggestionsToWeek(sug)}
                                disabled={placing || !sug.meal.trim() || sug.updating}
                                className="flex-1 bg-bb-gold text-bb-navy rounded-xl py-2.5 text-sm font-bold hover:brightness-110 disabled:opacity-50 cursor-pointer"
                              >
                                Add to week
                              </button>
                              <button
                                onClick={() => setExpandedSuggestion(null)}
                                className="px-4 rounded-xl border border-bb-line text-bb-cream text-sm font-semibold hover:bg-white/5 cursor-pointer"
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(suggestions?.length ?? 0) > SUGGESTIONS_SHOWN && (
                    <button
                      onClick={() => setShowAllSuggestions(!showAllSuggestions)}
                      className="w-full px-4 py-2.5 text-sm font-medium text-bb-gold hover:bg-white/[0.03] cursor-pointer"
                    >
                      {showAllSuggestions ? 'Show fewer' : `Show ${(suggestions?.length ?? 0) - SUGGESTIONS_SHOWN} more`}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Week */}
            <div className="bg-bb-panel border border-bb-line rounded-2xl">
              <div className="flex items-center justify-between gap-3 px-4 py-4 md:px-5 border-b border-bb-line">
                <button
                  onClick={() => setWeekStart((w) => addDays(w, -7))}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-bb-line text-bb-muted hover:text-bb-cream hover:bg-white/5 cursor-pointer"
                  aria-label="Previous week"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="text-center">
                  <div className="text-xs font-medium uppercase tracking-wider text-bb-muted">{weekTitle}</div>
                  <div className="font-serif text-2xl text-bb-cream">{rangeLabel(weekStart)}</div>
                </div>
                <button
                  onClick={() => setWeekStart((w) => addDays(w, 7))}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-bb-line text-bb-muted hover:text-bb-cream hover:bg-white/5 cursor-pointer"
                  aria-label="Next week"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              <div className="divide-y divide-bb-line">
                {dates.map((d) => {
                  const ds = toDateStr(d);
                  const isToday = ds === todayStr;
                  return (
                    <label key={ds} className="flex items-center gap-4 px-4 md:px-5 py-1 cursor-text">
                      <div className={`w-11 flex-none ${isToday ? 'text-bb-gold' : 'text-bb-muted'}`}>
                        <div className="text-xs font-semibold uppercase tracking-wider">{dayName(d)}</div>
                        <div className="text-[11px]">{isToday ? 'Today' : d.getDate()}</div>
                      </div>
                      <input
                        type="text"
                        value={days[ds] || ''}
                        onChange={(e) => setDay(ds, e.target.value)}
                        onBlur={(e) => saveTimers.current[ds] && flushSave(ds, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        placeholder={loading ? '' : 'Add dinner'}
                        maxLength={120}
                        className="flex-1 min-w-0 bg-transparent py-3 text-[16px] text-bb-cream placeholder:text-slate-600 focus:outline-none"
                      />
                    </label>
                  );
                })}
              </div>

              {/* Primary action: sticky on phones so it's always in reach */}
              <div className="fixed md:static bottom-0 inset-x-0 z-40 p-4 md:px-5 md:pb-5 md:pt-4 bg-bb-navy/90 md:bg-transparent backdrop-blur md:backdrop-blur-none border-t border-bb-line md:border-t-0">
                {selectedCount > 0 ? (
                  <button
                    onClick={() => addSuggestionsToWeek()}
                    disabled={placing}
                    className="w-full bg-bb-gold text-bb-navy rounded-2xl px-5 py-4 text-lg font-bold hover:brightness-110 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    {placing ? 'Adding…' : `Add ${selectedCount} ${selectedCount === 1 ? 'dinner' : 'dinners'} to the week`}
                  </button>
                ) : (
                <button
                  onClick={buildList}
                  disabled={building || plannedMeals.length === 0}
                  className="w-full bg-bb-gold text-bb-navy rounded-2xl px-5 py-4 text-lg font-bold hover:brightness-110 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  {building
                    ? 'Finding ingredients…'
                    : plannedMeals.length === 0
                      ? 'Add dinners to build your list'
                      : `Build shopping list · ${plannedMeals.length} ${plannedMeals.length === 1 ? 'dinner' : 'dinners'}`}
                </button>
                )}
              </div>
            </div>

            </div>

            {/* Ideas + import */}
            <div className="space-y-4 mt-4 md:mt-0">
              <div className="bg-bb-panel border border-bb-line rounded-2xl p-4 md:p-5">
                <h2 className="text-sm font-semibold text-bb-cream">Meal ideas</h2>
                <p className="text-xs text-bb-muted mt-0.5 mb-3">Tap one to drop it into the next open day.</p>
                <div className="flex flex-wrap gap-2">
                  {ideas.map((idea) => (
                    <span key={idea.id} className="inline-flex items-center rounded-full border border-bb-line bg-white/[0.03] text-sm text-bb-cream">
                      <button onClick={() => placeIdea(idea)} className="pl-3 pr-1.5 py-1.5 hover:text-bb-gold cursor-pointer">{idea.name}</button>
                      <button onClick={() => removeIdea(idea.id)} className="pr-2.5 pl-1 py-1.5 text-slate-500 hover:text-bb-red cursor-pointer" aria-label={`Remove ${idea.name}`}>×</button>
                    </span>
                  ))}
                  {ideas.length === 0 && !loading && <span className="text-xs text-slate-500">No ideas yet.</span>}
                </div>
                <form
                  onSubmit={(e) => { e.preventDefault(); addIdea(); }}
                  className="mt-3 flex gap-2"
                >
                  <input
                    value={newIdea}
                    onChange={(e) => setNewIdea(e.target.value)}
                    placeholder="Add an idea"
                    maxLength={120}
                    className="flex-1 min-w-0 bg-bb-raised border border-bb-line rounded-xl px-3 py-2 text-[16px] md:text-sm text-bb-cream placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-bb-gold/50"
                  />
                  <button type="submit" disabled={!newIdea.trim()} className="px-3 rounded-xl border border-bb-line text-bb-cream text-sm font-semibold hover:bg-white/5 disabled:opacity-40 cursor-pointer">Add</button>
                </form>
              </div>

              <button
                onClick={() => setImportOpen(true)}
                className="w-full bg-bb-panel border border-bb-line rounded-2xl p-4 md:p-5 text-left hover:border-bb-gold/40 transition cursor-pointer"
              >
                <div className="text-sm font-semibold text-bb-cream">Paste from Notes</div>
                <div className="text-xs text-bb-muted mt-0.5">Copy your Apple Note in and we&apos;ll fill in the week, save ideas, and add any groceries to the list.</div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Build review */}
      {review && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex md:items-center md:justify-center">
          <div className="bg-bb-panel md:border md:border-bb-line md:rounded-2xl w-full md:max-w-lg h-full md:h-auto md:max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-bb-line">
              <div>
                <h2 className="text-lg font-semibold text-bb-cream">Add to shopping list</h2>
                <p className="text-xs text-bb-muted mt-0.5">Things you bought in the last two weeks start unchecked. Edits are remembered for each meal.</p>
              </div>
              <button onClick={() => setReview(null)} className="text-bb-muted hover:text-bb-cream text-xl leading-none cursor-pointer" aria-label="Close">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-4">
              {review.map((m, mi) => (
                <div key={m.meal} className="pt-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-[15px] font-semibold text-bb-cream">{m.meal}</h3>
                    <span className="text-[11px] uppercase tracking-wider text-bb-muted flex-none">
                      {m.dayLabel}{m.source === 'saved' ? ' · saved' : m.source === 'ai' ? ' · suggested' : ''}
                    </span>
                  </div>
                  {m.items.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2">Nothing to buy. Add ingredients below if this needs any.</p>
                  ) : (
                    <div className="divide-y divide-bb-line">
                      {m.items.map((item, ii) => (
                        <div key={`${item.name}-${ii}`} className="flex items-center gap-3 py-2">
                          <input
                            type="checkbox"
                            checked={item.onList || item.checked}
                            disabled={item.onList}
                            onChange={() => updateReviewMeal(mi, (rm) => ({ ...rm, items: rm.items.map((x, xi) => (xi === ii ? { ...x, checked: !x.checked } : x)) }))}
                            className="w-5 h-5 accent-[#c9a96e] [color-scheme:dark] cursor-pointer disabled:opacity-40"
                          />
                          <span className={`flex-1 min-w-0 text-sm ${item.onList || !item.checked ? 'text-bb-muted' : 'text-bb-cream'}`}>{item.name}</span>
                          {item.onList && <span className="text-[10px] uppercase tracking-wider text-bb-green flex-none">On list</span>}
                          {item.have && !item.checked && (
                            <span className="text-[10px] uppercase tracking-wider text-bb-muted flex-none">Have · {boughtLabel(item.have)}</span>
                          )}
                          <button
                            onClick={() => updateReviewMeal(mi, (rm) => ({ ...rm, items: rm.items.filter((_, xi) => xi !== ii) }))}
                            className="text-slate-500 hover:text-bb-red text-lg leading-none px-1 cursor-pointer"
                            aria-label={`Remove ${item.name}`}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = m.newItem.trim();
                      if (!name) return;
                      updateReviewMeal(mi, (rm) => ({ ...rm, newItem: '', items: [...rm.items, { name, checked: true, onList: false }] }));
                    }}
                    className="mt-1"
                  >
                    <input
                      value={m.newItem}
                      onChange={(e) => updateReviewMeal(mi, (rm) => ({ ...rm, newItem: e.target.value }))}
                      placeholder="+ Add ingredient"
                      className="w-full bg-transparent py-2 text-[16px] md:text-sm text-bb-cream placeholder:text-slate-500 focus:outline-none border-b border-transparent focus:border-bb-line"
                    />
                  </form>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-bb-line">
              <button
                onClick={confirmReview}
                disabled={adding}
                className="w-full bg-bb-gold text-bb-navy rounded-xl py-3.5 font-bold hover:brightness-110 transition disabled:opacity-50 cursor-pointer"
              >
                {adding ? 'Adding…' : reviewCount > 0 ? `Add ${reviewCount} ${reviewCount === 1 ? 'item' : 'items'} to list` : 'Save ingredients'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paste from Notes */}
      {importOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex md:items-center md:justify-center">
          <div className="bg-bb-panel md:border md:border-bb-line md:rounded-2xl w-full md:max-w-lg h-full md:h-auto md:max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-bb-line">
              <div>
                <h2 className="text-lg font-semibold text-bb-cream">Paste from Notes</h2>
                <p className="text-xs text-bb-muted mt-0.5">For the week of {rangeLabel(weekStart)}.</p>
              </div>
              <button
                onClick={() => { setImportOpen(false); setImportResult(null); }}
                className="text-bb-muted hover:text-bb-cream text-xl leading-none cursor-pointer"
                aria-label="Close"
              >×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!importResult ? (
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={'Mon - tacos\nTue - spaghetti\nWed - leftovers\n\nNeed: milk, eggs, paper towels'}
                  rows={12}
                  className="w-full bg-bb-raised border border-bb-line rounded-xl p-3 text-[16px] md:text-sm text-bb-cream placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-bb-gold/50"
                  autoFocus
                />
              ) : (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-bb-muted mb-1">Dinners</h3>
                    {importResult.days.length === 0 ? (
                      <p className="text-sm text-slate-500">None found.</p>
                    ) : (
                      <div className="divide-y divide-bb-line">
                        {importResult.days.map((d) => {
                          const current = (days[d.date] || '').trim();
                          return (
                            <div key={d.date} className="flex items-baseline gap-3 py-2 text-sm">
                              <span className="w-10 text-bb-muted text-xs uppercase">{dayName(new Date(`${d.date}T00:00:00`))}</span>
                              <span className="flex-1 text-bb-cream">{d.meal}</span>
                              {current && mealKey(current) !== mealKey(d.meal) && (
                                <span className="text-[11px] text-bb-gold">replaces {current}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {importResult.ideas.length > 0 && (
                    <div>
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-bb-muted mb-2">Ideas</h3>
                      <div className="flex flex-wrap gap-2">
                        {importResult.ideas.map((n) => (
                          <span key={n} className="rounded-full border border-bb-line px-3 py-1 text-sm text-bb-cream">{n}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {importResult.grocery_items.length > 0 && (
                    <div>
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-bb-muted mb-1">Add to shopping list</h3>
                      <p className="text-sm text-bb-cream">{importResult.grocery_items.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-bb-line flex gap-2">
              {importResult && (
                <button
                  onClick={() => setImportResult(null)}
                  className="px-4 rounded-xl border border-bb-line text-bb-cream font-semibold hover:bg-white/5 cursor-pointer"
                >Back</button>
              )}
              <button
                onClick={importResult ? applyImport : readNote}
                disabled={importResult ? applyingImport : importing || !importText.trim()}
                className="flex-1 bg-bb-gold text-bb-navy rounded-xl py-3.5 font-bold hover:brightness-110 transition disabled:opacity-50 cursor-pointer"
              >
                {importResult ? (applyingImport ? 'Saving…' : 'Use this') : importing ? 'Reading…' : 'Read note'}
              </button>
            </div>
          </div>
        </div>
      )}

      <StatusModal
        isOpen={statusModal.isOpen}
        onClose={closeStatus}
        title={statusModal.title}
        message={statusModal.message}
        type={statusModal.type}
      />
    </div>
  );
}
