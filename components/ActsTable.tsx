import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Act, Person, Organization, ProjectSettings, ROLES, CommissionGroup, Page } from '../types';
import { DeleteIcon, DownloadIcon, CalendarIcon } from './Icons';
import CustomSelect from './CustomSelect';
import { generateDocument } from '../services/docGenerator';
import { ALL_COLUMNS } from './ActsTableConfig';

// Props for the main table component
interface ActsTableProps {
    acts: Act[];
    people: Person[];
    organizations: Organization[];
    groups: CommissionGroup[];
    template: string | null;
    settings: ProjectSettings;
    visibleColumns: Set<string>;
    onSave: (act: Act) => void;
    onDelete: (id: string) => void;
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


type Coords = { rowIndex: number; colIndex: number };

// Main Table Component
const ActsTable: React.FC<ActsTableProps> = ({ acts, people, organizations, groups, template, settings, visibleColumns, onSave, onDelete, setCurrentPage }) => {
    const [editingCell, setEditingCell] = useState<Coords | null>(null);
    const [editorValue, setEditorValue] = useState('');
    const [editorError, setEditorError] = useState<string | null>(null);
    const [activeCell, setActiveCell] = useState<Coords | null>(null);
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [copiedCells, setCopiedCells] = useState<Set<string> | null>(null);
    const [isDraggingSelection, setIsDraggingSelection] = useState(false);
    const [isFilling, setIsFilling] = useState(false);
    const [fillTargetArea, setFillTargetArea] = useState<{ start: Coords, end: Coords } | null>(null);
    
    const [datePopoverState, setDatePopoverState] = useState<{ act: Act; position: { top: number, left: number, width: number } } | null>(null);

    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [selectionAnchorRow, setSelectionAnchorRow] = useState<number | null>(null);
    const [isDraggingRowSelection, setIsDraggingRowSelection] = useState(false);

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);

    const columns = useMemo(() => ALL_COLUMNS.filter(col => {
        if (!visibleColumns.has(col.key)) return false;
        if (col.key === 'date' && !settings.showActDate) return false;
        if (col.key === 'additionalInfo' && !settings.showAdditionalInfo) return false;
        if (col.key === 'attachments' && !settings.showAttachments) return false;
        if (col.key === 'copiesCount' && !settings.showCopiesCount) return false;
        return true;
    }), [settings, visibleColumns]);

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
    
    const handleEditorSaveAndClose = useCallback(() => {
        if (!editingCell) return;
        const { rowIndex, colIndex } = editingCell;
        const act = acts[rowIndex];
        const col = columns[colIndex];
        
        let updatedAct = { ...act };
        let needsSave = false;
        
        if (col.key === 'workDates') {
             const parts = editorValue.split('-').map(s => s.trim());
            const startDateStr = parts[0];
            const endDateStr = parts.length > 1 ? parts[1] : startDateStr;

            if (!startDateStr && editorValue.trim() === '') { // Allow clearing the field
                updatedAct.workStartDate = '';
                updatedAct.workEndDate = '';
                needsSave = true;
            } else {
                const start = parseDisplayDate(startDateStr);
                if (!start) {
                    setEditorError(`Неверный формат даты начала: "${startDateStr}". Используйте ДД.ММ.ГГГГ.`);
                    return; // Don't save or close, show error
                }
                
                const end = parseDisplayDate(endDateStr);
                if (!end) {
                    setEditorError(`Неверный формат даты окончания: "${endDateStr}". Используйте ДД.ММ.ГГГГ.`);
                    return; // Don't save or close, show error
                }
                
                if (new Date(end) < new Date(start)) {
                    setEditorError('Дата окончания не может быть раньше даты начала.');
                    return; // Don't save or close, show error
                }

                updatedAct.workStartDate = start;
                updatedAct.workEndDate = end;
                needsSave = true;
            }
        } else {
             const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'id' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates'>;
            const currentValue = act[columnKey] || '';
            if (String(currentValue) !== editorValue) {
                (updatedAct as any)[columnKey] = editorValue;
                needsSave = true;
            }
        }

        if (needsSave) {
            handleSaveWithTemplateResolution(updatedAct);
        }
        setEditorError(null);
        setEditingCell(null);
        setDatePopoverState(null); // Close popover when main editor closes
    }, [acts, columns, editingCell, editorValue, handleSaveWithTemplateResolution]);
    

    useEffect(() => {
        if (!editingCell) return;
    
        const handleClickOutside = (event: MouseEvent) => {
            if (datePopoverState) return; // Popover will handle its own closing
    
            if (editorContainerRef.current && !editorContainerRef.current.contains(event.target as Node)) {
                handleEditorSaveAndClose();
            }
        };
    
        const timerId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);
    
        return () => {
            clearTimeout(timerId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [editingCell, datePopoverState, handleEditorSaveAndClose]);


    useEffect(() => {
        if (editingCell && editorRef.current) {
            const { rowIndex, colIndex } = editingCell;
            const act = acts[rowIndex];
            const col = columns[colIndex];
            
            let initialValue;
            if (col.key === 'workDates') {
                const start = formatDateForDisplay(act.workStartDate);
                const end = formatDateForDisplay(act.workEndDate);
                initialValue = (start && end) ? `${start} - ${end}` : (start || '');
            } else if (col.type === 'date') {
                const columnKey = col.key as keyof Act;
                initialValue = formatDateForDisplay(act[columnKey] as string || '');
            } else {
                const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'id' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates'>;
                initialValue = act[columnKey] || '';
            }
            
            setEditorValue(String(initialValue));
            editorRef.current.focus();
    
            if (editorRef.current instanceof HTMLTextAreaElement) {
                const el = editorRef.current;
                setTimeout(() => {
                    el.style.height = 'auto';
                    el.style.height = `${el.scrollHeight}px`;
                    el.selectionStart = el.selectionEnd = el.value.length;
                }, 0);
            } else {
                editorRef.current.select();
            }
        }
    }, [editingCell, acts, columns]);

    const handleEditorChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setEditorValue(e.target.value);
        setEditorError(null); // Clear error as user types
        if (e.target instanceof HTMLTextAreaElement) {
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
        }
    };
    
    const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
            e.preventDefault();
            setEditorError(null);
            setEditingCell(null);
            setDatePopoverState(null);
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            if (e.currentTarget instanceof HTMLInputElement || (e.currentTarget instanceof HTMLTextAreaElement && (e.ctrlKey || e.metaKey))) {
                e.preventDefault();
                handleEditorSaveAndClose();
            }
        }
    };

    const getCellId = (rowIndex: number, colIndex: number) => `${rowIndex}:${colIndex}`;

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
        if (selectedRows.size > 0) {
            setSelectedRows(new Set());
        }
        tableContainerRef.current?.focus({ preventScroll: true });
        
        if (e.detail > 1) e.preventDefault();
        setCopiedCells(null);
    
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
    
    const handleCellDoubleClick = (e: React.MouseEvent<HTMLTableCellElement>, rowIndex: number, colIndex: number) => {
        if (window.getSelection) {
            window.getSelection()?.removeAllRanges();
        }
        const col = columns[colIndex];
        
        if (col.key !== 'commissionGroup') {
            handleEditorSaveAndClose(); // Save any other editor
            setDatePopoverState(null); // Close any open popover
            setEditorError(null); // Clear previous error
            setEditingCell({ rowIndex, colIndex });
        }
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
                                 const key = col.key as Exclude<keyof Act, 'representatives' | 'id' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates'>;
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
        if (!activeCell) return;

        try {
            const pastedText = await navigator.clipboard.readText();
            if (!pastedText) return;

            const pastedRows = pastedText.replace(/\r\n/g, '\n').split('\n').map(row => row.split('\t'));
            
            const startRow = activeCell.rowIndex;
            const startCol = activeCell.colIndex;
            const updatedActsMap = new Map<string, Act>();

            pastedRows.forEach((rowData, rOffset) => {
                const targetRowIndex = startRow + rOffset;
                if (targetRowIndex >= acts.length) return;
                
                const originalAct = acts[targetRowIndex];
                if(!originalAct) return;
                let updatedAct = updatedActsMap.get(originalAct.id) || { ...originalAct };

                rowData.forEach((cellData, cOffset) => {
                    const targetColIndex = startCol + cOffset;
                    if (targetColIndex >= columns.length) return;
                    
                    const col = columns[targetColIndex];
                    if (!col) return;

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
                        const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'id' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates'>;
                        (updatedAct as any)[columnKey] = cellData;
                    }
                });
                updatedActsMap.set(originalAct.id, updatedAct);
            });
            
            const actsToSave = Array.from(updatedActsMap.values());
            actsToSave.forEach(handleSaveWithTemplateResolution);

            setCopiedCells(null);
            
            const endRow = startRow + pastedRows.length - 1;
            const maxCols = pastedRows.length > 0 ? Math.max(...pastedRows.map(r => r.length)) : 0;
            const endCol = startCol + maxCols - 1;
            const newSelection = new Set<string>();
            for (let r = startRow; r <= Math.min(endRow, acts.length - 1); r++) {
                for (let c = startCol; c <= Math.min(endCol, columns.length - 1); c++) {
                    newSelection.add(getCellId(r, c));
                }
            }
            setSelectedCells(newSelection);
        } catch (err) {
             console.error("Failed to paste: ", err);
        }
    }, [activeCell, acts, columns, groups, handleSaveWithTemplateResolution]);
    
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (editingCell) {
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            setSelectedCells(new Set());
            setSelectedRows(new Set());
            setActiveCell(null);
            setCopiedCells(null);
            e.currentTarget.blur();
            return;
        }

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key) && selectedRows.size > 0) {
            setSelectedRows(new Set());
        }

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isCtrlKey = isMac ? e.metaKey : e.ctrlKey;

        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCells.size > 0 && selectedRows.size === 0) {
            e.preventDefault();
            const updatedActsMap = new Map<string, Act>();

            selectedCells.forEach(cellId => {
                const [r, c] = cellId.split(':').map(Number);
                const originalAct = acts[r];
                if (!originalAct) return;

                let updatedAct = updatedActsMap.get(originalAct.id) || { ...originalAct };
                const col = columns[c];
                if (!col) return;

                if (col.key === 'workDates') {
                    updatedAct.workStartDate = '';
                    updatedAct.workEndDate = '';
                    updatedAct.date = ''; 
                } else if (col.key === 'commissionGroup') {
                    updatedAct.commissionGroupId = undefined;
                }
                else {
                    const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'id' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates'>;
                    (updatedAct as any)[columnKey] = '';
                }
                updatedActsMap.set(originalAct.id, updatedAct);
            });
            
            const actsToSave = Array.from(updatedActsMap.values());
            actsToSave.forEach(handleSaveWithTemplateResolution);
        }
        
        if (e.code === 'KeyC' && isCtrlKey) {
             e.preventDefault();
             handleCopy();
        }
        
        if (e.code === 'KeyV' && isCtrlKey) {
            e.preventDefault();
            handlePaste();
        }
    }, [editingCell, selectedCells, acts, columns, handleSaveWithTemplateResolution, handleCopy, handlePaste, selectedRows]);


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
    }, [isFilling, selectedCells, fillTargetArea, acts, columns, groups, handleSaveWithTemplateResolution, handleGroupChange]);


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

    const fillHandleCell = useMemo(() => {
        if (selectedCells.size === 0) return null;
        let maxRow = -1, maxColInMaxRow = -1;
        for (const cellId of selectedCells) {
            const [r, c] = cellId.split(':').map(Number);
            if (r > maxRow) {
                maxRow = r;
                maxColInMaxRow = c;
            } else if (r === maxRow && c > maxColInMaxRow) {
                maxColInMaxRow = c;
            }
        }
        return maxRow === -1 ? null : { rowIndex: maxRow, colIndex: maxColInMaxRow };
    }, [selectedCells]);


    const fillHandleCoords = useMemo(() => {
        if (!fillHandleCell) return null;
        const { rowIndex, colIndex } = fillHandleCell;
        const cellElement = tableContainerRef.current?.querySelector(`[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`);
        if (cellElement) {
            return {
                top: (cellElement as HTMLElement).offsetTop + (cellElement as HTMLElement).offsetHeight - 4,
                left: (cellElement as HTMLElement).offsetLeft + (cellElement as HTMLElement).offsetWidth - 4,
            };
        }
        return null;
    }, [fillHandleCell]);

    useEffect(() => {
        const newSelectedCells = new Set<string>();
        if (selectedRows.size > 0) {
            const rowArray = Array.from(selectedRows);
            const lastRow = Math.max(...rowArray);
            
            rowArray.forEach(rowIndex => {
                for (let colIndex = 0; colIndex < columns.length; colIndex++) {
                    newSelectedCells.add(getCellId(rowIndex, colIndex));
                }
            });
            const lastCol = columns.length - 1;
            setActiveCell({ rowIndex: lastRow, colIndex: lastCol });
        } else {
            if (!isDraggingSelection) setActiveCell(null);
        }
        setSelectedCells(newSelectedCells);
    }, [selectedRows, columns, isDraggingSelection]);

    const handleRowSelectorMouseDown = (e: React.MouseEvent<HTMLTableCellElement>, rowIndex: number) => {
        e.preventDefault();
        tableContainerRef.current?.focus({ preventScroll: true });
        setCopiedCells(null);

        let newSelectedRows: Set<number>;

        if (e.shiftKey && selectionAnchorRow !== null) {
            newSelectedRows = new Set();
            const start = Math.min(selectionAnchorRow, rowIndex);
            const end = Math.max(selectionAnchorRow, rowIndex);
            for (let i = start; i <= end; i++) {
                newSelectedRows.add(i);
            }
        } else if (e.ctrlKey || e.metaKey) {
            newSelectedRows = new Set(selectedRows);
            if (newSelectedRows.has(rowIndex)) {
                newSelectedRows.delete(rowIndex);
            } else {
                newSelectedRows.add(rowIndex);
            }
            setSelectionAnchorRow(rowIndex);
        } else {
            newSelectedRows = new Set([rowIndex]);
            setSelectionAnchorRow(rowIndex);
        }
        setSelectedRows(newSelectedRows);
        setIsDraggingRowSelection(true);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRowSelection || selectionAnchorRow === null) return;
            const target = e.target as HTMLElement;
            // FIX: Use generic parameter for `closest` to get a more specific element type (HTMLTableCellElement) which has the `dataset` property.
            const cell = target.closest<HTMLTableCellElement>('td[data-row-index]');
            if (!cell || !cell.dataset.rowIndex) return;

            const currentRowIndex = parseInt(cell.dataset.rowIndex, 10);
            
            const start = Math.min(selectionAnchorRow, currentRowIndex);
            const end = Math.max(selectionAnchorRow, currentRowIndex);
            const newSelectedRows = new Set<number>();
            for (let i = start; i <= end; i++) {
                newSelectedRows.add(i);
            }
            setSelectedRows(newSelectedRows);
        };

        const handleMouseUp = () => setIsDraggingRowSelection(false);

        if (isDraggingRowSelection) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp, { once: true });
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingRowSelection, selectionAnchorRow]);

    const handleBulkDelete = () => {
        if (window.confirm(`Вы уверены, что хотите удалить ${selectedRows.size} акт(ов)?`)) {
            selectedRows.forEach(rowIndex => {
                const actId = acts[rowIndex]?.id;
                if (actId) {
                    onDelete(actId);
                }
            });
            setSelectedRows(new Set());
        }
    };
    
    const handleBulkDownload = () => {
        if (!template) {
            alert('Шаблон не загружен.');
            return;
        }
        selectedRows.forEach(rowIndex => {
            const act = acts[rowIndex];
            if (act) {
                generateDocument(template, act, people);
            }
        });
    };

    return (
        <div className="h-full flex flex-col relative">
            <div className="flex-grow overflow-auto border border-slate-200 rounded-md relative focus:outline-none" ref={tableContainerRef} tabIndex={-1} onKeyDown={handleKeyDown}>
                <table className="min-w-full text-sm border-separate border-spacing-0">
                    <thead className="sticky top-0 bg-slate-50 z-20 shadow-sm">
                        <tr>
                            <th className="sticky left-0 bg-slate-50 p-0 w-12 min-w-[3rem] z-30 border-r border-b border-slate-200"></th>
                            {columns.map((col, colIndex) => (
                                <th 
                                    key={col.key} 
                                    className={`px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap border-b border-slate-200 relative ${colIndex < columns.length -1 ? 'border-r' : ''}`}
                                    style={{ width: columnWidths[col.key] ? `${columnWidths[col.key]}px` : undefined }}
                                >
                                    {col.label}
                                     <div 
                                        onMouseDown={(e) => handleResizeStart(e, col.key)}
                                        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize"
                                     />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {acts.map((act, rowIndex) => {
                            const isRowSelected = selectedRows.has(rowIndex);

                            return (
                                <tr key={act.id}>
                                    <td
                                        className={`sticky left-0 p-0 w-12 min-w-[3rem] z-10 border-r border-b border-slate-200 text-center text-xs text-slate-400 cursor-pointer select-none transition-colors ${isRowSelected ? 'bg-blue-200' : 'bg-slate-50 hover:bg-slate-100'}`}
                                        onMouseDown={(e) => handleRowSelectorMouseDown(e, rowIndex)}
                                        data-row-index={rowIndex}
                                    >
                                        {rowIndex + 1}
                                    </td>
                                    {columns.map((col, colIndex) => {
                                        const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
                                        const cellId = getCellId(rowIndex, colIndex);
                                        const isActive = activeCell?.rowIndex === rowIndex && activeCell?.colIndex === colIndex;
                                        const isSelected = selectedCells.has(cellId);
                                        const isCopied = copiedCells?.has(cellId);

                                        const { minRow, maxRow, minCol, maxCol } = fillTargetArea ? normalizeSelection(fillTargetArea.start, fillTargetArea.end) : { minRow: -1, maxRow: -1, minCol: -1, maxCol: -1 };
                                        const isFillTarget = rowIndex >= minRow && rowIndex <= maxRow && colIndex >= minCol && colIndex <= maxCol;

                                        const cellClassParts = [
                                            "p-0 border-b border-slate-200 relative transition-colors duration-100",
                                            colIndex < columns.length - 1 ? 'border-r' : '',
                                        ];
                                        if (isFillTarget) cellClassParts.push('bg-blue-200');
                                        else if (isSelected) cellClassParts.push('bg-blue-100');
                                        else cellClassParts.push('bg-white');

                                        const cellClass = cellClassParts.join(' ');
                                        
                                        const borderDivs = [];
                                        if (isSelected) {
                                            const hasTop = !selectedCells.has(getCellId(rowIndex - 1, colIndex));
                                            const hasBottom = !selectedCells.has(getCellId(rowIndex + 1, colIndex));
                                            const hasLeft = !selectedCells.has(getCellId(rowIndex, colIndex - 1));
                                            const hasRight = !selectedCells.has(getCellId(rowIndex, colIndex + 1));
                                            
                                            const classes: string[] = ['absolute', 'inset-0', 'border-blue-400', 'pointer-events-none', 'z-10'];
                                            if(hasTop) classes.push('border-t');
                                            if(hasBottom) classes.push('border-b');
                                            if(hasLeft) classes.push('border-l');
                                            if(hasRight) classes.push('border-r');
                                            
                                            borderDivs.push(<div key="selection-border" className={classes.join(' ')}></div>);
                                        }
                                        if (isCopied) {
                                            borderDivs.push(<div key="copy-border" className="absolute inset-0 border-2 border-dashed border-green-500 pointer-events-none z-20"></div>);
                                        }
                                        if (isActive) {
                                            borderDivs.push(<div key="active-border" className="absolute inset-0 border-2 border-blue-600 pointer-events-none z-20"></div>);
                                        }

                                        let cellContent;

                                        if (isEditing) {
                                             if (col.key === 'workDates') {
                                                cellContent = (
                                                    <div ref={editorContainerRef} className="relative flex items-center w-full h-full group">
                                                        <input
                                                            ref={editorRef as any}
                                                            value={editorValue}
                                                            onChange={handleEditorChange}
                                                            onKeyDown={handleEditorKeyDown}
                                                            className={`w-full h-full block bg-white box-border pr-8 px-2 py-1.5 border-2 rounded-md z-30 text-sm outline-none ${editorError ? 'border-red-500' : 'border-blue-500'}`}
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                        <button 
                                                            type="button" 
                                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-600 rounded-full hover:bg-slate-100 z-40"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const cellRect = e.currentTarget.closest('td')!.getBoundingClientRect();
                                                                const containerRect = tableContainerRef.current!.getBoundingClientRect();
                                                                setDatePopoverState({
                                                                    act: act,
                                                                    position: {
                                                                        top: cellRect.bottom - containerRect.top + 5,
                                                                        left: cellRect.left - containerRect.left,
                                                                        width: cellRect.width,
                                                                    }
                                                                });
                                                            }}
                                                        >
                                                            <CalendarIcon className="w-5 h-5"/>
                                                        </button>
                                                        {editorError && (
                                                            <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-red-100 border border-red-300 text-red-700 text-xs rounded-md shadow-lg z-50 whitespace-normal">
                                                                {editorError}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                             } else {
                                                const EditorComponent = col.type === 'textarea' ? 'textarea' : 'input';
                                                cellContent = (
                                                    <div ref={editorContainerRef} className="w-full h-full">
                                                        <EditorComponent
                                                            ref={editorRef as any}
                                                            value={editorValue}
                                                            onChange={handleEditorChange}
                                                            onKeyDown={handleEditorKeyDown}
                                                            type={'text'}
                                                            className={`w-full h-full block bg-white box-border px-2 py-1.5 border-2 border-blue-500 rounded-md z-30 resize-none text-sm outline-none`}
                                                            rows={col.type === 'textarea' ? 1 : undefined}
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                    </div>
                                                );
                                            }
                                        } else {
                                            if(col.key === 'workDates') {
                                                const start = formatDateForDisplay(act.workStartDate);
                                                const end = formatDateForDisplay(act.workEndDate);
                                                cellContent = (start && end) ? `${start} - ${end}` : '...';
                                            } else if (col.key === 'commissionGroup') {
                                                cellContent = (
                                                    <CustomSelect 
                                                        options={groupOptions} 
                                                        value={act.commissionGroupId || ''}
                                                        onChange={(value) => handleGroupChange(act, value)}
                                                        placeholder="-- Выберите группу --"
                                                        onCreateNew={handleCreateNewGroup}
                                                        allowClear={true}
                                                        buttonClassName="w-full h-full text-left bg-transparent border-none shadow-none py-2 px-3 focus:outline-none focus:ring-0 text-slate-900 flex justify-between items-center"
                                                        dropdownClassName="absolute z-50 mt-1 w-auto min-w-full bg-white shadow-lg rounded-md border border-slate-200 max-h-60"
                                                    />
                                                );
                                            } else if (col.type === 'date') {
                                                cellContent = formatDateForDisplay(act[col.key as keyof Act] as string);
                                            }
                                            else {
                                                const key = col.key as Exclude<keyof Act, 'representatives' | 'id' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates'>;
                                                cellContent = act[key] || '';
                                            }
                                        }
                                        
                                        return (
                                            <td 
                                                key={col.key}
                                                className={cellClass}
                                                data-row-index={rowIndex}
                                                data-col-index={colIndex}
                                                onMouseDown={(e) => handleCellMouseDown(e, rowIndex, colIndex)}
                                                onDoubleClick={(e) => handleCellDoubleClick(e, rowIndex, colIndex)}
                                                onContextMenu={(e) => e.preventDefault()}
                                            >
                                                <div className={isEditing
                                                    ? "relative w-full h-full"
                                                    : "disable-cell-text-selection px-2 py-1.5 h-full w-full whitespace-pre-wrap leading-snug relative"
                                                }>
                                                     {cellContent}
                                                </div>
                                                {borderDivs}
                                            </td>
                                        );
                                    })}
                                </tr>
                        )})}
                    </tbody>
                </table>
                
                {datePopoverState && (
                    <DateEditorPopover
                        act={datePopoverState.act}
                        onActChange={(updatedAct) => {
                           setDatePopoverState(prev => prev ? { ...prev, act: updatedAct } : null);
                           handleSaveWithTemplateResolution(updatedAct);
                        }}
                        onClose={() => setDatePopoverState(null)}
                        position={datePopoverState.position}
                    />
                )}

                 {fillHandleCoords && selectedCells.size > 0 && (
                     <div
                        className="absolute w-2 h-2 bg-blue-600 border border-white cursor-crosshair z-30"
                        style={{ top: fillHandleCoords.top, left: fillHandleCoords.left }}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            setIsFilling(true);
                        }}
                     />
                )}
            </div>
            {selectedRows.size > 0 && (
                <div className="flex-shrink-0 flex justify-center p-2">
                    <div className="bg-white shadow-lg rounded-md p-2 flex items-center gap-3 z-40 border border-slate-200 animate-fade-in-up">
                        <span className="text-sm font-medium text-slate-600 px-2">
                            Выбрано: {selectedRows.size}
                        </span>
                        <button onClick={handleBulkDownload} className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-1.5 rounded-md hover:bg-green-100 border border-green-200 transition-colors">
                           <DownloadIcon /> Скачать
                        </button>
                        <button onClick={handleBulkDelete} className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-1.5 rounded-md hover:bg-red-100 border border-red-200 transition-colors">
                            <DeleteIcon /> Удалить
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActsTable;