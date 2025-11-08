import React, { useState } from 'react';
import { DeletedActEntry } from '../types';
// FIX: Add TrashIcon to imports.
import { RestoreIcon, DeleteIcon, TrashIcon } from '../components/Icons';

interface TrashPageProps {
    deletedActs: DeletedActEntry[];
    onRestore: (entries: DeletedActEntry[]) => void;
    onPermanentlyDelete: (actIds: string[]) => void;
    requestConfirmation: (title: string, message: React.ReactNode, onConfirm: () => void) => void;
}

const TrashPage: React.FC<TrashPageProps> = ({ deletedActs, onRestore, onPermanentlyDelete, requestConfirmation }) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const handleToggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(deletedActs.map(entry => entry.act.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleToggleOne = (actId: string) => {
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

    const handleBulkRestore = () => {
        const entriesToRestore = deletedActs.filter(entry => selectedIds.has(entry.act.id));
        if (entriesToRestore.length > 0) {
            onRestore(entriesToRestore);
            setSelectedIds(new Set());
        }
    };
    
    const handleBulkDelete = () => {
        if(selectedIds.size === 0) return;
        requestConfirmation(
            'Окончательное удаление',
            `Вы уверены, что хотите навсегда удалить ${selectedIds.size} акт(ов)? Это действие необратимо.`,
            () => {
                onPermanentlyDelete(Array.from(selectedIds));
                setSelectedIds(new Set());
            }
        );
    };

    const handleEmptyTrash = () => {
         if(deletedActs.length === 0) return;
        requestConfirmation(
            'Очистить корзину',
            'Вы уверены, что хотите навсегда удалить все акты из корзины? Это действие необратимо.',
            () => {
                onPermanentlyDelete(deletedActs.map(entry => entry.act.id));
                setSelectedIds(new Set());
            }
        );
    };


    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };
    
    const allSelected = selectedIds.size > 0 && selectedIds.size === deletedActs.length;
    const isIndeterminate = selectedIds.size > 0 && selectedIds.size < deletedActs.length;

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold text-slate-800">Корзина</h1>
                 <div className="flex items-center gap-3">
                    <button 
                        onClick={handleEmptyTrash} 
                        disabled={deletedActs.length === 0}
                        className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">
                        <DeleteIcon /> Очистить корзину
                    </button>
                </div>
            </div>

            {selectedIds.size > 0 && (
                 <div className="mb-4 bg-slate-50 p-3 rounded-md border flex items-center justify-between animate-fade-in-up">
                    <span className="text-sm font-semibold text-slate-700">Выбрано: {selectedIds.size}</span>
                     <div className="flex items-center gap-3">
                         <button onClick={handleBulkRestore} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                            <RestoreIcon /> Восстановить
                        </button>
                        <button onClick={handleBulkDelete} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">
                            <DeleteIcon /> Удалить навсегда
                        </button>
                    </div>
                </div>
            )}
            
            <div className="flex-grow min-h-0 overflow-y-auto border rounded-md">
                 <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0">
                        <tr>
                            <th className="px-4 py-3 text-left">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 form-checkbox-custom"
                                    checked={allSelected}
                                    // FIX: Correctly set indeterminate property on checkbox ref without returning a value.
                                    ref={el => {
                                        if (el) {
                                            el.indeterminate = isIndeterminate;
                                        }
                                    }}
                                    onChange={handleToggleAll}
                                />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Акт</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Дата удаления</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Связанная группа</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {deletedActs.length > 0 ? deletedActs.map(entry => (
                            <tr key={entry.act.id} className={`hover:bg-slate-50 ${selectedIds.has(entry.act.id) ? 'bg-blue-50' : ''}`}>
                                <td className="px-4 py-4">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 form-checkbox-custom"
                                        checked={selectedIds.has(entry.act.id)}
                                        onChange={() => handleToggleOne(entry.act.id)}
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-slate-900">№{entry.act.number || '(б/н)'}</div>
                                    <div className="text-sm text-slate-500 truncate max-w-xs" title={entry.act.workName}>{entry.act.workName}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDate(entry.deletedOn)}</td>
                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                    {entry.associatedGroup ? entry.associatedGroup.name : <span className="text-slate-400 italic">Нет</span>}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="text-center py-16 text-slate-500">
                                    <TrashIcon className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                                    Корзина пуста
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TrashPage;