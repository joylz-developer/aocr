import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Act, Person, Organization, ProjectSettings, ROLES } from '../types';
import { EditIcon, DeleteIcon, DownloadIcon } from './Icons';
import { generateDocument } from '../services/docGenerator';
import Modal from './Modal';
import { GoogleGenAI } from "@google/genai";

// Props for the main table component
interface ActsTableProps {
    acts: Act[];
    people: Person[];
    organizations: Organization[];
    template: string | null;
    settings: ProjectSettings;
    onSave: (act: Act) => void;
    onDelete: (id: string) => void;
}

// FIX: Define a more specific type for columns to exclude non-string properties like 'representatives'.
type ActTableColumnKey = Exclude<keyof Act, 'representatives' | 'id'>;


// Props for the full ActForm, used inside a modal for complex edits
const ActForm: React.FC<{
    act: Act | null;
    people: Person[];
    organizations: Organization[];
    settings: ProjectSettings;
    onSave: (act: Act) => void;
    onClose: () => void;
}> = ({ act, people, organizations, settings, onSave, onClose }) => {
    const [formData, setFormData] = useState<Act>(() => 
        act || {
            id: '', number: '', date: '', objectName: settings.objectName, builderDetails: '', contractorDetails: '',
            designerDetails: '', workPerformer: '', workName: '', projectDocs: '', materials: '', certs: '',
            workStartDate: '', workEndDate: '', 
            regulations: '', nextWork: '', additionalInfo: '', 
            copiesCount: String(settings.defaultCopiesCount), attachments: '', representatives: {},
        }
    );

    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [showOtherReps, setShowOtherReps] = useState(false);
    
    const ai = settings.geminiApiKey ? new GoogleGenAI({ apiKey: settings.geminiApiKey }) : null;

    useEffect(() => {
        if(act) setFormData(act)
    }, [act]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleRepChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            representatives: { ...prev.representatives, [name]: value }
        }));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    const inputClass = "mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900";
    const selectClass = inputClass + " bg-white";
    const labelClass = "block text-sm font-medium text-slate-700";

    const renderSection = (title: string, children: React.ReactNode) => (
        <div className="border border-slate-200 rounded-md p-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {children}
            </div>
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto pr-4">
            {renderSection("Представители (комиссия)", 
                <>
                {Object.entries(ROLES).filter(([key]) => !['i1','i2','i3'].includes(key)).map(([key, description]) => (
                    <div key={key}>
                        <label className={labelClass}>{description}</label>
                        <select name={key} value={formData.representatives[key] || ''} onChange={handleRepChange} className={selectClass}>
                            <option value="">Не выбрано</option>
                            {people.map(p => <option key={p.id} value={p.id}>{p.name}, {p.position}</option>)}
                        </select>
                    </div>
                ))}
                 <div className="md:col-span-2 border-t pt-4 mt-2">
                     <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="showOtherReps"
                            checked={showOtherReps}
                            onChange={(e) => setShowOtherReps(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="showOtherReps" className="ml-2 text-sm font-medium text-slate-700">
                           Добавить представителей иных организаций
                        </label>
                    </div>
                </div>
                {showOtherReps && Object.entries(ROLES).filter(([key]) => ['i1','i2','i3'].includes(key)).map(([key, description]) => (
                     <div key={key}>
                        <label className={labelClass}>{description}</label>
                        <select name={key} value={formData.representatives[key] || ''} onChange={handleRepChange} className={selectClass}>
                            <option value="">Не выбрано</option>
                            {people.map(p => <option key={p.id} value={p.id}>{p.name}, {p.position}</option>)}
                        </select>
                    </div>
                ))}
                </>
            )}
             <div className="flex justify-end space-x-3 pt-4 sticky bottom-0 bg-white py-4">
                <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">Отмена</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Сохранить</button>
            </div>
        </form>
    )
}

const ALL_COLUMNS: { key: ActTableColumnKey; label: string; type: 'text' | 'date' | 'textarea', widthClass: string }[] = [
    { key: 'number', label: '№', type: 'text', widthClass: 'w-24' },
    { key: 'builderDetails', label: 'Застройщик (Заказчик)', type: 'textarea', widthClass: 'w-80' },
    { key: 'contractorDetails', label: 'Подрядчик', type: 'textarea', widthClass: 'w-80' },
    { key: 'designerDetails', label: 'Проектировщик', type: 'textarea', widthClass: 'w-80' },
    { key: 'workPerformer', label: 'Исполнитель работ', type: 'textarea', widthClass: 'w-80' },
    { key: 'workName', label: '1. Наименование работ', type: 'textarea', widthClass: 'w-96 min-w-[24rem]' },
    { key: 'projectDocs', label: '2. Проектная док-ция', type: 'textarea', widthClass: 'w-64' },
    { key: 'materials', label: '3. Материалы', type: 'textarea', widthClass: 'w-64' },
    { key: 'certs', label: '4. Сертификаты', type: 'textarea', widthClass: 'w-64' },
    { key: 'regulations', label: '6. Нормативы', type: 'textarea', widthClass: 'w-80' },
    { key: 'nextWork', label: '7. След. работы', type: 'textarea', widthClass: 'w-80' },
    { key: 'workStartDate', label: '5. Начало работ', type: 'date', widthClass: 'w-40' },
    { key: 'workEndDate', label: '5. Окончание работ', type: 'date', widthClass: 'w-40' },
    { key: 'date', label: 'Дата акта', type: 'date', widthClass: 'w-40' },
];

// Main Table Component
const ActsTable: React.FC<ActsTableProps> = ({ acts, people, organizations, template, settings, onSave, onDelete }) => {
    const [editingCell, setEditingCell] = useState<{ actId: string; column: ActTableColumnKey } | null>(null);
    const [dragState, setDragState] = useState<{ startActId: string; startColumn: ActTableColumnKey; value: any; endActId: string | null } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [actForModal, setActForModal] = useState<Act | null>(null);
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

    const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: ActTableColumnKey) => {
        e.preventDefault();
        const thElement = (e.target as HTMLElement).parentElement;
        if (!thElement) return;

        const startX = e.clientX;
        const startWidth = thElement.offsetWidth;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = startWidth + (moveEvent.clientX - startX);
            if (newWidth > 60) { // Minimum column width
                setColumnWidths(prev => ({ ...prev, [columnKey]: newWidth }));
            }
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, []);

    // Filter columns based on settings
    const columns = ALL_COLUMNS.filter(col => {
        if (col.key === 'date' && !settings.showActDate) {
            return false;
        }
        return true;
    });

    const handleSaveCell = (act: Act, column: ActTableColumnKey, value: any) => {
        const updatedAct = { ...act, [column]: value };
        // Auto-update act date if work end date changes
        if(column === 'workEndDate') {
            updatedAct.date = value;
        }
        onSave(updatedAct);
        setEditingCell(null);
    };

    const handleMouseDownOnHandle = (e: React.MouseEvent, actId: string, column: ActTableColumnKey) => {
        e.preventDefault();
        const act = acts.find(a => a.id === actId);
        if (act) {
            setDragState({ startActId: actId, startColumn: column, value: act[column], endActId: actId });
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
        const targetRow = (e.target as HTMLElement).closest('tr');
        if (targetRow && targetRow.dataset.actid) {
            setDragState(prev => prev ? { ...prev, endActId: targetRow.dataset.actid! } : null);
        }
    };
    
    const handleMouseUp = () => {
        if (dragState) {
            const { startActId, endActId, startColumn, value } = dragState;
            const startIndex = acts.findIndex(a => a.id === startActId);
            const endIndex = acts.findIndex(a => a.id === endActId);

            if (startIndex !== -1 && endIndex !== -1) {
                const minIndex = Math.min(startIndex, endIndex);
                const maxIndex = Math.max(startIndex, endIndex);
                
                for (let i = minIndex; i <= maxIndex; i++) {
                    handleSaveCell(acts[i], startColumn, value);
                }
            }
        }
        setDragState(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };
    
    const handleGenerate = (act: Act) => {
        if (!template) {
            alert('Шаблон не загружен.');
            return;
        }
        generateDocument(template, act, people);
    };

    const handleOpenModal = (act: Act) => {
        setActForModal(act);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setActForModal(null);
        setIsModalOpen(false);
    };
    
    const getDragRange = () => {
        if (!dragState) return [];
        const { startActId, endActId } = dragState;
        const startIndex = acts.findIndex(a => a.id === startActId);
        const endIndex = acts.findIndex(a => a.id === endActId);
        if (startIndex === -1 || endIndex === -1) return [];

        const min = Math.min(startIndex, endIndex);
        const max = Math.max(startIndex, endIndex);
        return acts.slice(min, max + 1).map(a => a.id);
    };
    
    const dragRangeIds = getDragRange();


    return (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="min-w-full text-sm table-fixed">
                <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                        {columns.map(col => (
                            <th 
                                key={col.key} 
                                className={`px-4 py-3 text-left font-medium text-slate-500 uppercase tracking-wider relative ${col.widthClass}`}
                                style={{ width: columnWidths[col.key] ? `${columnWidths[col.key]}px` : undefined }}
                            >
                                {col.label}
                                <div
                                    className="absolute top-0 right-0 h-full w-2 cursor-col-resize select-none"
                                    onMouseDown={(e) => handleResizeStart(e, col.key)}
                                />
                            </th>
                        ))}
                        <th className="px-4 py-3 text-right font-medium text-slate-500 uppercase tracking-wider sticky right-0 bg-slate-50 z-20 w-36">Действия</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                    {acts.map(act => (
                        <tr key={act.id} data-actid={act.id} className="hover:bg-slate-50">
                            {columns.map(col => {
                                const isEditing = editingCell?.actId === act.id && editingCell?.column === col.key;
                                const isDraggingOver = dragRangeIds.includes(act.id) && dragState?.startColumn === col.key;
                                const isDragStart = dragState?.startActId === act.id && dragState?.startColumn === col.key;

                                return (
                                    <td
                                        key={col.key}
                                        onClick={() => setEditingCell({ actId: act.id, column: col.key })}
                                        className={`px-0 py-0 border-b border-slate-200 align-top relative
                                            ${isDragStart ? 'border-2 border-blue-500' : ''}
                                            ${isDraggingOver && !isDragStart ? 'bg-blue-100' : ''}
                                            ${!isEditing ? 'cursor-pointer' : ''}
                                        `}
                                    >
                                        {isEditing ? (
                                             col.type === 'textarea' ? (
                                                <textarea
                                                    value={act[col.key]}
                                                    onChange={(e) => onSave({ ...act, [col.key]: e.target.value })}
                                                    onBlur={() => setEditingCell(null)}
                                                    autoFocus
                                                    className="w-full h-24 p-2 border-2 border-blue-500 rounded-md resize-y focus:outline-none"
                                                />
                                             ) : (
                                                <input
                                                    type={col.type}
                                                    value={act[col.key]}
                                                    onChange={(e) => onSave({ ...act, [col.key]: e.target.value })}
                                                    onBlur={() => setEditingCell(null)}
                                                    autoFocus
                                                    className="w-full h-full p-2 border-2 border-blue-500 rounded-md focus:outline-none"
                                                />
                                             )
                                        ) : (
                                            <div className="w-full h-full p-2 whitespace-pre-wrap truncate">
                                                {act[col.key] || <span className="text-slate-400">...</span>}
                                            </div>
                                        )}
                                         <div
                                            onMouseDown={(e) => handleMouseDownOnHandle(e, act.id, col.key)}
                                            className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-blue-600 cursor-crosshair z-30"
                                            style={{ display: isEditing || isDragStart ? 'block' : 'none' }}
                                            title="Протянуть для копирования"
                                         />
                                    </td>
                                );
                            })}
                            <td className="px-4 py-2 whitespace-nowrap text-right font-medium align-middle sticky right-0 bg-white z-20 w-36">
                                <div className="flex justify-end space-x-1">
                                    <button onClick={() => handleGenerate(act)} className="p-2 text-green-600 hover:bg-green-100 rounded-full" title="Скачать .docx"><DownloadIcon /></button>
                                    <button onClick={() => handleOpenModal(act)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full" title="Редактировать комиссию"><EditIcon /></button>
                                    <button onClick={() => onDelete(act.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full" title="Удалить"><DeleteIcon /></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {acts.length === 0 && (
                <div className="text-center py-10 text-slate-500">
                    Пока нет ни одного акта. Нажмите "Создать акт", чтобы добавить новую строку.
                </div>
            )}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Редактирование представителей">
                <ActForm
                    act={actForModal}
                    people={people}
                    organizations={organizations}
                    settings={settings}
                    onSave={onSave}
                    onClose={handleCloseModal}
                />
            </Modal>
        </div>
    );
};

export default ActsTable;