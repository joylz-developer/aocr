import React, { useState, useRef, useMemo } from 'react';
import { ExecutiveScheme } from '../types';
import { CloseIcon, SchemeIcon, PlusIcon } from './Icons';
import Modal from './Modal';

interface SchemesInputProps {
    value: string;
    onChange: (value: string) => void;
    schemes: ExecutiveScheme[];
}

const SchemesInput: React.FC<SchemesInputProps> = ({ value, onChange, schemes }) => {
    const [inputValue, setInputValue] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedItems = useMemo(() => {
        if (!value) return [];
        return value.split(';').map(s => s.trim()).filter(Boolean);
    }, [value]);

    const filteredSchemes = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return schemes.filter(s => 
            s.name.toLowerCase().includes(lower) || 
            s.number.toLowerCase().includes(lower)
        );
    }, [schemes, searchTerm]);

    const handleAddItem = (itemString: string) => {
        const newItems = [...selectedItems, itemString];
        onChange(newItems.join('; '));
        setInputValue('');
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleRemoveItem = (indexToRemove: number) => {
        const newItems = selectedItems.filter((_, index) => index !== indexToRemove);
        onChange(newItems.join('; '));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !inputValue && selectedItems.length > 0) {
            handleRemoveItem(selectedItems.length - 1);
        } else if (e.key === 'Enter' && inputValue.trim()) {
            e.preventDefault();
            handleAddItem(inputValue.trim());
        }
    };

    const findSchemeByText = (text: string) => {
        return schemes.find(s => text.includes(`№ ${s.number}`) || text.includes(`№${s.number}`) || text.includes(s.name));
    };

    return (
        <div className="relative w-full h-full bg-transparent flex flex-col group">
            <div 
                className="flex-grow flex flex-wrap gap-1.5 p-0 items-start content-start overflow-y-auto w-full border-none bg-transparent no-scrollbar pr-8"
                onClick={() => inputRef.current?.focus()}
            >
                {selectedItems.map((item, index) => {
                    const isLinked = !!findSchemeByText(item);
                    return (
                        <div key={index} className={`inline-flex items-center rounded text-xs border select-none max-w-full transition-all ${isLinked ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            <span className="px-2 py-0.5 truncate max-w-[250px]" title={item}>{item}</span>
                            <button type="button" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveItem(index); }} className="pr-1 pl-0.5 opacity-60 hover:opacity-100 border-l border-current/20 h-full rounded-r focus:outline-none">
                                <CloseIcon className="w-3 h-3" />
                            </button>
                        </div>
                    );
                })}
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-grow min-w-[120px] outline-none text-sm bg-transparent py-0.5"
                    placeholder={selectedItems.length === 0 ? "Введите текст или выберите из базы..." : ""}
                />
            </div>

            <div className="absolute top-0 right-0 p-1 flex items-center gap-1 bg-white/80 rounded backdrop-blur-sm z-10">
                <button 
                    type="button"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        setIsModalOpen(true);
                        setSearchTerm('');
                    }}
                    className="text-slate-400 hover:text-indigo-600 focus:outline-none p-1 rounded transition-colors hover:bg-slate-100"
                    title="Открыть справочник схем"
                >
                    <SchemeIcon className="w-4 h-4" />
                </button>
            </div>

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Справочник исполнительных схем">
                    <div className="flex flex-col h-[60vh] max-h-[600px]">
                        <input 
                            type="text"
                            placeholder="Поиск схемы по названию или номеру..."
                            className="w-full p-2.5 border border-slate-300 rounded-md mb-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                        
                        <div className="flex-grow overflow-y-auto border border-slate-200 rounded-md bg-white">
                            {filteredSchemes.length > 0 ? (
                                <ul className="divide-y divide-slate-100">
                                    {filteredSchemes.map(s => {
                                        const isAlreadyAdded = selectedItems.some(item => item.includes(`№ ${s.number}`) || item.includes(`№${s.number}`));
                                        
                                        return (
                                            <li 
                                                key={s.id} 
                                                className={`p-3 flex justify-between items-center group transition-colors ${isAlreadyAdded ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50 cursor-pointer'}`}
                                                onClick={() => {
                                                    if (!isAlreadyAdded) {
                                                        handleAddItem(`${s.name} № ${s.number} (${s.amount} л.)`); // ИЗМЕНЕН ФОРМАТ
                                                    }
                                                }}
                                            >
                                                <div className="pr-4">
                                                    <div className="font-medium text-slate-800">{s.name}</div>
                                                    <div className="text-xs text-slate-500 mt-1">№ {s.number} | Листов: {s.amount}</div>
                                                </div>
                                                {!isAlreadyAdded ? (
                                                    <button className="text-indigo-600 opacity-0 group-hover:opacity-100 p-1.5 bg-indigo-50 rounded hover:bg-indigo-100 transition-all flex-shrink-0">
                                                        <PlusIcon className="w-5 h-5" />
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-400 font-medium px-2 py-1 bg-slate-100 rounded flex-shrink-0">
                                                        Добавлено
                                                    </span>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                                    <SchemeIcon className="w-12 h-12 mb-3 opacity-20" />
                                    <p>{schemes.length === 0 ? 'База исполнительных схем пуста.' : 'По вашему запросу ничего не найдено.'}</p>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button 
                                type="button" 
                                onClick={() => setIsModalOpen(false)} 
                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors font-medium"
                            >
                                Готово
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default SchemesInput;