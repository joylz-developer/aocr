
import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { Act, Person, Organization, ProjectSettings, ROLES, CommissionGroup, Page, Coords, Regulation, Certificate } from '../types';
import Modal from './Modal';
import { DeleteIcon, CalendarIcon, LinkIcon, EditIcon, CopyIcon, PasteIcon, SparklesIcon, RowAboveIcon, RowBelowIcon, BookIcon, CloseIcon, GripVerticalIcon, DownloadIcon, QuestionMarkCircleIcon, ArrowDownCircleIcon } from './Icons';
import CustomSelect from './CustomSelect';
import { generateDocument } from '../services/docGenerator';
import { ALL_COLUMNS } from './ActsTableConfig';
import { ContextMenu, MenuItem, MenuSeparator } from './ContextMenu';
import RegulationsModal from './RegulationsModal';
import RegulationsInput from './RegulationsInput';
import RegulationDetails from './RegulationDetails';
import MaterialsInput from './MaterialsInput';

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
}

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


// Main Table Component
const ActsTable: React.FC<ActsTableProps> = ({ acts, people, organizations, groups, regulations, certificates = [], template, settings, visibleColumns, columnOrder, onColumnOrderChange, activeCell, setActiveCell, selectedCells, setSelectedCells, onSave, onRequestDelete, onReorderActs, setCurrentPage, createNewAct }) => {
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
    
    const [fullRegulationDetails, setFullRegulationDetails] = useState<Regulation | null>(null);

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowIndex: number; colIndex: number } | null>(null);

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

    // Helper to resolve templates and return updated Act object (does NOT save)
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

        if (settings.showAttachments && settings.defaultAttachments) {
            actToSave.attachments = resolve(settings.defaultAttachments, actToSave);
        }
        if (settings.showAdditionalInfo && settings.defaultAdditionalInfo) {
            actToSave.additionalInfo = resolve(settings.defaultAdditionalInfo, actToSave);
        }
        
        const dateTemplate = settings.defaultActDate !== undefined ? settings.defaultActDate : '{workEndDate}';
        const resolvedDateString = resolve(dateTemplate, actToSave);
        actToSave.date = parseDisplayDate(resolvedDateString) || actToSave.date;
        
        return actToSave;
    }, [settings]);

    const handleSaveWithTemplateResolution = useCallback((actToSave: Act) => {
        const resolvedAct = applyTemplatesToAct(actToSave);
        onSave(resolvedAct);
    }, [onSave, applyTemplatesToAct]);
    
    // Bulk Update Helper: Applies changes from a Map to the acts array and calls onReorderActs once
    const performBulkUpdate = useCallback((modifiedActsMap: Map<string, Act>) => {
        if (modifiedActsMap.size === 0) return;
        
        const finalActs = acts.map(act => {
            if (modifiedActsMap.has(act.id)) {
                return applyTemplatesToAct(modifiedActsMap.get(act.id)!);
            }
            return act;
        });
        onReorderActs(finalActs);
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

            updatedAct.builderDetails = selectedGroup.builderOrgId && orgMap.has(selectedGroup.builderOrgId) 
                ? getOrgDetailsString(orgMap.get(selectedGroup.builderOrgId)!) 
                : '';
            updatedAct.contractorDetails = selectedGroup.contractorOrgId && orgMap.has(selectedGroup.contractorOrgId) 
                ? getOrgDetailsString(orgMap.get(selectedGroup.contractorOrgId)!) 
                : '';
            updatedAct.designerDetails = selectedGroup.designerOrgId && orgMap.has(selectedGroup.designerOrgId) 
                ? getOrgDetailsString(orgMap.get(selectedGroup.designerOrgId)!) 
                : '';
            updatedAct.workPerformer = selectedGroup.workPerformerOrgId && orgMap.has(selectedGroup.workPerformerOrgId) 
                ? getOrgDetailsString(orgMap.get(selectedGroup.workPerformerOrgId)!) 
                : '';
        }

        handleSaveWithTemplateResolution(updatedAct);
    };

    const closeEditor = useCallback(() => {
        setEditingCell(null);
        setDateError(null);
    }, []);
    
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

            if (!startStr && !endStr) { // Allow clearing the cell
                setDateError(null);
                updatedAct.workStartDate = '';
                updatedAct.workEndDate = '';
            } else {
                const start = parseDisplayDate(startStr);
                const end = parseDisplayDate(endStr);
        
                if (!start) {
                    setDateError(`Неверный формат даты начала. Используйте ДД.ММ.ГГГГ.`);
                    return false;
                }
                if (!end) {
                    setDateError(`Неверный формат даты окончания. Используйте ДД.ММ.ГГГГ.`);
                    return false;
                }
                if (new Date(end) < new Date(start)) {
                    setDateError('Дата окончания не может быть раньше даты начала.');
                    return false;
                }
                setDateError(null);
                updatedAct.workStartDate = start;
                updatedAct.workEndDate = end;
            }
        } else {
            const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'id' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates' | 'nextWorkActId'>;
            (updatedAct as any)[columnKey] = editorValue;
            if (col.key === 'nextWork') {
                updatedAct.nextWork = editorValue;
                // Only clear the link if the user manually types something different than what 'AUTO_NEXT' would produce, or explicitly edits it.
                // For simplicity, manual edit breaks the link unless it was already AUTO_NEXT and we are just closing.
                // However, handleEditorSave is called on close. If value is same, don't change.
                if (act.nextWorkActId === AUTO_NEXT_ID) {
                     // Keep AUTO_NEXT if the text matches what's expected, OR if the user is just closing without changes?
                     // Actually, if user types manually, we usually want to overwrite 'AUTO_NEXT'.
                     updatedAct.nextWorkActId = undefined;
                } else {
                     updatedAct.nextWorkActId = undefined;
                }
            }
        }

        if (JSON.stringify(updatedAct) !== JSON.stringify(act)) {
            handleSaveWithTemplateResolution(updatedAct);
        }
        
        return true; // Success
    }, [acts, columns, editingCell, editorValue, handleSaveWithTemplateResolution]);
    

    useEffect(() => {
        if (!editingCell) return;
    
        const handleClickOutside = (event: MouseEvent) => {
            if (datePopoverState || regulationsModalOpen || regulationPopoverState) return;
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
    }, [editingCell, datePopoverState, handleEditorSave, closeEditor, regulationsModalOpen, regulationPopoverState]);


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
            } else if (col.key === 'nextWork' && act.nextWorkActId === AUTO_NEXT_ID) {
                // When editing an auto-next cell, show the resolved text so user can edit it if they want (breaking the link)
                const nextAct = acts[rowIndex + 1];
                if (nextAct) {
                    initialValue = `Работы по акту №${nextAct.number || 'б/н'} (${nextAct.workName || '...'})`;
                } else {
                    initialValue = '';
                }
            } else {
                const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates' | 'nextWorkActId'>;
                initialValue = act[columnKey] || '';
            }
            
            setEditorValue(String(initialValue));
            
            setTimeout(() => {
                if (col.key !== 'regulations' && col.key !== 'materials') { 
                     if (editorRef.current) editorRef.current.focus();
                }
        
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
        if (e.key === 'Escape') {
            e.preventDefault();
            closeEditor();
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            if (e.currentTarget instanceof HTMLInputElement || (e.currentTarget instanceof HTMLTextAreaElement && (e.ctrlKey || e.metaKey))) {
                e.preventDefault();
                if(handleEditorSave()) {
                    closeEditor();
                }
            }
        }
    };
    
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
        
        setContextMenu(null); // Ensure context menu is closed on left click

        if (e.detail > 1) e.preventDefault();
        setCopiedCells(null);
        
        setDatePopoverState(null);
        setRegulationPopoverState(null);
        setNextWorkPopoverState(null);

        if (e.button === 2) {
             const cellId = getCellId(rowIndex, colIndex);
             if (selectedCells.has(cellId)) return;
        }
    
        const cellId = getCellId(rowIndex, colIndex);
        if (e.shiftKey && activeCell) {
            const { minRow, maxRow, minCol, maxCol } = normalizeSelection(activeCell, { rowIndex, colIndex });
            const selection = new Set<string>();
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    selection.add(getCellId(r, c));
                }
            }
            setSelectedCells(selection);
        } else if (e.ctrlKey || e.metaKey) {
            const newSelectedCells = new Set(selectedCells);
            if (newSelectedCells.has(cellId)) {
                newSelectedCells.delete(cellId);
            } else {
                newSelectedCells.add(cellId);
            }
            setSelectedCells(newSelectedCells);
            setActiveCell({ rowIndex, colIndex });
        } else {
            setSelectedCells(new Set([cellId]));
            setActiveCell({ rowIndex, colIndex });
            setIsDraggingSelection(true);
        }
    };
    
    const handleRowHeaderMouseDown = (e: React.MouseEvent, rowIndex: number) => {
        dragHandlePressedRef.current = true;
        tableContainerRef.current?.focus({ preventScroll: true });
        const isRowSelected = selectedRows.has(rowIndex);
        if (e.button === 2) {
             if (isRowSelected) return;
        }
        if (e.button === 0 && isRowSelected && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
             return;
        }
        const newSelectedCells = new Set<string>();
        for (let c = 0; c < columns.length; c++) {
            newSelectedCells.add(getCellId(rowIndex, c));
        }
        if (e.shiftKey && activeCell) {
            const startRow = activeCell.rowIndex;
            const endRow = rowIndex;
            const minR = Math.min(startRow, endRow);
            const maxR = Math.max(startRow, endRow);
            const expandedSelection = new Set<string>();
             for (let r = minR; r <= maxR; r++) {
                for (let c = 0; c < columns.length; c++) {
                    expandedSelection.add(getCellId(r, c));
                }
            }
            setSelectedCells(expandedSelection);
        } else if (e.ctrlKey || e.metaKey) {
             const updatedSelection = new Set(selectedCells);
             const firstCellId = getCellId(rowIndex, 0);
             const isThisRowSelected = selectedCells.has(firstCellId); 
             for (let c = 0; c < columns.length; c++) {
                 const id = getCellId(rowIndex, c);
                 if (isThisRowSelected) updatedSelection.delete(id);
                 else updatedSelection.add(id);
             }
             setSelectedCells(updatedSelection);
             setActiveCell({ rowIndex, colIndex: 0 });
        } else {
            setSelectedCells(newSelectedCells);
            setActiveCell({ rowIndex, colIndex: 0 });
        }
    };

    const handleRowHeaderMouseUp = () => {
        dragHandlePressedRef.current = false;
    };
    
    const handleDateClick = (act: Act, target: HTMLElement) => {
        const coords = getRelativeCoords(target);
        setDatePopoverState({
            act,
            position: { top: coords.top, left: coords.left, width: coords.width }
        });
    };

    const handleCellDoubleClick = (e: React.MouseEvent<HTMLTableCellElement>, rowIndex: number, colIndex: number) => {
        if (window.getSelection) {
            window.getSelection()?.removeAllRanges();
        }
        const col = columns[colIndex];
        
        if (editingCell) {
            if (handleEditorSave()) {
                 closeEditor();
            } else {
                 return;
            }
        }
        
        setDatePopoverState(null);
        setRegulationPopoverState(null);
        setNextWorkPopoverState(null);
        
        setSelectedCells(new Set());
        
        if (col?.key === 'nextWork') {
            const coords = getRelativeCoords(e.currentTarget);
            setNextWorkPopoverState({ rowIndex, colIndex, position: coords });
            return; 
        }
    
        if (col?.key === 'id') {
            return;
        }
        
        setEditingCell({ rowIndex, colIndex });
    };

    const handleCopy = useCallback(async () => {
        if (selectedCells.size === 0) return;
        try {
            const coordsList = Array.from(selectedCells).map(id => {
                const [rowIndex, colIndex] = id.split(':').map(Number);
                return { rowIndex, colIndex };
            });
            if (coordsList.length === 0) return;
            const minRow = Math.min(...coordsList.map(c => c.rowIndex));
            const maxRow = Math.max(...coordsList.map(c => c.rowIndex));
            const minCol = Math.min(...coordsList.map(c => c.colIndex));
            const maxCol = Math.max(...coordsList.map(c => c.colIndex));
            const copyData = [];
            for (let r = minRow; r <= maxRow; r++) {
                const rowData = [];
                for (let c = minCol; c <= maxCol; c++) {
                    if (selectedCells.has(getCellId(r, c))) {
                        const act = acts[r];
                        const col = columns[c];
                        if (act && col) {
                            if (col.key === 'workDates') {
                                rowData.push(`${formatDateForDisplay(act.workStartDate)} - ${formatDateForDisplay(act.workEndDate)}`);
                            } else if (col.key === 'commissionGroup') {
                                const group = groups.find(g => g.id === act.commissionGroupId);
                                rowData.push(group ? group.name : '');
                            } else if (col.type === 'date') {
                                rowData.push(formatDateForDisplay(act[col.key as keyof Act] as string));
                            } else if (col.key === 'nextWork') {
                                if (act.nextWorkActId === AUTO_NEXT_ID) {
                                    rowData.push(AUTO_NEXT_LABEL);
                                } else {
                                    rowData.push(act.nextWork || '');
                                }
                            } else {
                                 const key = col.key as Exclude<keyof Act, 'representatives' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates' | 'nextWorkActId'>;
                                rowData.push(act[key] || '');
                            }
                        } else {
                             rowData.push('');
                        }
                    } else {
                        rowData.push('');
                    }
                }
                copyData.push(rowData.join('\t'));
            }
            await navigator.clipboard.writeText(copyData.join('\n'));
            setCopiedCells(new Set(selectedCells));
        } catch (err) {
            console.error("Failed to copy: ", err);
        }
    }, [selectedCells, acts, columns, groups]);

    const handlePaste = useCallback(async () => {
        if (selectedCells.size === 0) return;
        try {
            const pastedText = await navigator.clipboard.readText();
            if (!pastedText) return;
            const pastedRows = pastedText.replace(/\r\n/g, '\n').split('\n').map(row => row.split('\t'));
            const pastedHeight = pastedRows.length;
            if (pastedHeight === 0) return;
            const pastedWidth = pastedRows.reduce((maxWidth, row) => Math.max(maxWidth, row.length), 0);
            if (pastedWidth === 0) return;
            const coordsList = Array.from(selectedCells).map(id => {
                const [rowIndex, colIndex] = id.split(':').map(Number);
                return { rowIndex, colIndex };
            });
            const minRow = Math.min(...coordsList.map(c => c.rowIndex));
            const minCol = Math.min(...coordsList.map(c => c.colIndex));
            
            const modifiedActsMap = new Map<string, Act>();

            for (const cellId of selectedCells) {
                const [r, c] = cellId.split(':').map(Number);
                const sourceRowIndex = (r - minRow) % pastedHeight;
                const sourceColIndex = (c - minCol) % pastedWidth;
                const cellData = pastedRows[sourceRowIndex]?.[sourceColIndex];
                if (cellData === undefined) continue;
                
                const originalAct = acts[r];
                if (!originalAct) continue;
                
                let updatedAct = modifiedActsMap.get(originalAct.id);
                if (!updatedAct) {
                    updatedAct = { ...originalAct };
                    modifiedActsMap.set(originalAct.id, updatedAct);
                }
                
                const col = columns[c];
                if (!col || col.key === 'id') continue;
                
                if (col.key === 'workDates') {
                    const parts = cellData.split(' - ').map(s => s.trim());
                    const start = parseDisplayDate(parts[0]) || '';
                    const end = parts.length > 1 ? (parseDisplayDate(parts[1]) || start) : start;
                    updatedAct.workStartDate = start;
                    updatedAct.workEndDate = end;
                } else if (col.key === 'commissionGroup') {
                    const group = groups.find(g => g.name.toLowerCase() === cellData.toLowerCase().trim());
                    if(group) {
                        updatedAct.commissionGroupId = group.id;
                    }
                } else if (col.type === 'date') {
                    const columnKey = col.key as keyof Act;
                    (updatedAct as any)[columnKey] = parseDisplayDate(cellData) || '';
                } else if (col.key === 'nextWork') {
                    if (cellData.trim() === AUTO_NEXT_LABEL || cellData.includes('Следующий по списку (Автоматически)')) {
                        updatedAct.nextWorkActId = AUTO_NEXT_ID;
                        updatedAct.nextWork = ''; 
                    } else {
                        updatedAct.nextWork = cellData;
                        updatedAct.nextWorkActId = undefined; // Explicitly clear binding for manual text
                    }
                }
                else {
                    const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates' | 'nextWorkActId'>;
                    (updatedAct as any)[columnKey] = cellData;
                }
            }
            performBulkUpdate(modifiedActsMap);
            setCopiedCells(null);
        } catch (err) {
             console.error("Failed to paste: ", err);
        }
    }, [selectedCells, acts, columns, groups, performBulkUpdate]);
    
    const handleClearCells = useCallback(() => {
        const modifiedActsMap = new Map<string, Act>();
        selectedCells.forEach(cellId => {
            const [r, c] = cellId.split(':').map(Number);
            const originalAct = acts[r];
            if (!originalAct) return;
            
            let updatedAct = modifiedActsMap.get(originalAct.id);
            if (!updatedAct) {
                updatedAct = { ...originalAct };
                modifiedActsMap.set(originalAct.id, updatedAct);
            }
            
            const col = columns[c];
            if (!col || col.key === 'id') return;
            if (col.key === 'workDates') {
                updatedAct.workStartDate = '';
                updatedAct.workEndDate = '';
                updatedAct.date = ''; 
            } else if (col.key === 'commissionGroup') {
                updatedAct.commissionGroupId = undefined;
            } else if (col.key === 'nextWork') {
                updatedAct.nextWork = '';
                updatedAct.nextWorkActId = undefined;
            } else {
                const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates' | 'nextWorkActId'>;
                (updatedAct as any)[columnKey] = '';
            }
        });
        performBulkUpdate(modifiedActsMap);
    }, [selectedCells, acts, columns, performBulkUpdate]);

    const handleBulkDownload = () => {
        if (!template) {
            alert('Сначала загрузите шаблон.');
            return;
        }
        
        Array.from(selectedRows).forEach(rowIndex => {
            const act = acts[rowIndex];
            if (act) {
                // If the act has auto-next, resolve it before generation
                const actToGenerate = { ...act };
                if (act.nextWorkActId === AUTO_NEXT_ID) {
                    const nextAct = acts[rowIndex + 1];
                    if (nextAct) {
                        actToGenerate.nextWork = `Работы по акту №${nextAct.number || 'б/н'} (${nextAct.workName || '...'})`;
                    } else {
                        actToGenerate.nextWork = '';
                    }
                }
                generateDocument(template, actToGenerate, people);
            }
        });
    };
    
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (editingCell) {
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            setSelectedCells(new Set());
            setActiveCell(null);
            setCopiedCells(null);
            e.currentTarget.blur();
            setDatePopoverState(null);
            setRegulationPopoverState(null);
            setNextWorkPopoverState(null);
            return;
        }

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isCtrlKey = isMac ? e.metaKey : e.ctrlKey;

        if (e.code === 'KeyC' && isCtrlKey) {
            e.preventDefault();
            handleCopy();
            return;
        }

        if (e.code === 'KeyV' && isCtrlKey) {
            e.preventDefault();
            handlePaste();
            return;
        }

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            
            if (!activeCell) {
                if (acts.length > 0 && columns.length > 0) {
                     setActiveCell({ rowIndex: 0, colIndex: 0 });
                     setSelectedCells(new Set([getCellId(0, 0)]));
                }
                return;
            }

            let { rowIndex, colIndex } = activeCell;

            if (e.key === 'ArrowUp') rowIndex = Math.max(0, rowIndex - 1);
            if (e.key === 'ArrowDown') rowIndex = Math.min(acts.length - 1, rowIndex + 1);
            if (e.key === 'ArrowLeft') colIndex = Math.max(0, colIndex - 1);
            if (e.key === 'ArrowRight') colIndex = Math.min(columns.length - 1, colIndex + 1);

            const newCellId = getCellId(rowIndex, colIndex);
            
            setActiveCell({ rowIndex, colIndex });
            setSelectedCells(new Set([newCellId]));
            
            const cellEl = document.querySelector(`td[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`);
            cellEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            return;
        }

        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCells.size > 0) {
            e.preventDefault();
            handleClearCells();
        }
    }, [editingCell, selectedCells, handleClearCells, handleCopy, handlePaste, activeCell, setActiveCell, acts.length, columns.length, setSelectedCells]);

    // [Auto-scroll and Drag-select effects omitted for brevity but presumed kept or updated to use props]
    // Since I'm providing full content, I'll include them to be safe.
    
    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (!isDraggingSelection || !scrollContainer) return;
        let lastTime = 0;
        const autoScroll = (timestamp: number) => {
            if (!mousePosRef.current) {
                autoScrollRaf.current = requestAnimationFrame(autoScroll);
                return;
            }
            if (!lastTime) lastTime = timestamp;
            const deltaTime = timestamp - lastTime;
            lastTime = timestamp;
            const { x, y } = mousePosRef.current;
            const { left, right, top, bottom } = scrollContainer.getBoundingClientRect();
            const edgeThreshold = 50; 
            const maxSpeed = 30; 
            let scrollX = 0;
            let scrollY = 0;
            if (x < left + edgeThreshold) {
                scrollX = -maxSpeed * ((left + edgeThreshold - x) / edgeThreshold);
            } else if (x > right - edgeThreshold) {
                scrollX = maxSpeed * ((x - (right - edgeThreshold)) / edgeThreshold);
            }
            if (y < top + edgeThreshold) {
                scrollY = -maxSpeed * ((top + edgeThreshold - y) / edgeThreshold);
            } else if (y > bottom - edgeThreshold) {
                scrollY = maxSpeed * ((y - (bottom - edgeThreshold)) / edgeThreshold);
            }
            if (scrollX !== 0 || scrollY !== 0) {
                scrollContainer.scrollLeft += scrollX;
                scrollContainer.scrollTop += scrollY;
            }
            autoScrollRaf.current = requestAnimationFrame(autoScroll);
        };
        autoScrollRaf.current = requestAnimationFrame(autoScroll);
        return () => {
            if (autoScrollRaf.current) {
                cancelAnimationFrame(autoScrollRaf.current);
            }
        };
    }, [isDraggingSelection]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
            if (!isDraggingSelection || !activeCell) return;
            const coords = getCellCoordsFromEvent(e);
            if (coords) {
                const { minRow, maxRow, minCol, maxCol } = normalizeSelection(activeCell, coords);
                const newSelection = new Set<string>();
                for (let r = minRow; r <= maxRow; r++) {
                    for (let c = minCol; c <= maxCol; c++) {
                        newSelection.add(getCellId(r,c));
                    }
                }
                setSelectedCells(newSelection);
            }
        };
        const handleMouseUp = () => {
            setIsDraggingSelection(false);
            mousePosRef.current = null;
        };
        if (isDraggingSelection) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp, { once: true });
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingSelection, activeCell, setSelectedCells]);

    // Filling effect
     useEffect(() => {
        const getSelectionBounds = (cells: Set<string>): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null => {
            const coordsList = Array.from(cells).map(id => {
                const [rowIndex, colIndex] = id.split(':').map(Number);
                return { rowIndex, colIndex };
            });
            if (coordsList.length === 0) return null;
            return {
                minRow: Math.min(...coordsList.map(c => c.rowIndex)),
                maxRow: Math.max(...coordsList.map(c => c.rowIndex)),
                minCol: Math.min(...coordsList.map(c => c.colIndex)),
                maxCol: Math.max(...coordsList.map(c => c.colIndex)),
            };
        };
        const handleMouseMove = (e: MouseEvent) => {
            if (!isFilling || selectedCells.size === 0) return;
            const coords = getCellCoordsFromEvent(e);
            if (coords) {
                const selectionBounds = getSelectionBounds(selectedCells);
                if (!selectionBounds) return;
                const { minRow, maxRow, minCol, maxCol } = selectionBounds;
                let fillArea: { start: Coords, end: Coords } | null = null;
                if (coords.rowIndex > maxRow) {
                     fillArea = { start: {rowIndex: maxRow + 1, colIndex: minCol}, end: {rowIndex: coords.rowIndex, colIndex: maxCol} };
                } else if (coords.rowIndex < minRow) {
                     fillArea = { start: {rowIndex: coords.rowIndex, colIndex: minCol}, end: {rowIndex: minRow - 1, colIndex: maxCol} };
                }
                setFillTargetArea(fillArea);
            }
        };
        const handleMouseUp = () => {
            if (!isFilling || selectedCells.size === 0 || !fillTargetArea) {
                setIsFilling(false);
                setFillTargetArea(null);
                return;
            }
            const selectionBounds = getSelectionBounds(selectedCells);
            if (!selectionBounds) return;
            const { minRow: selMinRow, maxRow: selMaxRow } = selectionBounds;
            const patternHeight = selMaxRow - selMinRow + 1;
            const selectedCols = Array.from(new Set(Array.from(selectedCells, id => parseInt(id.split(':')[1], 10)))).sort((a, b) => a - b);
            const { minRow: fillMinRow, maxRow: fillMaxRow } = normalizeSelection(fillTargetArea.start, fillTargetArea.end);
            const isFillingUpwards = fillMaxRow < selMinRow;
            
            const actsToUpdate = new Map<string, Act>();
            
            for (let r = fillMinRow; r <= fillMaxRow; r++) {
                const targetAct = acts[r];
                if (!targetAct) continue;
                
                let updatedAct = actsToUpdate.get(targetAct.id) || { ...targetAct };
                
                const patternRowIndex = isFillingUpwards
                    ? selMaxRow - ((selMinRow - 1 - r) % patternHeight)
                    : selMinRow + ((r - (selMaxRow + 1)) % patternHeight);
                const sourceAct = acts[patternRowIndex];
                if (!sourceAct) continue;
                
                for (const c of selectedCols) {
                    const sourceCellId = getCellId(patternRowIndex, c);
                    if (!selectedCells.has(sourceCellId)) continue;
                    const colKey = columns[c]?.key;
                    if (!colKey) continue;
                    
                    if (colKey === 'workDates') {
                        updatedAct.workStartDate = sourceAct.workStartDate;
                        updatedAct.workEndDate = sourceAct.workEndDate;
                        updatedAct.date = sourceAct.workEndDate; 
                    } else if (colKey === 'commissionGroup') {
                         // Note: We're not using handleGroupChange here to avoid immediate save recursion.
                         // Instead we copy logic manually or rely on template resolution later.
                         const group = groups.find(g => g.id === sourceAct.commissionGroupId);
                         if (group) {
                            updatedAct.commissionGroupId = group.id;
                            updatedAct.representatives = { ...group.representatives };
                            updatedAct.builderOrgId = group.builderOrgId;
                            updatedAct.contractorOrgId = group.contractorOrgId;
                            updatedAct.designerOrgId = group.designerOrgId;
                            updatedAct.workPerformerOrgId = group.workPerformerOrgId;
                            
                            // Re-apply org details strings logic if needed, but applyTemplatesToAct handles fields.
                            // However, builderDetails string generation logic is inside handleGroupChange. 
                            // We should really reuse that logic but purely functional.
                            // For simplicity in filling, let's assume performBulkUpdate handles templates, 
                            // but org details strings (builderDetails etc) are static strings on the object.
                            // We should copy them from sourceAct or re-generate.
                            // Copying from sourceAct is safer if they belong to the same group.
                            updatedAct.builderDetails = sourceAct.builderDetails;
                            updatedAct.contractorDetails = sourceAct.contractorDetails;
                            updatedAct.designerDetails = sourceAct.designerDetails;
                            updatedAct.workPerformer = sourceAct.workPerformer;
                         } else {
                            updatedAct.commissionGroupId = undefined;
                         }
                    } else {
                        const typedColKey = colKey as keyof Act;
                        const sourceValue = sourceAct[typedColKey];
                        (updatedAct as any)[typedColKey] = sourceValue;
                    }
                }
                actsToUpdate.set(updatedAct.id, updatedAct);
            }
            performBulkUpdate(actsToUpdate);
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
    }, [isFilling, selectedCells, fillTargetArea, acts, columns, groups, performBulkUpdate]);


    // [Drag handlers...]
    const handleRowDragStart = (e: React.DragEvent<HTMLTableRowElement>, rowIndex: number) => {
        if (editingCell) { e.preventDefault(); return; }
        if (!dragHandlePressedRef.current) { e.preventDefault(); return; }
        let indicesToDrag = [rowIndex];
        if (selectedRows.has(rowIndex)) indicesToDrag = Array.from(selectedRows).sort((a,b) => a-b);
        setDraggedRowIndices(indicesToDrag);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(indicesToDrag));
    };

    const handleRowDragOver = (e: React.DragEvent<HTMLTableRowElement>, rowIndex: number) => {
        e.preventDefault(); 
        if (!draggedRowIndices) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const isTop = e.clientY < midY;
        setDropTargetRowIndex(rowIndex);
        setDropPosition(isTop ? 'top' : 'bottom');
        const tableEl = scrollContainerRef.current?.querySelector('table');
        if (!tableEl) return;
        const tableRect = tableEl.getBoundingClientRect();
        setDragIndicator({ type: 'row', x: tableRect.left, y: isTop ? rect.top : rect.bottom, width: tableRect.width, height: 2 });
    };

    const handleRowDrop = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.preventDefault();
        if (!draggedRowIndices || dropTargetRowIndex === null || !dropPosition) { handleDragEnd(); return; }
        let insertIndex = dropTargetRowIndex;
        if (dropPosition === 'bottom') insertIndex++;
        const draggedActs = draggedRowIndices.map(i => acts[i]);
        const remainingActs = acts.filter((_, i) => !draggedRowIndices.includes(i));
        const numRemovedBeforeTarget = draggedRowIndices.filter(i => i < insertIndex).length;
        const adjustedInsertIndex = Math.max(0, insertIndex - numRemovedBeforeTarget);
        const newActs = [...remainingActs.slice(0, adjustedInsertIndex), ...draggedActs, ...remainingActs.slice(adjustedInsertIndex)];
        onReorderActs(newActs);
        handleDragEnd();
    };
    
    const handleColumnDragStart = (e: React.DragEvent<HTMLTableHeaderCellElement>, colKey: string) => {
        if (editingCell) return e.preventDefault();
        setDraggedColKey(colKey);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleColumnDragOver = (e: React.DragEvent<HTMLTableHeaderCellElement>, colKey: string) => {
        e.preventDefault();
        if (!draggedColKey || draggedColKey === colKey) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const isLeft = e.clientX < midX;
        setDropTargetColKey(colKey);
        setDropColPosition(isLeft ? 'left' : 'right');
        const tableEl = scrollContainerRef.current?.querySelector('table');
        if (!tableEl) return;
        const tableRect = tableEl.getBoundingClientRect();
        setDragIndicator({ type: 'col', x: isLeft ? rect.left : rect.right, y: tableRect.top, width: 2, height: tableRect.height });
    };

    const handleColumnDrop = () => {
        if (!draggedColKey || !dropTargetColKey || !dropColPosition) { handleDragEnd(); return; }
        const currentOrder = columns.map(c => c.key);
        const fromIndex = currentOrder.indexOf(draggedColKey as any);
        const toIndex = currentOrder.indexOf(dropTargetColKey as any);
        if (fromIndex === -1 || toIndex === -1) { handleDragEnd(); return; }
        const newOrder = [...currentOrder];
        newOrder.splice(fromIndex, 1); 
        let insertIndex = toIndex;
        if (fromIndex < toIndex) insertIndex--; 
        if (dropColPosition === 'right') insertIndex++;
        newOrder.splice(insertIndex, 0, draggedColKey as any);
        const fullOrder = [...columnOrder];
        const fullFromIndex = fullOrder.indexOf(draggedColKey);
        if (fullFromIndex !== -1) {
            const newFullOrder = [...fullOrder];
            newFullOrder.splice(fullFromIndex, 1);
            let newTargetIndex = newFullOrder.indexOf(dropTargetColKey);
            if (dropColPosition === 'right') newTargetIndex++;
            newFullOrder.splice(newTargetIndex, 0, draggedColKey);
            onColumnOrderChange(newFullOrder);
        }
        handleDragEnd();
    };
    
    const handleDragEnd = () => {
        setDragIndicator(null);
        setDraggedRowIndices(null);
        setDropTargetRowIndex(null);
        setDropPosition(null);
        setDraggedColKey(null);
        setDropTargetColKey(null);
        setDropColPosition(null);
        dragHandlePressedRef.current = false;
    };

    const updateFillHandlePosition = useCallback(() => {
        if (selectedCells.size > 0 && scrollContainerRef.current) {
            const coordsList = Array.from(selectedCells).map(id => {
                const [rowIndex, colIndex] = id.split(':').map(Number);
                return { rowIndex, colIndex };
            });
            const maxRow = Math.max(...coordsList.map(c => c.rowIndex));
            const maxCol = Math.max(...coordsList.map(c => c.colIndex));
            const cellSelector = `td[data-row-index="${maxRow}"][data-col-index="${maxCol}"]`;
            const cell = scrollContainerRef.current.querySelector(cellSelector) as HTMLElement;
            if (cell) {
                 let top = cell.offsetHeight; 
                 let left = cell.offsetWidth;
                 let el: HTMLElement | null = cell;
                 while(el && el !== scrollContainerRef.current) {
                     top += el.offsetTop;
                     left += el.offsetLeft;
                     el = el.offsetParent as HTMLElement;
                 }
                 setFillHandleCoords({ top: top - 5, left: left - 5 });
            } else { setFillHandleCoords(null); }
         } else { setFillHandleCoords(null); }
    }, [selectedCells, acts, columns]);

    useLayoutEffect(() => {
        updateFillHandlePosition();
    }, [updateFillHandlePosition]);


    const handleColumnHeaderClick = (e: React.MouseEvent, colIndex: number) => {
        if (e.ctrlKey || e.metaKey) {
             const newSelectedCells = new Set(selectedCells);
             const isSelected = selectedColumns.has(colIndex);
             if (isSelected) {
                 for(let r=0; r<acts.length; r++) newSelectedCells.delete(getCellId(r, colIndex));
             } else {
                 for(let r=0; r<acts.length; r++) newSelectedCells.add(getCellId(r, colIndex));
             }
             setSelectedCells(newSelectedCells);
        } else {
             const newSelectedCells = new Set<string>();
             for(let r=0; r<acts.length; r++) newSelectedCells.add(getCellId(r, colIndex));
             setSelectedCells(newSelectedCells);
        }
    }

    const getHighlightClass = (rowIndex: number, colIndex: number) => {
        if (!fillTargetArea) return '';
        const { minRow, maxRow, minCol, maxCol } = normalizeSelection(fillTargetArea.start, fillTargetArea.end);
        if (rowIndex >= minRow && rowIndex <= maxRow && colIndex >= minCol && colIndex <= maxCol) {
            return 'bg-blue-100/50';
        }
        return '';
    };

    const handleContextMenu = (e: React.MouseEvent, rowIndex: number, colIndex: number) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, rowIndex, colIndex });
    };

    return (
        <div 
            className="h-full flex flex-col relative outline-none" 
            tabIndex={0} 
            onKeyDown={handleKeyDown}
            ref={tableContainerRef}
        >
            {dragIndicator && (
                <div 
                    style={{
                        position: 'fixed',
                        top: dragIndicator.y,
                        left: dragIndicator.x,
                        width: dragIndicator.width,
                        height: dragIndicator.height,
                        backgroundColor: '#2563eb', 
                        zIndex: 100,
                        pointerEvents: 'none',
                        boxShadow: '0 0 4px rgba(37, 99, 235, 0.5)'
                    }} 
                />
            )}

            <div 
                className="flex-grow overflow-auto relative scroll-shadows p-4" 
                ref={scrollContainerRef}
            >
                <table className="w-full border-collapse text-sm min-w-max">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="w-12 border border-slate-300 px-2 py-2 font-medium text-slate-500 text-center select-none bg-slate-100">#</th>
                            {columns.map((col, index) => (
                                <th
                                    key={col.key}
                                    className={`
                                        border border-slate-300 px-2 py-2 font-medium text-slate-600 text-left select-none relative
                                        ${col.widthClass}
                                        ${selectedColumns.has(index) ? 'bg-blue-100' : ''}
                                        ${draggedColKey === col.key ? 'opacity-50' : ''}
                                        grabbable group/th
                                    `}
                                    draggable={!editingCell}
                                    onDragStart={(e) => handleColumnDragStart(e, col.key)}
                                    onDragOver={(e) => handleColumnDragOver(e, col.key)}
                                    onDrop={handleColumnDrop}
                                    onDragEnd={handleDragEnd}
                                    onClick={(e) => handleColumnHeaderClick(e, index)}
                                >
                                    <div className="flex items-center justify-between">
                                        <span>{col.label}</span>
                                        {col.helpText && (
                                            <span 
                                                title={col.helpText} 
                                                className="text-slate-400 hover:text-blue-600 cursor-help ml-2 opacity-50 group-hover/th:opacity-100 transition-opacity"
                                            >
                                                <QuestionMarkCircleIcon className="w-4 h-4" />
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {acts.length > 0 ? (
                            acts.map((act, rowIndex) => {
                                const isRowSelected = selectedRows.has(rowIndex);
                                const isRowDragged = draggedRowIndices?.includes(rowIndex);
                                
                                return (
                                    <tr 
                                        key={act.id} 
                                        className={`
                                            group
                                            ${isRowSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}
                                            ${isRowDragged ? 'opacity-40' : ''}
                                            ${actPickerState?.sourceRowIndex === rowIndex ? 'act-picker-source-row' : ''}
                                        `}
                                        draggable={!editingCell}
                                        onDragStart={(e) => handleRowDragStart(e, rowIndex)}
                                        onDragOver={(e) => handleRowDragOver(e, rowIndex)}
                                        onDrop={handleRowDrop}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <td 
                                            className={`
                                                row-drag-handle border border-slate-300 px-1 py-1 text-center text-xs select-none relative group/handle cursor-grab active:cursor-grabbing
                                                ${isRowSelected ? 'bg-blue-100 border-blue-200 z-20' : 'bg-slate-50 text-slate-400'}
                                            `}
                                            onMouseDown={(e) => handleRowHeaderMouseDown(e, rowIndex)}
                                            onMouseUp={handleRowHeaderMouseUp}
                                        >
                                           <div className="pointer-events-none flex items-center justify-between h-full w-full pl-1">
                                                <div className={`p-0.5 rounded flex-shrink-0 ${isRowSelected ? 'text-blue-500' : 'text-slate-300 group-hover:text-slate-500'}`}>
                                                    <GripVerticalIcon className="w-4 h-4" />
                                                </div>
                                                <span className={`flex-grow text-center ${isRowSelected ? 'font-semibold text-blue-700' : ''}`}>{rowIndex + 1}</span>
                                           </div>
                                        </td>
                                        {columns.map((col, colIndex) => {
                                            const cellId = getCellId(rowIndex, colIndex);
                                            const isSelected = selectedCells.has(cellId);
                                            const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
                                            const isCopied = copiedCells?.has(cellId);
                                            
                                            // Dynamic display logic for 'nextWork' column
                                            let displayContent: React.ReactNode = String(act[col.key as keyof Act] || '');
                                            
                                            if (col.key === 'workDates') {
                                                displayContent = (
                                                    <span className={!act.workStartDate || !act.workEndDate ? 'text-slate-400' : ''}>
                                                        {act.workStartDate && act.workEndDate 
                                                            ? `${formatDateForDisplay(act.workStartDate)} - ${formatDateForDisplay(act.workEndDate)}`
                                                            : 'Укажите даты'}
                                                    </span>
                                                );
                                            } else if (col.key === 'commissionGroup') {
                                                displayContent = groups.find(g => g.id === act.commissionGroupId)?.name || <span className="text-slate-300 italic">Не выбрано</span>;
                                            } else if (col.type === 'date') {
                                                displayContent = formatDateForDisplay(act[col.key as keyof Act] as string);
                                            } else if (col.key === 'regulations') {
                                                displayContent = (
                                                    <div className="flex flex-wrap gap-1">
                                                        {(act.regulations || '').split(';').map(s => s.trim()).filter(Boolean).map((item, idx) => {
                                                            const reg = regulations.find(r => r.designation === item);
                                                            let chipClass = "bg-slate-100 text-slate-800 border-slate-300";
                                                            if (reg) {
                                                                 if (reg.status.toLowerCase().includes('действует')) chipClass = "bg-green-100 text-green-800 border-green-200";
                                                                 else if (reg.status.toLowerCase().includes('заменен')) chipClass = "bg-red-100 text-red-800 border-red-200";
                                                                 else chipClass = "bg-blue-100 text-blue-800 border-blue-200";
                                                            }
                                                            return (
                                                                <span 
                                                                                    key={idx} 
                                                                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border ${chipClass} cursor-pointer hover:underline`}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleShowRegulationInfo(item, e.currentTarget);
                                                                                    }}
                                                                                >
                                                                                    {item}
                                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            } else if (col.key === 'nextWork' && act.nextWorkActId === AUTO_NEXT_ID) {
                                                const nextAct = acts[rowIndex + 1];
                                                if (nextAct) {
                                                    displayContent = (
                                                        <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1.5 inline-flex max-w-full">
                                                            <ArrowDownCircleIcon className="w-3 h-3 flex-shrink-0" />
                                                            <span className="truncate">
                                                                Акт №{nextAct.number || 'б/н'} ({nextAct.workName || '...'})
                                                            </span>
                                                        </span>
                                                    );
                                                } else {
                                                    displayContent = <span className="text-slate-300 italic text-xs">Конец списка</span>;
                                                }
                                            }

                                            return (
                                                <td
                                                    key={col.key}
                                                    data-row-index={rowIndex}
                                                    data-col-index={colIndex}
                                                    className={`
                                                        border border-slate-300 px-2 py-1 relative align-top transition-colors
                                                        ${isSelected ? 'bg-blue-100 outline outline-2 outline-blue-500 z-10' : ''}
                                                        ${isCopied ? 'relative' : ''}
                                                        ${getHighlightClass(rowIndex, colIndex)}
                                                        ${col.key === 'id' ? 'text-xs text-slate-400 select-all' : ''}
                                                        ${col.key === 'commissionGroup' ? 'text-slate-600' : ''}
                                                        cursor-default
                                                    `}
                                                    onMouseDown={(e) => handleCellMouseDown(e, rowIndex, colIndex)}
                                                    onDoubleClick={(e) => handleCellDoubleClick(e, rowIndex, colIndex)}
                                                    onContextMenu={(e) => handleContextMenu(e, rowIndex, colIndex)}
                                                    style={{ height: '1px' }} 
                                                >
                                                    {isCopied && <div className="copied-cell-overlay" />}
                                                    
                                                    {isEditing ? (
                                                        <div ref={editorContainerRef} className="h-full w-full min-h-[1.5em] bg-transparent">
                                                           {col.key === 'commissionGroup' ? (
                                                                <CustomSelect
                                                                    options={groupOptions}
                                                                    value={editorValue}
                                                                    onChange={(val) => {
                                                                        handleGroupChange(act, val);
                                                                        closeEditor();
                                                                    }}
                                                                    startOpen={true}
                                                                    onCreateNew={handleCreateNewGroup}
                                                                    allowClear
                                                                    className="w-full"
                                                                />
                                                            ) : col.key === 'regulations' ? (
                                                                <RegulationsInput 
                                                                    value={editorValue}
                                                                    onChange={setEditorValue}
                                                                    regulations={regulations}
                                                                    onOpenDictionary={() => setRegulationsModalOpen(true)}
                                                                    onInfoClick={(des, target) => handleShowRegulationInfo(des, target)}
                                                                />
                                                            ) : col.key === 'materials' ? (
                                                                <MaterialsInput
                                                                    value={editorValue}
                                                                    onChange={setEditorValue}
                                                                    certificates={certificates}
                                                                />
                                                            ) : (
                                                                <textarea
                                                                    ref={editorRef as React.RefObject<HTMLTextAreaElement>}
                                                                    value={editorValue}
                                                                    onChange={handleEditorChange}
                                                                    onKeyDown={handleEditorKeyDown}
                                                                    className="w-full h-full resize-none bg-transparent outline-none overflow-hidden"
                                                                    rows={1}
                                                                    placeholder={col.key === 'workDates' ? 'ДД.ММ.ГГГГ - ДД.ММ.ГГГГ' : ''}
                                                                />
                                                            )}
                                                            {dateError && col.key === 'workDates' && (
                                                                <div className="absolute top-full left-0 z-50 bg-red-100 text-red-700 text-xs px-2 py-1 rounded shadow-md mt-1 border border-red-200">
                                                                    {dateError}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="w-full h-full min-h-[1.5em] whitespace-pre-wrap flex items-center justify-between group/cell">
                                                            <span className="flex-grow">
                                                                {displayContent}
                                                            </span>
                                                            
                                                            {col.key === 'workDates' && (
                                                                <button
                                                                    className="opacity-0 group-hover/cell:opacity-100 text-slate-400 hover:text-blue-600 ml-2 transition-opacity"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDateClick(act, e.currentTarget);
                                                                    }}
                                                                >
                                                                    <CalendarIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            
                                                             {col.key === 'nextWork' && act.nextWorkActId && act.nextWorkActId !== AUTO_NEXT_ID && (
                                                                <div className="ml-2 text-blue-600" title="Связано с другим актом">
                                                                    <LinkIcon className="w-4 h-4" />
                                                                </div>
                                                             )}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={columns.length + 1} className="text-center py-10 text-slate-500">
                                    Нет актов. Нажмите "Создать акт", чтобы добавить новую запись.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                
                {fillHandleCoords && !editingCell && (
                    <div
                        className="absolute w-2.5 h-2.5 bg-blue-600 border border-white cursor-crosshair z-20"
                        style={{
                            top: fillHandleCoords.top,
                            left: fillHandleCoords.left,
                        }}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            setIsFilling(true);
                        }}
                    />
                )}
            </div>

             {/* Floating Action Bar for Selected Rows */}
             {selectedRows.size > 0 && (
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white shadow-xl border border-slate-200 rounded-full px-6 py-2 flex items-center gap-4 z-50 animate-fade-in-up">
                    <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                        Выбрано: {selectedRows.size}
                    </span>
                    <div className="h-4 w-px bg-slate-300"></div>
                    <button
                        onClick={handleBulkDownload}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        title="Скачать выделенные акты"
                    >
                        <DownloadIcon className="w-4 h-4" /> Скачать
                    </button>
                    <button
                        onClick={() => {
                             const idsToDelete = Array.from(selectedRows).map(idx => acts[idx].id);
                             onRequestDelete(idsToDelete);
                        }}
                        className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800 font-medium transition-colors"
                        title="Удалить выделенные акты"
                    >
                        <DeleteIcon className="w-4 h-4" /> Удалить
                    </button>
                </div>
            )}

            {datePopoverState && (
                <DateEditorPopover
                    act={datePopoverState.act}
                    onActChange={(updatedAct) => {
                        handleSaveWithTemplateResolution(updatedAct);
                        setDatePopoverState(prev => prev ? { ...prev, act: updatedAct } : null);
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
            
            {nextWorkPopoverState && (
                <NextWorkPopover
                    acts={acts}
                    currentActId={acts[nextWorkPopoverState.rowIndex].id}
                    position={nextWorkPopoverState.position}
                    onClose={() => setNextWorkPopoverState(null)}
                    onSelect={(selectedActOrId) => {
                         const sourceAct = acts[nextWorkPopoverState.rowIndex];
                         if (sourceAct) {
                            const updatedAct = { ...sourceAct };
                            
                            if (selectedActOrId === AUTO_NEXT_ID) {
                                updatedAct.nextWorkActId = AUTO_NEXT_ID;
                                updatedAct.nextWork = ''; // Will be dynamic
                            } else if (selectedActOrId && typeof selectedActOrId === 'object') {
                                const selectedAct = selectedActOrId as Act;
                                updatedAct.nextWork = `Работы по акту №${selectedAct.number || 'б/н'} (${selectedAct.workName || '...'})`;
                                updatedAct.nextWorkActId = selectedAct.id;
                            } else if (typeof selectedActOrId === 'string') {
                                // Manual text entry
                                updatedAct.nextWork = selectedActOrId;
                                updatedAct.nextWorkActId = undefined; // Clear binding
                            } else {
                                updatedAct.nextWork = '';
                                updatedAct.nextWorkActId = undefined;
                            }
                            handleSaveWithTemplateResolution(updatedAct);
                         }
                         setNextWorkPopoverState(null);
                    }}
                />
            )}

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                >
                    <MenuItem 
                        label="Копировать" 
                        shortcut="Ctrl+C" 
                        icon={<CopyIcon className="w-4 h-4" />}
                        onClick={() => { handleCopy(); setContextMenu(null); }} 
                        disabled={selectedCells.size === 0}
                    />
                    <MenuItem 
                        label="Вставить" 
                        shortcut="Ctrl+V" 
                        icon={<PasteIcon className="w-4 h-4" />}
                        onClick={() => { handlePaste(); setContextMenu(null); }} 
                    />
                    <MenuSeparator />
                     <MenuItem 
                        label="Очистить ячейки" 
                        shortcut="Del" 
                        onClick={() => { handleClearCells(); setContextMenu(null); }}
                         disabled={selectedCells.size === 0}
                    />
                    <MenuSeparator />
                     <MenuItem 
                        label="Вставить строку выше" 
                        icon={<RowAboveIcon className="w-4 h-4" />}
                        onClick={() => { 
                             const newAct = createNewAct();
                             onSave(newAct, contextMenu.rowIndex);
                             setContextMenu(null);
                        }} 
                    />
                     <MenuItem 
                        label="Вставить строку ниже" 
                        icon={<RowBelowIcon className="w-4 h-4" />}
                        onClick={() => { 
                             const newAct = createNewAct();
                             onSave(newAct, contextMenu.rowIndex + 1);
                             setContextMenu(null);
                        }} 
                    />
                    <MenuSeparator />
                    <MenuItem 
                        label="Удалить акт(ы)" 
                        icon={<DeleteIcon className="w-4 h-4 text-red-600" />}
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => {
                            const rowIndices = Array.from(selectedRows);
                            const indicesToDelete = rowIndices.includes(contextMenu.rowIndex) ? rowIndices : [contextMenu.rowIndex];
                            const idsToDelete = indicesToDelete.map(idx => acts[idx].id);
                            onRequestDelete(idsToDelete);
                            setContextMenu(null);
                        }}
                    />
                </ContextMenu>
            )}

            {regulationsModalOpen && (
                <RegulationsModal
                    isOpen={regulationsModalOpen}
                    onClose={() => setRegulationsModalOpen(false)}
                    regulations={regulations}
                    onSelect={handleRegulationsSelect}
                />
            )}
            
            {fullRegulationDetails && (
                <Modal 
                    isOpen={!!fullRegulationDetails} 
                    onClose={() => setFullRegulationDetails(null)} 
                    title=""
                    hideHeader={true} // Hide redundant header
                >
                    <RegulationDetails regulation={fullRegulationDetails} onClose={() => setFullRegulationDetails(null)} />
                </Modal>
            )}
        </div>
    );
};

export default ActsTable;
