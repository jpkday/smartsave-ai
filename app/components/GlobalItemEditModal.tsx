'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface Category {
    id: number;
    name: string;
    color: string;
    sort_order: number;
}

interface Item {
    id: number;
    name: string;
    category_id?: number | null;
    unit: string;
    is_weighted: boolean;
}

interface GlobalItemEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: Item | null;
    householdCode: string | null;
    categories: Category[];
    isFavorited?: boolean;
    onSave: (updatedItem: Item, favoriteChanged?: boolean, nextFavorite?: boolean) => void;
}

export default function GlobalItemEditModal({
    isOpen,
    onClose,
    item,
    householdCode,
    categories,
    isFavorited = false,
    onSave,
}: GlobalItemEditModalProps) {
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [isWeighted, setIsWeighted] = useState(false);
    const [unit, setUnit] = useState('each');
    const [favorite, setFavorite] = useState(false);
    const [saving, setSaving] = useState(false);

    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && item) {
            setName(item.name);
            // If category is "Other", treat it as null for the dropdown (which has a hardcoded Other option)
            const catName = categories.find(c => c.id === item.category_id)?.name;
            setCategoryId(catName?.trim().toLowerCase() === 'other' ? null : (item.category_id ?? null));
            setIsWeighted(item.is_weighted ?? false);
            setUnit(item.unit === 'count' ? 'each' : (item.unit ?? 'each'));
            setFavorite(isFavorited);

            // Focus name input
            setTimeout(() => {
                if (nameInputRef.current) {
                    nameInputRef.current.focus();
                    const len = nameInputRef.current.value.length;
                    nameInputRef.current.setSelectionRange(len, len);
                }
            }, 50);
        }
    }, [isOpen, item, isFavorited]);

    if (!isOpen || !item) return null;

    const handleSave = async () => {
        const nextName = name.trim();
        if (!nextName) return;

        setSaving(true);
        try {
            const nameChanged = nextName !== item.name;

            // 1. Rename if needed with cascade
            if (nameChanged) {
                // Check for collisions (this is a bit limited since we don't have the whole items list here, 
                // but Supabase will error if there's a unique constraint, though name isn't unique globally usually)
                const { error: itemError } = await supabase
                    .from('items')
                    .update({ name: nextName })
                    .eq('id', item.id);

                if (itemError) throw new Error(itemError.message);

                // Cascade rename
                await Promise.all([
                    supabase
                        .from('price_history')
                        .update({ item_name: nextName })
                        .or(`item_id.eq.${item.id},item_name.eq."${item.name}"`),
                    supabase
                        .from('shopping_list')
                        .update({ item_name: nextName })
                        .or(`item_id.eq.${item.id},item_name.eq."${item.name}"`),
                    supabase
                        .from('shopping_list_events')
                        .update({ item_name: nextName })
                        .or(`item_id.eq.${item.id},item_name.eq."${item.name}"`)
                ]);
            }

            // 2. Update other metadata
            const { error: metadataError } = await supabase
                .from('items')
                .update({
                    category_id: categoryId,
                    is_weighted: isWeighted,
                    unit: unit
                })
                .eq('id', item.id);

            if (metadataError) throw metadataError;

            // 3. Update Favorite if householdCode is provided
            const favoriteChanged = favorite !== isFavorited;
            if (householdCode && favoriteChanged) {
                if (favorite) {
                    await supabase
                        .from('household_item_favorites')
                        .insert({
                            household_code: householdCode,
                            item_id: item.id,
                        });
                } else {
                    await supabase
                        .from('household_item_favorites')
                        .delete()
                        .eq('household_code', householdCode)
                        .eq('item_id', item.id);
                }
            }

            onSave(
                { ...item, name: nextName, category_id: categoryId, is_weighted: isWeighted, unit: unit },
                favoriteChanged,
                favorite
            );
            onClose();
        } catch (e) {
            console.error('Save failed:', e);
            alert('An error occurred while saving. Please check your connection.');
        } finally {
            setSaving(false);
        }
    };

    const getCategoryColorById = (id: number | null) => {
        if (!id) return 'bg-gray-50 border-gray-200';
        const cat = categories.find(c => c.id === id);
        return cat ? cat.color : 'bg-gray-50 border-gray-200';
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-5">
                    <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit Item
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-300 hover:text-gray-500 cursor-pointer text-xl -mt-1"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                <div className="space-y-4">
                    <div
                        className={`rounded-2xl p-4 border transition-colors ${getCategoryColorById(categoryId)} bg-opacity-10`}
                    >
                        <div className="space-y-3">
                            {/* Name + Favorite Star */}
                            <div>
                                <div className="flex items-center gap-2">
                                    {householdCode && (
                                        <button
                                            type="button"
                                            onClick={() => setFavorite(!favorite)}
                                            className={
                                                favorite
                                                    ? 'text-4xl leading-none cursor-pointer'
                                                    : 'text-4xl leading-none text-gray-300 cursor-pointer'
                                            }
                                            aria-label={favorite ? 'Unfavorite item' : 'Favorite item'}
                                        >
                                            {favorite ? '⭐' : '☆'}
                                        </button>
                                    )}
                                    <label className="text-sm font-semibold text-gray-700">Item Name</label>
                                </div>
                                <div className="mt-1">
                                    <input
                                        ref={nameInputRef}
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                        className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 text-base bg-white"
                                        placeholder="e.g., Grapefruit (ct)"
                                        disabled={saving}
                                    />
                                </div>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="text-sm font-semibold text-gray-700">Category</label>
                                <select
                                    value={(categories.find(c => c.id === categoryId)?.name.trim().toLowerCase() === 'other') ? '' : (categoryId ?? '')}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setCategoryId(value === '' ? null : parseInt(value, 10));
                                    }}
                                    className="w-full mt-1 px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-200 bg-white"
                                    disabled={saving}
                                >
                                    <option value="">Other</option>
                                    {categories
                                        .filter(cat => cat.name.trim().toLowerCase() !== 'other')
                                        .map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Weight & Unit Section */}
                    <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-bold text-gray-800">Sold by Weight</label>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const nextWeighted = !isWeighted;
                                    setIsWeighted(nextWeighted);
                                    if (nextWeighted) {
                                        // If turning ON weight, default to lb
                                        setUnit('lb');
                                    } else {
                                        // If turning OFF weight, switch to each
                                        setUnit('each');
                                    }
                                }}
                                className={`w-14 h-8 rounded-full transition-colors relative ${isWeighted ? 'bg-indigo-600' : 'bg-gray-200'}`}
                                disabled={saving}
                            >
                                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${isWeighted ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>

                        {isWeighted && (
                            <div className="mt-4">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block text-center">Default Unit</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'lb', label: 'lb' },
                                        { id: 'oz', label: 'oz' }
                                    ].map(u => (
                                        <button
                                            key={u.id}
                                            type="button"
                                            onClick={() => setUnit(u.id)}
                                            className={`py-2 text-xs font-bold rounded-xl border transition-all ${unit === u.id
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                                                }`}
                                            disabled={saving}
                                        >
                                            {u.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all hover:-translate-y-0.5"
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
