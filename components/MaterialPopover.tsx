import React, { useState } from 'react';
import { Certificate, Act } from '../types';
import { CertificateIcon, LinkIcon, EditIcon, RestoreIcon, CloseIcon, CheckIcon } from './Icons';

interface ActWithMappings extends Act {
    materialMappings?: Record<string, string>;
}

interface MaterialPopoverProps {
    certificate: Certificate;
    act: Act;
    position: { top: number; left: number };
    onClose: () => void;
    onNavigate?: (certId: string) => void;
    onUpdateAct: (updatedAct: Act) => void;
}

const MaterialPopover: React.FC<MaterialPopoverProps> = ({ certificate, act, position, onClose, onNavigate, onUpdateAct }) => {
    // Получаем кастомные маппинги (локальные переименования), если они есть в акте
    const actWithMaps = act as ActWithMappings;
    const mappings = actWithMaps.materialMappings || {};
    
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const validUntilDate = new Date(certificate.validUntil);
    const dateStr = !isNaN(validUntilDate.getTime()) ? validUntilDate.toLocaleDateString() : certificate.validUntil;

    // Включение/Отключение материала в акте
    const handleToggle = (origMat: string, localName: string, isCurrentlyChecked: boolean) => {
        const searchStr = `${localName} (сертификат № ${certificate.number})`;
        const materialsArray = act.materials.split(';').map(s => s.trim()).filter(Boolean);
        
        if (isCurrentlyChecked) {
            const newArray = materialsArray.filter(m => m !== searchStr);
            onUpdateAct({ ...act, materials: newArray.join('; ') });
        } else {
            materialsArray.push(searchStr);
            onUpdateAct({ ...act, materials: materialsArray.join('; ') });
        }
    };

    // Начало редактирования
    const startEdit = (origMat: string, localName: string) => {
        setEditingKey(origMat);
        setEditValue(localName);
    };

    // Сохранение измененного названия
    const saveEdit = (origMat: string, oldLocalName: string) => {
        if (!editValue.trim() || editValue.trim() === oldLocalName) {
            setEditingKey(null);
            return;
        }
        
        const newLocalName = editValue.trim();
        const oldSearchStr = `${oldLocalName} (сертификат № ${certificate.number})`;
        const newSearchStr = `${newLocalName} (сертификат № ${certificate.number})`;
        
        const materialsArray = act.materials.split(';').map(s => s.trim()).filter(Boolean);
        const index = materialsArray.indexOf(oldSearchStr);
        
        if (index !== -1) {
            materialsArray[index] = newSearchStr;
        } else {
            materialsArray.push(newSearchStr);
        }
        
        const mappingKey = `${certificate.number}::${origMat}`;
        const newMappings = { ...mappings, [mappingKey]: newLocalName };
        
        onUpdateAct({ 
            ...act, 
            materials: materialsArray.join('; '),
            materialMappings: newMappings
        } as Act);
        
        setEditingKey(null);
    };

    // Сброс к оригинальному названию
    const resetEdit = (origMat: string, currentLocalName: string) => {
        const oldSearchStr = `${currentLocalName} (сертификат № ${certificate.number})`;
        const newSearchStr = `${origMat} (сертификат № ${certificate.number})`;
        
        const materialsArray = act.materials.split(';').map(s => s.trim()).filter(Boolean);
        const index = materialsArray.indexOf(oldSearchStr);
        if (index !== -1) {
            materialsArray[index] = newSearchStr;
        }
        
        const mappingKey = `${certificate.number}::${origMat}`;
        const newMappings = { ...mappings };
        delete newMappings[mappingKey];
        
        onUpdateAct({ 
            ...act, 
            materials: materialsArray.join('; '),
            materialMappings: newMappings
        } as Act);
    };

    return (
        <div 
            className="absolute z-50 bg-white border border-slate-200 shadow-xl rounded-lg w-[420px] animate-fade-in-up flex flex-col"
            style={{ top: position.top, left: position.left }}
            onMouseDown={e => e.stopPropagation()} 
            onKeyDown={e => {
                // Блокируем всплытие всех клавиш (в т.ч. Backspace и Delete), 
                // чтобы таблица на заднем фоне не очищала ячейку. 
                // Пропускаем только Escape для закрытия окна.
                if (e.key !== 'Escape') {
                    e.stopPropagation();
                }
            }}
        >
            {/* Шапка с Номером и Датой */}
            <div className="bg-slate-50 p-4 border-b border-slate-200 rounded-t-lg flex justify-between items-start">
                <div className="flex gap-3 items-center">
                    <div className="p-2 bg-green-100 text-green-600 rounded-full flex-shrink-0">
                        <CertificateIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 text-sm leading-tight">№ {certificate.number}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Дата документа: {dateStr}</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors p-1 bg-white rounded-full shadow-sm border border-slate-200">
                    <CloseIcon className="w-4 h-4" />
                </button>
            </div>

            {/* Тело со списком материалов */}
            <div className="p-4 flex-grow flex flex-col gap-2 max-h-80 overflow-y-auto bg-white">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Материалы сертификата (Выбор для текущего акта)</p>
                
                {certificate.materials.length === 0 && (
                    <p className="text-xs text-slate-400 italic">В сертификате не указаны материалы.</p>
                )}

                {certificate.materials.map(origMat => {
                    const mappingKey = `${certificate.number}::${origMat}`;
                    const localName = mappings[mappingKey] || origMat;
                    const searchStr = `${localName} (сертификат № ${certificate.number})`;
                    
                    const materialsArray = act.materials.split(';').map(s => s.trim()).filter(Boolean);
                    const isChecked = materialsArray.includes(searchStr);

                    const isEditing = editingKey === origMat;

                    return (
                        <div key={origMat} className={`flex items-center gap-2 p-2 rounded-md border transition-colors ${isChecked ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                            <input 
                                type="checkbox" 
                                checked={isChecked} 
                                onChange={() => handleToggle(origMat, localName, isChecked)}
                                className="w-4 h-4 form-checkbox-custom cursor-pointer flex-shrink-0"
                            />
                            
                            {isEditing ? (
                                <div className="flex-grow flex items-center gap-1">
                                    <input 
                                        type="text" 
                                        value={editValue} 
                                        onChange={e => setEditValue(e.target.value)}
                                        className="w-full text-xs border-blue-400 focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 outline-none"
                                        autoFocus
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') saveEdit(origMat, localName);
                                            if (e.key === 'Escape') {
                                                e.stopPropagation(); // Останавливаем Escape, чтобы отменить только ввод, а не закрыть всё окно
                                                setEditingKey(null);
                                            }
                                        }}
                                    />
                                    <button onClick={() => saveEdit(origMat, localName)} className="text-green-600 hover:text-green-700 bg-green-50 p-1 rounded"><CheckIcon className="w-4 h-4"/></button>
                                    <button onClick={() => setEditingKey(null)} className="text-red-500 hover:text-red-600 bg-red-50 p-1 rounded"><CloseIcon className="w-4 h-4"/></button>
                                </div>
                            ) : (
                                <span className={`flex-grow text-xs transition-opacity break-words ${isChecked ? 'text-blue-900 font-medium' : 'text-slate-600 opacity-70'}`}>
                                    {localName}
                                </span>
                            )}

                            {!isEditing && isChecked && (
                                <div className="flex gap-1 flex-shrink-0">
                                    <button onClick={() => startEdit(origMat, localName)} className="text-slate-400 hover:text-blue-600 p-1.5 rounded hover:bg-white shadow-sm border border-transparent hover:border-slate-200 transition-all" title="Изменить наименование только в этом акте">
                                        <EditIcon className="w-3.5 h-3.5" />
                                    </button>
                                    {localName !== origMat && (
                                        <button onClick={() => resetEdit(origMat, localName)} className="text-amber-500 hover:text-amber-600 p-1.5 rounded hover:bg-white shadow-sm border border-transparent hover:border-slate-200 transition-all" title={`Сбросить на оригинал:\n${origMat}`}>
                                            <RestoreIcon className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Подвал */}
            {onNavigate && (
                <div className="p-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">
                    <button
                        onClick={() => onNavigate(certificate.id)}
                        className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 text-xs font-medium py-2 rounded hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors"
                    >
                        <LinkIcon className="w-4 h-4" /> Перейти на страницу сертификата
                    </button>
                </div>
            )}
        </div>
    );
};

export default MaterialPopover;