
import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Regulation } from '../types';
import { BookIcon } from './Icons';

interface RegulationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    regulations: Regulation[];
    onSelect: (selectedRegulations: Regulation[]) => void;
}

const RegulationsModal: React.FC<RegulationsModalProps> = ({ isOpen, onClose, regulations, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const filteredRegulations = useMemo(() => {
        if (!searchTerm) return regulations.slice(0, 50); // Show first 50 by default for performance
        const lowerTerm = searchTerm.toLowerCase();
        return regulations.filter(reg => 
            reg.designation.toLowerCase().includes(lowerTerm) || 
            reg.title.toLowerCase().includes(lowerTerm) ||
            reg.fullName.toLowerCase().includes(lowerTerm)
        ).slice(0, 50); // Limit results
    }, [regulations, searchTerm]);

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
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Поиск по обозначению или названию..."
                        className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
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
