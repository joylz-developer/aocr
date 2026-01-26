
import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { Certificate, ProjectSettings, CertificateFile, Act } from '../types';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import { PlusIcon, DeleteIcon, EditIcon, CertificateIcon, CloseIcon, CloudUploadIcon, SparklesIcon, RestoreIcon, LayoutListIcon, LayoutGridIcon, ColumnsIcon, LinkIcon, ChevronDownIcon, MinimizeIcon, MaximizeIcon, ArrowRightIcon, CheckIcon, XIcon, ArrowDownCircleIcon } from '../components/Icons';
import { GoogleGenAI } from '@google/genai';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface CertificatesPageProps {
    certificates: Certificate[];
    acts: Act[]; // Passed to check usage/links
    settings: ProjectSettings;
    onSave: (cert: Certificate) => void;
    onDelete: (id: string) => void;
    onUnlink: (cert: Certificate, mode: 'remove_entry' | 'remove_reference') => void;
    initialOpenId?: string | null;
    onClearInitialOpenId?: () => void;
}

// Updated Type for AI Suggestions to support multiple options
interface AiSuggestions {
    numbers?: string[];
    dates?: string[];
    materials?: string[];
}

// Diff Types
type DiffStatus = 'unchanged' | 'modified' | 'added' | 'removed';

interface DiffItem {
    id: string; // Unique ID for keying
    status: DiffStatus;
    original?: string;
    new?: string;
    selected: boolean; // Whether the user accepts this change
}

type ViewMode = 'card' | 'list';
type ColumnCount = 1 | 2 | 3;
type UsageFilter = 'all' | 'linked' | 'unlinked';

// --- Helper Functions ---

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

const countPdfPages = (base64Data: string): number => {
    try {
        const header = base64Data.split(',')[0];
        if (!header.includes('pdf')) return 1; // Not a PDF, count as 1 file/sheet

        const base64 = base64Data.split(',')[1];
        const binaryString = window.atob(base64);
        
        // Count /Type /Page occurrences. 
        // This is a heuristic that works for most standard generated PDFs (Word, Scanners).
        const matches = binaryString.match(/\/Type\s*\/Page\b/g);
        return matches ? matches.length : 1;
    } catch (e) {
        console.warn("Could not count PDF pages", e);
        return 1;
    }
};

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

const calculateDiff = (oldList: string[], newList: string[]): DiffItem[] => {
    const diffs: DiffItem[] = [];
    const usedNewIndices = new Set<number>();
    const usedOldIndices = new Set<number>();

    // 1. Exact Matches (Unchanged)
    oldList.forEach((oldItem, oldIdx) => {
        if (usedOldIndices.has(oldIdx)) return;
        const newIdx = newList.findIndex((newItem, idx) => !usedNewIndices.has(idx) && newItem === oldItem);
        if (newIdx !== -1) {
            diffs.push({ id: `unchanged-${oldIdx}`, status: 'unchanged', original: oldItem, new: oldItem, selected: true });
            usedOldIndices.add(oldIdx);
            usedNewIndices.add(newIdx);
        }
    });

    // 2. Fuzzy Matches (Modified)
    // We try to find the best match for each remaining old item
    oldList.forEach((oldItem, oldIdx) => {
        if (usedOldIndices.has(oldIdx)) return;

        let bestMatchIdx = -1;
        let bestScore = Infinity; // Lower is better

        newList.forEach((newItem, newIdx) => {
            if (usedNewIndices.has(newIdx)) return;
            
            // Optimization: Skip if lengths differ drastically
            if (Math.abs(oldItem.length - newItem.length) > oldItem.length * 0.5) return;

            const score = levenshteinDistance(oldItem, newItem);
            // Threshold: change must be less than 60% of string length to be considered an edit
            if (score < bestScore && score < Math.max(oldItem.length, newItem.length) * 0.6) {
                bestScore = score;
                bestMatchIdx = newIdx;
            }
        });

        if (bestMatchIdx !== -1) {
            diffs.push({ 
                id: `mod-${oldIdx}`, 
                status: 'modified', 
                original: oldItem, 
                new: newList[bestMatchIdx], 
                selected: true 
            });
            usedOldIndices.add(oldIdx);
            usedNewIndices.add(bestMatchIdx);
        }
    });

    // 3. Remaining Old -> Removed
    oldList.forEach((oldItem, oldIdx) => {
        if (!usedOldIndices.has(oldIdx)) {
            diffs.push({ id: `del-${oldIdx}`, status: 'removed', original: oldItem, selected: true });
        }
    });

    // 4. Remaining New -> Added
    newList.forEach((newItem, newIdx) => {
        if (!usedNewIndices.has(newIdx)) {
            diffs.push({ id: `add-${newIdx}`, status: 'added', new: newItem, selected: true });
        }
    });

    // Sort to keep original order somewhat, though edits/adds make it tricky. 
    // We'll just group them: Modified, Added, Removed, Unchanged (or keep fuzzy order).
    // For simpler UI, let's sort by status priority: Modified > Added > Removed > Unchanged
    const score = (d: DiffItem) => {
        switch(d.status) {
            case 'modified': return 0;
            case 'added': return 1;
            case 'removed': return 2;
            case 'unchanged': return 3;
            default: return 4;
        }
    };
    diffs.sort((a, b) => score(a) - score(b));

    return diffs;
};


// --- Helper Components ---

const FilterPicker: React.FC<{
    value: UsageFilter;
    onChange: (val: UsageFilter) => void;
}> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const options: { val: UsageFilter; label: string }[] = [
        { val: 'all', label: 'Все сертификаты' },
        { val: 'linked', label: 'Только со связями' },
        { val: 'unlinked', label: 'Без связей' },
    ];

    const currentLabel = value === 'all' ? 'Связи' : options.find(o => o.val === value)?.label;

    return (
        <div className="relative flex-shrink-0" ref={pickerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-md hover:bg-slate-100 border border-slate-300 transition-colors whitespace-nowrap ${value !== 'all' ? 'ring-2 ring-blue-100 border-blue-300 text-blue-700' : ''}`}
                title="Фильтр по использованию"
            >
                <LinkIcon className="w-5 h-5" />
                <span>{currentLabel}</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white border border-slate-200 rounded-md shadow-lg z-50 p-2 animate-fade-in-up">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1">
                        Фильтрация
                    </div>
                    {options.map((opt) => (
                        <button
                            key={opt.val}
                            onClick={() => { onChange(opt.val); setIsOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between group transition-colors
                                ${value === opt.val ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}
                            `}
                        >
                            <span>{opt.label}</span>
                            {value === opt.val && <CheckIcon className="w-4 h-4 text-blue-600" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const AutoResizeTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            // Add 2px to account for borders in border-box sizing, ensuring text isn't cut off
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
        }
    }, [props.value]);

    return (
        <textarea
            ref={textareaRef}
            {...props}
            rows={1}
            className={`resize-none overflow-hidden ${props.className || ''}`}
        />
    );
};

// --- Image Viewer Component with Pan & Zoom ---
const ImageViewer: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const imgRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }, [src]);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Stop scrolling parent modal
        const delta = e.deltaY * -0.001;
        const newScale = Math.min(Math.max(0.5, scale + delta), 5);
        setScale(newScale);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        setPosition({
            x: e.clientX - dragStart.current.x,
            y: e.clientY - dragStart.current.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const resetView = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    const zoomIn = () => setScale(s => Math.min(s + 0.5, 5));
    const zoomOut = () => setScale(s => Math.max(0.5, s - 0.5));

    return (
        <div className="relative w-full h-full overflow-hidden bg-slate-800 rounded-lg group select-none">
            <div 
                ref={imgRef}
                className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <img 
                    src={src} 
                    alt={alt} 
                    className="max-w-none transition-transform duration-75"
                    style={{ 
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        maxHeight: '100%',
                        maxWidth: '100%'
                    }}
                    draggable={false}
                />
            </div>

            {/* Controls */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-sm p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={zoomOut} className="p-1.5 text-white hover:bg-white/20 rounded-full" title="Уменьшить">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"/></svg>
                </button>
                <button type="button" onClick={resetView} className="px-2 text-xs text-white font-mono hover:bg-white/20 rounded-full flex items-center">
                    {Math.round(scale * 100)}%
                </button>
                <button type="button" onClick={zoomIn} className="p-1.5 text-white hover:bg-white/20 rounded-full" title="Увеличить">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                </button>
            </div>
            
             <div className="absolute top-2 right-2 text-[10px] text-white/50 pointer-events-none">
                Колесико: Зум | Драг: Перемещение
            </div>
        </div>
    );
};


const CertificateForm: React.FC<{
    certificate: Certificate | null;
    settings: ProjectSettings;
    onSave: (cert: Certificate) => void;
    onClose: () => void;
}> = ({ certificate, settings, onSave, onClose }) => {
    // Initial state setup with migration logic
    const [formData, setFormData] = useState<Certificate>(() => {
        if (certificate) {
            // Migration: If we have legacy single file but no files array, convert it
            const existingFiles = certificate.files || [];
            if (existingFiles.length === 0 && certificate.fileData) {
                existingFiles.push({
                    id: crypto.randomUUID(),
                    type: certificate.fileType || 'image',
                    name: certificate.fileName || 'Документ',
                    data: certificate.fileData
                });
            }
            return { ...certificate, files: existingFiles, amount: certificate.amount || '1' };
        } else {
            return {
                id: crypto.randomUUID(),
                number: '',
                validUntil: '',
                amount: '1',
                materials: [],
                files: []
            };
        }
    });

    const [activeFileId, setActiveFileId] = useState<string | null>(null);
    const [newMaterial, setNewMaterial] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiSuggestions, setAiSuggestions] = useState<AiSuggestions | null>(null);
    
    // UI States
    const [lastDeletedMaterial, setLastDeletedMaterial] = useState<{index: number, value: string} | null>(null);
    const [hoveredDeleteIndex, setHoveredDeleteIndex] = useState<number | null>(null);
    const [fileToDeleteId, setFileToDeleteId] = useState<string | null>(null);
    const [isGalleryCollapsed, setIsGalleryCollapsed] = useState(false);
    
    // Suggestion Visibility State
    const [showAiMaterials, setShowAiMaterials] = useState(true);
    
    // Mass Edit AI States
    const [massEditPrompt, setMassEditPrompt] = useState('');
    const [isMassEditing, setIsMassEditing] = useState(false);
    const [diffResult, setDiffResult] = useState<DiffItem[] | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const ai = settings.geminiApiKey ? new GoogleGenAI({ apiKey: settings.geminiApiKey }) : null;

    // Set active file on load
    useEffect(() => {
        if (formData.files.length > 0 && !activeFileId) {
            setActiveFileId(formData.files[0].id);
        }
    }, [formData.files, activeFileId]);

    const activeFile = useMemo(() => 
        formData.files.find(f => f.id === activeFileId) || formData.files[0] || null
    , [formData.files, activeFileId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const processFiles = (fileList: FileList) => {
        const filesArray = Array.from(fileList);
        
        // Process all files to get their data and page counts
        const processingPromises = filesArray.map(file => 
            new Promise<{ fileObj: CertificateFile, pages: number }>((resolve) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (typeof event.target?.result === 'string') {
                        const data = event.target.result;
                        const isPdf = file.type.includes('pdf');
                        const pages = isPdf ? countPdfPages(data) : 1; // 1 sheet per image
                        
                        resolve({
                            fileObj: {
                                id: crypto.randomUUID(),
                                name: file.name,
                                type: isPdf ? 'pdf' : 'image',
                                data: data
                            },
                            pages: pages
                        });
                    } else {
                        resolve({ 
                            fileObj: { id: crypto.randomUUID(), name: file.name, type: 'image', data: '' }, 
                            pages: 0 
                        });
                    }
                };
                reader.readAsDataURL(file);
            })
        );

        Promise.all(processingPromises).then(results => {
            const newFiles = results.map(r => r.fileObj);
            const totalNewPages = results.reduce((sum, r) => sum + r.pages, 0);

            setFormData(prev => {
                // Logic: If currently 1 (default) and no files, replace. Otherwise add.
                const currentAmount = parseInt(prev.amount || '0', 10);
                const isDefaultState = prev.files.length === 0 && (prev.amount === '1' || prev.amount === '');
                
                const newAmount = isDefaultState 
                    ? totalNewPages 
                    : currentAmount + totalNewPages;

                // Update active file to the first new one if none selected
                if (!activeFileId && newFiles.length > 0) {
                    setActiveFileId(newFiles[0].id);
                }

                return {
                    ...prev,
                    files: [...prev.files, ...newFiles],
                    amount: String(newAmount)
                };
            });
            
            setAiError(null);
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFiles(e.target.files);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
        }
    };

    const handleDeleteFileClick = (e: React.MouseEvent, fileId: string) => {
        e.stopPropagation();
        setFileToDeleteId(fileId);
    };

    const handleConfirmDeleteFile = () => {
        if (!fileToDeleteId) return;
        
        setFormData(prev => {
            const fileToDelete = prev.files.find(f => f.id === fileToDeleteId);
            const pagesToRemove = fileToDelete ? countPdfPages(fileToDelete.data) : 0;
            const currentAmount = parseInt(prev.amount || '0', 10);
            const newAmount = Math.max(0, currentAmount - pagesToRemove);

            const newFiles = prev.files.filter(f => f.id !== fileToDeleteId);
            // If we deleted the active file, switch to another
            if (fileToDeleteId === activeFileId) {
                setActiveFileId(newFiles.length > 0 ? newFiles[newFiles.length - 1].id : null);
            }
            return { 
                ...prev, 
                files: newFiles,
                amount: String(newAmount)
            };
        });
        
        setFileToDeleteId(null);
    };

    const handleAiScan = async () => {
        if (!activeFile || !ai) return;
        setIsScanning(true);
        setAiError(null);
        setAiSuggestions(null);
        setShowAiMaterials(true); // Auto-expand when scanning

        try {
            const [mimeType, base64Data] = activeFile.data.split(',');
            const cleanMimeType = mimeType.match(/:(.*?);/)?.[1];

            if (!cleanMimeType || !base64Data) throw new Error("Invalid file data");

            const promptNumber = settings.certificatePromptNumber || "Document Type + Number";
            const promptDate = settings.certificatePromptDate || "Issue Date YYYY-MM-DD";
            const promptMaterials = settings.certificatePromptMaterials || "Exact material names";

            const finalPrompt = `
                Analyze the provided document image/PDF.
                Extract the following fields and return ONLY valid JSON:
                {
                    "numbers": ["${promptNumber}"], // Array of possible document numbers, sorted by probability (most likely first)
                    "dates": ["${promptDate}"], // Array of possible dates YYYY-MM-DD, sorted by probability
                    "materials": ["${promptMaterials}"] // Array of materials found (NO duplicates)
                }
                
                If you are unsure about the number or date, provide up to 3 most likely options.
                Ensure "materials" list does not contain duplicates.
                IMPORTANT: Return valid JSON only. Do not add markdown code blocks.
            `;

            const part = {
                inlineData: {
                    mimeType: cleanMimeType,
                    data: base64Data
                }
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [part, { text: finalPrompt }] },
                config: { responseMimeType: "application/json" }
            });

            const text = response.text;
            if (!text) throw new Error("Empty response from AI");

            const jsonStartIndex = text.indexOf('{');
            const jsonEndIndex = text.lastIndexOf('}');
            
            if (jsonStartIndex === -1 || jsonEndIndex === -1) {
                throw new Error("JSON structure not found in response");
            }

            const jsonString = text.substring(jsonStartIndex, jsonEndIndex + 1);
            const result = JSON.parse(jsonString);
            
            // Normalize result to arrays even if AI returns single strings (backward compat)
            const numbers = Array.isArray(result.numbers) ? result.numbers : (result.number ? [result.number] : []);
            const dates = Array.isArray(result.dates) ? result.dates : (result.validUntil ? [result.validUntil] : []);
            // Dedup AI materials immediately
            const rawMaterials = Array.isArray(result.materials) ? result.materials : [];
            const uniqueMaterials = Array.from(new Set(rawMaterials)) as string[];

            setAiSuggestions({
                numbers: numbers,
                dates: dates,
                materials: uniqueMaterials
            });

        } catch (error) {
            console.error("AI Scan Error:", error);
            setAiError("Не удалось распознать данные. Убедитесь, что API ключ верен.");
        } finally {
            setIsScanning(false);
        }
    };

    // --- Mass Edit AI Logic ---
    const handleAiMassEdit = async () => {
        if (!ai || !massEditPrompt.trim() || formData.materials.length === 0) return;
        setIsMassEditing(true);
        setDiffResult(null);
        
        try {
            const prompt = `
                Current materials list: ${JSON.stringify(formData.materials)}
                User request: "${massEditPrompt}"
                
                Perform the requested operation on the list. 
                Examples: 
                - "Remove dimensions" -> strip sizes
                - "Split by comma" -> explode items
                - "Translate to English" -> translate
                - "Fix typos" -> fix
                - "Clear list" -> return empty array
                
                Return ONLY the new list of materials as a JSON array of strings. ["mat1", "mat2"]
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: "application/json" }
            });

            const text = response.text;
            if(!text) throw new Error("No response");
            const newList = JSON.parse(text);

            if (Array.isArray(newList)) {
                // Determine Diff
                const calculatedDiff = calculateDiff(formData.materials, newList);
                setDiffResult(calculatedDiff);
            }
        } catch (e) {
            alert("Ошибка при обработке AI. Попробуйте другой запрос.");
            console.error(e);
            setDiffResult(null);
        } finally {
            setIsMassEditing(false);
        }
    };

    const handleCancelMassEdit = () => {
        setDiffResult(null);
        // Do NOT clear massEditPrompt to allow user to retry/edit
    };

    const handleCommitMassEdit = () => {
        if (diffResult) {
            const finalMaterials: string[] = [];
            
            diffResult.forEach(item => {
                if (item.status === 'unchanged') {
                    if (item.original) finalMaterials.push(item.original);
                } else if (item.status === 'modified') {
                    if (item.selected && item.new) finalMaterials.push(item.new);
                    else if (!item.selected && item.original) finalMaterials.push(item.original);
                } else if (item.status === 'added') {
                    if (item.selected && item.new) finalMaterials.push(item.new);
                } else if (item.status === 'removed') {
                    if (!item.selected && item.original) finalMaterials.push(item.original);
                    // If selected, it's removed, so don't push
                }
            });

            setFormData(prev => ({ ...prev, materials: finalMaterials }));
            setDiffResult(null);
            setMassEditPrompt('');
        }
    };
    
    const handleToggleDiffSelection = (id: string) => {
        setDiffResult(prev => {
            if (!prev) return null;
            return prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item);
        });
    };
    
    const handleSelectAllDiffs = (select: boolean) => {
        setDiffResult(prev => {
            if (!prev) return null;
            return prev.map(item => ({ ...item, selected: select }));
        });
    };

    // --- Material List Logic ---

    const handleAddMaterial = (materialName: string) => {
        const nameToAdd = materialName.trim();
        if (!nameToAdd) return;
        // Check duplicates
        if (formData.materials.includes(nameToAdd)) return;

        setFormData(prev => ({
            ...prev,
            materials: [...prev.materials, nameToAdd]
        }));
    };

    const handleManualAddMaterial = () => {
        handleAddMaterial(newMaterial);
        setNewMaterial('');
    };

    const handleRemoveMaterial = (index: number) => {
        const itemToRemove = formData.materials[index];
        setLastDeletedMaterial({ index, value: itemToRemove });
        
        setFormData(prev => ({
            ...prev,
            materials: prev.materials.filter((_, i) => i !== index)
        }));
    };

    const handleUndoDelete = () => {
        if (lastDeletedMaterial) {
            setFormData(prev => {
                const newMaterials = [...prev.materials];
                newMaterials.splice(lastDeletedMaterial.index, 0, lastDeletedMaterial.value);
                return { ...prev, materials: newMaterials };
            });
            setLastDeletedMaterial(null);
        }
    };

    const handleRemoveAllMaterials = () => {
        if (confirm("Вы уверены, что хотите удалить все материалы?")) {
            setFormData(prev => ({ ...prev, materials: [] }));
        }
    };

    const handleEditMaterial = (index: number, newValue: string) => {
        setFormData(prev => {
            const newMaterials = [...prev.materials];
            newMaterials[index] = newValue;
            return { ...prev, materials: newMaterials };
        });
    };

    const applyAiSuggestion = (field: 'number' | 'validUntil', value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Update legacy fields for backward compatibility just in case other components use them directly without checking files array
        const primaryFile = formData.files[0];
        const finalData = {
            ...formData,
            fileData: primaryFile?.data,
            fileType: primaryFile?.type,
            fileName: primaryFile?.name
        };
        onSave(finalData);
        onClose();
    };

    const inputClass = "mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900";
    const labelClass = "block text-sm font-medium text-slate-700";

    const isPreviewMode = !!diffResult;

    // Prevent click propagation to card when clicking inside the modal
    const handleModalClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    }

    return (
        <div onClick={handleModalClick} className="h-full">
            <form onSubmit={handleSubmit} className="flex flex-col h-[75vh]">
                
                <div className="flex flex-row gap-6 h-full min-h-0 relative">
                    {/* LEFT COLUMN: Document Preview Gallery */}
                    <div 
                        className={`flex flex-col h-full min-h-0 gap-2 transition-all duration-300 ease-in-out relative
                            ${isGalleryCollapsed ? 'w-12' : 'w-full md:w-3/5'}
                        `}
                    >
                        {/* Collapse Toggle */}
                        <button 
                            type="button"
                            onClick={() => setIsGalleryCollapsed(!isGalleryCollapsed)}
                            className="absolute -right-3 top-2 z-30 bg-white border border-slate-300 rounded-full p-1 shadow-md hover:bg-slate-50 text-slate-600"
                            title={isGalleryCollapsed ? "Развернуть превью" : "Свернуть превью"}
                        >
                            {isGalleryCollapsed ? <MaximizeIcon className="w-4 h-4"/> : <MinimizeIcon className="w-4 h-4"/>}
                        </button>

                        {!isGalleryCollapsed ? (
                            <>
                                {/* New Header Area */}
                                <div className="flex justify-between items-center mb-2 px-1 min-h-[1.75rem]">
                                    <span className="font-semibold text-slate-700 truncate pr-2" title={activeFile ? activeFile.name : ''}>
                                        {activeFile ? activeFile.name : 'Нет файла'}
                                    </span>
                                    {/* DELETE BUTTON REMOVED AS REQUESTED */}
                                </div>

                                <div 
                                    className={`flex-grow flex flex-col bg-slate-50 rounded-lg border-2 transition-colors relative overflow-hidden
                                        ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}
                                    `}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    
                                    <div className="flex-grow overflow-hidden relative flex items-center justify-center p-2 bg-slate-800">
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,image/*" multiple />
                                        
                                        {activeFile ? (
                                            activeFile.type === 'image' ? (
                                                <ImageViewer src={activeFile.data} alt="Preview" />
                                            ) : (
                                                <object data={activeFile.data} type="application/pdf" className="w-full h-full rounded-md shadow-inner bg-white">
                                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                                        <p>PDF Preview не поддерживается.</p>
                                                    </div>
                                                </object>
                                            )
                                        ) : (
                                            <div className="text-center p-6 pointer-events-none flex flex-col items-center">
                                                <CloudUploadIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                                                <p className="text-lg text-slate-400 font-medium">Перетащите файлы сюда</p>
                                                <p className="text-sm text-slate-500 mt-1">или выберите из списка снизу</p>
                                            </div>
                                        )}

                                        {/* Drag Overlay */}
                                        {isDragging && (
                                            <div className="absolute inset-0 bg-blue-100/90 flex flex-col items-center justify-center z-20 border-2 border-blue-500 border-dashed rounded-lg animate-fade-in-up">
                                                <CloudUploadIcon className="w-16 h-16 text-blue-600 mb-2" />
                                                <span className="text-lg font-bold text-blue-700">Отпустите, чтобы добавить файлы</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Thumbnail Strip */}
                                <div className="h-24 flex-shrink-0 bg-slate-100 rounded-lg border border-slate-200 p-2 overflow-x-auto flex gap-2 items-center">
                                    {formData.files.map(file => (
                                        <div 
                                            key={file.id}
                                            onClick={() => setActiveFileId(file.id)}
                                            className={`
                                                relative h-20 w-20 min-w-[5rem] rounded-md border-2 overflow-hidden cursor-pointer group flex-shrink-0
                                                ${activeFileId === file.id ? 'border-blue-600 ring-2 ring-blue-200' : 'border-slate-300 hover:border-slate-400'}
                                            `}
                                        >
                                            {file.type === 'image' ? (
                                                <img src={file.data} alt="thumb" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-white flex flex-col items-center justify-center p-1">
                                                    <CertificateIcon className="w-8 h-8 text-red-500" />
                                                    <span className="text-[8px] text-slate-600 truncate w-full text-center mt-1">{file.name}</span>
                                                </div>
                                            )}
                                            <div className="absolute top-0 right-0 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => handleDeleteFileClick(e, file.id)}
                                                    className="bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                                                >
                                                    <CloseIcon className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    <button 
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="h-20 w-20 min-w-[5rem] rounded-md border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                                        title="Добавить файлы"
                                    >
                                        <PlusIcon className="w-6 h-6 mb-1" />
                                        <span className="text-xs font-medium">Добавить</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="h-full bg-slate-100 rounded-lg border border-slate-200 flex flex-col items-center pt-8 gap-4 overflow-hidden">
                                {activeFile && (
                                    <div className="w-8 h-8 rounded overflow-hidden shadow border border-white" title={activeFile.name}>
                                        {activeFile.type === 'image' ? (
                                            <img src={activeFile.data} className="w-full h-full object-cover"/>
                                        ) : (
                                            <CertificateIcon className="w-full h-full text-slate-400 bg-white p-1"/>
                                        )}
                                    </div>
                                )}
                                <span className="vertical-rl text-xs text-slate-400 font-medium tracking-wider uppercase" style={{writingMode: 'vertical-rl'}}>
                                    Превью скрыто
                                </span>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Form Fields */}
                    {/* ... rest of the form ... */}
                    {/* (This part remains largely the same, just closing the block for context) */}
                    <div className={`flex flex-col h-full min-h-0 transition-all duration-300 ${isGalleryCollapsed ? 'w-full pl-2' : 'w-full md:w-2/5'}`}>
                        <div className="overflow-y-auto pr-2 flex-grow space-y-5 pb-4">
                            
                            {/* AI Button */}
                            {ai && activeFile && (
                                <div className="flex flex-col">
                                    <button
                                        type="button"
                                        onClick={handleAiScan}
                                        disabled={isScanning || isPreviewMode}
                                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white px-4 py-2.5 rounded-lg hover:from-violet-600 hover:to-fuchsia-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-sm font-medium"
                                    >
                                        <SparklesIcon className="w-5 h-5" />
                                        {isScanning ? 'Анализ текущего файла...' : 'Сканировать (AI)'}
                                    </button>
                                    {aiError && <p className="text-red-500 text-xs mt-2">{aiError}</p>}
                                </div>
                            )}

                            {/* Number Field */}
                            <div>
                                <label className={labelClass}>Номер (тип + №)</label>
                                <input type="text" name="number" value={formData.number} onChange={handleChange} className={inputClass} required placeholder="Паспорт качества № 123" disabled={isPreviewMode} />
                                {aiSuggestions?.numbers && aiSuggestions.numbers.length > 0 && !isPreviewMode && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <span className="text-xs text-violet-600 font-semibold flex items-center w-full"><SparklesIcon className="w-3 h-3 mr-1"/> AI Варианты:</span>
                                        {aiSuggestions.numbers.map((suggestion, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => applyAiSuggestion('number', suggestion)}
                                                className={`text-xs px-2 py-1 rounded border transition-colors max-w-full truncate
                                                    ${formData.number === suggestion 
                                                        ? 'bg-violet-100 text-violet-800 border-violet-300 ring-1 ring-violet-200' 
                                                        : 'bg-violet-50 text-slate-700 border-violet-100 hover:bg-violet-200 hover:border-violet-300'
                                                    }
                                                `}
                                                title={`Нажмите, чтобы выбрать: ${suggestion}`}
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Date Field & Amount Field Row */}
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className={labelClass}>Дата документа</label>
                                    <input type="date" name="validUntil" value={formData.validUntil} onChange={handleChange} className={inputClass} required disabled={isPreviewMode} />
                                    {aiSuggestions?.dates && aiSuggestions.dates.length > 0 && !isPreviewMode && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <span className="text-xs text-violet-600 font-semibold flex items-center w-full"><SparklesIcon className="w-3 h-3 mr-1"/> AI Варианты:</span>
                                            {aiSuggestions.dates.map((dateStr, idx) => {
                                                const formatted = new Date(dateStr).toLocaleDateString();
                                                return (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => applyAiSuggestion('validUntil', dateStr)}
                                                        className={`text-xs px-2 py-1 rounded border transition-colors
                                                            ${formData.validUntil === dateStr 
                                                                ? 'bg-violet-100 text-violet-800 border-violet-300 ring-1 ring-violet-200' 
                                                                : 'bg-violet-50 text-slate-700 border-violet-100 hover:bg-violet-200 hover:border-violet-300'
                                                            }
                                                        `}
                                                        title={`Нажмите, чтобы выбрать: ${formatted}`}
                                                    >
                                                        {formatted}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="w-32">
                                    <label className={labelClass}>Кол-во листов</label>
                                    <input 
                                        type="number" 
                                        name="amount" 
                                        value={formData.amount} 
                                        onChange={handleChange} 
                                        className={inputClass} 
                                        min="1"
                                        disabled={isPreviewMode}
                                    />
                                </div>
                            </div>

                            {/* Materials Section */}
                            <div className="border-t pt-4">
                                <div className="flex justify-between items-center mb-1">
                                    <label className={labelClass}>Материалы ({formData.materials.length})</label>
                                    {formData.materials.length > 0 && !isPreviewMode && (
                                        <button 
                                            type="button" 
                                            onClick={handleRemoveAllMaterials}
                                            className="text-xs text-red-500 hover:text-red-700 underline"
                                        >
                                            Удалить все
                                        </button>
                                    )}
                                </div>
                                
                                {/* AI Materials Suggestions with Hide/Show */}
                                {aiSuggestions?.materials && aiSuggestions.materials.length > 0 && !isPreviewMode && (
                                    <div className="mb-4 bg-violet-50 border border-violet-100 rounded-md p-3">
                                        <div className="flex justify-between items-center mb-2 cursor-pointer select-none" onClick={() => setShowAiMaterials(!showAiMaterials)}>
                                            <p className="text-xs text-violet-700 font-bold flex items-center">
                                                <SparklesIcon className="w-3 h-3 mr-1"/> 
                                                Найдено в документе ({aiSuggestions.materials.length})
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <ChevronDownIcon className={`w-4 h-4 text-violet-500 transition-transform ${showAiMaterials ? 'rotate-180' : ''}`} />
                                            </div>
                                        </div>
                                        
                                        {showAiMaterials && (
                                            <div className="animate-fade-in-up">
                                                <div className="flex gap-2 mb-3 justify-end border-b border-violet-100 pb-2">
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            if (aiSuggestions.materials) {
                                                                setFormData(prev => ({...prev, materials: [...aiSuggestions.materials!]}));
                                                            }
                                                        }}
                                                        className="text-xs bg-white border border-violet-200 text-violet-700 px-2 py-1 rounded hover:bg-violet-50"
                                                    >
                                                        Заменить все
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            if (aiSuggestions.materials) {
                                                                const unique = aiSuggestions.materials.filter(m => !formData.materials.includes(m));
                                                                setFormData(prev => ({...prev, materials: [...prev.materials, ...unique]}));
                                                            }
                                                        }}
                                                        className="text-xs bg-violet-600 text-white px-2 py-1 rounded hover:bg-violet-700"
                                                    >
                                                        Добавить уникальные
                                                    </button>
                                                </div>
                                                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                                                    {aiSuggestions.materials.map((mat, idx) => {
                                                        const isDuplicate = formData.materials.includes(mat);
                                                        return (
                                                            <button
                                                                key={idx}
                                                                type="button"
                                                                onClick={() => !isDuplicate && handleAddMaterial(mat)}
                                                                disabled={isDuplicate}
                                                                className={`text-xs border px-2 py-1 rounded-full text-left max-w-full truncate
                                                                    ${isDuplicate 
                                                                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-default line-through' 
                                                                        : 'bg-white border-violet-200 text-slate-700 hover:border-violet-400 hover:text-violet-700'
                                                                    }
                                                                `}
                                                                title={isDuplicate ? "Уже добавлено" : "Нажмите, чтобы добавить"}
                                                            >
                                                                {isDuplicate ? '' : '+ '}{mat}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Manual Add Input */}
                                {!isPreviewMode && (
                                    <div className="flex gap-2 mt-1 mb-3">
                                        <input 
                                            type="text" 
                                            value={newMaterial} 
                                            onChange={e => setNewMaterial(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleManualAddMaterial())}
                                            className={inputClass} 
                                            placeholder="Введите название и нажмите Enter" 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={handleManualAddMaterial}
                                            className="mt-1 px-4 py-2 bg-slate-100 text-slate-700 border border-slate-300 rounded-md hover:bg-slate-200"
                                        >
                                            <PlusIcon className="w-5 h-5"/>
                                        </button>
                                    </div>
                                )}
                                
                                {/* Undo Banner */}
                                {lastDeletedMaterial && !isPreviewMode && (
                                    <div className="mb-2 p-2 bg-slate-100 text-xs flex justify-between items-center rounded border border-slate-200 animate-fade-in-up">
                                        <span className="text-slate-600 truncate mr-2">
                                            Удалено: "{lastDeletedMaterial.value}"
                                        </span>
                                        <button 
                                            type="button"
                                            onClick={handleUndoDelete}
                                            className="text-blue-600 font-medium hover:underline flex items-center gap-1 whitespace-nowrap"
                                        >
                                            <RestoreIcon className="w-3 h-3" /> Вернуть
                                        </button>
                                    </div>
                                )}

                                {/* Editable List */}
                                <div className="flex flex-col gap-1">
                                    {formData.materials.length === 0 && !isPreviewMode && <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded">Список материалов пуст</p>}
                                    
                                    {!isPreviewMode && formData.materials.map((item, idx) => (
                                        <div 
                                            key={idx} 
                                            className={`flex items-start gap-1 group py-1 px-1 rounded transition-colors ${hoveredDeleteIndex === idx ? 'bg-red-50' : ''}`}
                                        >
                                            <AutoResizeTextarea
                                                value={item}
                                                onChange={(e) => handleEditMaterial(idx, e.target.value)}
                                                className="block w-full text-sm border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded focus:bg-white transition-colors py-1 px-2 bg-slate-50"
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemoveMaterial(idx)} 
                                                onMouseEnter={() => setHoveredDeleteIndex(idx)}
                                                onMouseLeave={() => setHoveredDeleteIndex(null)}
                                                className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-red-100 mt-0.5 transition-colors"
                                                title="Удалить строку"
                                            >
                                                <CloseIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Mass AI Edit Section */}
                                {formData.materials.length > 0 && ai && (
                                    <div className="mt-6 pt-4 border-t border-slate-200">
                                        {!diffResult ? (
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    value={massEditPrompt}
                                                    onChange={e => setMassEditPrompt(e.target.value)}
                                                    placeholder="AI: 'Удали размеры', 'Исправь...', 'Очистить'..."
                                                    className="flex-grow text-sm border border-violet-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAiMassEdit())}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAiMassEdit}
                                                    disabled={isMassEditing || !massEditPrompt.trim()}
                                                    className="bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white px-3 py-2 rounded-md hover:from-violet-600 hover:to-fuchsia-700 disabled:opacity-50 text-sm whitespace-nowrap flex items-center"
                                                >
                                                    {isMassEditing ? '...' : <SparklesIcon className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="bg-violet-50 p-3 rounded-md border border-violet-100 animate-fade-in-up">
                                                <div className="flex justify-between items-center mb-2 pb-2 border-b border-violet-200">
                                                    <p className="text-xs text-violet-800 font-medium">Проверьте изменения:</p>
                                                    <div className="flex gap-3">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleSelectAllDiffs(true)} 
                                                            className="text-[10px] font-medium text-violet-600 hover:underline hover:text-violet-800"
                                                        >
                                                            Выбрать все
                                                        </button>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleSelectAllDiffs(false)} 
                                                            className="text-[10px] font-medium text-slate-500 hover:underline hover:text-slate-700"
                                                        >
                                                            Снять все
                                                        </button>
                                                    </div>
                                                </div>
                                                
                                                <div className="mb-3 space-y-2 pr-1">
                                                    {diffResult.length === 0 && <p className="text-xs text-slate-500 italic">Нет изменений</p>}
                                                    {diffResult.map((item) => (
                                                        <div key={item.id} className="flex items-start gap-2 text-xs bg-white p-2 rounded border border-slate-200 shadow-sm">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={item.selected}
                                                                onChange={() => handleToggleDiffSelection(item.id)}
                                                                className="h-4 w-4 form-checkbox-custom flex-shrink-0 mt-0.5"
                                                            />
                                                            
                                                            <div className="flex-grow min-w-0">
                                                                {item.status === 'modified' && (
                                                                    <div className="flex flex-col md:flex-row items-start md:items-stretch gap-2 w-full">
                                                                        <div className="flex-1 w-full md:w-auto p-1.5 bg-red-50 border border-red-100 rounded text-red-900 text-xs break-words">
                                                                            {item.original}
                                                                        </div>
                                                                        <div className="flex-shrink-0 self-center">
                                                                             <ArrowRightIcon className="w-3 h-3 text-slate-400 hidden md:block" />
                                                                             <ArrowRightIcon className="w-3 h-3 text-slate-400 md:hidden rotate-90" />
                                                                        </div>
                                                                        <div className="flex-1 w-full md:w-auto p-1.5 bg-green-50 border border-green-100 rounded text-green-900 text-xs font-medium break-words">
                                                                            {item.new}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {item.status === 'added' && (
                                                                    <div className="text-green-700 font-medium flex items-start gap-1 p-1.5 bg-green-50 border border-green-100 rounded">
                                                                        <PlusIcon className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                                                        <span className="break-words">{item.new}</span>
                                                                    </div>
                                                                )}
                                                                {item.status === 'removed' && (
                                                                    <div className="text-red-700 p-1.5 bg-red-50 border border-red-100 rounded flex items-start gap-1 opacity-80">
                                                                        <span className="line-through decoration-red-400 break-words">{item.original}</span>
                                                                    </div>
                                                                )}
                                                                {item.status === 'unchanged' && (
                                                                    <div className="text-slate-500 break-words pt-0.5" title="Без изменений">{item.original}</div>
                                                                )}
                                                            </div>
                                                            
                                                            <div className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5
                                                                ${item.status === 'modified' ? 'bg-amber-100 text-amber-700' : ''}
                                                                ${item.status === 'added' ? 'bg-green-100 text-green-700' : ''}
                                                                ${item.status === 'removed' ? 'bg-red-100 text-red-700' : ''}
                                                                ${item.status === 'unchanged' ? 'bg-slate-100 text-slate-500' : ''}
                                                            `}>
                                                                {item.status === 'modified' ? 'ИЗМ' : item.status === 'added' ? 'НОВ' : item.status === 'removed' ? 'УДЛ' : 'ОК'}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="flex gap-2 sticky bottom-0 bg-violet-50 pt-2 border-t border-violet-100">
                                                    <button 
                                                        type="button" 
                                                        onClick={handleCommitMassEdit}
                                                        className="flex-1 bg-violet-600 text-white text-xs py-2 rounded hover:bg-violet-700 font-medium"
                                                    >
                                                        Применить выбранное
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        onClick={handleCancelMassEdit}
                                                        className="flex-1 bg-white border border-slate-300 text-slate-700 text-xs py-2 rounded hover:bg-slate-50 font-medium"
                                                    >
                                                        Отменить
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                            </div>
                        </div>
                        
                        {/* Sticky Footer for Buttons within the column */}
                        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 bg-white mt-auto">
                            <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">Отмена</button>
                            <button type="submit" disabled={isPreviewMode} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed">Сохранить</button>
                        </div>
                    </div>
                </div>
            </form>

            <ConfirmationModal 
                isOpen={!!fileToDeleteId} 
                onClose={() => setFileToDeleteId(null)} 
                onConfirm={handleConfirmDeleteFile}
                title="Удаление файла"
                confirmText="Удалить"
            >
                Вы действительно хотите удалить эту страницу/изображение? Это действие нельзя будет отменить.
            </ConfirmationModal>
        </div>
    );
};

const CertificatesPage: React.FC<CertificatesPageProps> = ({ certificates, acts, settings, onSave, onDelete, onUnlink, initialOpenId, onClearInitialOpenId }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCert, setEditingCert] = useState<Certificate | null>(null);
    const [previewFile, setPreviewFile] = useState<{ type: 'pdf' | 'image', data: string } | null>(null);
    
    // View Controls State - Persisted
    const [searchQuery, setSearchQuery] = useLocalStorage<string>('cert_search_query', '');
    const [viewMode, setViewMode] = useLocalStorage<ViewMode>('cert_view_mode', 'card');
    const [columnCount, setColumnCount] = useLocalStorage<ColumnCount>('cert_column_count', 3);
    const [expandedMaterialCards, setExpandedMaterialCards] = useState<Set<string>>(new Set());
    
    const [filterUsage, setFilterUsage] = useState<UsageFilter>('all');
    
    // Delete Confirmation State
    const [deleteWarning, setDeleteWarning] = useState<{ cert: Certificate, usedInActs: string[] } | null>(null);
    const [manageLinksCert, setManageLinksCert] = useState<{ cert: Certificate, usedInActs: {id: string, number: string}[] } | null>(null);

    // Calculate usage once per render for all certs (optimization)
    const usageMap = useMemo(() => {
        const map = new Map<string, number>();
        
        certificates.forEach(cert => {
            let count = 0;
            const searchStr = `(сертификат № ${cert.number}`;
            for (const act of acts) {
                if (act.materials.includes(searchStr)) count++;
            }
            map.set(cert.id, count);
        });
        return map;
    }, [acts, certificates]);

    // Effect to handle initial opening from external navigation
    useEffect(() => {
        if (initialOpenId) {
            const certToOpen = certificates.find(c => c.id === initialOpenId);
            if (certToOpen) {
                setEditingCert(certToOpen);
                setIsModalOpen(true);
            }
            // Clear the ID so it doesn't re-open if the user closes it
            if(onClearInitialOpenId) onClearInitialOpenId();
        }
    }, [initialOpenId, certificates, onClearInitialOpenId]);

    const filteredCertificates = useMemo(() => {
        let results = certificates;

        // 1. Filter by Usage
        if (filterUsage !== 'all') {
            results = results.filter(c => {
                const linkCount = usageMap.get(c.id) || 0;
                if (filterUsage === 'linked') return linkCount > 0;
                if (filterUsage === 'unlinked') return linkCount === 0;
                return true;
            });
        }

        // 2. Filter by Search Query
        if (!searchQuery.trim()) return results;
        
        const tokens = searchQuery.toLowerCase().split(/\s+/).filter(t => t.length > 0);
        
        return results.filter(c => {
            const certNumLower = c.number.toLowerCase();
            let bestScoreForCert = 10000;
            let totalScore = 0;
            let allTokensMatch = true;

            for (const token of tokens) {
                let tokenMatched = false;
                let bestTokenScore = 1000;

                // 1. Exact/Substring in Certificate Number
                if (certNumLower.includes(token)) {
                    tokenMatched = true;
                    bestTokenScore = 0; 
                } 
                else {
                    // 2. Fuzzy Match against Material words
                    for (const mat of c.materials) {
                        const lowerMat = mat.toLowerCase();
                        if (lowerMat.includes(token)) {
                            tokenMatched = true;
                            bestTokenScore = 0;
                            break;
                        }
                        
                        const matWords = lowerMat.split(/[\s,.\(\)]+/).filter(w => w.length > 0);
                        const threshold = token.length < 3 ? 0 : Math.floor(token.length / 3);
                        
                        for (const word of matWords) {
                            if (Math.abs(word.length - token.length) <= 3) {
                                const dist = levenshteinDistance(token, word);
                                if (dist <= threshold) {
                                    tokenMatched = true;
                                    bestTokenScore = Math.min(bestTokenScore, 10 + dist);
                                }
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
            
            return allTokensMatch;
        });
    }, [certificates, searchQuery, filterUsage, usageMap]);

    const handleOpenModal = (cert: Certificate | null = null) => {
        setEditingCert(cert);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingCert(null);
        setIsModalOpen(false);
    };

    const handlePreview = (cert: Certificate) => {
        // Fallback for legacy certificates that haven't been migrated in the edit form yet
        const fileData = cert.files?.[0]?.data || cert.fileData;
        const fileType = cert.files?.[0]?.type || cert.fileType;

        if (fileData && fileType) {
            setPreviewFile({ type: fileType, data: fileData });
        } else {
            alert("Файл не загружен для этого сертификата.");
        }
    };

    const openInNewTab = (fileData: string) => {
        fetch(fileData)
            .then(res => res.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
            })
            .catch(err => {
                console.error("Error opening file:", err);
                alert("Не удалось открыть файл.");
            });
    };
    
    // Smart Delete Logic
    const handleClickDelete = (e: React.MouseEvent, cert: Certificate) => {
        e.stopPropagation();
        // Check for usage in acts
        const usedInActs: string[] = [];
        
        acts.forEach(act => {
            if (act.materials.includes(`(сертификат № ${cert.number}`)) {
                usedInActs.push(act.number || 'б/н');
            }
        });

        if (usedInActs.length > 0) {
            setDeleteWarning({ cert, usedInActs });
        } else {
            onDelete(cert.id);
        }
    };
    
    const handleConfirmDelete = (mode: 'default' | 'clean' | 'remove_materials') => {
        if (!deleteWarning) return;
        
        const cert = deleteWarning.cert;
        
        // 1. Just Delete (Default): Cert is gone, Acts keep text "(cert 123)" but it's dead text.
        // 2. Clean: Delete Cert, remove "(cert 123)" from Acts, keeping material name.
        // 3. Remove Materials: Delete Cert, remove entire material line from Acts.
        
        if (mode === 'clean') {
            onUnlink(cert, 'remove_reference');
        } else if (mode === 'remove_materials') {
            onUnlink(cert, 'remove_entry');
        }
        
        onDelete(cert.id);
        setDeleteWarning(null);
    };

    const handleManageLinks = (e: React.MouseEvent, cert: Certificate) => {
        e.stopPropagation();
        const usedInActs: {id: string, number: string}[] = [];
        acts.forEach(act => {
            if (act.materials.includes(`(сертификат № ${cert.number}`)) {
                usedInActs.push({ id: act.id, number: act.number || 'б/н' });
            }
        });
        setManageLinksCert({ cert, usedInActs });
    };

    const handleUnlinkFromManager = (mode: 'remove_entry' | 'remove_reference') => {
        if (manageLinksCert) {
            onUnlink(manageLinksCert.cert, mode);
            setManageLinksCert(null);
        }
    };

    const toggleMaterialsExpand = (e: React.MouseEvent, certId: string) => {
        e.stopPropagation();
        setExpandedMaterialCards(prev => {
            const newSet = new Set(prev);
            if (newSet.has(certId)) newSet.delete(certId);
            else newSet.add(certId);
            return newSet;
        });
    };

    const gridColsClass = columnCount === 1 ? 'grid-cols-1' : columnCount === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 flex-shrink-0 gap-4">
                <h1 className="text-2xl font-bold text-slate-800">Сертификаты и Паспорта</h1>
                <button onClick={() => handleOpenModal()} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 whitespace-nowrap">
                    <PlusIcon /> Добавить сертификат
                </button>
            </div>

            {/* Toolbar: Search and View Controls */}
            <div className="flex flex-col lg:flex-row gap-4 mb-4 pb-4 border-b border-slate-100 items-center justify-between">
                <div className="flex gap-2 w-full lg:w-auto flex-1">
                    <input
                        type="text"
                        placeholder="Поиск по номеру, материалам..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full lg:max-w-md px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    
                    <FilterPicker 
                        value={filterUsage} 
                        onChange={setFilterUsage} 
                    />
                </div>
                
                <div className="flex items-center gap-4 text-slate-500 flex-shrink-0">
                    <div className="flex items-center gap-1 border rounded-md p-0.5">
                         <button 
                            onClick={() => setViewMode('card')} 
                            className={`p-1.5 rounded ${viewMode === 'card' ? 'bg-slate-200 text-slate-800' : 'hover:bg-slate-100'}`}
                            title="Карточки"
                        >
                            <LayoutGridIcon className="w-5 h-5"/>
                         </button>
                         <button 
                            onClick={() => setViewMode('list')} 
                            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-slate-200 text-slate-800' : 'hover:bg-slate-100'}`}
                            title="Список"
                        >
                            <LayoutListIcon className="w-5 h-5"/>
                         </button>
                    </div>

                    <div className="w-px h-6 bg-slate-200 mx-1"></div>

                    <div className="flex items-center gap-1 border rounded-md p-0.5">
                         <button 
                            onClick={() => setColumnCount(1)} 
                            className={`px-3 py-1 rounded text-xs font-medium ${columnCount === 1 ? 'bg-slate-200 text-slate-800' : 'hover:bg-slate-100'}`}
                        >
                            1
                         </button>
                         <button 
                            onClick={() => setColumnCount(2)} 
                            className={`px-3 py-1 rounded text-xs font-medium ${columnCount === 2 ? 'bg-slate-200 text-slate-800' : 'hover:bg-slate-100'}`}
                        >
                            2
                         </button>
                         <button 
                            onClick={() => setColumnCount(3)} 
                            className={`px-3 py-1 rounded text-xs font-medium ${columnCount === 3 ? 'bg-slate-200 text-slate-800' : 'hover:bg-slate-100'}`}
                        >
                            3
                         </button>
                    </div>
                </div>
            </div>

            <div className="flex-grow overflow-auto">
                 <div className={`grid ${gridColsClass} gap-4`}>
                    {filteredCertificates.map(cert => {
                        const hasFiles = (cert.files && cert.files.length > 0) || !!cert.fileData;
                        const mainFile = cert.files?.[0] || { type: cert.fileType, data: cert.fileData };
                        const fileCount = cert.files?.length || (cert.fileData ? 1 : 0);
                        const linkCount = usageMap.get(cert.id) || 0;
                        const isExpanded = expandedMaterialCards.has(cert.id);

                        if (viewMode === 'list') {
                            return (
                                <div key={cert.id} className="border border-slate-200 rounded-lg p-3 hover:shadow-md transition-shadow bg-white flex items-center gap-4 cursor-pointer group" onClick={() => handleOpenModal(cert)}>
                                    <div className="p-2 bg-slate-100 rounded text-slate-500 cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePreview(cert); }}>
                                        <CertificateIcon className="w-6 h-6" />
                                    </div>
                                    <div className="flex-grow min-w-0">
                                         <h3 className="font-bold text-slate-800 text-sm truncate">
                                            <HighlightMatch text={cert.number} query={searchQuery} />
                                         </h3>
                                         <p className="text-xs text-slate-500">Дата: {new Date(cert.validUntil).toLocaleDateString()}</p>
                                    </div>
                                    <div className="text-xs text-slate-500 truncate w-1/4">
                                        {cert.materials.map((m, i) => (
                                            <span key={i}>
                                                {i > 0 && ', '}
                                                <HighlightMatch text={m} query={searchQuery} />
                                            </span>
                                        ))}
                                    </div>
                                    
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {linkCount > 0 && (
                                            <button 
                                                className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-full text-xs font-medium border border-blue-100 hover:bg-blue-100 transition-all mr-1" 
                                                onClick={(e) => handleManageLinks(e, cert)}
                                                title="Управление связями"
                                            >
                                                <LinkIcon className="w-3 h-3" /> {linkCount}
                                            </button>
                                        )}
                                        <button onClick={(e) => handleClickDelete(e, cert)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Удалить"><DeleteIcon className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            );
                        }

                        // Card View (Default)
                        return (
                        <div 
                            key={cert.id} 
                            className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white flex flex-col h-full cursor-pointer relative group"
                            onClick={() => handleOpenModal(cert)}
                        >
                            {/* Thumbnail Section */}
                            <div 
                                className="h-40 bg-slate-200 border-b border-slate-100 flex items-center justify-center cursor-pointer relative overflow-hidden"
                                onClick={(e) => { e.stopPropagation(); handlePreview(cert); }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    if(mainFile.data) openInNewTab(mainFile.data);
                                }}
                                title="Нажмите для предпросмотра, дважды для открытия в новой вкладке"
                            >
                                {hasFiles ? (
                                    mainFile.type === 'image' ? (
                                        <img src={mainFile.data} alt={cert.number} className="w-full h-full object-contain bg-slate-200" />
                                    ) : (
                                        <div className="w-full h-full relative pointer-events-none">
                                            {/* Pointer events none to allow clicking the div container */}
                                            <object data={mainFile.data} type="application/pdf" className="w-full h-full opacity-80" tabIndex={-1}>
                                                <div className="flex items-center justify-center h-full">
                                                    <CertificateIcon className="w-12 h-12 text-red-400" />
                                                </div>
                                            </object>
                                            <div className="absolute inset-0 bg-transparent"></div>
                                        </div>
                                    )
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <CertificateIcon className="w-10 h-10 mb-1 opacity-50" />
                                        <span className="text-xs">Нет файла</span>
                                    </div>
                                )}
                                
                                {fileCount > 1 && (
                                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                                        <CloudUploadIcon className="w-3 h-3" /> {fileCount}
                                    </div>
                                )}
                                
                                <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-opacity flex items-center justify-center pointer-events-none">
                                    <span className="opacity-0 group-hover:opacity-100 bg-white/90 px-3 py-1 rounded-full text-xs font-medium shadow-sm">
                                        Редактировать
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 flex flex-col flex-grow">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-sm leading-tight mb-1">
                                            <HighlightMatch text={cert.number} query={searchQuery} />
                                        </h3>
                                        <p className="text-xs text-slate-500">Дата: {new Date(cert.validUntil).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-1 ml-2">
                                        {linkCount > 0 && (
                                            <button 
                                                className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-full text-xs font-medium border border-blue-100 hover:bg-blue-100 transition-all mr-1"
                                                onClick={(e) => handleManageLinks(e, cert)}
                                                title={`Используется в ${linkCount} актах`}
                                            >
                                                <LinkIcon className="w-3 h-3" /> {linkCount}
                                            </button>
                                        )}
                                        <button onClick={(e) => handleClickDelete(e, cert)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Удалить"><DeleteIcon className="w-4 h-4"/></button>
                                    </div>
                                </div>
                                
                                <div 
                                    className="flex-grow cursor-pointer group/materials hover:bg-blue-50 hover:shadow-sm rounded-md transition-all duration-200 p-1 -m-1" 
                                    onClick={(e) => toggleMaterialsExpand(e, cert.id)}
                                    title="Нажмите, чтобы развернуть/свернуть список материалов"
                                >
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex justify-between items-center group-hover/materials:text-blue-500 transition-colors">
                                        Материалы:
                                        <ChevronDownIcon className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </p>
                                    <ul className="text-xs text-slate-700 space-y-1">
                                        {(isExpanded ? cert.materials : cert.materials.slice(0, 3)).map((m, i) => (
                                            <li key={i} className="truncate border-l-2 border-blue-100 pl-2 group-hover/materials:border-blue-300">
                                                <HighlightMatch text={m} query={searchQuery} />
                                            </li>
                                        ))}
                                        {!isExpanded && cert.materials.length > 3 && (
                                            <li className="text-slate-400 pl-2 italic">...и еще {cert.materials.length - 3}</li>
                                        )}
                                        {cert.materials.length === 0 && <li className="text-slate-400 italic pl-2">Список пуст</li>}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )})}
                    {filteredCertificates.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                             <CertificateIcon className="w-16 h-16 mb-4 opacity-20" />
                             <p>Ничего не найдено.</p>
                        </div>
                    )}
                 </div>
            </div>

            <Modal 
                isOpen={isModalOpen} 
                onClose={handleCloseModal} 
                title={editingCert ? 'Редактировать сертификат' : 'Новый сертификат'}
                maxWidth="max-w-[90vw] lg:max-w-7xl"
                className="resize-x overflow-hidden"
            >
                <CertificateForm certificate={editingCert} settings={settings} onSave={onSave} onClose={handleCloseModal} />
            </Modal>
            
            {/* Delete Warning Modal */}
            {deleteWarning && (
                <Modal 
                    isOpen={true} 
                    onClose={() => setDeleteWarning(null)} 
                    title="Удаление сертификата"
                >
                    <div className="space-y-4">
                        <p className="text-slate-700">
                            Сертификат <strong>{deleteWarning.cert.number}</strong> используется в <strong>{deleteWarning.usedInActs.length}</strong> актах.
                        </p>
                        <p className="text-sm text-slate-600">
                            Если вы удалите сертификат, ссылки на него в актах могут стать некорректными. Выберите действие:
                        </p>
                        <div className="flex flex-col gap-3 pt-2">
                             <button 
                                onClick={() => handleConfirmDelete('remove_materials')} 
                                className="w-full flex items-start gap-3 bg-red-50 text-red-800 border border-red-200 p-3 rounded-md hover:bg-red-100 transition-colors text-left"
                            >
                                <DeleteIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-semibold text-sm">Удалить Сертификат и Строки материалов</div>
                                    <div className="text-xs opacity-75">Строки с упоминанием этого сертификата будут полностью удалены из всех актов.</div>
                                </div>
                            </button>

                             <button 
                                onClick={() => handleConfirmDelete('clean')} 
                                className="w-full flex items-start gap-3 bg-white border border-slate-300 p-3 rounded-md hover:bg-slate-50 transition-colors text-left"
                            >
                                <div className="p-0.5 bg-slate-200 rounded text-slate-600"><CloseIcon className="w-4 h-4" /></div>
                                <div>
                                    <div className="font-semibold text-sm text-slate-800">Удалить Сертификат и Ссылки</div>
                                    <div className="text-xs text-slate-500">Сертификат удаляется. В актах останутся названия материалов, но исчезнет текст "(сертификат №...)".</div>
                                </div>
                            </button>

                            <button 
                                onClick={() => handleConfirmDelete('default')} 
                                className="w-full flex items-start gap-3 bg-white border border-slate-300 p-3 rounded-md hover:bg-slate-50 transition-colors text-left"
                            >
                                <div className="p-0.5 bg-slate-200 rounded text-slate-600"><CheckIcon className="w-4 h-4" /></div>
                                <div>
                                    <div className="font-semibold text-sm text-slate-800">Удалить Сертификат, Оставить текст</div>
                                    <div className="text-xs text-slate-500">Сертификат удаляется из базы. Текст в актах не меняется (останется как "мертвый" текст).</div>
                                </div>
                            </button>

                            <button 
                                onClick={() => setDeleteWarning(null)} 
                                className="w-full text-slate-500 hover:text-slate-800 text-sm py-2 mt-2"
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Manage Links Modal */}
            {manageLinksCert && (
                <Modal 
                    isOpen={true} 
                    onClose={() => setManageLinksCert(null)} 
                    title={`Использование сертификата № ${manageLinksCert.cert.number}`}
                >
                    <div className="space-y-4">
                        <div className="bg-slate-50 border border-slate-200 rounded p-3 text-sm max-h-48 overflow-y-auto">
                            <ul className="list-disc pl-5 space-y-1">
                                {manageLinksCert.usedInActs.map((act) => (
                                    <li key={act.id}>Акт № {act.number}</li>
                                ))}
                            </ul>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            <h4 className="text-sm font-semibold text-slate-700">Действия со связями:</h4>
                            <button 
                                onClick={() => handleUnlinkFromManager('remove_reference')} 
                                className="w-full flex items-center gap-3 bg-white border border-slate-300 p-3 rounded-md hover:bg-slate-50 text-left text-sm"
                            >
                                <LinkIcon className="w-5 h-5 text-slate-400" />
                                <div>
                                    <div className="font-medium text-slate-800">Отвязать (Убрать упоминание сертификата)</div>
                                    <div className="text-xs text-slate-500">В актах останутся названия материалов, удалится только "(сертификат №...)"</div>
                                </div>
                            </button>
                            
                            <button 
                                onClick={() => handleUnlinkFromManager('remove_entry')} 
                                className="w-full flex items-center gap-3 bg-white border border-red-200 p-3 rounded-md hover:bg-red-50 text-left text-sm"
                            >
                                <DeleteIcon className="w-5 h-5 text-red-400" />
                                <div>
                                    <div className="font-medium text-red-800">Удалить материалы из актов</div>
                                    <div className="text-xs text-red-600">Строки с этими материалами будут полностью удалены из актов</div>
                                </div>
                            </button>
                        </div>
                        
                        <div className="flex justify-end pt-2">
                            <button onClick={() => setManageLinksCert(null)} className="text-slate-500 hover:text-slate-700 text-sm px-4 py-2">
                                Закрыть
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {previewFile && (
                <Modal isOpen={!!previewFile} onClose={() => setPreviewFile(null)} title="Просмотр документа" maxWidth="max-w-6xl">
                    <div className="h-[75vh] w-full flex items-center justify-center bg-slate-100 rounded overflow-hidden">
                        {previewFile.type === 'pdf' ? (
                            <iframe src={previewFile.data} className="w-full h-full" title="PDF Preview" />
                        ) : (
                            <ImageViewer src={previewFile.data} alt="Certificate Preview" />
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default CertificatesPage;
