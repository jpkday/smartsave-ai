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
  { meal: 'Lasagna', ingredients: ['lasagna noodles', 'ground beef', 'pasta sauce', 'ricotta', 'mozzarella', 'parmesan', 'eggs'] },
  { meal: 'Meatloaf with mashed potatoes', ingredients: ['ground beef', 'eggs', 'breadcrumbs', 'ketchup', 'onions', 'potatoes', 'butter', 'milk'] },
  { meal: 'Sloppy joes', ingredients: ['ground beef', 'hamburger buns', 'onions', 'peppers', 'sloppy joe sauce'] },
  { meal: "Shepherd's pie", ingredients: ['ground beef', 'potatoes', 'carrots', 'peas', 'onions', 'beef broth', 'butter'] },
  { meal: 'Stuffed peppers', ingredients: ['peppers', 'ground beef', 'rice', 'tomato sauce', 'cheese', 'onions'] },
  { meal: 'Beef stew', ingredients: ['stew beef', 'potatoes', 'carrots', 'celery', 'onions', 'beef broth'] },
  { meal: 'Beef and broccoli', ingredients: ['flank steak', 'broccoli', 'soy sauce', 'garlic', 'ginger', 'rice'] },
  { meal: 'Steak with baked potatoes', ingredients: ['steak', 'potatoes', 'butter', 'sour cream', 'green beans'] },
  { meal: 'Philly cheesesteaks', ingredients: ['steak', 'hoagie rolls', 'peppers', 'onions', 'provolone'] },
  { meal: 'BBQ chicken with corn', ingredients: ['chicken thighs', 'bbq sauce', 'corn', 'potatoes', 'coleslaw'] },
  { meal: 'Chicken parmesan', ingredients: ['chicken breast', 'breadcrumbs', 'eggs', 'pasta sauce', 'mozzarella', 'parmesan', 'spaghetti'] },
  { meal: 'Lemon garlic chicken with rice', ingredients: ['chicken thighs', 'lemons', 'garlic', 'butter', 'rice', 'green beans'] },
  { meal: 'Chicken pot pie', ingredients: ['chicken breast', 'pie crust', 'carrots', 'peas', 'celery', 'onions', 'chicken broth', 'milk'] },
  { meal: 'Chicken quesadillas', ingredients: ['chicken breast', 'tortillas', 'cheese', 'peppers', 'salsa', 'sour cream'] },
  { meal: 'Chicken Caesar salad', ingredients: ['chicken breast', 'romaine lettuce', 'caesar dressing', 'parmesan', 'croutons'] },
  { meal: 'Chicken and rice casserole', ingredients: ['chicken breast', 'rice', 'cream of chicken soup', 'broccoli', 'cheese'] },
  { meal: 'Chicken enchiladas', ingredients: ['chicken breast', 'tortillas', 'enchilada sauce', 'cheese', 'onions', 'sour cream'] },
  { meal: 'Burrito bowls', ingredients: ['chicken breast', 'rice', 'black beans', 'corn', 'salsa', 'cheese', 'lettuce'] },
  { meal: 'Chicken lo mein', ingredients: ['lo mein noodles', 'chicken breast', 'cabbage', 'carrots', 'soy sauce', 'green onions'] },
  { meal: 'Mac and cheese', ingredients: ['elbow macaroni', 'cheese', 'milk', 'butter', 'flour'] },
  { meal: 'Fish tacos', ingredients: ['white fish', 'tortillas', 'cabbage', 'limes', 'sour cream', 'salsa'] },
  { meal: 'Teriyaki salmon with rice', ingredients: ['salmon', 'teriyaki sauce', 'rice', 'broccoli'] },
  { meal: 'Shrimp scampi', ingredients: ['shrimp', 'linguine', 'butter', 'garlic', 'lemons', 'parmesan'] },
  { meal: 'Pork tenderloin with roasted potatoes', ingredients: ['pork tenderloin', 'potatoes', 'garlic', 'green beans'] },
  { meal: 'Pulled pork sandwiches', ingredients: ['pork shoulder', 'bbq sauce', 'hamburger buns', 'coleslaw'] },
  { meal: 'Sausage and peppers', ingredients: ['italian sausage', 'peppers', 'onions', 'hoagie rolls'] },
  { meal: 'Kielbasa and potatoes', ingredients: ['kielbasa', 'potatoes', 'onions', 'green beans'] },
  { meal: 'Bean and cheese burritos', ingredients: ['tortillas', 'refried beans', 'cheese', 'rice', 'salsa'] },
  { meal: 'Nachos', ingredients: ['tortilla chips', 'ground beef', 'cheese', 'salsa', 'sour cream', 'black beans'] },
  { meal: 'Baked potato bar', ingredients: ['potatoes', 'cheese', 'sour cream', 'bacon', 'broccoli', 'green onions'] },
  { meal: 'Lentil soup', ingredients: ['lentils', 'carrots', 'celery', 'onions', 'crushed tomatoes', 'vegetable broth'] },
  { meal: 'Minestrone soup', ingredients: ['pasta', 'kidney beans', 'crushed tomatoes', 'carrots', 'celery', 'zucchini', 'vegetable broth'] },
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
  fish: 'white fish',
  steak: 'steak',
  sausage: 'italian sausage',
};
const PROTEIN_INGREDIENTS = new Set([
  'chicken breast', 'chicken thighs', 'ground beef', 'ground turkey', 'pork chops', 'shrimp', 'salmon', 'chuck roast',
  'stew beef', 'flank steak', 'steak', 'pork shoulder', 'pork tenderloin', 'italian sausage', 'kielbasa', 'white fish',
]);
// Words in a meal name that aren't foods to buy ("Chicken noodle soup (lunches)")
const NOT_FOOD = new Set(['lunch', 'lunches', 'dinner', 'night', 'sticks', 'stick', 'side', 'sides', 'plus', 'easy', 'quick',
  'mom', 'moms', 'grandma', 'style', 'bowl', 'bowls', 'leftover', 'leftovers', 'vegetables', 'veggies', 'veggie', 'fresh', 'baked', 'roasted', 'grilled']);

// Closest template for a meal name, matched on the dish ("tacos", "chili") and adjusted
// to the protein named ("turkey tacos" → taco ingredients with ground turkey).
// Returns null when no dish word matches.
export function templateFor(meal: string): MealTemplate | null {
  const want = nameWords(meal);
  const wantProtein = want.find((w) => PROTEINS[w]);
  const dishWords = want.filter((w) => !PROTEINS[w]);
  if (dishWords.length === 0) return null;

  // Dish words matter most, then a matching protein, then fewer unrelated words
  let best: { t: MealTemplate; score: number } | null = null;
  for (const t of MEAL_TEMPLATES) {
    const allWords = nameWords(t.meal);
    const words = new Set(allWords.filter((w) => !PROTEINS[w]));
    const shared = dishWords.filter((w) => words.has(w)).length;
    if (shared === 0) continue;
    const proteinMatch = wantProtein && (allWords.includes(wantProtein) || t.ingredients.some((i) => i.includes(wantProtein)));
    const score = shared * 10 + (proteinMatch ? 5 : 0) - (words.size - shared);
    if (!best || score > best.score) best = { t, score };
  }
  if (!best) return null;

  let ingredients = best.t.ingredients;
  if (wantProtein) {
    const protein = PROTEINS[wantProtein];
    const current = ingredients.find((i) => PROTEIN_INGREDIENTS.has(i));
    if (current && !current.includes(wantProtein)) ingredients = ingredients.map((i) => (i === current ? protein : i));
    else if (!current) ingredients = [protein, ...ingredients];
  }
  // Sides named in the meal but not in the recipe ("+ cornbread + carrot & celery sticks")
  const recipeWords = new Set(nameWords(best.t.meal).concat(ingredients.flatMap(nameWords)));
  const extras = dishWords.filter((w) => !recipeWords.has(w) && !recipeWords.has(w.replace(/s$/, '')) && !NOT_FOOD.has(w.replace(/'s$/, '')));
  return { meal: best.t.meal, ingredients: [...ingredients, ...extras] };
}

// Main protein family of a recipe ("chicken", "beef", …), used to vary suggestions
const PROTEIN_FAMILIES = ['chicken', 'beef', 'turkey', 'pork', 'shrimp', 'salmon', 'fish', 'steak', 'sausage', 'kielbasa', 'chuck'];
export function proteinFamily(ingredients: string[]) {
  for (const ing of ingredients) {
    const family = PROTEIN_FAMILIES.find((p) => ing.toLowerCase().includes(p));
    if (family) return family === 'chuck' || family === 'steak' ? 'beef' : family === 'kielbasa' ? 'sausage' : family;
  }
  return 'meatless';
}

// Entries that aren't a home-cooked dinner, so there's nothing to buy
const NOT_COOKING = /^(left ?overs?|out|eat(ing)? out|dinner out|take ?out|takeout|delivery|tbd|tba|n\/a|none|skip|fend for yourselves?|fyo|restaurant|date night out|no cook(ing)?)\b/i;
export const isNotCooking = (meal: string) => NOT_COOKING.test(meal.trim());
