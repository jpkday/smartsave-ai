import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for managing undo toast notifications with auto-dismiss
 * Provides a consistent pattern for showing temporary notifications with undo functionality
 *
 * @param undoAction - Async function to execute when undo is triggered
 * @param duration - Auto-dismiss duration in milliseconds (default: 2500ms)
 *
 * @example
 * const removeToast = useUndoToast<ListItem>(
 *   async (item) => {
 *     await supabase.from('shopping_list').insert(item);
 *     loadData();
 *   }
 * );
 *
 * // Show toast
 * removeToast.show(deletedItem);
 *
 * // In component
 * <UndoToast
 *   isVisible={!!removeToast.toastItem}
 *   message={`Removed ${removeToast.toastItem?.item_name}`}
 *   onUndo={removeToast.undo}
 * />
 */
export const useUndoToast = <T,>(
  undoAction: (item: T) => Promise<void>,
  duration: number = 2500
) => {
  const [toastItem, setToastItem] = useState<T | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  /**
   * Show the undo toast with an item
   * Automatically dismisses after specified duration
   */
  const show = useCallback((item: T, customDuration?: number) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Show toast
    setToastItem(item);

    // Auto-dismiss after duration
    const timeoutDuration = customDuration ?? duration;
    timeoutRef.current = setTimeout(() => {
      setToastItem(null);
      timeoutRef.current = null;
    }, timeoutDuration);
  }, [duration]);

  /**
   * Execute the undo action and dismiss the toast
   */
  const undo = useCallback(async () => {
    if (!toastItem) return;

    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Execute undo action
    try {
      await undoAction(toastItem);
    } catch (error) {
      console.error('Undo action failed:', error);
    }

    // Dismiss toast
    setToastItem(null);
  }, [toastItem, undoAction]);

  /**
   * Manually dismiss the toast without undoing
   */
  const dismiss = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setToastItem(null);
  }, []);

  return { toastItem, show, undo, dismiss };
};
