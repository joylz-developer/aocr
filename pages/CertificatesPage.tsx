import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Certificate, CertificateFile, ProjectSettings, Act } from '../types';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import { PlusIcon, EditIcon, DeleteIcon, CloudUploadIcon, CloseIcon, LinkIcon, SparklesIcon } from '../components/Icons';
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

const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error('Failed to read file as base64 string.'));
            }
        };
        reader.onerror = (error) => reject(error);
    });

// Rudimentary PDF page counter
const countPdfPages = (base64: string): number => {
    try {
        const binary = atob(base64);
        // This is a heuristic. It counts /Type /Page occurrences.
        // It might not work for all PDFs (e.g. linearized or sophisticated structures),
        // but works for basic generated PDFs.
        const matches = binary.match(/\/Type\s*\/Page\b/g);
        return matches ? matches.length : 1;
    } catch (e) {
        console.warn("Could not count PDF pages", e);
        return 1;
    }
};

const CertificateForm: React.FC<{
    certificate: Certificate | null;
    settings: ProjectSettings;
    onSave: (cert: Certificate) => void;
    onClose: () => void;
}> = ({ certificate, settings, onSave, onClose }) => {
    // Initialize form data. Handle legacy single-file structure if present.
    const [formData, setFormData] = useState<Certificate>(() => {
        if (certificate) {
             // Migrate legacy file if needed
             let files = certificate.files || [];
             if (files.length === 0 && certificate.fileData) {
                 files = [{
                     id: crypto.randomUUID(),
                     type: certificate.fileType || 'image',
                     name: certificate.fileName || 'document',
                     data: certificate.fileData
                 }];
             }
             return { ...certificate, files };
        }
        return {
            id: crypto.randomUUID(),
            number: '',
            validUntil: '',
            amount: '1',
            files: [],
            materials: []
        };
    });

    const [activeFileId, setActiveFileId] = useState<string | null>(
        formData.files.length > 0 ? formData.files[0].id : null
    );
    
    // Auto-select first file if activeFileId is invalid
    useEffect(() => {
        if (formData.files.length > 0 && !formData.files.find(f => f.id === activeFileId)) {
            setActiveFileId(formData.files[0].id);
        }
    }, [formData.files, activeFileId]);

    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [fileToDeleteId, setFileToDeleteId] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const ocrInputRef = useRef<HTMLInputElement>(null);
    const ai = settings.geminiApiKey ? new GoogleGenAI({ apiKey: settings.geminiApiKey }) : null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const uploadedFiles = Array.from(e.target.files);
            const newCertFiles: CertificateFile[] = [];
            
            for (const file of uploadedFiles) {
                try {
                    const base64 = await fileToBase64(file);
                    const isPdf = file.type === 'application/pdf';
                    
                    newCertFiles.push({
                        id: crypto.randomUUID(),
                        type: isPdf ? 'pdf' : 'image',
                        name: file.name,
                        data: base64
                    });
                } catch (err) {
                    console.error("Error uploading file", err);
                }
            }

            setFormData(prev => {
                const updatedFiles = [...prev.files, ...newCertFiles];
                
                // Recalculate amount
                const totalPages = updatedFiles.reduce((sum, f) => {
                    return sum + (f.type === 'pdf' ? countPdfPages(f.data) : 1);
                }, 0);

                return {
                    ...prev,
                    files: updatedFiles,
                    amount: String(totalPages)
                };
            });
            
            if (newCertFiles.length > 0 && !activeFileId) {
                setActiveFileId(newCertFiles[0].id);
            }
        }
        if (e.target) e.target.value = '';
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

    // OCR Logic
    const handleOcrClick = () => {
         ocrInputRef.current?.click();
    };

    const handleOcrFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !ai) return;

        setIsOcrLoading(true);
        try {
            const base64 = await fileToBase64(file);
            const mimeType = file.type;

            const prompt = `Analyze this certificate image. Extract:
            1. "number": Certificate number.
            2. "validUntil": Expiration date in YYYY-MM-DD format.
            3. "materials": List of materials covered.
            
            Return JSON only.`;

            const imagePart = { inlineData: { mimeType, data: base64 } };
            const textPart = { text: prompt };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [imagePart, textPart] },
                config: { responseMimeType: "application/json" }
            });

            const result = JSON.parse(response.text);

            setFormData(prev => ({
                ...prev,
                number: result.number || prev.number,
                validUntil: result.validUntil || prev.validUntil,
                materials: result.materials ? [...new Set([...prev.materials, ...result.materials])] : prev.materials
            }));

        } catch (error) {
            console.error("OCR error:", error);
            alert("Не удалось распознать сертификат.");
        } finally {
            setIsOcrLoading(false);
            if(event.target) event.target.value = '';
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    const activeFile = formData.files.find(f => f.id === activeFileId);

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-[80vh]">
            <div className="flex-shrink-0 space-y-4 p-1">
                 {ai && (
                    <div className="mb-4">
                        <input type="file" ref={ocrInputRef} onChange={handleOcrFileSelected} className="hidden" accept="image/*" />
                        <button type="button" onClick={handleOcrClick} disabled={isOcrLoading} className="w-full flex justify-center items-center gap-2 px-4 py-2 border border-violet-300 text-sm font-medium rounded-md shadow-sm text-violet-700 bg-violet-50 hover:bg-violet-100 disabled:opacity-50">
                            <SparklesIcon className="w-4 h-4"/> {isOcrLoading ? "Анализ..." : "Заполнить через AI (Фото)"}
                        </button>
                    </div>
                 )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Номер сертификата</label>
                        <input type="text" name="number" value={formData.number} onChange={handleChange} className="mt-1 block w-full border border-slate-300 rounded-md p-2" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Действителен до</label>
                        <input type="date" name="validUntil" value={formData.validUntil} onChange={handleChange} className="mt-1 block w-full border border-slate-300 rounded-md p-2" required />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Кол-во листов</label>
                        <input type="number" name="amount" value={formData.amount} onChange={handleChange} className="mt-1 block w-full border border-slate-300 rounded-md p-2" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Файлы</label>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {formData.files.map((file, idx) => (
                            <div 
                                key={file.id} 
                                className={`relative group cursor-pointer border rounded-md p-2 min-w-[80px] text-center ${activeFileId === file.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                                onClick={() => setActiveFileId(file.id)}
                            >
                                <div className="text-xs font-semibold truncate max-w-[100px]">{file.name}</div>
                                <div className="text-[10px] text-slate-500 uppercase">{file.type}</div>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setFileToDeleteId(file.id); }}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <CloseIcon className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                         <label className="cursor-pointer border border-dashed border-slate-300 rounded-md p-2 min-w-[80px] flex flex-col items-center justify-center hover:bg-slate-50 text-slate-500 hover:text-blue-600 transition-colors">
                            <PlusIcon className="w-5 h-5 mb-1" />
                            <span className="text-xs">Add</span>
                            <input type="file" multiple accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" />
                        </label>
                    </div>
                </div>
            </div>
            
            <div className="flex-grow border rounded-md bg-slate-100 relative mt-2 overflow-hidden flex items-center justify-center">
                {activeFile ? (
                    activeFile.type === 'pdf' ? (
                        <iframe 
                            src={`data:application/pdf;base64,${activeFile.data}`} 
                            className="w-full h-full" 
                            title="PDF Preview"
                        />
                    ) : (
                        <img 
                            src={`data:image/jpeg;base64,${activeFile.data}`} 
                            alt="Preview" 
                            className="max-w-full max-h-full object-contain" 
                        />
                    )
                ) : (
                    <div className="text-slate-400 flex flex-col items-center">
                        <CloudUploadIcon className="w-12 h-12 mb-2" />
                        <p>Нет файлов для просмотра</p>
                    </div>
                )}
            </div>

            <div className="flex-shrink-0 flex justify-end gap-3 pt-4 border-t mt-4">
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

    // Handle initial open request (e.g. from ActsPage link)
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

    const filteredCertificates = useMemo(() => {
        if (!searchTerm) return certificates;
        const lower = searchTerm.toLowerCase();
        return certificates.filter(c => 
            c.number.toLowerCase().includes(lower) || 
            c.materials.some(m => m.toLowerCase().includes(lower))
        );
    }, [certificates, searchTerm]);

    const handleEdit = (cert: Certificate) => {
        setEditingCert(cert);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (confirm("Переместить сертификат в корзину?")) {
            onDelete(id);
        }
    };
    
    // Check usage
    const getUsageCount = (cert: Certificate) => {
        let count = 0;
        acts.forEach(act => {
             if (act.materials.includes(cert.number)) count++;
        });
        return count;
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold text-slate-800">Сертификаты</h1>
                <button 
                    onClick={() => { setEditingCert(null); setIsModalOpen(true); }} 
                    className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    <PlusIcon /> Добавить
                </button>
            </div>
            
            <div className="mb-4">
                <input 
                    type="text" 
                    placeholder="Поиск по номеру или материалу..." 
                    className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="flex-grow overflow-auto border rounded-md">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Номер</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Срок действия</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Материалы</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Файлы</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {filteredCertificates.length > 0 ? filteredCertificates.map(cert => {
                            const isExpired = new Date(cert.validUntil) < new Date();
                            const usage = getUsageCount(cert);
                            
                            return (
                                <tr key={cert.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{cert.number}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={isExpired ? "text-red-600 font-bold" : "text-slate-600"}>
                                            {new Date(cert.validUntil).toLocaleDateString()}
                                            {isExpired && " (Истек)"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={cert.materials.join(', ')}>
                                        {cert.materials.length > 0 ? cert.materials.join(', ') : <span className="text-slate-400 italic">Нет материалов</span>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                        {(cert.files && cert.files.length > 0) ? (
                                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                 {cert.files.length} файл(а)
                                             </span>
                                        ) : (cert.fileData ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                 1 файл (Legacy)
                                             </span>
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        ))}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end space-x-2">
                                            {usage > 0 && (
                                                <button onClick={() => onUnlink(cert)} className="p-2 text-amber-600 hover:bg-amber-100 rounded-full" title="Отвязать от актов">
                                                    <LinkIcon className="w-5 h-5" />
                                                </button>
                                            )}
                                            <button onClick={() => handleEdit(cert)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full" title="Редактировать">
                                                <EditIcon className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => handleDelete(cert.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full" title="Удалить">
                                                <DeleteIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={5} className="text-center py-10 text-slate-500">
                                    Сертификаты не найдены.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <Modal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    title={editingCert ? "Редактирование сертификата" : "Новый сертификат"}
                    maxWidth="max-w-4xl"
                >
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
