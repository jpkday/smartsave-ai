'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

const SHARED_USER_ID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_ITEMS = [
    'Eggs (dozen)',
    'Milk (gallon)',
    'Cheese (lb)',
    'Apples (lb)',
    'Chicken Breast (lb)',
    'Ground Beef (lb)',
    'Bread (loaf)',
    'Butter (lb)',
];

export default function WelcomePage() {
    const router = useRouter();
    const [householdCode, setHouseholdCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [allItems, setAllItems] = useState<{ id: number; name: string }[]>([]);
    const [newItem, setNewItem] = useState('');
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [autocompleteItems, setAutocompleteItems] = useState<string[]>([]);
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        const code = localStorage.getItem('household_code');
        const hasSeenOnboarding = localStorage.getItem('has_seen_onboarding');

        if (!code) {
            router.push('/');
            return;
        }

        if (hasSeenOnboarding === 'true') {
            router.push('/list');
            return;
        }

        setHouseholdCode(code);

        // Safeguard: Check if user already has items. 
        // If they do, they don't need the onboarding "Welcome" experience.
        checkExistingItems(code).then((hasItems) => {
            if (!hasItems) {
                fetchBaseItems();
            }
        });
    }, [router]);

    async function checkExistingItems(code: string) {
        try {
            const { count, error } = await supabase
                .from('shopping_list')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', SHARED_USER_ID)
                .eq('household_code', code);

            if (!error && count !== null && count > 0) {
                localStorage.setItem('has_seen_onboarding', 'true');
                router.push('/list');
                return true;
            }
        } catch (err) {
            console.error('Error checking existing items:', err);
        }
        return false;
    }

    async function fetchBaseItems() {
        try {
            const { data, error } = await supabase
                .from('items')
                .select('id, name')
                .order('name');

            if (!error && data) {
                setAllItems(data);
            }
        } catch (err) {
            console.error('Error fetching items:', err);
        } finally {
            setLoading(false);
        }
    }

    const handleInputChange = (val: string) => {
        setNewItem(val);
        if (val.length > 1) {
            const filtered = allItems
                .filter(item => item.name.toLowerCase().includes(val.toLowerCase()))
                .slice(0, 10)
                .map(i => i.name);
            setAutocompleteItems(filtered);
            setShowAutocomplete(filtered.length > 0);
        } else {
            setShowAutocomplete(false);
        }
    };

    const addItemToDb = async (itemName: string) => {
        if (isAdding) return;
        setIsAdding(true);

        try {
            let itemId: number | null = null;
            const match = allItems.find(i => i.name === itemName);

            if (match) {
                itemId = match.id;
            } else {
                const { data: newItemData, error: itemError } = await supabase
                    .from('items')
                    .insert({
                        name: itemName,
                        household_code: householdCode,
                    })
                    .select('id')
                    .single();
                if (itemError) throw itemError;
                itemId = newItemData.id;
            }

            if (itemId) {
                await supabase.from('shopping_list').insert({
                    item_id: itemId,
                    item_name: itemName,
                    quantity: 1,
                    user_id: SHARED_USER_ID,
                    household_code: householdCode,
                    checked: false,
                    added_at: new Date().toISOString(),
                });
            }

            // Success! Clear onboarding flag and go to list
            localStorage.setItem('has_seen_onboarding', 'true');
            router.push('/list');
        } catch (err) {
            console.error('Error adding first item:', err);
            setIsAdding(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen app-bg flex items-center justify-center p-6">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-bb-gold border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen app-bg">
            <div className="max-w-2xl mx-auto px-4 py-12">
                <div className="bg-bb-panel border border-bb-line rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-700">
                    {/* Hero Banner */}
                    <div className="border-b border-bb-line p-6 md:p-10 text-center text-bb-cream relative overflow-hidden">

                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4">
                            <span className="text-3xl">✨</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black mb-3 leading-tight">
                            Welcome to SmartSave!
                        </h1>
                        <p className="text-lg md:text-xl text-bb-muted max-w-xl mx-auto font-medium">
                            We&apos;re glad you&apos;re here. Let&apos;s build your first shopping list and start saving you money.
                        </p>
                    </div>

                    <div className="p-6 md:p-10 space-y-10">
                        {/* Search Section */}
                        <div className="max-w-2xl mx-auto">
                            <h2 className="text-sm font-black text-bb-gold uppercase tracking-[0.2em] mb-3 text-center">
                                Step 1: What do you need today?
                            </h2>
                            <div className="relative">
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        placeholder="Search e.g. 'Eggs', 'Milk'..."
                                        className="flex-1 px-6 py-4 border border-bb-line rounded-2xl bg-bb-raised text-bb-cream placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-bb-gold/50 focus:border-bb-gold/50 text-xl transition-all font-semibold"
                                        value={newItem}
                                        onChange={(e) => handleInputChange(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addItemToDb(newItem)}
                                        autoFocus
                                    />
                                    <button
                                        disabled={!newItem.trim() || isAdding}
                                        onClick={() => addItemToDb(newItem)}
                                        className="bg-bb-gold text-bb-navy px-8 py-4 rounded-2xl font-black hover:brightness-110 active:scale-95 transition-all text-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isAdding ? 'Adding...' : 'Add'}
                                    </button>
                                </div>

                                {showAutocomplete && (
                                    <div className="absolute z-10 w-full mt-3 bg-bb-panel border border-bb-line rounded-2xl shadow-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                                        {autocompleteItems.map((item) => (
                                            <button
                                                key={item}
                                                onClick={() => addItemToDb(item)}
                                                className="w-full text-left px-8 py-5 hover:bg-white/5 cursor-pointer border-b border-bb-line last:border-b-0 text-bb-cream font-bold transition-colors flex items-center justify-between group"
                                            >
                                                {item}
                                                <span className="opacity-0 group-hover:opacity-100 text-bb-gold text-sm">Add Item +</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Suggestions Grid */}
                        <div className="max-w-4xl mx-auto">
                            <h2 className="text-sm font-black text-bb-muted uppercase tracking-[0.2em] mb-6 text-center">
                                Or start with the essentials
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {DEFAULT_ITEMS.map((name) => (
                                    <button
                                        key={name}
                                        onClick={() => addItemToDb(name)}
                                        className="flex flex-col items-center justify-center p-4 bg-white/[0.03] border border-bb-line rounded-2xl hover:border-bb-gold/50 hover:bg-white/5 transition-all group cursor-pointer active:scale-95 relative overflow-hidden"
                                    >
                                        <span className="text-4xl mb-2 group-hover:scale-110 transition-transform duration-300 transform-gpu">
                                            {name.includes('Milk') ? '🥛' : name.includes('Eggs') ? '🥚' : name.includes('Cheese') ? '🧀' : name.includes('Apple') ? '🍎' : name.includes('Chicken') ? '🍗' : name.includes('Beef') ? '🥩' : name.includes('Bread') ? '🍞' : name.includes('Butter') ? '🧈' : '🛒'}
                                        </span>
                                        <span className="text-sm font-extrabold text-bb-cream text-center">{name.split(' (')[0]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Educational Footer */}
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-6 pt-10 border-t border-bb-line">
                            <div className="flex gap-4 items-center">
                                <div className="w-10 h-10 bg-bb-raised border border-bb-line text-bb-gold rounded-xl flex items-center justify-center font-black text-xl shrink-0">1</div>
                                <div>
                                    <h4 className="text-lg font-black text-bb-cream">Build your List</h4>
                                    <p className="text-base text-bb-muted font-medium leading-relaxed">Add everything you need. We&apos;ll keep track of it all.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-center">
                                <div className="w-10 h-10 bg-bb-raised border border-bb-line text-bb-gold rounded-xl flex items-center justify-center font-black text-xl shrink-0">2</div>
                                <div>
                                    <h4 className="text-lg font-black text-bb-cream">Compare Prices</h4>
                                    <p className="text-base text-bb-muted font-medium leading-relaxed">We automatically find the cheapest stores for every item.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-center">
                                <div className="w-10 h-10 bg-bb-raised border border-bb-line text-bb-gold rounded-xl flex items-center justify-center font-black text-xl shrink-0">3</div>
                                <div>
                                    <h4 className="text-lg font-black text-bb-cream">Save Automatically</h4>
                                    <p className="text-base text-bb-muted font-medium leading-relaxed">Most families save over 20% on every trip with SmartSave.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
