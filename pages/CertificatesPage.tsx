import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Certificate, CertificateFile, ProjectSettings, Act } from '../types';
import Modal from '../components/Modal';
import { 
    PlusIcon, EditIcon, DeleteIcon, CloudUploadIcon, 
    CertificateIcon, CloseIcon, LinkIcon, SparklesIcon,
    MaximizeIcon, MinimizeIcon
} from '../components/Icons';
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

const ImageViewer: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900 overflow-hidden rounded-md">
        <img src={src} alt={alt} className="max-w-full max-h-full object-contain" />
    </div>
);

const fileToBase64 = (file: File): Promise<{ name: string, type: 'pdf' | 'image', data: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                // Determine type based on MIME type or extension
                const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                resolve({
                    name: file.name,
                    type: isPdf ? 'pdf' : 'image',
                    data: reader.result 
                });
            } else {
                reject(new Error('Failed to read file'));
            }
        };
        reader.onerror = error => reject(error);
    });
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
            materials: [],
            files: []
        }
    );

    // Migration logic for legacy single-file certificates
    useEffect(() => {
        if (certificate && (!certificate.files || certificate.files.length === 0) && certificate.fileData) {
            setFormData(prev => ({
                ...prev,
                files: [{
                    id: crypto.randomUUID(),
                    type: certificate.fileType || 'image',
                    name: certificate.fileName || 'Legacy File',
                    data: certificate.fileData!
                }]
            }));
        }
    }, [certificate]);

    const [activeFileId, setActiveFileId] = useState<string | null>(null);
    const [isGalleryCollapsed, setIsGalleryCollapsed] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Set active file on load or when files change
    useEffect(() => {
        if (formData.files.length > 0 && !activeFileId) {
            setActiveFileId(formData.files[0].id);
        } else if (formData.files.length === 0) {
            setActiveFileId(null);
        }
    }, [formData.files, activeFileId]);

    const activeFile = useMemo(() => 
        formData.files.find(f => f.id === activeFileId), 
    [formData.files, activeFileId]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleMaterialsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const items = e.target.value.split(';').map(s => s.trim()); // Allow empty strings during typing? No, maybe split on commit
        // For text input, better to keep a local string state or assume the user knows ';' separates items
        // Since the type is string[], we'll parse it here.
        setFormData(prev => ({ ...prev, materials: items }));
    };
    
    // Using a textarea for materials for easier editing
    const [materialsText, setMaterialsText] = useState(formData.materials.join('; '));
    const handleMaterialsTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMaterialsText(e.target.value);
        setFormData(prev => ({ ...prev, materials: e.target.value.split(';').map(s => s.trim()).filter(Boolean) }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        await processFiles(Array.from(files));
        if (e.target) e.target.value = '';
    };

    const processFiles = async (files: File[]) => {
        const newFiles: CertificateFile[] = [];
        for (const file of files) {
            try {
                const processed = await fileToBase64(file);
                newFiles.push({
                    id: crypto.randomUUID(),
                    ...processed
                });
            } catch (err) {
                console.error("Error processing file", file.name, err);
            }
        }
        
        setFormData(prev => ({
            ...prev,
            files: [...prev.files, ...newFiles]
        }));
    };

    const handleDeleteFileClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setFormData(prev => ({
            ...prev,
            files: prev.files.filter(f => f.id !== id)
        }));
        if (activeFileId === id) setActiveFileId(null);
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
        const files = Array.from(e.dataTransfer.files);
        await processFiles(files);
    };

    const handleAiScan = async () => {
        if (!activeFile || !settings.geminiApiKey) return;
        
        setAiLoading(true);
        try {
            const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
            
            // Determine prompt based on settings
            const prompt = `
                Analyze this certificate image/document. Extract the following data in JSON format:
                {
                    "number": "${settings.certificatePromptNumber || 'Document number (Certificate number)'}",
                    "validUntil": "${settings.certificatePromptDate || 'Expiry date in YYYY-MM-DD format. If only issue date is present, try to estimate expiry or leave empty.'}",
                    "materials": "List of materials or products covered by this certificate. ${settings.certificatePromptMaterials || 'Extract product names.'}"
                }
                
                Return ONLY raw JSON.
            `;

            const base64Data = activeFile.data.split(',')[1];
            const mimeType = activeFile.type === 'pdf' ? 'application/pdf' : 'image/jpeg'; // Simplification

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [
                        { inlineData: { data: base64Data, mimeType } },
                        { text: prompt }
                    ]
                },
                config: {
                    responseMimeType: "application/json"
                }
            });

            const text = response.text;
            if (text) {
                const result = JSON.parse(text);
                setFormData(prev => ({
                    ...prev,
                    number: result.number || prev.number,
                    validUntil: result.validUntil || prev.validUntil,
                    materials: Array.isArray(result.materials) 
                        ? result.materials 
                        : (typeof result.materials === 'string' ? result.materials.split(',').map((s:string) => s.trim()) : prev.materials)
                }));
                // Update local text state
                if (result.materials) {
                     const matArr = Array.isArray(result.materials) ? result.materials : result.materials.toString().split(',');
                     setMaterialsText(matArr.join('; '));
                }
            }

        } catch (error) {
            console.error("AI Scan failed", error);
            alert("Не удалось распознать документ. Возможно, формат не поддерживается или ключ API неверен.");
        } finally {
            setAiLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-[80vh]">
            <div className="flex flex-grow overflow-hidden gap-4">
                {/* Left Panel: Form */}
                <div className="w-1/3 flex flex-col gap-4 overflow-y-auto pr-2">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Номер сертификата</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                name="number" 
                                value={formData.number} 
                                onChange={handleInputChange} 
                                className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                required 
                            />
                            {settings.geminiApiKey && activeFile && (
                                <button 
                                    type="button" 
                                    onClick={handleAiScan}
                                    disabled={aiLoading}
                                    className="mt-1 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white p-2 rounded-md hover:opacity-90 disabled:opacity-50"
                                    title="Заполнить с помощью AI"
                                >
                                    {aiLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <SparklesIcon className="w-5 h-5" />}
                                </button>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Действителен до</label>
                        <input 
                            type="date" 
                            name="validUntil" 
                            value={formData.validUntil} 
                            onChange={handleInputChange} 
                            className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            required 
                        />
                    </div>

                    <div className="flex-grow flex flex-col">
                        <label className="block text-sm font-medium text-slate-700">Материалы (через точку с запятой)</label>
                        <textarea 
                            value={materialsText} 
                            onChange={handleMaterialsTextChange} 
                            className="mt-1 flex-grow w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm resize-none"
                            placeholder="Бетон В25; Арматура А500С..."
                        />
                    </div>
                </div>

                {/* Right Panel: File Gallery */}
                <div className={`flex flex-col transition-all duration-300 ${isGalleryCollapsed ? 'w-10' : 'w-2/3'}`}>
                    <div className="flex justify-between items-center mb-2">
                         {!isGalleryCollapsed && <h3 className="text-sm font-medium text-slate-700">Скан-копии</h3>}
                         <button 
                            type="button" 
                            onClick={() => setIsGalleryCollapsed(!isGalleryCollapsed)}
                            className="text-slate-500 hover:text-blue-600 p-1"
                            title={isGalleryCollapsed ? "Развернуть" : "Свернуть"}
                         >
                            {isGalleryCollapsed ? <MaximizeIcon className="w-5 h-5"/> : <MinimizeIcon className="w-5 h-5"/>}
                         </button>
                    </div>

                    {!isGalleryCollapsed ? (
                            <>
                                <div className="px-1 mb-1 min-h-[1.25rem]">
                                    <span className="font-semibold text-slate-700 truncate block text-sm" title={activeFile?.name}>
                                        {activeFile ? activeFile.name : 'Нет файла'}
                                    </span>
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
                                                        <p>PDF Preview не поддерживается браузером в этом контексте.</p>
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
                                <div className="h-24 flex-shrink-0 bg-slate-100 rounded-lg border border-slate-200 p-2 overflow-x-auto flex gap-2 items-center mt-2">
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
                                                    title="Удалить файл"
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
                            <div className="h-full bg-slate-100 rounded flex flex-col items-center pt-4 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => setIsGalleryCollapsed(false)}>
                                <span className="text-xs font-bold text-slate-500 vertical-writing rotate-180" style={{ writingMode: 'vertical-rl' }}>Развернуть галерею</span>
                            </div>
                        )}
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 mt-4">
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
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCert, setEditingCert] = useState<Certificate | null>(null);

    // Effect to handle opening a certificate from another page (via initialOpenId)
    useEffect(() => {
        if (initialOpenId) {
            const targetCert = certificates.find(c => c.id === initialOpenId);
            if (targetCert) {
                setEditingCert(targetCert);
                setIsModalOpen(true);
            }
            onClearInitialOpenId();
        }
    }, [initialOpenId, certificates, onClearInitialOpenId]);

    const filteredCertificates = useMemo(() => {
        if (!searchTerm) return certificates;
        const lower = searchTerm.toLowerCase();
        return certificates.filter(c => 
            c.number.toLowerCase().includes(lower) || 
            c.materials.some(m => m.toLowerCase().includes(lower))
        );
    }, [certificates, searchTerm]);

    const handleOpenModal = (cert: Certificate | null = null) => {
        setEditingCert(cert);
        setIsModalOpen(true);
    };

    const getLinkedActsCount = (cert: Certificate) => {
        // Rudimentary check based on text presence
        const regex = new RegExp(`\\(сертификат №\\s*${cert.number}.*?\\)`, 'i');
        return acts.filter(act => regex.test(act.materials)).length;
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold text-slate-800">Сертификаты и паспорта</h1>
                <button onClick={() => handleOpenModal()} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    <PlusIcon /> Добавить сертификат
                </button>
            </div>

            <div className="mb-4">
                <input 
                    type="text" 
                    placeholder="Поиск по номеру или материалам..." 
                    className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="flex-grow overflow-y-auto border border-slate-200 rounded-md">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-40">Номер</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-32">Действителен до</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Материалы</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-24">Файлы</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-32">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {filteredCertificates.length > 0 ? filteredCertificates.map(cert => {
                            const linkedCount = getLinkedActsCount(cert);
                            const isExpired = new Date(cert.validUntil) < new Date();
                            
                            return (
                                <tr key={cert.id} className="hover:bg-slate-50 group">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800">{cert.number}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={isExpired ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                                            {new Date(cert.validUntil).toLocaleDateString()}
                                        </span>
                                        {isExpired && <span className="ml-2 text-xs text-red-500 border border-red-200 bg-red-50 px-1 rounded">Истек</span>}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        <div className="flex flex-wrap gap-1">
                                            {cert.materials.slice(0, 3).map((m, i) => (
                                                <span key={i} className="bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200 truncate max-w-[150px]">{m}</span>
                                            ))}
                                            {cert.materials.length > 3 && (
                                                <span className="text-xs text-slate-400 flex items-center">+{cert.materials.length - 3} еще...</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        {cert.files && cert.files.length > 0 ? (
                                            <div className="flex items-center gap-1">
                                                <CertificateIcon className="w-4 h-4" />
                                                <span>{cert.files.length}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end items-center gap-2">
                                            {linkedCount > 0 && (
                                                <button 
                                                    onClick={() => {
                                                        if (confirm(`Этот сертификат используется в ${linkedCount} актах. Вы хотите удалить ссылки на него из материалов актов, но оставить сам сертификат?`)) {
                                                            onUnlink(cert);
                                                        }
                                                    }}
                                                    className="text-amber-600 hover:text-amber-800 p-1.5 rounded hover:bg-amber-50" 
                                                    title={`Используется в ${linkedCount} актах. Нажмите, чтобы убрать ссылки.`}
                                                >
                                                    <LinkIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button onClick={() => handleOpenModal(cert)} className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full" title="Редактировать">
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => onDelete(cert.id)} className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full" title="Удалить">
                                                <DeleteIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={5} className="text-center py-10 text-slate-500">
                                    {certificates.length === 0 
                                        ? "База сертификатов пуста. Добавьте первый документ." 
                                        : "Ничего не найдено."}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCert ? 'Редактирование сертификата' : 'Новый сертификат'} maxWidth="max-w-5xl">
                    <CertificateForm
                        certificate={editingCert}
                        settings={settings}
                        onSave={onSave}
                        onClose={() => setIsModalOpen(false)}
                    />
                </Modal>
            )}
        </div>
    );
};

export default CertificatesPage;
