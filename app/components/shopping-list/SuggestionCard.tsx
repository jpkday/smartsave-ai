'use client';

interface SuggestionItem {
  item_id: number;
  item_name: string;
  category_id?: number | null;
  // Overdue / upcoming
  avg_days_between?: number;
  days_since_last?: number;
  days_overdue?: number;
  // Often together
  co_purchase_count?: number;
  lift?: number;
  paired_with_name?: string;
  // Deals
  store_name?: string;
  current_price?: number;
  avg_price_paid?: number;
  savings_pct?: number;
}

type CardType = 'overdue' | 'upcoming' | 'together' | 'deals';

interface SuggestionCardProps {
  type: CardType;
  items: SuggestionItem[];
  onAddItem: (itemName: string) => void;
}

const CARD_CONFIG: Record<CardType, { title: string; icon: string; accent: string; bg: string }> = {
  overdue: {
    title: "It's been a while",
    icon: '⏰',
    accent: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
  },
  upcoming: {
    title: 'Running low soon?',
    icon: '📉',
    accent: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
  },
  together: {
    title: 'Often Together',
    icon: '🤝',
    accent: 'text-purple-600',
    bg: 'bg-purple-50 border-purple-200',
  },
  deals: {
    title: 'Save on These',
    icon: '💰',
    accent: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
  },
};

function getContext(type: CardType, item: SuggestionItem): string {
  switch (type) {
    case 'overdue':
      return `Every ${Math.round(item.avg_days_between || 0)}d · ${item.days_since_last}d ago`;
    case 'upcoming':
      return `Every ${Math.round(item.avg_days_between || 0)}d · ${item.days_since_last}d ago`;
    case 'together':
      return `with ${item.paired_with_name} · ${item.co_purchase_count}×`;
    case 'deals':
      return `$${item.current_price?.toFixed(2)} at ${item.store_name} · was $${item.avg_price_paid?.toFixed(2)}`;
    default:
      return '';
  }
}

export default function SuggestionCard({ type, items, onAddItem }: SuggestionCardProps) {
  const config = CARD_CONFIG[type];

  return (
    <div
      className={`flex-shrink-0 w-[85vw] max-w-sm snap-center rounded-2xl border-2 ${config.bg} p-4`}
    >
      {/* Card Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{config.icon}</span>
        <h3 className={`text-sm font-bold uppercase tracking-wider ${config.accent}`}>
          {config.title}
        </h3>
        <span className="text-xs text-gray-400 ml-auto">{items.length}</span>
      </div>

      {/* Item List */}
      <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
        {items.slice(0, 6).map((item) => (
          <button
            key={item.item_id}
            onClick={() => onAddItem(item.item_name)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/70 hover:bg-white transition active:scale-[0.98] cursor-pointer text-left"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {item.item_name}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {getContext(type, item)}
              </p>
            </div>
            {type === 'deals' && item.savings_pct ? (
              <span className="flex-shrink-0 text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                -{item.savings_pct}%
              </span>
            ) : (
              <span className="flex-shrink-0 text-gray-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
