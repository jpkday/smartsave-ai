
-- Move Health/Pharmacy items to new 'Health' Category (ID 5)

UPDATE items 
SET category_id = 5 -- Health
WHERE id > 729 
AND (
    -- VITAMINS & SUPPLEMENTS
    name ILIKE '%Vitamin%'
    OR name ILIKE '%Supplement%'
    OR name ILIKE '%Multivitamin%'
    OR name ILIKE '%Probiotic%'
    OR name ILIKE '%Prebiotic%'
    OR name ILIKE '%Collagen%'
    OR name ILIKE '%Protein%' AND name NOT ILIKE '%Bar%' -- Avoid Protein Bars (Snacks)
    OR name ILIKE '%Fish Oil%'
    OR name ILIKE '%Magnesium%'
    OR name ILIKE '%Calcium%'
    OR name ILIKE '%Iron%'
    OR name ILIKE '%Zinc%'
    OR name ILIKE '%Biotin%'
    OR name ILIKE '%Melatonin%'
    OR name ILIKE '%Gummy%' AND name ILIKE '%Vitamin%' -- Gummy Vitamins

    -- MEDICINE / PHARMACY
    OR name ILIKE '%Relief%' -- Pain Relief, Allergy Relief
    OR name ILIKE '%Reliever%'
    OR name ILIKE '%Tablet%' -- Tablets
    OR name ILIKE '%Caplet%'
    OR name ILIKE '%Capsule%'
    OR name ILIKE '%Softgel%'
    OR name ILIKE '%Pill%'
    OR name ILIKE '%Allergy%'
    OR name ILIKE '%Pain%'
    OR name ILIKE '%Cold%' AND name ILIKE '%Flu%'
    OR name ILIKE '%Cough%'
    OR name ILIKE '%Medicine%'
    OR name ILIKE '%Advil%'
    OR name ILIKE '%Tylenol%'
    OR name ILIKE '%Motrin%'
    OR name ILIKE '%Claritin%'
    OR name ILIKE '%Zyrtec%'
    OR name ILIKE '%Benadryl%'
    OR name ILIKE '%Pepto%'
    OR name ILIKE '%Tums%'
    
    -- FIRST AID / PERSONAL HEALTH
    OR name ILIKE '%Bandage%'
    OR name ILIKE '%Aid%' AND name ILIKE '%Hearing%' -- Hearing Aids/Batteries
    OR name ILIKE '%Ointment%'
    OR name ILIKE '%Dropdown%' -- Eye Drops
    OR name ILIKE '%Drop%' AND name ILIKE '%Eye%'
    OR name ILIKE '%Optical%'
    OR name ILIKE '%Solution%' AND name ILIKE '%Lens%'
);
