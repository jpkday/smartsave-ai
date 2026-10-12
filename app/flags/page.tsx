"use client";

import React, { useState } from 'react';

export default function FlagsPage() {
    const [selected, setSelected] = useState<string | null>(null);

    const options = [
        {
            id: 'classic',
            name: 'Classic Rectangular',
            svg: (active: boolean) => (
                <svg className={`w-12 h-12 ${active ? 'text-bb-red' : 'text-slate-600'}`} fill={active ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8m2-2h-2m-2 0H5a2 2 0 0 0-2 2v4" />
                </svg>
            )
        },
        {
            id: 'pennant',
            name: 'Triangular Pennant',
            svg: (active: boolean) => (
                <svg className={`w-12 h-12 ${active ? 'text-bb-red' : 'text-slate-600'}`} fill={active ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V3L15 8L3 13" />
                </svg>
            )
        },
        {
            id: 'swallowtail',
            name: 'Swallowtail',
            svg: (active: boolean) => (
                <svg className={`w-12 h-12 ${active ? 'text-bb-red' : 'text-slate-600'}`} fill={active ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V5h13l-3 4 3 4H3" />
                </svg>
            )
        },
        {
            id: 'rounded',
            name: 'Modern / Rounded',
            svg: (active: boolean) => (
                <svg className={`w-12 h-12 ${active ? 'text-bb-red' : 'text-slate-600'}`} fill={active ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v18M5 5c0 0 3-2 9-2s9 2 9 2v9c0 0-3-2-9-2s-9 2-9 2" />
                </svg>
            )
        }
    ];

    return (
        <div className="min-h-screen app-bg p-10 font-sans">
            <div className="max-w-4xl mx-auto bg-bb-panel border border-bb-line rounded-2xl shadow-sm p-10">
                <h1 className="text-3xl font-bold text-bb-cream mb-8">Flag Icon Options</h1>
                <p className="text-bb-muted mb-10">Select an option to see it highlighted. Each option shows the Inactive (Grey) and Active (Red) states.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {options.map((opt) => (
                        <div
                            key={opt.id}
                            className={`border-2 rounded-2xl p-6 cursor-pointer transition-all ${selected === opt.id ? 'border-bb-gold bg-bb-gold/10 ring-2 ring-bb-gold/30' : 'border-bb-line hover:border-bb-gold/50'
                                }`}
                            onClick={() => setSelected(opt.id)}
                        >
                            <h2 className="text-xl font-bold text-bb-cream mb-4">{opt.name}</h2>
                            <div className="flex items-center gap-10">
                                <div className="flex flex-col items-center gap-2">
                                    {opt.svg(false)}
                                    <span className="text-sm text-bb-muted font-mono">Inactive</span>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    {opt.svg(true)}
                                    <span className="text-sm text-bb-red font-bold font-mono">Active</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-12 p-6 bg-bb-raised border border-bb-line rounded-2xl">
                    <h3 className="font-bold text-bb-cream mb-2">Current Selection</h3>
                    {selected ? (
                        <p className="text-xl text-bb-gold font-semibold">
                            You selected: {options.find(o => o.id === selected)?.name}
                            <span className="text-sm text-bb-muted ml-2">(ID: {selected})</span>
                        </p>
                    ) : (
                        <p className="text-bb-muted italic">Click a box above to select a preference.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
