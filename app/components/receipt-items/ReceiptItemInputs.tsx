interface ReceiptItemInputsProps {
  // Price control
  price: string;
  onPriceChange: (value: string) => void;
  showPriceCurrency?: boolean;

  // Quantity control
  quantity: string;
  onQuantityChange: (value: string) => void;
  quantityLabel?: string;
  isWeighted?: boolean;

  // SKU control (optional for manual entry)
  sku?: string;
  onSkuChange?: (value: string) => void;
  showSku?: boolean;

  // Layout mode
  layout?: 'horizontal' | 'vertical';

  // Optional badges to show near price
  badges?: React.ReactNode;

  // Additional event handlers
  onPriceKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function ReceiptItemInputs({
  price,
  onPriceChange,
  showPriceCurrency = true,
  quantity,
  onQuantityChange,
  quantityLabel,
  isWeighted = false,
  sku,
  onSkuChange,
  showSku = false,
  layout = 'horizontal',
  badges,
  onPriceKeyPress
}: ReceiptItemInputsProps) {
  // Determine quantity label based on isWeighted flag
  const qtyLabel = quantityLabel || (isWeighted ? 'Qty (lb)' : 'Qty');

  if (layout === 'vertical') {
    return (
      <div className="flex flex-col gap-3">
        {/* Price Row */}
        <div className="flex items-center justify-end gap-2">
          {badges}
          <div className="flex items-center border-b border-bb-line focus-within:border-bb-gold/50 transition-colors">
            {showPriceCurrency && <span className="text-bb-muted text-sm">$</span>}
            <input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => onPriceChange(e.target.value)}
              onBlur={(e) => {
                const num = parseFloat(e.target.value);
                if (!isNaN(num)) onPriceChange(num.toFixed(2));
              }}
              onKeyPress={onPriceKeyPress}
              className="w-20 font-bold text-bb-cream bg-transparent focus:outline-none text-right text-lg py-0.5"
            />
          </div>
        </div>

        {/* Quantity Row */}
        <div className="flex items-center justify-end gap-2">
          <span className="text-[10px] text-bb-muted font-medium uppercase tracking-wider">
            {qtyLabel}
          </span>
          <div className="border-b border-bb-line focus-within:border-bb-gold/50 transition-colors">
            <input
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => onQuantityChange(e.target.value)}
              className="w-16 text-sm font-semibold text-bb-muted bg-transparent focus:outline-none text-right py-0.5"
            />
          </div>
        </div>
      </div>
    );
  }

  // Horizontal layout (for manual entry page)
  return (
    <div className="flex gap-3 items-center flex-1">
      {/* SKU Input (optional) */}
      {showSku && (
        <div className="w-24">
          <input
            type="text"
            placeholder="SKU"
            value={sku || ''}
            onChange={(e) => onSkuChange?.(e.target.value)}
            className="w-full px-3 py-2 rounded-2xl bg-bb-raised border border-bb-line text-bb-cream placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-bb-gold/50 focus:border-bb-gold/50"
          />
        </div>
      )}

      {/* Quantity */}
      <div className="w-16">
        <input
          type="text"
          inputMode="decimal"
          placeholder="1"
          value={quantity}
          onChange={(e) => onQuantityChange(e.target.value)}
          className="w-full px-3 py-2 rounded-2xl font-semibold text-right bg-bb-raised border border-bb-line text-bb-cream placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-bb-gold/50 focus:border-bb-gold/50"
        />
      </div>

      {/* Price */}
      <div className="w-28">
        <div className="flex items-center bg-bb-raised border border-bb-line rounded-2xl px-3 py-2 focus-within:border-bb-gold/50 focus-within:ring-2 focus-within:ring-bb-gold/50">
          {showPriceCurrency && <span className="text-bb-cream font-semibold mr-1">$</span>}
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={price}
            onChange={(e) => onPriceChange(e.target.value)}
            onBlur={(e) => {
              const num = parseFloat(e.target.value);
              if (!isNaN(num)) onPriceChange(num.toFixed(2));
            }}
            onKeyPress={onPriceKeyPress}
            className="w-full text-right font-semibold text-bb-cream bg-transparent focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
