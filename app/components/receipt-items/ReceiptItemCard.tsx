import { CheckCircleIcon, PlusIcon, SparklesIcon } from '@heroicons/react/24/solid';

interface ReceiptItemCardProps {
  // Display mode
  variant: 'simple' | 'new' | 'matched' | 'confirmed';

  // Item identification
  displayName: string;
  originalName?: string;

  // Header badges
  headerBadges?: React.ReactNode;

  // Item selection control
  itemSelector?: React.ReactNode;

  // Input controls
  inputs: React.ReactNode;

  // Action buttons
  onRemove?: () => void;
  onConfirm?: () => void;
  onEdit?: () => void;

  // Additional controls (for import page new items section)
  additionalControls?: React.ReactNode;

  // Match display (for showing AI suggestions)
  matchDisplay?: {
    matchedName: string;
    confidence: 'high' | 'low';
  };

  // SKU for name cleanup
  sku?: string;
}

export default function ReceiptItemCard({
  variant,
  displayName,
  originalName,
  headerBadges,
  itemSelector,
  inputs,
  onRemove,
  onConfirm,
  onEdit,
  additionalControls,
  matchDisplay,
  sku
}: ReceiptItemCardProps) {
  // Clean SKU from display name if provided
  const cleanDisplayName = sku
    ? displayName.replace(sku, '').trim()
    : displayName;

  // Variant-specific styling
  const getCardClassName = () => {
    switch (variant) {
      case 'simple':
        return 'flex gap-3 items-center';
      case 'new':
        return 'rounded-2xl border border-bb-line bg-bb-panel p-4 flex flex-col gap-3 transition-all';
      case 'matched':
        return 'rounded-2xl border p-4 flex flex-col gap-3 transition-all border-bb-line bg-bb-panel';
      case 'confirmed':
        return 'rounded-2xl border p-3 flex items-center gap-3 transition-all border-bb-green/20 bg-bb-green/5';
    }
  };

  // Confirmed variant has a special compact layout
  if (variant === 'confirmed') {
    return (
      <div className={getCardClassName()}>
        <CheckCircleIcon className="w-6 h-6 text-bb-green flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-bb-cream truncate">{displayName}</div>
          {originalName && (
            <div className="text-xs text-bb-muted truncate">{originalName}</div>
          )}
        </div>
        {inputs}
        {onEdit && (
          <button
            onClick={onEdit}
            className="p-1.5 text-bb-muted hover:text-bb-cream rounded-lg"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // Simple variant for manual entry page
  if (variant === 'simple') {
    return (
      <div className={getCardClassName()}>
        {itemSelector}
        {inputs}
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-2 text-bb-muted hover:text-bb-red hover:bg-bb-red/10 rounded-xl transition cursor-pointer"
            aria-label="Close"
            title="Remove"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // Card layout for new and matched variants (4-row structure)
  return (
    <div className={getCardClassName()}>
      {/* Row 1: Name & Remove */}
      <div className="flex justify-between items-start">
        <div className="font-bold text-bb-cream text-lg break-words pr-2 leading-tight" title={originalName || displayName}>
          {cleanDisplayName}
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1 text-slate-600 hover:text-bb-red rounded-lg flex-shrink-0"
            title="Remove"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Row 2: Header Badges (SKU, corrections, etc.) */}
      {headerBadges && (
        <div className="flex items-center gap-2 flex-wrap min-h-[1.5rem] mt-1">
          {headerBadges}
        </div>
      )}

      {/* Row 3 & 4: Price and Quantity Inputs (handled by ReceiptItemInputs) */}
      <div className="mt-1">
        {inputs}
      </div>

      {/* Match Display (for matched variant) */}
      {matchDisplay && (
        <div className="flex items-center gap-2 bg-bb-raised border border-bb-line rounded-xl px-3 py-2">
          {matchDisplay.confidence === 'high' ? (
            <CheckCircleIcon className="w-5 h-5 text-bb-green flex-shrink-0" />
          ) : (
            <SparklesIcon className="w-5 h-5 text-bb-gold flex-shrink-0" />
          )}
          <span className="font-semibold text-bb-cream truncate flex-1">
            {matchDisplay.matchedName}
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
            matchDisplay.confidence === 'high'
              ? 'bg-bb-green/10 text-bb-green'
              : 'bg-bb-gold/10 text-bb-gold'
          }`}>
            {matchDisplay.confidence === 'high' ? 'Exact' : 'Fuzzy'}
          </span>
        </div>
      )}

      {/* Card Controls (item selector + action buttons) */}
      {(itemSelector || onConfirm || additionalControls) && (
        <div className="flex items-center gap-2">
          {variant === 'new' && <PlusIcon className="w-5 h-5 text-bb-gold flex-shrink-0" />}
          {itemSelector && <div className="flex-1">{itemSelector}</div>}
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="p-2 bg-bb-gold text-bb-navy rounded-xl hover:brightness-110 transition-colors"
              title="Confirm"
            >
              <CheckCircleIcon className="w-5 h-5" />
            </button>
          )}
          {additionalControls}
        </div>
      )}
    </div>
  );
}
