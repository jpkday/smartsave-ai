'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ExtractedData {
    item_number?: string | null;
    item_name: string;
    price: number;
    original_price?: number | null;
    discount_amount?: number | null;
    store: string | null;
    unit?: string | null;
    store_unit_price?: string | null;
    sale_expiration?: string | null;
    is_sale: boolean;
    confidence: number;
    store_match?: { id: number; name: string } | null;
    ai_match?: string | null;
}

interface PriceReviewModalProps {
    extractedData: ExtractedData;
    submissionId: number;
    onConfirm: (data: any) => void;
    onCancel: () => void;
    householdCode: string;
    defaultStore?: { id: string; name: string } | null; // Store from context (e.g., active trip)
    showStatus: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function PriceReviewModal({
    extractedData,
    submissionId,
    onConfirm,
    onCancel,
    householdCode,
    defaultStore,
    showStatus
}: PriceReviewModalProps) {
    // Use AI match if available, otherwise fallback to extracted raw name
    const [itemName, setItemName] = useState(extractedData.ai_match || extractedData.item_name || '');
    const [price, setPrice] = useState(extractedData.price?.toString() || '');
    const [unitSize, setUnitSize] = useState(extractedData.unit || '');
    // Use extracted store match first, then defaultStore, then null
    const [storeId, setStoreId] = useState<string | null>(
        extractedData.store_match?.id?.toString() || defaultStore?.id || null
    );
    const [storeName, setStoreName] = useState<string>(
        extractedData.store_match?.name || defaultStore?.name || ''
    );
    const [isSale, setIsSale] = useState(extractedData.is_sale || false);
    const [saleExpiration, setSaleExpiration] = useState(extractedData.sale_expiration || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previousPrice, setPreviousPrice] = useState<number | null>(null);
    const [daysSinceUpdate, setDaysSinceUpdate] = useState<number | null>(null);

    // Fetch previous price for context
    useEffect(() => {
        if (storeId && itemName) {
            fetchPreviousPrice();
        }
    }, [storeId, itemName]);

    const fetchPreviousPrice = async () => {
        try {
            const response = await fetch('/api/prices/latest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-household-code': householdCode,
                },
                body: JSON.stringify({
                    item_name: itemName,
                    store_id: storeId
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.price) {
                    setPreviousPrice(data.price);
                    setDaysSinceUpdate(data.days_ago);
                }
            }
        } catch (error) {
            console.error('Failed to fetch previous price:', error);
        }
    };

    const handleSubmit = async () => {
        if (!itemName || !price || !storeId) {
            showStatus('Missing Information', 'Please fill in all required fields (Name, Price, and Store).', 'warning');
            return;
        }

        setIsSubmitting(true);

        try {
            await onConfirm({
                submission_id: submissionId,
                item_name: itemName,
                price: parseFloat(price),
                store_id: storeId,
                unit_size: unitSize,
                is_sale: isSale,
                sale_expiration: saleExpiration || null
            });
        } catch (error: any) {
            console.error('Failed to confirm price:', error);
            showStatus('Save Failed', error.message || 'Failed to save price. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const confidenceColor = extractedData.confidence > 0.9 ? 'text-bb-green' :
        extractedData.confidence > 0.7 ? 'text-bb-gold' : 'text-bb-red';

    const priceChange = previousPrice ? ((parseFloat(price) - previousPrice) / previousPrice * 100) : null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-bb-panel text-bb-cream rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-bb-line shadow-sm">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-bb-cream">Review Price Data</h2>
                        <p className="text-sm text-bb-muted mt-1">
                            Verify and edit the extracted information
                        </p>
                    </div>
                    <button onClick={onCancel} className="text-bb-muted hover:text-bb-cream">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Confidence Score */}
                <div className="mb-6 bg-bb-raised rounded-xl p-4">
                    <div className="flex items-center gap-2">
                        {extractedData.confidence > 0.7 ? (
                            <CheckCircleIcon className={`w-5 h-5 ${confidenceColor}`} />
                        ) : (
                            <ExclamationTriangleIcon className={`w-5 h-5 ${confidenceColor}`} />
                        )}
                        <span className="text-sm font-semibold text-bb-cream">
                            Confidence: <span className={confidenceColor}>{(extractedData.confidence * 100).toFixed(0)}%</span>
                        </span>
                    </div>
                </div>

                {/* Item Number (Read-only) */}
                {extractedData.item_number && (
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-bb-cream mb-2">
                            Item Number
                        </label>
                        <div className="bg-bb-raised rounded-xl px-4 py-3 text-bb-muted font-mono">
                            {extractedData.item_number}
                        </div>
                    </div>
                )}

                {/* Item Name */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-bb-cream mb-2">
                        Item Name <span className="text-bb-red">*</span>
                    </label>
                    <input
                        type="text"
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        className="w-full rounded-xl px-4 py-3 bg-bb-raised border border-bb-line text-bb-cream placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-bb-gold/50 focus:border-bb-gold/50"
                        placeholder="Enter item name"
                    />
                </div>

                {/* Price */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-bb-cream mb-2">
                        Price <span className="text-bb-red">*</span>
                    </label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-bb-muted text-lg">$</span>
                        <input
                            type="number"
                            step="0.01"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            className="w-full rounded-xl pl-10 pr-4 py-3 bg-bb-raised border border-bb-line text-bb-cream placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-bb-gold/50 focus:border-bb-gold/50"
                            placeholder="0.00"
                        />
                    </div>

                    {/* Price Context */}
                    {previousPrice !== null && (
                        <div className="mt-2 text-sm">
                            <span className="text-bb-muted">
                                Previous: ${previousPrice.toFixed(2)}
                                {daysSinceUpdate !== null && ` (${daysSinceUpdate} days ago)`}
                            </span>
                            {priceChange !== null && (
                                <span className={`ml-2 font-semibold ${priceChange > 0 ? 'text-bb-red' : priceChange < 0 ? 'text-bb-green' : 'text-bb-muted'}`}>
                                    {priceChange > 0 ? '↑' : priceChange < 0 ? '↓' : '='} {Math.abs(priceChange).toFixed(1)}%
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Unit Size */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-bb-cream mb-2">
                        Unit Size
                    </label>
                    <input
                        type="text"
                        value={unitSize}
                        onChange={(e) => setUnitSize(e.target.value)}
                        className="w-full rounded-xl px-4 py-3 bg-bb-raised border border-bb-line text-bb-cream placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-bb-gold/50 focus:border-bb-gold/50"
                        placeholder="e.g., 5 LBS, 6/32 FL OZ"
                    />
                    {extractedData.store_unit_price && (
                        <p className="mt-2 text-sm text-bb-muted">
                            Store's unit price: <span className="font-semibold text-bb-cream">{extractedData.store_unit_price}</span>
                        </p>
                    )}
                </div>

                {/* Store */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-bb-cream mb-2">
                        Store <span className="text-bb-red">*</span>
                    </label>
                    {extractedData.store_match ? (
                        <div className="bg-bb-raised border border-bb-line rounded-xl px-4 py-3">
                            <p className="font-semibold text-bb-cream">{extractedData.store_match.name}</p>
                            <p className="text-xs text-bb-green mt-1">Auto-detected</p>
                        </div>
                    ) : defaultStore ? (
                        <div className="bg-bb-raised border border-bb-line rounded-xl px-4 py-3">
                            <p className="font-semibold text-bb-cream">{defaultStore.name}</p>
                            <p className="text-xs text-bb-muted mt-1">From your active trip</p>
                        </div>
                    ) : (
                        <div className="bg-bb-gold/10 border border-bb-gold/30 rounded-xl px-4 py-3">
                            <p className="text-sm text-bb-gold">Store not recognized. Please select manually.</p>
                        </div>
                    )}
                </div>

                {/* Sale Info */}
                <div className="mb-6 bg-bb-raised rounded-xl p-4">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={isSale}
                            onChange={(e) => setIsSale(e.target.checked)}
                            className="w-5 h-5 accent-[#c9a96e] rounded"
                        />
                        <span className="font-semibold text-bb-cream">This is a sale price</span>
                    </label>

                    {isSale && (
                        <div className="mt-4">
                            <label className="block text-sm font-semibold text-bb-cream mb-2">
                                Sale Expiration Date
                            </label>
                            <input
                                type="date"
                                value={saleExpiration}
                                onChange={(e) => setSaleExpiration(e.target.value)}
                                className="w-full rounded-xl px-4 py-2 bg-bb-raised border border-bb-line text-bb-cream placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-bb-gold/50 focus:border-bb-gold/50"
                            />
                        </div>
                    )}

                    {extractedData.discount_amount && (
                        <p className="mt-3 text-sm text-bb-muted">
                            Savings: <span className="font-semibold text-bb-green">${extractedData.discount_amount.toFixed(2)}</span>
                            {extractedData.original_price && (
                                <span className="ml-2">(was ${extractedData.original_price.toFixed(2)})</span>
                            )}
                        </p>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="border border-bb-line bg-transparent text-bb-cream py-3 rounded-xl font-semibold hover:bg-white/5 transition disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !itemName || !price || !storeId}
                        className="bg-bb-gold text-bb-navy py-3 rounded-xl font-semibold hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Saving...' : 'Confirm & Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
