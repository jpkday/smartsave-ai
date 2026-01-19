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

    const getCategoryColor = (categoryName: string) => {
        if (!categoryName) return 'bg-slate-50 border-slate-200 text-slate-700';
        const cat = categories.find(c => c.name === categoryName);
        return cat ? cat.color : 'bg-slate-50 border-slate-200 text-slate-700';
    };

    const getCategoryName = (id: number | null | undefined): string => {
        if (id === null || id === undefined) return 'Other';
        const cat = categories.find(c => c.id === id);
        return cat ? cat.name : 'Other';
    };

    const getCategoryColorById = (id: number | null | undefined): string => {
        if (id === null || id === undefined) return 'bg-slate-50 border-slate-200 text-slate-700';
        const cat = categories.find(c => c.id === id);
        return cat ? cat.color : 'bg-slate-50 border-slate-200 text-slate-700';
    };

    const categoryOptions = Array.from(new Set([...categories.map(c => c.name), 'Other']));

    return { categories, categoryOptions, loading, getCategoryColor, getCategoryName, getCategoryColorById };
};
