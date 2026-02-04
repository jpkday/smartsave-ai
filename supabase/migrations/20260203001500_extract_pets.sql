
-- Move specific Household items (Category 6) to Pets (Category 12)

UPDATE items 
SET category_id = 12 -- Pets
WHERE id > 0 
AND category_id = 6 -- Only from Household
AND (
    (name ILIKE '%Dog%' AND name NOT ILIKE '%Hot Dog%' AND name NOT ILIKE '%Hotdog%') 
    OR (name ILIKE '%Cat%' AND name NOT ILIKE '%Catfish%' AND name NOT ILIKE '%Catch%') 
    OR name ILIKE '%Pet%'
    OR name ILIKE '%Puppy%'
    OR name ILIKE '%Kitten%'
    OR name ILIKE '%Litter%'
    OR name ILIKE '%Canine%'
    OR name ILIKE '%Feline%'
);
