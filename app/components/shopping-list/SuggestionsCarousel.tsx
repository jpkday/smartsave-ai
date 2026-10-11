'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import SuggestionCard from './SuggestionCard';

export interface SuggestionData {
  overdue: any[];
  upcoming: any[];
  together: any[];
  deals: any[];
  staples: StapleItem[];
}

export interface StapleItem {
  item_id: number;
  item_name: string;
  times_purchased: number;
  last_purchase: string;
}

interface SuggestionsCarouselProps {
  data: SuggestionData;
  onAddItem: (itemName: string) => void;
}

const CARD_TYPES = ['overdue', 'upcoming', 'together', 'deals'] as const;

export default function SuggestionsCarousel({ data, onAddItem }: SuggestionsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Only show cards that have items
  const visibleCards = CARD_TYPES.filter((type) => data[type].length > 0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || visibleCards.length === 0) return;

    const scrollLeft = el.scrollLeft;
    const cardWidth = el.firstElementChild
      ? (el.firstElementChild as HTMLElement).offsetWidth
      : 1;
    const gap = 12; // gap-3 = 0.75rem = 12px
    const index = Math.round(scrollLeft / (cardWidth + gap));
    setActiveIndex(Math.min(index, visibleCards.length - 1));
  }, [visibleCards.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (visibleCards.length === 0) return null;

  return (
    <div className="mb-4">
      {/* Scrollable card container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {visibleCards.map((type) => (
          <SuggestionCard
            key={type}
            type={type}
            items={data[type]}
            onAddItem={onAddItem}
          />
        ))}
      </div>

      {/* Dot indicators */}
      {visibleCards.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {visibleCards.map((type, i) => (
            <div
              key={type}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === activeIndex
                  ? 'bg-gray-600 w-3'
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
