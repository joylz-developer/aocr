import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Certificate, Act, ProjectSettings, CertificateFile } from '../types';
import Modal from '../components/Modal';
import { GoogleGenAI } from '@google/genai';
import { PlusIcon, EditIcon, DeleteIcon, LinkIcon, CloseIcon, CloudUploadIcon, SparklesIcon, TrashIcon } from '../components/Icons';
import ConfirmationModal from '../components/ConfirmationModal';

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

const countPdfPages = (base64Data: string): number => {
    try {
        // base64Data might be a full data URL or just base64
        const base64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
        const binary = atob(base64);
        
        // Strategy: Look for /Count N in the PDF structure.
        // This is heuristic but works for most generated PDFs.
        const countMatches = binary.match(/\/Count\s+(\d+)/g);
        if (countMatches) {
             const counts = countMatches.map(m => parseInt(m.match(/\d+/)?.[0] || '0', 10));
             return Math.max(...counts);
        }
        
        // Fallback: count /Page objects
        const pageMatches = binary.match(/\/Type\s*\/Page\b/g);
        if (pageMatches) {
            return pageMatches.length;
        }
    } catch (e) {
        console.warn("Could not count PDF pages", e);
    }
    return 1;
};

const fileToDataUrl = (file: File): Promise<{ name: string, type: 'pdf' | 'image', data: string, mime: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                const dataUrl = reader.result;
                const mime = dataUrl.match(/^data:(.*?);/)?.[1] || '';
                let type: 'pdf' | 'image' = 'image';
                if (mime.includes('pdf')) type = 'pdf';
                
                resolve({
                    name: file.name,
                    type,
                    data: dataUrl,
                    mime
                });
            } else {
                reject(new Error("Failed to read file"));
            }
        };
        reader.onerror = reject;
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
            amount: '1', 
            files: [], 
            materials: [] 
        }
    );
    
    // Legacy migration: ensure files array is populated if legacy fields exist
    useEffect(() => {
        if (certificate && (!certificate.files || certificate.files.length === 0) && certificate.fileData) {
            setFormData(prev => ({
                ...prev,
                files: [{
                    id: crypto.randomUUID(),
                    name: certificate.fileName || 'document',
                    type: certificate.fileType || 'image',
                    data: certificate.fileData!
                }]
            }));
        }
    }, [certificate]);

    const [activeFileId, setActiveFileId] = useState<string | null>(null);
    const [newMaterial, setNewMaterial] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [fileToDeleteId, setFileToDeleteId] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Set active file on mount or when files change
    useEffect(() => {
        if (formData.files.length > 0 && !activeFileId) {
            setActiveFileId(formData.files[0].id);
        }
    }, [formData.files, activeFileId]);

    const activeFile = formData.files.find(f => f.id === activeFileId);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddMaterial = () => {
        if (newMaterial.trim()) {
            setFormData(prev => ({
                ...prev,
                materials: [...prev.materials, newMaterial.trim()]
            }));
            setNewMaterial('');
        }
    };

    const handleRemoveMaterial = (index: number) => {
        setFormData(prev => ({
            ...prev,
            materials: prev.materials.filter((_, i) => i !== index)
        }));
    };
    
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        const newFiles: CertificateFile[] = [];
        let totalNewPages = 0;

        for (let i = 0; i < files.length; i++) {
            try {
                const { name, type, data, mime } = await fileToDataUrl(files[i]);
                
                // Count pages if PDF
                if (type === 'pdf') {
                    totalNewPages += countPdfPages(data);
                } else {
                    totalNewPages += 1;
                }

                newFiles.push({
                    id: crypto.randomUUID(),
                    name,
                    type,
                    data
                });
            } catch (err) {
                console.error("Upload error", err);
            }
        }

        setFormData(prev => {
            const currentAmount = parseInt(prev.amount || '0', 10);
            return {
                ...prev,
                files: [...prev.files, ...newFiles],
                amount: String(currentAmount + totalNewPages)
            };
        });
        
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDeleteFileClick = (e: React.MouseEvent, fileId: string) => {
        e.stopPropagation();
        setFileToDeleteId(fileId);
    };

    const handleConfirmDeleteFile = () => {
        if (!fileToDeleteId) return;
        
        setFormData(prev => {
            const fileToRemove = prev.files.find(f => f.id === fileToDeleteId);
            let pagesToRemove = 0;

            if (fileToRemove) {
                if (fileToRemove.type === 'pdf') {
                    pagesToRemove = countPdfPages(fileToRemove.data);
                } else {
                    pagesToRemove = 1;
                }
            }

            const newFiles = prev.files.filter(f => f.id !== fileToDeleteId);
            
            if (fileToDeleteId === activeFileId) {
                setActiveFileId(newFiles.length > 0 ? newFiles[newFiles.length - 1].id : null);
            }

            const currentAmount = parseInt(prev.amount || '0', 10);
            const newAmount = Math.max(0, currentAmount - pagesToRemove);

            return { 
                ...prev, 
                files: newFiles,
                amount: String(newAmount)
            };
        });
        
        setFileToDeleteId(null);
    };

    const handleAiScan = async () => {
        if (!activeFile) return;
        if (!settings.geminiApiKey) {
            alert("Пожалуйста, добавьте API ключ в настройках.");
            return;
        }

        setIsScanning(true);
        try {
            const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
            
            // Extract base64 and mime
            const matches = activeFile.data.match(/^data:(.*?);base64,(.*)$/);
            if (!matches) throw new Error("Invalid file data");
            
            const mimeType = matches[1];
            const base64Data = matches[2];

            const prompt = `
                Analyze this certificate document. Extract:
                1. Certificate Number (number).
                2. Valid Until Date (validUntil) in YYYY-MM-DD format.
                3. List of materials or products certified (materials).
                
                Return JSON: { "number": string, "validUntil": string, "materials": string[] }
            `;

            const filePart = {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                }
            };
            
            const textPart = { text: prompt };

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [filePart, textPart] },
                config: { responseMimeType: "application/json" }
            });
            
            const result = JSON.parse(response.text);
            
            setFormData(prev => ({
                ...prev,
                number: result.number || prev.number,
                validUntil: result.validUntil || prev.validUntil,
                materials: [...new Set([...prev.materials, ...(result.materials || [])])]
            }));

        } catch (error) {
            console.error("AI Scan Error:", error);
            alert("Ошибка при сканировании. Проверьте консоль или API ключ.");
        } finally {
            setIsScanning(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    const inputClass = "mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900";
    const labelClass = "block text-sm font-medium text-slate-700";

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-[80vh]">
            <div className="flex-grow overflow-y-auto p-1 pr-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* LEFT COLUMN: Files & Preview */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-slate-700">Файлы сертификата</h3>
                            <div>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileUpload} 
                                    className="hidden" 
                                    multiple 
                                    accept="image/*,application/pdf"
                                />
                                <button 
                                    type="button" 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-sm flex items-center gap-1 text-blue-600 hover:text-blue-800"
                                >
                                    <CloudUploadIcon className="w-4 h-4"/> Добавить
                                </button>
                            </div>
                        </div>

                        {/* File Tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {formData.files.map((file, idx) => (
                                <div 
                                    key={file.id}
                                    onClick={() => setActiveFileId(file.id)}
                                    className={`relative px-3 py-2 rounded border cursor-pointer flex-shrink-0 max-w-[120px] group ${activeFileId === file.id ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                >
                                    <div className="text-xs truncate font-medium text-slate-700">{file.name}</div>
                                    <div className="text-[10px] text-slate-500 uppercase">{file.type}</div>
                                    
                                    <button
                                        type="button"
                                        onClick={(e) => handleDeleteFileClick(e, file.id)}
                                        className="absolute -top-1.5 -right-1.5 bg-red-100 text-red-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-200 transition-opacity"
                                        title="Удалить файл"
                                    >
                                        <CloseIcon className="w-3 h-3"/>
                                    </button>
                                </div>
                            ))}
                            {formData.files.length === 0 && (
                                <div className="text-sm text-slate-400 italic p-2 border border-dashed rounded w-full text-center">
                                    Нет файлов. Загрузите скан или фото.
                                </div>
                            )}
                        </div>

                        {/* Preview Area */}
                        <div className="bg-slate-100 border rounded-lg h-96 flex items-center justify-center relative overflow-hidden">
                            {activeFile ? (
                                activeFile.type === 'image' ? (
                                    <img src={activeFile.data} alt="preview" className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <iframe src={activeFile.data} className="w-full h-full" title="pdf-preview" />
                                )
                            ) : (
                                <span className="text-slate-400">Выберите файл для просмотра</span>
                            )}
                            
                            {/* Scan Button Overlay */}
                            {activeFile && (
                                <div className="absolute bottom-4 right-4">
                                     <button
                                        type="button"
                                        onClick={handleAiScan}
                                        disabled={isScanning}
                                        className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all disabled:opacity-70 transform hover:-translate-y-1"
                                    >
                                        {isScanning ? (
                                            <>Сканирование...</>
                                        ) : (
                                            <><SparklesIcon className="w-4 h-4"/> AI Распознавание</>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Metadata */}
                    <div className="space-y-4">
                         <h3 className="font-semibold text-slate-700">Данные документа</h3>
                        <div>
                            <label className={labelClass}>Номер сертификата</label>
                            <input type="text" name="number" value={formData.number} onChange={handleChange} className={inputClass} required />
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Действителен до</label>
                                <input type="date" name="validUntil" value={formData.validUntil} onChange={handleChange} className={inputClass} required />
                            </div>
                            <div>
                                <label className={labelClass}>Кол-во листов</label>
                                <input type="number" name="amount" value={formData.amount} onChange={handleChange} className={inputClass} min="0" />
                            </div>
                         </div>
                         
                         <div>
                             <label className={labelClass}>Материалы в сертификате</label>
                             <div className="flex gap-2 mt-1 mb-2">
                                 <input 
                                    type="text" 
                                    value={newMaterial} 
                                    onChange={(e) => setNewMaterial(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddMaterial())}
                                    placeholder="Например: Бетон B25"
                                    className={`${inputClass} mt-0`} 
                                />
                                <button 
                                    type="button"
                                    onClick={handleAddMaterial}
                                    className="bg-blue-100 text-blue-700 px-3 py-2 rounded-md hover:bg-blue-200"
                                >
                                    <PlusIcon className="w-5 h-5"/>
                                </button>
                             </div>
                             <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1 border rounded bg-slate-50 min-h-[100px]">
                                {formData.materials.map((mat, idx) => (
                                    <span key={idx} className="inline-flex items-center bg-white border border-slate-200 rounded px-2 py-1 text-sm shadow-sm">
                                        {mat}
                                        <button 
                                            type="button"
                                            onClick={() => handleRemoveMaterial(idx)}
                                            className="ml-2 text-slate-400 hover:text-red-500"
                                        >
                                            <CloseIcon className="w-3 h-3"/>
                                        </button>
                                    </span>
                                ))}
                                {formData.materials.length === 0 && <span className="text-slate-400 text-sm italic p-2">Список пуст</span>}
                             </div>
                         </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t mt-4 bg-white">
                <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">Отмена</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Сохранить</button>
            </div>

            {fileToDeleteId && (
                <ConfirmationModal
                    isOpen={!!fileToDeleteId}
                    onClose={() => setFileToDeleteId(null)}
                    onConfirm={handleConfirmDeleteFile}
                    title="Удалить файл?"
                    confirmText="Удалить"
                >
                    Вы уверены, что хотите удалить этот файл из сертификата?
                </ConfirmationModal>
            )}
        </form>
    );
};

const CertificatesPage: React.FC<CertificatesPageProps> = ({ certificates, acts, settings, onSave, onDelete, onUnlink, initialOpenId, onClearInitialOpenId }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCertificate, setEditingCertificate] = useState<Certificate | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (initialOpenId) {
            const target = certificates.find(c => c.id === initialOpenId);
            if (target) {
                setEditingCertificate(target);
                setIsModalOpen(true);
            }
            onClearInitialOpenId();
        }
    }, [initialOpenId, certificates, onClearInitialOpenId]);

    const handleOpenModal = (cert: Certificate | null = null) => {
        setEditingCertificate(cert);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingCertificate(null);
        setIsModalOpen(false);
    };
    
    // Helper to find usages
    const getLinkedActs = (cert: Certificate) => {
        // Regex logic matching docGenerator
        const regex = new RegExp(`\\(сертификат №\\s*${cert.number}.*?\\)`, 'i');
        return acts.filter(act => regex.test(act.materials) || act.materials.includes(cert.number));
    };

    const filteredCertificates = useMemo(() => {
        if (!searchTerm) return certificates;
        const lower = searchTerm.toLowerCase();
        return certificates.filter(c => 
            c.number.toLowerCase().includes(lower) || 
            c.materials.some(m => m.toLowerCase().includes(lower))
        );
    }, [certificates, searchTerm]);

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold text-slate-800">Сертификаты и Паспорта</h1>
                <button onClick={() => handleOpenModal()} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    <PlusIcon /> Добавить документ
                </button>
            </div>
            
            <div className="mb-4">
                <input 
                    type="text" 
                    placeholder="Поиск по номеру или материалам..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div className="flex-grow overflow-auto border border-slate-200 rounded-md">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Номер / Дата</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Материалы</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Файлы</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Использование</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {filteredCertificates.length > 0 ? filteredCertificates.map(cert => {
                            const linkedActs = getLinkedActs(cert);
                            const isExpired = new Date(cert.validUntil) < new Date();
                            
                            return (
                                <tr key={cert.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 align-top">
                                        <div className="text-sm font-bold text-slate-900">{cert.number}</div>
                                        <div className={`text-xs ${isExpired ? 'text-red-500 font-semibold' : 'text-slate-500'}`}>
                                            До: {new Date(cert.validUntil).toLocaleDateString()}
                                            {isExpired && ' (Истек)'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex flex-wrap gap-1">
                                            {cert.materials.slice(0, 5).map((m, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded border border-slate-200">
                                                    {m}
                                                </span>
                                            ))}
                                            {cert.materials.length > 5 && (
                                                <span className="text-xs text-slate-500 pl-1">+{cert.materials.length - 5} еще...</span>
                                            )}
                                            {cert.materials.length === 0 && <span className="text-xs text-slate-300 italic">Нет материалов</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top text-sm text-slate-500">
                                        {cert.files?.length || (cert.fileData ? 1 : 0)} файл(ов)
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        {linkedActs.length > 0 ? (
                                            <div className="text-xs">
                                                <div className="font-semibold text-blue-600 mb-1">{linkedActs.length} Акт(ов):</div>
                                                <div className="flex flex-wrap gap-1">
                                                    {linkedActs.slice(0, 3).map(a => (
                                                        <span key={a.id} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                                            №{a.number}
                                                        </span>
                                                    ))}
                                                    {linkedActs.length > 3 && <span>...</span>}
                                                </div>
                                                <button 
                                                    onClick={() => onUnlink(cert)}
                                                    className="mt-1 text-[10px] text-red-500 hover:underline flex items-center gap-1"
                                                    title="Удалить привязку из текстов актов"
                                                >
                                                    <LinkIcon className="w-3 h-3"/> Отвязать
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400">Не используется</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium align-top">
                                        <div className="flex justify-end space-x-2">
                                            <button onClick={() => handleOpenModal(cert)} className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full" title="Редактировать"><EditIcon /></button>
                                            <button onClick={() => onDelete(cert.id)} className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full" title="В корзину"><TrashIcon /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={5} className="text-center py-10 text-slate-500">
                                    Нет сертификатов.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingCertificate ? 'Редактировать сертификат' : 'Новый сертификат'} maxWidth="max-w-4xl">
                    <CertificateForm
                        certificate={editingCertificate}
                        settings={settings}
                        onSave={onSave}
                        onClose={handleCloseModal}
                    />
                </Modal>
            )}
        </div>
    );
};

export default CertificatesPage;