
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Regulation } from '../types';
import { CloseIcon, BookIcon } from './Icons';

interface RegulationsInputProps {
    value: string;
    onChange: (value: string) => void;
    regulations: Regulation[];
    onOpenDictionary: () => void;
    onInfoClick?: (designation: string, target: HTMLElement) => void;
}

const RegulationsInput: React.FC<RegulationsInputProps> = ({ value, onChange, regulations, onOpenDictionary, onInfoClick }) => {
    const [inputValue, setInputValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse the current string value into "chips" (items)
    // We assume items are separated by semicolon ';'
    const selectedItems = useMemo(() => {
        if (!value) return [];
        return value.split(';').map(s => s.trim()).filter(Boolean);
    }, [value]);

    // Filter suggestions based on input
    const suggestions = useMemo(() => {
        if (!inputValue.trim()) return [];
        const lowerInput = inputValue.toLowerCase();
        
        // Find regulations that match
        const matches = regulations.filter(reg => 
            reg.designation.toLowerCase().includes(lowerInput) || 
            reg.title.toLowerCase().includes(lowerInput) ||
            reg.fullName.toLowerCase().includes(lowerInput)
        );

        // Sort by smart sort (Designation length/value) implicitly via the way they are stored or simple string length for relevance
        return matches.slice(0, 10); // Limit to 10 suggestions
    }, [inputValue, regulations]);

    useEffect(() => {
        setHighlightedIndex(0);
    }, [suggestions]);

    const handleAddItem = (item: string) => {
        const newItems = [...selectedItems, item];
        // Join with '; ' for standard formatting
        onChange(newItems.join('; '));
        setInputValue('');
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    const handleRemoveItem = (indexToRemove: number) => {
        const newItems = selectedItems.filter((_, index) => index !== indexToRemove);
        onChange(newItems.join('; '));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !inputValue && selectedItems.length > 0) {
            // Remove last item if input is empty
            handleRemoveItem(selectedItems.length - 1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (showSuggestions && suggestions.length > 0) {
                handleAddItem(suggestions[highlightedIndex].designation);
            } else if (inputValue.trim()) {
                // If no suggestion selected but text exists, add it as raw text
                handleAddItem(inputValue.trim());
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    // Close suggestions on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Check if an item matches a known regulation to style it
    const getRegulationStatus = (designation: string) => {
        const reg = regulations.find(r => r.designation === designation);
        return reg ? reg.status : null;
    };

    return (
        <div ref={containerRef} className="relative w-full h-full bg-white flex flex-col">
            <div 
                className="flex-grow flex flex-wrap gap-1.5 p-1.5 items-start content-start overflow-y-auto w-full border-2 border-blue-500 rounded-md bg-white no-scrollbar"
                onClick={(e) => {
                    // Focus input if clicking on the background container
                    if (e.target === e.currentTarget) {
                        inputRef.current?.focus();
                    }
                }}
            >
                {selectedItems.map((item, index) => {
                    const status = getRegulationStatus(item);
                    const isKnown = !!status;
                    // Styling based on status if known
                    let chipBaseClass = "bg-slate-100 text-slate-800 border-slate-300"; // Default/Raw text
                    if (isKnown) {
                         if (status?.toLowerCase().includes('действует')) chipBaseClass = "bg-green-100 text-green-800 border-green-200";
                         else if (status?.toLowerCase().includes('заменен') || status?.toLowerCase().includes('отменен')) chipBaseClass = "bg-red-100 text-red-800 border-red-200";
                         else chipBaseClass = "bg-blue-100 text-blue-800 border-blue-200";
                    }

                    return (
                        <div key={index} className={`inline-flex items-center rounded text-xs font-medium border ${chipBaseClass} select-none`}>
                            <span 
                                className={`px-2 py-0.5 cursor-pointer hover:underline`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onInfoClick && isKnown) {
                                        onInfoClick(item, e.currentTarget);
                                    }
                                }}
                                title={isKnown ? "Нажмите для информации" : ""}
                            >
                                {item}
                            </span>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleRemoveItem(index); }}
                                className="pr-1 pl-0.5 text-current opacity-60 hover:opacity-100 focus:outline-none border-l border-current/20 hover:bg-black/5 h-full rounded-r"
                            >
                                <CloseIcon className="w-3 h-3" />
                            </button>
                        </div>
                    );
                })}
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                         if(inputValue) setShowSuggestions(true);
                    }}
                    className="flex-grow min-w-[100px] outline-none text-sm bg-transparent py-0.5"
                    placeholder={selectedItems.length === 0 ? "Начните вводить СП..." : ""}
                />
            </div>
            
             {/* Dictionary Button aligned absolute top-right */}
             <button 
                type="button" 
                className="absolute right-1 top-1.5 p-1 text-slate-400 hover:text-blue-600 rounded-full hover:bg-slate-100 bg-white shadow-sm border border-slate-200 z-10"
                title="Выбрать из справочника"
                onClick={(e) => {
                    e.stopPropagation();
                    onOpenDictionary();
                }}
            >
                <BookIcon className="w-4 h-4"/>
            </button>

            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map((reg, index) => (
                        <div
                            key={reg.id}
                            className={`px-3 py-2 cursor-pointer text-sm flex flex-col ${index === highlightedIndex ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                            onClick={() => handleAddItem(reg.designation)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                        >
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-700">{reg.designation}</span>
                                <span className={`text-xs px-1.5 rounded-full ${reg.status.includes('Действует') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {reg.status}
                                </span>
                            </div>
                            <span className="text-xs text-slate-500 truncate">{reg.title}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RegulationsInput;
