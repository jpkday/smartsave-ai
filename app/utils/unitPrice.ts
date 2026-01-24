/**
 * Unit Price Utilities
 * 
 * Parses item names to extract quantities and units, then calculates normalized
 * unit prices for comparison across different package sizes.
 */

export interface UnitInfo {
    quantity: number;
    unit: 'lb' | 'oz' | 'fz' | 'ct' | 'doz' | 'ea' | 'qt' | 'gal' | 'pt' | 'L' | 'ml' | 'sqft' | 'sqin' | null;
    rawText: string;
}

/**
 * Parses an item name to extract quantity and unit information.
 * 
 * Examples:
 * - "Apples, Honeycrisp (4 lb)" → { quantity: 4, unit: 'lb', rawText: '4 lb' }
 * - "Broth, Chicken (6/32 oz)" → { quantity: 192, unit: 'oz', rawText: '6/32 oz' }
 * - "Almond Milk (6x32 oz)" → { quantity: 192, unit: 'oz', rawText: '6x32 oz' }
 * - "Water (33.8 fz)" → { quantity: 33.8, unit: 'fz', rawText: '33.8 fz' }
 * - "Eggs (18 ct)" → { quantity: 18, unit: 'ct', rawText: '18 ct' }
 * - "Eggs, 1 doz" → { quantity: 1, unit: 'doz', rawText: '1 doz' }
 * - "Butter (4 lb)" → { quantity: 4, unit: 'lb', rawText: '4 lb' }
 * - "Eggs" → { quantity: 0, unit: null, rawText: '' }
 */
export function parseUnitInfo(itemName: string): UnitInfo {
    // Match multi-pack patterns like (6/32 oz), (6x32 oz), (12/33.8 fz), (24x16.9 floz)
    const multiPackPattern = /\((\d+(?:\.\d+)?)\s*[\/x*-]\s*(\d+(?:\.\d+)?)\s*(lb|oz|fz|floz|fl\s*oz|qt|gal|gallon|L|ml)\)/i;
    const multiPackMatch = itemName.match(multiPackPattern);

    if (multiPackMatch) {
        const count = parseFloat(multiPackMatch[1]);
        const size = parseFloat(multiPackMatch[2]);
        let unit = multiPackMatch[3].toLowerCase();

        // Normalize fluid oz variations
        if (unit === 'floz' || unit.includes('fl')) unit = 'fz';
        // Normalize gallon
        if (unit === 'gallon') unit = 'gal';

        const totalQuantity = count * size;

        return {
            quantity: totalQuantity,
            unit: unit as any,
            rawText: multiPackMatch[0].replace(/[()]/g, '').trim(),
        };
    }

    // Match "half gallon" or "1/2 gallon" specifically
    const halfGallonPattern = /\((?:half|1\/2)\s*gallon\)/i;
    const halfGallonMatch = itemName.match(halfGallonPattern);
    if (halfGallonMatch) {
        return {
            quantity: 0.5,
            unit: 'gal',
            rawText: halfGallonMatch[0].replace(/[()]/g, '').trim(),
        };
    }

    // Match multi-pack count patterns like (6x18 ct), (2*12 ct), (4x6 pk)
    const multiPackCountPattern = /\((\d+(?:\.\d+)?)\s*[\/x*-]\s*(\d+(?:\.\d+)?)\s*(ct|doz|pk|ea)\)/i;
    const multiPackCountMatch = itemName.match(multiPackCountPattern);

    if (multiPackCountMatch) {
        const count = parseFloat(multiPackCountMatch[1]);
        const size = parseFloat(multiPackCountMatch[2]);
        const unit = multiPackCountMatch[3].toLowerCase() === 'pk' ? 'ct' : multiPackCountMatch[3].toLowerCase() as 'ct' | 'doz' | 'ea';
        const totalQuantity = count * size;

        return {
            quantity: totalQuantity,
            unit,
            rawText: multiPackCountMatch[0].replace(/[()]/g, '').trim(),
        };
    }

    // Match simple patterns like (4 lb), (32 oz), (33.8 fz), (1 gallon), (18 ct), (1.5 qt)
    const simplePattern = /[\(,]\s*(\d+(?:\.\d+)?)\s*(?:sq\s*)?(lb|oz|fz|floz|fl\s*oz|ct|doz|qt|gal|gallon|pt|L|ml|ft|in|pk|ea)[\),.]/i;
    const simpleMatch = itemName.match(simplePattern);

    if (simpleMatch) {
        const quantity = parseFloat(simpleMatch[1]);
        let unit = simpleMatch[2].toLowerCase();

        // Normalize variations
        if (unit === 'floz' || unit.includes('fl')) unit = 'fz';
        if (unit === 'gallon') unit = 'gal';

        // Check if it's an area measurement (preceded by 'sq')
        const isSquare = /sq\s*(ft|in)/i.test(simpleMatch[0]);
        if (isSquare && unit === 'ft') unit = 'sqft';
        if (isSquare && unit === 'in') unit = 'sqin';

        // Normalize unit aliases
        if (unit === 'pk') unit = 'ct';
        if (unit === 'l') unit = 'L'; // Standard notation

        return {
            quantity,
            unit: unit as any,
            rawText: simpleMatch[0].replace(/[(),]/g, '').trim(),
        };
    }

    // Match compact formats like 5lb, 32oz, 1gal, 8pk
    const compactPattern = /(\d+(?:\.\d+)?)(lb|oz|fz|floz|fl\s*oz|ct|doz|qt|gal|gallon|pt|L|ml|pk|ea)\b/i;
    const compactMatch = itemName.match(compactPattern);

    if (compactMatch) {
        const quantity = parseFloat(compactMatch[1]);
        let unit = compactMatch[2].toLowerCase();

        // Normalize variations
        if (unit === 'floz' || unit.includes('fl')) unit = 'fz';
        if (unit === 'gallon') unit = 'gal';
        if (unit === 'pk') unit = 'ct';
        if (unit === 'l') unit = 'L';

        return {
            quantity,
            unit: unit as any,
            rawText: compactMatch[0].trim(),
        };
    }

    // Match unit-only patterns like (lb), (fz), (gallon)
    const unitOnlyPattern = /\((lb|oz|fz|floz|fl\s*oz|ct|doz|ea|qt|gal|gallon|pt|L|ml)\)/i;
    const unitOnlyMatch = itemName.match(unitOnlyPattern);

    if (unitOnlyMatch) {
        let unit = unitOnlyMatch[1].toLowerCase();
        if (unit === 'floz' || unit.includes('fl')) unit = 'fz';
        if (unit === 'gallon') unit = 'gal';
        if (unit === 'l') unit = 'L';

        return {
            quantity: 1,
            unit: unit as any,
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
 * For volume-based items: returns price per fluid ounce (fl oz)
 * For area-based items: returns price per square foot
 * 
 * @param itemName - Full item name
 * @param price - Price of the item
 * @returns Object with unitPrice and unitType, or null if not applicable
 */
export function calculateUnitPrice(itemName: string, price: number): { unitPrice: number; unitType: 'lb' | 'ea' | 'fl oz' | 'sqft' } | null {
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

    // Handle volume-based units (convert to price per fl oz)
    const volumeUnits = ['fz', 'qt', 'gal', 'pt', 'L', 'ml'];
    if (volumeUnits.includes(unitInfo.unit)) {
        let quantityInFloz = unitInfo.quantity;

        // Convert to fluid ounces
        if (unitInfo.unit === 'qt') {
            quantityInFloz = unitInfo.quantity * 32; // 1 qt = 32 fl oz
        } else if (unitInfo.unit === 'gal') {
            quantityInFloz = unitInfo.quantity * 128; // 1 gal = 128 fl oz
        } else if (unitInfo.unit === 'pt') {
            quantityInFloz = unitInfo.quantity * 16; // 1 pt = 16 fl oz
        } else if (unitInfo.unit === 'L') {
            quantityInFloz = unitInfo.quantity * 33.814; // 1 L ≈ 33.814 fl oz
        } else if (unitInfo.unit === 'ml') {
            quantityInFloz = unitInfo.quantity * 0.033814; // 1 ml ≈ 0.033814 fl oz
        }

        return {
            unitPrice: price / quantityInFloz,
            unitType: 'fl oz'
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
 * @returns Formatted string (e.g., "$2.00/lb", "$0.15/ea", "$0.10/fl oz", "$0.10/sqft")
 */
export function formatUnitPrice(result: { unitPrice: number; unitType: 'lb' | 'ea' | 'fl oz' | 'sqft' } | null): string | null {
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
