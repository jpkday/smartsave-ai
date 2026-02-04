
-- Final Polish for Stragglers
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

    -- HOUSEHOLD (Electronics, Cleaning, Personal)
    UPDATE items i
    SET category_id = cat_household
    FROM categories c
    WHERE i.category_id = c.id
    AND i.id > 729
    AND (
         c.name ILIKE '%Batteries%' OR c.name ILIKE '%Toothbrush%' OR c.name ILIKE '%Reliever%' -- Plurals fixed
      OR c.name ILIKE '%Wrap%' OR c.name ILIKE '%Pad%' OR c.name ILIKE '%Flooring%' 
      OR c.name ILIKE '%Suitcase%' OR c.name ILIKE '%Freshener%' OR c.name ILIKE '%Necklace%' 
      OR c.name ILIKE '%Blender%' OR c.name ILIKE '%Bouquet%' OR c.name ILIKE '%Toaster%' 
      OR c.name ILIKE '%Cooker%'
    );

    -- SNACKS (Treats, Nuts, Candies)
    UPDATE items i
    SET category_id = cat_snacks
    FROM categories c
    WHERE i.category_id = c.id
    AND i.id > 729
    AND (
         c.name ILIKE '%Treat%' OR c.name ILIKE '%Pecan%' OR c.name ILIKE '%Candies%' -- Plurals fixed
      OR c.name ILIKE '%Goji%'
    );

    -- PANTRY (Croutons, Spices)
    UPDATE items i
    SET category_id = cat_pantry
    FROM categories c
    WHERE i.category_id = c.id
    AND i.id > 729
    AND (
         c.name ILIKE '%Crouton%' OR c.name ILIKE '%Paprika%' OR c.name ILIKE '%Pastries%'
    );

    -- PRODUCE (Fruit)
    UPDATE items i
    SET category_id = cat_produce
    FROM categories c
    WHERE i.category_id = c.id
    AND i.id > 729
    AND (
         c.name ILIKE '%Orange%' OR c.name ILIKE '%Mango%'
    );

    -- DAIRY (Specialty Cheese)
    UPDATE items i
    SET category_id = cat_dairy
    FROM categories c
    WHERE i.category_id = c.id
    AND i.id > 729
    AND (
         c.name ILIKE '%Pecorino%' OR c.name ILIKE '%Dubliner%' OR c.name ILIKE '%Probiotic%'
    );

END $$;

-- Cleanup empty categories again
DELETE FROM categories 
WHERE id NOT IN (SELECT DISTINCT category_id FROM items WHERE category_id IS NOT NULL);
