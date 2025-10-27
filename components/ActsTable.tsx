import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Act, Person, Organization, ProjectSettings, ROLES } from '../types';
import { EditIcon, DeleteIcon, DownloadIcon } from './Icons';
import { generateDocument } from '../services/docGenerator';
import Modal from './Modal';

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

type ActTableColumnKey = Exclude<keyof Act, 'representatives' | 'id' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId'> | 'workDates';


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

    const [showOtherReps, setShowOtherReps] = useState(false);
    
    const getOrgDetailsString = useCallback((org: Organization, useShort: boolean | undefined): string => {
        if (useShort) {
            return org.name;
        }
        return `${org.name}, ИНН ${org.inn}, ОГРН ${org.ogrn}, ${org.address}`;
    }, []);

    useEffect(() => {
        if(act) {
            const initialFormData = { ...act };
            // For backward compatibility, try to match details string to an org ID
            if (!act.builderOrgId && act.builderDetails) {
                 const foundOrg = organizations.find(org => getOrgDetailsString(org, false) === act.builderDetails || getOrgDetailsString(org, true) === act.builderDetails);
                 if (foundOrg) initialFormData.builderOrgId = foundOrg.id;
            }
             if (!act.contractorOrgId && act.contractorDetails) {
                 const foundOrg = organizations.find(org => getOrgDetailsString(org, false) === act.contractorDetails || getOrgDetailsString(org, true) === act.contractorDetails);
                 if (foundOrg) initialFormData.contractorOrgId = foundOrg.id;
            }
             if (!act.designerOrgId && act.designerDetails) {
                 const foundOrg = organizations.find(org => getOrgDetailsString(org, false) === act.designerDetails || getOrgDetailsString(org, true) === act.designerDetails);
                 if (foundOrg) initialFormData.designerOrgId = foundOrg.id;
            }
            if (!act.workPerformerOrgId && act.workPerformer) {
                 const foundOrg = organizations.find(org => getOrgDetailsString(org, false) === act.workPerformer || getOrgDetailsString(org, true) === act.workPerformer);
                 if (foundOrg) initialFormData.workPerformerOrgId = foundOrg.id;
            }
            setFormData(initialFormData);
        }
    }, [act, organizations, getOrgDetailsString]);


    const handleRepChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            representatives: { ...prev.representatives, [name]: value }
        }));
    };

    const handleOrgChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const finalAct = { ...formData };
        
        const orgMap = new Map(organizations.map(org => [org.id, org]));
        
        const useShort = settings.useShortOrgNames;

        if (finalAct.builderOrgId && orgMap.has(finalAct.builderOrgId)) {
            finalAct.builderDetails = getOrgDetailsString(orgMap.get(finalAct.builderOrgId)!, useShort);
        } else {
             finalAct.builderDetails = '';
        }

        if (finalAct.contractorOrgId && orgMap.has(finalAct.contractorOrgId)) {
            finalAct.contractorDetails = getOrgDetailsString(orgMap.get(finalAct.contractorOrgId)!, useShort);
        } else {
            finalAct.contractorDetails = '';
        }

        if (finalAct.designerOrgId && orgMap.has(finalAct.designerOrgId)) {
            finalAct.designerDetails = getOrgDetailsString(orgMap.get(finalAct.designerOrgId)!, useShort);
        } else {
            finalAct.designerDetails = '';
        }
        
        if (finalAct.workPerformerOrgId && orgMap.has(finalAct.workPerformerOrgId)) {
            finalAct.workPerformer = getOrgDetailsString(orgMap.get(finalAct.workPerformerOrgId)!, useShort);
        } else {
            finalAct.workPerformer = '';
        }

        onSave(finalAct);
        onClose();
    };

    const selectClass = "mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white";
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
            {renderSection("Организации-участники",
                <>
                    <div>
                        <label className={labelClass}>Застройщик (технический заказчик)</label>
                        <select name="builderOrgId" value={formData.builderOrgId || ''} onChange={handleOrgChange} className={selectClass}>
                            <option value="">Не выбрано</option>
                            {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Лицо, осуществляющее строительство (Подрядчик)</label>
                        <select name="contractorOrgId" value={formData.contractorOrgId || ''} onChange={handleOrgChange} className={selectClass}>
                            <option value="">Не выбрано</option>
                            {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className={labelClass}>Лицо, осуществившее подготовку проекта</label>
                        <select name="designerOrgId" value={formData.designerOrgId || ''} onChange={handleOrgChange} className={selectClass}>
                            <option value="">Не выбрано</option>
                            {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className={labelClass}>Лицо, выполнившее работы</label>
                        <select name="workPerformerOrgId" value={formData.workPerformerOrgId || ''} onChange={handleOrgChange} className={selectClass}>
                            <option value="">Не выбрано</option>
                            {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                        </select>
                    </div>
                </>
            )}

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

const DateCellEditor: React.FC<{
    act: Act;
    onSave: (act: Act) => void;
    onClose: () => void;
}> = ({ act, onSave, onClose }) => {
    const [startDate, setStartDate] = useState(act.workStartDate || '');
    const [endDate, setEndDate] = useState(act.workEndDate || '');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                handleSave();
            }
        };

        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                handleSave();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [startDate, endDate]); // Re-add listener if dates change to save latest state

    const handleSave = () => {
        if (act.workStartDate !== startDate || act.workEndDate !== endDate) {
            onSave({ ...act, workStartDate: startDate, workEndDate: endDate, date: endDate });
        }
        onClose();
    };

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newStartDate = e.target.value;
        setStartDate(newStartDate);
        if (!endDate || new Date(endDate) < new Date(newStartDate)) {
            setEndDate(newStartDate);
        }
    };
    
    const addTime = (amount: number, unit: 'day' | 'week' | 'month') => {
        if (!startDate) return;
        const [year, month, day] = startDate.split('-').map(Number);
        const utcDate = new Date(Date.UTC(year, month - 1, day));

        if (unit === 'day') {
            utcDate.setUTCDate(utcDate.getUTCDate() + amount);
        } else if (unit === 'week') {
            utcDate.setUTCDate(utcDate.getUTCDate() + amount * 7);
        } else if (unit === 'month') {
            utcDate.setUTCMonth(utcDate.getUTCMonth() + amount);
        }
        
        setEndDate(utcDate.toISOString().split('T')[0]);
    };

    const QuickAddButton: React.FC<{ children: React.ReactNode; onClick: () => void }> = ({ children, onClick }) => (
        <button type="button" onClick={onClick} className="px-2 py-1 text-xs bg-slate-200 hover:bg-slate-300 rounded">
            {children}
        </button>
    );

    return (
        <div ref={containerRef} className="absolute inset-0 bg-white p-2 border-2 border-blue-500 rounded-md z-40 flex flex-col gap-2 shadow-lg" onClick={e => e.stopPropagation()}>
            <div>
                <label className="text-xs font-medium text-slate-600">Начало</label>
                <input
                    type="date"
                    value={startDate}
                    onChange={handleStartDateChange}
                    autoFocus
                    className="w-full p-1 border border-slate-300 rounded text-sm"
                />
            </div>
             <div>
                <label className="text-xs font-medium text-slate-600">Окончание</label>
                <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-1 border border-slate-300 rounded text-sm"
                />
            </div>
            <div className="flex justify-start items-center gap-1">
                <QuickAddButton onClick={() => addTime(1, 'day')}>+1Д</QuickAddButton>
                <QuickAddButton onClick={() => addTime(1, 'week')}>+1Н</QuickAddButton>
                <QuickAddButton onClick={() => addTime(1, 'month')}>+1М</QuickAddButton>
            </div>
        </div>
    );
};

const ALL_COLUMNS: { key: ActTableColumnKey; label: string; type: 'text' | 'date' | 'textarea' | 'custom_date', widthClass: string }[] = [
    { key: 'number', label: '№', type: 'text', widthClass: 'w-24' },
    { key: 'workName', label: '1. Наименование работ', type: 'textarea', widthClass: 'w-96 min-w-[24rem]' },
    { key: 'projectDocs', label: '2. Проектная документация', type: 'textarea', widthClass: 'w-80' },
    { key: 'materials', label: '3. Материалы', type: 'textarea', widthClass: 'w-80' },
    { key: 'certs', label: '4. исполнительные схемы', type: 'textarea', widthClass: 'w-80' },
    { key: 'workDates', label: '5. Даты работ', type: 'custom_date', widthClass: 'w-64' },
    { key: 'regulations', label: '6. Нормативы', type: 'textarea', widthClass: 'w-80' },
    { key: 'nextWork', label: '7. Следующие работы', type: 'textarea', widthClass: 'w-80' },
    { key: 'date', label: 'Дата акта', type: 'date', widthClass: 'w-40' },
];

type Coords = { rowIndex: number; colIndex: number };

// Main Table Component
const ActsTable: React.FC<ActsTableProps> = ({ acts, people, organizations, template, settings, onSave, onDelete }) => {
    const [editingCell, setEditingCell] = useState<Coords | null>(null);
    const [activeCell, setActiveCell] = useState<Coords | null>(null);
    const [selectionArea, setSelectionArea] = useState<{ start: Coords, end: Coords } | null>(null);
    const [isDraggingSelection, setIsDraggingSelection] = useState(false);
    const [isFilling, setIsFilling] = useState(false);
    const [fillTargetArea, setFillTargetArea] = useState<{ start: Coords, end: Coords } | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [actForModal, setActForModal] = useState<Act | null>(null);
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const tableRef = useRef<HTMLDivElement>(null);


    const columns = useMemo(() => ALL_COLUMNS.filter(col => {
        if (col.key === 'date' && !settings.showActDate) {
            return false;
        }
        return true;
    }), [settings.showActDate]);

    const normalizeSelection = (area: { start: Coords, end: Coords }): { minRow: number, maxRow: number, minCol: number, maxCol: number } => {
        const minRow = Math.min(area.start.rowIndex, area.end.rowIndex);
        const maxRow = Math.max(area.start.rowIndex, area.end.rowIndex);
        const minCol = Math.min(area.start.colIndex, area.end.colIndex);
        const maxCol = Math.max(area.start.colIndex, area.end.colIndex);
        return { minRow, maxRow, minCol, maxCol };
    };

    const getCellCoordsFromEvent = (e: MouseEvent): Coords | null => {
        const target = e.target as HTMLElement;
        const cell = target.closest('td');
        if (!cell || !cell.dataset.rowIndex || !cell.dataset.colIndex) return null;
        return {
            rowIndex: parseInt(cell.dataset.rowIndex, 10),
            colIndex: parseInt(cell.dataset.colIndex, 10),
        };
    };

    const handleCellMouseDown = (e: React.MouseEvent<HTMLTableCellElement>, rowIndex: number, colIndex: number) => {
        setEditingCell(null);
        if (e.shiftKey && activeCell) {
            setSelectionArea({ start: activeCell, end: { rowIndex, colIndex } });
        } else {
            setActiveCell({ rowIndex, colIndex });
            setSelectionArea({ start: { rowIndex, colIndex }, end: { rowIndex, colIndex } });
            setIsDraggingSelection(true);
        }
    };
    
    const handleCellDoubleClick = (rowIndex: number, colIndex: number) => {
        setEditingCell({ rowIndex, colIndex });
    };

     // Keyboard controls: Copy, Paste, Delete
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            if (editingCell || (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const isCtrlKey = isMac ? e.metaKey : e.ctrlKey;

            // Handle Delete
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectionArea) {
                e.preventDefault();
                const { minRow, maxRow, minCol, maxCol } = normalizeSelection(selectionArea);
                const updatedActs = new Map<string, Act>();

                for (let r = minRow; r <= maxRow; r++) {
                    const originalAct = acts[r];
                    if (!originalAct) continue;
                    
                    let updatedAct = updatedActs.get(originalAct.id) || { ...originalAct };

                    for (let c = minCol; c <= maxCol; c++) {
                        const col = columns[c];
                        if (!col) continue;

                        if (col.key === 'workDates') {
                            updatedAct.workStartDate = '';
                            updatedAct.workEndDate = '';
                            updatedAct.date = ''; 
                        } else {
                            const columnKey = col.key as Exclude<ActTableColumnKey, 'workDates'>;
                            (updatedAct as any)[columnKey] = '';
                        }
                    }
                    updatedActs.set(originalAct.id, updatedAct);
                }
                updatedActs.forEach(onSave);
            }
            
            // Handle Copy
            if (e.key === 'c' && isCtrlKey && selectionArea) {
                 e.preventDefault();
                 const { minRow, maxRow, minCol, maxCol } = normalizeSelection(selectionArea);
                 const copyData = [];
                 for (let r = minRow; r <= maxRow; r++) {
                     const rowData = [];
                     const act = acts[r];
                     for (let c = minCol; c <= maxCol; c++) {
                         const col = columns[c];
                         if (col.key === 'workDates') {
                             rowData.push(`${act.workStartDate || ''} - ${act.workEndDate || ''}`);
                         } else {
                             rowData.push(act[col.key as Exclude<ActTableColumnKey, 'workDates'>] || '');
                         }
                     }
                     copyData.push(rowData.join('\t'));
                 }
                 await navigator.clipboard.writeText(copyData.join('\n'));
            }
            
            // Handle Paste
            if (e.key === 'v' && isCtrlKey && activeCell) {
                e.preventDefault();
                const pastedText = await navigator.clipboard.readText();
                const pastedRows = pastedText.replace(/\r\n/g, '\n').split('\n').map(row => row.split('\t'));
                
                const startRow = activeCell.rowIndex;
                const startCol = activeCell.colIndex;
                const updatedActs = new Map<string, Act>();

                pastedRows.forEach((rowData, rOffset) => {
                    const targetRowIndex = startRow + rOffset;
                    if (targetRowIndex >= acts.length) return;
                    
                    const originalAct = acts[targetRowIndex];
                    let updatedAct = updatedActs.get(originalAct.id) || { ...originalAct };

                    rowData.forEach((cellData, cOffset) => {
                        const targetColIndex = startCol + cOffset;
                        if (targetColIndex >= columns.length) return;
                        
                        const col = columns[targetColIndex];
                         if (col.key === 'workDates') {
                            const [start, end] = cellData.split(' - ').map(s => s.trim());
                            updatedAct.workStartDate = start || '';
                            updatedAct.workEndDate = end || '';
                            updatedAct.date = end || '';
                        } else {
                            const columnKey = col.key as Exclude<ActTableColumnKey, 'workDates'>;
                            (updatedAct as any)[columnKey] = cellData;
                        }
                    });
                    updatedActs.set(originalAct.id, updatedAct);
                });
                updatedActs.forEach(onSave);
                
                // Expand selection to pasted area
                const endRow = startRow + pastedRows.length - 1;
                const maxCols = pastedRows.length > 0 ? Math.max(...pastedRows.map(r => r.length)) : 0;
                const endCol = startCol + maxCols - 1;
                setSelectionArea({
                    start: activeCell,
                    end: { 
                        rowIndex: Math.min(endRow, acts.length - 1), 
                        colIndex: Math.min(endCol, columns.length - 1)
                    }
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectionArea, activeCell, editingCell, acts, columns, onSave]);


    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingSelection || !selectionArea) return;
            const coords = getCellCoordsFromEvent(e);
            if (coords) {
                setSelectionArea({ ...selectionArea, end: coords });
            }
        };

        const handleMouseUp = () => {
            setIsDraggingSelection(false);
        };

        if (isDraggingSelection) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp, { once: true });
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingSelection, selectionArea]);
    
    // Fill handle drag logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isFilling || !selectionArea) return;
            const coords = getCellCoordsFromEvent(e);
            if (coords) {
                const { maxRow, minCol, maxCol } = normalizeSelection(selectionArea);
                if (coords.rowIndex > maxRow) { // Only support dragging down for now
                     setFillTargetArea({ start: {rowIndex: maxRow + 1, colIndex: minCol}, end: {rowIndex: coords.rowIndex, colIndex: maxCol} });
                } else {
                    setFillTargetArea(null);
                }
            }
        };

        const handleMouseUp = () => {
            if (!isFilling || !selectionArea || !fillTargetArea) {
                setIsFilling(false);
                setFillTargetArea(null);
                return;
            }

            const { minCol: selMinCol, maxCol: selMaxCol } = normalizeSelection(selectionArea);
            const { minRow: fillMinRow, maxRow: fillMaxRow } = normalizeSelection(fillTargetArea);

            const { minRow: selMinRow, maxRow: selMaxRow } = normalizeSelection(selectionArea);
            const patternHeight = selMaxRow - selMinRow + 1;
            
            const actsToUpdate: Act[] = [];

            for (let r = fillMinRow; r <= fillMaxRow; r++) {
                const targetAct = acts[r];
                let updatedAct = { ...targetAct };
                let hasChanges = false;
                
                const patternRowIndex = selMinRow + ((r - fillMinRow) % patternHeight);
                const sourceAct = acts[patternRowIndex];

                if (!sourceAct) continue;

                for (let c = selMinCol; c <= selMaxCol; c++) {
                    const colKey = columns[c]?.key;
                    if (!colKey) continue;

                    if (colKey === 'workDates') {
                        if (updatedAct.workStartDate !== sourceAct.workStartDate || updatedAct.workEndDate !== sourceAct.workEndDate) {
                            updatedAct.workStartDate = sourceAct.workStartDate;
                            updatedAct.workEndDate = sourceAct.workEndDate;
                            updatedAct.date = sourceAct.workEndDate; 
                            hasChanges = true;
                        }
                    } else {
                        const typedColKey = colKey as keyof Act;
                        const sourceValue = sourceAct[typedColKey];
                        if (updatedAct[typedColKey] !== sourceValue) {
                            (updatedAct as any)[typedColKey] = sourceValue;
                            hasChanges = true;
                        }
                    }
                }
                if (hasChanges) {
                    actsToUpdate.push(updatedAct);
                }
            }
            
            actsToUpdate.forEach(onSave);

            setIsFilling(false);
            setFillTargetArea(null);
        };

        if (isFilling) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp, { once: true });
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isFilling, selectionArea, fillTargetArea, acts, columns, onSave]);


    const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: string) => {
        e.preventDefault();
        const thElement = (e.target as HTMLElement).parentElement;
        if (!thElement) return;
        const startX = e.clientX;
        const startWidth = thElement.offsetWidth;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = startWidth + (moveEvent.clientX - startX);
            if (newWidth > 60) {
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
    
    const isCellInArea = (coords: Coords, area: { start: Coords, end: Coords }): boolean => {
        const { minRow, maxRow, minCol, maxCol } = normalizeSelection(area);
        return coords.rowIndex >= minRow && coords.rowIndex <= maxRow && coords.colIndex >= minCol && coords.colIndex <= maxCol;
    };


    return (
        <div ref={tableRef} className="overflow-x-auto border border-slate-200 rounded-lg select-none">
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
                                    className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
                                    onMouseDown={(e) => handleResizeStart(e, col.key)}
                                />
                            </th>
                        ))}
                        <th className="px-4 py-3 text-right font-medium text-slate-500 uppercase tracking-wider sticky right-0 bg-slate-50 z-20 w-36">Действия</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                    {acts.map((act, rowIndex) => (
                        <tr key={act.id} data-actid={act.id} className="hover:bg-slate-50">
                            {columns.map((col, colIndex) => {
                                const coords = { rowIndex, colIndex };
                                const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
                                const isActive = activeCell?.rowIndex === rowIndex && activeCell?.colIndex === colIndex;
                                const isSelected = selectionArea ? isCellInArea(coords, selectionArea) : false;
                                const isFillTarget = fillTargetArea ? isCellInArea(coords, fillTargetArea) : false;
                                
                                let cellClassName = "px-0 py-0 border-b border-r border-slate-200 align-top relative";
                                if (isSelected) {
                                    cellClassName += " bg-blue-100";
                                }
                                if (isFillTarget) {
                                     cellClassName += " bg-green-100 border-2 border-dashed border-green-400";
                                }

                                if (col.type === 'custom_date') {
                                    return (
                                        <td
                                            key={col.key}
                                            data-row-index={rowIndex}
                                            data-col-index={colIndex}
                                            onMouseDown={(e) => handleCellMouseDown(e, rowIndex, colIndex)}
                                            onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                                            className={`${cellClassName} ${isActive ? 'ring-2 ring-inset ring-blue-600 z-30' : isSelected ? 'ring-1 ring-inset ring-blue-300' : ''}`}
                                        >
                                            {isEditing ? (
                                                <DateCellEditor
                                                    act={act}
                                                    onSave={onSave}
                                                    onClose={() => setEditingCell(null)}
                                                />
                                            ) : (
                                                <div className="w-full h-full p-2 whitespace-pre-wrap truncate">
                                                    {(act.workStartDate || act.workEndDate)
                                                        ? `${act.workStartDate || '...'} - ${act.workEndDate || '...'}`
                                                        : <span className="text-slate-400">...</span>
                                                    }
                                                </div>
                                            )}
                                        </td>
                                    );
                                }
                                
                                const columnKey = col.key as Exclude<ActTableColumnKey, 'workDates'>;

                                return (
                                    <td
                                        key={col.key}
                                        data-row-index={rowIndex}
                                        data-col-index={colIndex}
                                        onMouseDown={(e) => handleCellMouseDown(e, rowIndex, colIndex)}
                                        onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                                        className={`${cellClassName} ${isActive ? 'ring-2 ring-inset ring-blue-600 z-30' : isSelected ? 'ring-1 ring-inset ring-blue-300' : ''}`}
                                    >
                                        {isEditing ? (
                                             col.type === 'textarea' ? (
                                                <textarea
                                                    value={act[columnKey] || ''}
                                                    onChange={(e) => onSave({ ...act, [columnKey]: e.target.value })}
                                                    onBlur={() => setEditingCell(null)}
                                                    onKeyDown={(e) => { if(e.key === 'Escape') setEditingCell(null); }}
                                                    autoFocus
                                                    className="absolute inset-0 w-full h-24 p-2 border-2 border-blue-500 rounded-md resize-y focus:outline-none z-40"
                                                />
                                             ) : (
                                                <input
                                                    type={col.type}
                                                    value={act[columnKey] || ''}
                                                    onChange={(e) => onSave({ ...act, [columnKey]: e.target.value })}
                                                    onBlur={() => setEditingCell(null)}
                                                    onKeyDown={(e) => { if(e.key === 'Escape') setEditingCell(null); }}
                                                    autoFocus
                                                    className="absolute inset-0 w-full h-full p-2 border-2 border-blue-500 rounded-md focus:outline-none z-40"
                                                />
                                             )
                                        ) : (
                                            <div className="w-full h-full p-2 whitespace-pre-wrap truncate">
                                                {act[columnKey] || <span className="text-slate-400">...</span>}
                                            </div>
                                        )}
                                        {isActive && (
                                            <div
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    setIsFilling(true);
                                                }}
                                                className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-600 cursor-crosshair z-50 border border-white"
                                                title="Протянуть для копирования"
                                            />
                                        )}
                                    </td>
                                );
                            })}
                            <td className="px-4 py-2 whitespace-nowrap text-right font-medium align-middle sticky right-0 bg-white z-20 w-36">
                                <div className="flex justify-end space-x-1">
                                    <button onClick={() => handleGenerate(act)} className="p-2 text-green-600 hover:bg-green-100 rounded-full" title="Скачать .docx"><DownloadIcon /></button>
                                    <button onClick={() => handleOpenModal(act)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full" title="Редактировать участников"><EditIcon /></button>
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
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Редактирование участников акта">
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
