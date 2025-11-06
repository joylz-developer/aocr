import React, { ReactNode } from 'react';
import Modal from './Modal';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    confirmText?: string;
    cancelText?: string;
    children: ReactNode;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    confirmText = 'Удалить',
    cancelText = 'Отмена',
    children
}) => {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="text-slate-700">
                {children}
            </div>
            <div className="flex justify-end space-x-3 pt-6 mt-4 border-t border-slate-200">
                <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300 transition-colors">
                    {cancelText}
                </button>
                <button type="button" onClick={onConfirm} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors">
                    {confirmText}
                </button>
            </div>
        </Modal>
    );
};

export default ConfirmationModal;
