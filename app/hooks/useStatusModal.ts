import { useState, useCallback } from 'react';

type StatusModalType = 'success' | 'error' | 'info' | 'warning';

interface StatusModalState {
  isOpen: boolean;
  title: string;
  message: string;
  type: StatusModalType;
}

/**
 * Custom hook for managing status modal state
 * Eliminates the need to duplicate modal state management across pages
 *
 * @example
 * const { modal, show, close } = useStatusModal();
 *
 * // Show a success message
 * show('Success', 'Item saved successfully', 'success');
 *
 * // Use in component
 * <StatusModal {...modal} onClose={close} />
 */
export const useStatusModal = () => {
  const [modal, setModal] = useState<StatusModalState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const show = useCallback((
    title: string,
    message: string,
    type: StatusModalType = 'info'
  ) => {
    setModal({ isOpen: true, title, message, type });
  }, []);

  const close = useCallback(() => {
    setModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  return { modal, show, close };
};
