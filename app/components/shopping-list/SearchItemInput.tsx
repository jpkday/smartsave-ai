'use client';

interface SearchItemInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  showAutocomplete: boolean;
  autocompleteItems: string[];
  onSelectAutocomplete: (itemName: string) => void;
  onCloseAutocomplete?: () => void;
  variant?: 'standard' | 'hero';
  className?: string;
  showSubmitButton?: boolean;
}

export default function SearchItemInput({
  value,
  onChange,
  onSubmit,
  onFocus,
  placeholder = 'Search items to add...',
  showAutocomplete,
  autocompleteItems,
  onSelectAutocomplete,
  onCloseAutocomplete,
  variant = 'standard',
  className = '',
  showSubmitButton = true
}: SearchItemInputProps) {
  const isHero = variant === 'hero';

  return (
    <div className={`relative autocomplete-container ${className}`}>
      <div className={isHero ? 'flex gap-3' : 'flex gap-2'}>
        <div className="relative flex-1">
          <input
            type="text"
            placeholder={placeholder}
            className={
              isHero
                ? 'w-full px-6 py-4 border border-bb-line rounded-2xl bg-bb-raised text-bb-cream placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-bb-gold/50 focus:border-bb-gold/50 text-lg transition-all font-medium italic'
                : 'w-full px-3 py-2 pr-8 border border-bb-line rounded-2xl bg-bb-raised text-bb-cream placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-bb-gold/50 focus:border-bb-gold/50'
            }
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (onSubmit) onSubmit();
                if (onCloseAutocomplete) onCloseAutocomplete();
              }
            }}
            onFocus={onFocus}
          />
          {value && !showSubmitButton && (
            <button
              onClick={() => onChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-bb-muted hover:text-bb-cream transition"
              type="button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {showSubmitButton && (
          <button
            onClick={onSubmit}
            className={
              isHero
                ? 'bg-bb-gold text-bb-navy px-8 py-4 rounded-2xl font-bold hover:brightness-110 cursor-pointer transition-all active:scale-95 text-lg'
                : 'bg-bb-gold text-bb-navy px-4 py-2 rounded-2xl font-semibold hover:brightness-110 cursor-pointer transition whitespace-nowrap'
            }
          >
            Add
          </button>
        )}
      </div>

      {showAutocomplete && autocompleteItems.length > 0 && (
        <div
          className={
            isHero
              ? 'absolute z-10 w-full mt-2 bg-bb-panel border border-bb-line rounded-2xl shadow-sm max-h-60 overflow-y-auto overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200'
              : 'absolute z-10 w-full mt-1 bg-bb-panel border border-bb-line rounded-2xl shadow-sm max-h-60 overflow-y-auto'
          }
        >
          {(isHero ? autocompleteItems : autocompleteItems.slice(0, 10)).map((item) => (
            <button
              key={item}
              onClick={() => {
                onSelectAutocomplete(item);
                if (onCloseAutocomplete) onCloseAutocomplete();
              }}
              className={
                isHero
                  ? 'w-full text-left px-6 py-4 hover:bg-white/5 cursor-pointer border-b border-bb-line last:border-b-0 text-bb-cream font-medium transition-colors'
                  : 'w-full text-left px-4 py-3 hover:bg-white/5 cursor-pointer border-b border-bb-line last:border-b-0 text-bb-cream'
              }
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
