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
            icon: <CheckCircleIcon className="w-12 h-12 text-green-500" />,
            bgColor: 'bg-green-50',
            buttonColor: 'bg-green-600 hover:bg-green-700',
            borderColor: 'border-green-100'
        },
        error: {
            icon: <ExclamationCircleIcon className="w-12 h-12 text-red-500" />,
            bgColor: 'bg-red-50',
            buttonColor: 'bg-red-600 hover:bg-red-700',
            borderColor: 'border-red-100'
        },
        warning: {
            icon: <ExclamationCircleIcon className="w-12 h-12 text-yellow-500" />,
            bgColor: 'bg-yellow-50',
            buttonColor: 'bg-yellow-600 hover:bg-yellow-700',
            borderColor: 'border-yellow-100'
        },
        info: {
            icon: <InformationCircleIcon className="w-12 h-12 text-blue-500" />,
            bgColor: 'bg-blue-50',
            buttonColor: 'bg-blue-600 hover:bg-blue-700',
            borderColor: 'border-blue-100'
        }
    };

    const current = config[type];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div
                className={`bg-white rounded-3xl max-w-sm w-full p-8 shadow-2xl transform animate-in zoom-in-95 duration-200 border-4 ${current.borderColor}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col items-center text-center">
                    <div className={`mb-4 p-4 rounded-full ${current.bgColor}`}>
                        {current.icon}
                    </div>

                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        {title}
                    </h3>

                    <p className="text-gray-600 leading-relaxed mb-8">
                        {message}
                    </p>

                    <button
                        onClick={onClose}
                        className={`w-full py-4 rounded-2xl text-white font-bold text-lg transition shadow-lg ${current.buttonColor}`}
                    >
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    );
}
