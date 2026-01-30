'use client';
import { useState, useEffect, useRef, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { getFuzzyMatch } from '../../../lib/utils';
import Link from 'next/link';
import { ArrowLeftIcon, CheckCircleIcon, ExclamationTriangleIcon, PlusIcon, MagnifyingGlassIcon, SparklesIcon } from '@heroicons/react/24/solid';
import ItemSearchableDropdown from '../../../components/ItemSearchableDropdown';
import StatusModal from '../../../components/StatusModal';

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

    // Selection state
    status: 'matched' | 'new' | 'unresolved';
    selectedItemId?: string; // ID of existing item
    selectedItemName?: string; // Name of existing item
    newItemName?: string; // Name for NEW item

    confidence: 'high' | 'low';
    isConfirmed: boolean;
}

export default function ReceiptImportPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [receipt, setReceipt] = useState<ImportedReceipt | null>(null);
    const [rows, setRows] = useState<ReconciliationRow[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [allItems, setAllItems] = useState<{ id: string, name: string, unit?: string, is_weighted?: boolean }[]>([]);
    const [storeId, setStoreId] = useState<string>('');
    const [importing, setImporting] = useState(false);
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

    const loadData = async () => {
        try {
            const householdCode = localStorage.getItem('household_code') || '';
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

            // 2. Load Metadata (Stores, Items, Aliases)
            const [storesRes, itemsRes, aliasesRes] = await Promise.all([
                supabase.from('stores').select('id, name').order('name'),
                supabase.from('items').select('id, name, unit, is_weighted').order('name'),
                supabase.from('item_aliases').select('alias, item_id, items(name, unit, is_weighted), store_id')
            ]);

            setStores(storesRes.data || []);
            const itemsList = itemsRes.data || [];
            setAllItems(itemsList);

            const aliases = aliasesRes.data || [];

            // 3. Process Rows (The "AI" Logic Re-run/Refinement)
            const ocrItems = receiptData.ocr_data?.items || [];
            const processedRows: ReconciliationRow[] = ocrItems.map((item: any) => {
                const ocrName = item.name;
                const ocrNormalizedName = item.normalized_name;
                const ocrUnit = item.unit;
                const ocrSku = item.sku;
                const isWeighted = item.is_weighted;

                // Strategy A: Exact Alias Match (Prefer Store Specific, Fallback to Global)
                let exactAlias = aliases.find((a: any) =>
                    a.alias.toLowerCase() === ocrName.toLowerCase() &&
                    a.store_id === receiptData.store_id
                );

                // Fallback to global alias if no store-specific one found
                if (!exactAlias) {
                    exactAlias = aliases.find((a: any) =>
                        a.alias.toLowerCase() === ocrName.toLowerCase()
                    );
                }

                if (exactAlias) {
                    const itemData = Array.isArray(exactAlias.items) ? exactAlias.items[0] : (exactAlias.items as any);
                    return {
                        ocrName,
                        ocrNormalizedName,
                        ocrPrice: item.price?.toString() || '',
                        ocrQuantity: item.quantity?.toString() || '1',
                        ocrUnit: itemData?.unit && itemData.unit !== 'count' ? itemData.unit : ocrUnit,
                        ocrSku,
                        isWeighted: itemData?.is_weighted ?? isWeighted,
                        status: 'matched',
                        selectedItemId: exactAlias.item_id,
                        selectedItemName: itemData?.name,
                        confidence: 'high',
                        isConfirmed: false
                    };
                }

                // Strategy B: Exact Name Match
                const exactItem = itemsList.find(i => i.name.toLowerCase() === (ocrNormalizedName || ocrName).toLowerCase());
                if (exactItem) {
                    return {
                        ocrName,
                        ocrNormalizedName,
                        ocrPrice: item.price?.toString() || '',
                        ocrQuantity: item.quantity?.toString() || '1',
                        ocrUnit: exactItem.unit && !['count', 'each'].includes(exactItem.unit) ? exactItem.unit : ocrUnit,
                        ocrSku,
                        isWeighted: exactItem.is_weighted ?? isWeighted,
                        status: 'matched',
                        selectedItemId: exactItem.id,
                        selectedItemName: exactItem.name,
                        confidence: 'high',
                        isConfirmed: false
                    };
                }

                // Strategy C: Fuzzy Match
                const candidateNames = itemsList.map(i => i.name);
                // Also look at aliases for fuzzy matching
                const aliasNames = aliases.map((a: any) => a.alias);

                // Fuzzy against Aliases first (strong signal)
                const fuzzyAliasName = getFuzzyMatch(ocrName, aliasNames);
                if (fuzzyAliasName) {
                    const match = aliases.find((a: any) => a.alias === fuzzyAliasName);
                    if (match) {
                        const itemData = Array.isArray(match.items) ? match.items[0] : (match.items as any);
                        return {
                            ocrName,
                            ocrNormalizedName,
                            ocrPrice: item.price?.toString() || '',
                            ocrQuantity: item.quantity?.toString() || '1',
                            ocrUnit: itemData?.unit && itemData.unit !== 'count' ? itemData.unit : ocrUnit,
                            ocrSku,
                            isWeighted: itemData?.is_weighted ?? isWeighted,
                            status: 'matched',
                            selectedItemId: match.item_id,
                            selectedItemName: itemData?.name,
                            confidence: 'low',
                            isConfirmed: false
                        };
                    }
                }

                // Fuzzy against Items
                const fuzzyItemName = getFuzzyMatch(ocrNormalizedName || ocrName, candidateNames);
                if (fuzzyItemName) {
                    const match = itemsList.find(i => i.name === fuzzyItemName);
                    if (match) {
                        return {
                            ocrName,
                            ocrNormalizedName,
                            ocrPrice: item.price?.toString() || '',
                            ocrQuantity: item.quantity?.toString() || '1',
                            ocrUnit: match.unit && !['count', 'each'].includes(match.unit) ? match.unit : ocrUnit,
                            ocrSku,
                            isWeighted: match.is_weighted ?? isWeighted,
                            status: 'matched',
                            selectedItemId: match.id,
                            selectedItemName: match.name,
                            confidence: 'low',
                            isConfirmed: false
                        };
                    }
                }

                // Strategy D: AI Auto-Match (Backend Injection)
                // The AI was given the list of items and asked to semantic match.
                if (item.ai_match) {
                    const matchedItem = itemsList.find(i => i.name === item.ai_match);
                    if (matchedItem) {
                        return {
                            ocrName,
                            ocrNormalizedName,
                            ocrPrice: item.price?.toString() || '',
                            ocrQuantity: item.quantity?.toString() || '1',
                            ocrUnit: matchedItem.unit && !['count', 'each'].includes(matchedItem.unit) ? matchedItem.unit : ocrUnit,
                            ocrSku,
                            isWeighted: matchedItem.is_weighted ?? isWeighted,
                            status: 'matched',
                            selectedItemId: matchedItem.id,
                            selectedItemName: matchedItem.name,
                            confidence: 'low',
                            isConfirmed: false
                        };
                    }
                }

                // Fallback: Default to "New Item" with cleaned name
                return {
                    ocrName,
                    ocrNormalizedName,
                    ocrPrice: item.price?.toString() || '',
                    ocrQuantity: item.quantity?.toString() || '1',
                    ocrUnit,
                    ocrSku,
                    isWeighted,
                    status: 'new',
                    newItemName: toTitleCase(ocrNormalizedName || ocrName),
                    confidence: 'low',
                    isConfirmed: false
                };
            });

            setRows(processedRows);
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

    const finalizeImport = async () => {
        setImporting(true);
        const householdCode = localStorage.getItem('household_code');
        const shouldAddTrip = receipt?.ocr_data?.should_add_trip !== false; // Default to true if missing

        try {
            if (!storeId) throw new Error("Please select a store.");

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
            for (const row of rows.filter(r => r.isConfirmed)) {
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
                        const { error: aliasError } = await supabase.from('item_aliases').insert({
                            item_id: finalItemId,
                            store_id: storeId,
                            alias: row.ocrName
                        });

                        if (aliasError) {
                            console.warn("Alias error (likely exists):", aliasError.message);
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
                        price: parseFloat(row.ocrPrice || '0') || 0,
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
                    const { error: skuError } = await supabase.from('store_item_sku').upsert(
                        {
                            store_id: storeId,
                            item_id: finalItemId,
                            store_sku: row.ocrSku
                        },
                        { onConflict: 'store_id,item_id' }
                    );
                    if (skuError) {
                        console.warn('SKU upsert error:', skuError.message);
                    }
                }
            }

            // 3. Mark Receipt Processed
            await supabase.from('imported_receipts').update({ status: 'processed' }).eq('id', unwrappedParams.id);

            setStatusModal({
                isOpen: true,
                title: 'Import Success',
                message: shouldAddTrip ? "Receipt imported and trip recorded!" : "Receipt items and prices imported!",
                type: 'success',
                onCloseOverride: () => router.push('/receipts')
            });

        } catch (err: any) {
            console.error(err);
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
        return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading receipt...</div>;
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
                    {importing ? "Importing..." : `Confirm ${rows.filter(r => r.isConfirmed).length} ($${confirmedTotal.toFixed(2)})`}
                </button>
            </div>

            <div className="max-w-3xl mx-auto p-4">
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
                                    AI Detected: "{receipt.ocr_data.store}"
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

                    {/* Reconciliation List */}
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Receipt Item Matching</h2>
                        </div>

                        <div className="space-y-4">

                            {rows.map((row, idx) => (
                                <div key={idx} className={`rounded-xl border p-4 flex flex-col gap-3 transition-all ${row.isConfirmed ? 'bg-green-50/50 border-green-200' :
                                    row.status === 'matched' ? 'bg-purple-50/50 border-purple-100' :
                                        row.status === 'new' ? 'bg-yellow-50/50 border-yellow-100' : 'bg-gray-50 border-gray-100'
                                    } shadow-sm hover:shadow-md`}>
                                    {/* Top Row: Info */}
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="text-xs text-gray-400 font-mono mb-0.5">SCANNED ITEM AS</div>
                                            <div className="font-bold text-gray-800 text-lg">"{row.ocrName}"</div>
                                            {row.ocrNormalizedName && row.ocrNormalizedName !== row.ocrName && (
                                                <div className="text-sm font-medium text-blue-600 italic">
                                                    Expanded: {row.ocrNormalizedName}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-gray-400 font-mono mb-0.5 uppercase">Scanned Price</div>
                                            <div className="flex items-center">
                                                <span className="text-gray-400 font-bold mr-1">$</span>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={row.ocrPrice}
                                                    disabled={row.isConfirmed}
                                                    onChange={(e) => handleRowChange(idx, { ocrPrice: e.target.value })}
                                                    className="w-20 font-bold text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none disabled:border-none"
                                                />
                                            </div>
                                            <div className="flex items-center mt-2 justify-end">
                                                <div className="text-[10px] text-gray-400 font-mono uppercase mr-2.5">
                                                    {row.isWeighted ? 'Weight (lb):' : 'Qty:'}
                                                </div>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={row.ocrQuantity}
                                                    disabled={row.isConfirmed}
                                                    onChange={(e) => handleRowChange(idx, { ocrQuantity: e.target.value })}
                                                    className="w-12 text-xs font-bold text-gray-600 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none disabled:border-none"
                                                />
                                                {row.ocrUnit && (
                                                    <span className="text-[10px] ml-1 font-bold text-gray-400 uppercase">{row.ocrUnit}</span>
                                                )}
                                                {row.isWeighted ? (
                                                    <button
                                                        onClick={() => handleRowChange(idx, { isWeighted: false })}
                                                        title="Click to remove weight flag"
                                                        className="ml-2 px-1 text-[9px] font-bold bg-amber-100 text-amber-700 rounded border border-amber-200 uppercase hover:bg-amber-200 transition-colors"
                                                    >
                                                        Weight
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleRowChange(idx, { isWeighted: true })}
                                                        title="Click to flag as weighted (lb/oz)"
                                                        className="ml-2 px-1 text-[9px] font-bold bg-gray-100 text-gray-400 rounded border border-gray-200 uppercase hover:bg-gray-200 transition-colors"
                                                    >
                                                        Scale
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Row: Match Control */}
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 flex justify-center">
                                            {row.status === 'matched' && row.confidence === 'high' && <CheckCircleIcon className="w-6 h-6 text-green-500" />}
                                            {row.status === 'matched' && row.confidence === 'low' && <SparklesIcon className="w-6 h-6 text-purple-500" />}
                                            {row.status === 'new' && <PlusIcon className="w-6 h-6 text-yellow-500" />}
                                        </div>

                                        <div className="flex-1 flex gap-2 items-center">
                                            {row.isConfirmed ? (
                                                <div className="flex-1 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-sm font-bold text-gray-800">
                                                            {row.status === 'matched' ? row.selectedItemName : row.newItemName}
                                                        </div>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${row.status === 'matched' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'
                                                            }`}>
                                                            {row.status === 'matched' ? 'Found' : 'New'}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRowChange(idx, { isConfirmed: false })}
                                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                                    >
                                                        Edit
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <ItemSearchableDropdown
                                                        className="flex-1"
                                                        items={allItems}
                                                        selectedItemId={row.status === 'matched' ? row.selectedItemId : undefined}
                                                        onSelect={(itemId, name) => {
                                                            const itemData = allItems.find(i => i.id === itemId);
                                                            handleRowChange(idx, {
                                                                status: 'matched',
                                                                selectedItemId: itemId,
                                                                selectedItemName: name,
                                                                ocrUnit: itemData?.unit && itemData.unit !== 'count' ? itemData.unit : row.ocrUnit,
                                                                isWeighted: itemData?.is_weighted ?? row.isWeighted,
                                                                confidence: 'high'
                                                            });
                                                        }}
                                                        onInputChange={(name) => {
                                                            // Check if typed name exactly matches an existing item
                                                            const exactMatch = allItems.find(i => i.name.toLowerCase() === name.toLowerCase());
                                                            if (exactMatch) {
                                                                handleRowChange(idx, {
                                                                    status: 'matched',
                                                                    selectedItemId: exactMatch.id,
                                                                    selectedItemName: exactMatch.name,
                                                                    ocrUnit: exactMatch.unit && !['count', 'each'].includes(exactMatch.unit) ? exactMatch.unit : row.ocrUnit,
                                                                    isWeighted: exactMatch.is_weighted ?? row.isWeighted,
                                                                    confidence: 'high'
                                                                });
                                                            } else if (row.status === 'new') {
                                                                handleRowChange(idx, { newItemName: name });
                                                            }
                                                        }}
                                                        placeholder={`Match "${row.ocrName}"...`}
                                                    />

                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => handleRowChange(idx, { isConfirmed: true })}
                                                            className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                                                            title="Confirm"
                                                        >
                                                            <CheckCircleIcon className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (row.status === 'matched') {
                                                                    handleRowChange(idx, { status: 'new', newItemName: row.ocrName, selectedItemId: undefined, selectedItemName: undefined });
                                                                } else {
                                                                    handleRowChange(idx, { status: 'matched', selectedItemId: undefined, selectedItemName: 'Select Item...' });
                                                                }
                                                            }}
                                                            className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"
                                                            title="Reset / Un-match"
                                                        >
                                                            <ArrowLeftIcon className="w-5 h-5 -rotate-90" />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

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
        </div>
    );
}
