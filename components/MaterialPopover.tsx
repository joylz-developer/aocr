
import React from 'react';
import { Certificate } from '../types';
import { CertificateIcon, LinkIcon } from './Icons';

interface MaterialPopoverProps {
    certificate: Certificate;
    materialName: string; // The specific material text clicked
    position: { top: number; left: number };
    onClose: () => void;
    onNavigate?: (certId: string) => void;
}

const MaterialPopover: React.FC<MaterialPopoverProps> = ({ certificate, materialName, position, onClose, onNavigate }) => {
    // Determine status - strictly based on existence in DB (which this component assumes since it receives a 'certificate' obj)
    // Date is informative only
    const validUntilDate = new Date(certificate.validUntil);
    const dateStr = !isNaN(validUntilDate.getTime()) ? validUntilDate.toLocaleDateString() : certificate.validUntil;

    return (
        <div 
            className="absolute z-50 bg-white border border-slate-200 shadow-xl rounded-lg p-4 w-72 animate-fade-in-up flex flex-col gap-3"
            style={{ top: position.top, left: position.left }}
            onMouseDown={e => e.stopPropagation()} 
        >
            <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 text-green-600 rounded-full flex-shrink-0">
                    <CertificateIcon className="w-6 h-6" />
                </div>
                <div>
                    <h4 className="font-bold text-slate-800 text-sm leading-tight mb-1">Сертификат подтвержден</h4>
                    <p className="text-xs text-slate-500">Документ найден в базе</p>
                </div>
            </div>

            <div className="text-xs bg-slate-50 p-2 rounded border border-slate-100 space-y-1">
                <div><span className="font-semibold text-slate-700">Номер:</span> {certificate.number}</div>
                <div><span className="font-semibold text-slate-700">Дата документа:</span> {dateStr}</div>
                <div className="pt-1 mt-1 border-t border-slate-200">
                    <span className="font-semibold text-slate-700 block mb-0.5">Упоминание в тексте:</span>
                    <span className="text-slate-600 italic">"{materialName}"</span>
                </div>
            </div>

            {onNavigate && (
                <button
                    onClick={() => onNavigate(certificate.id)}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-xs font-medium py-2 rounded hover:bg-blue-700 transition-colors"
                >
                    <LinkIcon className="w-3 h-3" /> Перейти к сертификату
                </button>
            )}
        </div>
    );
};

export default MaterialPopover;
