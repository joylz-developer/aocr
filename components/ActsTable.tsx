
import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { Act, Person, Organization, ProjectSettings, ROLES, CommissionGroup, Page, Coords, Regulation } from '../types';
import Modal from './Modal';
import { DeleteIcon, DownloadIcon, CalendarIcon, LinkIcon, EditIcon, CopyIcon, PasteIcon, SparklesIcon, RowAboveIcon, RowBelowIcon, BookIcon, CloseIcon } from './Icons';
import CustomSelect from './CustomSelect';
import { generateDocument } from '../services/docGenerator';
import { ALL_COLUMNS } from './ActsTableConfig';
import { ContextMenu, MenuItem, MenuSeparator } from './ContextMenu';
import RegulationsModal from './RegulationsModal';
import RegulationsInput from './RegulationsInput';
import RegulationDetails from './RegulationDetails';

// Props for the main table component
interface ActsTableProps {
    acts: Act[];
    people: Person[];
    organizations: Organization[];
    groups: CommissionGroup[];
    regulations: Regulation[];
    template: string | null;
    settings: ProjectSettings;
    visibleColumns: Set<string>;
    columnOrder: string[];
    onColumnOrderChange: (newOrder: string[]) => void;
    activeCell: Coords | null;
    setActiveCell: (cell: Coords | null) => void;
    onSave: (act: Act, insertAtIndex?: number) => void;
    onRequestDelete: (ids: string[]) => void;
    onReorderActs: (newActs: Act[]) => void;
    setCurrentPage: (page: Page) => void;
}

const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return '';
    const dateParts = dateString.split('-');
    if (dateParts.length !== 3) return dateString; // Return original if not in YYYY-MM-DD format
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
        return null; // Invalid date like 31.02.2024
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

        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        
        const timerId = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
        document.addEventListener('keydown', handleKeyDown);
        
        return () => {
            clearTimeout(timerId);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const handleDateChange = (field: 'workStartDate' | 'workEndDate', value: string) => {
        const updatedAct = { ...act, [field]: value };
        
        // Ensure end date is not before start date
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
            style={{ top: position.top, left: position.left, minWidth: position.width }}
            onClick={e => e.stopPropagation()}
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

// Main Table Component
const ActsTable: React.FC<ActsTableProps> = ({ acts, people, organizations, groups, regulations, template, settings, visibleColumns, columnOrder, onColumnOrderChange, activeCell, setActiveCell, onSave, onRequestDelete, onReorderActs, setCurrentPage }) => {
    const [editingCell, setEditingCell] = useState<Coords | null>(null);
    const [editorValue, setEditorValue] = useState('');
    const [dateError, setDateError] = useState<string | null>(null);
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [copiedCells, setCopiedCells] = useState<Set<string> | null>(null);
    const [isDraggingSelection, setIsDraggingSelection] = useState(false);
    const [isFilling, setIsFilling] = useState(false);
    const [fillTargetArea, setFillTargetArea] = useState<{ start: Coords, end: Coords } | null>(null);
    
    const [datePopoverState, setDatePopoverState] = useState<{ act: Act; position: { top: number, left: number, width: number } } | null>(null);
    const [fillHandleCoords, setFillHandleCoords] = useState<{top: number, left: number} | null>(null);

    // Row Drag States
    const [draggedRowIndices, setDraggedRowIndices] = useState<number[] | null>(null);
    const [dropTargetRowIndex, setDropTargetRowIndex] = useState<number | null>(null);
    const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null);

    // Column Drag States
    const [draggedColKey, setDraggedColKey] = useState<string | null>(null);
    const [dropTargetColKey, setDropTargetColKey] = useState<string | null>(null);
    const [dropColPosition, setDropColPosition] = useState<'left' | 'right' | null>(null);


    const [nextWorkPopoverState, setNextWorkPopoverState] = useState<{
        rowIndex: number;
        colIndex: number;
        target: HTMLElement;
    } | null>(null);
    const [actPickerState, setActPickerState] = useState<{ sourceRowIndex: number } | null>(null);
    const [regulationsModalOpen, setRegulationsModalOpen] = useState(false);
    
    // New state for Regulation Popover and Details
    const [regulationPopoverState, setRegulationPopoverState] = useState<{
        regulation: Regulation;
        target: HTMLElement;
    } | null>(null);
    const [fullRegulationDetails, setFullRegulationDetails] = useState<Regulation | null>(null);
    const regulationPopoverRef = useRef<HTMLDivElement>(null);

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowIndex: number; colIndex: number } | null>(null);

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const nextWorkPopoverRef = useRef<HTMLDivElement>(null);

    const actsById = useMemo(() => {
        return new Map(acts.map(a => [a.id, a]));
    }, [acts]);

    const columns = useMemo(() => {
        // Map available columns by key for easy lookup
        const colMap = new Map(ALL_COLUMNS.map(col => [col.key, col]));
        
        // Start with the persisted order, filter valid and visible columns
        const orderedCols = columnOrder
            .filter(key => colMap.has(key as any) && visibleColumns.has(key))
            .map(key => colMap.get(key as any)!);

        // Check if there are any visible columns NOT in the order list (e.g. new features) and append them
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
    
    // Check if a full column is selected
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

    const handleSaveWithTemplateResolution = useCallback((actToSave: Act) => {
        const resolvedAct = { ...actToSave };

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
        
        const context = actToSave;

        if (settings.showAttachments && settings.defaultAttachments) {
            resolvedAct.attachments = resolve(settings.defaultAttachments, context);
        }
        if (settings.showAdditionalInfo && settings.defaultAdditionalInfo) {
            resolvedAct.additionalInfo = resolve(settings.defaultAdditionalInfo, context);
        }
        
        const dateTemplate = settings.defaultActDate !== undefined ? settings.defaultActDate : '{workEndDate}';
        const resolvedDateString = resolve(dateTemplate, context);
        resolvedAct.date = parseDisplayDate(resolvedDateString) || resolvedAct.date;

        onSave(resolvedAct);
    }, [onSave, settings]);
    
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
        setDatePopoverState(null);
        setDateError(null);
        setNextWorkPopoverState(null);
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
                updatedAct.nextWorkActId = undefined;
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
                handleEditorSave(); // Attempt to save
                closeEditor(); // Always close editor, discarding invalid input if save fails
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
            } else {
                const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates' | 'nextWorkActId'>;
                initialValue = act[columnKey] || '';
            }
            
            setEditorValue(String(initialValue));
            
            // Focus logic inside setTimeout to ensure DOM is ready and refs are attached
            setTimeout(() => {
                if (col.key !== 'regulations') { // RegulationsInput has its own focus logic
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
        
        // Don't close editor automatically, let user see added chips
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
            setRegulationPopoverState({ regulation, target });
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
        
        if (e.detail > 1) e.preventDefault();
        setCopiedCells(null);
    
        // Regular cell selection logic
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
        e.preventDefault();
        tableContainerRef.current?.focus({ preventScroll: true });
        
        const newSelectedCells = new Set<string>();
        for (let c = 0; c < columns.length; c++) {
            newSelectedCells.add(getCellId(rowIndex, c));
        }
        
        if (e.shiftKey && activeCell) {
            // Expand selection from active cell row to clicked row
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
             // Toggle row
             const firstCellId = getCellId(rowIndex, 0);
             const isRowSelected = selectedCells.has(firstCellId); // Approximation
             
             for (let c = 0; c < columns.length; c++) {
                 const id = getCellId(rowIndex, c);
                 if (isRowSelected) updatedSelection.delete(id);
                 else updatedSelection.add(id);
             }
             setSelectedCells(updatedSelection);
             setActiveCell({ rowIndex, colIndex: 0 });
        } else {
            setSelectedCells(newSelectedCells);
            setActiveCell({ rowIndex, colIndex: 0 });
        }
    };

    const handleCellDoubleClick = (e: React.MouseEvent<HTMLTableCellElement>, rowIndex: number, colIndex: number) => {
        if (window.getSelection) {
            window.getSelection()?.removeAllRanges();
        }
        const col = columns[colIndex];
        
        // First, attempt to save and close any currently open editor
        if (editingCell || datePopoverState || nextWorkPopoverState || regulationPopoverState) {
            if (handleEditorSave()) {
                 closeEditor();
            } else {
                 return; // Abort if save fails
            }
        }
        
        // Сбросить выделение ячеек, чтобы убрать маркер автозаполнения
        setSelectedCells(new Set());

        // Special handling for the "Next Work" column to show a popover
        if (col?.key === 'nextWork') {
            setNextWorkPopoverState({ rowIndex, colIndex, target: e.currentTarget });
            return; 
        }
    
        // Standard behavior for other editable columns
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

            const updatedActsMap = new Map<string, Act>();

            for (const cellId of selectedCells) {
                const [r, c] = cellId.split(':').map(Number);

                const sourceRowIndex = (r - minRow) % pastedHeight;
                const sourceColIndex = (c - minCol) % pastedWidth;

                const cellData = pastedRows[sourceRowIndex]?.[sourceColIndex];
                if (cellData === undefined) continue;

                const originalAct = acts[r];
                if (!originalAct) continue;
                let updatedAct = updatedActsMap.get(originalAct.id) || { ...originalAct };

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
                }
                else {
                    const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates' | 'nextWorkActId'>;
                    (updatedAct as any)[columnKey] = cellData;
                }
                
                updatedActsMap.set(originalAct.id, updatedAct);
            }
            
            const actsToSave = Array.from(updatedActsMap.values());
            actsToSave.forEach(handleSaveWithTemplateResolution);

            setCopiedCells(null);

        } catch (err) {
             console.error("Failed to paste: ", err);
        }
    }, [selectedCells, acts, columns, groups, handleSaveWithTemplateResolution]);
    
    const handleClearCells = useCallback(() => {
        const updatedActsMap = new Map<string, Act>();
        selectedCells.forEach(cellId => {
            const [r, c] = cellId.split(':').map(Number);
            const originalAct = acts[r];
            if (!originalAct) return;

            let updatedAct = updatedActsMap.get(originalAct.id) || { ...originalAct };
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
            updatedActsMap.set(originalAct.id, updatedAct);
        });
        
        Array.from(updatedActsMap.values()).forEach(handleSaveWithTemplateResolution);
    }, [selectedCells, acts, columns, handleSaveWithTemplateResolution]);
    
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
            return;
        }

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key) && selectedRows.size > 0) {
             const newSelectedCells = new Set<string>();
             if (activeCell) {
                newSelectedCells.add(getCellId(activeCell.rowIndex, activeCell.colIndex));
             }
             setSelectedCells(newSelectedCells);
        }

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isCtrlKey = isMac ? e.metaKey : e.ctrlKey;

        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCells.size > 0 && selectedRows.size === 0) {
            e.preventDefault();
            handleClearCells();
        }
        
        if (e.code === 'KeyC' && isCtrlKey) {
             e.preventDefault();
             handleCopy();
        }
        
        if (e.code === 'KeyV' && isCtrlKey) {
            e.preventDefault();
            handlePaste();
        }
    }, [editingCell, selectedCells, handleClearCells, handleCopy, handlePaste, selectedRows, activeCell, setActiveCell]);


    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
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
        };

        if (isDraggingSelection) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp, { once: true });
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingSelection, activeCell]);
    
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
                         handleGroupChange(updatedAct, sourceAct.commissionGroupId || '');
                         const group = groups.find(g => g.id === sourceAct.commissionGroupId);
                         if (group) {
                            updatedAct.commissionGroupId = group.id;
                            updatedAct.representatives = { ...group.representatives };
                            updatedAct.builderOrgId = group.builderOrgId;
                            updatedAct.contractorOrgId = group.contractorOrgId;
                            updatedAct.designerOrgId = group.designerOrgId;
                            updatedAct.workPerformerOrgId = group.workPerformerOrgId;
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
            
            Array.from(actsToUpdate.values()).forEach(handleSaveWithTemplateResolution);

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
    }, [isFilling, selectedCells, fillTargetArea, acts, columns, groups, handleGroupChange, handleSaveWithTemplateResolution]);


    // ROW DRAG & DROP LOGIC
    const handleRowDragStart = (e: React.DragEvent<HTMLTableRowElement>, rowIndex: number) => {
        if (editingCell) return e.preventDefault();
        
        // Ensure dragging is only initiated from the handle
        if (!(e.target as HTMLElement).closest('.row-drag-handle')) {
            e.preventDefault();
            return;
        }

        let indicesToDrag = [rowIndex];
        // If the dragged row is part of a selection, drag all selected rows
        if (selectedRows.has(rowIndex)) {
            indicesToDrag = Array.from(selectedRows).sort((a,b) => a-b);
        }
        setDraggedRowIndices(indicesToDrag);
        e.dataTransfer.effectAllowed = 'move';
        
        // Custom drag image could be set here
        e.dataTransfer.setData('text/plain', JSON.stringify(indicesToDrag));
    };

    const handleRowDragOver = (e: React.DragEvent<HTMLTableRowElement>, rowIndex: number) => {
        e.preventDefault(); // Necessary to allow dropping
        if (!draggedRowIndices) return;

        // Determine drop position (top or bottom of the row)
        const rect = e.currentTarget.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const pos = e.clientY < midY ? 'top' : 'bottom';
        
        setDropTargetRowIndex(rowIndex);
        setDropPosition(pos);
    };

    const handleRowDrop = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.preventDefault();
        if (!draggedRowIndices || dropTargetRowIndex === null || !dropPosition) return;
        
        // Calculate new index
        let insertIndex = dropTargetRowIndex;
        if (dropPosition === 'bottom') insertIndex++;
        
        // Adjust insert index if dragging downwards and index is after source
        // This logic can be complex with multiple items. Simplest strategy:
        // Remove all items, then insert at adjusted target.
        
        const draggedActs = draggedRowIndices.map(i => acts[i]);
        const remainingActs = acts.filter((_, i) => !draggedRowIndices.includes(i));
        
        // Recalculate insert index for the remaining array
        // We need to know how many items *before* the target were removed
        const numRemovedBeforeTarget = draggedRowIndices.filter(i => i < insertIndex).length;
        const adjustedInsertIndex = Math.max(0, insertIndex - numRemovedBeforeTarget);
        
        const newActs = [
            ...remainingActs.slice(0, adjustedInsertIndex),
            ...draggedActs,
            ...remainingActs.slice(adjustedInsertIndex)
        ];
        
        onReorderActs(newActs);
        
        // Reset state
        setDraggedRowIndices(null);
        setDropTargetRowIndex(null);
        setDropPosition(null);
        setSelectedCells(new Set()); // Clear selection after move to avoid confusion
    };
    
    // COLUMN DRAG & DROP LOGIC
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
        const pos = e.clientX < midX ? 'left' : 'right';

        setDropTargetColKey(colKey);
        setDropColPosition(pos);
    };

    const handleColumnDrop = () => {
        if (!draggedColKey || !dropTargetColKey || !dropColPosition) return;

        const currentOrder = columns.map(c => c.key);
        const fromIndex = currentOrder.indexOf(draggedColKey as any);
        const toIndex = currentOrder.indexOf(dropTargetColKey as any);

        if (fromIndex === -1 || toIndex === -1) return;

        const newOrder = [...currentOrder];
        newOrder.splice(fromIndex, 1); // Remove from old pos
        
        // Calculate new insertion index
        let insertIndex = toIndex;
        if (fromIndex < toIndex) insertIndex--; // Adjust for removal if moving right
        if (dropColPosition === 'right') insertIndex++;
        
        newOrder.splice(insertIndex, 0, draggedColKey as any);

        // Update the full order preference list, preserving invisible columns order
        const fullOrder = [...columnOrder];
        // We only reordered visible columns relative to each other.
        // A simple robust way is to filter fullOrder to remove moved item, then insert it.
        // But we must respect the relative position to the *target* column in the full list.
        
        const fullFromIndex = fullOrder.indexOf(draggedColKey);
        const fullTargetIndex = fullOrder.indexOf(dropTargetColKey);
        
        if (fullFromIndex !== -1 && fullTargetIndex !== -1) {
            const newFullOrder = [...fullOrder];
            newFullOrder.splice(fullFromIndex, 1);
            
            // Re-find target index as it might have shifted
            let newTargetIndex = newFullOrder.indexOf(dropTargetColKey);
            if (dropColPosition === 'right') newTargetIndex++;
            
            newFullOrder.splice(newTargetIndex, 0, draggedColKey);
            onColumnOrderChange(newFullOrder);
        }

        setDraggedColKey(null);
        setDropTargetColKey(null);
        setDropColPosition(null);
    };

    // Calculate fill handle position
    useEffect(() => {
         if (selectedCells.size > 0 && tableContainerRef.current) {
            const coordsList = Array.from(selectedCells).map(id => {
                const [rowIndex, colIndex] = id.split(':').map(Number);
                return { rowIndex, colIndex };
            });
            const maxRow = Math.max(...coordsList.map(c => c.rowIndex));
            const maxCol = Math.max(...coordsList.map(c => c.colIndex));

            // Find the cell element
            // We need to query selector carefully as rows might be virtualized in future, but for now they are all there
            // Actually, querying by data attribute is reliable
            const cell = tableContainerRef.current.querySelector(`td[data-row-index="${maxRow}"][data-col-index="${maxCol}"]`);
            
            if (cell) {
                 const rect = (cell as HTMLElement).getBoundingClientRect();
                 const containerRect = tableContainerRef.current.getBoundingClientRect();
                 
                 setFillHandleCoords({
                     top: (rect.bottom - containerRect.top) + tableContainerRef.current.scrollTop - 4,
                     left: (rect.right - containerRect.left) + tableContainerRef.current.scrollLeft - 4
                 });
            } else {
                 setFillHandleCoords(null);
            }
         } else {
             setFillHandleCoords(null);
         }
    }, [selectedCells, acts, columns]); // Recalc on data change too

    const handleColumnHeaderClick = (e: React.MouseEvent, colIndex: number) => {
        // If clicking sort or drag handle, don't select?
        // For now, simple click selects column
        if (e.ctrlKey || e.metaKey) {
             const newSelectedCells = new Set(selectedCells);
             // Add/remove column cells
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

    // Scroll to active cell logic
    useEffect(() => {
        if (activeCell && tableContainerRef.current) {
            const { rowIndex, colIndex } = activeCell;
            const cell = tableContainerRef.current.querySelector(`td[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`);
            if (cell) {
                // Basic scroll into view logic if needed, but browser default focus handling usually does this
                // cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
        }
    }, [activeCell]);


    return (
        <div 
            className="h-full flex flex-col relative outline-none" 
            tabIndex={0} 
            onKeyDown={handleKeyDown}
            ref={tableContainerRef}
        >
            <div className="flex-grow overflow-auto relative scroll-shadows">
                <table className="w-full border-collapse text-sm min-w-max">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="w-10 border border-slate-300 px-2 py-2 font-medium text-slate-500 text-center select-none bg-slate-100">
                                #
                            </th>
                            {columns.map((col, index) => (
                                <th
                                    key={col.key}
                                    className={`
                                        border border-slate-300 px-2 py-2 font-medium text-slate-600 text-left select-none relative
                                        ${col.widthClass}
                                        ${selectedColumns.has(index) ? 'bg-blue-100' : ''}
                                        ${draggedColKey === col.key ? 'opacity-50' : ''}
                                        ${dropTargetColKey === col.key && dropColPosition === 'left' ? 'border-l-[6px] border-l-blue-600' : ''}
                                        ${dropTargetColKey === col.key && dropColPosition === 'right' ? 'border-r-[6px] border-r-blue-600' : ''}
                                        grabbable
                                    `}
                                    draggable={!editingCell}
                                    onDragStart={(e) => handleColumnDragStart(e, col.key)}
                                    onDragOver={(e) => handleColumnDragOver(e, col.key)}
                                    onDrop={handleColumnDrop}
                                    onClick={(e) => handleColumnHeaderClick(e, index)}
                                >
                                    {col.label}
                                    {/* Resizer could go here */}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {acts.length > 0 ? (
                            acts.map((act, rowIndex) => {
                                const isRowSelected = selectedRows.has(rowIndex);
                                const isRowDragged = draggedRowIndices?.includes(rowIndex);
                                const isDropTarget = dropTargetRowIndex === rowIndex;
                                
                                return (
                                    <tr 
                                        key={act.id} 
                                        className={`
                                            group
                                            ${isRowSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}
                                            ${isRowDragged ? 'opacity-40' : ''}
                                            ${isDropTarget && dropPosition === 'top' ? 'drop-target-row-top' : ''}
                                            ${isDropTarget && dropPosition === 'bottom' ? 'drop-target-row-bottom' : ''}
                                            ${actPickerState?.sourceRowIndex === rowIndex ? 'act-picker-source-row' : ''}
                                        `}
                                        draggable={!editingCell}
                                        onDragStart={(e) => handleRowDragStart(e, rowIndex)}
                                        onDragOver={(e) => handleRowDragOver(e, rowIndex)}
                                        onDrop={handleRowDrop}
                                    >
                                        <td 
                                            className="border border-slate-300 px-1 py-1 text-center text-xs text-slate-400 select-none bg-slate-50 cursor-grab active:cursor-grabbing row-drag-handle"
                                            onMouseDown={(e) => handleRowHeaderMouseDown(e, rowIndex)}
                                        >
                                            {rowIndex + 1}
                                        </td>
                                        {columns.map((col, colIndex) => {
                                            const cellId = getCellId(rowIndex, colIndex);
                                            const isSelected = selectedCells.has(cellId);
                                            const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
                                            const isCopied = copiedCells?.has(cellId);
                                            
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
                                                    style={{ height: '1px' }} // Hack to make cell grow with content but allow 100% height child
                                                >
                                                    {isCopied && <div className="copied-cell-overlay" />}
                                                    
                                                    {isEditing ? (
                                                        <div ref={editorContainerRef} className="h-full w-full min-h-[1.5em]">
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
                                                            ) : (
                                                                <textarea
                                                                    ref={editorRef as React.RefObject<HTMLTextAreaElement>}
                                                                    value={editorValue}
                                                                    onChange={handleEditorChange}
                                                                    onKeyDown={handleEditorKeyDown}
                                                                    className="w-full h-full min-h-[60px] resize-none outline-none bg-white p-1"
                                                                />
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="w-full h-full min-h-[1.5em] whitespace-pre-wrap break-words">
                                                            {col.key === 'workDates' ? (
                                                                <div className="flex justify-between items-center group/date">
                                                                     <span>
                                                                        {act.workStartDate ? formatDateForDisplay(act.workStartDate) : <span className="text-slate-300 italic">Начало</span>}
                                                                        {' - '}
                                                                        {act.workEndDate ? formatDateForDisplay(act.workEndDate) : <span className="text-slate-300 italic">Конец</span>}
                                                                    </span>
                                                                    <button 
                                                                        className="opacity-0 group-hover/date:opacity-100 text-slate-400 hover:text-blue-600 p-1"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                                            setDatePopoverState({ 
                                                                                act, 
                                                                                position: { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: 200 } 
                                                                            });
                                                                        }}
                                                                    >
                                                                        <CalendarIcon className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            ) : col.key === 'commissionGroup' ? (
                                                                groups.find(g => g.id === act.commissionGroupId)?.name || ''
                                                            ) : col.type === 'date' ? (
                                                                formatDateForDisplay(act[col.key as keyof Act] as string)
                                                            ) : col.key === 'regulations' ? (
                                                                // Render view-mode regulations with chips if possible
                                                                act.regulations ? (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {act.regulations.split(';').map(s => s.trim()).filter(Boolean).map((regName, idx) => {
                                                                            const reg = regulations.find(r => r.designation === regName);
                                                                             // Styling based on status if known
                                                                            let chipClass = "bg-slate-100 text-slate-800 border-slate-300"; 
                                                                            if (reg) {
                                                                                 if (reg.status?.toLowerCase().includes('действует')) chipClass = "bg-green-100 text-green-800 border-green-200";
                                                                                 else if (reg.status?.toLowerCase().includes('заменен') || reg.status?.toLowerCase().includes('отменен')) chipClass = "bg-red-100 text-red-800 border-red-200";
                                                                                 else chipClass = "bg-blue-100 text-blue-800 border-blue-200";
                                                                            }
                                                                            
                                                                            return (
                                                                                <span 
                                                                                    key={idx} 
                                                                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border ${chipClass} ${reg ? 'cursor-pointer hover:underline' : ''}`}
                                                                                    onClick={(e) => {
                                                                                        if (reg) {
                                                                                            e.stopPropagation();
                                                                                            handleShowRegulationInfo(regName, e.currentTarget);
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    {regName}
                                                                                </span>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : ''
                                                            ) : (
                                                                String(act[col.key as keyof Act] || '')
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
                                    Нет актов. Нажмите "Создать акт", чтобы добавить первый.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                 {/* Fill Handle */}
                 {fillHandleCoords && !editingCell && (
                    <div
                        className="absolute w-3 h-3 bg-blue-600 border border-white cursor-crosshair z-20 pointer-events-auto"
                        style={{ top: fillHandleCoords.top, left: fillHandleCoords.left }}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            setIsFilling(true);
                        }}
                    />
                )}
            </div>

            {/* Date Picker Popover */}
            {datePopoverState && (
                <DateEditorPopover 
                    act={datePopoverState.act}
                    onActChange={(updated) => handleSaveWithTemplateResolution(updated)}
                    onClose={() => setDatePopoverState(null)}
                    position={datePopoverState.position}
                />
            )}
            
            {/* Regulation Info Popover */}
             {regulationPopoverState && (
                <div 
                    ref={regulationPopoverRef}
                    className="absolute z-50 bg-white border border-slate-200 rounded-lg shadow-xl p-4 w-80 animate-fade-in-up"
                    style={{ 
                        top: Math.min(window.innerHeight - 200, regulationPopoverState.target.getBoundingClientRect().bottom + window.scrollY), 
                        left: Math.min(window.innerWidth - 340, regulationPopoverState.target.getBoundingClientRect().left + window.scrollX) 
                    }}
                >
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-slate-800">{regulationPopoverState.regulation.designation}</h4>
                         <button onClick={() => setRegulationPopoverState(null)} className="text-slate-400 hover:text-slate-600"><CloseIcon className="w-4 h-4"/></button>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{regulationPopoverState.regulation.status}</p>
                    <p className="text-sm text-slate-700 mb-3 line-clamp-3">{regulationPopoverState.regulation.title}</p>
                    
                    <button 
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                        onClick={() => {
                            setFullRegulationDetails(regulationPopoverState.regulation);
                            setRegulationPopoverState(null);
                        }}
                    >
                        <BookIcon className="w-4 h-4"/>
                        Открыть биографию
                    </button>
                </div>
            )}
             
            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu 
                    x={contextMenu.x} 
                    y={contextMenu.y} 
                    onClose={() => setContextMenu(null)}
                >
                    <MenuItem 
                        icon={<EditIcon className="w-4 h-4" />} 
                        label="Редактировать" 
                        onClick={() => {
                            setEditingCell({ rowIndex: contextMenu.rowIndex, colIndex: contextMenu.colIndex });
                            setContextMenu(null);
                        }} 
                    />
                    <MenuSeparator />
                    <MenuItem 
                        icon={<CopyIcon className="w-4 h-4" />} 
                        label="Копировать" 
                        shortcut="Ctrl+C"
                        onClick={() => {
                            handleCopy();
                            setContextMenu(null);
                        }} 
                    />
                    <MenuItem 
                        icon={<PasteIcon className="w-4 h-4" />} 
                        label="Вставить" 
                        shortcut="Ctrl+V"
                        onClick={() => {
                            handlePaste();
                            setContextMenu(null);
                        }} 
                    />
                    <MenuSeparator />
                     <MenuItem 
                        icon={<SparklesIcon className="w-4 h-4" />} 
                        label="Сгенерировать Word" 
                        onClick={() => {
                            if (!template) {
                                alert("Сначала загрузите шаблон");
                            } else {
                                generateDocument(template, acts[contextMenu.rowIndex], people);
                            }
                            setContextMenu(null);
                        }} 
                    />
                    <MenuSeparator />
                    <MenuItem 
                        icon={<RowAboveIcon className="w-4 h-4" />} 
                        label="Вставить строку выше" 
                        onClick={() => {
                            const newAct: Act = { ...acts[0], id: crypto.randomUUID(), number: '', date: new Date().toISOString().split('T')[0], workStartDate: '', workEndDate: '' }; // Simplified new act
                            onSave(newAct, contextMenu.rowIndex);
                            setContextMenu(null);
                        }} 
                    />
                    <MenuItem 
                         icon={<RowBelowIcon className="w-4 h-4" />} 
                        label="Вставить строку ниже" 
                        onClick={() => {
                             const newAct: Act = { ...acts[0], id: crypto.randomUUID(), number: '', date: new Date().toISOString().split('T')[0], workStartDate: '', workEndDate: '' };
                             onSave(newAct, contextMenu.rowIndex + 1);
                             setContextMenu(null);
                        }} 
                    />
                    <MenuSeparator />
                    <MenuItem 
                        icon={<DeleteIcon className="w-4 h-4 text-red-500" />} 
                        label="Удалить строку" 
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => {
                            onRequestDelete([acts[contextMenu.rowIndex].id]);
                            setContextMenu(null);
                        }} 
                    />
                </ContextMenu>
            )}

            {/* Modals */}
             <RegulationsModal
                isOpen={regulationsModalOpen}
                onClose={() => {
                    setRegulationsModalOpen(false);
                    // Re-focus editor if it was open
                    if (editingCell) {
                       // Handled by editor blur/focus logic generally, but simple close is fine
                    }
                }}
                regulations={regulations}
                onSelect={handleRegulationsSelect}
            />
            
            {fullRegulationDetails && (
                <Modal isOpen={!!fullRegulationDetails} onClose={() => setFullRegulationDetails(null)} title="">
                    <RegulationDetails regulation={fullRegulationDetails} onClose={() => setFullRegulationDetails(null)} />
                </Modal>
            )}
            
            {/* Popover for Next Work Selection */}
            {nextWorkPopoverState && (
                <div 
                    ref={nextWorkPopoverRef}
                    className="absolute z-50 bg-white border border-slate-200 rounded shadow-lg w-64 max-h-60 overflow-y-auto animate-fade-in-up"
                    style={{ 
                        top: nextWorkPopoverState.target.getBoundingClientRect().bottom + window.scrollY, 
                        left: nextWorkPopoverState.target.getBoundingClientRect().left + window.scrollX 
                    }}
                >
                    <div className="p-2 border-b bg-slate-50 text-xs font-semibold text-slate-500">
                        Выберите акт скрытых работ
                    </div>
                    {acts.map(a => (
                        <button
                            key={a.id}
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm truncate"
                            onClick={() => {
                                const targetAct = acts[nextWorkPopoverState.rowIndex];
                                const updatedAct = { 
                                    ...targetAct, 
                                    nextWork: `Акт №${a.number} от ${formatDateForDisplay(a.date)} (${a.workName})`,
                                    nextWorkActId: a.id 
                                };
                                handleSaveWithTemplateResolution(updatedAct);
                                setNextWorkPopoverState(null);
                            }}
                        >
                            <span className="font-medium">№{a.number}</span> - {a.workName}
                        </button>
                    ))}
                    <div className="border-t p-1">
                        <button
                            className="w-full text-center text-xs text-blue-600 hover:underline py-1"
                            onClick={() => {
                                setEditingCell({ rowIndex: nextWorkPopoverState.rowIndex, colIndex: nextWorkPopoverState.colIndex });
                                setNextWorkPopoverState(null);
                            }}
                        >
                            Ввести вручную...
                        </button>
                    </div>
                </div>
            )}
            
             {/* Global click handler for popovers */}
            {useEffect(() => {
                const handleClickOutside = (event: MouseEvent) => {
                     // Next Work Popover
                    if (nextWorkPopoverState && nextWorkPopoverRef.current && !nextWorkPopoverRef.current.contains(event.target as Node) && !nextWorkPopoverState.target.contains(event.target as Node)) {
                        setNextWorkPopoverState(null);
                    }
                     // Regulation Popover
                    if (regulationPopoverState && regulationPopoverRef.current && !regulationPopoverRef.current.contains(event.target as Node) && !regulationPopoverState.target.contains(event.target as Node)) {
                        setRegulationPopoverState(null);
                    }
                };
                document.addEventListener('mousedown', handleClickOutside);
                return () => document.removeEventListener('mousedown', handleClickOutside);
            }, [nextWorkPopoverState, regulationPopoverState]) as any}
        </div>
    );
};

export default ActsTable;
