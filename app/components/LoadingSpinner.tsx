'use client';

interface LoadingSpinnerProps {
    message?: string;
    size?: 'sm' | 'md' | 'lg';
    color?: string;
}

export default function LoadingSpinner({
    message,
    size = 'md',
    color = 'border-indigo-600',
    textColor = 'text-slate-500'
}: LoadingSpinnerProps & { textColor?: string }) {
    const sizeClasses = {
        sm: 'h-4 w-4 border-2',
        md: 'h-8 w-8 border-4',
        lg: 'h-12 w-12 border-4'
    };

    const containerPadding = {
        sm: 'p-4',
        md: 'p-12',
        lg: 'p-20'
    };

    return (
        <div className={`bg-transparent text-center flex flex-col items-center justify-center ${message ? containerPadding[size] : ''}`}>
            <div className={`inline-block ${sizeClasses[size]} animate-spin rounded-full border-solid ${color} border-r-transparent shadow-sm`} />
            {message && <p className={`${textColor} mt-4 font-medium`}>{message}</p>}
        </div>
    );
}
