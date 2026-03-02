
import React, { useState, useMemo, useEffect } from 'react';
import { Act } from '../types';
import Modal from './Modal';
import { LinkIcon, DeleteIcon, TrashIcon } from './Icons';

interface DeleteActsConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    actsToDelete: Act[];
    allActs: Act[];
    onConfirm: (actIdsToDelete: string[]) => void;
    onDeletePermanently?: (actIdsToDelete: string[]) => void;
}

const DeleteActsConfirmationModal: React.FC<DeleteActsConfirmationModalProps> = ({
    isOpen,
    onClose,
    actsToDelete,
    allActs,
    onConfirm,
    onDeletePermanently,
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(actsToDelete.map(a => a.id)));
    
    // Reset selected IDs when the list of acts to delete changes
    useEffect(() => {
        setSelectedIds(new Set(actsToDelete.map(a => a.id)));
    }, [actsToDelete]);

    const linkedActsInfo = useMemo(() => {
        const info = new Map<string, string[]>();
        const actsToDeleteIds = new Set(actsToDelete.map(a => a.id));

        for (const act of allActs) {
            if (act.nextWorkActId && actsToDeleteIds.has(act.nextWorkActId)) {
                const existingLinks = info.get(act.nextWorkActId) || [];
                info.set(act.nextWorkActId, [...existingLinks, act.number]);
            }
        }
        return info;
    }, [actsToDelete, allActs]);
    
    const toggleSelection = (actId: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(actId)) {
                newSet.delete(actId);
            } else {
                newSet.add(actId);
            }
            return newSet;
        });
    };

    const handleConfirm = () => {
        onConfirm(Array.from(selectedIds));
    };

    const handlePermanentDelete = () => {
        if (onDeletePermanently) {
            if (confirm("Вы уверены, что хотите удалить эти акты навсегда? Это действие нельзя будет отменить через корзину.")) {
                onDeletePermanently(Array.from(selectedIds));
            }
        }
    };

    const selectedCount = selectedIds.size;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Подтверждение удаления актов"
        >
            <div>
                <p className="text-slate-700 mb-4">
                    Выберите акты для удаления:
                </p>
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-md bg-slate-50 p-2 space-y-2">
                    {actsToDelete.map(act => {
                        const isLinked = linkedActsInfo.has(act.id);
                        const linkingActNumbers = linkedActsInfo.get(act.id);
                        return (
                            <div key={act.id} className="flex items-center bg-white p-2 rounded border">
                                <input
                                    type="checkbox"
                                    id={`delete-act-${act.id}`}
                                    checked={selectedIds.has(act.id)}
                                    onChange={() => toggleSelection(act.id)}
                                    className="h-5 w-5 form-checkbox-custom mr-3"
                                />
                                <label htmlFor={`delete-act-${act.id}`} className="flex-grow cursor-pointer">
                                    <div className="font-medium text-slate-800">
                                        Акт №{act.number || '(б/н)'}
                                    </div>
                                    <div className="text-sm text-slate-500 truncate" title={act.workName}>
                                        {act.workName || '(Без названия работы)'}
                                    </div>
                                    {isLinked && (
                                        <div className="flex items-center gap-1.5 mt-1 text-amber-700 text-xs" title={`Этот акт используется в качестве "следующих работ" в акте(ах) №${linkingActNumbers?.join(', ')}`}>
                                            <LinkIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                            <span>Есть входящие связи!</span>
                                        </div>
                                    )}
                                </label>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-between pt-6 mt-4 border-t border-slate-200">
                    <div>
                        {onDeletePermanently && selectedCount > 0 && (
                            <button
                                type="button"
                                onClick={handlePermanentDelete}
                                className="text-red-500 text-sm hover:text-red-700 hover:underline flex items-center gap-1 px-2 py-2"
                                title="Удалить без возможности восстановления из корзины"
                            >
                                <DeleteIcon className="w-4 h-4" /> Удалить навсегда
                            </button>
                        )}
                    </div>
                    <div className="flex space-x-3">
                        <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300 transition-colors">
                            Отмена
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={selectedCount === 0}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <TrashIcon className="w-4 h-4" />
                            {selectedCount > 0 ? `В корзину (${selectedCount})` : 'В корзину'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default DeleteActsConfirmationModal;
