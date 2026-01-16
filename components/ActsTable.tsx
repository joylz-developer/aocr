
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
import MaterialsModal from './MaterialsModal';

const AUTO_NEXT_ID = 'AUTO_NEXT';
const AUTO_NEXT_LABEL = '⬇️ Следующий по списку (Автоматически)';

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
    selectedCells: Set<string>;
    setSelectedCells: (cells: Set<string>) => void;
    
    onSave: (act: Act, insertAtIndex?: number) => void;
    onRequestDelete: (ids: string[]) => void;
    onReorderActs: (newActs: Act[]) => void;
    setCurrentPage: (page: Page) => void;
    createNewAct: () => Act;
    onNavigateToCertificate?: (id: string) => void;
    density: 'compact' | 'standard';
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
        return () => document.removeEventListener('keydown', handleKeyDown);
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

        if (unit === 'day') utcDate.setUTCDate(utcDate.getUTCDate() + amount);
        else if (unit === 'week') utcDate.setUTCDate(utcDate.getUTCDate() + amount * 7);
        else if (unit === 'month') utcDate.setUTCMonth(utcDate.getUTCMonth() + amount);
        
        const newEndDateYYYYMMDD = utcDate.toISOString().split('T')[0];
        handleDateChange('workEndDate', newEndDateYYYYMMDD);
    };

    const QuickAddButton: React.FC<{ children: React.ReactNode; onClick: () => void }> = ({ children, onClick }) => (
        <button type="button" onClick={onClick} className="px-2 py-1 text-xs bg-slate-200 hover:bg-slate-300 rounded">
            {children}
        </button>
    );

    return (
        <div 
            ref={containerRef} 
            className="absolute bg-white p-3 border-2 border-blue-500 rounded-md z-40 flex flex-col gap-3 shadow-lg animate-fade-in-up" 
            style={{ top: position.top, left: position.left, minWidth: '220px' }}
            onMouseDown={e => e.stopPropagation()} 
        >
            <div>
                <label className="text-xs font-medium text-slate-600">Начало</label>
                <input type="date" value={act.workStartDate || ''} onChange={e => handleDateChange('workStartDate', e.target.value)} className="w-full p-1.5 border rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 border-slate-300" />
            </div>
             <div>
                <label className="text-xs font-medium text-slate-600">Окончание</label>
                <input type="date" value={act.workEndDate || ''} onChange={e => handleDateChange('workEndDate', e.target.value)} min={act.workStartDate} className="w-full p-1.5 border rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 border-slate-300" />
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
                <button onClick={onOpenDetails} className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center gap-1">
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
        ((a.number && a.number.toLowerCase().includes(searchTerm.toLowerCase())) || (a.workName && a.workName.toLowerCase().includes(searchTerm.toLowerCase())))
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
                 <button className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 border-b border-slate-100 italic" onClick={() => onSelect(null)}>
                    -- Очистить / Нет связи --
                </button>
                {searchTerm.trim() && (
                     <button className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 border-b border-slate-100 flex items-center gap-2 group" onClick={() => onSelect(searchTerm)} title="Использовать введенный текст без привязки">
                        <EditIcon className="w-4 h-4 text-slate-400 group-hover:text-blue-500"/>
                        <span className="truncate">✍️ Ввести вручную: <span className="font-semibold">"{searchTerm}"</span></span>
                    </button>
                )}
                <button className="w-full text-left px-3 py-2 text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 border-b border-blue-100 font-medium flex items-center gap-2" onClick={() => onSelect(AUTO_NEXT_ID)}>
                    <ArrowDownCircleIcon className="w-4 h-4"/> Следующий по списку (Автоматически)
                </button>
                {filteredActs.length > 0 ? filteredActs.map(act => (
                    <button key={act.id} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-50 last:border-0" onClick={() => onSelect(act)}>
                        <div className="font-medium text-slate-800">Акт №{act.number || 'б/н'}</div>
                        <div className="text-xs text-slate-500 truncate">{act.workName || 'Без названия'}</div>
                    </button>
                )) : (!searchTerm && <div className="px-3 py-4 text-center text-xs text-slate-400">Нет подходящих актов</div>)}
            </div>
        </div>
    );
};

const ActsTable: React.FC<ActsTableProps> = ({ acts, people, organizations, groups, regulations, certificates = [], template, settings, visibleColumns, columnOrder, onColumnOrderChange, activeCell, setActiveCell, selectedCells, setSelectedCells, onSave, onRequestDelete, onReorderActs, setCurrentPage, createNewAct, onNavigateToCertificate, density }) => {
    const [editingCell, setEditingCell] = useState<Coords | null>(null);
    const [editorValue, setEditorValue] = useState('');
    const [dateError, setDateError] = useState<string | null>(null);
    const [copiedCells, setCopiedCells] = useState<Set<string> | null>(null);
    const [isDraggingSelection, setIsDraggingSelection] = useState(false);
    const [isFilling, setIsFilling] = useState(false);
    const [fillTargetArea, setFillTargetArea] = useState<{ start: Coords, end: Coords } | null>(null);
    
    const [datePopoverState, setDatePopoverState] = useState<{ act: Act; position: { top: number, left: number, width: number } } | null>(null);
    const [dragIndicator, setDragIndicator] = useState<{ type: 'row' | 'col'; x: number; y: number; width: number; height: number; } | null>(null);

    const [draggedRowIndices, setDraggedRowIndices] = useState<number[] | null>(null);
    const [dropTargetRowIndex, setDropTargetRowIndex] = useState<number | null>(null);
    const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null);
    const dragHandlePressedRef = useRef(false);

    const [draggedColKey, setDraggedColKey] = useState<string | null>(null);
    const [dropTargetColKey, setDropTargetColKey] = useState<string | null>(null);
    const [dropColPosition, setDropColPosition] = useState<'left' | 'right' | null>(null);

    const [nextWorkPopoverState, setNextWorkPopoverState] = useState<{ rowIndex: number; colIndex: number; position: { top: number, left: number, width: number }; } | null>(null);
    const [regulationPopoverState, setRegulationPopoverState] = useState<{ regulation: Regulation; position: { top: number; left: number }; } | null>(null);
    const [materialPopoverState, setMaterialPopoverState] = useState<{ certificate: Certificate; materialName: string; position: { top: number; left: number }; } | null>(null);
    const [fullRegulationDetails, setFullRegulationDetails] = useState<Regulation | null>(null);
    const [regulationsModalOpen, setRegulationsModalOpen] = useState(false);

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowIndex: number; colIndex: number } | null>(null);
    
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);

    const columns = useMemo(() => {
        const colMap = new Map(ALL_COLUMNS.map(col => [col.key, col]));
        const orderedCols = columnOrder.filter(key => colMap.has(key as any) && visibleColumns.has(key)).map(key => colMap.get(key as any)!);
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

    const paddingClass = density === 'compact' ? 'px-1 py-0.5' : 'px-2 py-1';
    const headerPaddingClass = density === 'compact' ? 'px-2 py-1' : 'px-2 py-2';
    const fontSizeClass = density === 'compact' ? 'text-xs' : 'text-sm';

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
        if (selectedCells.size === 0 || columns.length === 0) return rowsFullySelected;
        const cellsByRow = new Map<number, number>();
        for (const cellId of selectedCells) {
            const [rowIndex] = cellId.split(':').map(Number);
            cellsByRow.set(rowIndex, (cellsByRow.get(rowIndex) || 0) + 1);
        }
        for (const [rowIndex, count] of cellsByRow.entries()) {
            if (count === columns.length) rowsFullySelected.add(rowIndex);
        }
        return rowsFullySelected;
    }, [selectedCells, columns]);
    
    const applyTemplatesToAct = useCallback((act: Act) => {
        const actToSave = { ...act };
        const resolve = (templateStr: string, contextAct: Act) => {
            if (!templateStr || typeof templateStr !== 'string') return templateStr;
            return templateStr.replace(/\{(\w+)\}/g, (_, key) => {
                let value;
                 if (key === 'workStartDate' || key === 'workEndDate') value = formatDateForDisplay((contextAct as any)[key]);
                 else value = (contextAct as any)[key];
                return value !== undefined && value !== null ? String(value) : '';
            });
        };

        if (settings.showAttachments && settings.defaultAttachments) actToSave.attachments = resolve(settings.defaultAttachments, actToSave);
        if (settings.showAdditionalInfo && settings.defaultAdditionalInfo) actToSave.additionalInfo = resolve(settings.defaultAdditionalInfo, actToSave);
        
        const dateTemplate = settings.defaultActDate !== undefined ? settings.defaultActDate : '{workEndDate}';
        const resolvedDateString = resolve(dateTemplate, actToSave);
        actToSave.date = parseDisplayDate(resolvedDateString) || actToSave.date;
        
        return actToSave;
    }, [settings]);

    const handleSaveWithTemplateResolution = useCallback((actToSave: Act) => {
        const resolvedAct = applyTemplatesToAct(actToSave);
        onSave(resolvedAct);
    }, [onSave, applyTemplatesToAct]);

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
            if (!startStr && !endStr) {
                updatedAct.workStartDate = ''; updatedAct.workEndDate = '';
            } else {
                const start = parseDisplayDate(startStr);
                const end = parseDisplayDate(endStr);
                if (!start || !end) { setDateError('Invalid date format'); return false; }
                updatedAct.workStartDate = start; updatedAct.workEndDate = end;
            }
        } else {
            const columnKey = col.key as keyof Act;
            (updatedAct as any)[columnKey] = editorValue;
            if (col.key === 'nextWork') {
                updatedAct.nextWork = editorValue;
                updatedAct.nextWorkActId = undefined;
            }
        }
        if (JSON.stringify(updatedAct) !== JSON.stringify(act)) handleSaveWithTemplateResolution(updatedAct);
        return true; 
    }, [acts, columns, editingCell, editorValue, handleSaveWithTemplateResolution]);
    
    useEffect(() => {
        if (!editingCell) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (datePopoverState || regulationsModalOpen || regulationPopoverState || materialPopoverState) return;
            if (editorContainerRef.current && !editorContainerRef.current.contains(event.target as Node)) {
                if ((event.target as HTMLElement).closest('.fixed.inset-0.z-50')) return;
                handleEditorSave();
                closeEditor();
            }
        };
        const timerId = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
        return () => { clearTimeout(timerId); document.removeEventListener('mousedown', handleClickOutside); };
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
            } else if (col.key === 'regulations') initialValue = act.regulations || '';
            else if (col.key === 'materials') initialValue = act.materials || '';
            else if (col.key === 'nextWork' && act.nextWorkActId === AUTO_NEXT_ID) {
                const nextAct = acts[rowIndex + 1];
                initialValue = nextAct ? `Работы по акту №${nextAct.number || 'б/н'} (${nextAct.workName || '...'})` : '';
            } else {
                const columnKey = col.key as keyof Act;
                initialValue = act[columnKey] || '';
            }
            setEditorValue(String(initialValue));
            
            setTimeout(() => {
                if (col.key !== 'regulations' && col.key !== 'materials' && editorRef.current) editorRef.current.focus();
                if (editorRef.current instanceof HTMLTextAreaElement) {
                    editorRef.current.style.height = 'auto';
                    editorRef.current.style.height = `${editorRef.current.scrollHeight}px`;
                }
            }, 0);
        }
    }, [editingCell, acts, columns]);

    const handleRegulationsSelect = (selectedRegs: Regulation[]) => {
        if (!editingCell) return;
        const newText = selectedRegs.map(reg => reg.designation).join('; ');
        setEditorValue(prev => prev ? (prev.trim().endsWith(';') ? `${prev} ${newText}` : `${prev}; ${newText}`) : newText);
    };

    const handleDragEnd = () => {
        setDraggedRowIndices(null);
        setDropTargetRowIndex(null);
        setDropPosition(null);
        setDraggedColKey(null);
        setDropTargetColKey(null);
        setDropColPosition(null);
        setDragIndicator(null);
        dragHandlePressedRef.current = false;
    };

    const handleRowDragStart = (e: React.DragEvent<HTMLTableRowElement>, rowIndex: number) => {
        if (editingCell || !dragHandlePressedRef.current) { e.preventDefault(); return; }
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

    const handleColumnDrop = (e: React.DragEvent<HTMLTableHeaderCellElement>) => {
        e.preventDefault();
        if (!draggedColKey || !dropTargetColKey) { handleDragEnd(); return; }
        const oldIndex = columnOrder.indexOf(draggedColKey);
        let newIndex = columnOrder.indexOf(dropTargetColKey);
        if (oldIndex !== -1 && newIndex !== -1) {
            const newOrder = [...columnOrder];
            newOrder.splice(oldIndex, 1);
            let insertIndex = newOrder.indexOf(dropTargetColKey);
            if (dropColPosition === 'right') insertIndex++;
            newOrder.splice(insertIndex, 0, draggedColKey);
            onColumnOrderChange(newOrder);
        }
        handleDragEnd();
    };

    return (
        <div ref={tableContainerRef} className="h-full flex flex-col relative outline-none" tabIndex={0}>
            <div ref={scrollContainerRef} className="flex-grow overflow-auto border border-slate-200 rounded-md bg-white select-none relative" onScroll={() => setContextMenu(null)}>
                <table className="min-w-full divide-y divide-slate-200 border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="sticky left-0 z-20 bg-slate-50 w-10 border-r border-slate-200 p-0 text-center">
                                <span className="text-xs text-slate-400 font-normal">#</span>
                            </th>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={`${col.widthClass} ${headerPaddingClass} text-left text-xs font-semibold text-slate-600 uppercase tracking-wider border-r border-slate-200 select-none relative group`}
                                    draggable={!editingCell}
                                    onDragStart={(e) => handleColumnDragStart(e, col.key)}
                                    onDragOver={(e) => handleColumnDragOver(e, col.key)}
                                    onDrop={handleColumnDrop}
                                >
                                    <div className="flex items-center justify-between cursor-grab active:cursor-grabbing">
                                        <span title={col.helpText}>{col.label}</span>
                                        {col.helpText && <QuestionMarkCircleIcon className="w-3 h-3 text-slate-400 ml-1 opacity-50 hover:opacity-100" />}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {acts.map((act, rowIndex) => {
                            const isRowSelected = selectedRows.has(rowIndex);
                            return (
                                <tr
                                    key={act.id}
                                    draggable={!editingCell}
                                    onDragStart={(e) => handleRowDragStart(e, rowIndex)}
                                    onDragOver={(e) => handleRowDragOver(e, rowIndex)}
                                    onDrop={handleRowDrop}
                                    className={`${isRowSelected ? 'bg-blue-50' : 'hover:bg-slate-50'} group transition-colors`}
                                >
                                    <td
                                        className="sticky left-0 z-10 bg-inherit border-r border-slate-200 text-center cursor-grab active:cursor-grabbing hover:bg-slate-200 transition-colors"
                                        onMouseDown={(e) => {
                                            dragHandlePressedRef.current = true;
                                            if (e.button === 2 && !isRowSelected) { setSelectedCells(new Set()); setActiveCell({ rowIndex, colIndex: 0 }); }
                                        }}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            setContextMenu({ x: e.clientX, y: e.clientY, rowIndex, colIndex: -1 });
                                        }}
                                    >
                                        <div className="flex items-center justify-center h-full w-full">
                                            <span className="text-xs text-slate-400 group-hover:hidden">{rowIndex + 1}</span>
                                            <GripVerticalIcon className="w-4 h-4 text-slate-500 hidden group-hover:block" />
                                        </div>
                                    </td>
                                    
                                    {columns.map((col, colIndex) => {
                                        const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
                                        const cellId = getCellId(rowIndex, colIndex);
                                        const isSelected = selectedCells.has(cellId);
                                        let content: React.ReactNode = (act as any)[col.key];

                                        if (col.key === 'workDates') content = `${formatDateForDisplay(act.workStartDate)} - ${formatDateForDisplay(act.workEndDate)}`;
                                        else if (col.key === 'commissionGroup') content = groups.find(g => g.id === act.commissionGroupId)?.name || '';
                                        else if (col.type === 'date') content = formatDateForDisplay(act[col.key as keyof Act] as string);
                                        else if (col.key === 'nextWork' && act.nextWorkActId === AUTO_NEXT_ID) content = <span className="text-blue-600 font-medium text-xs italic">{AUTO_NEXT_LABEL}</span>;

                                        return (
                                            <td
                                                key={col.key}
                                                data-row-index={rowIndex}
                                                data-col-index={colIndex}
                                                className={`
                                                    ${paddingClass} ${fontSizeClass} border-r border-slate-200 relative
                                                    ${isSelected ? 'bg-blue-100 ring-1 ring-inset ring-blue-300' : ''}
                                                    ${isEditing ? 'p-0 bg-white ring-2 ring-inset ring-blue-500 z-20' : ''}
                                                    cursor-default align-top
                                                `}
                                                onMouseDown={() => {
                                                    setActiveCell({ rowIndex, colIndex });
                                                    setSelectedCells(new Set([getCellId(rowIndex, colIndex)]));
                                                }}
                                                onDoubleClick={() => {
                                                    setEditingCell({ rowIndex, colIndex });
                                                }}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    setContextMenu({ x: e.clientX, y: e.clientY, rowIndex, colIndex });
                                                }}
                                            >
                                                {isEditing ? (
                                                    <div ref={editorContainerRef} className="w-full h-full min-h-[1.5rem]">
                                                        {col.key === 'regulations' ? (
                                                            <RegulationsInput
                                                                value={editorValue}
                                                                onChange={setEditorValue}
                                                                regulations={regulations}
                                                                onOpenDictionary={() => setRegulationsModalOpen(true)}
                                                                onInfoClick={(des, target) => {
                                                                    const reg = regulations.find(r => r.designation === des);
                                                                    if (reg) {
                                                                        const coords = getRelativeCoords(target);
                                                                        setRegulationPopoverState({ regulation: reg, position: { top: coords.top, left: coords.left } });
                                                                    }
                                                                }}
                                                            />
                                                        ) : col.key === 'materials' ? (
                                                            <MaterialsInput
                                                                value={editorValue}
                                                                onChange={setEditorValue}
                                                                certificates={certificates}
                                                                onNavigateToCertificate={onNavigateToCertificate}
                                                            />
                                                        ) : (
                                                            <textarea
                                                                ref={editorRef as React.RefObject<HTMLTextAreaElement>}
                                                                value={editorValue}
                                                                onChange={(e) => setEditorValue(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditorSave(); closeEditor(); }
                                                                    if (e.key === 'Escape') closeEditor();
                                                                }}
                                                                className="w-full h-full min-h-[1.5rem] bg-transparent outline-none resize-none p-1 block"
                                                                autoFocus
                                                            />
                                                        )}
                                                        {dateError && <div className="absolute top-full left-0 bg-red-100 text-red-700 text-xs p-1 rounded shadow-lg z-50 whitespace-nowrap">{dateError}</div>}
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-full min-h-[1.25rem] whitespace-pre-wrap break-words">
                                                        {content}
                                                    </div>
                                                )}
                                                {col.key === 'workDates' && !isEditing && (
                                                    <button onClick={(e) => { e.stopPropagation(); const coords = getRelativeCoords(e.currentTarget); setDatePopoverState({ act, position: coords }); }} className="absolute right-1 top-1 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <CalendarIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {dragIndicator && (
                <div 
                    className="fixed bg-blue-500 z-50 pointer-events-none shadow-lg"
                    style={{ 
                        left: dragIndicator.x, 
                        top: dragIndicator.y, 
                        width: dragIndicator.width, 
                        height: dragIndicator.height 
                    }}
                />
            )}

            {datePopoverState && (
                <DateEditorPopover
                    act={datePopoverState.act}
                    position={datePopoverState.position}
                    onClose={() => setDatePopoverState(null)}
                    onActChange={(updatedAct) => {
                        handleSaveWithTemplateResolution(updatedAct);
                        setDatePopoverState(null);
                    }}
                />
            )}
            
            {nextWorkPopoverState && (
                <NextWorkPopover
                    acts={acts}
                    currentActId={acts[nextWorkPopoverState.rowIndex].id}
                    position={nextWorkPopoverState.position}
                    onClose={() => setNextWorkPopoverState(null)}
                    onSelect={(val) => {
                         const act = acts[nextWorkPopoverState.rowIndex];
                         const updatedAct = { ...act };
                         if (val === null) { updatedAct.nextWork = ''; updatedAct.nextWorkActId = undefined; }
                         else if (typeof val === 'string') {
                             if (val === AUTO_NEXT_ID) updatedAct.nextWorkActId = AUTO_NEXT_ID;
                             else { updatedAct.nextWork = val; updatedAct.nextWorkActId = undefined; }
                         } else {
                             updatedAct.nextWork = `Работы по акту №${val.number || 'б/н'} (${val.workName || '...'})`;
                             updatedAct.nextWorkActId = val.id;
                         }
                         handleSaveWithTemplateResolution(updatedAct);
                         setNextWorkPopoverState(null);
                    }}
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
                    onNavigate={onNavigateToCertificate}
                />
            )}

            {contextMenu && (
                <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
                    <MenuItem icon={<CopyIcon className="w-4 h-4"/>} label="Копировать" onClick={() => { /* Implement copy */ setContextMenu(null); }} shortcut="Ctrl+C" />
                    <MenuItem icon={<PasteIcon className="w-4 h-4"/>} label="Вставить" onClick={() => { /* Implement paste */ setContextMenu(null); }} shortcut="Ctrl+V" />
                    <MenuSeparator />
                    <MenuItem icon={<RowAboveIcon className="w-4 h-4"/>} label="Вставить строку выше" onClick={() => { onSave(createNewAct(), contextMenu.rowIndex); setContextMenu(null); }} />
                    <MenuItem icon={<RowBelowIcon className="w-4 h-4"/>} label="Вставить строку ниже" onClick={() => { onSave(createNewAct(), contextMenu.rowIndex + 1); setContextMenu(null); }} />
                    <MenuItem icon={<DeleteIcon className="w-4 h-4 text-red-500"/>} label="Удалить строку" onClick={() => { onRequestDelete([acts[contextMenu.rowIndex].id]); setContextMenu(null); }} className="text-red-600 hover:bg-red-50" />
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
                <Modal isOpen={true} onClose={() => setFullRegulationDetails(null)} title="Информация о нормативе">
                    <RegulationDetails regulation={fullRegulationDetails} onClose={() => setFullRegulationDetails(null)} />
                </Modal>
            )}
        </div>
    );
};

export default ActsTable;
