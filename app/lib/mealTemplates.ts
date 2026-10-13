// Everyday family dinners with plain ingredient names, used when the AI is unavailable.
// Ingredient names are matched to the household's own items (see itemMatcher).
export interface MealTemplate {
  meal: string;
  ingredients: string[];
}

export const MEAL_TEMPLATES: MealTemplate[] = [
  { meal: 'Chicken tacos', ingredients: ['chicken breast', 'tortillas', 'cheese', 'salsa', 'sour cream', 'lettuce', 'limes'] },
  { meal: 'Beef tacos', ingredients: ['ground beef', 'taco seasoning', 'tortillas', 'cheese', 'salsa', 'lettuce', 'tomatoes'] },
  { meal: 'Spaghetti and meatballs', ingredients: ['spaghetti', 'ground beef', 'pasta sauce', 'eggs', 'breadcrumbs', 'parmesan', 'garlic'] },
  { meal: 'Pasta with meat sauce', ingredients: ['pasta', 'ground beef', 'pasta sauce', 'onions', 'garlic', 'parmesan'] },
  { meal: 'Beef chili', ingredients: ['ground beef', 'kidney beans', 'crushed tomatoes', 'onions', 'chili powder', 'peppers', 'cheese'] },
  { meal: 'Turkey chili', ingredients: ['ground turkey', 'chili beans', 'crushed tomatoes', 'onions', 'chili powder', 'peppers'] },
  { meal: 'Chicken stir-fry with rice', ingredients: ['chicken breast', 'broccoli', 'carrots', 'peppers', 'soy sauce', 'ginger', 'garlic', 'rice'] },
  { meal: 'Teriyaki chicken + rice + broccoli', ingredients: ['chicken thighs', 'teriyaki sauce', 'rice', 'broccoli', 'garlic'] },
  { meal: 'Sheet-pan chicken and vegetables', ingredients: ['chicken thighs', 'potatoes', 'carrots', 'broccoli', 'onions', 'garlic'] },
  { meal: 'Burgers and fries', ingredients: ['ground beef', 'hamburger buns', 'cheese', 'lettuce', 'tomatoes', 'onions', 'french fries'] },
  { meal: 'Baked salmon with rice and asparagus', ingredients: ['salmon', 'rice', 'asparagus', 'lemons', 'garlic', 'butter'] },
  { meal: 'Chicken noodle soup', ingredients: ['chicken breast', 'egg noodles', 'chicken broth', 'carrots', 'celery', 'onions'] },
  { meal: 'Pot roast', ingredients: ['chuck roast', 'potatoes', 'carrots', 'onions', 'celery', 'beef broth'] },
  { meal: 'Breakfast for dinner', ingredients: ['eggs', 'bacon', 'pancake mix', 'milk', 'butter', 'maple syrup'] },
  { meal: 'Veggie frittata', ingredients: ['eggs', 'milk', 'broccoli', 'peppers', 'onions', 'cheese'] },
  { meal: 'Homemade pizza', ingredients: ['pizza dough', 'pizza sauce', 'mozzarella', 'pepperoni'] },
  { meal: 'Chicken fajitas', ingredients: ['chicken breast', 'peppers', 'onions', 'tortillas', 'salsa', 'sour cream', 'limes'] },
  { meal: 'Chicken Alfredo with broccoli', ingredients: ['fettuccine', 'chicken breast', 'heavy cream', 'parmesan', 'butter', 'garlic', 'broccoli'] },
  { meal: 'Chicken tikka masala', ingredients: ['chicken thighs', 'yogurt', 'crushed tomatoes', 'heavy cream', 'onions', 'garlic', 'ginger', 'garam masala', 'rice'] },
  { meal: 'Coconut chicken curry', ingredients: ['chicken thighs', 'coconut milk', 'curry paste', 'onions', 'garlic', 'ginger', 'rice'] },
  { meal: 'Grilled cheese and tomato soup', ingredients: ['bread', 'cheese', 'butter', 'tomato soup'] },
  { meal: 'Pork chops with potatoes and green beans', ingredients: ['pork chops', 'potatoes', 'green beans', 'butter', 'garlic'] },
  { meal: 'Shrimp fried rice', ingredients: ['shrimp', 'rice', 'eggs', 'peas', 'carrots', 'soy sauce', 'green onions'] },
  { meal: 'Baked ziti', ingredients: ['ziti', 'pasta sauce', 'ricotta', 'mozzarella', 'ground beef', 'parmesan'] },
];

const nameWords = (s: string) =>
  s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !['and', 'with', 'the', 'homemade'].includes(w));

// Protein named in a meal → the plain ingredient to use for it
const PROTEINS: Record<string, string> = {
  chicken: 'chicken breast',
  beef: 'ground beef',
  turkey: 'ground turkey',
  pork: 'pork chops',
  shrimp: 'shrimp',
  salmon: 'salmon',
};
const PROTEIN_INGREDIENTS = new Set(['chicken breast', 'chicken thighs', 'ground beef', 'ground turkey', 'pork chops', 'shrimp', 'salmon', 'chuck roast']);

// Closest template for a meal name, matched on the dish ("tacos", "chili") and adjusted
// to the protein named ("turkey tacos" → taco ingredients with ground turkey).
// Returns null when no dish word matches.
export function templateFor(meal: string): MealTemplate | null {
  const want = nameWords(meal);
  const wantProtein = want.find((w) => PROTEINS[w]);
  const dishWords = want.filter((w) => !PROTEINS[w]);
  if (dishWords.length === 0) return null;

  let best: { t: MealTemplate; shared: number; extra: number } | null = null;
  for (const t of MEAL_TEMPLATES) {
    const words = new Set(nameWords(t.meal).filter((w) => !PROTEINS[w]));
    const shared = dishWords.filter((w) => words.has(w)).length;
    if (shared === 0) continue;
    const extra = words.size - shared;
    if (!best || shared > best.shared || (shared === best.shared && extra < best.extra)) best = { t, shared, extra };
  }
  if (!best) return null;

  let ingredients = best.t.ingredients;
  if (wantProtein) {
    const protein = PROTEINS[wantProtein];
    const current = ingredients.find((i) => PROTEIN_INGREDIENTS.has(i));
    if (current && !current.includes(wantProtein)) ingredients = ingredients.map((i) => (i === current ? protein : i));
    else if (!current) ingredients = [protein, ...ingredients];
  }
  return { meal: best.t.meal, ingredients };
}

// Main protein family of a recipe ("chicken", "beef", …), used to vary suggestions
const PROTEIN_FAMILIES = ['chicken', 'beef', 'turkey', 'pork', 'shrimp', 'salmon', 'chuck'];
export function proteinFamily(ingredients: string[]) {
  for (const ing of ingredients) {
    const family = PROTEIN_FAMILIES.find((p) => ing.toLowerCase().includes(p));
    if (family) return family === 'chuck' ? 'beef' : family;
  }
  return 'meatless';
}
