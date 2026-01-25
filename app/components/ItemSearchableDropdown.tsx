'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { MagnifyingGlassIcon, PlusIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/solid';

interface ItemSearchableDropdownProps {
    items: { id: string; name: string }[];
    selectedItemId?: string;
    onSelect: (itemId: string, name: string) => void;
    onAddNew: (name: string) => void;
    placeholder?: string;
    className?: string;
    favoritedIds?: Set<string>;
}

export default function ItemSearchableDropdown({
    items,
    selectedItemId,
    onSelect,
    onAddNew,
    placeholder = "Search items...",
    className = "",
    favoritedIds = new Set()
}: ItemSearchableDropdownProps) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initial state setup
    useEffect(() => {
        if (selectedItemId) {
            const item = items.find(i => i.id === selectedItemId);
            if (item) setQuery(item.name);
        } else {
            setQuery('');
        }
    }, [selectedItemId, items]);

    // Click outside handler
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                const item = items.find(i => i.id === selectedItemId);
                setQuery(item ? item.name : '');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedItemId, items]);

    const filteredItems = useMemo(() => {
        const q = query.toLowerCase().trim();
        const results = q === ''
            ? items.slice(0, 10) // Show top 10 when empty
            : items.filter(item =>
                item.name.toLowerCase().includes(q)
            ).slice(0, 10); // Show up to 10 filtered results (like Items page)

        // Sort: Favorites first
        return results.sort((a, b) => {
            const aFav = favoritedIds.has(a.id);
            const bFav = favoritedIds.has(b.id);
            if (aFav && !bFav) return -1;
            if (!aFav && bFav) return 1;
            return 0;
        });
    }, [items, query, favoritedIds]);

    const handleSelect = (itemId: string, name: string) => {
        onSelect(itemId, name);
        setQuery(name);
        setIsOpen(false);
        setSelectedIndex(-1);
    };

    const isExisting = items.some(i => i.name.toLowerCase() === query.trim().toLowerCase());
    const showCreateNew = query.trim() && !isExisting;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
            setSelectedIndex(prev => (prev < filteredItems.length + (showCreateNew ? 0 : -1) ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > -1 ? prev - 1 : -1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex === -1) {
                const exactMatch = items.find(i => i.name.toLowerCase() === query.trim().toLowerCase());
                if (exactMatch) {
                    handleSelect(exactMatch.id, exactMatch.name);
                } else if (showCreateNew) {
                    onAddNew(query.trim());
                    setIsOpen(false);
                }
            } else if (showCreateNew && selectedIndex === filteredItems.length) {
                onAddNew(query.trim());
                setIsOpen(false);
            } else if (filteredItems[selectedIndex]) {
                handleSelect(filteredItems[selectedIndex].id, filteredItems[selectedIndex].name);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const handleClear = () => {
        onSelect('', '');
        setQuery('');
        setIsOpen(true);
        inputRef.current?.focus();
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <div className="relative group">
                <input
                    ref={inputRef}
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                        setSelectedIndex(-1);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                />
                {query && (
                    <button
                        onClick={handleClear}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600"
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-2xl shadow-lg max-h-60 overflow-y-auto scrollbar-hide">
                    {filteredItems.length > 0 ? (
                        <div>
                            {filteredItems.map((item, index) => {
                                const isFav = favoritedIds.has(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        onClick={() => handleSelect(item.id, item.name)}
                                        className={`w-full text-left px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 text-gray-800 flex items-center gap-2 ${selectedIndex === index ? 'bg-blue-50' : ''
                                            }`}
                                    >
                                        {isFav && <span className="text-yellow-500 text-lg">⭐</span>}
                                        <span>{item.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : !showCreateNew && (
                        <div className="px-4 py-3 text-sm text-gray-500 italic text-center">
                            No matching items found...
                        </div>
                    )}

                    {/* Quick Add */}
                    {showCreateNew && (
                        <button
                            type="button"
                            onMouseEnter={() => setSelectedIndex(filteredItems.length)}
                            onClick={() => {
                                onAddNew(query.trim());
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 font-semibold text-blue-600 border-t border-gray-100 flex items-center gap-2 ${selectedIndex === filteredItems.length ? 'bg-blue-50' : ''
                                }`}
                        >
                            <PlusIcon className="h-4 w-4" />
                            <span>Add "{query.trim()}"</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
