import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Certificate, Act, ProjectSettings, CertificateFile } from '../types';
import Modal from '../components/Modal';
import { PlusIcon, DeleteIcon, EditIcon, LinkIcon, CloudUploadIcon, SparklesIcon, MaximizeIcon, MinimizeIcon, CloseIcon, ChevronLeftIcon, ArrowRightIcon } from '../components/Icons';
import { GoogleGenAI } from '@google/genai';

interface CertificatesPageProps {
    certificates: Certificate[];
    acts: Act[];
    settings: ProjectSettings;
    onSave: (cert: Certificate) => void;
    onDelete: (id: string) => void;
    onUnlink: (cert: Certificate) => void;
    initialOpenId: string | null;
    onClearInitialOpenId: () => void;
}

const ImageViewer: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
    return (
        <img src={src} alt={alt} className="max-w-full max-h-full object-contain mx-auto rounded-md shadow-sm" />
    );
};

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const CertificateForm: React.FC<{
    certificate: Certificate | null;
    onSave: (cert: Certificate) => void;
    onClose: () => void;
    settings: ProjectSettings;
}> = ({ certificate, onSave, onClose, settings }) => {
    const [formData, setFormData] = useState<Certificate>(() => {
        if (certificate) {
            // Migration logic for legacy single-file format
            let files = certificate.files || [];
            if (files.length === 0 && certificate.fileData) {
                const legacyFile: CertificateFile = {
                    id: crypto.randomUUID(),
                    type: certificate.fileType || 'image',
                    name: certificate.fileName || 'Документ',
                    data: certificate.fileData.startsWith('data:') 
                        ? certificate.fileData 
                        : `data:${certificate.fileType === 'pdf' ? 'application/pdf' : 'image/jpeg'};base64,${certificate.fileData}`
                };
                files = [legacyFile];
            }
            return { ...certificate, files };
        }
        return {
            id: crypto.randomUUID(),
            number: '',
            validUntil: '',
            files: [],
            materials: []
        };
    });

    const [activeFileId, setActiveFileId] = useState<string | null>(null);
    const [isGalleryCollapsed, setIsGalleryCollapsed] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    
    // AI State
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiPrompt, setAiPrompt] = useState<string>('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (formData.files.length > 0 && !activeFileId) {
            setActiveFileId(formData.files[0].id);
        }
    }, [formData.files, activeFileId]);

    const activeFile = useMemo(() => 
        formData.files.find(f => f.id === activeFileId) || formData.files[0] || null
    , [formData.files, activeFileId]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const newFiles: CertificateFile[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const dataUrl = await fileToDataUrl(file);
                newFiles.push({
                    id: crypto.randomUUID(),
                    type: file.type === 'application/pdf' ? 'pdf' : 'image',
                    name: file.name,
                    data: dataUrl
                });
            } catch (error) {
                console.error("Failed to read file", file.name, error);
            }
        }

        setFormData(prev => ({ ...prev, files: [...prev.files, ...newFiles] }));
        if (newFiles.length > 0 && !activeFileId) {
            setActiveFileId(newFiles[0].id);
        }
        
        // Reset input
        if (event.target) event.target.value = '';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        
        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;

        const newFiles: CertificateFile[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            // Simple validation
            if (!file.type.startsWith('image/') && file.type !== 'application/pdf') continue;

            try {
                const dataUrl = await fileToDataUrl(file);
                newFiles.push({
                    id: crypto.randomUUID(),
                    type: file.type === 'application/pdf' ? 'pdf' : 'image',
                    name: file.name,
                    data: dataUrl
                });
            } catch (error) {
                console.error("Failed to read file", file.name, error);
            }
        }

        if (newFiles.length > 0) {
            setFormData(prev => ({ ...prev, files: [...prev.files, ...newFiles] }));
            if (!activeFileId) setActiveFileId(newFiles[0].id);
        }
    };

    const handleDeleteFile = (fileId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setFormData(prev => {
            const newFiles = prev.files.filter(f => f.id !== fileId);
            return { ...prev, files: newFiles };
        });
        if (activeFileId === fileId) {
            setActiveFileId(null); // Will default to first available in render or useEffect
        }
    };

    const handleMaterialsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        const materials = text.split('\n').map(s => s.trim()).filter(Boolean);
        setFormData(prev => ({ ...prev, materials }));
    };

    const handleAiScan = async () => {
        if (!settings.geminiApiKey || !activeFile) return;
        if (activeFile.type !== 'image') {
            alert("AI сканирование поддерживается только для изображений.");
            return;
        }

        setIsAiLoading(true);
        try {
            const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
            
            // Extract base64 from data URL
            const base64Data = activeFile.data.split(',')[1];
            
            const promptNumber = settings.certificatePromptNumber || "Тип документа (обязательно укажи 'Паспорт качества', 'Сертификат соответствия' или другой тип) + Номер документа. Пример: 'Паспорт качества № 123'";
            const promptDate = settings.certificatePromptDate || "Дата выдачи/составления документа (НЕ дата окончания).";
            const promptMaterials = settings.certificatePromptMaterials || "Точное наименование продукции, марки, типы и размеры (например, 'Бетон B25 W6').";

            const prompt = `Проанализируй изображение сертификата/паспорта качества.
            Извлеки следующие данные и верни в формате JSON:
            {
                "number": "${promptNumber}",
                "validUntil": "Дата окончания действия (если есть) или дата документа, формат YYYY-MM-DD",
                "materials": ["${promptMaterials}", "..."]
            }
            Если материалов несколько, верни их списком.`;

            const imagePart = {
                inlineData: {
                    mimeType: 'image/jpeg', // Assuming jpeg/png, standard for vision
                    data: base64Data
                }
            };
            
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [imagePart, { text: prompt }] },
                config: { responseMimeType: "application/json" }
            });

            const result = JSON.parse(response.text);
            
            setFormData(prev => ({
                ...prev,
                number: result.number || prev.number,
                validUntil: result.validUntil || prev.validUntil,
                materials: result.materials && Array.isArray(result.materials) 
                    ? [...new Set([...prev.materials, ...result.materials])]
                    : prev.materials
            }));

        } catch (error) {
            console.error("AI Scan Error:", error);
            alert("Не удалось распознать документ. Проверьте API ключ и формат изображения.");
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-[80vh] w-full">
            <div className="flex-grow flex flex-row overflow-hidden gap-4">
                {/* Left Panel: File Viewer */}
                <div className={`flex flex-col transition-all duration-300 ${isGalleryCollapsed ? 'w-12' : 'w-2/3'}`}>
                    <div className="flex justify-between items-center mb-2 flex-shrink-0">
                         {!isGalleryCollapsed && <h3 className="font-semibold text-slate-700">Файлы документа</h3>}
                         <button 
                            type="button" 
                            onClick={() => setIsGalleryCollapsed(!isGalleryCollapsed)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500"
                            title={isGalleryCollapsed ? "Развернуть" : "Свернуть"}
                        >
                            {isGalleryCollapsed ? <MaximizeIcon className="w-5 h-5"/> : <MinimizeIcon className="w-5 h-5"/>}
                        </button>
                    </div>

                    {!isGalleryCollapsed ? (
                        <>
                            {/* Main Viewer Area */}
                            <div 
                                className={`flex-grow flex flex-col bg-slate-100 rounded-lg border-2 transition-colors relative overflow-hidden mb-2
                                    ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}
                                `}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <div className="flex-grow overflow-hidden relative flex items-center justify-center bg-slate-800 rounded-md">
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,image/*" multiple />
                                    
                                    {activeFile ? (
                                        activeFile.type === 'image' ? (
                                            <ImageViewer src={activeFile.data} alt="Preview" />
                                        ) : (
                                            <object data={activeFile.data} type="application/pdf" className="w-full h-full bg-white">
                                                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                                    <p>Предпросмотр PDF</p>
                                                    <a href={activeFile.data} target="_blank" rel="noreferrer" className="text-blue-400 underline mt-2">Скачать</a>
                                                </div>
                                            </object>
                                        )
                                    ) : (
                                        <div 
                                            className="text-center p-6 cursor-pointer flex flex-col items-center"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <CloudUploadIcon className="w-16 h-16 text-slate-500 mb-4" />
                                            <p className="text-lg text-slate-400 font-medium">Перетащите файлы сюда</p>
                                            <p className="text-sm text-slate-500 mt-1">или кликните для выбора</p>
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

                            {/* Thumbnails */}
                            <div className="h-20 flex gap-2 overflow-x-auto pb-1 min-h-[5rem]">
                                {formData.files.map(file => (
                                    <div 
                                        key={file.id}
                                        className={`relative w-16 h-16 flex-shrink-0 cursor-pointer border-2 rounded-md overflow-hidden bg-white
                                            ${activeFileId === file.id ? 'border-blue-600' : 'border-slate-200'}
                                        `}
                                        onClick={() => setActiveFileId(file.id)}
                                    >
                                        {file.type === 'image' ? (
                                            <img src={file.data} className="w-full h-full object-cover" alt="thumb" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-red-50 text-red-500 font-bold text-xs">PDF</div>
                                        )}
                                        <button
                                            type="button"
                                            className="absolute top-0 right-0 bg-black/50 text-white p-0.5 hover:bg-red-600 rounded-bl-md"
                                            onClick={(e) => handleDeleteFile(file.id, e)}
                                        >
                                            <CloseIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-16 h-16 flex-shrink-0 border-2 border-dashed border-slate-300 rounded-md flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-slate-50 transition-colors"
                                >
                                    <PlusIcon className="w-6 h-6" />
                                </button>
                            </div>
                        </>
                    ) : (
                        // Collapsed View - Vertical Strip
                        <div className="flex flex-col gap-2 items-center flex-grow overflow-y-auto pt-2 bg-slate-50 rounded-r-lg border-l border-slate-200">
                             {formData.files.map(file => (
                                <div 
                                    key={file.id}
                                    className={`relative w-8 h-8 flex-shrink-0 cursor-pointer border rounded bg-white
                                        ${activeFileId === file.id ? 'border-blue-600' : 'border-slate-200'}
                                    `}
                                    onClick={() => setActiveFileId(file.id)}
                                    title={file.name}
                                >
                                    {file.type === 'image' ? (
                                        <img src={file.data} className="w-full h-full object-cover" alt="thumb" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-red-50 text-red-500 text-[10px]">PDF</div>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-8 h-8 flex-shrink-0 border border-dashed border-slate-300 rounded flex items-center justify-center text-slate-400 hover:text-blue-600"
                            >
                                <PlusIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Panel: Data Form */}
                <div className={`flex flex-col gap-4 overflow-y-auto pl-2 pr-1 ${isGalleryCollapsed ? 'w-full' : 'w-1/3'}`}>
                    <div>
                         <label className="block text-sm font-medium text-slate-700">Номер документа</label>
                         <div className="flex gap-2">
                             <input 
                                type="text" 
                                className="mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                                value={formData.number}
                                onChange={e => setFormData(prev => ({ ...prev, number: e.target.value }))}
                                placeholder="№ сертификата..."
                                required
                             />
                              {settings.geminiApiKey && activeFile?.type === 'image' && (
                                <button
                                    type="button"
                                    onClick={handleAiScan}
                                    disabled={isAiLoading}
                                    className="mt-1 px-3 py-2 bg-violet-100 text-violet-700 rounded-md border border-violet-200 hover:bg-violet-200 disabled:opacity-50"
                                    title="Автозаполнение с помощью AI"
                                >
                                    {isAiLoading ? (
                                        <span className="animate-spin block w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full" />
                                    ) : (
                                        <SparklesIcon className="w-5 h-5" />
                                    )}
                                </button>
                             )}
                         </div>
                    </div>

                    <div>
                         <label className="block text-sm font-medium text-slate-700">Срок действия / Дата</label>
                         <input 
                            type="date" 
                            className="mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                            value={formData.validUntil}
                            onChange={e => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                            required
                         />
                    </div>

                    <div className="flex-grow flex flex-col min-h-[200px]">
                         <label className="block text-sm font-medium text-slate-700 mb-1">
                             Материалы (по одному на строку)
                             <span className="text-slate-400 font-normal ml-2 text-xs">({formData.materials.length})</span>
                         </label>
                         <textarea 
                            className="flex-grow w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900 resize-none font-mono text-sm"
                            value={formData.materials.join('\n')}
                            onChange={handleMaterialsChange}
                            placeholder="Бетон В25&#10;Арматура А500С&#10;..."
                         />
                    </div>
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t mt-2 flex-shrink-0">
                <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">Отмена</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Сохранить</button>
            </div>
        </form>
    );
};

const CertificatesPage: React.FC<CertificatesPageProps> = ({ 
    certificates, 
    acts, 
    settings, 
    onSave, 
    onDelete, 
    onUnlink,
    initialOpenId, 
    onClearInitialOpenId 
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCert, setEditingCert] = useState<Certificate | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (initialOpenId) {
            const target = certificates.find(c => c.id === initialOpenId);
            if (target) {
                setEditingCert(target);
                setIsModalOpen(true);
            }
            onClearInitialOpenId();
        }
    }, [initialOpenId, certificates, onClearInitialOpenId]);

    const handleOpenModal = (cert: Certificate | null = null) => {
        setEditingCert(cert);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingCert(null);
        setIsModalOpen(false);
    };

    const filteredCertificates = useMemo(() => {
        if (!searchTerm) return certificates;
        const lower = searchTerm.toLowerCase();
        return certificates.filter(c => 
            c.number.toLowerCase().includes(lower) || 
            c.materials.some(m => m.toLowerCase().includes(lower))
        );
    }, [certificates, searchTerm]);

    // Calculate usage statistics
    const usageStats = useMemo(() => {
        const stats = new Map<string, number>();
        acts.forEach(act => {
            if (!act.materials) return;
            // Scan for cert numbers
            certificates.forEach(cert => {
                if (act.materials.includes(`сертификат № ${cert.number}`)) {
                    stats.set(cert.id, (stats.get(cert.id) || 0) + 1);
                }
            });
        });
        return stats;
    }, [acts, certificates]);

    const handleDelete = (cert: Certificate) => {
        const count = usageStats.get(cert.id) || 0;
        if (count > 0) {
            if (confirm(`Этот сертификат используется в ${count} актах. Вы хотите удалить его и разорвать связи?`)) {
                onUnlink(cert); // Clean up texts in acts
                onDelete(cert.id); // Move to trash
            }
        } else {
             onDelete(cert.id);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold text-slate-800">Сертификаты и Паспорта</h1>
                <div className="flex gap-4">
                     <div className="relative">
                        <input
                            type="text"
                            placeholder="Поиск..."
                            className="pl-3 pr-8 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <CloseIcon className="w-4 h-4"/>
                            </button>
                        )}
                     </div>
                    <button onClick={() => handleOpenModal()} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                        <PlusIcon className="w-5 h-5 mr-2" /> Добавить
                    </button>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto min-h-0 border rounded-md">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-20">Файл</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Номер и Дата</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Материалы</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-24">Исп.</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-32">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {filteredCertificates.length > 0 ? filteredCertificates.map(cert => {
                             // Handle legacy or array files for thumbnail
                             const thumbFile = (cert.files && cert.files.length > 0) 
                                ? cert.files[0] 
                                : (cert.fileData ? { type: cert.fileType || 'image', data: cert.fileData } : null);
                             
                             const uses = usageStats.get(cert.id) || 0;

                             return (
                                <tr key={cert.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div 
                                            className="h-12 w-12 rounded border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center cursor-pointer"
                                            onClick={() => handleOpenModal(cert)}
                                        >
                                            {thumbFile ? (
                                                thumbFile.type === 'image' ? (
                                                    <img src={thumbFile.data.startsWith('data:') ? thumbFile.data : `data:image/jpeg;base64,${thumbFile.data}`} alt="thumb" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-[10px] font-bold text-red-500">PDF</span>
                                                )
                                            ) : (
                                                <span className="text-slate-300 text-xs">Нет</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap align-top">
                                        <div className="text-sm font-medium text-slate-900">{cert.number}</div>
                                        <div className="text-xs text-slate-500">
                                            {new Date(cert.validUntil) < new Date() ? (
                                                <span className="text-red-600 font-bold">Истек: {cert.validUntil}</span>
                                            ) : (
                                                <span>До: {cert.validUntil}</span>
                                            )}
                                        </div>
                                        {cert.files && cert.files.length > 1 && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 mt-1">
                                                +{cert.files.length - 1} файл(а)
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 align-top">
                                        <div className="max-h-16 overflow-hidden text-ellipsis">
                                            {cert.materials.join(', ')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm text-slate-500 align-top">
                                        {uses > 0 ? (
                                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold" title={`Используется в ${uses} актах`}>
                                                {uses}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium align-top">
                                        <div className="flex justify-end space-x-2">
                                            <button onClick={() => handleOpenModal(cert)} className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full" title="Редактировать">
                                                <EditIcon />
                                            </button>
                                            <button onClick={() => handleDelete(cert)} className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full" title="Удалить">
                                                <DeleteIcon />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                             );
                        }) : (
                            <tr>
                                <td colSpan={5} className="text-center py-10 text-slate-500">
                                    {certificates.length === 0 ? "База сертификатов пуста." : "Ничего не найдено."}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <Modal 
                    isOpen={isModalOpen} 
                    onClose={handleCloseModal} 
                    title={editingCert ? 'Редактировать сертификат' : 'Новый сертификат'}
                    maxWidth="max-w-6xl"
                    className="h-[90vh]"
                >
                    <CertificateForm 
                        certificate={editingCert} 
                        onSave={onSave} 
                        onClose={handleCloseModal} 
                        settings={settings}
                    />
                </Modal>
            )}
        </div>
    );
};

export default CertificatesPage;
