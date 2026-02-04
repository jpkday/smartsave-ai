
import { useState, useEffect } from 'react';
import {
    DocumentTextIcon,
    MagnifyingGlassIcon,
    BanknotesIcon,
    TagIcon,
    TicketIcon,
    ArchiveBoxIcon,
    CurrencyDollarIcon,
    SparklesIcon
} from '@heroicons/react/24/outline';

const MESSAGES = [
    { text: "Reading receipt...", icon: DocumentTextIcon },
    { text: "Identifying items...", icon: MagnifyingGlassIcon },
    { text: "Looking for savings...", icon: BanknotesIcon },
    { text: "Categorizing...", icon: TagIcon },
    { text: "Applying coupons...", icon: TicketIcon },
    { text: "Organizing...", icon: ArchiveBoxIcon },
    { text: "Checking prices...", icon: CurrencyDollarIcon },
    { text: "Finalizing details...", icon: SparklesIcon }
];

interface ProcessingLoaderProps {
    progress: { current: number; total: number } | null;
}

export default function ProcessingLoader({ progress }: ProcessingLoaderProps) {
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex(prev => (prev + 1) % MESSAGES.length);
        }, 6000);
        return () => clearInterval(interval);
    }, []);

    const currentMessage = MESSAGES[messageIndex];
    const CurrentIcon = currentMessage.icon;

    return (
        <div className="flex flex-col items-center justify-center p-4">
            {/* Centered Spinner */}
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 border-t-transparent mb-6"></div>

            {/* Icon and Text Label Below */}
            <div className="flex items-center justify-center gap-2 mb-6 animate-pulse">
                <CurrentIcon className="w-6 h-6 text-indigo-600" />
                <span className="font-bold text-gray-800 text-xl">
                    {currentMessage.text}
                </span>
            </div>
            {progress && (
                <div className="w-full">
                    <div className="w-full bg-gray-200 rounded-full h-4 mb-3 overflow-hidden">
                        <div
                            className="bg-blue-600 h-4 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                        ></div>
                    </div>
                    <div className="text-center font-bold text-gray-600 text-sm">
                        {progress.current} / {progress.total} items found
                    </div>
                </div>
            )}
        </div>
    );
}
