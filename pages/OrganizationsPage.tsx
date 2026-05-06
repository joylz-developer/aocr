import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Organization, ConstructionObject, ProjectSettings } from '../types';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import { DeleteIcon, PlusIcon, CloseIcon, CloudUploadIcon, SparklesIcon, CopyIcon, MinimizeIcon, MaximizeIcon } from '../components/Icons';
import { generateContent } from '../services/aiService';
import ObjectResourceImporter from '../components/ObjectResourceImporter';

interface OrganizationsPageProps {
    organizations: Organization[];
    allOrganizations: Organization[];
    constructionObjects: ConstructionObject[];
    currentObjectId: string | null;
    settings: ProjectSettings;
    onSave: (org: Organization) => void;
    onDelete: (id: string) => void;
    onImport: (items: Organization[]) => void;
}

const SpinnerIcon = ({ className = "w-4 h-4" }) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

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
        e.stopPropagation();
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
        <div className="relative w-full h-full overflow-hidden bg-slate-100 rounded-lg group select-none">
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

const AutoResizeTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
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

const OrganizationForm: React.FC<{
    org: Organization | null;
    settings: ProjectSettings;
    onSave: (org: Organization) => void;
    onClose: () => void;
}> = ({ org, settings, onSave, onClose }) => {
    const [formData, setFormData] = useState<Organization>(
        org || { id: crypto.randomUUID(), name: '', ogrn: '', inn: '', kpp: '', address: '', phone: '', sro: '' }
    );
    const [fileData, setFileData] = useState<{ type: 'image' | 'pdf', data: string, name: string } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    
    // Состояние для точечного сканирования
    const [scanningField, setScanningField] = useState<'all' | 'name' | 'inn' | 'ogrn' | 'kpp' | 'address' | 'phone' | 'sro' | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isGalleryCollapsed, setIsGalleryCollapsed] = useState(false);

    const isAiConfigured = settings.activeAiModelId 
        ? !!settings.aiModels?.find(m => m.id === settings.activeAiModelId)?.apiKey
        : (settings.aiModel === 'gemini-2.5-flash' ? !!settings.geminiApiKey : !!settings.openAiApiKey);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const processFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (typeof event.target?.result === 'string') {
                const data = event.target.result;
                const isPdf = file.type.includes('pdf');
                setFileData({
                    type: isPdf ? 'pdf' : 'image',
                    data: data,
                    name: file.name
                });
                setAiError(null);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleClearFile = () => {
        setFileData(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ОБНОВЛЕНО: Используем настройки промпта и поддерживаем выбор конкретного поля
    const handleAiScan = async (targetField: 'all' | 'name' | 'inn' | 'ogrn' | 'kpp' | 'address' | 'phone' | 'sro' = 'all') => {
        if (!fileData || !isAiConfigured) return;
        setScanningField(targetField);
        setAiError(null);

        try {
            const [mimeType, base64Data] = fileData.data.split(',');
            const cleanMimeType = mimeType.match(/:(.*?);/)?.[1];
            if (!cleanMimeType || !base64Data) throw new Error("Invalid file data");
            
            // Базовый промпт берем из настроек
            const defaultPrompt = `Analyze the provided document image. This is an official organization document. Extract: 1. "name", 2. "ogrn", 3. "inn", 4. "kpp", 5. "address", 6. "phone", 7. "sro". Return ONLY valid JSON.`;
            const basePrompt = settings.organizationExtractionPrompt || defaultPrompt;

            let finalPrompt = "";
            if (targetField === 'all') {
                finalPrompt = basePrompt;
            } else {
                const specificPrompts = {
                    name: `"name": Extract the full organization name. IMPORTANT: Apply the same formatting rules as the main prompt (e.g. shorten OOO, ZAO).`,
                    inn: `"inn": Extract the INN (Taxpayer Identification Number).`,
                    ogrn: `"ogrn": Extract the OGRN (Primary State Registration Number).`,
                    kpp: `"kpp": Extract the KPP (Tax Registration Reason Code).`,
                    address: `"address": Extract the legal or postal address.`,
                    phone: `"phone": Extract the contact phone or fax number.`,
                    sro: `"sro": Extract information about SRO membership.`
                };
                
                finalPrompt = `
Analyze the provided document image. This is an official organization document.
Context/Rules: ${basePrompt}

Your task is to extract ONLY the requested specific information and return it in a valid JSON object:
1. ${specificPrompts[targetField]}

Format of the response:
Must be a valid JSON object with ONLY the key: "${targetField}".
Do not include any markdown formatting, code blocks, or additional text. Just the JSON.
                `.trim();
            }

            const response = await generateContent(settings, finalPrompt, cleanMimeType, base64Data, true);
            
            if (!response.text) throw new Error("Empty response from AI");
            const jsonStartIndex = response.text.indexOf('{');
            const jsonEndIndex = response.text.lastIndexOf('}');
            if (jsonStartIndex === -1 || jsonEndIndex === -1) throw new Error("JSON structure not found");
            
            const result = JSON.parse(response.text.substring(jsonStartIndex, jsonEndIndex + 1));
            
            setFormData(prev => ({
                ...prev,
                ...(targetField === 'all' || targetField === 'name' ? { name: result.name || prev.name } : {}),
                ...(targetField === 'all' || targetField === 'ogrn' ? { ogrn: result.ogrn || prev.ogrn } : {}),
                ...(targetField === 'all' || targetField === 'inn' ? { inn: result.inn || prev.inn } : {}),
                ...(targetField === 'all' || targetField === 'kpp' ? { kpp: result.kpp || prev.kpp } : {}),
                ...(targetField === 'all' || targetField === 'address' ? { address: result.address || prev.address } : {}),
                ...(targetField === 'all' || targetField === 'phone' ? { phone: result.phone || prev.phone } : {}),
                ...(targetField === 'all' || targetField === 'sro' ? { sro: result.sro || prev.sro } : {})
            }));
            
        } catch (error: any) {
            console.error("AI Scan Error:", error);
            setAiError(`Ошибка: ${error.message}`);
        } finally {
            setScanningField(null);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;
        onSave(formData);
        onClose();
    };

    const inputClass = "mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900 text-sm [.theme-dark_&]:[color-scheme:dark] [.theme-dark_&]:bg-[#0d1117] [.theme-dark_&]:border-slate-600 [.theme-dark_&]:text-slate-200";

    const FieldLabelWithAI: React.FC<{
        label: string;
        targetField: 'name' | 'inn' | 'ogrn' | 'kpp' | 'address' | 'phone' | 'sro';
        isRequired?: boolean;
    }> = ({ label, targetField, isRequired }) => (
        <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-slate-700 [.theme-dark_&]:text-slate-300">
                {label} {isRequired && <span className="text-red-500">*</span>}
            </label>
            {isAiConfigured && fileData && (
                <button
                    type="button"
                    onClick={() => handleAiScan(targetField)}
                    disabled={scanningField !== null}
                    className={`text-violet-500 hover:text-violet-700 transition-all p-1 rounded hover:bg-violet-50 [.theme-dark_&]:hover:bg-violet-900/30 flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={`Сканировать только поле "${label}"`}
                >
                    {scanningField === targetField ? <SpinnerIcon className="w-3.5 h-3.5" /> : <SparklesIcon className="w-3.5 h-3.5" />}
                    {scanningField === targetField ? 'Загрузка...' : 'AI'}
                </button>
            )}
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-[70vh]">
            <div className="flex flex-row gap-6 h-full min-h-0 relative">
                <div className={`flex flex-col h-full min-h-0 gap-2 transition-all duration-300 ease-in-out relative ${isGalleryCollapsed ? 'w-12' : 'w-full md:w-1/2'}`}>
                    <button type="button" onClick={() => setIsGalleryCollapsed(!isGalleryCollapsed)} className="absolute -right-3 top-2 z-30 bg-white [.theme-dark_&]:bg-slate-800 border border-slate-300 [.theme-dark_&]:border-slate-600 rounded-full p-1 shadow-md hover:bg-slate-50 [.theme-dark_&]:hover:bg-slate-700 text-slate-600 [.theme-dark_&]:text-slate-400">
                        {isGalleryCollapsed ? <MaximizeIcon className="w-4 h-4"/> : <MinimizeIcon className="w-4 h-4"/>}
                    </button>
                    
                    {!isGalleryCollapsed ? (
                        <>
                            <div className="flex justify-between items-center mb-2 px-1 min-h-[1.75rem]">
                                <span className="font-semibold text-slate-700 [.theme-dark_&]:text-slate-300 truncate pr-2">
                                    {fileData ? fileData.name : 'Реквизиты/Выписка (Скан)'}
                                </span>
                                {fileData && (
                                    <button type="button" onClick={handleClearFile} className="text-red-500 hover:text-red-700 bg-red-50 [.theme-dark_&]:bg-red-900/20 px-2 py-1 rounded text-xs transition-colors">
                                        Очистить
                                    </button>
                                )}
                            </div>
                            
                            <div className={`flex-grow flex flex-col bg-slate-50 [.theme-dark_&]:bg-[#161b22] rounded-lg border-2 transition-colors relative overflow-hidden ${isDragging ? 'border-blue-500 bg-blue-50 [.theme-dark_&]:bg-blue-900/20' : 'border-slate-200 [.theme-dark_&]:border-slate-700'}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                                <div className="flex-grow overflow-hidden relative flex items-center justify-center p-2">
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,image/*" />
                                    {fileData ? (
                                        fileData.type === 'image' ? (
                                            <ImageViewer src={fileData.data} alt="Preview" />
                                        ) : (
                                            <object data={fileData.data} type="application/pdf" className="w-full h-full rounded-md shadow-inner bg-white">
                                                <div className="flex flex-col items-center justify-center h-full text-slate-400">PDF Preview не поддерживается.</div>
                                            </object>
                                        )
                                    ) : (
                                        <div className="text-center p-6 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                            <CloudUploadIcon className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                                            <p className="text-slate-500 font-medium">Нажмите или перетащите файл</p>
                                        </div>
                                    )}
                                    {isDragging && (
                                        <div className="absolute inset-0 bg-blue-100/90 [.theme-dark_&]:bg-blue-900/90 flex flex-col items-center justify-center z-20 border-2 border-blue-500 border-dashed rounded-lg">
                                            <CloudUploadIcon className="w-16 h-16 text-blue-600 mb-2" />
                                            <span className="text-lg font-bold text-blue-700 [.theme-dark_&]:text-blue-400">Отпустите файл</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full bg-slate-100 [.theme-dark_&]:bg-[#161b22] rounded-lg border border-slate-200 [.theme-dark_&]:border-slate-700 flex flex-col items-center pt-8 gap-4 overflow-hidden">
                            <span className="vertical-rl text-xs text-slate-400 font-medium tracking-wider uppercase" style={{writingMode: 'vertical-rl'}}>Документ скрыт</span>
                        </div>
                    )}
                </div>

                <div className={`flex flex-col h-full min-h-0 transition-all duration-300 ${isGalleryCollapsed ? 'w-full pl-2' : 'w-full md:w-1/2'}`}>
                    <div className="overflow-y-auto pr-2 flex-grow space-y-4 pb-4">
                        <div>
                            <FieldLabelWithAI label="Полное наименование" targetField="name" isRequired />
                            <AutoResizeTextarea name="name" value={formData.name} onChange={handleChange} className={inputClass} required placeholder='ООО "Ромашка"' />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                                <FieldLabelWithAI label="ИНН" targetField="inn" />
                                <input type="text" name="inn" value={formData.inn} onChange={handleChange} className={inputClass} placeholder="1234567890" />
                            </div>
                            <div>
                                <FieldLabelWithAI label="ОГРН" targetField="ogrn" />
                                <input type="text" name="ogrn" value={formData.ogrn} onChange={handleChange} className={inputClass} placeholder="1234567890123" />
                            </div>
                            <div>
                                <FieldLabelWithAI label="КПП" targetField="kpp" />
                                <input type="text" name="kpp" value={formData.kpp || ''} onChange={handleChange} className={inputClass} placeholder="123456789" />
                            </div>
                        </div>
                        <div>
                            <FieldLabelWithAI label="Адрес" targetField="address" />
                            <AutoResizeTextarea name="address" value={formData.address} onChange={handleChange} className={inputClass} placeholder="123456, г. Москва, ул. Пушкина, д. 1" />
                        </div>
                        <div>
                            <FieldLabelWithAI label="Телефон / Факс" targetField="phone" />
                            <input type="text" name="phone" value={formData.phone || ''} onChange={handleChange} className={inputClass} placeholder="+7 (999) 123-45-67" />
                        </div>
                        <div>
                            <FieldLabelWithAI label="СРО (Сведения о членстве)" targetField="sro" />
                            <AutoResizeTextarea name="sro" value={formData.sro || ''} onChange={handleChange} className={inputClass} placeholder="Выписка из реестра членов СРО..." />
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-end pt-4 border-t border-slate-200 [.theme-dark_&]:border-slate-700 bg-white [.theme-dark_&]:bg-slate-800 mt-auto">
                        <div className="flex flex-col items-start max-w-[50%]">
                            {isAiConfigured && fileData && (
                                <>
                                    <button 
                                        type="button" 
                                        onClick={() => handleAiScan('all')} 
                                        disabled={scanningField !== null} 
                                        className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white px-4 py-2 rounded-md hover:from-violet-600 hover:to-fuchsia-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-sm font-medium"
                                    >
                                        {scanningField === 'all' ? <SpinnerIcon className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                                        {scanningField === 'all' ? 'Анализ документа...' : 'Сканировать всё (AI)'}
                                    </button>
                                    {aiError && <p className="text-red-500 text-xs mt-1 truncate w-full" title={aiError}>{aiError}</p>}
                                </>
                            )}
                        </div>
                        <div className="flex space-x-3 flex-shrink-0">
                            <button type="button" onClick={onClose} className="bg-slate-200 [.theme-dark_&]:bg-slate-700 text-slate-800 [.theme-dark_&]:text-slate-200 px-4 py-2 rounded-md hover:bg-slate-300 [.theme-dark_&]:hover:bg-slate-600 transition-colors">Отмена</button>
                            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium">Сохранить</button>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
};

const OrganizationsPage: React.FC<OrganizationsPageProps> = ({ organizations, allOrganizations, constructionObjects, currentObjectId, settings, onSave, onDelete, onImport }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
    const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);

    const handleOpenModal = (org: Organization | null = null) => {
        setEditingOrg(org);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingOrg(null);
        setIsModalOpen(false);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold text-slate-800">Организации</h1>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center bg-slate-100 text-slate-700 border border-slate-300 px-3 py-2 rounded-md hover:bg-slate-200 transition-colors"
                        title="Копировать организации из другого объекта"
                    >
                        <CopyIcon className="w-5 h-5 mr-1" /> Скопировать
                    </button>
                    <button onClick={() => handleOpenModal()} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                        <PlusIcon className="w-5 h-5 mr-2" /> Добавить организацию
                    </button>
                </div>
            </div>

            <div className="flex-grow overflow-auto border border-slate-200 rounded-md">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-1/4">Наименование</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-1/4">Реквизиты (ИНН/ОГРН/КПП)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-1/3">Адрес и СРО</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {organizations.length > 0 ? organizations.map(org => (
                            <tr key={org.id} className="hover:bg-slate-50 allow-text-selection">
                                <td className="px-6 py-4 text-sm font-medium text-slate-900 align-top">
                                    <div className="line-clamp-3" title={org.name}>{org.name}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 align-top">
                                    {org.inn && <div>ИНН: {org.inn}</div>}
                                    {org.ogrn && <div>ОГРН: {org.ogrn}</div>}
                                    {org.kpp && <div>КПП: {org.kpp}</div>}
                                    {!org.inn && !org.ogrn && <span className="text-slate-400 italic">Нет данных</span>}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 align-top">
                                    {org.address && <div className="mb-2 line-clamp-2" title={org.address}><span className="font-medium">Адрес:</span> {org.address}</div>}
                                    {org.phone && <div className="mb-2"><span className="font-medium">Тел:</span> {org.phone}</div>}
                                    {org.sro && <div className="line-clamp-2 text-xs" title={org.sro}><span className="font-medium">СРО:</span> {org.sro}</div>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium align-top">
                                    <div className="flex justify-end space-x-2">
                                        <button onClick={() => handleOpenModal(org)} className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full" title="Редактировать">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                        </button>
                                        <button onClick={() => setOrgToDelete(org)} className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full" title="Удалить">
                                            <DeleteIcon />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="text-center py-10 text-slate-500">
                                    Список организаций пуст.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingOrg ? 'Редактировать организацию' : 'Новая организация'} maxWidth="max-w-[90vw] lg:max-w-6xl">
                <OrganizationForm
                    org={editingOrg}
                    settings={settings}
                    onSave={onSave}
                    onClose={handleCloseModal}
                />
            </Modal>

            {orgToDelete && (
                <ConfirmationModal
                    isOpen={!!orgToDelete}
                    onClose={() => setOrgToDelete(null)}
                    onConfirm={() => {
                        onDelete(orgToDelete.id);
                        setOrgToDelete(null);
                    }}
                    title="Удалить организацию"
                    confirmText="Удалить"
                >
                    Вы действительно хотите удалить организацию <strong>{orgToDelete.name}</strong>?
                </ConfirmationModal>
            )}

            <ObjectResourceImporter 
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Копирование организаций"
                constructionObjects={constructionObjects}
                currentObjectId={currentObjectId}
                allItems={allOrganizations}
                existingItems={organizations}
                isDuplicate={(item, existing) => existing.some(e => e.inn === item.inn)}
                onImport={onImport}
                renderItem={(item) => (
                    <div>
                        <div className="font-semibold text-sm text-slate-800 line-clamp-1" title={item.name}>{item.name}</div>
                        <div className="text-xs text-slate-500">ИНН: {item.inn || 'Н/Д'} | ОГРН: {item.ogrn || 'Н/Д'}</div>
                    </div>
                )}
            />
        </div>
    );
};

export default OrganizationsPage;