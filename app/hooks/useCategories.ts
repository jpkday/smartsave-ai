import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Category {
    id: number;
    name: string;
    color: string;
    sort_order: number;
}

export const useCategories = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCategories = async () => {
            // Fetch from DB
            const { data, error } = await supabase
                .from('categories')
                .select('*')
                .order('sort_order', { ascending: true });

            if (data) {
                setCategories(data);
            } else {
                console.error('Error loading categories:', error);
                // Fallback or empty
            }
            setLoading(false);
        };

        fetchCategories();
    }, []);

    const getCategoryName = (id: number | null | undefined): string => {
        if (id === null || id === undefined) return 'Other';
        const cat = categories.find(c => c.id === id);
        return cat ? cat.name : 'Other';
    };

    // Categories share one neutral style; per-category colors from the DB are no longer used
    const getCategoryColorById = (_id: number | null | undefined): string =>
        'bg-white/[0.03] border-bb-line text-bb-muted';

    return { categories, loading, getCategoryName, getCategoryColorById };
};
