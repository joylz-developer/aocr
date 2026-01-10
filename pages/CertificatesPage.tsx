
import React, { useState, useRef, useEffect } from 'react';
import { Certificate, ProjectSettings } from '../types';
import Modal from '../components/Modal';
import { PlusIcon, DeleteIcon, EditIcon, CertificateIcon, CloseIcon, CloudUploadIcon, SparklesIcon } from '../components/Icons';
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

// --- Image Viewer Component with Pan & Zoom ---
const ImageViewer: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const imgRef = useRef<HTMLDivElement>(null);

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
    const [formData, setFormData] = useState<Certificate>(
        certificate || {
            id: crypto.randomUUID(),
            number: '',
            validUntil: '',
            fileType: undefined,
            fileName: '',
            fileData: '',
            materials: []
        }
    );
    const [newMaterial, setNewMaterial] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiSuggestions, setAiSuggestions] = useState<AiSuggestions | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const ai = settings.geminiApiKey ? new GoogleGenAI({ apiKey: settings.geminiApiKey }) : null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const processFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (typeof event.target?.result === 'string') {
                setFormData(prev => ({
                    ...prev,
                    fileName: file.name,
                    fileType: file.type.includes('pdf') ? 'pdf' : 'image',
                    fileData: event.target!.result as string
                }));
                setAiError(null);
                setAiSuggestions(null); // Reset suggestions on new file
            }
        };
        reader.readAsDataURL(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processFile(file);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        // Only disable if we are leaving the main container, not entering a child
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
            processFile(file);
        } else {
            alert('Пожалуйста, загрузите изображение или PDF файл.');
        }
    };

    const handleAiScan = async () => {
        if (!formData.fileData || !ai) return;
        setIsScanning(true);
        setAiError(null);
        setAiSuggestions(null);

        try {
            const [mimeType, base64Data] = formData.fileData.split(',');
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
            
            // Set suggestions instead of overwriting form data immediately
            setAiSuggestions({
                number: result.number,
                validUntil: result.validUntil,
                materials: Array.isArray(result.materials) ? result.materials : []
            });

        } catch (error) {
            console.error("AI Scan Error:", error);
            setAiError("Не удалось распознать данные. Убедитесь, что API ключ верен и файл содержит текст.");
        } finally {
            setIsScanning(false);
        }
    };

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
        setFormData(prev => ({
            ...prev,
            materials: prev.materials.filter((_, i) => i !== index)
        }));
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
        onSave(formData);
        onClose();
    };

    const inputClass = "mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900";
    const labelClass = "block text-sm font-medium text-slate-700";

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-[80vh] md:h-[70vh]">
            
            <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
                {/* LEFT COLUMN: Document Preview */}
                <div 
                    className={`w-full md:w-1/2 flex flex-col h-full min-h-0 bg-slate-50 rounded-lg border-2 transition-colors relative
                        ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}
                    `}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="p-3 border-b border-slate-200 bg-white rounded-t-lg flex justify-between items-center z-10">
                        <span className="font-semibold text-slate-700">Документ</span>
                        <button 
                            type="button" 
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs text-blue-600 hover:underline"
                        >
                            {formData.fileData ? 'Заменить файл' : 'Загрузить файл'}
                        </button>
                    </div>
                    
                    <div className="flex-grow overflow-hidden relative flex items-center justify-center p-2">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,image/*" />
                        
                        {formData.fileData ? (
                            formData.fileType === 'image' ? (
                                <ImageViewer src={formData.fileData} alt="Preview" />
                            ) : (
                                <object data={formData.fileData} type="application/pdf" className="w-full h-full rounded-md shadow-inner">
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <p>PDF Preview не поддерживается.</p>
                                    </div>
                                </object>
                            )
                        ) : (
                            <div className="text-center p-6 pointer-events-none">
                                <CloudUploadIcon className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                                <p className="text-sm text-slate-500">Перетащите файл сюда</p>
                            </div>
                        )}

                        {/* Drag Overlay */}
                        {isDragging && (
                            <div className="absolute inset-0 bg-blue-100/90 flex flex-col items-center justify-center z-20 border-2 border-blue-500 border-dashed rounded-lg animate-fade-in-up">
                                <CloudUploadIcon className="w-16 h-16 text-blue-600 mb-2" />
                                <span className="text-lg font-bold text-blue-700">Отпустите, чтобы заменить файл</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Form Fields */}
                <div className="w-full md:w-1/2 flex flex-col h-full min-h-0 overflow-y-auto pr-1">
                    
                    {/* AI Button */}
                    {ai && formData.fileData && (
                        <div className="mb-6 flex flex-col">
                            <button
                                type="button"
                                onClick={handleAiScan}
                                disabled={isScanning}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white px-4 py-2.5 rounded-lg hover:from-violet-600 hover:to-fuchsia-700 disabled:opacity-70 transition-all shadow-sm font-medium"
                            >
                                <SparklesIcon className="w-5 h-5" />
                                {isScanning ? 'Анализ документа...' : 'Сканировать через AI'}
                            </button>
                            {aiError && <p className="text-red-500 text-xs mt-2">{aiError}</p>}
                        </div>
                    )}

                    <div className="space-y-5">
                        {/* Number Field */}
                        <div>
                            <label className={labelClass}>Номер (тип + №)</label>
                            <input type="text" name="number" value={formData.number} onChange={handleChange} className={inputClass} required placeholder="Паспорт качества № 123" />
                            {aiSuggestions?.number && aiSuggestions.number !== formData.number && (
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
                            <input type="date" name="validUntil" value={formData.validUntil} onChange={handleChange} className={inputClass} required />
                            {aiSuggestions?.validUntil && aiSuggestions.validUntil !== formData.validUntil && (
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
                            <label className={labelClass}>Материалы</label>
                            
                            {/* AI Materials Suggestions */}
                            {aiSuggestions?.materials && aiSuggestions.materials.length > 0 && (
                                <div className="mb-4 bg-violet-50 border border-violet-100 rounded-md p-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-xs text-violet-700 font-bold flex items-center"><SparklesIcon className="w-3 h-3 mr-1"/> Найдено в документе</p>
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
                                    <div className="flex flex-wrap gap-2">
                                        {aiSuggestions.materials.map((mat, idx) => (
                                            !formData.materials.includes(mat) && (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => handleAddMaterial(mat)}
                                                    className="text-xs bg-white border border-violet-200 text-slate-700 px-2 py-1 rounded-full hover:border-violet-400 hover:text-violet-700 text-left max-w-full truncate"
                                                    title="Нажмите, чтобы добавить"
                                                >
                                                    + {mat}
                                                </button>
                                            )
                                        ))}
                                        {aiSuggestions.materials.every(m => formData.materials.includes(m)) && (
                                            <span className="text-xs text-slate-400 italic">Все материалы добавлены</span>
                                        )}
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
                                />
                                <button 
                                    type="button" 
                                    onClick={handleManualAddMaterial}
                                    className="mt-1 px-4 py-2 bg-slate-100 text-slate-700 border border-slate-300 rounded-md hover:bg-slate-200"
                                >
                                    <PlusIcon className="w-5 h-5"/>
                                </button>
                            </div>

                            {/* Editable List */}
                            <div className="space-y-2">
                                {formData.materials.length === 0 && <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded">Список материалов пуст</p>}
                                {formData.materials.map((mat, idx) => (
                                    <div key={idx} className="flex items-center gap-2 group">
                                        <input
                                            type="text"
                                            value={mat}
                                            onChange={(e) => handleEditMaterial(idx, e.target.value)}
                                            className="block w-full text-sm border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded bg-slate-50 focus:bg-white transition-colors py-1.5 px-2"
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemoveMaterial(idx)} 
                                            className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100"
                                            title="Удалить"
                                        >
                                            <CloseIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6 mt-auto border-t border-slate-200 bg-white">
                <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">Отмена</button>
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium">Сохранить</button>
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
        if (cert.fileData && cert.fileType) {
            setPreviewFile({ type: cert.fileType, data: cert.fileData });
        } else {
            alert("Файл не загружен для этого сертификата.");
        }
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
                    {certificates.map(cert => (
                        <div key={cert.id} className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white flex flex-col h-full">
                            {/* Thumbnail Section */}
                            <div 
                                className="h-40 bg-slate-100 border-b border-slate-100 flex items-center justify-center cursor-pointer relative overflow-hidden group"
                                onClick={() => handlePreview(cert)}
                            >
                                {cert.fileData ? (
                                    cert.fileType === 'image' ? (
                                        <img src={cert.fileData} alt={cert.number} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full relative pointer-events-none">
                                            {/* Pointer events none to allow clicking the div container */}
                                            <object data={cert.fileData} type="application/pdf" className="w-full h-full opacity-80" tabIndex={-1}>
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
                    ))}
                    {certificates.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                             <CertificateIcon className="w-16 h-16 mb-4 opacity-20" />
                             <p>База сертификатов пуста.</p>
                        </div>
                    )}
                 </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingCert ? 'Редактировать сертификат' : 'Новый сертификат'}>
                <CertificateForm certificate={editingCert} settings={settings} onSave={onSave} onClose={handleCloseModal} />
            </Modal>

            {previewFile && (
                <Modal isOpen={!!previewFile} onClose={() => setPreviewFile(null)} title="Просмотр документа">
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
