/**
 * Unit Price Utilities
 * 
 * Parses item names to extract quantities and units, then calculates normalized
 * unit prices for comparison across different package sizes.
 */

export interface UnitInfo {
    quantity: number;
    unit: 'lb' | 'oz' | 'ct' | 'doz' | 'ea' | 'qt' | 'gal' | 'pt' | 'L' | 'ml' | 'sqft' | 'sqin' | null;
    rawText: string;
}

/**
 * Parses an item name to extract quantity and unit information.
 * 
 * Examples:
 * - "Apples, Honeycrisp (4 lb)" → { quantity: 4, unit: 'lb', rawText: '4 lb' }
 * - "Broth, Chicken (6/32 oz)" → { quantity: 192, unit: 'oz', rawText: '6/32 oz' }
 * - "Almond Milk (6x32 oz)" → { quantity: 192, unit: 'oz', rawText: '6x32 oz' }
 * - "Eggs (18 ct)" → { quantity: 18, unit: 'ct', rawText: '18 ct' }
 * - "Eggs, 1 doz" → { quantity: 1, unit: 'doz', rawText: '1 doz' }
 * - "Eggs, 5 doz" → { quantity: 5, unit: 'doz', rawText: '5 doz' }
 * - "Butter (4 lb)" → { quantity: 4, unit: 'lb', rawText: '4 lb' }
 * - "Eggs" → { quantity: 0, unit: null, rawText: '' }
 */
export function parseUnitInfo(itemName: string): UnitInfo {
    // Match multi-pack patterns like (6/32 oz), (6x32 oz), (6*32 oz), (6-32 oz)
    const multiPackPattern = /\((\d+(?:\.\d+)?)\s*[\/x*-]\s*(\d+(?:\.\d+)?)\s*(lb|oz)\)/i;
    const multiPackMatch = itemName.match(multiPackPattern);

    if (multiPackMatch) {
        const count = parseFloat(multiPackMatch[1]);
        const size = parseFloat(multiPackMatch[2]);
        const unit = multiPackMatch[3].toLowerCase() as 'lb' | 'oz';
        const totalQuantity = count * size; // Multiply for multi-packs

        return {
            quantity: totalQuantity,
            unit,
            rawText: multiPackMatch[0].replace(/[()]/g, '').trim(),
        };
    }

    // Match multi-pack count patterns like (6x18 ct), (2*12 ct), (4x6 pk)
    const multiPackCountPattern = /\((\d+(?:\.\d+)?)\s*[\/x*-]\s*(\d+(?:\.\d+)?)\s*(ct|doz|pk)\)/i;
    const multiPackCountMatch = itemName.match(multiPackCountPattern);

    if (multiPackCountMatch) {
        const count = parseFloat(multiPackCountMatch[1]);
        const size = parseFloat(multiPackCountMatch[2]);
        const unit = multiPackCountMatch[3].toLowerCase() === 'pk' ? 'ct' : multiPackCountMatch[3].toLowerCase() as 'ct' | 'doz';
        const totalQuantity = count * size; // Multiply for multi-packs

        return {
            quantity: totalQuantity,
            unit,
            rawText: multiPackCountMatch[0].replace(/[()]/g, '').trim(),
        };
    }

    // Match simple patterns like (4 lb), (32 oz), (18 ct), (1.5 qt), (50 sq ft), (8 pk)
    // Also matches comma-separated like ", 1 doz", ", 5 doz", or ", 5 doz."
    const simplePattern = /[\(,]\s*(\d+(?:\.\d+)?)\s*(?:sq\s*)?(lb|oz|ct|doz|qt|gal|pt|L|ml|ft|in|pk)[\),.]/i;
    const simpleMatch = itemName.match(simplePattern);

    if (simpleMatch) {
        const quantity = parseFloat(simpleMatch[1]);
        let unit = simpleMatch[2].toLowerCase();

        // Check if it's an area measurement (preceded by 'sq')
        const isSquare = /sq\s*(ft|in)/i.test(simpleMatch[0]);
        if (isSquare && unit === 'ft') unit = 'sqft';
        if (isSquare && unit === 'in') unit = 'sqin';

        // Normalize 'pk' to 'ct'
        if (unit === 'pk') unit = 'ct';

        // Preserve 'L' as uppercase for liters (standard notation)
        if (unit === 'l') unit = 'L';

        const finalUnit = unit as 'lb' | 'oz' | 'ct' | 'doz' | 'qt' | 'gal' | 'pt' | 'L' | 'ml' | 'sqft' | 'sqin';
        return {
            quantity,
            unit: finalUnit,
            rawText: simpleMatch[0].replace(/[(),]/g, '').trim(),
        };
    }

    // Match compact formats like 5lb, 32oz, 1.5qt, 8pk (no spaces or parentheses)
    const compactPattern = /(\d+(?:\.\d+)?)(lb|oz|ct|doz|qt|gal|pt|L|ml|pk)\b/i;
    const compactMatch = itemName.match(compactPattern);

    if (compactMatch) {
        const quantity = parseFloat(compactMatch[1]);
        let unit = compactMatch[2].toLowerCase();

        // Normalize 'pk' to 'ct'
        if (unit === 'pk') unit = 'ct';

        // Preserve 'L' as uppercase for liters (standard notation)
        if (unit === 'l') unit = 'L';

        const finalUnit = unit as 'lb' | 'oz' | 'ct' | 'doz' | 'qt' | 'gal' | 'pt' | 'L' | 'ml';
        return {
            quantity,
            unit: finalUnit,
            rawText: compactMatch[0].trim(),
        };
    }

    // Match unit-only patterns like (lb), (oz), (qt) - defaults to quantity of 1
    const unitOnlyPattern = /\((lb|oz|ct|doz|ea|qt|gal|pt|L|ml)\)/i;
    const unitOnlyMatch = itemName.match(unitOnlyPattern);

    if (unitOnlyMatch) {
        let unit = unitOnlyMatch[1].toLowerCase();

        // Preserve 'L' as uppercase for liters (standard notation)
        if (unit === 'l') unit = 'L';

        const finalUnit = unit as 'lb' | 'oz' | 'ct' | 'doz' | 'ea' | 'qt' | 'gal' | 'pt' | 'L' | 'ml';
        return {
            quantity: 1,
            unit: finalUnit,
            rawText: unitOnlyMatch[0].replace(/[()]/g, '').trim(),
        };
    }

    return { quantity: 0, unit: null, rawText: '' };
}

/**
 * Converts ounces to pounds
 */
export function ozToLb(oz: number): number {
    return oz / 16;
}

/**
 * Converts pounds to ounces
 */
export function lbToOz(lb: number): number {
    return lb * 16;
}

/**
 * Calculates the unit price for an item.
 * For weight-based items: returns price per pound
 * For count-based items: returns price per unit (ea)
 * For volume-based items: returns price per quart
 * For area-based items: returns price per square foot
 * 
 * @param itemName - Full item name (e.g., "Apples, Honeycrisp (4 lb)", "Eggs (18 ct)", "Ice Cream (1.5 qt)", "Parchment Paper (50 sq ft)")
 * @param price - Price of the item
 * @returns Object with unitPrice and unitType, or null if not applicable
 */
export function calculateUnitPrice(itemName: string, price: number): { unitPrice: number; unitType: 'lb' | 'ea' | 'qt' | 'sqft' } | null {
    const unitInfo = parseUnitInfo(itemName);

    if (!unitInfo.unit || unitInfo.quantity === 0) {
        return null;
    }

    // Handle weight-based units (convert to price per lb)
    if (unitInfo.unit === 'lb' || unitInfo.unit === 'oz') {
        const quantityInLbs = unitInfo.unit === 'oz'
            ? ozToLb(unitInfo.quantity)
            : unitInfo.quantity;

        return {
            unitPrice: price / quantityInLbs,
            unitType: 'lb'
        };
    }

    // Handle volume-based units (convert to price per qt)
    if (unitInfo.unit === 'qt' || unitInfo.unit === 'gal' || unitInfo.unit === 'pt' || unitInfo.unit === 'L' || unitInfo.unit === 'ml') {
        let quantityInQuarts = unitInfo.quantity;

        // Convert to quarts
        if (unitInfo.unit === 'gal') {
            quantityInQuarts = unitInfo.quantity * 4; // 1 gal = 4 qt
        } else if (unitInfo.unit === 'pt') {
            quantityInQuarts = unitInfo.quantity / 2; // 1 qt = 2 pt
        } else if (unitInfo.unit === 'L') {
            quantityInQuarts = unitInfo.quantity * 1.057; // 1 L ≈ 1.057 qt
        } else if (unitInfo.unit === 'ml') {
            quantityInQuarts = (unitInfo.quantity / 1000) * 1.057; // Convert mL to L, then to qt
        }

        return {
            unitPrice: price / quantityInQuarts,
            unitType: 'qt'
        };
    }

    // Handle count-based units (convert to price per ea)
    if (unitInfo.unit === 'ct' || unitInfo.unit === 'doz' || unitInfo.unit === 'ea') {
        const quantityInEach = unitInfo.unit === 'doz'
            ? unitInfo.quantity * 12  // 1 doz = 12 ea
            : unitInfo.quantity;

        return {
            unitPrice: price / quantityInEach,
            unitType: 'ea'
        };
    }

    // Handle area-based units (convert to price per sq ft)
    if (unitInfo.unit === 'sqft' || unitInfo.unit === 'sqin') {
        const quantityInSqFt = unitInfo.unit === 'sqin'
            ? unitInfo.quantity / 144  // 144 sq in = 1 sq ft
            : unitInfo.quantity;

        return {
            unitPrice: price / quantityInSqFt,
            unitType: 'sqft'
        };
    }

    return null;
}

/**
 * Formats a unit price for display
 * 
 * @param result - Result from calculateUnitPrice containing unitPrice and unitType
 * @returns Formatted string (e.g., "$2.00/lb", "$0.15/ea", "$3.33/qt", "$0.10/sqft")
 */
export function formatUnitPrice(result: { unitPrice: number; unitType: 'lb' | 'ea' | 'qt' | 'sqft' } | null): string | null {
    if (result === null) {
        return null;
    }

    return `$${result.unitPrice.toFixed(2)}/${result.unitType}`;
}

/**
 * Main function to get formatted unit price from item name and price
 */
export function getFormattedUnitPrice(itemName: string, price: number): string | null {
    const unitPrice = calculateUnitPrice(itemName, price);
    return formatUnitPrice(unitPrice);
}
