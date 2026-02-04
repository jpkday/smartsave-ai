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
          <div className="flex items-center border-b border-gray-300 focus-within:border-blue-500 transition-colors">
            {showPriceCurrency && <span className="text-gray-400 text-sm">$</span>}
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
              className="w-20 font-bold text-gray-800 bg-transparent focus:outline-none text-right text-lg py-0.5"
            />
          </div>
        </div>

        {/* Quantity Row */}
        <div className="flex items-center justify-end gap-2">
          <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
            {qtyLabel}
          </span>
          <div className="border-b border-gray-300 focus-within:border-blue-500 transition-colors">
            <input
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => onQuantityChange(e.target.value)}
              className="w-16 text-sm font-semibold text-gray-600 bg-transparent focus:outline-none text-right py-0.5"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
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
          className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 font-semibold text-right"
        />
      </div>

      {/* Price */}
      <div className="w-28">
        <div className="flex items-center border border-gray-300 rounded-2xl px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
          {showPriceCurrency && <span className="text-gray-800 font-semibold mr-1">$</span>}
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
            className="w-full text-right font-semibold text-gray-800 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
