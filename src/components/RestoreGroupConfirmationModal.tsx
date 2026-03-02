import React from 'react';
import { CommissionGroup } from '../types';
import Modal from './Modal';

interface RestoreGroupConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupsToRestore: CommissionGroup[];
    onConfirm: (restoreGroups: boolean) => void;
}

const RestoreGroupConfirmationModal: React.FC<RestoreGroupConfirmationModalProps> = ({
    isOpen,
    onClose,
    groupsToRestore,
    onConfirm,
}) => {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Восстановление связанных данных">
            <div className="text-slate-700">
                <p className="mb-4">
                    Одна или несколько групп комиссий, связанные с восстанавливаемыми актами, были удалены.
                </p>
                <div className="mb-4 p-3 border rounded-md bg-slate-50">
                    <h4 className="font-semibold text-slate-800 mb-2">Следующие группы будут восстановлены:</h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                        {groupsToRestore.map(group => (
                            <li key={group.id}>{group.name}</li>
                        ))}
                    </ul>
                </div>
                <p>
                    Вы хотите восстановить эти группы вместе с актами?
                </p>
            </div>
            <div className="flex justify-end space-x-3 pt-6 mt-4 border-t border-slate-200">
                <button 
                    type="button" 
                    onClick={() => onConfirm(false)} 
                    className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300 transition-colors"
                >
                    Только акты
                </button>
                <button 
                    type="button" 
                    onClick={() => onConfirm(true)} 
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                    Восстановить всё
                </button>
            </div>
        </Modal>
    );
};

export default RestoreGroupConfirmationModal;
