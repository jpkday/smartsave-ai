
'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
}

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false
}: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
            <div
                className="bg-bb-panel text-bb-cream rounded-2xl max-w-sm w-full p-8 shadow-sm transform animate-in zoom-in-95 duration-200 border border-bb-line"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col items-center text-center">
                    <div className={`mb-4 p-4 rounded-full ${isDestructive ? 'bg-bb-red/10' : 'bg-bb-gold/10'}`}>
                        <ExclamationTriangleIcon className={`w-12 h-12 ${isDestructive ? 'text-bb-red' : 'text-bb-gold'}`} />
                    </div>

                    <h3 className="text-2xl font-bold text-bb-cream mb-2">
                        {title}
                    </h3>

                    <p className="text-bb-muted leading-relaxed mb-8">
                        {message}
                    </p>

                    <div className="flex gap-3 w-full">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-2xl text-bb-cream font-bold text-lg border border-bb-line bg-transparent hover:bg-white/5 transition"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`flex-1 py-3 rounded-2xl font-bold text-lg transition ${isDestructive
                                    ? 'text-bb-red border border-bb-red/30 hover:bg-bb-red/10'
                                    : 'bg-bb-gold text-bb-navy font-semibold hover:brightness-110'
                                }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
