import React, { useState, useMemo } from 'react';
import { ExecutiveScheme } from '../types';
import Modal from './Modal';
import { SchemeIcon } from './Icons';

interface SchemesModalProps {
    isOpen: boolean;
    onClose: () => void;
    schemes: ExecutiveScheme[];
    initialSearch: string;
    editingSchemeTitle?: string;
    onSelect: (schemeText: string) => void;
}

const SchemesModal: React.FC<SchemesModalProps> = ({ isOpen, onClose, schemes, initialSearch, editingSchemeTitle, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredSchemes = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return schemes.filter(s =>
            s.name.toLowerCase().includes(term) ||
            s.number.toLowerCase().includes(term)
        );
    }, [schemes, searchTerm]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Выбор исполнительной схемы">
            <div className="flex flex-col h-[50vh] min-h-[400px]">
                {editingSchemeTitle && (
                    <div className="mb-4 text-sm text-slate-600 bg-slate-50 p-3 rounded border border-slate-200">
                        <strong>Замена/привязка для текста:</strong> <span className="italic">"{editingSchemeTitle}"</span>
                    </div>
                )}
                <input
                    type="text"
                    placeholder="Поиск по названию или номеру..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-md mb-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    autoFocus
                />

                <div className="flex-grow overflow-y-auto border border-slate-200 rounded-md">
                    {filteredSchemes.length > 0 ? (
                        <ul className="divide-y divide-slate-100">
                            {filteredSchemes.map(s => (
                                <li
                                    key={s.id}
                                    className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center group transition-colors"
                                    onClick={() => {
                                        onSelect(`${s.name} № ${s.number} (${s.amount} л.)`);
                                    }}
                                >
                                    <div>
                                        <div className="font-medium text-slate-800 text-sm">{s.name}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">№ {s.number} | Листов: {s.amount}</div>
                                    </div>
                                    <span className="text-indigo-600 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                                        Выбрать
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-4 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                            <SchemeIcon className="w-10 h-10 mb-2 opacity-30" />
                            <p>Схемы не найдены.</p>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default SchemesModal;