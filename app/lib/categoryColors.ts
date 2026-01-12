export const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Produce': 'bg-emerald-50 border-emerald-200 text-emerald-700',
      'Pantry': 'bg-yellow-50 border-yellow-200 text-yellow-700',
      'Dairy': 'bg-purple-50 border-purple-200 text-purple-700',
      'Beverage': 'bg-sky-50 border-sky-200 text-sky-700',
      'Meat': 'bg-red-50 border-red-200 text-red-700',
      'Frozen': 'bg-cyan-50 border-cyan-200 text-cyan-700',
      'Refrigerated': 'bg-blue-50 border-blue-200 text-blue-700',
      'Bakery': 'bg-orange-50 border-orange-200 text-orange-700',
      'Household': 'bg-amber-50 border-amber-200 text-amber-700',
      'Health': 'bg-pink-50 border-pink-200 text-pink-700',
      'Other': 'bg-slate-50 border-slate-200 text-slate-700',
    };
    return colors[category] || 'bg-slate-50 border-slate-200 text-slate-700';
  };
