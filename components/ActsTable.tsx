
import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { Act, Person, Organization, ProjectSettings, ROLES, CommissionGroup, Page, Coords, Regulation, Certificate } from '../types';
import Modal from './Modal';
import { DeleteIcon, CalendarIcon, LinkIcon, EditIcon, CopyIcon, PasteIcon, SparklesIcon, RowAboveIcon, RowBelowIcon, BookIcon, CloseIcon, GripVerticalIcon, DownloadIcon, QuestionMarkCircleIcon, ArrowDownCircleIcon, PlusIcon } from './Icons';
import CustomSelect from './CustomSelect';
import { generateDocument } from '../services/docGenerator';
import { ALL_COLUMNS } from './ActsTableConfig';
import { ContextMenu, MenuItem, MenuSeparator } from './ContextMenu';
import RegulationsModal from './RegulationsModal';
import RegulationsInput from './RegulationsInput';
import RegulationDetails from './RegulationDetails';
import MaterialsInput from './MaterialsInput';
import MaterialPopover from './MaterialPopover';
import MaterialsModal from './MaterialsModal'; // Import for linking

const AUTO_NEXT_ID = 'AUTO_NEXT';
const AUTO_NEXT_LABEL = '⬇️ Следующий по списку (Автоматически)';

// Props for the main table component
interface ActsTableProps {
    acts: Act[];
    people: Person[];
    organizations: Organization[];
    groups: CommissionGroup[];
    regulations: Regulation[];
    certificates?: Certificate[];
    template: string | null;
    registryTemplate: string | null;
    settings: ProjectSettings;
    visibleColumns: Set<string>;
    columnOrder: string[];
    onColumnOrderChange: (newOrder: string[]) => void;
    activeCell: Coords | null;
    setActiveCell: (cell: Coords | null) => void;
    // Lifted state
    selectedCells: Set<string>;
    setSelectedCells: (cells: Set<string>) => void;
    
    onSave: (act: Act, insertAtIndex?: number) => void;
    onRequestDelete: (ids: string[]) => void;
    onReorderActs: (newActs: Act[]) => void;
    setCurrentPage: (page: Page) => void;
    createNewAct: () => Act; // Factory for context menu insertions
    onNavigateToCertificate?: (id: string) => void; // Callback for navigating to cert page
}

// ... [Keep formatDateForDisplay, parseDisplayDate, DateEditorPopover, RegulationPopover, NextWorkPopover unchanged] ...
const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return '';
    const dateParts = dateString.split('-');
    if (dateParts.length !== 3) return dateString; 
    const [year, month, day] = dateParts;
    return `${day}.${month}.${year}`;
};

const parseDisplayDate = (dateString: string): string | null => {
    if (!dateString) return null;
    const parts = dateString.match(/^(\d{1,2})\.?(\d{1,2})\.?(\d{4})$/);
    if (!parts) return null;

    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10);
    const year = parseInt(parts[3], 10);

    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
    
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const DateEditorPopover: React.FC<{
    act: Act;
    onActChange: (act: Act) => void;
    onClose: () => void;
    position: { top: number, left: number, width: number };
}> = ({ act, onActChange, onClose, position }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const handleDateChange = (field: 'workStartDate' | 'workEndDate', value: string) => {
        const updatedAct = { ...act, [field]: value };
        if (field === 'workStartDate' && value && updatedAct.workEndDate && new Date(updatedAct.workEndDate) < new Date(value)) {
            updatedAct.workEndDate = value;
        }
        if (field === 'workEndDate' && value && updatedAct.workStartDate && new Date(value) < new Date(updatedAct.workStartDate)) {
            updatedAct.workStartDate = value;
        }
        onActChange(updatedAct);
    };
    
    const addTime = (amount: number, unit: 'day' | 'week' | 'month') => {
        if (!act.workStartDate) return;
        const [year, month, day] = act.workStartDate.split('-').map(Number);
        const utcDate = new Date(Date.UTC(year, month - 1, day));

        if (unit === 'day') {
            utcDate.setUTCDate(utcDate.getUTCDate() + amount);
        } else if (unit === 'week') {
            utcDate.setUTCDate(utcDate.getUTCDate() + amount * 7);
        } else if (unit === 'month') {
            utcDate.setUTCMonth(utcDate.getUTCMonth() + amount);
        }
        
        const newEndDateYYYYMMDD = utcDate.toISOString().split('T')[0];
        handleDateChange('workEndDate', newEndDateYYYYMMDD);
    };

    const QuickAddButton: React.FC<{ children: React.ReactNode; onClick: () => void }> = ({ children, onClick }) => (
        <button type="button" onClick={onClick} className="px-2 py-1 text-xs bg-slate-200 hover:bg-slate-300 rounded">
            {children}
        </button>
    );

    const inputClass = "w-full p-1.5 border rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 border-slate-300";

    return (
        <div 
            ref={containerRef} 
            className="absolute bg-white p-3 border-2 border-blue-500 rounded-md z-40 flex flex-col gap-3 shadow-lg animate-fade-in-up" 
            style={{ top: position.top, left: position.left, minWidth: '220px' }}
            onMouseDown={e => e.stopPropagation()} 
        >
            <div>
                <label className="text-xs font-medium text-slate-600">Начало</label>
                <input
                    type="date"
                    value={act.workStartDate || ''}
                    onChange={e => handleDateChange('workStartDate', e.target.value)}
                    className={inputClass}
                />
            </div>
             <div>
                <label className="text-xs font-medium text-slate-600">Окончание</label>
                <input
                    type="date"
                    value={act.workEndDate || ''}
                    onChange={e => handleDateChange('workEndDate', e.target.value)}
                     min={act.workStartDate}
                    className={inputClass}
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

const RegulationPopover: React.FC<{
    regulation: Regulation;
    position: { top: number, left: number };
    onClose: () => void;
    onOpenDetails: () => void;
}> = ({ regulation, position, onClose, onOpenDetails }) => {
    return (
        <div 
            className="absolute z-50 bg-white border border-slate-200 shadow-xl rounded-lg p-3 w-72 animate-fade-in-up"
            style={{ top: position.top, left: position.left }}
            onMouseDown={e => e.stopPropagation()} 
        >
            <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-slate-800 text-sm">{regulation.designation}</h4>
                 <span className={`text-[10px] px-1.5 py-0.5 rounded border ${regulation.status.includes('Действует') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {regulation.status}
                </span>
            </div>
            <p className="text-xs text-slate-600 mb-3 line-clamp-3">{regulation.title}</p>
            <div className="flex justify-between items-center">
                <button 
                    onClick={onOpenDetails} 
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center gap-1"
                >
                    <BookIcon className="w-3 h-3"/> Биография
                </button>
            </div>
        </div>
    );
};

const NextWorkPopover: React.FC<{
    acts: Act[];
    currentActId: string;
    onSelect: (act: Act | null | string) => void;
    onClose: () => void;
    position: { top: number, left: number, width: number };
}> = ({ acts, currentActId, onSelect, onClose, position }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredActs = acts.filter(a => 
        a.id !== currentActId && 
        (
            (a.number && a.number.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (a.workName && a.workName.toLowerCase().includes(searchTerm.toLowerCase()))
        )
    );

    return (
        <div 
            className="absolute z-50 bg-white border border-slate-200 shadow-xl rounded-lg flex flex-col max-h-60 w-80 animate-fade-in-up"
            style={{ top: position.top, left: position.left }}
            onMouseDown={e => e.stopPropagation()}
        >
            <div className="p-2 border-b border-slate-100">
                <input 
                    type="text" 
                    placeholder="Поиск или ввод текста..." 
                    className="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                />
            </div>
            <div className="overflow-y-auto flex-1">
                 <button 
                    className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 border-b border-slate-100 italic"
                    onClick={() => onSelect(null)}
                >
                    -- Очистить / Нет связи --
                </button>
                
                {searchTerm.trim() && (
                     <button
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 border-b border-slate-100 flex items-center gap-2 group"
                        onClick={() => onSelect(searchTerm)}
                        title="Использовать введенный текст без привязки"
                    >
                        <EditIcon className="w-4 h-4 text-slate-400 group-hover:text-blue-500"/>
                        <span className="truncate">✍️ Ввести вручную: <span className="font-semibold">"{searchTerm}"</span></span>
                    </button>
                )}

                <button 
                    className="w-full text-left px-3 py-2 text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 border-b border-blue-100 font-medium flex items-center gap-2"
                    onClick={() => onSelect(AUTO_NEXT_ID)}
                >
                    <ArrowDownCircleIcon className="w-4 h-4"/> 
                    Следующий по списку (Автоматически)
                </button>
                {filteredActs.length > 0 ? filteredActs.map(act => (
                    <button
                        key={act.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-50 last:border-0"
                        onClick={() => onSelect(act)}
                    >
                        <div className="font-medium text-slate-800">Акт №{act.number || 'б/н'}</div>
                        <div className="text-xs text-slate-500 truncate">{act.workName || 'Без названия'}</div>
                    </button>
                )) : (
                     !searchTerm && <div className="px-3 py-4 text-center text-xs text-slate-400">Нет подходящих актов</div>
                )}
            </div>
        </div>
    );
};

// Rich Tooltip Component
const RichHeaderTooltip: React.FC<{ 
    column: typeof ALL_COLUMNS[0], 
    position: { top: number, left: number } | null 
}> = ({ column, position }) => {
    if (!position || !column.description) return null;

    return (
        <div 
            className="fixed z-50 w-80 bg-white rounded-lg shadow-xl border border-slate-200 p-4 text-left pointer-events-none animate-fade-in-up"
            style={{ 
                top: position.top + 25, 
                left: position.left - 10,
            }}
        >
            <div className="absolute -top-1.5 left-4 w-3 h-3 bg-white border-t border-l border-slate-200 transform rotate-45"></div>
            <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                {column.label}
            </h4>
            <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                {column.description}
            </p>
            {column.example && (
                <div className="bg-slate-50 border border-slate-100 rounded p-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Пример заполнения:</span>
                    <code className="text-xs text-blue-700 font-mono break-words">{column.example}</code>
                </div>
            )}
        </div>
    );
};


// Main Table Component
const ActsTable: React.FC<ActsTableProps> = ({ acts, people, organizations, groups, regulations, certificates = [], template, registryTemplate, settings, visibleColumns, columnOrder, onColumnOrderChange, activeCell, setActiveCell, selectedCells, setSelectedCells, onSave, onRequestDelete, onReorderActs, setCurrentPage, createNewAct, onNavigateToCertificate }) => {
    const [editingCell, setEditingCell] = useState<Coords | null>(null);
    const [editorValue, setEditorValue] = useState('');
    const [dateError, setDateError] = useState<string | null>(null);
    // REMOVED local selectedCells state, using props
    const [copiedCells, setCopiedCells] = useState<Set<string> | null>(null);
    const [isDraggingSelection, setIsDraggingSelection] = useState(false);
    const [isFilling, setIsFilling] = useState(false);
    const [fillTargetArea, setFillTargetArea] = useState<{ start: Coords, end: Coords } | null>(null);
    
    const [datePopoverState, setDatePopoverState] = useState<{ act: Act; position: { top: number, left: number, width: number } } | null>(null);
    const [fillHandleCoords, setFillHandleCoords] = useState<{top: number, left: number} | null>(null);

    // Header Tooltip State
    const [hoveredHeaderKey, setHoveredHeaderKey] = useState<string | null>(null);
    const [hoveredHeaderPos, setHoveredHeaderPos] = useState<{top: number, left: number} | null>(null);

    // Drag Indicator State (for visual feedback)
    const [dragIndicator, setDragIndicator] = useState<{
        type: 'row' | 'col';
        x: number;
        y: number;
        width: number;
        height: number;
    } | null>(null);

    // Row Drag States
    const [draggedRowIndices, setDraggedRowIndices] = useState<number[] | null>(null);
    const [dropTargetRowIndex, setDropTargetRowIndex] = useState<number | null>(null);
    const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null);
    const dragHandlePressedRef = useRef(false);

    // Column Drag States
    const [draggedColKey, setDraggedColKey] = useState<string | null>(null);
    const [dropTargetColKey, setDropTargetColKey] = useState<string | null>(null);
    const [dropColPosition, setDropColPosition] = useState<'left' | 'right' | null>(null);


    const [nextWorkPopoverState, setNextWorkPopoverState] = useState<{
        rowIndex: number;
        colIndex: number;
        position: { top: number, left: number, width: number };
    } | null>(null);
    
    const [actPickerState, setActPickerState] = useState<{ sourceRowIndex: number } | null>(null);
    const [regulationsModalOpen, setRegulationsModalOpen] = useState(false);
    
    // New state for Regulation Popover and Details
    const [regulationPopoverState, setRegulationPopoverState] = useState<{
        regulation: Regulation;
        position: { top: number; left: number };
    } | null>(null);
    
    // NEW state for Material Popover
    const [materialPopoverState, setMaterialPopoverState] = useState<{
        certificate: Certificate;
        materialName: string;
        position: { top: number; left: number };
    } | null>(null);
    
    // New state for linking material via modal
    const [linkMaterialModalState, setLinkMaterialModalState] = useState<{
        isOpen: boolean;
        actId: string;
        itemIndex: number;
        initialSearch: string;
        editingMaterialTitle?: string;
    } | null>(null);

    
    const [fullRegulationDetails, setFullRegulationDetails] = useState<Regulation | null>(null);

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowIndex: number; colIndex: number } | null>(null);
    
    // Add multiple acts state
    const [numRowsToAdd, setNumRowsToAdd] = useState(1);

    const tableContainerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
    const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll refs
    const mousePosRef = useRef<{x: number, y: number} | null>(null);
    const autoScrollRaf = useRef<number | null>(null);

    const actsById = useMemo(() => {
        return new Map(acts.map(a => [a.id, a]));
    }, [acts]);

    const columns = useMemo(() => {
        const colMap = new Map(ALL_COLUMNS.map(col => [col.key, col]));
        const orderedCols = columnOrder
            .filter(key => colMap.has(key as any) && visibleColumns.has(key))
            .map(key => colMap.get(key as any)!);

        const orderedKeys = new Set(orderedCols.map(c => c.key));
        const missingCols = ALL_COLUMNS.filter(c => visibleColumns.has(c.key) && !orderedKeys.has(c.key));

        const finalCols = [...orderedCols, ...missingCols];

        return finalCols.filter(col => {
            if (col.key === 'date' && !settings.showActDate) return false;
            if (col.key === 'additionalInfo' && !settings.showAdditionalInfo) return false;
            if (col.key === 'attachments' && !settings.showAttachments) return false;
            if (col.key === 'copiesCount' && !settings.showCopiesCount) return false;
            return true;
        });
    }, [settings, visibleColumns, columnOrder]);

    const getCellId = (rowIndex: number, colIndex: number) => `${rowIndex}:${colIndex}`;
    
    const getRelativeCoords = (target: HTMLElement) => {
        if (!tableContainerRef.current) return { top: 0, left: 0, width: 0 };
        const containerRect = tableContainerRef.current.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        return {
            top: targetRect.bottom - containerRect.top,
            left: targetRect.left - containerRect.left,
            width: targetRect.width
        };
    };

    // ... [Selection logic, template application, bulk updates, org details helper, group change logic unchanged] ...
    const selectedRows = useMemo(() => {
        const rowsFullySelected = new Set<number>();
        if (selectedCells.size === 0 || columns.length === 0) {
            return rowsFullySelected;
        }
        const cellsByRow = new Map<number, number>();
        for (const cellId of selectedCells) {
            const [rowIndex] = cellId.split(':').map(Number);
            cellsByRow.set(rowIndex, (cellsByRow.get(rowIndex) || 0) + 1);
        }
        for (const [rowIndex, count] of cellsByRow.entries()) {
            if (count === columns.length) {
                rowsFullySelected.add(rowIndex);
            }
        }
        return rowsFullySelected;
    }, [selectedCells, columns]);
    
    const selectedColumns = useMemo(() => {
        if (selectedCells.size === 0 || acts.length === 0) return new Set<number>();
        const cellsByCol = new Map<number, number>();
        for (const cellId of selectedCells) {
            const [, colIndex] = cellId.split(':').map(Number);
            cellsByCol.set(colIndex, (cellsByCol.get(colIndex) || 0) + 1);
        }
        const colsFullySelected = new Set<number>();
        for (const [colIndex, count] of cellsByCol.entries()) {
            if (count === acts.length) {
                colsFullySelected.add(colIndex);
            }
        }
        return colsFullySelected;
    }, [selectedCells, acts.length]);

    const affectedRowsFromSelection = useMemo(() => {
        return new Set(Array.from(selectedCells, cellId => parseInt(cellId.split(':')[0], 10)));
    }, [selectedCells]);

    const groupOptions = useMemo(() => {
        return groups.map(g => ({ value: g.id, label: g.name }));
    }, [groups]);
    
    const handleCreateNewGroup = () => {
        setCurrentPage('groups');
    };

    const applyTemplatesToAct = useCallback((act: Act) => {
        const actToSave = { ...act };
        const resolve = (templateStr: string, contextAct: Act) => {
            if (!templateStr || typeof templateStr !== 'string') return templateStr;
            return templateStr.replace(/\{(\w+)\}/g, (_, key) => {
                let value;
                 if (key === 'workStartDate' || key === 'workEndDate') {
                    value = formatDateForDisplay((contextAct as any)[key]);
                } else {
                    value = (contextAct as any)[key];
                }
                return value !== undefined && value !== null ? String(value) : '';
            });
        };
        const dateTemplate = settings.defaultActDate !== undefined ? settings.defaultActDate : '{workEndDate}';
        const resolvedDateString = resolve(dateTemplate, actToSave);
        actToSave.date = parseDisplayDate(resolvedDateString) || actToSave.date;
        return actToSave;
    }, [settings]);

    const handleSaveWithTemplateResolution = useCallback((actToSave: Act) => {
        const resolvedAct = applyTemplatesToAct(actToSave);
        onSave(resolvedAct);
    }, [onSave, applyTemplatesToAct]);
    
    const performBulkUpdate = useCallback((modifiedActsMap: Map<string, Act>) => {
        if (modifiedActsMap.size === 0) return;
        let hasChanges = false;
        const finalActs = acts.map(act => {
            if (modifiedActsMap.has(act.id)) {
                const updatedAct = applyTemplatesToAct(modifiedActsMap.get(act.id)!);
                if (JSON.stringify(act) !== JSON.stringify(updatedAct)) {
                    hasChanges = true;
                    return updatedAct;
                }
            }
            return act;
        });
        if (hasChanges) {
            onReorderActs(finalActs);
        }
    }, [acts, applyTemplatesToAct, onReorderActs]);

    const getOrgDetailsString = useCallback((org: Organization): string => {
        return `${org.name}, ИНН ${org.inn}, ОГРН ${org.ogrn}, ${org.address}`;
    }, []);

    const handleGroupChange = (act: Act, groupId: string) => {
        const selectedGroup = groups.find(g => g.id === groupId);
        const orgMap = new Map(organizations.map(org => [org.id, org]));
        const updatedAct = { ...act };
        updatedAct.commissionGroupId = groupId || undefined;
        if (selectedGroup) {
            updatedAct.representatives = { ...selectedGroup.representatives };
            updatedAct.builderOrgId = selectedGroup.builderOrgId;
            updatedAct.contractorOrgId = selectedGroup.contractorOrgId;
            updatedAct.designerOrgId = selectedGroup.designerOrgId;
            updatedAct.workPerformerOrgId = selectedGroup.workPerformerOrgId;
            updatedAct.builderDetails = selectedGroup.builderOrgId && orgMap.has(selectedGroup.builderOrgId) ? getOrgDetailsString(orgMap.get(selectedGroup.builderOrgId)!) : '';
            updatedAct.contractorDetails = selectedGroup.contractorOrgId && orgMap.has(selectedGroup.contractorOrgId) ? getOrgDetailsString(orgMap.get(selectedGroup.contractorOrgId)!) : '';
            updatedAct.designerDetails = selectedGroup.designerOrgId && orgMap.has(selectedGroup.designerOrgId) ? getOrgDetailsString(orgMap.get(selectedGroup.designerOrgId)!) : '';
            updatedAct.workPerformer = selectedGroup.workPerformerOrgId && orgMap.has(selectedGroup.workPerformerOrgId) ? getOrgDetailsString(orgMap.get(selectedGroup.workPerformerOrgId)!) : '';
        }
        handleSaveWithTemplateResolution(updatedAct);
    };

    const closeEditor = useCallback(() => {
        setEditingCell(null);
        setDateError(null);
    }, []);
    
    // ... [handleEditorSave, editor effects, handleEditorChange, handleEditorKeyDown same as before] ...
    const handleEditorSave = useCallback(() => {
        if (!editingCell) return true;
        const { rowIndex, colIndex } = editingCell;
        const act = acts[rowIndex];
        const col = columns[colIndex];
        const updatedAct = { ...act };
        if (col.key === 'workDates') {
            const parts = editorValue.split('-').map(s => s.trim());
            const startStr = parts[0];
            const endStr = parts.length > 1 ? parts[1] : startStr;
            if (!startStr && !endStr) { 
                setDateError(null);
                updatedAct.workStartDate = '';
                updatedAct.workEndDate = '';
            } else {
                const start = parseDisplayDate(startStr);
                const end = parseDisplayDate(endStr);
                if (!start) { setDateError(`Неверный формат даты начала. Используйте ДД.ММ.ГГГГ.`); return false; }
                if (!end) { setDateError(`Неверный формат даты окончания. Используйте ДД.ММ.ГГГГ.`); return false; }
                if (new Date(end) < new Date(start)) { setDateError('Дата окончания не может быть раньше даты начала.'); return false; }
                setDateError(null);
                updatedAct.workStartDate = start;
                updatedAct.workEndDate = end;
            }
        } else {
            const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'id' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates' | 'nextWorkActId'>;
            (updatedAct as any)[columnKey] = editorValue;
            if (col.key === 'nextWork') {
                updatedAct.nextWork = editorValue;
                if (act.nextWorkActId === AUTO_NEXT_ID) { updatedAct.nextWorkActId = undefined; } else { updatedAct.nextWorkActId = undefined; }
            }
        }
        if (JSON.stringify(updatedAct) !== JSON.stringify(act)) {
            handleSaveWithTemplateResolution(updatedAct);
        }
        return true; 
    }, [acts, columns, editingCell, editorValue, handleSaveWithTemplateResolution]);

    useEffect(() => {
        if (!editingCell) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (datePopoverState || regulationsModalOpen || regulationPopoverState || materialPopoverState) return;
            if (editorContainerRef.current && !editorContainerRef.current.contains(event.target as Node)) {
                const isModalClick = (event.target as HTMLElement).closest('.fixed.inset-0.z-50');
                if (isModalClick) return;
                handleEditorSave();
                closeEditor();
            }
        };
        const timerId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);
        return () => {
            clearTimeout(timerId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [editingCell, datePopoverState, handleEditorSave, closeEditor, regulationsModalOpen, regulationPopoverState, materialPopoverState]);

    useEffect(() => {
        if (editingCell) {
            const { rowIndex, colIndex } = editingCell;
            const act = acts[rowIndex];
            const col = columns[colIndex];
            let initialValue;
            if (col.key === 'workDates') {
                const start = formatDateForDisplay(act.workStartDate);
                const end = formatDateForDisplay(act.workEndDate);
                initialValue = (start && end && start !== end) ? `${start} - ${end}` : (start || '');
            } else if (col.type === 'date') {
                const columnKey = col.key as keyof Act;
                initialValue = formatDateForDisplay(act[columnKey] as string || '');
            } else if (col.key === 'regulations') {
                initialValue = act.regulations || '';
            } else if (col.key === 'materials') {
                initialValue = act.materials || '';
            } else if (col.key === 'nextWork' && act.nextWorkActId === AUTO_NEXT_ID) {
                const nextAct = acts[rowIndex + 1];
                initialValue = nextAct ? `Работы по акту №${nextAct.number || 'б/н'} (${nextAct.workName || '...'})` : '';
            } else {
                const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates' | 'nextWorkActId'>;
                initialValue = act[columnKey] || '';
            }
            setEditorValue(String(initialValue));
            setTimeout(() => {
                if (col.key !== 'regulations' && col.key !== 'materials') { if (editorRef.current) editorRef.current.focus(); }
                if (editorRef.current instanceof HTMLTextAreaElement) {
                    const el = editorRef.current;
                    el.style.height = 'auto';
                    el.style.height = `${el.scrollHeight}px`;
                    el.selectionStart = el.selectionEnd = el.value.length;
                } else if (editorRef.current instanceof HTMLInputElement) {
                    editorRef.current.select();
                }
            }, 0);
        }
    }, [editingCell, acts, columns]);

    const handleEditorChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setEditorValue(e.target.value);
        setDateError(null);
        if (e.target instanceof HTMLTextAreaElement) {
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
        }
    };
    
    const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); closeEditor(); }
        if (e.key === 'Enter' && !e.shiftKey) {
            if (e.currentTarget instanceof HTMLInputElement || (e.currentTarget instanceof HTMLTextAreaElement && (e.ctrlKey || e.metaKey))) {
                e.preventDefault();
                if(handleEditorSave()) { closeEditor(); }
            }
        }
    };
    
    // ... [handleRegulationsSelect, handleShowRegulationInfo, findCertByText, handleShowMaterialInfo, selection logic...] ...
    const handleRegulationsSelect = (selectedRegs: Regulation[]) => {
        if (!editingCell) return;
        const newText = selectedRegs.map(reg => reg.designation).join('; ');
        setEditorValue(prev => {
            if (!prev) return newText;
            const sep = prev.trim().endsWith(';') ? ' ' : '; ';
            return prev + sep + newText;
        });
        if (editorRef.current instanceof HTMLTextAreaElement) {
             setTimeout(() => {
                 if (editorRef.current) {
                    editorRef.current.style.height = 'auto';
                    editorRef.current.style.height = `${editorRef.current.scrollHeight}px`;
                 }
             }, 0);
        }
    };
    
    const handleShowRegulationInfo = (designation: string, target: HTMLElement) => {
        const regulation = regulations.find(r => r.designation === designation);
        if (regulation) {
            const coords = getRelativeCoords(target);
            setRegulationPopoverState({ regulation, position: { top: coords.top, left: coords.left } });
        }
    };

    const findCertByText = (text: string) => {
        const match = text.match(/№\s*([^\s,]+)/);
        if (match) {
            const certNum = match[1];
            return certificates?.find(c => c.number.includes(certNum));
        }
        return null;
    };

    const handleShowMaterialInfo = (text: string, target: HTMLElement) => {
        const cert = findCertByText(text);
        if (cert) {
            const coords = getRelativeCoords(target);
            setMaterialPopoverState({ 
                certificate: cert, 
                materialName: text,
                position: { top: coords.top, left: coords.left } 
            });
        }
    };

    const normalizeSelection = (start: Coords, end: Coords): { minRow: number, maxRow: number, minCol: number, maxCol: number } => {
        const minRow = Math.min(start.rowIndex, end.rowIndex);
        const maxRow = Math.max(start.rowIndex, end.rowIndex);
        const minCol = Math.min(start.colIndex, end.colIndex);
        const maxCol = Math.max(start.colIndex, end.colIndex);
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
        tableContainerRef.current?.focus({ preventScroll: true });
        setContextMenu(null); 
        if (e.detail > 1) e.preventDefault();
        setCopiedCells(null);
        setDatePopoverState(null);
        setRegulationPopoverState(null);
        setMaterialPopoverState(null);
        setNextWorkPopoverState(null);
        if (e.button === 2) {
             const cellId = getCellId(rowIndex, colIndex);
             if (!selectedCells.has(cellId)) {
                 setActiveCell({ rowIndex, colIndex });
                 setSelectedCells(new Set([cellId]));
             }
             return;
        }
        if (e.button !== 0) return;
        if (e.shiftKey && activeCell) {
            const { minRow, maxRow, minCol, maxCol } = normalizeSelection(activeCell, { rowIndex, colIndex });
            const newSelection = new Set<string>();
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    newSelection.add(getCellId(r, c));
                }
            }
            setSelectedCells(newSelection);
        } else if (e.ctrlKey || e.metaKey) {
            setActiveCell({ rowIndex, colIndex });
            const cellId = getCellId(rowIndex, colIndex);
            const newSelection = new Set(selectedCells);
            if (newSelection.has(cellId)) {
                newSelection.delete(cellId);
            } else {
                newSelection.add(cellId);
            }
            setSelectedCells(newSelection);
        } else {
            setActiveCell({ rowIndex, colIndex });
            setSelectedCells(new Set([getCellId(rowIndex, colIndex)]));
            setIsDraggingSelection(true);
        }
    };

    const handleCellMouseEnter = (rowIndex: number, colIndex: number) => {
        if (isDraggingSelection && activeCell) {
            const { minRow, maxRow, minCol, maxCol } = normalizeSelection(activeCell, { rowIndex, colIndex });
            const newSelection = new Set<string>();
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    newSelection.add(getCellId(r, c));
                }
            }
            setSelectedCells(newSelection);
        }
    };

    const handleCellDoubleClick = (rowIndex: number, colIndex: number) => {
        const col = columns[colIndex];
        if (col.key === 'id' || col.key === 'copiesCount') return; 
        if (col.key === 'workDates') {
            const act = acts[rowIndex];
            const target = document.querySelector(`td[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`) as HTMLElement;
            if (target) {
                const coords = getRelativeCoords(target);
                setDatePopoverState({ act, position: { top: coords.top, left: coords.left, width: 220 } });
            }
        } else if (col.key === 'nextWork') {
             const target = document.querySelector(`td[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`) as HTMLElement;
             if (target) {
                 const coords = getRelativeCoords(target);
                 setNextWorkPopoverState({ rowIndex, colIndex, position: { top: coords.top, left: coords.left, width: 300 } });
             }
        } else {
            setEditingCell({ rowIndex, colIndex });
        }
    };

    // ... [Auto scroll, document event listeners for drag/drop, context menu, etc unchanged] ...
    useEffect(() => {
        const handleWindowMouseUp = () => {
            setIsDraggingSelection(false);
            setDragIndicator(null);
            setDraggedRowIndices(null);
            setDropTargetRowIndex(null);
            setDropPosition(null);
            setDraggedColKey(null);
            setDropTargetColKey(null);
            setDropColPosition(null);
            
            if (fillTargetArea && activeCell) {
                const { start, end } = fillTargetArea;
                const { minRow, maxRow, minCol, maxCol } = normalizeSelection(start, end);
                const sourceRowIndex = activeCell.rowIndex;
                const sourceColIndex = activeCell.colIndex;
                const sourceValue = acts[sourceRowIndex][columns[sourceColIndex].key as keyof Act]; 
                
                const updatesMap = new Map<string, Act>();
                for (let r = minRow; r <= maxRow; r++) {
                    for (let c = minCol; c <= maxCol; c++) {
                        if (r === sourceRowIndex && c === sourceColIndex) continue;
                        const act = acts[r];
                        const colKey = columns[c].key as keyof Act;
                        if (colKey === 'id') continue; 
                        
                        const currentAct = updatesMap.get(act.id) || { ...act };
                        (currentAct as any)[colKey] = sourceValue;
                        updatesMap.set(act.id, currentAct);
                    }
                }
                performBulkUpdate(updatesMap);
                
                const newSelection = new Set<string>();
                for (let r = minRow; r <= maxRow; r++) {
                    for (let c = minCol; c <= maxCol; c++) {
                        newSelection.add(getCellId(r, c));
                    }
                }
                setSelectedCells(newSelection);
            }
            setIsFilling(false);
            setFillTargetArea(null);
        };

        const handleWindowMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
            if (isFilling && activeCell) {
                const targetCoords = getCellCoordsFromEvent(e);
                if (targetCoords) {
                    setFillTargetArea({ start: activeCell, end: targetCoords });
                }
            }
        };

        window.addEventListener('mouseup', handleWindowMouseUp);
        window.addEventListener('mousemove', handleWindowMouseMove);
        return () => {
            window.removeEventListener('mouseup', handleWindowMouseUp);
            window.removeEventListener('mousemove', handleWindowMouseMove);
        };
    }, [isDraggingSelection, isFilling, fillTargetArea, activeCell, acts, columns, performBulkUpdate]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (editingCell) return;
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            if (!activeCell) { setActiveCell({ rowIndex: 0, colIndex: 0 }); return; }
            let { rowIndex, colIndex } = activeCell;
            if (e.key === 'ArrowUp') rowIndex = Math.max(0, rowIndex - 1);
            if (e.key === 'ArrowDown') rowIndex = Math.min(acts.length - 1, rowIndex + 1);
            if (e.key === 'ArrowLeft') colIndex = Math.max(0, colIndex - 1);
            if (e.key === 'ArrowRight') colIndex = Math.min(columns.length - 1, colIndex + 1);
            
            setActiveCell({ rowIndex, colIndex });
            if (!e.shiftKey) { setSelectedCells(new Set([getCellId(rowIndex, colIndex)])); }
            else {
                const { minRow, maxRow, minCol, maxCol } = normalizeSelection(activeCell, { rowIndex, colIndex });
                const newSelection = new Set<string>();
                for (let r = minRow; r <= maxRow; r++) { for (let c = minCol; c <= maxCol; c++) { newSelection.add(getCellId(r, c)); } }
                setSelectedCells(newSelection);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeCell) handleCellDoubleClick(activeCell.rowIndex, activeCell.colIndex);
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            e.preventDefault(); handleCopy();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            e.preventDefault(); handlePaste();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault(); handleClearSelectedCells();
        } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const all = new Set<string>();
            for(let r=0; r<acts.length; r++) for(let c=0; c<columns.length; c++) all.add(getCellId(r, c));
            setSelectedCells(all);
        }
    };

    const handleCopy = () => {
        if (selectedCells.size === 0) return;
        setCopiedCells(new Set(selectedCells));
        const { minRow, maxRow, minCol, maxCol } = getSelectionBounds();
        let csv = '';
        for (let r = minRow; r <= maxRow; r++) {
            const rowValues = [];
            for (let c = minCol; c <= maxCol; c++) {
                if (selectedCells.has(getCellId(r, c))) {
                    const act = acts[r];
                    const col = columns[c];
                    let val = (act as any)[col.key];
                    if (col.key === 'workDates') val = `${act.workStartDate} - ${act.workEndDate}`;
                    rowValues.push(val);
                } else { rowValues.push(''); }
            }
            csv += rowValues.join('\t') + '\n';
        }
        navigator.clipboard.writeText(csv);
    };

    const handlePaste = async () => {
        if (!activeCell) return;
        try {
            const text = await navigator.clipboard.readText();
            const rows = text.split('\n').filter(r => r.length > 0); // Don't filter empty lines if you want to support clearing, but for paste usually we want content
            if (rows.length === 0) return;
            
            const updatesMap = new Map<string, Act>();
            const startRow = activeCell.rowIndex;
            const startCol = activeCell.colIndex;

            rows.forEach((rowStr, rOffset) => {
                const cells = rowStr.split('\t');
                cells.forEach((val, cOffset) => {
                    const targetRow = startRow + rOffset;
                    const targetCol = startCol + cOffset;
                    if (targetRow < acts.length && targetCol < columns.length) {
                        const act = acts[targetRow];
                        const col = columns[targetCol];
                        if (col.key !== 'id') {
                            const currentAct = updatesMap.get(act.id) || { ...act };
                            if (col.key === 'workDates') {
                                const parts = val.split('-').map(s => s.trim());
                                currentAct.workStartDate = parts[0] || '';
                                currentAct.workEndDate = parts[1] || parts[0] || '';
                            } else {
                                (currentAct as any)[col.key] = val;
                            }
                            updatesMap.set(act.id, currentAct);
                        }
                    }
                });
            });
            performBulkUpdate(updatesMap);
        } catch (err) { console.error("Paste failed", err); }
    };

    const handleClearSelectedCells = () => {
        const updatesMap = new Map<string, Act>();
        selectedCells.forEach(cellId => {
            const [r, c] = cellId.split(':').map(Number);
            const act = acts[r];
            const col = columns[c];
            if (col.key !== 'id' && col.key !== 'representatives') {
                const currentAct = updatesMap.get(act.id) || { ...act };
                if (col.key === 'workDates') {
                    currentAct.workStartDate = '';
                    currentAct.workEndDate = '';
                } else {
                    (currentAct as any)[col.key] = '';
                }
                updatesMap.set(act.id, currentAct);
            }
        });
        performBulkUpdate(updatesMap);
    };

    const getSelectionBounds = () => {
        let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
        selectedCells.forEach(id => {
            const [r, c] = id.split(':').map(Number);
            if (r < minRow) minRow = r;
            if (r > maxRow) maxRow = r;
            if (c < minCol) minCol = c;
            if (c > maxCol) maxCol = c;
        });
        return { minRow, maxRow, minCol, maxCol };
    };

    const handleScroll = () => {
        if (!scrollContainerRef.current || !tableContainerRef.current) return;
        setDatePopoverState(null);
        setRegulationPopoverState(null);
        setMaterialPopoverState(null);
        setNextWorkPopoverState(null);
    };

    // Render logic
    return (
        <div 
            ref={tableContainerRef} 
            className="relative h-full flex flex-col bg-slate-50 overflow-hidden select-none outline-none" 
            tabIndex={0} 
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
        >
            <div ref={scrollContainerRef} className="overflow-auto flex-grow relative scroll-shadows" onScroll={handleScroll}>
                <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                    <thead className="bg-slate-50 sticky top-0 z-20">
                        <tr>
                            <th className="sticky left-0 bg-slate-50 z-30 w-10 border-b border-r border-slate-200 p-0 text-center font-normal text-slate-400 select-none">
                                #
                            </th>
                            {columns.map((col, index) => (
                                <th
                                    key={col.key}
                                    className={`px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-r border-slate-200 relative group select-none ${col.widthClass} ${selectedColumns.has(index) ? 'bg-blue-50 text-blue-700' : ''} ${dropTargetColKey === col.key ? (dropColPosition === 'left' ? 'border-l-4 border-l-blue-500' : 'border-r-4 border-r-blue-500') : ''}`}
                                    onMouseEnter={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setHoveredHeaderKey(col.key);
                                        setHoveredHeaderPos({ top: rect.bottom, left: rect.left });
                                    }}
                                    onMouseLeave={() => setHoveredHeaderKey(null)}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="truncate">{col.label}</span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200 relative">
                        {acts.length > 0 ? acts.map((act, rowIndex) => (
                            <tr key={act.id} className={`group ${selectedRows.has(rowIndex) ? 'bg-blue-50' : ''} ${dropTargetRowIndex === rowIndex ? (dropPosition === 'top' ? 'drop-target-row-top' : 'drop-target-row-bottom') : ''} ${actPickerState?.sourceRowIndex === rowIndex ? 'act-picker-source-row' : ''} ${actPickerState ? 'act-picker-mode' : ''}`}>
                                <td 
                                    className={`sticky left-0 z-10 w-10 border-r border-b border-slate-200 p-0 text-center text-xs text-slate-400 select-none cursor-pointer ${selectedRows.has(rowIndex) ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-slate-50 hover:bg-slate-100'} ${actPickerState?.sourceRowIndex === rowIndex ? 'bg-yellow-100' : ''}`}
                                    onClick={() => {
                                        if (actPickerState) {
                                            // Handle Copy logic if in picker mode
                                            const sourceAct = acts[actPickerState.sourceRowIndex];
                                            const newAct = { ...sourceAct, id: crypto.randomUUID(), number: '', date: new Date().toISOString().split('T')[0], workStartDate: '', workEndDate: '' };
                                            onSave(newAct, rowIndex + 1); // Insert after target
                                            setActPickerState(null);
                                        } else {
                                            // Select row
                                            const newSelection = new Set<string>();
                                            for(let c=0; c<columns.length; c++) newSelection.add(getCellId(rowIndex, c));
                                            setSelectedCells(newSelection);
                                        }
                                    }}
                                    onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, rowIndex, colIndex: -1 }); }}
                                >
                                    {rowIndex + 1}
                                </td>
                                {columns.map((col, colIndex) => {
                                    const cellId = getCellId(rowIndex, colIndex);
                                    const isSelected = selectedCells.has(cellId);
                                    const isActive = activeCell?.rowIndex === rowIndex && activeCell?.colIndex === colIndex;
                                    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
                                    const isCopied = copiedCells?.has(cellId);
                                    
                                    const cellStyle = isEditing ? { padding: 0 } : undefined;

                                    return (
                                        <td
                                            key={colIndex}
                                            data-row-index={rowIndex}
                                            data-col-index={colIndex}
                                            onMouseDown={(e) => handleCellMouseDown(e, rowIndex, colIndex)}
                                            onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                                            onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                                            className={`relative px-3 py-2 whitespace-pre-wrap align-top text-sm outline-none cursor-default transition-colors duration-75
                                                ${col.key === 'id' ? 'font-mono text-xs text-slate-400 bg-slate-50' : ''}
                                                ${isSelected ? 'bg-blue-100' : ''}
                                                ${isActive ? 'ring-2 ring-inset ring-blue-500 z-10' : 'border-b border-r border-slate-200'}
                                                ${isDraggingSelection ? 'select-none' : ''}
                                                ${col.key === 'workDates' ? 'min-w-[200px]' : ''}
                                            `}
                                            style={cellStyle}
                                        >
                                            {isCopied && <div className="copied-cell-overlay"></div>}
                                            {isEditing ? (
                                                <div ref={editorContainerRef} className="w-full h-full min-h-[2rem]">
                                                    {col.key === 'commissionGroup' ? (
                                                        <CustomSelect
                                                            options={groupOptions}
                                                            value={editorValue}
                                                            onChange={(val) => {
                                                                handleGroupChange(act, val);
                                                                closeEditor();
                                                            }}
                                                            onCreateNew={handleCreateNewGroup}
                                                            startOpen={true}
                                                            placeholder="Выберите группу..."
                                                            className="w-full h-full"
                                                            buttonClassName="w-full h-full p-2 text-left bg-white focus:outline-none"
                                                        />
                                                    ) : col.key === 'regulations' ? (
                                                        <div className="min-w-[300px] h-auto bg-white shadow-lg border rounded p-2 z-50 absolute top-0 left-0">
                                                            <RegulationsInput 
                                                                value={editorValue} 
                                                                onChange={(val) => { setEditorValue(val); }} 
                                                                regulations={regulations}
                                                                onOpenDictionary={() => setRegulationsModalOpen(true)}
                                                            />
                                                        </div>
                                                    ) : col.key === 'materials' ? (
                                                        <div className="min-w-[400px] h-auto bg-white shadow-lg border rounded p-2 z-50 absolute top-0 left-0">
                                                            <MaterialsInput
                                                                value={editorValue}
                                                                onChange={setEditorValue}
                                                                certificates={certificates || []}
                                                                onNavigateToCertificate={onNavigateToCertificate}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <textarea
                                                            ref={editorRef as any}
                                                            value={editorValue}
                                                            onChange={handleEditorChange}
                                                            onKeyDown={handleEditorKeyDown}
                                                            className="w-full h-full min-h-[2rem] p-2 bg-white resize-none outline-none overflow-hidden"
                                                            autoFocus
                                                        />
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="w-full h-full min-h-[1.5rem] break-words">
                                                    {col.key === 'commissionGroup' ? (
                                                        groups.find(g => g.id === act.commissionGroupId)?.name || <span className="text-slate-300 italic">Не выбрано</span>
                                                    ) : col.key === 'workDates' ? (
                                                        <span className="flex items-center gap-1">
                                                            {(act.workStartDate || act.workEndDate) ? (
                                                                <>
                                                                    <CalendarIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                                                    <span>{formatDateForDisplay(act.workStartDate)} - {formatDateForDisplay(act.workEndDate)}</span>
                                                                </>
                                                            ) : <span className="text-slate-300 italic text-xs">Нет дат</span>}
                                                        </span>
                                                    ) : col.key === 'date' ? (
                                                        formatDateForDisplay(act.date)
                                                    ) : col.key === 'nextWork' ? (
                                                        <div className="flex items-start justify-between group/cell">
                                                            <span className={act.nextWorkActId === AUTO_NEXT_ID ? 'text-blue-600 font-medium' : ''}>
                                                                {act.nextWorkActId === AUTO_NEXT_ID ? AUTO_NEXT_LABEL : (act.nextWork || <span className="text-slate-300 italic">...</span>)}
                                                            </span>
                                                            <button 
                                                                className="opacity-0 group-hover/cell:opacity-100 text-slate-400 hover:text-blue-600 p-0.5 rounded transition-opacity" 
                                                                onClick={(e) => { e.stopPropagation(); handleCellDoubleClick(rowIndex, colIndex); }}
                                                            >
                                                                <EditIcon className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ) : col.key === 'regulations' ? (
                                                        act.regulations ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {act.regulations.split(';').map((regStr, i) => {
                                                                    const trimmed = regStr.trim();
                                                                    if (!trimmed) return null;
                                                                    const regStatus = regulations.find(r => r.designation === trimmed)?.status;
                                                                    const statusColor = regStatus?.includes('Действует') ? 'text-green-700 bg-green-50 border-green-200' : regStatus ? 'text-red-700 bg-red-50 border-red-200' : 'text-slate-700 bg-slate-50 border-slate-200';
                                                                    return (
                                                                        <span 
                                                                            key={i} 
                                                                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border cursor-pointer hover:underline ${statusColor}`}
                                                                            onClick={(e) => { e.stopPropagation(); handleShowRegulationInfo(trimmed, e.currentTarget); }}
                                                                        >
                                                                            {trimmed}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : <span className="text-slate-300 italic">...</span>
                                                    ) : col.key === 'materials' ? (
                                                        act.materials ? (
                                                            <div className="text-xs">
                                                                {act.materials.split(';').map((mat, i) => {
                                                                    const trimmed = mat.trim();
                                                                    if (!trimmed) return null;
                                                                    // Check for certificate link pattern
                                                                    const hasCertLink = trimmed.includes('(сертификат №');
                                                                    return (
                                                                        <div key={i} className="mb-1 last:mb-0">
                                                                            {hasCertLink ? (
                                                                                <span 
                                                                                    className="text-blue-700 cursor-pointer hover:underline decoration-blue-300"
                                                                                    onClick={(e) => { e.stopPropagation(); handleShowMaterialInfo(trimmed, e.currentTarget); }}
                                                                                >
                                                                                    {trimmed}
                                                                                </span>
                                                                            ) : (
                                                                                <span>{trimmed}</span>
                                                                            )}
                                                                            {/* Add Link Button Logic could go here */}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : <span className="text-slate-300 italic">...</span>
                                                    ) : (
                                                        (act as any)[col.key] || <span className="text-slate-300 italic">...</span>
                                                    )}
                                                </div>
                                            )}
                                            {/* Fill Handle */}
                                            {isActive && !isEditing && (
                                                <div
                                                    className="absolute bottom-[-4px] right-[-4px] w-3 h-3 bg-blue-500 border-2 border-white cursor-crosshair z-20"
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        setIsFilling(true);
                                                        setFillHandleCoords({ top: e.clientY, left: e.clientX });
                                                        setFillTargetArea({ start: activeCell!, end: activeCell! });
                                                    }}
                                                ></div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={columns.length + 1} className="text-center py-20 text-slate-400">
                                    Нет актов. Нажмите "Добавить новый акт" или используйте контекстное меню.
                                </td>
                            </tr>
                        )}
                        {/* Empty row at bottom to allow scrolling past last element easily */}
                        <tr className="h-24"><td colSpan={columns.length + 1}></td></tr>
                    </tbody>
                </table>
            </div>

            {/* Floating UI Elements */}
            {hoveredHeaderKey && <RichHeaderTooltip column={ALL_COLUMNS.find(c => c.key === hoveredHeaderKey)!} position={hoveredHeaderPos} />}
            
            {datePopoverState && (
                <DateEditorPopover 
                    act={datePopoverState.act} 
                    onActChange={(updatedAct) => {
                        handleSaveWithTemplateResolution(updatedAct);
                        // Don't close immediately to allow multiple edits, maybe? Or close?
                        // Usually closing is better UX for "done".
                        // But for "quick add" buttons, we might want to stay open.
                        // Let's keep it open until click outside.
                    }}
                    onClose={() => setDatePopoverState(null)} 
                    position={datePopoverState.position} 
                />
            )}

            {regulationPopoverState && (
                <RegulationPopover
                    regulation={regulationPopoverState.regulation}
                    position={regulationPopoverState.position}
                    onClose={() => setRegulationPopoverState(null)}
                    onOpenDetails={() => {
                        setFullRegulationDetails(regulationPopoverState.regulation);
                        setRegulationPopoverState(null);
                    }}
                />
            )}

            {materialPopoverState && (
                <MaterialPopover
                    certificate={materialPopoverState.certificate}
                    materialName={materialPopoverState.materialName}
                    position={materialPopoverState.position}
                    onClose={() => setMaterialPopoverState(null)}
                    onNavigate={(certId) => {
                        if (onNavigateToCertificate) onNavigateToCertificate(certId);
                    }}
                />
            )}

            {nextWorkPopoverState && (
                <NextWorkPopover
                    acts={acts}
                    currentActId={acts[nextWorkPopoverState.rowIndex].id}
                    onSelect={(val) => {
                        const act = acts[nextWorkPopoverState.rowIndex];
                        const updatedAct = { ...act };
                        if (val === null) {
                            updatedAct.nextWorkActId = undefined;
                            updatedAct.nextWork = '';
                        } else if (typeof val === 'string') {
                            if (val === AUTO_NEXT_ID) {
                                updatedAct.nextWorkActId = AUTO_NEXT_ID;
                                updatedAct.nextWork = ''; // Will be calculated dynamically
                            } else {
                                updatedAct.nextWorkActId = undefined;
                                updatedAct.nextWork = val;
                            }
                        } else {
                            // val is Act
                            updatedAct.nextWorkActId = val.id;
                            updatedAct.nextWork = `Работы по акту №${val.number} (${val.workName})`;
                        }
                        handleSaveWithTemplateResolution(updatedAct);
                        setNextWorkPopoverState(null);
                    }}
                    onClose={() => setNextWorkPopoverState(null)}
                    position={nextWorkPopoverState.position}
                />
            )}

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
                    <MenuItem 
                        icon={<RowBelowIcon className="w-4 h-4"/>} 
                        label="Вставить строку ниже" 
                        shortcut="Ctrl+Enter"
                        onClick={() => {
                            const newAct = createNewAct();
                            // Logic to smart copy dates if needed
                            const currentAct = acts[contextMenu.rowIndex];
                            if (currentAct && currentAct.workEndDate) {
                                newAct.workStartDate = currentAct.workEndDate; // Start next work when previous ended
                            }
                            onSave(newAct, contextMenu.rowIndex + 1);
                            setContextMenu(null);
                        }} 
                    />
                    <MenuItem 
                        icon={<CopyIcon className="w-4 h-4"/>} 
                        label="Дублировать строку" 
                        onClick={() => {
                            const currentAct = acts[contextMenu.rowIndex];
                            const newAct = { ...currentAct, id: crypto.randomUUID(), number: '', date: new Date().toISOString().split('T')[0] };
                            onSave(newAct, contextMenu.rowIndex + 1);
                            setContextMenu(null);
                        }} 
                    />
                    <MenuItem 
                        icon={<SparklesIcon className="w-4 h-4 text-purple-500"/>} 
                        label="Умная вставка (AI Copy)" 
                        onClick={() => {
                            setActPickerState({ sourceRowIndex: contextMenu.rowIndex });
                            setContextMenu(null);
                            alert("Выберите строку, данные которой нужно скопировать в новую строку.");
                        }} 
                    />
                    <MenuSeparator />
                    <MenuItem 
                        icon={<DownloadIcon className="w-4 h-4 text-blue-600"/>} 
                        label="Сгенерировать документ" 
                        onClick={() => {
                            const act = acts[contextMenu.rowIndex];
                            if (!template) { alert("Сначала загрузите шаблон"); return; }
                            generateDocument(template, registryTemplate, act, people, settings, certificates); // Pass certificates
                            setContextMenu(null);
                        }} 
                    />
                    <MenuSeparator />
                    <MenuItem 
                        icon={<DeleteIcon className="w-4 h-4 text-red-600"/>} 
                        label="Удалить строку" 
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => {
                            onRequestDelete([acts[contextMenu.rowIndex].id]);
                            setContextMenu(null);
                        }} 
                    />
                </ContextMenu>
            )}

            <Modal isOpen={regulationsModalOpen} onClose={() => setRegulationsModalOpen(false)} title="Справочник нормативов">
                <RegulationsModal 
                    isOpen={regulationsModalOpen} 
                    onClose={() => setRegulationsModalOpen(false)} 
                    regulations={regulations}
                    onSelect={handleRegulationsSelect}
                />
            </Modal>

            {fullRegulationDetails && (
                <Modal isOpen={!!fullRegulationDetails} onClose={() => setFullRegulationDetails(null)} title="">
                    <RegulationDetails regulation={fullRegulationDetails} onClose={() => setFullRegulationDetails(null)} />
                </Modal>
            )}
            
            {/* New: Link Material Modal */}
            {linkMaterialModalState && (
                <MaterialsModal
                    isOpen={linkMaterialModalState.isOpen}
                    onClose={() => setLinkMaterialModalState(null)}
                    certificates={certificates || []}
                    onSelect={(text) => {
                        // Logic to replace the specific material item in the text string
                        // This requires parsing the full string, replacing, and saving.
                        // Implemented simplified version: Just appending for now or replacing logic if we had exact index editing.
                        // Since 'materials' is a string, complex replacement is tricky without index.
                        // For this specific feature (context menu link), we might need a more robust editor.
                        // Falling back to just showing the modal for manual copy for now if needed, 
                        // OR assuming we are in the editor.
                        // Actually, MaterialsInput handles this inside the editor. 
                        // This state is for a potential future feature where we link from the context menu of a readonly cell.
                        setLinkMaterialModalState(null);
                    }}
                    initialSearch={linkMaterialModalState.initialSearch}
                    editingMaterialTitle={linkMaterialModalState.editingMaterialTitle}
                    onNavigateToCertificate={onNavigateToCertificate}
                />
            )}

            {/* Selection/Fill Overlay or Indicators can go here */}
            {isFilling && fillTargetArea && (
                <div className="absolute pointer-events-none border-2 border-dashed border-blue-500 bg-blue-100/20 z-10"
                    style={{
                        // This requires complex calculation of top/left/width/height based on row/col indices
                        // For simplicity, we rely on the cell highlighting logic (isActive/isSelected) to show feedback
                        // But a bounding box would be nice.
                        // Omitting for brevity as cell highlighting covers the feedback needs.
                        display: 'none'
                    }}
                ></div>
            )}
        </div>
    );
};

export default ActsTable;