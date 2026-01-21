import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Certificate, Act, ProjectSettings, CertificateFile } from '../types';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import { PlusIcon, EditIcon, DeleteIcon, LinkIcon, CloseIcon, CloudUploadIcon, ArrowDownCircleIcon } from '../components/Icons'; 
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

const countPdfPages = (base64: string): number => {
    try {
        const bin = atob(base64);
        // Simple regex to find /Count N in PDF trailer or catalog. Not perfect but works for many simple PDFs.
        const matches = bin.match(/\/Count\s+(\d+)/g);
        if (matches) {
             const lastMatch = matches[matches.length - 1];
             const count = parseInt(lastMatch.split(/\s+/)[1], 10);
             return isNaN(count) ? 1 : count;
        }
    } catch (e) { return 1; }
    return 1;
};

const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error('Failed to read file.'));
            }
        };
        reader.onerror = (error) => reject(error);
    });

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
            files: [],
            amount: '0'
        }
    );
    
    // Handle legacy single file migration on load
    useEffect(() => {
        if (certificate && (!certificate.files || certificate.files.length === 0) && certificate.fileData) {
            const legacyFile: CertificateFile = {
                id: crypto.randomUUID(),
                type: certificate.fileType || 'image',
                name: certificate.fileName || 'document',
                data: certificate.fileData
            };
            setFormData(prev => ({ ...prev, files: [legacyFile] }));
        }
    }, [certificate]);

    const [activeFileId, setActiveFileId] = useState<string | null>(null);
    const [fileToDeleteId, setFileToDeleteId] = useState<string | null>(null);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [ocrError, setOcrError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Select first file as active if none selected
    useEffect(() => {
        if (!activeFileId && formData.files.length > 0) {
            setActiveFileId(formData.files[0].id);
        }
    }, [formData.files, activeFileId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleMaterialsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setFormData(prev => ({ ...prev, materials: val.split(';').map(s => s.trim()) }));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const files = Array.from(e.target.files);
        
        setIsOcrLoading(true);
        setOcrError(null);
        
        const newFiles: CertificateFile[] = [];
        
        for (const file of files) {
            try {
                const base64 = await fileToBase64(file);
                const isPdf = file.type === 'application/pdf';
                newFiles.push({
                    id: crypto.randomUUID(),
                    type: isPdf ? 'pdf' : 'image',
                    name: file.name,
                    data: base64
                });
            } catch (err) {
                console.error(err);
            }
        }

        setFormData(prev => {
            const updatedFiles = [...prev.files, ...newFiles];
            const newAmount = updatedFiles.reduce((sum, file) => {
                if (file.type === 'image') return sum + 1;
                if (file.type === 'pdf') return sum + countPdfPages(file.data);
                return sum + 1;
            }, 0);
            
            return {
                ...prev,
                files: updatedFiles,
                amount: String(newAmount)
            };
        });

        // If OCR enabled and we just uploaded, try to scan the first image/first page of pdf
        // Note: Full PDF parsing for OCR in browser is heavy. We might only OCR images or skip if PDF.
        // For now, let's just trigger OCR on the first uploaded file if it is an image and user hasn't filled data yet.
        if (settings.geminiApiKey && (!formData.number || !formData.validUntil) && newFiles.length > 0) {
             const firstFile = newFiles[0];
             // Only OCR images easily. For PDF we'd need to rasterize which is complex without heavy libs.
             if (firstFile.type === 'image') {
                 performOcr(firstFile.data, firstFile.type);
             }
        } else {
             setIsOcrLoading(false);
        }
        
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    
    const performOcr = async (base64Data: string, type: 'pdf' | 'image') => {
        if (!settings.geminiApiKey) {
             setIsOcrLoading(false);
             return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
            const model = ai.models;
            
            const prompt = `Analyze this certificate/document image. Extract:
            1. Certificate Number ("number").
            2. Valid Until Date ("validUntil") in YYYY-MM-DD format.
            3. List of materials/products mentioned ("materials") as an array of strings.
            Return JSON only.`;
            
            const mimeType = type === 'pdf' ? 'application/pdf' : 'image/jpeg'; // Approximating mime for generic 'image' type internal tag

            const result = await model.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [
                        { inlineData: { mimeType: mimeType, data: base64Data } },
                        { text: prompt }
                    ]
                },
                config: { responseMimeType: "application/json" }
            });
            
            const responseText = result.text;
            const data = JSON.parse(responseText);
            
            setFormData(prev => ({
                ...prev,
                number: prev.number || data.number || '',
                validUntil: prev.validUntil || data.validUntil || '',
                materials: (prev.materials.length > 0 ? prev.materials : (data.materials || []))
            }));
            
        } catch (error) {
            console.error("OCR Error", error);
            setOcrError("Не удалось распознать данные автоматически.");
        } finally {
            setIsOcrLoading(false);
        }
    };
    
    const handleConfirmDeleteFile = () => {
        if (!fileToDeleteId) return;
        
        setFormData(prev => {
            const newFiles = prev.files.filter(f => f.id !== fileToDeleteId);
            
            // Recalculate amount based on remaining files
            const newAmount = newFiles.reduce((sum, file) => {
                if (file.type === 'image') return sum + 1;
                if (file.type === 'pdf') return sum + countPdfPages(file.data);
                return sum + 1;
            }, 0);

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };
    
    const activeFile = formData.files.find(f => f.id === activeFileId);

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-[80vh]">
            <div className="flex-grow flex gap-4 overflow-hidden">
                {/* Left Panel: Inputs */}
                <div className="w-1/3 flex flex-col gap-4 overflow-y-auto pr-2">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Номер документа</label>
                        <input type="text" name="number" value={formData.number} onChange={handleChange} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Действителен до</label>
                        <input type="date" name="validUntil" value={formData.validUntil} onChange={handleChange} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Количество листов</label>
                         <input type="text" name="amount" value={formData.amount || ''} onChange={handleChange} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500" placeholder="Автоматически или вручную" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Материалы (через ;)</label>
                        <input type="text" value={formData.materials.join('; ')} onChange={handleMaterialsChange} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500" />
                        <p className="text-xs text-slate-500 mt-1">Перечислите материалы, которые покрывает этот сертификат.</p>
                    </div>
                    
                    <div className="mt-4 border-t pt-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Файлы</label>
                         <input
                            type="file"
                            multiple
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileUpload}
                            accept="image/*,application/pdf"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex justify-center items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 mb-3"
                        >
                            <CloudUploadIcon className="mr-2 h-5 w-5 text-slate-400" />
                            Загрузить файлы
                        </button>
                        
                        <div className="space-y-2">
                            {formData.files.map(file => (
                                <div 
                                    key={file.id} 
                                    className={`flex items-center justify-between p-2 rounded border cursor-pointer ${activeFileId === file.id ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                    onClick={() => setActiveFileId(file.id)}
                                >
                                    <div className="flex items-center truncate">
                                        <span className="text-xs font-semibold uppercase text-slate-500 mr-2 w-8">{file.type}</span>
                                        <span className="text-sm text-slate-700 truncate max-w-[120px]" title={file.name}>{file.name}</span>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={(e) => { e.stopPropagation(); setFileToDeleteId(file.id); }}
                                        className="text-slate-400 hover:text-red-500 p-1"
                                    >
                                        <CloseIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {isOcrLoading && <div className="text-sm text-blue-600 animate-pulse">Распознавание данных (AI)...</div>}
                    {ocrError && <div className="text-sm text-red-600">{ocrError}</div>}
                </div>
                
                {/* Right Panel: Preview */}
                <div className="w-2/3 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden relative">
                    {activeFile ? (
                        activeFile.type === 'image' ? (
                            <img src={`data:image/jpeg;base64,${activeFile.data}`} alt="preview" className="max-w-full max-h-full object-contain" />
                        ) : (
                            <iframe src={`data:application/pdf;base64,${activeFile.data}`} className="w-full h-full" title="PDF Preview" />
                        )
                    ) : (
                        <div className="text-slate-400 flex flex-col items-center">
                            <CloudUploadIcon className="w-12 h-12 mb-2 opacity-50" />
                            <p>Выберите файл для просмотра</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">Отмена</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Сохранить</button>
            </div>
            
            {fileToDeleteId && (
                <ConfirmationModal 
                    isOpen={true} 
                    onClose={() => setFileToDeleteId(null)} 
                    onConfirm={handleConfirmDeleteFile}
                    title="Удалить файл?"
                >
                    Вы уверены, что хотите удалить этот файл из сертификата?
                </ConfirmationModal>
            )}
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
            const cert = certificates.find(c => c.id === initialOpenId);
            if (cert) {
                setEditingCert(cert);
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

    const handleDelete = (id: string) => {
        // Check usage
        const usedInActs = acts.filter(a => a.materials.includes(`сертификат № ${certificates.find(c => c.id === id)?.number}`));
        if (usedInActs.length > 0) {
            if (!confirm(`Этот сертификат используется в ${usedInActs.length} актах. Вы уверены, что хотите удалить его?`)) {
                return;
            }
        }
        onDelete(id);
    };

    const filteredCertificates = useMemo(() => {
        return certificates.filter(c => 
            c.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
            c.materials.some(m => m.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [certificates, searchTerm]);

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold text-slate-800">Сертификаты и Паспорта</h1>
                <div className="flex gap-2">
                     <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Поиск..." 
                            className="border border-slate-300 rounded-md px-3 py-2 pl-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                     </div>
                    <button onClick={() => handleOpenModal()} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                        <PlusIcon /> Добавить
                    </button>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCertificates.map(cert => (
                        <div key={cert.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-slate-50 relative group">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-lg text-slate-800 break-all">{cert.number}</h3>
                                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleOpenModal(cert)} className="p-1 text-blue-600 hover:bg-blue-100 rounded">
                                        <EditIcon className="w-4 h-4" />
                                    </button>
                                     <button onClick={() => onUnlink(cert)} className="p-1 text-amber-600 hover:bg-amber-100 rounded" title="Убрать ссылки из актов">
                                        <LinkIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(cert.id)} className="p-1 text-red-600 hover:bg-red-100 rounded">
                                        <DeleteIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="text-sm text-slate-600 mb-1">
                                <span className="font-semibold">До:</span> {new Date(cert.validUntil).toLocaleDateString()}
                            </div>
                             <div className="text-sm text-slate-600 mb-3">
                                <span className="font-semibold">Файлов:</span> {cert.files?.length || (cert.fileData ? 1 : 0)} ({cert.amount || 0} стр.)
                            </div>
                            <div className="text-xs text-slate-500 border-t border-slate-200 pt-2 mt-2">
                                <p className="font-semibold mb-1">Материалы:</p>
                                <div className="flex flex-wrap gap-1">
                                    {cert.materials.slice(0, 3).map((m, i) => (
                                        <span key={i} className="bg-white border border-slate-200 px-1.5 py-0.5 rounded truncate max-w-[150px]">{m}</span>
                                    ))}
                                    {cert.materials.length > 3 && <span className="text-slate-400">+{cert.materials.length - 3}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredCertificates.length === 0 && (
                        <div className="col-span-full text-center py-10 text-slate-500">
                            Сертификаты не найдены.
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingCert ? 'Редактировать сертификат' : 'Новый сертификат'} maxWidth="max-w-5xl">
                    <CertificateForm 
                        certificate={editingCert} 
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