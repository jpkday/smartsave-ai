'use client';

import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface StatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning';
}

export default function StatusModal({
    isOpen,
    onClose,
    title,
    message,
    type = 'info'
}: StatusModalProps) {
    if (!isOpen) return null;

    const config = {
        success: {
            icon: <CheckCircleIcon className="w-12 h-12 text-bb-green" />,
            bgColor: 'bg-bb-green/10',
            titleColor: 'text-bb-green'
        },
        error: {
            icon: <ExclamationCircleIcon className="w-12 h-12 text-bb-red" />,
            bgColor: 'bg-bb-red/10',
            titleColor: 'text-bb-red'
        },
        warning: {
            icon: <ExclamationCircleIcon className="w-12 h-12 text-bb-gold" />,
            bgColor: 'bg-bb-gold/10',
            titleColor: 'text-bb-gold'
        },
        info: {
            icon: <InformationCircleIcon className="w-12 h-12 text-bb-muted" />,
            bgColor: 'bg-white/5',
            titleColor: 'text-bb-cream'
        }
    };

    const current = config[type];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div
                className={`bg-bb-panel text-bb-cream rounded-2xl max-w-sm w-full p-8 shadow-sm transform animate-in zoom-in-95 duration-200 border border-bb-line`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col items-center text-center">
                    <div className={`mb-4 p-4 rounded-full ${current.bgColor}`}>
                        {current.icon}
                    </div>

                    <h3 className={`text-2xl font-bold mb-2 ${current.titleColor}`}>
                        {title}
                    </h3>

                    <p className="text-bb-muted leading-relaxed mb-8">
                        {message}
                    </p>

                    <button
                        onClick={onClose}
                        className={`w-full py-4 rounded-2xl bg-bb-gold text-bb-navy font-semibold text-lg transition hover:brightness-110`}
                    >
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    );
}
