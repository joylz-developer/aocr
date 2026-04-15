import React from 'react';
import { ExecutiveScheme, Act } from '../types';
import { SchemeIcon, EditIcon, ArrowRightIcon } from './Icons';

interface SchemesPopoverProps {
    scheme: ExecutiveScheme;
    act: Act;
    position: { top: number, left: number };
    onClose: () => void;
    onNavigate?: () => void;
    onReplace: () => void;
}

const SchemesPopover: React.FC<SchemesPopoverProps> = ({ scheme, position, onClose, onNavigate, onReplace }) => {
    return (
        <div
            className="absolute z-50 bg-white border border-indigo-200 shadow-xl rounded-lg p-3 w-72 animate-fade-in-up"
            style={{ top: position.top, left: position.left }}
            onMouseDown={e => e.stopPropagation()}
        >
            <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded">
                    <SchemeIcon className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="font-bold text-slate-800 text-sm leading-tight">{scheme.name}</h4>
                    <div className="text-xs text-slate-500 mt-1">№ {scheme.number} | Листов: {scheme.amount}</div>
                </div>
            </div>

            <div className="flex flex-col gap-1.5 mt-3 pt-2 border-t border-slate-100">
                <button
                    onClick={onReplace}
                    className="w-full text-left px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded flex items-center gap-2 transition-colors font-medium"
                >
                    <EditIcon className="w-3.5 h-3.5" />
                    Заменить схему
                </button>
                {onNavigate && (
                    <button
                        onClick={onNavigate}
                        className="w-full text-left px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded flex items-center gap-2 transition-colors font-medium"
                    >
                        <ArrowRightIcon className="w-3.5 h-3.5" />
                        Перейти на страницу схем
                    </button>
                )}
            </div>
        </div>
    );
};

export default SchemesPopover;