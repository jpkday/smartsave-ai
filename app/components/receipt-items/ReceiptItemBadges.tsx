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
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-white/5 border border-bb-line text-bb-muted">
          SKU Match
        </span>
      )}

      {/* SKU Value */}
      {sku && (
        <div className="text-[14px] text-bb-muted font-mono">
          SKU: {sku}
        </div>
      )}

      {/* OCR Correction Indicator */}
      {showOcrCorrection && (
        <div className="text-xs text-bb-gold flex items-center gap-1">
          <span className="text-[8px] px-1 py-0.5 rounded bg-bb-gold/10 text-bb-gold font-bold">
            FIX
          </span>
          → {ocrCorrectedName}
        </div>
      )}

      {/* Weight Estimation */}
      {estimatedWeight && pricePerLb && (
        <div className="text-xs text-bb-muted flex items-center gap-1">
          <span className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-bb-muted font-bold">
            WT
          </span>
          ~{estimatedWeight.toFixed(2)}lbs
        </div>
      )}

      {/* Tax Badge */}
      {isTaxed && taxAmount && taxAmount > 0 && (
        <span className="text-[12px] px-1 py-0.5 rounded bg-white/5 text-bb-muted font-bold">
          +${taxAmount.toFixed(2)} T
        </span>
      )}

      {/* Discount Badge */}
      {discountApplied !== undefined && discountApplied > 0 && (
        <span className="text-[14px] px-1 py-0.5 rounded bg-bb-green/10 text-bb-green font-bold">
          -${discountApplied.toFixed(2)}
        </span>
      )}

      {/* Confidence Badge */}
      {confidence && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
          confidence === 'high'
            ? 'bg-bb-green/10 text-bb-green'
            : 'bg-bb-gold/10 text-bb-gold'
        }`}>
          {confidence === 'high' ? 'Exact' : 'Fuzzy'}
        </span>
      )}
    </div>
  );
}
