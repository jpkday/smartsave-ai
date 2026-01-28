import { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { MagnifyingGlassIcon, PlusIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/solid';

export interface ItemSearchableDropdownHandle {
    focus: () => void;
}

interface ItemSearchableDropdownProps {
    items: { id: string; name: string }[];
    selectedItemId?: string;
    onSelect: (itemId: string, name: string) => void;
    onInputChange?: (name: string) => void;
    placeholder?: string;
    className?: string;
    favoritedIds?: Set<string>;
}

const ItemSearchableDropdown = forwardRef<ItemSearchableDropdownHandle, ItemSearchableDropdownProps>((props, ref) => {
    const {
        items,
        selectedItemId,
        onSelect,
        onInputChange,
        placeholder = "Search items...",
        className = "",
        favoritedIds = new Set()
    } = props;
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
        focus: () => {
            inputRef.current?.focus();
        }
    }));

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
                // If the user has typed something that isn't the selected item, 
                // we should probably keep it or let the parent handle it.
                // Reverting aggressively is what caused the frustration.
                if (selectedItemId) {
                    const item = items.find(i => i.id === selectedItemId);
                    if (item && item.name.toLowerCase() !== query.toLowerCase().trim()) {
                        // User changed the name but didn't select anything, keep what they typed
                        if (onInputChange) onInputChange(query);
                    } else if (item) {
                        setQuery(item.name);
                    }
                }
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedItemId, items, query, onInputChange]);

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
        if (onInputChange) onInputChange(name);
        setIsOpen(false);
        setSelectedIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey && isOpen && filteredItems.length > 0)) {
            if (e.key === 'Tab') {
                // If we are at the end, let tab perform default (move to next field)
                // BUT user said "tab to advance through list then hit enter"
                // So we'll prevent default until they reach the end? 
                // Actually, standard behavior for this request is to cycle.
                if (selectedIndex < filteredItems.length - 1) {
                    e.preventDefault();
                    setSelectedIndex(prev => prev + 1);
                }
            } else {
                e.preventDefault();
                setIsOpen(true);
                setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : prev));
            }
        } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey && isOpen && filteredItems.length > 0)) {
            if (selectedIndex > -1) {
                e.preventDefault();
                setSelectedIndex(prev => prev - 1);
            }
        } else if (e.key === 'Enter') {
            if (selectedIndex === -1) {
                const q = query.trim();
                const exactMatch = items.find(i => i.name.toLowerCase() === q.toLowerCase());
                if (exactMatch) {
                    handleSelect(exactMatch.id, exactMatch.name);
                } else if (q.length > 0) {
                    // Signal "Create New" on Enter if no selection and no exact match
                    handleSelect('__new__', q);
                } else {
                    setIsOpen(false);
                }
            } else if (selectedIndex === filteredItems.length && query.trim().length > 0) {
                // "Create New" option was selected
                handleSelect('__new__', query.trim());
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
        setIsOpen(false);
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
                        const val = e.target.value;
                        setQuery(val);
                        if (onInputChange) onInputChange(val);
                        setIsOpen(true);
                        setSelectedIndex(-1);
                    }}
                    onFocus={() => { }}
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

            {isOpen && (query.trim().length > 0 || filteredItems.length > 0) && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-2xl shadow-lg max-h-60 overflow-y-auto scrollbar-hide">
                    <div>
                        {filteredItems.map((item, index) => {
                            const isFav = favoritedIds.has(item.id);
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    onMouseDown={(e) => {
                                        e.preventDefault(); // Prevent blur
                                        handleSelect(item.id, item.name);
                                    }}
                                    className={`w-full text-left px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 text-gray-800 flex items-center gap-2 ${selectedIndex === index ? 'bg-blue-50' : ''
                                        }`}
                                >
                                    {isFav && <span className="text-yellow-500 text-lg">⭐</span>}
                                    <span>{item.name}</span>
                                </button>
                            );
                        })}

                        {/* Special "Create New" option if query doesn't match an item exactly */}
                        {query.trim().length > 0 && !items.some(i => i.name.toLowerCase() === query.trim().toLowerCase()) && (
                            <button
                                type="button"
                                onMouseEnter={() => setSelectedIndex(filteredItems.length)}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelect('__new__', query.trim());
                                }}
                                className={`w-full text-left px-4 py-3 cursor-pointer text-blue-600 font-bold flex items-center gap-2 ${selectedIndex === filteredItems.length ? 'bg-blue-50' : ''
                                    }`}
                            >
                                <PlusIcon className="w-4 h-4" />
                                <span>Create new item: "{query.trim()}"</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

export default ItemSearchableDropdown;
