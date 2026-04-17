import React, { useState, useMemo, useRef, useEffect } from 'react';
import Modal from './Modal';
import { ConstructionObject } from '../types';
import { PlusIcon, ChevronDownIcon, CheckIcon } from './Icons';

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
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    // Закрытие выпадающего списка при клике вне его области
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsPickerOpen(false);
            }
        };
        if (isPickerOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isPickerOpen]);

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

    const selectedObj = availableObjects.find(o => o.id === selectedSourceObjId);
    const pickerLabel = selectedObj ? selectedObj.name : 'Выберите объект';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-4xl">
            <div className="flex flex-col h-[70vh]">
                
                {/* Custom Object Picker */}
                <div className="mb-4 relative" ref={pickerRef}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Выберите объект-источник</label>
                    
                    <button
                        type="button"
                        onClick={() => setIsPickerOpen(!isPickerOpen)}
                        className={`
                            w-full flex items-center justify-between gap-2 bg-white text-slate-700 px-4 py-2.5 rounded-md 
                            hover:bg-slate-50 border border-slate-300 transition-all text-sm
                            ${selectedSourceObjId ? 'border-blue-300 ring-2 ring-blue-50 text-slate-900 font-medium' : ''}
                        `}
                    >
                        <span className="truncate">{pickerLabel}</span>
                        <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isPickerOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isPickerOpen && (
                        <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-md shadow-lg z-[100] p-2 animate-fade-in-up max-h-60 overflow-y-auto">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1 border-b border-slate-50">
                                Доступные объекты
                            </div>
                            {availableObjects.length === 0 ? (
                                <div className="px-3 py-4 text-sm text-slate-400 text-center">Нет доступных объектов</div>
                            ) : (
                                availableObjects.map((obj) => (
                                    <button
                                        key={obj.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedSourceObjId(obj.id);
                                            setSelectedItemIds(new Set());
                                            setIsPickerOpen(false);
                                        }}
                                        className={`
                                            w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between group transition-colors mb-0.5
                                            ${selectedSourceObjId === obj.id 
                                                ? 'bg-blue-50 text-blue-700 font-medium' 
                                                : 'text-slate-700 hover:bg-slate-50'}
                                        `}
                                    >
                                        <span className="truncate">{obj.name}</span>
                                        {selectedSourceObjId === obj.id && <CheckIcon className="w-4 h-4 text-blue-600" />}
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Items List */}
                <div className="flex-grow overflow-hidden flex flex-col border border-slate-200 rounded-md bg-slate-50 relative">
                    {!selectedSourceObjId ? (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            Выберите объект, чтобы увидеть данные
                        </div>
                    ) : sourceItems.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            В этом объекте нет данных
                        </div>
                    ) : (
                        <>
                            <div className="p-2 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm z-10">
                                <span className="text-sm font-medium text-slate-700">Найдено: {sourceItems.length}</span>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => handleSelectAll(true)} className="text-xs text-blue-600 hover:underline">Выбрать все</button>
                                    <button type="button" onClick={() => handleSelectAll(false)} className="text-xs text-slate-500 hover:underline">Снять все</button>
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
                                                ${isSelected ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-slate-200 hover:border-blue-300'}
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
                                                    <p className="text-xs text-amber-600 mt-1 flex items-center">
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
                    <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200">Отмена</button>
                    <button 
                        onClick={handleImportClick} 
                        disabled={selectedItemIds.size === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <PlusIcon className="w-4 h-4"/> Копировать выбранное
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export default ObjectResourceImporter;