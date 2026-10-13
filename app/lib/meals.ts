// Shared helpers for meal planning (client and server).

// Normalized key used to store and look up a meal's saved ingredients
export const mealKey = (meal: string) => meal.trim().toLowerCase().replace(/\s+/g, ' ');

// YYYY-MM-DD in local time
export const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const fromDateStr = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Monday of the week containing `d`
export const startOfWeek = (d: Date) => {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (start.getDay() + 6) % 7; // Mon=0 … Sun=6
  start.setDate(start.getDate() - offset);
  return start;
};

export const addDays = (d: Date, n: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
};

export const weekDates = (weekStart: Date) => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

export interface MealIngredients {
  meal: string;
  ingredients: string[];
  source: 'saved' | 'ai' | 'none';
}

export interface NoteImport {
  days: { date: string; meal: string }[];
  ideas: string[];
  grocery_items: string[];
}
