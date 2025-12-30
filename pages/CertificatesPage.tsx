
import React, { useState, useRef } from 'react';
import { Certificate } from '../types';
import Modal from '../components/Modal';
import { PlusIcon, DeleteIcon, EditIcon, CertificateIcon, CloseIcon } from '../components/Icons';

interface CertificatesPageProps {
    certificates: Certificate[];
    onSave: (cert: Certificate) => void;
    onDelete: (id: string) => void;
}

const CertificateForm: React.FC<{
    certificate: Certificate | null;
    onSave: (cert: Certificate) => void;
    onClose: () => void;
}> = ({ certificate, onSave, onClose }) => {
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (typeof event.target?.result === 'string') {
                setFormData(prev => ({
                    ...prev,
                    fileName: file.name,
                    fileType: file.type.includes('pdf') ? 'pdf' : 'image',
                    fileData: event.target!.result as string // full data url
                }));
            }
        };
        reader.readAsDataURL(file);
    };

    const handleAddMaterial = () => {
        if (!newMaterial.trim()) return;
        setFormData(prev => ({
            ...prev,
            materials: [...prev.materials, newMaterial.trim()]
        }));
        setNewMaterial('');
    };

    const handleRemoveMaterial = (index: number) => {
        setFormData(prev => ({
            ...prev,
            materials: prev.materials.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    const inputClass = "mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900";
    const labelClass = "block text-sm font-medium text-slate-700";

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Номер сертификата</label>
                    <input type="text" name="number" value={formData.number} onChange={handleChange} className={inputClass} required placeholder="№ 12345" />
                </div>
                <div>
                    <label className={labelClass}>Действителен до</label>
                    <input type="date" name="validUntil" value={formData.validUntil} onChange={handleChange} className={inputClass} required />
                </div>
            </div>

            <div>
                <label className={labelClass}>Файл документа (PDF или Изображение)</label>
                <div className="mt-1 flex items-center gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,image/*" />
                    <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-sm hover:bg-slate-200"
                    >
                        {formData.fileName ? 'Заменить файл' : 'Загрузить файл'}
                    </button>
                    <span className="text-sm text-slate-500 italic truncate max-w-xs">{formData.fileName || 'Файл не выбран'}</span>
                </div>
            </div>

            <div className="border-t pt-4">
                <label className={labelClass}>Материалы в сертификате</label>
                <div className="flex gap-2 mt-1 mb-2">
                    <input 
                        type="text" 
                        value={newMaterial} 
                        onChange={e => setNewMaterial(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddMaterial())}
                        className={inputClass} 
                        placeholder="Название материала (нажмите Enter)" 
                    />
                    <button 
                        type="button" 
                        onClick={handleAddMaterial}
                        className="mt-1 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 font-medium text-sm"
                    >
                        Добавить
                    </button>
                </div>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-md bg-slate-50 p-2 space-y-1">
                    {formData.materials.length === 0 && <p className="text-xs text-slate-400 text-center py-2">Список материалов пуст</p>}
                    {formData.materials.map((mat, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white px-3 py-1.5 rounded border border-slate-200 text-sm">
                            <span>{mat}</span>
                            <button type="button" onClick={() => handleRemoveMaterial(idx)} className="text-red-500 hover:text-red-700">
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">Отмена</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Сохранить</button>
            </div>
        </form>
    );
};

const CertificatesPage: React.FC<CertificatesPageProps> = ({ certificates, onSave, onDelete }) => {
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
            // Open simple preview in a new window/tab for simplicity or modal
            // Using modal for consistency
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
                        <div key={cert.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-slate-50 flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <CertificateIcon className="w-8 h-8 text-blue-500" />
                                    <div>
                                        <h3 className="font-bold text-slate-800">№ {cert.number}</h3>
                                        <p className="text-xs text-slate-500">До: {new Date(cert.validUntil).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => handleOpenModal(cert)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"><EditIcon className="w-4 h-4"/></button>
                                    <button onClick={() => onDelete(cert.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded"><DeleteIcon className="w-4 h-4"/></button>
                                </div>
                            </div>
                            
                            <div className="flex-grow mb-3">
                                <p className="text-xs font-semibold text-slate-500 mb-1 uppercase">Материалы:</p>
                                <ul className="text-sm text-slate-700 list-disc list-inside space-y-0.5 max-h-24 overflow-y-auto">
                                    {cert.materials.length > 0 ? cert.materials.map((m, i) => (
                                        <li key={i} className="truncate">{m}</li>
                                    )) : <li className="text-slate-400 italic">Нет материалов</li>}
                                </ul>
                            </div>

                            <div className="mt-auto pt-3 border-t border-slate-200 flex justify-between items-center">
                                <span className="text-xs text-slate-400 truncate max-w-[150px]" title={cert.fileName}>{cert.fileName || "Нет файла"}</span>
                                {cert.fileData && (
                                    <button 
                                        onClick={() => handlePreview(cert)}
                                        className="text-xs text-blue-600 hover:underline font-medium"
                                    >
                                        Просмотр
                                    </button>
                                )}
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
                <CertificateForm certificate={editingCert} onSave={onSave} onClose={handleCloseModal} />
            </Modal>

            {previewFile && (
                <Modal isOpen={!!previewFile} onClose={() => setPreviewFile(null)} title="Просмотр документа">
                    <div className="h-[70vh] w-full flex items-center justify-center bg-slate-100 rounded overflow-hidden">
                        {previewFile.type === 'pdf' ? (
                            <iframe src={previewFile.data} className="w-full h-full" title="PDF Preview" />
                        ) : (
                            <img src={previewFile.data} alt="Certificate" className="max-w-full max-h-full object-contain" />
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default CertificatesPage;