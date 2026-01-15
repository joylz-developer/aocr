
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Certificate } from '../types';
import { CertificateIcon, CloseIcon, PlusIcon, LinkIcon } from './Icons';
import MaterialsModal from './MaterialsModal';

interface MaterialsInputProps {
    value: string;
    onChange: (value: string) => void;
    certificates: Certificate[];
    onNavigateToCertificate?: (id: string) => void;
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

// Advanced Highlighter using LCS for multiple tokens
const HighlightMatch: React.FC<{ text: string; query: string }> = ({ text, query }) => {
    if (!query || !text) return <>{text}</>;

    const t = text.toLowerCase();
    const tokens = query.toLowerCase().split(/\s+/).filter(tk => tk.length > 0);
    const n = t.length;
    
    if (tokens.length === 0) return <>{text}</>;

    const matchedIndices = new Set<number>();

    const computeLCSIndices = (token: string) => {
        const m = token.length;
        if (m === 0) return;
        
        const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

        for (let i = 1; i <= n; i++) {
            for (let j = 1; j <= m; j++) {
                if (t[i - 1] === token[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        let i = n, j = m;
        while (i > 0 && j > 0) {
            if (t[i - 1] === token[j - 1]) {
                matchedIndices.add(i - 1);
                i--;
                j--;
            } else if (dp[i - 1][j] > dp[i][j - 1]) {
                i--;
            } else {
                j--;
            }
        }
    };

    tokens.forEach(token => computeLCSIndices(token));

    const elements: React.ReactNode[] = [];
    let lastIdx = 0;
    let isHighlighting = false;

    for (let k = 0; k < n; k++) {
        const isMatch = matchedIndices.has(k);
        if (isMatch !== isHighlighting) {
            if (k > lastIdx) {
                const chunk = text.substring(lastIdx, k);
                elements.push(
                    isHighlighting 
                        ? <span key={lastIdx} className="font-extrabold text-blue-600 bg-blue-50 rounded-[1px] px-0">{chunk}</span>
                        : <span key={lastIdx}>{chunk}</span>
                );
            }
            lastIdx = k;
            isHighlighting = isMatch;
        }
    }
    
    if (lastIdx < n) {
        const chunk = text.substring(lastIdx);
        elements.push(
            isHighlighting 
                ? <span key={lastIdx} className="font-extrabold text-blue-600 bg-blue-50 rounded-[1px] px-0">{chunk}</span>
                : <span key={lastIdx}>{chunk}</span>
        );
    }

    return <>{elements}</>;
};

interface SuggestionItem {
    label: string;
    cert: Certificate;
    fullString: string;
    score: number;
}

interface GroupedSuggestion {
    cert: Certificate;
    items: SuggestionItem[];
    bestScore: number;
}

const MaterialsInput: React.FC<MaterialsInputProps> = ({ value, onChange, certificates, onNavigateToCertificate }) => {
    const [inputValue, setInputValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [usingKeyboard, setUsingKeyboard] = useState(false); // Track if user is navigating with keyboard
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [itemToDeleteIndex, setItemToDeleteIndex] = useState<number | null>(null);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedItems = useMemo(() => {
        if (!value) return [];
        return value.split(';').map(s => s.trim()).filter(Boolean);
    }, [value]);

    // 1. Calculate matching items
    // 2. Group by Certificate
    const { groupedSuggestions, flatSuggestions } = useMemo(() => {
        if (!inputValue.trim()) return { groupedSuggestions: [], flatSuggestions: [] };
        
        const tokens = inputValue.toLowerCase().split(/\s+/).filter(t => t.length > 0);
        if (tokens.length === 0) return { groupedSuggestions: [], flatSuggestions: [] };

        const tempGroups = new Map<string, GroupedSuggestion>();

        certificates.forEach(cert => {
            const matches: SuggestionItem[] = [];
            let bestCertScore = 10000;

            cert.materials.forEach(mat => {
                const lowerMat = mat.toLowerCase();
                let totalScore = 0;
                let allTokensMatch = true;
                
                const matWords = lowerMat.split(/[\s,.\(\)]+/).filter(w => w.length > 0);

                for (const token of tokens) {
                    let tokenMatched = false;
                    let bestTokenScore = 1000;

                    const idx = lowerMat.indexOf(token);
                    if (idx !== -1) {
                        tokenMatched = true;
                        bestTokenScore = 0;
                        if (idx === 0 || /[\s,.\(\)]/.test(lowerMat[idx - 1])) {
                            bestTokenScore = -10;
                        }
                    } else {
                        const threshold = token.length < 3 ? 0 : Math.floor(token.length / 3);
                        for (const word of matWords) {
                            if (Math.abs(word.length - token.length) > 3 && token.length < word.length) {
                                if (word.length >= token.length) {
                                    const prefix = word.substring(0, token.length);
                                    const dist = levenshteinDistance(token, prefix);
                                    if (dist <= threshold) {
                                        tokenMatched = true;
                                        bestTokenScore = Math.min(bestTokenScore, 20 + dist);
                                    }
                                }
                                continue;
                            }
                            if (Math.abs(word.length - token.length) <= 3) {
                                const dist = levenshteinDistance(token, word);
                                if (dist <= threshold) {
                                    tokenMatched = true;
                                    bestTokenScore = Math.min(bestTokenScore, 10 + dist);
                                }
                            }
                        }
                    }

                    if (!tokenMatched) {
                        allTokensMatch = false;
                        break;
                    }
                    totalScore += bestTokenScore;
                }

                if (allTokensMatch) {
                    const dateObj = new Date(cert.validUntil);
                    const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('ru-RU') : cert.validUntil;
                    const fullString = `${mat} (сертификат № ${cert.number}, до ${dateStr})`;
                    
                    matches.push({
                        label: mat,
                        cert: cert,
                        fullString: fullString,
                        score: totalScore
                    });
                    if (totalScore < bestCertScore) bestCertScore = totalScore;
                }
            });

            if (matches.length > 0) {
                // Sort matches within the certificate by score
                matches.sort((a, b) => a.score - b.score);
                tempGroups.set(cert.id, {
                    cert,
                    items: matches,
                    bestScore: bestCertScore
                });
            }
        });

        // Convert map to array and sort groups by best match score
        const sortedGroups = Array.from(tempGroups.values())
            .sort((a, b) => a.bestScore - b.bestScore)
            .slice(0, 10); // Limit number of groups shown

        // Create a flat list for keyboard navigation
        const flat = sortedGroups.flatMap(g => g.items);

        return { groupedSuggestions: sortedGroups, flatSuggestions: flat };
    }, [inputValue, certificates]);

    useEffect(() => {
        setHighlightedIndex(-1);
        setUsingKeyboard(false);
    }, [flatSuggestions]);

    const handleAddItem = (item: string) => {
        const newItems = [...selectedItems, item];
        onChange(newItems.join('; '));
        setInputValue('');
        setShowSuggestions(false);
        setItemToDeleteIndex(null);
        setUsingKeyboard(false);
        inputRef.current?.focus();
    };

    const handleRemoveItem = (indexToRemove: number) => {
        const newItems = selectedItems.filter((_, index) => index !== indexToRemove);
        onChange(newItems.join('; '));
        setItemToDeleteIndex(null);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const clipboardData = e.clipboardData.getData('text');
        if (!clipboardData) return;

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
            const lastIndex = selectedItems.length - 1;
            if (itemToDeleteIndex === lastIndex) {
                handleRemoveItem(lastIndex);
            } else {
                setItemToDeleteIndex(lastIndex);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setUsingKeyboard(true);
            setHighlightedIndex(prev => {
                if (flatSuggestions.length === 0) return -1;
                return Math.min(prev + 1, flatSuggestions.length - 1);
            });
            setItemToDeleteIndex(null);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setUsingKeyboard(true);
            setHighlightedIndex(prev => Math.max(prev - 1, -1));
            setItemToDeleteIndex(null);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            // Only select suggestion if it was highlighted AND we are using keyboard navigation
            // OR if the user explicitly clicked (handled by onClick), but here we handle Enter.
            // If the user just typed and pressed Enter, we want the typed text unless they arrowed down.
            if (showSuggestions && highlightedIndex >= 0 && flatSuggestions[highlightedIndex] && usingKeyboard) {
                handleAddItem(flatSuggestions[highlightedIndex].fullString);
            } else if (inputValue.trim()) {
                handleAddItem(inputValue.trim());
            }
            setItemToDeleteIndex(null);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
            setItemToDeleteIndex(null);
        } else {
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
        const match = text.match(/№\s*([^\s,]+)/);
        if (match) {
            const certNum = match[1];
            return certificates.find(c => c.number.includes(certNum));
        }
        return null;
    };

    const handleNavigate = (e: React.MouseEvent, certId: string) => {
        e.stopPropagation();
        if (onNavigateToCertificate) {
            onNavigateToCertificate(certId);
        }
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
                    let chipClass = cert 
                        ? "bg-green-50 text-green-800 border-green-200" 
                        : "bg-red-50 text-red-800 border-red-200";

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
                                {item.split('(')[0]}
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
                        setItemToDeleteIndex(null);
                        setUsingKeyboard(false); // Reset keyboard state on typing
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

            {showSuggestions && groupedSuggestions.length > 0 && (
                <div 
                    className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto w-[150%] min-w-[300px]"
                    onMouseMove={() => setUsingKeyboard(false)} // Disable keyboard selection mode if mouse is moved over list
                >
                    {groupedSuggestions.map((group) => (
                        <div key={group.cert.id} className="border-b border-slate-100 last:border-0">
                            {/* Group Header */}
                            <div className="bg-slate-50 px-3 py-1.5 flex justify-between items-center text-xs border-b border-slate-50">
                                <div className="flex items-center gap-2 text-slate-500 font-medium">
                                    <CertificateIcon className="w-3 h-3" />
                                    <span>№ {group.cert.number}</span>
                                    <span className="opacity-75 font-normal">(до {new Date(group.cert.validUntil).toLocaleDateString()})</span>
                                </div>
                                <button
                                    onMouseDown={(e) => handleNavigate(e, group.cert.id)}
                                    className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors"
                                    title="Открыть сертификат"
                                >
                                    <LinkIcon className="w-3 h-3" />
                                </button>
                            </div>

                            {/* Group Items */}
                            {group.items.map((item) => {
                                const globalIndex = flatSuggestions.indexOf(item);
                                const isHighlighted = globalIndex === highlightedIndex;
                                return (
                                    <div
                                        key={globalIndex}
                                        className={`px-3 py-2 cursor-pointer text-sm flex flex-col ${isHighlighted ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : 'hover:bg-white'}`}
                                        onClick={() => handleAddItem(item.fullString)}
                                        onMouseEnter={() => setHighlightedIndex(globalIndex)}
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <span className="font-medium text-slate-800 break-words flex-grow">
                                                <HighlightMatch text={item.label} query={inputValue} />
                                            </span>
                                            {item.score > 20 && (
                                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded flex-shrink-0 mt-0.5" title="Найдено с опечаткой/нечетко">
                                                    ~
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
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
                    onNavigateToCertificate={onNavigateToCertificate}
                    onSelect={(text) => {
                        if (editIndex !== null) {
                            const newItems = [...selectedItems];
                            newItems[editIndex] = text;
                            onChange(newItems.join('; '));
                        } else {
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
