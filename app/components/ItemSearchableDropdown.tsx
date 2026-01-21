'use client';
import { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, PlusIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/solid';

interface ItemSearchableDropdownProps {
    items: { id: string; name: string }[];
    selectedItemId?: string;
    onSelect: (itemId: string, name: string) => void;
    onAddNew: (name: string) => void;
    placeholder?: string;
    className?: string;
}

export default function ItemSearchableDropdown({
    items,
    selectedItemId,
    onSelect,
    onAddNew,
    placeholder = "Search items...",
    className = ""
}: ItemSearchableDropdownProps) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initial state setup
    useEffect(() => {
        if (selectedItemId) {
            const item = items.find(i => i.id === selectedItemId);
            if (item) setQuery(item.name);
        }
    }, [selectedItemId, items]);

    // Click outside handler
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // Reset query to selected item if blurring without selection
                const item = items.find(i => i.id === selectedItemId);
                setQuery(item ? item.name : '');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedItemId, items]);

    const filteredItems = query.trim() === ''
        ? items.slice(0, 100) // Show top 100 when empty
        : items.filter(item =>
            item.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 200); // Show up to 200 filtered results

    const handleSelect = (itemId: string, name: string) => {
        onSelect(itemId, name);
        setQuery(name);
        setIsOpen(false);
    };

    const handleClear = () => {
        onSelect('', '');
        setQuery('');
        setIsOpen(true);
        inputRef.current?.focus();
    };

    const isExisting = items.some(i => i.name.toLowerCase() === query.trim().toLowerCase());

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    className="block w-full pl-9 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
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
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                    {filteredItems.length > 0 ? (
                        <div className="py-1">
                            {filteredItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelect(item.id, item.name)}
                                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-blue-50 transition-colors ${selectedItemId === item.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700'
                                        }`}
                                >
                                    <span>{item.name}</span>
                                    {selectedItemId === item.id && <CheckIcon className="h-4 w-4" />}
                                </button>
                            ))}
                        </div>
                    ) : query && !isExisting ? null : (
                        <div className="px-4 py-3 text-xs text-center text-gray-500 italic">
                            No matching items found...
                        </div>
                    )}

                    {/* Quick Add */}
                    {query.trim() && !isExisting && (
                        <button
                            onClick={() => {
                                onAddNew(query.trim());
                                setIsOpen(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border-t border-blue-100 flex items-center gap-2"
                        >
                            <PlusIcon className="h-4 w-4" />
                            <span>Create "{query.trim()}"</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
