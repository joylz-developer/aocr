
import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Regulation } from '../types';
import { BookIcon } from './Icons';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface RegulationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    regulations: Regulation[];
    onSelect: (selectedRegulations: Regulation[]) => void;
}

const RegulationsModal: React.FC<RegulationsModalProps> = ({ isOpen, onClose, regulations, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    // UI state that matches RegulationsPage
    const [groupChanges, setGroupChanges] = useState(true);
    // Shared state using same key as Page
    const [showActiveOnly, setShowActiveOnly] = useLocalStorage<boolean>('regulations_show_active_only', false);

    const filteredRegulations = useMemo(() => {
        let processed = [...regulations];

        // 1. Filter Inactive
        if (showActiveOnly) {
            processed = processed.filter(reg => reg.status.toLowerCase().includes('действует'));
        }

        // 2. Grouping Logic
        if (groupChanges) {
            const parentMap = new Map<string, Regulation>();
            const changes: Regulation[] = [];
            const others: Regulation[] = [];

            processed.forEach(reg => {
                const changeMatch = reg.designation.match(/^Изменение №\s*(\d+)\s*к\s+(.*)$/i);
                if (changeMatch) {
                    changes.push(reg);
                } else {
                    const parent = { ...reg, embeddedChanges: [] as Regulation[] };
                    parentMap.set(reg.designation.trim(), parent);
                    others.push(parent);
                }
            });

            const orphanedChanges: Regulation[] = [];
            changes.forEach(change => {
                const changeMatch = change.designation.match(/^Изменение №\s*(\d+)\s*к\s+(.*)$/i);
                if (changeMatch) {
                    const parentName = changeMatch[2].trim();
                    const parent = parentMap.get(parentName);
                    if (parent) {
                        parent.embeddedChanges = parent.embeddedChanges || [];
                        parent.embeddedChanges.push(change);
                         parent.embeddedChanges.sort((a, b) => {
                             const numA = parseInt(a.designation.match(/^Изменение №\s*(\d+)/i)?.[1] || '0', 10);
                             const numB = parseInt(b.designation.match(/^Изменение №\s*(\d+)/i)?.[1] || '0', 10);
                             return numA - numB;
                        });
                    } else {
                        orphanedChanges.push(change);
                    }
                } else {
                    orphanedChanges.push(change);
                }
            });

            processed = [...others, ...orphanedChanges];
        }

        // 3. Sorting Logic - Always On (Smart Sort)
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        processed.sort((a, b) => {
            return collator.compare(a.designation, b.designation);
        });

        // 4. Search Filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            processed = processed.filter(reg => 
                reg.designation.toLowerCase().includes(lowerTerm) || 
                reg.title.toLowerCase().includes(lowerTerm) ||
                reg.fullName.toLowerCase().includes(lowerTerm)
            );
        }
        
        // Limit results for performance if no search term, otherwise show more matches
        return searchTerm ? processed : processed.slice(0, 50); 
    }, [regulations, searchTerm, groupChanges, showActiveOnly]);

    const handleToggle = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleConfirm = () => {
        const selectedRegs = regulations.filter(r => selectedIds.has(r.id));
        onSelect(selectedRegs);
        onClose();
        setSelectedIds(new Set());
        setSearchTerm('');
    };

    const getStatusColor = (status: string) => {
        if (!status) return 'bg-gray-100 text-gray-800';
        if (status.toLowerCase().includes('действует')) return 'bg-green-100 text-green-800';
        if (status.toLowerCase().includes('заменен') || status.toLowerCase().includes('отменен')) return 'bg-red-100 text-red-800';
        return 'bg-blue-100 text-blue-800';
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Выбор нормативных документов">
            <div className="flex flex-col h-[70vh]">
                <div className="mb-4 space-y-3">
                    <input
                        type="text"
                        placeholder="Поиск по обозначению или названию..."
                        className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                    <div className="flex gap-4 text-xs text-slate-600 px-1">
                         <label className="flex items-center cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                className="h-3 w-3 form-checkbox-custom"
                                checked={groupChanges}
                                onChange={(e) => setGroupChanges(e.target.checked)}
                            />
                            <span className="ml-1.5">Группировать изменения с основным СП</span>
                        </label>
                         <label className="flex items-center cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                className="h-3 w-3 form-checkbox-custom"
                                checked={showActiveOnly}
                                onChange={(e) => setShowActiveOnly(e.target.checked)}
                            />
                            <span className="ml-1.5">Скрыть не действующие</span>
                        </label>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto border border-slate-200 rounded-md bg-slate-50">
                    {filteredRegulations.length > 0 ? (
                        <div className="divide-y divide-slate-200">
                            {filteredRegulations.map(reg => (
                                <div 
                                    key={reg.id} 
                                    className={`p-3 hover:bg-white cursor-pointer transition-colors flex items-start gap-3 ${selectedIds.has(reg.id) ? 'bg-blue-50' : ''}`}
                                    onClick={() => handleToggle(reg.id)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(reg.id)}
                                        onChange={() => {}} 
                                        className="mt-1 h-5 w-5 form-checkbox-custom flex-shrink-0"
                                    />
                                    <div className="flex-grow min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="font-bold text-slate-800">{reg.designation}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(reg.status)}`}>
                                                {reg.status}
                                            </span>
                                             {reg.embeddedChanges && reg.embeddedChanges.length > 0 && (
                                                <span className="text-xs text-slate-500 bg-slate-100 px-1.5 rounded border border-slate-200">
                                                    +{reg.embeddedChanges.length} изм.
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-600 line-clamp-2" title={reg.title}>{reg.title}</p>
                                        {reg.replacement && (
                                            <p className="text-xs text-red-600 mt-1">
                                                Заменен на: {reg.replacement}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6">
                            <BookIcon className="w-12 h-12 mb-2 opacity-20" />
                            <p>Ничего не найдено.</p>
                            {regulations.length === 0 && (
                                <p className="text-xs mt-2">База нормативов пуста. Загрузите JSON файл на вкладке "Нормативы".</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-200 mt-4">
                    <span className="text-sm text-slate-600">
                        Выбрано: {selectedIds.size}
                    </span>
                    <div className="flex gap-3">
                         <button 
                            onClick={onClose} 
                            className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300"
                        >
                            Отмена
                        </button>
                        <button 
                            onClick={handleConfirm} 
                            disabled={selectedIds.size === 0}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Выбрать
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default RegulationsModal;
