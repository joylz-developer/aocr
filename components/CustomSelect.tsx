import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDownIcon, PlusIcon } from './Icons';

export interface CustomSelectOption {
    value: string;
    label: string;
}

interface CustomSelectProps {
    options: CustomSelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    buttonClassName?: string;
    dropdownClassName?: string;
    onCreateNew?: () => void;
    allowClear?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ 
    options, 
    value, 
    onChange, 
    placeholder = 'Выберите...', 
    className,
    buttonClassName,
    dropdownClassName,
    onCreateNew,
    allowClear = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const selectRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const selectedOption = useMemo(() => options.find(opt => opt.value === value), [options, value]);

    const filteredOptions = useMemo(() => {
        if (!searchTerm) {
            return options;
        }
        return options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [options, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    
    useEffect(() => {
        if (isOpen) {
            // Use timeout to allow the element to be rendered before focusing
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
    };
    
    const toggleDropdown = () => {
        setIsOpen(prev => !prev);
        if(!isOpen) {
            setSearchTerm('');
        }
    };

    const defaultButtonClass = "w-full text-left bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-900 flex justify-between items-center";
    const defaultDropdownClass = "absolute z-40 mt-1 w-full bg-white shadow-lg rounded-md border border-slate-200 max-h-60";

    return (
        <div className={`relative ${className || ''}`} ref={selectRef}>
            <button
                type="button"
                className={buttonClassName || defaultButtonClass}
                onClick={toggleDropdown}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className={`truncate ${selectedOption ? 'text-slate-900' : 'text-slate-500'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDownIcon className={`w-5 h-5 ml-2 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className={dropdownClassName || defaultDropdownClass}>
                    <div className="p-2 border-b border-slate-200">
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Поиск..."
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <ul tabIndex={-1} role="listbox" className="py-1 overflow-y-auto max-h-[12.5rem]">
                        {allowClear && (
                            <li
                                className={`px-3 py-2 cursor-pointer text-sm text-slate-500 italic hover:bg-slate-100`}
                                onClick={() => handleSelect('')}
                                role="option"
                                aria-selected={!value}
                            >
                                -- Очистить выбор --
                            </li>
                        )}
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => (
                                <li
                                    key={option.value}
                                    className={`px-3 py-2 cursor-pointer text-sm ${option.value === value ? 'bg-blue-600 text-white' : 'text-slate-900 hover:bg-slate-100'}`}
                                    onClick={() => handleSelect(option.value)}
                                    role="option"
                                    aria-selected={option.value === value}
                                >
                                    {option.label}
                                </li>
                            ))
                        ) : (
                            <>
                                <li className="px-3 py-2 text-sm text-center text-slate-500">Ничего не найдено</li>
                                {onCreateNew && (
                                    <li className="p-2 border-t border-slate-200">
                                        <button
                                            type="button"
                                            className="w-full flex items-center justify-center gap-2 text-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                            onClick={() => {
                                                onCreateNew();
                                                setIsOpen(false);
                                            }}
                                        >
                                            <PlusIcon /> Создать
                                        </button>
                                    </li>
                                )}
                            </>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default CustomSelect;