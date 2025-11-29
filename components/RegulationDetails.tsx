import React from 'react';
import { Regulation } from '../types';
import { CloseIcon } from './Icons';

interface RegulationDetailsProps {
    regulation: Regulation;
    onClose: () => void;
}

const RegulationDetails: React.FC<RegulationDetailsProps> = ({ regulation, onClose }) => {
    // If fullJson exists, render key fields from it, otherwise use the Regulation interface fields
    const details = regulation.fullJson || {
        "Обозначение": regulation.designation,
        "Полное название": regulation.fullName,
        "Статус": regulation.status,
        "Заглавие": regulation.title,
        "Дата утверждения": regulation.approvalDate,
        "Дата регистрации": regulation.registrationDate,
        "Дата введения": regulation.activeDate,
        "Утвержден": regulation.orgApprover,
        "Заменен на": regulation.replacement
    };

    const getStatusColor = (status: string) => {
        if (!status) return 'bg-gray-100 text-gray-800 border-gray-200';
        if (status.toLowerCase().includes('действует')) return 'bg-green-100 text-green-800 border-green-200';
        if (status.toLowerCase().includes('заменен') || status.toLowerCase().includes('отменен')) return 'bg-red-100 text-red-800 border-red-200';
        return 'bg-blue-100 text-blue-800 border-blue-200';
    };

    return (
        <div className="flex flex-col h-full max-h-[80vh] overflow-hidden rounded-lg bg-white">
            {/* Sticky Header */}
            <div className="flex justify-between items-start p-6 border-b border-slate-200 bg-white sticky top-0 z-10 flex-shrink-0 shadow-sm">
                <div className="pr-8">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-2xl font-bold text-slate-800">{regulation.designation}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(regulation.status)}`}>
                            {regulation.status}
                        </span>
                    </div>
                    <p className="text-sm text-slate-600 font-medium leading-snug">{regulation.title}</p>
                </div>
                <button 
                    onClick={onClose} 
                    className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors"
                    title="Закрыть"
                >
                    <CloseIcon className="w-6 h-6" />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-grow p-6">
                <table className="w-full text-sm text-left border-collapse">
                    <tbody>
                        {Object.entries(details).map(([key, value]) => {
                            if (!value || typeof value === 'object') return null;
                            // Skip showing Designation/Status/Title again if needed, or keep for completeness
                            return (
                                <tr key={key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                    <td className="py-3 pr-4 font-medium text-slate-500 align-top w-1/3 min-w-[150px]">{key}</td>
                                    <td className="py-3 text-slate-800 align-top whitespace-pre-wrap leading-relaxed">{String(value)}</td>
                                </li>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            {/* Footer removed as requested (only top close button) */}
        </div>
    );
};

export default RegulationDetails;