'use client';

interface SearchItemInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onFocus?: () => void;
  placeholder?: string;
  showAutocomplete: boolean;
  autocompleteItems: string[];
  onSelectAutocomplete: (itemName: string) => void;
  variant?: 'standard' | 'hero';
  className?: string;
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
  variant = 'standard',
  className = ''
}: SearchItemInputProps) {
  const isHero = variant === 'hero';

  return (
    <div className={`relative autocomplete-container ${className}`}>
      <div className={isHero ? 'flex gap-3' : 'flex gap-2'}>
        <input
          type="text"
          placeholder={placeholder}
          className={
            isHero
              ? 'flex-1 px-6 py-4 border-2 border-gray-100 rounded-2xl focus:border-teal-500 focus:ring-4 focus:ring-teal-100 text-gray-800 text-lg shadow-inner bg-gray-50 transition-all font-medium italic'
              : 'flex-1 px-3 py-2 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800'
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          onFocus={onFocus}
        />

        <button
          onClick={onSubmit}
          className={
            isHero
              ? 'bg-teal-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-teal-700 cursor-pointer transition-all shadow-lg active:scale-95 text-lg'
              : 'bg-indigo-600 text-white px-4 py-2 rounded-2xl font-semibold hover:bg-indigo-700 cursor-pointer transition whitespace-nowrap'
          }
        >
          Add
        </button>
      </div>

      {showAutocomplete && autocompleteItems.length > 0 && (
        <div
          className={
            isHero
              ? 'absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200'
              : 'absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-2xl shadow-lg max-h-60 overflow-y-auto'
          }
        >
          {(isHero ? autocompleteItems : autocompleteItems.slice(0, 10)).map((item) => (
            <button
              key={item}
              onClick={() => onSelectAutocomplete(item)}
              className={
                isHero
                  ? 'w-full text-left px-6 py-4 hover:bg-teal-50 cursor-pointer border-b border-gray-50 last:border-b-0 text-gray-800 font-medium transition-colors'
                  : 'w-full text-left px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-gray-800'
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
