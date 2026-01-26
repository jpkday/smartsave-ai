'use client';

interface UndoToastProps {
  isVisible: boolean;
  message: string;
  onUndo?: () => void;
  onDismiss: () => void;
  variant?: 'info' | 'success';
  emoji?: string;
}

export default function UndoToast({
  isVisible,
  message,
  onUndo,
  onDismiss,
  variant = 'info',
  emoji
}: UndoToastProps) {
  if (!isVisible) return null;

  const isSuccess = variant === 'success';

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-xl">
      <div className="bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-up">
        <span className={`flex-1 font-medium ${isSuccess ? 'text-xl font-semibold' : ''}`}>
          {emoji && <span className="text-xl mr-1">{emoji}</span>}
          {message}
        </span>

        {onUndo && (
          <button
            onClick={onUndo}
            className="bg-blue-500 hover:bg-blue-600 px-6 py-2 rounded-xl font-semibold transition whitespace-nowrap"
          >
            Undo
          </button>
        )}

        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-white text-xl"
          aria-label="Dismiss"
        >
          ✖
        </button>
      </div>
    </div>
  );
}
