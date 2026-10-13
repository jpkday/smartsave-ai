// Bulk staples a household restocks every few weeks or months (flour, sugar, coffee…).
// Items are recognized by name and grouped by kind, so "Flour, King Arthur, All Purpose
// (25 lb)" and its spelling variants count as one. Each kind has a typical restock time.

export interface StockUpRule {
  label: string;
  match: RegExp;
  days: number;
}

export const STOCK_UP_RULES: StockUpRule[] = [
  { label: 'All-purpose flour', match: /flour.*all.?purpose|all.?purpose.*flour/i, days: 60 },
  { label: 'Bread flour', match: /bread flour/i, days: 60 },
  { label: 'Sugar', match: /^sugar\b|granulated sugar/i, days: 60 },
  { label: 'Brown sugar', match: /brown sugar/i, days: 90 },
  { label: 'Powdered sugar', match: /powdered sugar/i, days: 120 },
  { label: 'Almond milk', match: /almond milk/i, days: 30 },
  { label: 'Coffee', match: /\bcoffee\b/i, days: 30 },
  { label: 'Olive oil', match: /olive oil/i, days: 60 },
  { label: 'Avocado oil', match: /avocado oil/i, days: 90 },
  { label: 'Honey', match: /^honey\b(?!, manuka)/i, days: 90 },
  { label: 'Maple syrup', match: /maple syrup/i, days: 90 },
  { label: 'Peanut butter', match: /peanut butter/i, days: 30 },
  { label: 'Butter', match: /^butter\b.*\b[3-9] ?lb/i, days: 30 },
  { label: 'Cashews', match: /^cashews?\b/i, days: 45 },
  { label: 'Walnuts', match: /^walnuts?\b/i, days: 60 },
  { label: 'Yeast', match: /\byeast\b/i, days: 180 },
  { label: 'Baking powder', match: /baking powder/i, days: 180 },
  { label: 'Vanilla extract', match: /vanilla extract/i, days: 180 },
  { label: 'Salt', match: /^(sea |kosher )?salt\b|salt, kosher/i, days: 180 },
  { label: 'Cinnamon', match: /^cinnamon\b/i, days: 180 },
  { label: 'Cornmeal', match: /cornmeal/i, days: 120 },
  { label: 'Chocolate chips', match: /chocolate chips/i, days: 60 },
  { label: 'Rice', match: /^rice\b/i, days: 60 },
  { label: 'Oats', match: /\boats\b|oatmeal/i, days: 45 },
  { label: 'Laundry detergent', match: /detergent/i, days: 90 },
  { label: 'Paper towels', match: /paper towel/i, days: 30 },
  { label: 'Toilet paper', match: /toilet paper|bath tissue/i, days: 30 },
  { label: 'Trash bags', match: /trash bag|garbage bag/i, days: 90 },
];

export const stockUpRuleFor = (itemName: string) => STOCK_UP_RULES.find((r) => r.match.test(itemName)) ?? null;

export type StockUpStatus = 'due' | 'soon' | 'stocked';

export interface StockUpItem {
  label: string;
  item_name: string; // most recently bought variant, used when adding to the list
  last_date: string; // YYYY-MM-DD, last purchase or "got it"
  store: string | null;
  days: number;
  status: StockUpStatus;
  on_list: boolean;
}

export const stockUpStatus = (daysSince: number, interval: number): StockUpStatus =>
  daysSince >= interval ? 'due' : daysSince >= interval * 0.75 ? 'soon' : 'stocked';
