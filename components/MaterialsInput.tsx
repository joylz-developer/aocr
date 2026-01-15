
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Certificate } from '../types';
import { CertificateIcon, CloseIcon, PlusIcon } from './Icons';
import MaterialsModal from './MaterialsModal';

interface MaterialsInputProps {
    value: string;
    onChange: (value: string) => void;
    certificates: Certificate[];
}

// Basic Levenshtein distance for fuzzy matching
const levenshteinDistance = (a: string, b: string): number => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

const MaterialsInput: React.FC<MaterialsInputProps> = ({ value, onChange, certificates }) => {
    const [inputValue, setInputValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    // Default to -1 so nothing is selected automatically. 
    // User must press ArrowDown to select the first item.
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    
    // State for safe deletion
    const [itemToDeleteIndex, setItemToDeleteIndex] = useState<number | null>(null);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse current value into chips
    const selectedItems = useMemo(() => {
        if (!value) return [];
        return value.split(';').map(s => s.trim()).filter(Boolean);
    }, [value]);

    // Flatten certificates to searchable items with Fuzzy Search
    const suggestions = useMemo(() => {
        if (!inputValue.trim()) return [];
        const lowerInput = inputValue.toLowerCase();
        
        const candidates: { label: string; cert: Certificate; fullString: string; score: number }[] = [];

        certificates.forEach(cert => {
            cert.materials.forEach(mat => {
                const lowerMat = mat.toLowerCase();
                let score = 100; // Lower is better
                
                // 1. Exact substring match (Highest Priority)
                if (lowerMat.includes(lowerInput)) {
                    score = 0; 
                    // Prioritize startsWith
                    if (lowerMat.startsWith(lowerInput)) score = -1;
                } else {
                    // 2. Fuzzy Match
                    // Only calculate distance if lengths are somewhat close to avoid heavy calc on unrelated strings
                    if (Math.abs(lowerMat.length - lowerInput.length) < 5) {
                        const dist = levenshteinDistance(lowerInput, lowerMat);
                        // Threshold: Allow 1 error per 3 characters approx, max 3 errors total
                        const threshold = Math.min(3, Math.floor(lowerInput.length / 3) + 1);
                        if (dist <= threshold) {
                            score = dist;
                        }
                    }
                }

                if (score < 100) {
                    const dateObj = new Date(cert.validUntil);
                    const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('ru-RU') : cert.validUntil;
                    const fullString = `${mat} (сертификат № ${cert.number}, до ${dateStr})`;
                    
                    candidates.push({
                        label: mat,
                        cert: cert,
                        fullString: fullString,
                        score: score
                    });
                }
            });
        });

        // Sort by score (ascending), then by label length (shortest match first usually better)
        candidates.sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            return a.label.length - b.label.length;
        });

        // Deduplicate by fullString to avoid identical entries if data is messy
        const uniqueCandidates = [];
        const seen = new Set();
        for (const c of candidates) {
            if (!seen.has(c.fullString)) {
                seen.add(c.fullString);
                uniqueCandidates.push(c);
            }
        }

        return uniqueCandidates.slice(0, 10);
    }, [inputValue, certificates]);

    // Reset highlight when suggestions change
    useEffect(() => {
        setHighlightedIndex(-1);
    }, [suggestions]);

    const handleAddItem = (item: string) => {
        const newItems = [...selectedItems, item];
        onChange(newItems.join('; '));
        setInputValue('');
        setShowSuggestions(false);
        setItemToDeleteIndex(null); // Reset delete state
        inputRef.current?.focus();
    };

    const handleRemoveItem = (indexToRemove: number) => {
        const newItems = selectedItems.filter((_, index) => index !== indexToRemove);
        onChange(newItems.join('; '));
        setItemToDeleteIndex(null); // Reset delete state
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const clipboardData = e.clipboardData.getData('text');
        if (!clipboardData) return;

        // Split by newlines (Excel rows) or semicolons
        const newItems = clipboardData
            .split(/[\n\r;]+/)
            .map(s => s.trim())
            .filter(Boolean);

        if (newItems.length > 0) {
            const updatedItems = [...selectedItems, ...newItems];
            onChange(updatedItems.join('; '));
            setInputValue('');
            setShowSuggestions(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !inputValue && selectedItems.length > 0) {
            // Safety logic: require two backspaces to delete a chip
            const lastIndex = selectedItems.length - 1;
            if (itemToDeleteIndex === lastIndex) {
                handleRemoveItem(lastIndex);
            } else {
                setItemToDeleteIndex(lastIndex);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            // Allow moving from input (-1) to first item (0)
            setHighlightedIndex(prev => {
                if (suggestions.length === 0) return -1;
                return Math.min(prev + 1, suggestions.length - 1);
            });
            setItemToDeleteIndex(null);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.max(prev - 1, -1)); // Allow going back to -1 (input focus)
            setItemToDeleteIndex(null);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            
            // Logic: If an item is highlighted, add it.
            // If NO item is highlighted (index -1), add raw text.
            if (showSuggestions && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                handleAddItem(suggestions[highlightedIndex].fullString);
            } else if (inputValue.trim()) {
                handleAddItem(inputValue.trim());
            }
            setItemToDeleteIndex(null);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
            setItemToDeleteIndex(null);
        } else {
            // Any other key clears the "ready to delete" state
            setItemToDeleteIndex(null);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
                setItemToDeleteIndex(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const findCertByText = (text: string) => {
        // Try to match strict certificate number pattern inside the text
        // Looks for "№ XXXXX"
        const match = text.match(/№\s*([^\s,]+)/);
        if (match) {
            const certNum = match[1];
            return certificates.find(c => c.number.includes(certNum));
        }
        return null;
    };

    return (
        <div ref={containerRef} className="relative w-full h-full bg-transparent flex flex-col group">
            <div 
                className="flex-grow flex flex-wrap gap-1.5 p-0 items-start content-start overflow-y-auto w-full border-none bg-transparent no-scrollbar pr-7"
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        inputRef.current?.focus();
                    }
                }}
            >
                {selectedItems.map((item, index) => {
                    const cert = findCertByText(item);
                    // Green if found in DB, Red if manual text (not found)
                    let chipClass = cert 
                        ? "bg-green-50 text-green-800 border-green-200" 
                        : "bg-red-50 text-red-800 border-red-200";

                    // Apply warning style if marked for deletion
                    if (index === itemToDeleteIndex) {
                        chipClass = "bg-red-100 text-red-900 border-red-400 ring-2 ring-red-300";
                    }

                    return (
                        <div key={index} className={`inline-flex items-center rounded text-xs border ${chipClass} select-none max-w-full transition-all`}>
                            <span 
                                className="px-2 py-0.5 truncate max-w-[200px] cursor-pointer hover:underline" 
                                title={cert ? item : "Нажмите, чтобы выбрать сертификат"}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditIndex(index);
                                    setIsModalOpen(true);
                                }}
                            >
                                {item.split('(')[0]} {/* Show mostly just name in chip */}
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
                        setItemToDeleteIndex(null); // Typing clears delete selection
                    }}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onFocus={() => {
                         if(inputValue) setShowSuggestions(true);
                    }}
                    onBlur={() => setItemToDeleteIndex(null)}
                    className="flex-grow min-w-[100px] outline-none text-sm bg-transparent py-0.5"
                    placeholder={selectedItems.length === 0 ? "Материал..." : ""}
                />
            </div>

            <button
                type="button"
                className="absolute top-0 right-0 p-1 text-slate-400 hover:text-blue-600 bg-white/50 hover:bg-white rounded shadow-sm z-10"
                title="Добавить из базы сертификатов"
                onClick={() => {
                    setEditIndex(null);
                    setIsModalOpen(true);
                }}
            >
                <CertificateIcon className="w-4 h-4" />
            </button>

            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map((item, index) => (
                        <div
                            key={index}
                            className={`px-3 py-2 cursor-pointer text-sm flex flex-col ${index === highlightedIndex ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : 'hover:bg-slate-50'}`}
                            onClick={() => handleAddItem(item.fullString)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                        >
                            <span className="font-bold text-slate-700">{item.label}</span>
                            <span className="text-xs text-slate-500">
                                Сертификат № {item.cert.number} (до {new Date(item.cert.validUntil).toLocaleDateString()})
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <MaterialsModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setEditIndex(null);
                    }}
                    certificates={certificates}
                    initialSearch={editIndex !== null ? selectedItems[editIndex].split('(')[0] : undefined}
                    editingMaterialTitle={editIndex !== null ? selectedItems[editIndex].split('(')[0] : undefined}
                    onSelect={(text) => {
                        if (editIndex !== null) {
                            // Replace existing
                            const newItems = [...selectedItems];
                            newItems[editIndex] = text;
                            onChange(newItems.join('; '));
                        } else {
                            // Add new
                            const newValue = value ? `${value}; ${text}` : text;
                            onChange(newValue);
                        }
                        setIsModalOpen(false);
                        setEditIndex(null);
                    }}
                />
            )}
        </div>
    );
};

export default MaterialsInput;
