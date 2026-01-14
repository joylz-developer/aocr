
import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { Certificate, ProjectSettings, CertificateFile } from '../types';
import Modal from '../components/Modal';
import { PlusIcon, DeleteIcon, EditIcon, CertificateIcon, CloseIcon, CloudUploadIcon, SparklesIcon, RestoreIcon } from '../components/Icons';
import { GoogleGenAI } from '@google/genai';

interface CertificatesPageProps {
    certificates: Certificate[];
    settings: ProjectSettings;
    onSave: (cert: Certificate) => void;
    onDelete: (id: string) => void;
}

// Type for AI Suggestions
interface AiSuggestions {
    number?: string;
    validUntil?: string;
    materials?: string[];
}

// --- Helper Components ---

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
            return { ...certificate, files: existingFiles };
        } else {
            return {
                id: crypto.randomUUID(),
                number: '',
                validUntil: '',
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
    
    // Mass Edit AI States
    const [massEditPrompt, setMassEditPrompt] = useState('');
    const [isMassEditing, setIsMassEditing] = useState(false);
    const [previewMaterials, setPreviewMaterials] = useState<string[] | null>(null);

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

    const processFiles = (files: FileList) => {
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (typeof event.target?.result === 'string') {
                    const newFile: CertificateFile = {
                        id: crypto.randomUUID(),
                        name: file.name,
                        type: file.type.includes('pdf') ? 'pdf' : 'image',
                        data: event.target.result as string
                    };
                    
                    setFormData(prev => ({
                        ...prev,
                        files: [...prev.files, newFile]
                    }));
                    setActiveFileId(newFile.id);
                    setAiError(null);
                }
            };
            reader.readAsDataURL(file);
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

    const handleDeleteFile = (e: React.MouseEvent, fileId: string) => {
        e.stopPropagation();
        if (confirm("Удалить этот файл?")) {
            setFormData(prev => {
                const newFiles = prev.files.filter(f => f.id !== fileId);
                // If we deleted the active file, switch to another
                if (fileId === activeFileId) {
                    setActiveFileId(newFiles.length > 0 ? newFiles[newFiles.length - 1].id : null);
                }
                return { ...prev, files: newFiles };
            });
        }
    };

    const handleAiScan = async () => {
        if (!activeFile || !ai) return;
        setIsScanning(true);
        setAiError(null);
        setAiSuggestions(null);

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
                    "number": "${promptNumber}",
                    "validUntil": "${promptDate}",
                    "materials": ["${promptMaterials}"]
                }
                
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
            
            setAiSuggestions({
                number: result.number,
                validUntil: result.validUntil,
                materials: Array.isArray(result.materials) ? result.materials : []
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
        setPreviewMaterials(null);

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
            const result = JSON.parse(text);

            if (Array.isArray(result)) {
                setPreviewMaterials(result);
            }
        } catch (e) {
            alert("Ошибка при обработке AI. Попробуйте другой запрос.");
            console.error(e);
            setPreviewMaterials(null);
        } finally {
            setIsMassEditing(false);
        }
    };

    const handleCancelMassEdit = () => {
        setPreviewMaterials(null);
        setMassEditPrompt('');
    };

    const handleCommitMassEdit = () => {
        if (previewMaterials) {
            setFormData(prev => ({ ...prev, materials: previewMaterials }));
            setPreviewMaterials(null);
            setMassEditPrompt('');
        }
    };

    // --- Material List Logic ---

    const handleAddMaterial = (materialName: string) => {
        const nameToAdd = materialName.trim();
        if (!nameToAdd) return;
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

    // --- Computed Views for AI Diff ---
    
    const displayedMaterials = useMemo(() => {
        if (!previewMaterials) return formData.materials.map(m => ({ text: m, status: 'current' }));

        const result: { text: string, status: 'current' | 'added' | 'removed' }[] = [];
        
        // Items in preview (either kept or added)
        previewMaterials.forEach(item => {
            if (formData.materials.includes(item)) {
                result.push({ text: item, status: 'current' });
            } else {
                result.push({ text: item, status: 'added' });
            }
        });

        // Items in original but not in preview (deleted)
        formData.materials.forEach(item => {
            if (!previewMaterials.includes(item)) {
                result.push({ text: item, status: 'removed' });
            }
        });

        return result;
    }, [formData.materials, previewMaterials]);


    const inputClass = "mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900";
    const labelClass = "block text-sm font-medium text-slate-700";

    // Helper to check if AI suggestions are already all added
    const areAllSuggestionsAdded = aiSuggestions?.materials?.every(m => formData.materials.includes(m));
    const isPreviewMode = !!previewMaterials;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-[85vh]">
            
            <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
                {/* LEFT COLUMN: Document Preview Gallery */}
                <div className="w-full md:w-3/5 flex flex-col h-full min-h-0 gap-2">
                    <div 
                        className={`flex-grow flex flex-col bg-slate-50 rounded-lg border-2 transition-colors relative overflow-hidden
                            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}
                        `}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
                            <span className="font-semibold text-white drop-shadow-md pointer-events-auto">
                                {activeFile ? activeFile.name : 'Нет файла'}
                            </span>
                            {activeFile && (
                                <button
                                    type="button"
                                    onClick={(e) => handleDeleteFile(e, activeFile.id)}
                                    className="p-1.5 bg-red-600/80 text-white rounded-full hover:bg-red-700 pointer-events-auto shadow-sm"
                                    title="Удалить текущий файл"
                                >
                                    <DeleteIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        
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
                                        onClick={(e) => handleDeleteFile(e, file.id)}
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
                </div>

                {/* RIGHT COLUMN: Form Fields */}
                <div className="w-full md:w-2/5 flex flex-col h-full min-h-0">
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
                            {aiSuggestions?.number && aiSuggestions.number !== formData.number && !isPreviewMode && (
                                <div 
                                    onClick={() => applyAiSuggestion('number', aiSuggestions.number!)}
                                    className="mt-2 cursor-pointer bg-violet-50 border border-violet-100 p-2 rounded-md hover:bg-violet-100 transition-colors group"
                                >
                                    <p className="text-xs text-violet-600 font-semibold mb-0.5 flex items-center">
                                        <SparklesIcon className="w-3 h-3 mr-1"/> Предложение AI
                                    </p>
                                    <p className="text-sm text-slate-700">{aiSuggestions.number}</p>
                                </div>
                            )}
                        </div>

                        {/* Date Field */}
                        <div>
                            <label className={labelClass}>Дата документа</label>
                            <input type="date" name="validUntil" value={formData.validUntil} onChange={handleChange} className={inputClass} required disabled={isPreviewMode} />
                            {aiSuggestions?.validUntil && aiSuggestions.validUntil !== formData.validUntil && !isPreviewMode && (
                                <div 
                                    onClick={() => applyAiSuggestion('validUntil', aiSuggestions.validUntil!)}
                                    className="mt-2 cursor-pointer bg-violet-50 border border-violet-100 p-2 rounded-md hover:bg-violet-100 transition-colors group"
                                >
                                    <p className="text-xs text-violet-600 font-semibold mb-0.5 flex items-center">
                                        <SparklesIcon className="w-3 h-3 mr-1"/> Предложение AI
                                    </p>
                                    <p className="text-sm text-slate-700">{new Date(aiSuggestions.validUntil).toLocaleDateString()}</p>
                                </div>
                            )}
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
                            
                            {/* AI Materials Suggestions */}
                            {aiSuggestions?.materials && aiSuggestions.materials.length > 0 && !areAllSuggestionsAdded && !isPreviewMode && (
                                <div className="mb-4 bg-violet-50 border border-violet-100 rounded-md p-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-xs text-violet-700 font-bold flex items-center"><SparklesIcon className="w-3 h-3 mr-1"/> Найдено в документе</p>
                                        <div className="flex gap-2">
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
                                                Добавить все
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
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

                            {/* Manual Add Input */}
                            <div className="flex gap-2 mt-1 mb-3">
                                <input 
                                    type="text" 
                                    value={newMaterial} 
                                    onChange={e => setNewMaterial(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleManualAddMaterial())}
                                    className={inputClass} 
                                    placeholder="Введите название и нажмите Enter" 
                                    disabled={isPreviewMode}
                                />
                                <button 
                                    type="button" 
                                    onClick={handleManualAddMaterial}
                                    disabled={isPreviewMode}
                                    className="mt-1 px-4 py-2 bg-slate-100 text-slate-700 border border-slate-300 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <PlusIcon className="w-5 h-5"/>
                                </button>
                            </div>
                            
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
                                {displayedMaterials.length === 0 && <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded">Список материалов пуст</p>}
                                {displayedMaterials.map((item, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`flex items-start gap-1 group py-1 px-1 rounded transition-colors 
                                            ${hoveredDeleteIndex === idx && !isPreviewMode ? 'bg-red-50' : ''}
                                            ${item.status === 'added' ? 'bg-green-100 border border-green-200' : ''}
                                            ${item.status === 'removed' ? 'bg-red-100 border border-red-200 opacity-70' : ''}
                                        `}
                                    >
                                        <AutoResizeTextarea
                                            value={item.text}
                                            onChange={(e) => handleEditMaterial(idx, e.target.value)}
                                            disabled={isPreviewMode || item.status === 'removed'}
                                            className={`block w-full text-sm border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded focus:bg-white transition-colors py-1 px-2
                                                ${item.status !== 'current' ? 'bg-transparent border-transparent' : 'bg-slate-50'}
                                            `}
                                        />
                                        {!isPreviewMode && item.status === 'current' && (
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
                                        )}
                                        {isPreviewMode && item.status === 'added' && <div className="p-1.5 mt-0.5 text-green-600 font-bold text-xs" title="Будет добавлено">+</div>}
                                        {isPreviewMode && item.status === 'removed' && <div className="p-1.5 mt-0.5 text-red-600 font-bold text-xs" title="Будет удалено">-</div>}
                                    </div>
                                ))}
                            </div>
                            
                            {/* Mass AI Edit Section */}
                            {formData.materials.length > 0 && ai && (
                                <div className="mt-6 pt-4 border-t border-slate-200">
                                    {!previewMaterials ? (
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
                                            <p className="text-xs text-violet-800 mb-2 font-medium">Предварительный просмотр изменений. Сохранить?</p>
                                            <div className="flex gap-2">
                                                <button 
                                                    type="button" 
                                                    onClick={handleCommitMassEdit}
                                                    className="flex-1 bg-violet-600 text-white text-xs py-1.5 rounded hover:bg-violet-700"
                                                >
                                                    Сохранить
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={handleCancelMassEdit}
                                                    className="flex-1 bg-white border border-slate-300 text-slate-700 text-xs py-1.5 rounded hover:bg-slate-50"
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
    );
};

const CertificatesPage: React.FC<CertificatesPageProps> = ({ certificates, settings, onSave, onDelete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCert, setEditingCert] = useState<Certificate | null>(null);
    const [previewFile, setPreviewFile] = useState<{ type: 'pdf' | 'image', data: string } | null>(null);

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

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold text-slate-800">Сертификаты и Паспорта</h1>
                <button onClick={() => handleOpenModal()} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    <PlusIcon /> Добавить сертификат
                </button>
            </div>

            <div className="flex-grow overflow-auto">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {certificates.map(cert => {
                        const hasFiles = (cert.files && cert.files.length > 0) || !!cert.fileData;
                        const mainFile = cert.files?.[0] || { type: cert.fileType, data: cert.fileData };
                        const fileCount = cert.files?.length || (cert.fileData ? 1 : 0);

                        return (
                        <div key={cert.id} className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white flex flex-col h-full">
                            {/* Thumbnail Section */}
                            <div 
                                className="h-40 bg-slate-100 border-b border-slate-100 flex items-center justify-center cursor-pointer relative overflow-hidden group"
                                onClick={() => handlePreview(cert)}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    if(mainFile.data) openInNewTab(mainFile.data);
                                }}
                                title="Нажмите для предпросмотра, дважды для открытия в новой вкладке"
                            >
                                {hasFiles ? (
                                    mainFile.type === 'image' ? (
                                        <img src={mainFile.data} alt={cert.number} className="w-full h-full object-cover" />
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
                                
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity flex items-center justify-center">
                                    <span className="opacity-0 group-hover:opacity-100 bg-white/90 px-3 py-1 rounded-full text-xs font-medium shadow-sm">
                                        Просмотр
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 flex flex-col flex-grow">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-sm leading-tight mb-1">{cert.number}</h3>
                                        <p className="text-xs text-slate-500">Дата: {new Date(cert.validUntil).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex gap-1 ml-2">
                                        <button onClick={() => handleOpenModal(cert)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Редактировать"><EditIcon className="w-4 h-4"/></button>
                                        <button onClick={() => onDelete(cert.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Удалить"><DeleteIcon className="w-4 h-4"/></button>
                                    </div>
                                </div>
                                
                                <div className="flex-grow">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Материалы:</p>
                                    <ul className="text-xs text-slate-700 space-y-1">
                                        {cert.materials.slice(0, 3).map((m, i) => (
                                            <li key={i} className="truncate border-l-2 border-blue-100 pl-2">{m}</li>
                                        ))}
                                        {cert.materials.length > 3 && (
                                            <li className="text-slate-400 pl-2 italic">...и еще {cert.materials.length - 3}</li>
                                        )}
                                        {cert.materials.length === 0 && <li className="text-slate-400 italic pl-2">Список пуст</li>}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )})}
                    {certificates.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                             <CertificateIcon className="w-16 h-16 mb-4 opacity-20" />
                             <p>База сертификатов пуста.</p>
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
