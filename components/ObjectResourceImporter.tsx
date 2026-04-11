import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { ConstructionObject } from '../types';
import { PlusIcon } from './Icons';

interface ObjectResourceImporterProps<T> {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    
    constructionObjects: ConstructionObject[];
    currentObjectId: string | null;
    
    // The pool of ALL items of type T
    allItems: T[];
    
    // Function to check equality/duplicates (returns true if item is duplicate of existing in current object)
    isDuplicate: (item: T, existingItems: T[]) => boolean;
    
    // Existing items in current object to check against
    existingItems: T[];
    
    // What to display
    renderItem: (item: T) => React.ReactNode;
    
    // Action
    onImport: (selectedItems: T[]) => void;
}

function ObjectResourceImporter<T extends { id: string, constructionObjectId?: string }>({ 
    isOpen, onClose, title, 
    constructionObjects, currentObjectId,
    allItems, isDuplicate, existingItems, renderItem, onImport 
}: ObjectResourceImporterProps<T>) {
    
    const [selectedSourceObjId, setSelectedSourceObjId] = useState<string>('');
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

    const availableObjects = useMemo(() => {
        return constructionObjects.filter(o => o.id !== currentObjectId);
    }, [constructionObjects, currentObjectId]);

    const sourceItems = useMemo(() => {
        if (!selectedSourceObjId) return [];
        return allItems.filter(item => item.constructionObjectId === selectedSourceObjId);
    }, [allItems, selectedSourceObjId]);

    const handleToggleItem = (id: string) => {
        setSelectedItemIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleSelectAll = (select: boolean) => {
        if (select) {
            setSelectedItemIds(new Set(sourceItems.map(i => i.id)));
        } else {
            setSelectedItemIds(new Set());
        }
    };

    const handleImportClick = () => {
        const itemsToImport = sourceItems.filter(i => selectedItemIds.has(i.id));
        onImport(itemsToImport);
        onClose();
        setSelectedItemIds(new Set());
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-4xl">
            <div className="flex flex-col h-[70vh]">
                
                {/* Object Selector */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Выберите объект-источник</label>
                    <select 
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={selectedSourceObjId}
                        onChange={(e) => {
                            setSelectedSourceObjId(e.target.value);
                            setSelectedItemIds(new Set());
                        }}
                    >
                        <option value="">-- Выберите объект --</option>
                        {availableObjects.map(obj => (
                            <option key={obj.id} value={obj.id}>{obj.name}</option>
                        ))}
                    </select>
                </div>

                {/* Items List */}
                <div className="flex-grow overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-900/50 relative">
                    {!selectedSourceObjId ? (
                        <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
                            Выберите объект, чтобы увидеть данные
                        </div>
                    ) : sourceItems.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
                            В этом объекте нет данных
                        </div>
                    ) : (
                        <>
                            <div className="p-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center shadow-sm z-10">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Найдено: {sourceItems.length}</span>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => handleSelectAll(true)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Выбрать все</button>
                                    <button type="button" onClick={() => handleSelectAll(false)} className="text-xs text-slate-500 dark:text-slate-400 hover:underline">Снять все</button>
                                </div>
                            </div>
                            <div className="overflow-y-auto p-2 space-y-2">
                                {sourceItems.map(item => {
                                    const isDupe = isDuplicate(item, existingItems);
                                    const isSelected = selectedItemIds.has(item.id);
                                    
                                    return (
                                        <div 
                                            key={item.id} 
                                            className={`
                                                flex items-center p-3 rounded-md border transition-colors cursor-pointer
                                                ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 ring-1 ring-blue-300 dark:ring-blue-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500'}
                                                ${isDupe ? 'opacity-80' : ''}
                                            `}
                                            onClick={() => handleToggleItem(item.id)}
                                        >
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected}
                                                onChange={() => {}}
                                                className="h-5 w-5 form-checkbox-custom flex-shrink-0 mr-3"
                                            />
                                            <div className="flex-grow min-w-0">
                                                {renderItem(item)}
                                                {isDupe && (
                                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center">
                                                        ⚠️ Похожая запись уже есть в текущем объекте
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                <div className="pt-4 flex justify-end gap-3 mt-auto">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600">Отмена</button>
                    <button 
                        onClick={handleImportClick} 
                        disabled={selectedItemIds.size === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <PlusIcon className="w-4 h-4"/> Скопировать выбранное
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export default ObjectResourceImporter;