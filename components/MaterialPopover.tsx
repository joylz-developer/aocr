import React, { useEffect, useRef, useMemo } from 'react';
import { Act, Certificate } from '../types';
import { CloseIcon, LinkIcon, CheckIcon } from './Icons';

interface MaterialPopoverProps {
    certificate: Certificate;
    act: Act;
    position: { top: number; left: number };
    onClose: () => void;
    onNavigate?: (id: string) => void;
    onUpdateAct: (updatedAct: Act) => void;
}

const MaterialPopover: React.FC<MaterialPopoverProps> = ({
    certificate,
    act,
    position,
    onClose,
    onNavigate,
    onUpdateAct
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Закрытие по клику вне окна и по клавише Esc
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    // Парсим текущие материалы акта
    const currentMaterials = useMemo(() => {
        return (act.materials || '').split(';').map(s => s.trim()).filter(Boolean);
    }, [act.materials]);

    // Хелпер для форматирования строки материала
    const getMaterialString = (matName: string) => `${matName} (сертификат № ${certificate.number})`;

    // Проверяем, выбран ли уже материал в акте
    const isMaterialSelected = (matName: string) => {
        const expectedStr = getMaterialString(matName);
        return currentMaterials.includes(expectedStr) || currentMaterials.some(m => m.startsWith(matName) && m.includes(`№ ${certificate.number}`));
    };

    const handleToggle = (matName: string) => {
        const expectedStr = getMaterialString(matName);
        const selected = isMaterialSelected(matName);
        
        let newMaterials: string[];
        if (selected) {
            // Удаляем
            newMaterials = currentMaterials.filter(m => !(m.startsWith(matName) && m.includes(certificate.number)));
        } else {
            // Добавляем
            newMaterials = [...currentMaterials, expectedStr];
        }
        
        onUpdateAct({ ...act, materials: newMaterials.join('; ') });
    };

    const handleSelectAll = () => {
        // Находим материалы, которых еще нет в акте
        const toAdd = certificate.materials
            .filter(m => !isMaterialSelected(m))
            .map(m => getMaterialString(m));
            
        if (toAdd.length > 0) {
            onUpdateAct({ ...act, materials: [...currentMaterials, ...toAdd].join('; ') });
        }
    };

    const handleDeselectAll = () => {
        // Оставляем только те материалы в акте, которые НЕ принадлежат этому сертификату
        const newMaterials = currentMaterials.filter(m => 
            !certificate.materials.some(certMat => m.startsWith(certMat) && m.includes(certificate.number))
        );
        onUpdateAct({ ...act, materials: newMaterials.join('; ') });
    };

    return (
        <div 
            ref={containerRef}
            className="absolute z-50 bg-white [.theme-dark_&]:bg-[#161b22] border border-slate-200 [.theme-dark_&]:border-slate-700 shadow-2xl rounded-lg w-[400px] flex flex-col animate-fade-in-up"
            // Небольшая корректировка позиции, чтобы поповер не уходил за левый край экрана
            style={{ top: position.top + 10, left: Math.max(10, position.left - 200) }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Шапка окна */}
            <div className="p-4 border-b border-slate-100 [.theme-dark_&]:border-slate-800/80 flex items-start justify-between bg-slate-50 [.theme-dark_&]:bg-[#0d1117] rounded-t-lg">
                <div className="flex items-start gap-3">
                    <div className="bg-green-100 [.theme-dark_&]:bg-green-900/30 text-green-600 [.theme-dark_&]:text-green-400 p-1.5 rounded-full shrink-0">
                        <CheckIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 [.theme-dark_&]:text-slate-200 text-sm leading-tight mb-1">
                            № {certificate.number}
                        </h4>
                        <p className="text-xs text-slate-500 [.theme-dark_&]:text-slate-400">
                            {certificate.dateFrom 
                                ? `Дата документа: ${new Date(certificate.dateFrom).toLocaleDateString()}` 
                                : (certificate.validUntil ? `Действителен до: ${new Date(certificate.validUntil).toLocaleDateString()}` : 'Дата не указана')}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 [.theme-dark_&]:text-slate-500 [.theme-dark_&]:hover:text-slate-300 p-1 hover:bg-slate-200 [.theme-dark_&]:hover:bg-slate-700/50 rounded transition-colors">
                    <CloseIcon className="w-4 h-4" />
                </button>
            </div>

            {/* Тело (Список материалов) */}
            <div className="p-4 max-h-[300px] overflow-y-auto">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 [.theme-dark_&]:text-slate-500 tracking-wider">
                        Материалы сертификата
                    </span>
                    <div className="flex gap-3">
                        <button onClick={handleSelectAll} className="text-[10px] font-bold text-blue-600 [.theme-dark_&]:text-blue-400 hover:underline">Выбрать все</button>
                        <button onClick={handleDeselectAll} className="text-[10px] font-bold text-slate-500 [.theme-dark_&]:text-slate-400 hover:underline">Снять все</button>
                    </div>
                </div>
                
                <div className="space-y-2">
                    {certificate.materials.length === 0 ? (
                        <p className="text-xs text-slate-500 [.theme-dark_&]:text-slate-400 italic text-center py-4 border border-dashed border-slate-200 [.theme-dark_&]:border-slate-700 rounded">
                            В сертификате не указаны материалы
                        </p>
                    ) : (
                        certificate.materials.map((mat, idx) => {
                            const selected = isMaterialSelected(mat);
                            return (
                                <label 
                                    key={idx} 
                                    className={`flex items-start gap-3 p-2.5 rounded-md border cursor-pointer transition-colors
                                        ${selected 
                                            ? 'bg-blue-50 border-blue-200 [.theme-dark_&]:bg-blue-900/30 [.theme-dark_&]:border-blue-800' 
                                            : 'bg-white border-slate-200 hover:bg-slate-50 [.theme-dark_&]:bg-[#0d1117] [.theme-dark_&]:border-slate-700 [.theme-dark_&]:hover:bg-[#1f242d]'}
                                    `}
                                >
                                    <input 
                                        type="checkbox" 
                                        className="form-checkbox-custom w-4 h-4 mt-0.5 shrink-0"
                                        checked={selected}
                                        onChange={() => handleToggle(mat)}
                                    />
                                    <span className={`text-sm leading-tight ${selected ? 'text-blue-900 [.theme-dark_&]:text-blue-200 font-medium' : 'text-slate-700 [.theme-dark_&]:text-slate-300'}`}>
                                        {mat}
                                    </span>
                                </label>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Подвал (Кнопка перехода) */}
            {onNavigate && (
                <div className="p-3 border-t border-slate-100 [.theme-dark_&]:border-slate-800 bg-slate-50 [.theme-dark_&]:bg-[#0d1117] rounded-b-lg mt-auto">
                    <button 
                        onClick={() => onNavigate(certificate.id)}
                        className="w-full py-2 flex items-center justify-center gap-2 text-sm bg-slate-200 hover:bg-slate-300 [.theme-dark_&]:bg-slate-800 [.theme-dark_&]:hover:bg-slate-700 text-slate-700 [.theme-dark_&]:text-slate-300 font-medium rounded transition-colors"
                    >
                        <LinkIcon className="w-4 h-4" /> Перейти на страницу сертификата
                    </button>
                </div>
            )}
        </div>
    );
};

export default MaterialPopover;