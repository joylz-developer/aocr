
import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Certificate } from '../types';
import { CertificateIcon, PlusIcon } from './Icons';

interface MaterialsModalProps {
    isOpen: boolean;
    onClose: () => void;
    certificates: Certificate[];
    onSelect: (selectedString: string) => void;
}

const MaterialsModal: React.FC<MaterialsModalProps> = ({ isOpen, onClose, certificates, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCertId, setExpandedCertId] = useState<string | null>(null);

    const filteredCertificates = useMemo(() => {
        if (!searchTerm) return certificates;
        const lower = searchTerm.toLowerCase();
        return certificates.filter(c => 
            c.number.toLowerCase().includes(lower) || 
            c.materials.some(m => m.toLowerCase().includes(lower))
        );
    }, [certificates, searchTerm]);

    const handleSelectMaterial = (cert: Certificate, materialName: string) => {
        // Format: "Material Name, сертификат соответствия № 123 от YYYY-MM-DD"
        // Adjusting date format to dd.mm.yyyy
        const dateObj = new Date(cert.validUntil);
        const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('ru-RU') : cert.validUntil;
        
        const resultString = `${materialName} (сертификат № ${cert.number}, действителен до ${dateStr})`;
        onSelect(resultString);
    };

    const toggleExpand = (id: string) => {
        setExpandedCertId(prev => prev === id ? null : id);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Выбор материала из сертификатов">
            <div className="flex flex-col h-[60vh]">
                <div className="mb-4">
                    <input 
                        type="text" 
                        placeholder="Поиск по номеру сертификата или названию материала..." 
                        className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="flex-grow overflow-y-auto border border-slate-200 rounded-md bg-slate-50 p-2 space-y-2">
                    {filteredCertificates.length > 0 ? filteredCertificates.map(cert => {
                        const isExpanded = expandedCertId === cert.id || searchTerm.length > 0;
                        return (
                            <div key={cert.id} className="bg-white border border-slate-200 rounded-md overflow-hidden">
                                <div 
                                    className="p-3 bg-slate-50 hover:bg-slate-100 cursor-pointer flex justify-between items-center"
                                    onClick={() => toggleExpand(cert.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <CertificateIcon className="w-5 h-5 text-slate-500" />
                                        <div>
                                            <span className="font-semibold text-slate-700">Сертификат № {cert.number}</span>
                                            <span className="text-xs text-slate-500 ml-2">(до {new Date(cert.validUntil).toLocaleDateString()})</span>
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-400">{cert.materials.length} мат.</span>
                                </div>
                                
                                {isExpanded && (
                                    <div className="border-t border-slate-100">
                                        {cert.materials.length > 0 ? (
                                            cert.materials.map((mat, idx) => (
                                                <button
                                                    key={idx}
                                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 border-b border-slate-50 last:border-0 flex items-center group"
                                                    onClick={() => handleSelectMaterial(cert, mat)}
                                                >
                                                    <PlusIcon className="w-3 h-3 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    {mat}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-2 text-xs text-slate-400 italic text-center">Нет материалов</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    }) : (
                         <div className="text-center py-10 text-slate-500">
                            Ничего не найдено.
                        </div>
                    )}
                </div>

                <div className="mt-4 flex justify-end">
                    <button onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">
                        Закрыть
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default MaterialsModal;