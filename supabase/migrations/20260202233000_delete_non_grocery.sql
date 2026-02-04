
-- Delete Non-Grocery Items (with Cascade/Dependency Handling)

WITH target_items AS (
    SELECT id FROM items 
    WHERE id > 729 
    AND category_id = 6 -- Targeting Household only
    AND (
        -- ELECTRONICS
        (name ILIKE '%TV%' AND name NOT ILIKE '%Dinner%') 
        OR name ILIKE '%Television%'
        OR name ILIKE '%Monitor%'
        OR name ILIKE '%Laptop%'
        OR name ILIKE '%Computer%'
        OR name ILIKE '%Soundbar%'
        OR name ILIKE '%Headphone%'
        OR name ILIKE '%Earbud%'
        OR name ILIKE '%Printer%'
        OR name ILIKE '%Projector%'
        OR name ILIKE '%iPad%'

        -- FURNITURE
        OR name ILIKE '%Chair%'
        OR name ILIKE '%Sofa%'
        OR name ILIKE '%Couch%'
        OR name ILIKE '%Desk%'
        OR name ILIKE '%Bookshelf%' 
        
        -- APPLIANCES
        OR name ILIKE '%Vacuum%'
        OR name ILIKE '%Heater%'
        OR name ILIKE '%Purifier%'
        OR name ILIKE '%Blender%'
        OR (name ILIKE '%Toaster%' AND name NOT ILIKE '%Pastry%' AND name NOT ILIKE '%Pastries%') 
        OR name ILIKE '%Fryer%'
        
        -- JEWELRY
        OR name ILIKE '%Necklace%'
        OR name ILIKE '%Earring%'
        OR name ILIKE '%Bracelet%'

        -- APPAREL
        OR name ILIKE '%Shirt%'
        OR (name ILIKE '%Pant%' AND name NOT ILIKE '%Pantry%' AND name NOT ILIKE '%Pantene%')
        OR name ILIKE '%Shoe%'
        OR name ILIKE '%Jacket%'
    )
),
deleted_skus AS (
    DELETE FROM store_item_sku 
    WHERE item_id IN (SELECT id FROM target_items)
),
deleted_aliases AS (
    DELETE FROM item_aliases
    WHERE item_id IN (SELECT id FROM target_items)
)
DELETE FROM items 
WHERE id IN (SELECT id FROM target_items);
