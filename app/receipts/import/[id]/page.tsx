'use client';
import { useState, useEffect, useRef, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { getFuzzyMatch } from '../../../lib/utils';
import Link from 'next/link';
import { ArrowLeftIcon, ExclamationTriangleIcon, PlusIcon, MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import ItemSearchableDropdown from '../../../components/ItemSearchableDropdown';
import StatusModal from '../../../components/StatusModal';
import ProcessingLoader from '../../../components/ProcessingLoader';
import { ReceiptItemBadges, ReceiptItemInputs, ReceiptItemCard } from '../../../components/receipt-items';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';

type ImportStatus = 'pending' | 'processed' | 'skipped';

interface ImportedReceipt {
    id: number;
    ocr_data: any;
    store_id: string | null;
    status: ImportStatus;
    created_at: string;
}

interface ReconciliationRow {
    ocrName: string;
    ocrNormalizedName?: string;
    ocrPrice: string;
    ocrQuantity: string;
    ocrUnit?: string;
    ocrSku?: string;
    isWeighted?: boolean;

    // Weight estimation for bulk items
    estimatedWeight?: number; // Calculated weight in lbs
    pricePerLb?: number; // Historical price per lb used for estimation

    // OCR correction
    ocrCorrectedName?: string; // Name after OCR error correction

    // Selection state
    status: 'matched' | 'new' | 'unresolved';
    selectedItemId?: string; // ID of existing item
    selectedItemName?: string; // Name of existing item
    newItemName?: string; // Name for NEW item

    confidence: 'high' | 'low';
    isConfirmed: boolean;
    isSkuMatch?: boolean; // True if matched via SKU (highest confidence)
    isTaxed?: boolean; // True if item is taxable
    taxAmount?: number; // Calculated tax amount
    discountApplied?: number; // Coupon/discount amount applied to this item
}

export default function ReceiptImportPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const autopilot = searchParams.get('autopilot') === 'true';

    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number } | null>(null);
    const [receipt, setReceipt] = useState<ImportedReceipt | null>(null);
    const [rows, setRows] = useState<ReconciliationRow[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [allItems, setAllItems] = useState<{ id: string, name: string, unit?: string, is_weighted?: boolean }[]>([]);
    const [storeId, setStoreId] = useState<string>('');
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState<{ current: number; total: number; status: string } | null>(null);
    const [ocrDate, setOcrDate] = useState<string>('');
    const [ocrTime, setOcrTime] = useState<string>('');
    const [statusModal, setStatusModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info' | 'warning';
        onCloseOverride?: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });
    const unwrappedParams = use(params);


    useEffect(() => {
        loadData();
    }, [unwrappedParams.id]);

    // Auto-Pilot Trigger
    useEffect(() => {
        const householdCode = localStorage.getItem('household_code') || '';
        const isMasterAdmin = householdCode === 'ASDF';

        // If loaded, autopilot is on, generally valid state, and NOT importing yet
        if (!loading && autopilot && !isMasterAdmin && !importing && rows.length > 0) {
            // Check if finalizeImport is available closure-wise? Yes.
            // But we need to ensure we haven't already tried.
            // `importing` flag handles the lock.
            finalizeImport();
        }
    }, [loading, autopilot, importing, rows.length]);

    const loadData = async () => {
        try {
            const householdCode = localStorage.getItem('household_code') || '';
            const isMasterAdmin = householdCode === 'ASDF';
            const shouldUseAutopilot = autopilot && !isMasterAdmin;

            if (!householdCode) {
                setStatusModal({
                    isOpen: true,
                    title: 'Missing Access',
                    message: "No household code found. Please sign in.",
                    type: 'error',
                    onCloseOverride: () => router.push('/')
                });
                return;
            }

            // 1. Load Receipt Data
            const { data: receiptData, error } = await supabase
                .from('imported_receipts')
                .select('*')
                .eq('id', unwrappedParams.id)
                .single();

            if (error || !receiptData) {
                console.error("Error loading receipt:", error);
                setStatusModal({
                    isOpen: true,
                    title: 'Not Found',
                    message: "Receipt not found.",
                    type: 'error',
                    onCloseOverride: () => router.push('/receipts')
                });
                return;
            }

            if (receiptData.status === 'processed') {
                setStatusModal({
                    isOpen: true,
                    title: 'Already Processed',
                    message: "This receipt has already been processed.",
                    type: 'info',
                    onCloseOverride: () => router.push('/receipts')
                });
                return;
            }

            setReceipt(receiptData);
            setStoreId(receiptData.store_id || '');

            // Set date/time from OCR if present
            if (receiptData.ocr_data?.date) setOcrDate(receiptData.ocr_data.date);
            if (receiptData.ocr_data?.time) setOcrTime(receiptData.ocr_data.time);

            // 2. Load Metadata (Stores, Items, Aliases, SKU Mappings, Price History for weight estimation)
            // 2. Load Metadata (Stores, Items, Aliases, SKU Mappings, Price History for weight estimation)
            // Filter stores to ONLY favorites for this household
            const { data: favoriteStores } = await supabase
                .from('household_store_favorites')
                .select('store_id, stores(id, name)')
                .eq('household_code', householdCode);

            const userStores = favoriteStores?.map(f => f.stores).filter(Boolean) || [];

            const [allStoresRes, itemsRes, aliasesRes, skuRes, priceHistoryRes] = await Promise.all([
                supabase.from('stores').select('id, name').order('name'),
                supabase.from('items').select('id, name, unit, is_weighted').order('name'),
                supabase.from('item_aliases').select('alias, item_id, items(name, unit, is_weighted), store_id'),
                // Fetch SKU mappings for this store (if store is known)
                receiptData.store_id
                    ? supabase.from('store_item_sku')
                        .select('store_sku, item_id, items(id, name, unit, is_weighted)')
                        .eq('store_id', receiptData.store_id)
                    : Promise.resolve({ data: [] }),
                // Fetch recent price history for weighted items at this store (for weight estimation)
                receiptData.store_id
                    ? supabase.from('price_history')
                        .select('item_id, item_name, price, unit, is_weighted, recorded_date')
                        .eq('store_id', receiptData.store_id)
                        .eq('is_weighted', true)
                        .order('recorded_date', { ascending: false })
                        .limit(500)
                    : Promise.resolve({ data: [] })
            ]);

            // Fallback to all stores if no favorites (or load all for manual selection but prioritization)
            const storesList = allStoresRes.data || [];

            setStores(storesList);
            const itemsList = itemsRes.data || [];
            setAllItems(itemsList);

            // AUTO-SELECT STORE FROM FAVORITES
            // If we haven't selected a store yet, try to fuzzy match the OCR detected store against the USER'S FAVORITES
            if (!receiptData.store_id && receiptData.ocr_data?.store) {
                const detectedName = receiptData.ocr_data.store.toLowerCase();

                const match = (userStores as any[]).find((s: any) =>
                    detectedName.includes(s.name.toLowerCase()) ||
                    s.name.toLowerCase().includes(detectedName)
                );

                if (match) {
                    setStoreId(match.id);
                    // Also trigger a reload of SKUs for this store!
                    // Note: This requires a state update effect or manual fetch here.
                    // For simplicity, we'll rely on the useEffect([storeId]) if we were using one,
                    // but since loadData is one-shot, we might need to manually fetch SKUs for this new ID *right now*.

                    // Re-fetch SKU mappings for the auto-selected store
                    const { data: newSkuRes } = await supabase.from('store_item_sku')
                        .select('store_sku, item_id, items(id, name, unit, is_weighted)')
                        .eq('store_id', match.id);

                    if (newSkuRes) {
                        // Update the skuRes variable so the rest of the function uses it
                        skuRes.data = newSkuRes;
                    }
                }
            }

            const aliases = aliasesRes.data || [];

            // Build SKU lookup map: sku -> item data
            const skuMappings = skuRes.data || [];
            const skuMap = new Map<string, { itemId: string, itemName: string, unit?: string, isWeighted?: boolean }>();
            for (const mapping of skuMappings) {
                if (mapping.store_sku && mapping.items) {
                    const itemData = Array.isArray(mapping.items) ? mapping.items[0] : mapping.items;
                    skuMap.set(mapping.store_sku.toLowerCase(), {
                        itemId: mapping.item_id,
                        itemName: itemData?.name || '',
                        unit: itemData?.unit,
                        isWeighted: itemData?.is_weighted
                    });
                }
            }

            // Build price-per-lb lookup for weighted items (for weight estimation)
            // Use most recent price for each item
            const priceHistory = priceHistoryRes.data || [];
            const pricePerLbMap = new Map<string, { pricePerLb: number, itemName: string }>();
            for (const record of priceHistory) {
                if (record.item_id && record.price && !pricePerLbMap.has(record.item_id)) {
                    // Only use first (most recent) price for each item
                    pricePerLbMap.set(record.item_id, {
                        pricePerLb: record.price,
                        itemName: record.item_name
                    });
                }
            }

            // OCR error correction helper: find close matches for misspelled names
            // Uses Levenshtein distance for character-level typo detection
            const correctOcrName = (ocrName: string): string | undefined => {
                const normalizedOcr = ocrName.toLowerCase().trim();

                // Build list of known names to check against
                const knownNames: string[] = [
                    ...itemsList.map(i => i.name),
                    ...aliases.map((a: any) => a.alias)
                ];

                // Check each known name for close match (edit distance <= 2)
                for (const knownName of knownNames) {
                    const normalizedKnown = knownName.toLowerCase().trim();

                    // Skip if exact match (no correction needed)
                    if (normalizedOcr === normalizedKnown) continue;

                    // Skip if lengths differ significantly
                    if (Math.abs(normalizedOcr.length - normalizedKnown.length) > 2) continue;

                    // Calculate edit distance (simple Levenshtein)
                    const distance = levenshteinDistance(normalizedOcr, normalizedKnown);

                    // If within 1-2 edits and name is reasonably long, likely OCR error
                    if (distance <= 2 && normalizedOcr.length >= 4) {
                        return knownName;
                    }
                }

                return undefined;
            };

            // Levenshtein distance calculation
            const levenshteinDistance = (a: string, b: string): number => {
                const matrix: number[][] = [];

                for (let i = 0; i <= b.length; i++) {
                    matrix[i] = [i];
                }
                for (let j = 0; j <= a.length; j++) {
                    matrix[0][j] = j;
                }

                for (let i = 1; i <= b.length; i++) {
                    for (let j = 1; j <= a.length; j++) {
                        if (b.charAt(i - 1) === a.charAt(j - 1)) {
                            matrix[i][j] = matrix[i - 1][j - 1];
                        } else {
                            matrix[i][j] = Math.min(
                                matrix[i - 1][j - 1] + 1, // substitution
                                matrix[i][j - 1] + 1,     // insertion
                                matrix[i - 1][j] + 1      // deletion
                            );
                        }
                    }
                }

                return matrix[b.length][a.length];
            };

            // Helper: strictly calculate weight based on user's own history
            // Returns the estimated weight (qty) and the historical unit price used
            const calculateWeightFromHistory = (itemId: string, totalPrice: number, itemIsWeighted: boolean | undefined): { quantity: string; pricePerLb: number | undefined } | null => {
                if (!itemIsWeighted || totalPrice <= 0) return null;

                if (pricePerLbMap.has(itemId)) {
                    const history = pricePerLbMap.get(itemId)!;
                    const pPerLb = history.pricePerLb;

                    if (pPerLb > 0) {
                        const estWeight = totalPrice / pPerLb;
                        // Sanity check: Weight shouldn't be microscopic or massive (0.1lb to 50lb)
                        if (estWeight > 0.05 && estWeight < 50) {
                            return {
                                quantity: estWeight.toFixed(2),
                                pricePerLb: pPerLb
                            };
                        }
                    }
                }
                return null;
            };



            // 3. Process Rows (The "AI" Logic Re-run/Refinement)
            const ocrItems = receiptData.ocr_data?.items || [];
            const totalOcrItems = ocrItems.length;
            setLoadingProgress({ current: 0, total: totalOcrItems });

            const processedRows: ReconciliationRow[] = [];
            for (let itemIndex = 0; itemIndex < ocrItems.length; itemIndex++) {
                const item = ocrItems[itemIndex];

                // Update progress
                setLoadingProgress({ current: itemIndex, total: totalOcrItems });
                const ocrName = item.name;
                const ocrNormalizedName = item.normalized_name;
                const ocrUnit = item.unit;
                const ocrSku = item.sku;
                const isWeighted = item.is_weighted;

                const itemPrice = parseFloat(item.price?.toString() || '0');

                // Apply OCR error correction
                const correctedName = correctOcrName(ocrName);
                const ocrCorrectedName = correctedName;
                // Use corrected name for matching if available
                const nameForMatching = correctedName || ocrNormalizedName || ocrName;

                // DEBUG: Trace execution for Beef items
                if (ocrName?.toLowerCase().includes('beef') || ocrName?.includes('33724')) {
                    console.log(`[ProcessRow] Processing BEEF item:`, { ocrName, finalPrice: itemPrice, ocrSku, isWeighted });
                }

                // Strategy 0 (HIGHEST PRIORITY): SKU Match - Auto-confirm!
                if (ocrSku && skuMap.has(ocrSku.toLowerCase())) {
                    const skuMatch = skuMap.get(ocrSku.toLowerCase())!;

                    const est = calculateWeightFromHistory(skuMatch.itemId, itemPrice, skuMatch.isWeighted);

                    // If estimated, Price field shows Unit Price. Else shows Total.
                    const displayPrice = est
                        ? est.pricePerLb!.toFixed(2)
                        : (item.price ? parseFloat(item.price.toString()).toFixed(2) : '');

                    processedRows.push({
                        ocrName,
                        ocrNormalizedName,
                        ocrCorrectedName,
                        ocrPrice: displayPrice,
                        ocrQuantity: est ? est.quantity : (item.quantity?.toString() || '1'),
                        ocrUnit: skuMatch.unit && !['count', 'each'].includes(skuMatch.unit) ? skuMatch.unit : ocrUnit,
                        ocrSku,
                        isWeighted: skuMatch.isWeighted ?? isWeighted,
                        status: 'matched' as const,
                        selectedItemId: skuMatch.itemId,
                        selectedItemName: skuMatch.itemName,
                        confidence: 'high' as const,
                        isConfirmed: true, // AUTO-CONFIRM via SKU!
                        isSkuMatch: true,
                        pricePerLb: est?.pricePerLb
                    });
                    await new Promise(r => setTimeout(r, 30));
                    continue;
                }

                // Strategy A: Exact Alias Match (Prefer Store Specific, Fallback to Global)
                // Try with original name first, then corrected name
                const namesToTry = [ocrName, ...(correctedName ? [correctedName] : [])];
                let exactAlias: any = null;

                for (const tryName of namesToTry) {
                    exactAlias = aliases.find((a: any) =>
                        a.alias.toLowerCase() === tryName.toLowerCase() &&
                        a.store_id === receiptData.store_id
                    );
                    if (exactAlias) break;

                    // Fallback to global alias if no store-specific one found
                    exactAlias = aliases.find((a: any) =>
                        a.alias.toLowerCase() === tryName.toLowerCase()
                    );
                    if (exactAlias) break;
                }

                if (exactAlias) {
                    const itemData = Array.isArray(exactAlias.items) ? exactAlias.items[0] : (exactAlias.items as any);
                    const isItemWeighted = itemData?.is_weighted ?? isWeighted;
                    const est = calculateWeightFromHistory(exactAlias.item_id, itemPrice, isItemWeighted);

                    const displayPrice = est
                        ? est.pricePerLb!.toFixed(2)
                        : (item.price ? parseFloat(item.price.toString()).toFixed(2) : '');

                    processedRows.push({
                        ocrName,
                        ocrNormalizedName,
                        ocrCorrectedName,
                        ocrPrice: displayPrice,
                        ocrQuantity: est ? est.quantity : (item.quantity?.toString() || '1'),
                        ocrUnit: itemData?.unit && itemData.unit !== 'count' ? itemData.unit : ocrUnit,
                        ocrSku,
                        isWeighted: isItemWeighted,
                        status: 'matched' as const,
                        selectedItemId: exactAlias.item_id,
                        selectedItemName: itemData?.name,
                        confidence: 'high' as const,
                        isConfirmed: shouldUseAutopilot ? true : false,
                        pricePerLb: est?.pricePerLb
                    });
                    await new Promise(r => setTimeout(r, 30));
                    continue;
                }

                // Strategy B: Exact Name Match (using corrected name if available)
                const exactItem = itemsList.find(i => i.name.toLowerCase() === nameForMatching.toLowerCase());
                if (exactItem) {
                    const isItemWeighted = exactItem.is_weighted ?? isWeighted;
                    const est = calculateWeightFromHistory(exactItem.id, itemPrice, isItemWeighted);

                    const displayPrice = est
                        ? est.pricePerLb!.toFixed(2)
                        : (item.price ? parseFloat(item.price.toString()).toFixed(2) : '');

                    processedRows.push({
                        ocrName,
                        ocrNormalizedName,
                        ocrCorrectedName,
                        ocrPrice: displayPrice,
                        ocrQuantity: est ? est.quantity : (item.quantity?.toString() || '1'),
                        ocrUnit: exactItem.unit && !['count', 'each'].includes(exactItem.unit) ? exactItem.unit : ocrUnit,
                        ocrSku,
                        isWeighted: isItemWeighted,
                        status: 'matched' as const,
                        selectedItemId: exactItem.id,
                        selectedItemName: exactItem.name,
                        confidence: 'high' as const,
                        isConfirmed: shouldUseAutopilot ? true : (correctedName ? true : false), // Auto-confirm if OCR was corrected to exact match
                        pricePerLb: est?.pricePerLb
                    });
                    await new Promise(r => setTimeout(r, 30));
                    continue;
                }

                // Strategy C: Fuzzy Match
                const candidateNames = itemsList.map(i => i.name);
                // Also look at aliases for fuzzy matching
                const aliasNames = aliases.map((a: any) => a.alias);

                // Fuzzy against Aliases first (strong signal)
                const fuzzyAliasName = getFuzzyMatch(nameForMatching, aliasNames);
                if (fuzzyAliasName) {
                    const match = aliases.find((a: any) => a.alias === fuzzyAliasName);
                    if (match) {
                        const itemData = Array.isArray(match.items) ? match.items[0] : (match.items as any);
                        const isItemWeighted = itemData?.is_weighted ?? isWeighted;
                        const est = calculateWeightFromHistory(match.item_id, itemPrice, isItemWeighted);

                        const displayPrice = est
                            ? est.pricePerLb!.toFixed(2)
                            : (item.price ? parseFloat(item.price.toString()).toFixed(2) : '');

                        processedRows.push({
                            ocrName,
                            ocrNormalizedName,
                            ocrCorrectedName,
                            ocrPrice: displayPrice,
                            ocrQuantity: est ? est.quantity : (item.quantity?.toString() || '1'),
                            ocrUnit: itemData?.unit && itemData.unit !== 'count' ? itemData.unit : ocrUnit,
                            ocrSku,
                            isWeighted: isItemWeighted,
                            status: 'matched' as const,
                            selectedItemId: match.item_id,
                            selectedItemName: itemData?.name,
                            confidence: 'low' as const,
                            isConfirmed: shouldUseAutopilot ? true : false,
                            pricePerLb: est?.pricePerLb
                        });
                        await new Promise(r => setTimeout(r, 30));
                        continue;
                    }
                }

                // Fuzzy against Items
                const fuzzyItemName = getFuzzyMatch(nameForMatching, candidateNames);
                if (fuzzyItemName) {
                    const match = itemsList.find(i => i.name === fuzzyItemName);
                    if (match) {
                        const isItemWeighted = match.is_weighted ?? isWeighted;
                        const est = calculateWeightFromHistory(match.id, itemPrice, isItemWeighted);

                        const displayPrice = est
                            ? est.pricePerLb!.toFixed(2)
                            : (item.price ? parseFloat(item.price.toString()).toFixed(2) : '');

                        processedRows.push({
                            ocrName,
                            ocrNormalizedName,
                            ocrCorrectedName,
                            ocrPrice: displayPrice,
                            ocrQuantity: est ? est.quantity : (item.quantity?.toString() || '1'),
                            ocrUnit: match.unit && !['count', 'each'].includes(match.unit) ? match.unit : ocrUnit,
                            ocrSku,
                            isWeighted: isItemWeighted,
                            status: 'matched' as const,
                            selectedItemId: match.id,
                            selectedItemName: match.name,
                            confidence: 'low' as const,
                            isConfirmed: shouldUseAutopilot ? true : false,
                            pricePerLb: est?.pricePerLb
                        });
                        await new Promise(r => setTimeout(r, 30));
                        continue;
                    }
                }

                // Strategy D: AI Auto-Match (Backend Injection)
                // The AI was given the list of items and asked to semantic match.
                if (item.ai_match) {
                    const matchedItem = itemsList.find(i => i.name === item.ai_match);
                    if (matchedItem) {
                        const isItemWeighted = matchedItem.is_weighted ?? isWeighted;
                        const est = calculateWeightFromHistory(matchedItem.id, itemPrice, isItemWeighted);

                        const displayPrice = est
                            ? est.pricePerLb!.toFixed(2)
                            : (item.price ? parseFloat(item.price.toString()).toFixed(2) : '');

                        processedRows.push({
                            ocrName,
                            ocrNormalizedName,
                            ocrCorrectedName,
                            ocrPrice: displayPrice,
                            ocrQuantity: est ? est.quantity : (item.quantity?.toString() || '1'),
                            ocrUnit: matchedItem.unit && !['count', 'each'].includes(matchedItem.unit) ? matchedItem.unit : ocrUnit,
                            ocrSku,
                            isWeighted: isItemWeighted,
                            status: 'matched' as const,
                            selectedItemId: matchedItem.id,
                            selectedItemName: matchedItem.name,
                            confidence: 'low' as const,
                            isConfirmed: shouldUseAutopilot ? true : false,
                            pricePerLb: est?.pricePerLb
                        });
                        await new Promise(r => setTimeout(r, 30));
                        continue;
                    }
                }

                // Fallback: Default to "New Item" with cleaned name
                // Prefer corrected name > normalized name > raw OCR name
                processedRows.push({
                    ocrName,
                    ocrNormalizedName,
                    ocrCorrectedName,
                    ocrPrice: item.price ? parseFloat(item.price.toString()).toFixed(2) : '',
                    ocrQuantity: item.quantity?.toString() || '1',
                    ocrUnit,
                    ocrSku,
                    isWeighted,
                    status: 'new' as const,
                    newItemName: toTitleCase(correctedName || ocrNormalizedName || ocrName),
                    confidence: 'low' as const,
                    isConfirmed: shouldUseAutopilot ? true : false
                });

                // Small delay to allow UI to update progress
                await new Promise(r => setTimeout(r, 30));
            }

            setLoadingProgress({ current: totalOcrItems, total: totalOcrItems });
            // Post-processing: Handle coupons/discounts
            // Detect coupon rows and merge them with the target item
            // Now supports OCR-flagged discounts with is_discount and related_sku fields
            // Also supports legacy detection:
            // - Negative prices (e.g., -$6.00)
            // - Prices with trailing minus (Costco: 4.50-)
            // - Coupon keywords (savings, coupon, discount, off, instant, member)
            // - Costco format: coupon line contains "/ <product_sku>" matching target item
            const couponKeywords = ['savings', 'coupon', 'discount', 'off', 'instant', 'member'];
            const finalRows: ReconciliationRow[] = [];

            // First pass: add all non-discount items
            for (let i = 0; i < processedRows.length; i++) {
                const row = processedRows[i];
                const ocrItem = ocrItems[i]; // Original OCR data for this row
                const rawPrice = ocrItem?.price?.toString() || row.ocrPrice || '0';
                const rawName = ocrItem?.name || row.ocrName || '';

                // Parse price - handle trailing minus (Costco format: "4.50-")
                let price = parseFloat(row.ocrPrice || '0');

                // Check if OCR explicitly flagged this as a discount
                const isOcrDiscount = ocrItem?.is_discount === true;
                const relatedSku = ocrItem?.related_sku;

                // Check multiple places for trailing minus indicator (discount marker)
                // Costco uses "4.50-" format where minus at end means discount
                const hasTrailingMinus =
                    rawPrice.toString().trim().endsWith('-') ||          // Price field ends with -
                    rawName.match(/\d+\.\d{2}-/) !== null ||              // Name contains price with minus ANYWHERE
                    rawName.trim().endsWith('-');                         // Name ends with minus

                // Extract price from name if price field is empty/zero but name has a price pattern
                const priceInNameMatch = rawName.match(/(\d+\.\d{2})-?/);
                if (priceInNameMatch && (!price || price === 0)) {
                    price = parseFloat(priceInNameMatch[1]);
                }

                // Mark as negative if trailing minus detected or OCR flagged as discount
                if (hasTrailingMinus || isOcrDiscount) {
                    price = -Math.abs(price);
                }

                // Tax detection: Check for "A", "T", or "*" flags in price or name, or explicit tax flag from OCR
                // Pennsylvania sales tax is 6%
                const PA_TAX_RATE = 1.06;
                const isTaxed =
                    (ocrItem?.tax_code && /^[AT*]$/i.test(ocrItem.tax_code)) ||           // Explicit tax code (A, T, *)
                    /[.\s][AT*]\s*$/i.test(rawPrice.toString().trim()) ||                  // Price ends with " A", " T", " *"
                    /\d+[AT*]$/i.test(rawPrice.toString().replace(/\s/g, ''));             // "15.99A" (no space)

                let taxAmount = 0;

                // Ensure price is valid
                if ((!price || price === 0) && ocrItem?.price) {
                    price = parseFloat(ocrItem.price);
                }

                if (isTaxed && price > 0) {
                    const originalPrice = price;
                    // Calculate tax amount directly (6%)
                    const tax = originalPrice * 0.06;
                    taxAmount = Math.round(tax * 100) / 100;

                    // Update price to include tax
                    price = originalPrice + taxAmount;
                }

                const nameLower = row.ocrName.toLowerCase();
                const absPrice = Math.abs(price);

                // Check if this is a coupon/discount line
                const isNegativePrice = price < 0;
                const hasCouponKeyword = couponKeywords.some(kw => nameLower.includes(kw));

                // Extract SKU after slash for Costco format (coupon ID / product SKU)
                let extractedRelatedSku: string | undefined;
                if (row.ocrName.includes('/')) {
                    const skuMatch = row.ocrName.match(/\/\s*(\d{5,})/); // SKU is typically 5+ digits
                    if (skuMatch) {
                        extractedRelatedSku = skuMatch[1];
                    }
                }

                // Use OCR-provided related_sku or extracted one
                const targetSku = relatedSku || extractedRelatedSku;

                // Detect coupon lines by pattern: ONLY numbers and slashes (no letters = no product name)
                const looksLikeCouponLine = /^\d+\s*\/\s*\d+\s*[\d.,-]*$/.test(row.ocrName.trim()) && absPrice > 0 && absPrice < 50;

                // Detect if it's a line that ONLY has numbers/price (no product name letters)
                const isPriceOnlyLine = /^[\d\s.,-\/]+$/.test(row.ocrName.trim()) && absPrice > 0 && absPrice < 50;

                // Determine if this is a coupon line
                // NEVER treat SKU-matched items as coupons - they are real products!
                const isCouponLine = !row.isSkuMatch && (
                    isOcrDiscount ||           // OCR explicitly flagged as discount
                    isNegativePrice ||         // Has negative price
                    looksLikeCouponLine ||     // Pattern: "1234567 / 9876543"
                    (isPriceOnlyLine && isNegativePrice) || // Only price-only lines if NEGATIVE
                    (hasCouponKeyword && absPrice < 20)  // Has coupon keyword
                );

                if (isCouponLine) {
                    const discountAmount = Math.abs(price);

                    // Try to find the target item by related SKU
                    let targetIndex = -1;
                    if (targetSku) {
                        targetIndex = finalRows.findIndex(r => r.ocrSku === targetSku);
                    }

                    // Fallback: apply to previous item if no SKU match found
                    if (targetIndex < 0 && finalRows.length > 0) {
                        targetIndex = finalRows.length - 1;
                    }

                    if (targetIndex >= 0) {
                        const targetRow = finalRows[targetIndex];
                        let currentTotal = parseFloat(targetRow.ocrPrice || '0');

                        // Recalculate base price (remove existing tax if any)
                        let currentBase = currentTotal;
                        if (targetRow.isTaxed && targetRow.taxAmount) {
                            currentBase = currentTotal - targetRow.taxAmount;
                        }

                        // Apply new discount to the base price
                        const newBasePrice = Math.max(0, currentBase - discountAmount);
                        let newTotal = newBasePrice;
                        let newTaxAmount = targetRow.taxAmount || 0;

                        // Recalculate tax based on the discounted base price
                        if (targetRow.isTaxed) {
                            const newTax = newBasePrice * 0.06;
                            newTaxAmount = Math.round(newTax * 100) / 100;
                            newTotal = newBasePrice + newTaxAmount;
                        }

                        // Update target row with discounted price and track discount amount
                        finalRows[targetIndex] = {
                            ...targetRow,
                            ocrPrice: newTotal.toFixed(2),
                            discountApplied: (targetRow.discountApplied || 0) + discountAmount,
                            taxAmount: newTaxAmount
                        };
                    }
                } else {
                    // Regular item, add to final list
                    // Include updated price (with tax if applicable) and tax flag
                    const finalPrice = price > 0 ? price.toFixed(2) : parseFloat(row.ocrPrice || '0').toFixed(2);
                    finalRows.push({
                        ...row,
                        ocrPrice: finalPrice,
                        isTaxed,
                        taxAmount,
                        discountApplied: 0
                    });
                }
            }

            // DEBUG: Identify culprit for high total
            console.group("Final Processed Rows Results");
            const debugTable = finalRows.map(r => {
                const p = parseFloat(r.ocrPrice || '0');
                const q = parseFloat(r.ocrQuantity || '1');
                return {
                    Name: r.ocrName,
                    Price: p,
                    Qty: q,
                    Total: (p * q).toFixed(2),
                    IsWeighted: r.isWeighted
                };
            });
            // Sort by Total descending
            debugTable.sort((a, b) => parseFloat(b.Total) - parseFloat(a.Total));
            console.table(debugTable);
            console.groupEnd();

            setRows(finalRows);
            setLoading(false);

        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    const toTitleCase = (str: string) => {
        return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    };

    const subtotal = rows.reduce((acc, row) => acc + (parseFloat(row.ocrPrice || '0') * parseFloat(row.ocrQuantity || '1')), 0);
    const confirmedTotal = rows.filter(r => r.isConfirmed).reduce((acc, row) => acc + (parseFloat(row.ocrPrice || '0') * parseFloat(row.ocrQuantity || '1')), 0);

    const handleRowChange = (index: number, updates: Partial<ReconciliationRow>) => {
        const newRows = [...rows];
        newRows[index] = { ...newRows[index], ...updates };
        setRows(newRows);
    };

    const handleRemoveRow = (index: number) => {
        const newRows = rows.filter((_, i) => i !== index);
        setRows(newRows);
    };

    const finalizeImport = async () => {
        setImporting(true);
        const householdCode = localStorage.getItem('household_code');
        const shouldAddTrip = receipt?.ocr_data?.should_add_trip !== false; // Default to true if missing
        const confirmedRows = rows.filter(r => r.isConfirmed);
        const totalItems = confirmedRows.length;

        try {
            if (!storeId) throw new Error("Please select a store.");

            setImportProgress({ current: 0, total: totalItems, status: `0/${totalItems} items processed` });

            let tripId = null;
            const dateStr = ocrDate || receipt?.ocr_data?.date || new Date().toISOString().split('T')[0];
            const timeStr = ocrTime || receipt?.ocr_data?.time || '12:00';
            const isoDate = `${dateStr}T${timeStr}:00`;

            const tripEndDate = new Date(isoDate);

            // 1. Create Trip (if enabled)
            if (shouldAddTrip) {
                const tripStartDate = new Date(tripEndDate.getTime() - 20 * 60 * 1000); // 20 mins earlier

                const { data: trip, error: tripError } = await supabase
                    .from('trips')
                    .insert({
                        household_code: householdCode,
                        store_id: storeId,
                        store: stores.find(s => s.id === storeId)?.name || 'Unknown Store',
                        started_at: tripStartDate.toISOString(),
                        ended_at: tripEndDate.toISOString()
                    })
                    .select()
                    .single();

                if (tripError) throw tripError;
                tripId = trip.id;
            }

            // 2. Process Items
            let processedCount = 0;
            for (const row of confirmedRows) {
                setImportProgress({
                    current: processedCount,
                    total: totalItems,
                    status: `${processedCount}/${totalItems} items processed`
                });
                let finalItemId = row.selectedItemId;

                // A. Create New Item if needed
                if (row.status === 'new') {
                    if (!row.newItemName) continue;

                    const { data: existing } = await supabase.from('items').select('id').eq('name', row.newItemName).single();

                    if (existing) {
                        finalItemId = existing.id;
                    } else {
                        const { data: newItem, error: createError } = await supabase
                            .from('items')
                            .insert({
                                name: row.newItemName,
                                household_code: householdCode,
                                unit: row.ocrUnit || 'count',
                                is_weighted: row.isWeighted || false
                            })
                            .select()
                            .single();
                        if (createError) throw createError;
                        finalItemId = newItem.id;
                    }
                }

                // B. Learn Alias
                const finalItemName = row.status === 'matched' ? row.selectedItemName : row.newItemName;

                if (finalItemId && row.ocrName && finalItemName && storeId) {
                    const isExactName = row.ocrName.toLowerCase() === finalItemName.toLowerCase();
                    if (!isExactName) {
                        const { error: aliasError } = await supabase.from('item_aliases').upsert({
                            item_id: finalItemId,
                            store_id: storeId,
                            alias: row.ocrName
                        }, {
                            onConflict: 'alias,store_id'
                        });

                        if (aliasError) {
                            console.error('Alias error:', aliasError.message);
                        }
                    }
                }

                // C. Create Shopping List Event (if trip exists)
                if (finalItemId && tripId) {
                    await supabase.from('shopping_list_events').insert({
                        trip_id: tripId,
                        household_code: householdCode,
                        store_id: storeId,
                        store: stores.find(s => s.id === storeId)?.name || 'Unknown Store',
                        item_id: finalItemId,
                        item_name: finalItemName,
                        raw_name: row.ocrName,
                        unit: row.ocrUnit || 'count',
                        is_weighted: row.isWeighted || false,
                        price: parseFloat(parseFloat(row.ocrPrice || '0').toFixed(2)) || 0,
                        quantity: parseFloat(row.ocrQuantity || '1') || 1,
                        checked_at: tripEndDate.toISOString()
                    });
                }

                // D. Log Price History (Always do this)
                if (finalItemId) {
                    await supabase.from('price_history').insert({
                        item_id: finalItemId,
                        item_name: finalItemName,
                        raw_name: row.ocrName,
                        unit: row.ocrUnit || 'count',
                        is_weighted: row.isWeighted || false,
                        store_id: storeId,
                        store: stores.find(s => s.id === storeId)?.name || 'Unknown Store',
                        price: parseFloat(row.ocrPrice || '0') || 0,
                        recorded_date: dateStr,
                        household_code: householdCode,
                        user_id: SHARED_USER_ID
                    });
                }

                // E. Store SKU (if extracted from receipt)
                if (finalItemId && row.ocrSku) {
                    await supabase.from('store_item_sku').upsert(
                        {
                            store_id: storeId,
                            item_id: finalItemId,
                            store_sku: row.ocrSku
                        },
                        { onConflict: 'store_id,item_id' }
                    );
                }

                // Update progress
                processedCount++;
                setImportProgress({
                    current: processedCount,
                    total: totalItems,
                    status: `${processedCount}/${totalItems} items processed`
                });
                // Delay to allow UI to update (visible progress)
                await new Promise(r => setTimeout(r, 200));
            }

            // 3. Mark Receipt Processed
            setImportProgress({ current: totalItems, total: totalItems, status: `${totalItems}/${totalItems} items processed - Saving...` });
            await supabase.from('imported_receipts').update({ status: 'processed' }).eq('id', unwrappedParams.id);

            setImportProgress(null);
            setImporting(false);
            setStatusModal({
                isOpen: true,
                title: 'Import Success',
                message: shouldAddTrip ? "Receipt imported and trip recorded!" : "Receipt items and prices imported!",
                type: 'success',
                onCloseOverride: () => router.push(autopilot ? `/receipts/upload-success${tripId ? '?tripId=' + tripId : ''}` : '/receipts')
            });

        } catch (err: any) {
            console.error(err);
            setImportProgress(null);
            setStatusModal({
                isOpen: true,
                title: 'Import Failed',
                message: err.message,
                type: 'error'
            });
            setImporting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-blue-500 bg-gradient-to-br from-blue-500 to-green-400 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4">
                    <ProcessingLoader progress={loadingProgress} />
                </div>
            </div>
        );
    }

    // Auto-Pilot Overlay (Processing Phase before Redirect)
    const householdCode = typeof window !== 'undefined' ? localStorage.getItem('household_code') : '';
    const isMasterAdmin = householdCode === 'ASDF';

    if (autopilot && !isMasterAdmin) { // Always show overlay if autopilot is engaged
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-white rounded-3xl max-w-sm w-full p-8 shadow-xl flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                        <ArrowPathIcon className="w-8 h-8 text-blue-600 animate-spin" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Finalizing Receipt...</h2>
                    <p className="text-sm text-gray-500 mb-6">Saving your items to the pantry.</p>

                    {importProgress && (
                        <div className="w-full space-y-2">
                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-blue-600 h-full transition-all duration-300"
                                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-gray-400">{importProgress.status}</p>
                        </div>
                    )}
                </div>
                <StatusModal
                    isOpen={statusModal.isOpen}
                    title={statusModal.title}
                    message={statusModal.message}
                    type={statusModal.type}
                    onClose={statusModal.onCloseOverride || (() => setStatusModal({ ...statusModal, isOpen: false }))}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-blue-500 bg-gradient-to-br from-blue-500 to-green-400 pb-20">
            <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
                <Link href="/receipts" className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
                </Link>
                <h1 className="font-bold text-lg flex-1">Review Receipt</h1>
                <button
                    onClick={finalizeImport}
                    disabled={importing || !rows.some(r => r.isConfirmed)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50 shadow-lg shadow-blue-200"
                >
                    {importing && importProgress
                        ? `${importProgress.current}/${importProgress.total} processed`
                        : importing
                            ? "Importing..."
                            : `Confirm ${rows.filter(r => r.isConfirmed).length} ($${confirmedTotal.toFixed(2)})`}
                </button>
            </div>

            <div className="max-w-3xl mx-auto p-4">
                {/* Import Progress Overlay */}
                {importing && importProgress && (
                    <div className="bg-white rounded-2xl shadow-xl p-6 mb-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                            <span className="font-bold text-gray-800">Importing Receipt...</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                            <div
                                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                                style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                            ></div>
                        </div>
                        <div className="text-center text-sm text-gray-700 font-semibold">
                            {importProgress.status}
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-xl overflow-hidden min-h-[60vh]">
                    {/* Store & Date Section */}
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50 space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Store</label>
                            <select
                                value={storeId}
                                onChange={e => setStoreId(e.target.value)}
                                className="w-full p-2 border rounded-lg bg-white shadow-sm"
                            >
                                <option value="">Select Store...</option>
                                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            {!storeId && receipt?.ocr_data?.store && (
                                <p className="mt-1 text-[10px] text-blue-600 font-medium italic">
                                    Store Detected: "{receipt.ocr_data.store}"
                                </p>
                            )}
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1 text-center">Receipt Total</label>
                                <div className="p-3 bg-white rounded-xl text-gray-800 font-bold text-lg border border-gray-100 text-center shadow-sm">
                                    ${subtotal.toFixed(2)}
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-purple-400 uppercase mb-1 text-center">Confirmed</label>
                                <div className="p-3 bg-purple-50 rounded-xl text-purple-700 font-bold text-lg border border-purple-100 text-center shadow-sm">
                                    ${confirmedTotal.toFixed(2)}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date & Time</label>
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        value={ocrDate || receipt?.ocr_data?.date || ''}
                                        onChange={e => setOcrDate(e.target.value)}
                                        className="flex-1 p-1.5 bg-white rounded-lg text-gray-700 text-sm border border-gray-100 shadow-sm"
                                    />
                                    <input
                                        type="time"
                                        value={ocrTime || receipt?.ocr_data?.time || ''}
                                        onChange={e => setOcrTime(e.target.value)}
                                        className="w-24 p-1.5 bg-white rounded-lg text-gray-700 text-sm border border-gray-100 shadow-sm"
                                    />
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Items</label>
                                <div className="p-2 bg-white rounded-lg text-gray-700 text-sm border border-gray-100 shadow-sm text-center">
                                    {rows.length} found
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Reconciliation List - Grouped Carousel Cards */}
                    <div className="p-4 md:p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Scanned Items</h2>
                        </div>

                        {/* New Items Section */}
                        {rows.filter(r => r.status === 'new' && !r.isConfirmed).length > 0 && (
                            <div className="mb-8">
                                <div className="flex items-center gap-2 mb-3 px-1">
                                    <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-sm"></div>
                                    <h3 className="text-sm font-bold text-yellow-700 uppercase tracking-wider">
                                        Add New Items
                                    </h3>
                                    <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full font-semibold">
                                        {rows.filter(r => r.status === 'new' && !r.isConfirmed).length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {rows.map((row, idx) => row.status === 'new' && !row.isConfirmed && (
                                        <ReceiptItemCard
                                            key={idx}
                                            variant="new"
                                            displayName={row.ocrName}
                                            originalName={row.ocrName}
                                            sku={row.ocrSku}
                                            headerBadges={
                                                <ReceiptItemBadges
                                                    showSkuMatch={row.isSkuMatch}
                                                    sku={row.ocrSku}
                                                    ocrCorrectedName={row.ocrCorrectedName}
                                                    originalName={row.ocrName}
                                                    layout="inline"
                                                />
                                            }
                                            inputs={
                                                <ReceiptItemInputs
                                                    price={row.ocrPrice}
                                                    onPriceChange={(val) => handleRowChange(idx, { ocrPrice: val })}
                                                    quantity={row.ocrQuantity}
                                                    onQuantityChange={(val) => handleRowChange(idx, { ocrQuantity: val })}
                                                    quantityLabel={row.isWeighted ? 'Qty (lb)' : 'Qty'}
                                                    isWeighted={row.isWeighted}
                                                    showSku={false}
                                                    layout="vertical"
                                                    badges={
                                                        <ReceiptItemBadges
                                                            isTaxed={row.isTaxed}
                                                            taxAmount={row.taxAmount}
                                                            discountApplied={row.discountApplied}
                                                            layout="inline"
                                                        />
                                                    }
                                                />
                                            }
                                            itemSelector={
                                                <ItemSearchableDropdown
                                                    className="flex-1"
                                                    items={allItems}
                                                    selectedItemId={undefined}
                                                    onSelect={(itemId, name) => {
                                                        if (itemId === '__new__') {
                                                            // User is creating a new item
                                                            handleRowChange(idx, {
                                                                status: 'new',
                                                                isConfirmed: true,
                                                                newItemName: name
                                                            });
                                                        } else {
                                                            // User selected an existing item
                                                            const itemData = allItems.find(i => i.id === itemId);
                                                            handleRowChange(idx, {
                                                                status: 'matched',
                                                                isConfirmed: true,
                                                                selectedItemId: itemId,
                                                                selectedItemName: name,
                                                                ocrUnit: itemData?.unit && itemData.unit !== 'count' ? itemData.unit : row.ocrUnit,
                                                                isWeighted: itemData?.is_weighted ?? row.isWeighted,
                                                                confidence: 'high'
                                                            });
                                                        }
                                                    }}
                                                    onInputChange={(name) => {
                                                        handleRowChange(idx, { newItemName: name });
                                                    }}
                                                    placeholder={row.ocrNormalizedName || row.ocrName}
                                                    initialValue={row.newItemName || row.ocrNormalizedName || row.ocrName}
                                                />
                                            }
                                            onRemove={() => handleRemoveRow(idx)}
                                            onConfirm={() => handleRowChange(idx, { isConfirmed: true })}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Matches to Confirm Section */}
                        {rows.filter(r => r.status === 'matched' && !r.isConfirmed).length > 0 && (
                            <div className="mb-8">
                                <div className="flex items-center gap-2 mb-3 px-1">
                                    <div className="w-3 h-3 rounded-full bg-purple-500 shadow-sm"></div>
                                    <h3 className="text-sm font-bold text-purple-700 uppercase tracking-wider">
                                        Review Recommendations
                                    </h3>
                                    <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full font-semibold">
                                        {rows.filter(r => r.status === 'matched' && !r.isConfirmed).length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {rows.map((row, idx) => row.status === 'matched' && !row.isConfirmed && (
                                        <ReceiptItemCard
                                            key={idx}
                                            variant="matched"
                                            displayName={row.ocrName}
                                            originalName={row.ocrName}
                                            sku={row.ocrSku}
                                            headerBadges={
                                                <ReceiptItemBadges
                                                    showSkuMatch={row.isSkuMatch}
                                                    sku={row.ocrSku}
                                                    ocrCorrectedName={row.ocrCorrectedName}
                                                    originalName={row.ocrName}
                                                    estimatedWeight={row.estimatedWeight}
                                                    pricePerLb={row.pricePerLb}
                                                    layout="inline"
                                                />
                                            }
                                            inputs={
                                                <ReceiptItemInputs
                                                    price={row.ocrPrice}
                                                    onPriceChange={(val) => handleRowChange(idx, { ocrPrice: val })}
                                                    quantity={row.ocrQuantity}
                                                    onQuantityChange={(val) => handleRowChange(idx, { ocrQuantity: val })}
                                                    quantityLabel={row.isWeighted ? 'Weight (lb)' : 'Quantity'}
                                                    isWeighted={row.isWeighted}
                                                    showSku={false}
                                                    layout="vertical"
                                                    badges={
                                                        <ReceiptItemBadges
                                                            isTaxed={row.isTaxed}
                                                            taxAmount={row.taxAmount}
                                                            discountApplied={row.discountApplied}
                                                            layout="inline"
                                                        />
                                                    }
                                                />
                                            }
                                            matchDisplay={{
                                                matchedName: row.selectedItemName || '',
                                                confidence: row.confidence || 'low'
                                            }}
                                            itemSelector={
                                                <ItemSearchableDropdown
                                                    className="flex-1"
                                                    items={allItems}
                                                    selectedItemId={row.selectedItemId}
                                                    onSelect={(itemId, name) => {
                                                        if (itemId === '__new__') {
                                                            // User is creating a new item
                                                            handleRowChange(idx, {
                                                                status: 'new',
                                                                newItemName: name,
                                                                selectedItemId: undefined,
                                                                selectedItemName: undefined
                                                            });
                                                        } else {
                                                            // User selected an existing item
                                                            const itemData = allItems.find(i => i.id === itemId);
                                                            handleRowChange(idx, {
                                                                status: 'matched',
                                                                selectedItemId: itemId,
                                                                selectedItemName: name,
                                                                ocrUnit: itemData?.unit && itemData.unit !== 'count' ? itemData.unit : row.ocrUnit,
                                                                isWeighted: itemData?.is_weighted ?? row.isWeighted,
                                                                confidence: 'high'
                                                            });
                                                        }
                                                    }}
                                                    onInputChange={(name) => {
                                                        handleRowChange(idx, { newItemName: name });
                                                    }}
                                                    placeholder="Search to change..."
                                                    initialValue={row.newItemName || row.ocrNormalizedName || row.ocrName}
                                                />
                                            }
                                            onRemove={() => handleRemoveRow(idx)}
                                            onConfirm={() => handleRowChange(idx, { isConfirmed: true })}
                                            additionalControls={
                                                <button
                                                    onClick={() => handleRowChange(idx, {
                                                        status: 'new',
                                                        newItemName: toTitleCase(row.ocrNormalizedName || row.ocrName),
                                                        selectedItemId: undefined,
                                                        selectedItemName: undefined
                                                    })}
                                                    className="p-2 bg-gray-100 text-gray-500 rounded-xl hover:bg-yellow-100 hover:text-yellow-600 transition-colors"
                                                    title="Create as new item"
                                                >
                                                    <PlusIcon className="w-5 h-5" />
                                                </button>
                                            }
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Already Confirmed Section */}
                        {rows.filter(r => r.isConfirmed).length > 0 && (
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-3 px-1">
                                    <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></div>
                                    <h3 className="text-sm font-bold text-green-700 uppercase tracking-wider">
                                        Confirmed
                                    </h3>
                                    <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full font-semibold">
                                        {rows.filter(r => r.isConfirmed).length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {rows.map((row, idx) => {
                                        if (row.isConfirmed) {
                                            const displayPrice = parseFloat(row.ocrPrice || '0').toFixed(2);
                                            return (
                                                <ReceiptItemCard
                                                    key={idx}
                                                    variant="confirmed"
                                                    displayName={row.status === 'matched' ? row.selectedItemName || '' : row.newItemName || ''}
                                                    originalName={row.ocrName}
                                                    inputs={
                                                        <div className="text-right flex-shrink-0">
                                                            <div className="font-bold text-gray-800 flex items-center justify-end gap-1">
                                                                ${displayPrice}
                                                                {(row.discountApplied || 0) > 0 && (
                                                                    <span className="text-[8px] px-1 py-0.5 rounded bg-green-100 text-green-700 font-bold">
                                                                        -${(row.discountApplied || 0).toFixed(2)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${row.status === 'matched' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                                                }`}>
                                                                {row.status === 'matched' ? 'Matched' : 'New'}
                                                            </span>
                                                        </div>
                                                    }
                                                    onEdit={() => handleRowChange(idx, { isConfirmed: false })}
                                                />
                                            );
                                        }
                                        return null;
                                    })}
                                </div>
                            </div>
                        )
                        }

                        {/* Empty State */}
                        {
                            rows.length === 0 && (
                                <div className="text-center py-12 text-gray-400">
                                    <p>No items found on this receipt</p>
                                </div>
                            )
                        }
                    </div >
                </div >
            </div >

            <StatusModal
                isOpen={statusModal.isOpen}
                onClose={() => {
                    if (statusModal.onCloseOverride) {
                        statusModal.onCloseOverride();
                    } else {
                        setStatusModal(prev => ({ ...prev, isOpen: false }));
                    }
                }}
                title={statusModal.title}
                message={statusModal.message}
                type={statusModal.type}
            />

            {/* Scanning Overlay with Dynamic Loader */}
            {importing && importProgress && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl max-w-sm w-full p-8 shadow-2xl flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-200">
                        <ProcessingLoader progress={importProgress ? { current: importProgress.current, total: importProgress.total } : null} />
                    </div>
                </div>
            )}
        </div >
    );
}
