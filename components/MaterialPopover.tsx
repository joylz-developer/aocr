
import React from 'react';
import { Certificate, CertificateFile } from '../types';
import { CertificateIcon } from './Icons';

interface MaterialPopoverProps {
    certificate: Certificate;
    materialName: string; // The specific material text clicked
    position: { top: number; left: number };
    onClose: () => void;
}

const MaterialPopover: React.FC<MaterialPopoverProps> = ({ certificate, materialName, position, onClose }) => {
    // Determine status based on date
    const today = new Date();
    const validUntilDate = new Date(certificate.validUntil);
    const isExpired = validUntilDate < today;
    
    // Get main file for thumbnail
    const mainFile: CertificateFile | undefined = certificate.files?.[0] || 
        (certificate.fileData ? { id: 'legacy', type: certificate.fileType || 'image', data: certificate.fileData, name: 'Legacy' } : undefined);

    const isPdf = mainFile?.type === 'pdf';

    return (
        <div 
            className="absolute z-50 bg-white border border-slate-200 shadow-xl rounded-lg p-3 w-80 animate-fade-in-up flex flex-col gap-3"
            style={{ top: position.top, left: position.left }}
            onMouseDown={e => e.stopPropagation()} 
        >
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-bold text-slate-800 text-sm">Сертификат № {certificate.number}</h4>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${isExpired ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        {isExpired ? 'Истек: ' : 'Действует до: '} {validUntilDate.toLocaleDateString()}
                    </span>
                </div>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                <span className="font-semibold block mb-1">Упоминание в тексте:</span>
                "{materialName}"
            </div>

            {/* Thumbnail Preview */}
            <div className="w-full h-32 bg-slate-100 rounded border border-slate-200 overflow-hidden flex items-center justify-center relative group">
                {mainFile ? (
                    isPdf ? (
                        <div className="flex flex-col items-center text-slate-400">
                            <CertificateIcon className="w-10 h-10 mb-1" />
                            <span className="text-[10px]">PDF Документ</span>
                        </div>
                    ) : (
                        <img src={mainFile.data} alt="Thumbnail" className="w-full h-full object-cover" />
                    )
                ) : (
                    <span className="text-xs text-slate-400">Нет изображения</span>
                )}
            </div>
            
            <div className="text-[10px] text-slate-400 text-center">
                Всего материалов в сертификате: {certificate.materials.length}
            </div>
        </div>
    );
};

export default MaterialPopover;
