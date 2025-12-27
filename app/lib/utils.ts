// app/lib/utils.ts
// Shared utility functions for SmartSaveAI

// ============================================================================
// CONSTANTS
// ============================================================================

export const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

// ============================================================================
// DATE UTILITIES
// ============================================================================

export const getDaysAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
};

export const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

// ============================================================================
// PRICE UTILITIES
// ============================================================================

export interface PriceData {
  price: string;
  date: string;
}

export interface StoreData {
  total: number;
  coverage: number;
  itemCount: number;
}

export type PriceClassificationType = 'best' | 'close' | 'skip' | null;

export const getPriceClassification = (
  itemName: string, 
  currentPrice: number,
  prices: {[key: string]: PriceData | string},
  stores: string[]
): PriceClassificationType => {
  // Get all prices for this item across all stores
  const itemPrices: number[] = [];
  
  stores.forEach(store => {
    const priceData = prices[`${store}-${itemName}`];
    if (priceData) {
      const price = typeof priceData === 'string' 
        ? parseFloat(priceData) 
        : parseFloat(priceData.price);
      if (price > 0) {
        itemPrices.push(price);
      }
    }
  });

  if (itemPrices.length === 0) return null;

  const minPrice = Math.min(...itemPrices);
  const maxPrice = Math.max(...itemPrices);
  const range = maxPrice - minPrice;

  // If all prices are the same, it's neutral
  if (range === 0) return null;

  const threshold = range * 0.33;

  if (currentPrice <= minPrice + threshold) {
    return 'best';
  } else if (currentPrice >= maxPrice - threshold) {
    return 'skip';
  } else {
    return 'close';
  }
};

export const formatPrice = (price: number | string): string => {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  return `$${numPrice.toFixed(2)}`;
};

// ============================================================================
// PRICE INPUT FORMATTING
// ============================================================================

export const formatPriceInput = (value: string): string => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  let priceValue = '';
  if (digits !== '') {
    // Convert to cents, then to dollars
    const cents = parseInt(digits, 10);
    priceValue = (cents / 100).toFixed(2);
  }
  
  return priceValue;
};

// ============================================================================
// STORE CALCULATION UTILITIES
// ============================================================================

export const calculateBestStores = (
  items: Array<{ item_name: string; quantity: number }>,
  prices: {[key: string]: PriceData},
  stores: string[]
): {[store: string]: StoreData} => {
  const storeData: {[store: string]: StoreData} = {};
  
  stores.forEach(store => {
    let total = 0;
    let coverage = 0;
    
    items.forEach(item => {
      const priceData = prices[`${store}-${item.item_name}`];
      if (priceData) {
        const price = parseFloat(priceData.price);
        total += price * item.quantity;
        coverage++;
      }
    });
    
    storeData[store] = {
      total,
      coverage,
      itemCount: items.length
    };
  });

  return storeData;
};

export const sortStoresByBestValue = (
  storeData: {[store: string]: StoreData}
): [string, StoreData][] => {
  return Object.entries(storeData)
    .filter(([, data]) => data.coverage > 0)
    .sort(([, a], [, b]) => {
      // Primary sort: coverage (descending)
      if (b.coverage !== a.coverage) {
        return b.coverage - a.coverage;
      }
      // Secondary sort: price (ascending)
      return a.total - b.total;
    });
};

// ============================================================================
// CLIPBOARD UTILITIES
// ============================================================================

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
};

// ============================================================================
// ALPHABET FILTER UTILITIES
// ============================================================================

export const getAlphabet = (): string[] => {
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
};

export const getAvailableLetters = (items: string[]): string[] => {
  const alphabet = getAlphabet();
  return alphabet.filter(letter => 
    items.some(item => item.toUpperCase().startsWith(letter))
  );
};

export const filterItemsByLetter = (
  items: string[], 
  letter: string
): string[] => {
  if (letter === 'All') return items.sort();
  return items.filter(item => item.toUpperCase().startsWith(letter)).sort();
};

// ============================================================================
// ITEM SORTING UTILITIES
// ============================================================================

export const sortItemsByFavorites = <T extends { item_name?: string; name?: string }>(
  items: T[],
  favorites: string[]
): T[] => {
  return items.sort((a, b) => {
    const aName = a.item_name || a.name || '';
    const bName = b.item_name || b.name || '';
    
    // First sort by favorite status (favorites first)
    const aIsFav = favorites.includes(aName);
    const bIsFav = favorites.includes(bName);
    if (aIsFav && !bIsFav) return -1;
    if (!aIsFav && bIsFav) return 1;
    
    // Then sort alphabetically
    return aName.localeCompare(bName);
  });
};