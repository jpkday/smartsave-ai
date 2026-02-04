interface ReceiptItemBadgesProps {
  // SKU information
  showSkuMatch?: boolean;
  sku?: string;

  // OCR correction
  ocrCorrectedName?: string;
  originalName?: string;

  // Weight estimation (for bulk items)
  estimatedWeight?: number;
  pricePerLb?: number;

  // Tax/discount display
  isTaxed?: boolean;
  taxAmount?: number;
  discountApplied?: number;

  // Confidence indicator
  confidence?: 'high' | 'low';

  // Layout mode
  layout?: 'inline' | 'stacked';
}

export default function ReceiptItemBadges({
  showSkuMatch,
  sku,
  ocrCorrectedName,
  originalName,
  estimatedWeight,
  pricePerLb,
  isTaxed,
  taxAmount,
  discountApplied,
  confidence,
  layout = 'inline'
}: ReceiptItemBadgesProps) {
  const containerClass = layout === 'inline'
    ? 'flex items-center gap-2 flex-wrap'
    : 'flex flex-col gap-1';

  // Check if we should show OCR correction badge
  const showOcrCorrection = ocrCorrectedName && originalName &&
    ocrCorrectedName.toLowerCase() !== originalName.toLowerCase();

  return (
    <div className={containerClass}>
      {/* SKU Match Badge */}
      {showSkuMatch && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-blue-100 text-blue-700">
          SKU Match
        </span>
      )}

      {/* SKU Value */}
      {sku && (
        <div className="text-[14px] text-gray-400 font-mono">
          SKU: {sku}
        </div>
      )}

      {/* OCR Correction Indicator */}
      {showOcrCorrection && (
        <div className="text-xs text-orange-600 flex items-center gap-1">
          <span className="text-[8px] px-1 py-0.5 rounded bg-orange-100 text-orange-700 font-bold">
            FIX
          </span>
          → {ocrCorrectedName}
        </div>
      )}

      {/* Weight Estimation */}
      {estimatedWeight && pricePerLb && (
        <div className="text-xs text-amber-700 flex items-center gap-1">
          <span className="text-[8px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">
            WT
          </span>
          ~{estimatedWeight.toFixed(2)}lbs
        </div>
      )}

      {/* Tax Badge */}
      {isTaxed && taxAmount && taxAmount > 0 && (
        <span className="text-[12px] px-1 py-0.5 rounded bg-red-100 text-red-600 font-bold">
          +${taxAmount.toFixed(2)} T
        </span>
      )}

      {/* Discount Badge */}
      {discountApplied !== undefined && discountApplied > 0 && (
        <span className="text-[14px] px-1 py-0.5 rounded bg-green-100 text-green-700 font-bold">
          -${discountApplied.toFixed(2)}
        </span>
      )}

      {/* Confidence Badge */}
      {confidence && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
          confidence === 'high'
            ? 'bg-green-100 text-green-700'
            : 'bg-purple-100 text-purple-700'
        }`}>
          {confidence === 'high' ? 'Exact' : 'Fuzzy'}
        </span>
      )}
    </div>
  );
}
