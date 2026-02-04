
-- 1. Ensure Master Categories Exist
INSERT INTO categories (name) VALUES 
('Other'), ('Snacks'), ('Household'), ('Bakery'), ('Refrigerated'), 
('Frozen'), ('Meat'), ('Beverage'), ('Dairy'), ('Pantry'), ('Produce')
ON CONFLICT (name) DO NOTHING;

-- 2. Create Variables for IDs (Dynamic Lookup)
DO $$
DECLARE
    cat_other bigint;
    cat_snacks bigint;
    cat_household bigint;
    cat_bakery bigint;
    cat_refrigerated bigint;
    cat_frozen bigint;
    cat_meat bigint;
    cat_beverage bigint;
    cat_dairy bigint;
    cat_pantry bigint;
    cat_produce bigint;
BEGIN
    SELECT id INTO cat_other FROM categories WHERE name = 'Other';
    SELECT id INTO cat_snacks FROM categories WHERE name = 'Snacks';
    SELECT id INTO cat_household FROM categories WHERE name = 'Household';
    SELECT id INTO cat_bakery FROM categories WHERE name = 'Bakery';
    SELECT id INTO cat_refrigerated FROM categories WHERE name = 'Refrigerated';
    SELECT id INTO cat_frozen FROM categories WHERE name = 'Frozen';
    SELECT id INTO cat_meat FROM categories WHERE name = 'Meat';
    SELECT id INTO cat_beverage FROM categories WHERE name = 'Beverage';
    SELECT id INTO cat_dairy FROM categories WHERE name = 'Dairy';
    SELECT id INTO cat_pantry FROM categories WHERE name = 'Pantry';
    SELECT id INTO cat_produce FROM categories WHERE name = 'Produce';

    -- 3. Update Items based on TEMPORARY Category Names (Costco scraped names)
    -- We join items to their current category, check the NAME of that category, and reassign item_id.

    -- FROZEN (Priority 1)
    UPDATE items i
    SET category_id = cat_frozen
    FROM categories c
    WHERE i.category_id = c.id
    AND i.id > 729
    AND (c.name ILIKE '%Frozen%' OR c.name ILIKE '%Ice Cream%' OR i.name ILIKE '%Frozen%' 
      OR c.name ILIKE '%Sorbet%' OR c.name ILIKE '%Mochi%');

    -- MEAT / SEAFOOD
    UPDATE items i
    SET category_id = cat_meat
    FROM categories c
    WHERE i.category_id = c.id
    AND i.id > 729
    AND (c.name ILIKE '%Meat%' OR c.name ILIKE '%Chicken%' OR c.name ILIKE '%Beef%' OR c.name ILIKE '%Pork%' 
      OR c.name ILIKE '%Fish%' OR c.name ILIKE '%Seafood%' OR c.name ILIKE '%Lamb%' OR c.name ILIKE '%Bacon%'
      OR c.name ILIKE '%Sausage%' OR c.name ILIKE '%Steak%' OR c.name ILIKE '%Turkey%' OR c.name ILIKE '%Brisket%'
      OR c.name ILIKE '%Cod%' OR c.name ILIKE '%Rib%' OR c.name ILIKE '%Ham%' OR c.name ILIKE '%Salmon%'
      OR c.name ILIKE '%Salami%' OR c.name ILIKE '%Hot Dog%' OR c.name ILIKE '%Prosciutto%' OR c.name ILIKE '%Eye of Round%'
      OR c.name ILIKE '%Tenderloin%' OR c.name ILIKE '%Oxtail%' OR c.name ILIKE '%Fillet%' OR c.name ILIKE '%Trout%');

    -- DAIRY / EGGS
    UPDATE items i
    SET category_id = cat_dairy
    FROM categories c
    WHERE i.category_id = c.id
    AND i.id > 729
    AND (c.name ILIKE '%Dairy%' OR c.name ILIKE '%Cheese%' OR c.name ILIKE '%Milk%' OR c.name ILIKE '%Yogurt%' 
      OR c.name ILIKE '%Butter%' OR c.name ILIKE '%Cream%' OR c.name ILIKE '%Egg%' OR c.name ILIKE '%Brie%'
      OR c.name ILIKE '%Cheddar%' OR c.name ILIKE '%Mozzarella%' OR c.name ILIKE '%Parmesan%' OR c.name ILIKE '%Gouda%'
      OR c.name ILIKE '%Muenster%' OR c.name ILIKE '%Half & Half%' OR c.name ILIKE '%American%' OR c.name ILIKE '%Havarti%'
      OR c.name ILIKE '%Jarlsberg%' OR c.name ILIKE '%Feta%' OR c.name ILIKE '%Paneer%' OR c.name ILIKE '%Queso%');

    -- REFRIGERATED (Prepared Foods)
    UPDATE items i
    SET category_id = cat_refrigerated
    FROM categories c
    WHERE i.category_id = c.id
    AND i.id > 729
    AND (c.name ILIKE '%Refrigerated%' OR c.name ILIKE '%Prepared%' OR c.name ILIKE '%Dip%' OR c.name ILIKE '%Salsa%'
      OR c.name ILIKE '%Guacamole%' OR c.name ILIKE '%Kimchi%' OR c.name ILIKE '%Hummus%' OR c.name ILIKE '%Deli%'
      OR c.name ILIKE '%Tofu%' OR c.name ILIKE '%Curd%');

    -- HOUSEHOLD
    UPDATE items i
    SET category_id = cat_household
    FROM categories c
    WHERE i.category_id = c.id
    AND i.id > 729
    AND (c.name ILIKE '%Household%' OR c.name ILIKE '%Paper%' OR c.name ILIKE '%Clean%' OR c.name ILIKE '%Soap%' 
      OR c.name ILIKE '%Detergent%' OR c.name ILIKE '%Trash%' OR c.name ILIKE '%Shampoo%' OR c.name ILIKE '%Battery%' 
      OR c.name ILIKE '%Lotion%' OR c.name ILIKE '%Toothpaste%' OR c.name ILIKE '%Health%' OR c.name ILIKE '%Beauty%'
      OR c.name ILIKE '%Medicine%' OR c.name ILIKE '%Diaper%' OR c.name ILIKE '%Tissue%' OR c.name ILIKE '%Moisturizer%'
      OR c.name ILIKE '%Facial%' OR c.name ILIKE '%Feminine%' OR c.name ILIKE '%Laundry%' OR c.name ILIKE '%Razor%'
      OR c.name ILIKE '%Supplement%' OR c.name ILIKE '%Vitamin%' OR c.name ILIKE '%Relief%' OR c.name ILIKE '%Stomach%'
      OR c.name ILIKE '%Dog%' OR c.name ILIKE '%Cat%' OR c.name ILIKE '%Glove%' OR c.name ILIKE '%Storage%'
      OR c.name ILIKE '%Electronic%' OR c.name ILIKE '%Monitor%' OR c.name ILIKE '%TV%' OR c.name ILIKE '%Speaker%'
      OR c.name ILIKE '%Computer%' OR c.name ILIKE '%Laptop%' OR c.name ILIKE '%Shirt%' OR c.name ILIKE '%Underwear%'
      OR c.name ILIKE '%Sheet%' OR c.name ILIKE '%Earring%' OR c.name ILIKE '%Adhesive%' OR c.name ILIKE '%Sponge%'
      OR c.name ILIKE '%Duster%' OR c.name ILIKE '%Golf%' OR c.name ILIKE '%Pod%' OR c.name ILIKE '%Bag%'
      OR c.name ILIKE '%Mop%' OR c.name ILIKE '%Headphone%' OR c.name ILIKE '%Balm%' OR c.name ILIKE '%Wash%'
      OR c.name ILIKE '%Antiperspirant%' OR c.name ILIKE '%Shelf%' OR c.name ILIKE '%Toy%' OR c.name ILIKE '%Hat%'
      OR c.name ILIKE '%Chair%' OR c.name ILIKE '%Printer%' OR c.name ILIKE '%Mount%' OR c.name ILIKE '%Heater%'
      OR c.name ILIKE '%Purifier%' OR c.name ILIKE '%Softener%' OR c.name ILIKE '%Cosmetic%' OR c.name ILIKE '%Formula%'
      OR c.name ILIKE '%Rose%' OR c.name ILIKE '%Eyelash%' OR c.name ILIKE '%Ointment%' OR c.name ILIKE '%Deodorant%'
      OR c.name ILIKE '%Laxative%' OR c.name ILIKE '%Drop%' OR c.name ILIKE '%Sock%' OR c.name ILIKE '%Wipe%'
      OR c.name ILIKE '%Filter%' OR c.name ILIKE '%Cup%' OR c.name ILIKE '%Plate%' OR c.name ILIKE '%Table%'
      OR c.name ILIKE '%Spray%' OR c.name ILIKE '%Cloth%' OR c.name ILIKE '%Remover%' OR c.name ILIKE '%Head%'
      OR c.name ILIKE '%Treatment%' OR c.name ILIKE '%Puree%' OR c.name ILIKE '%Gel%' OR c.name ILIKE '%Conditioner%'
      OR c.name ILIKE '%Floss%' OR c.name ILIKE '%Dollie%');

    -- PRODUCE
    UPDATE items i
    SET category_id = cat_produce
    FROM categories c
    WHERE i.category_id = c.id
    AND i.id > 729
    AND (c.name ILIKE '%Produce%' OR c.name ILIKE '%Fruit%' OR c.name ILIKE '%Vegetable%' OR c.name ILIKE '%Berry%' 
      OR c.name ILIKE '%Salad%' OR c.name ILIKE '%Apple%' OR c.name ILIKE '%Banana%' OR c.name ILIKE '%Tomato%'
      OR c.name ILIKE '%Potato%' OR c.name ILIKE '%Onion%' OR c.name ILIKE '%Carrot%' OR c.name ILIKE '%Lettuce%'
      OR c.name ILIKE '%Grape%' OR c.name ILIKE '%Citrus%' OR c.name ILIKE '%Broccoli%' OR c.name ILIKE '%Asparagus%'
      OR c.name ILIKE '%Melon%' OR c.name ILIKE '%Lychee%' OR c.name ILIKE '%Spinach%' OR c.name ILIKE '%Microgreen%'
      OR c.name ILIKE '%Ginger%' OR c.name ILIKE '%Pear%' OR c.name ILIKE '%Nectarine%' OR c.name ILIKE '%Corn%'
      OR c.name ILIKE '%Bean%' OR c.name ILIKE '%Plantain%' OR c.name ILIKE '%Kiwi%' OR c.name ILIKE '%Mushroom%'
      OR c.name ILIKE '%Squash%' OR c.name ILIKE '%Green%');    

    -- BAKERY
    UPDATE items i
    SET category_id = cat_bakery
    FROM categories c
    WHERE i.category_id = c.id
    AND i.id > 729
    AND (c.name ILIKE '%Bakery%' OR c.name ILIKE '%Bread%' OR c.name ILIKE '%Bagel%' OR c.name ILIKE '%Cake%' 
      OR c.name ILIKE '%Cookie%' OR c.name ILIKE '%Bun%' OR c.name ILIKE '%Tortilla%' OR c.name ILIKE '%Croissant%'
      OR c.name ILIKE '%Pie%' OR c.name ILIKE '%Pastry%' OR c.name ILIKE '%Muffin%' OR c.name ILIKE '%Roll%'
      OR c.name ILIKE '%Danish%' OR c.name ILIKE '%Baguette%' OR c.name ILIKE '%Strudel%' OR c.name ILIKE '%Naan%');

    -- BEVERAGE
    UPDATE items i
    SET category_id = cat_beverage
    FROM categories c
    WHERE i.category_id = c.id
    AND i.id > 729
    AND (c.name ILIKE '%Beverage%' OR c.name ILIKE '%Drink%' OR c.name ILIKE '%Soda%' OR c.name ILIKE '%Water%' 
      OR c.name ILIKE '%Juice%' OR c.name ILIKE '%Coffee%' OR c.name ILIKE '%Tea%' OR c.name ILIKE '%Cola%'
      OR c.name ILIKE '%Lemonade%' OR c.name ILIKE '%Kombucha%' OR c.name ILIKE '%Shot%');

    -- SNACKS
    UPDATE items i
    SET category_id = cat_snacks
    FROM categories c
    WHERE i.category_id = c.id
    AND i.id > 729
    AND (c.name ILIKE '%Snack%' OR c.name ILIKE '%Chip%' OR c.name ILIKE '%Nut%' OR c.name ILIKE '%Cracker%' 
      OR c.name ILIKE '%Popcorn%' OR c.name ILIKE '%Candy%' OR c.name ILIKE '%Chocolate%' OR c.name ILIKE '%Bar%'
      OR c.name ILIKE '%Pretzel%' OR c.name ILIKE '%Granola%' OR c.name ILIKE '%Dried%' OR c.name ILIKE '%Madeleine%'
      OR c.name ILIKE '%Almond%' OR c.name ILIKE '%Cashew%' OR c.name ILIKE '%Pistachio%' OR c.name ILIKE '%Olive%'
      OR c.name ILIKE '%Gum%' OR c.name ILIKE '%Macaron%' OR c.name ILIKE '%Mochi%' OR c.name ILIKE '%Tart%' 
      OR c.name ILIKE '%Sorbet%' OR c.name ILIKE '%Biscotti%');

    -- PANTRY (Catch-all for dry goods)
    UPDATE items i
    SET category_id = cat_pantry
    FROM categories c
    WHERE i.category_id = c.id
    AND i.id > 729
    AND (c.name ILIKE '%Pantry%' OR c.name ILIKE '%Rice%' OR c.name ILIKE '%Pasta%' OR c.name ILIKE '%Sauce%' 
      OR c.name ILIKE '%Oil%' OR c.name ILIKE '%Spice%' OR c.name ILIKE '%Canned%' OR c.name ILIKE '%Cereal%'
      OR c.name ILIKE '%Soup%' OR c.name ILIKE '%Sugar%' OR c.name ILIKE '%Honey%' OR c.name ILIKE '%Seasoning%'
      OR c.name ILIKE '%Boullion%' OR c.name ILIKE '%Biscuit%' OR c.name ILIKE '%Vanilla%' OR c.name ILIKE '%Roti%'
      OR c.name ILIKE '%Noodle%' OR c.name ILIKE '%Broth%' OR c.name ILIKE '%Dressing%' OR c.name ILIKE '%Crust%'
      OR c.name ILIKE '%Salt%' OR c.name ILIKE '%Pepper%' OR c.name ILIKE '%Fiber%' OR c.name ILIKE '%Ginger%'
      OR c.name ILIKE '%Syrup%' OR c.name ILIKE '%Mayonnaise%' OR c.name ILIKE '%Ghee%' OR c.name ILIKE '%Flour%'
      OR c.name ILIKE '%Vinegar%' OR c.name ILIKE '%Grain%' OR c.name ILIKE '%Meal%' OR c.name ILIKE '%Oat%'
      OR c.name ILIKE '%Pickle%' OR c.name ILIKE '%Shortening%' OR c.name ILIKE '%Condiment%' OR c.name ILIKE '%Matcha%'
      OR c.name ILIKE '%Mix%' OR c.name ILIKE '%Seed%' OR c.name ILIKE '%Paste%' OR c.name ILIKE '%Garlic%'
      OR c.name ILIKE '%Caper%');

END $$;

-- 4. Cleanup: Delete categories that now have 0 items (The temporary micro-categories)
DELETE FROM categories 
WHERE id NOT IN (SELECT DISTINCT category_id FROM items WHERE category_id IS NOT NULL);
