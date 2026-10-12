'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Header from '@/app/components/Header';
import { CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

function SuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tripId = searchParams.get('tripId');

    return (
        <main className="max-w-md mx-auto p-4 flex flex-col items-center justify-center pt-20 text-center">

            <div className="w-20 h-20 bg-bb-green/10 rounded-full flex items-center justify-center mb-6">
                <CheckCircleIcon className="w-12 h-12 text-bb-green" />
            </div>

            <h1 className="text-2xl font-bold text-bb-cream mb-2">Receipt Saved!</h1>
            <p className="text-bb-muted mb-8">
                We&apos;ve processed your receipt and added the items to your pantry history.
            </p>

            <div className="w-full space-y-3">
                {tripId && (
                    <button
                        onClick={() => router.push(`/trips/${tripId}`)}
                        className="w-full py-3 px-4 bg-bb-gold text-bb-navy rounded-lg font-semibold hover:brightness-110 transition-colors"
                    >
                        View Trip Details
                    </button>
                )}

                <button
                    onClick={() => router.push('/receipts')} // Assuming default receipts page has the "Add" button prominent enough or add /receipts/new if needed. Sticking to Dashboard for safety or restart scan?
                    // Actually, best to go back to Dashboard or Scanner. User asked for "Scan Another".
                    // If /receipts/new doesn't exist, we should check. I'll stick to /receipts for now as it has "Add Receipt" button.
                    className="w-full py-3 px-4 bg-transparent text-bb-cream border border-bb-line rounded-lg font-semibold hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                >
                    <ArrowPathIcon className="w-5 h-5" />
                    Scan Another
                </button>

                <button
                    onClick={() => router.push('/receipts')}
                    className="w-full py-3 px-4 text-bb-muted text-sm hover:text-bb-cream"
                >
                    Return to Dashboard
                </button>
            </div>
        </main>
    );
}

export default function UploadSuccessPage() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <div className="min-h-screen app-bg text-bb-cream pb-20">
            <div className="sticky top-0 z-50 app-header">
                <div className="max-w-5xl mx-auto px-4 md:px-8 py-4">
                    <Header currentPage="Add Receipt" />
                </div>
            </div>
            <Suspense fallback={<div className="p-8 text-center text-bb-muted">Loading...</div>}>
                <SuccessContent />
            </Suspense>
        </div>
    );
}
