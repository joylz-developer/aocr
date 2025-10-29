import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Act, Person, Organization, ProjectSettings, ROLES, CommissionGroup } from '../types';
import { DeleteIcon, DownloadIcon } from './Icons';
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
            onSave({ ...act, workStartDate: startDate, workEndDate: endDate });
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


type Coords = { rowIndex: number; colIndex: number };

// Main Table Component
const ActsTable: React.FC<ActsTableProps> = ({ acts, people, organizations, groups, template, settings, visibleColumns, onSave, onDelete }) => {
    const [editingCell, setEditingCell] = useState<Coords | null>(null);
    const [editorValue, setEditorValue] = useState('');
    const [activeCell, setActiveCell] = useState<Coords | null>(null);
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [copiedCells, setCopiedCells] = useState<Set<string> | null>(null);
    const [isDraggingSelection, setIsDraggingSelection] = useState(false);
    const [isFilling, setIsFilling] = useState(false);
    const [fillTargetArea, setFillTargetArea] = useState<{ start: Coords, end: Coords } | null>(null);

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    const columns = useMemo(() => ALL_COLUMNS.filter(col => {
        if (!visibleColumns.has(col.key)) return false;
        if (col.key === 'date' && !settings.showActDate) return false;
        if (col.key === 'additionalInfo' && !settings.showAdditionalInfo) return false;
        if (col.key === 'attachments' && !settings.showAttachments) return false;
        if (col.key === 'copiesCount' && !settings.showCopiesCount) return false;
        return true;
    }), [settings, visibleColumns]);

    const handleSaveWithTemplateResolution = useCallback((actToSave: Act) => {
        const resolvedAct = { ...actToSave };

        const resolve = (template: string, contextAct: Act) => {
            if (!template || typeof template !== 'string') return template;
            return template.replace(/\{(\w+)\}/g, (_, key) => {
                const value = (contextAct as any)[key];
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
        
        // Apply date template. If `defaultActDate` is not set (e.g. for old projects),
        // fallback to old behavior of `date = workEndDate`.
        const dateTemplate = settings.defaultActDate !== undefined ? settings.defaultActDate : '{workEndDate}';
        resolvedAct.date = resolve(dateTemplate, context);

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

            // Update details strings based on new org IDs
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


    useEffect(() => {
        if (editingCell && editorRef.current) {
            const { rowIndex, colIndex } = editingCell;
            const act = acts[rowIndex];
            const col = columns[colIndex];
            
            const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'id' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates'>;
            const initialValue = act[columnKey] || '';
            setEditorValue(String(initialValue));
            
            editorRef.current.focus();
    
            if (editorRef.current instanceof HTMLTextAreaElement) {
                const el = editorRef.current;
                // Defer to allow DOM to update with the value before calculating scrollHeight
                setTimeout(() => {
                    el.style.height = 'auto'; // Reset height
                    el.style.height = `${el.scrollHeight}px`; // Set to content height
                    // Move cursor to end of text
                    el.selectionStart = el.selectionEnd = el.value.length;
                }, 0);
            } else {
                // For regular inputs, select the whole text
                editorRef.current.select();
            }
        }
    }, [editingCell, acts, columns]);

    const handleEditorChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setEditorValue(e.target.value);
        // Auto-resize textarea
        if (e.target instanceof HTMLTextAreaElement) {
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
        }
    };
    
    const handleEditorSaveAndClose = () => {
        if (!editingCell) return;
        const { rowIndex, colIndex } = editingCell;
        const act = acts[rowIndex];
        const col = columns[colIndex];
        const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'id' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates'>;
        
        const currentValue = act[columnKey] || '';
        if (String(currentValue) !== editorValue) {
            handleSaveWithTemplateResolution({ ...act, [columnKey]: editorValue });
        }
        setEditingCell(null);
    };
    
    const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            setEditingCell(null); // Discard changes
        }
        // For input, Enter saves. For textarea, only Ctrl/Meta+Enter saves.
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
    
    const handleCellDoubleClick = (rowIndex: number, colIndex: number) => {
        const col = columns[colIndex];
        if (col.type !== 'custom_date' && col.key !== 'commissionGroup') {
            setEditingCell({ rowIndex, colIndex });
        } else if (col.type === 'custom_date') {
             setEditingCell({ rowIndex, colIndex });
        }
    };

     // Keyboard controls: Copy, Paste, Delete
    useEffect(() => {
        const handleCopy = async () => {
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
                                    rowData.push(`${act.workStartDate || ''} - ${act.workEndDate || ''}`);
                                } else if (col.key === 'commissionGroup') {
                                    const group = groups.find(g => g.id === act.commissionGroupId);
                                    rowData.push(group ? group.name : '');
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
                if (err instanceof DOMException && err.name === 'NotAllowedError') {
                    alert("Копирование не удалось. Пожалуйста, предоставьте разрешение на доступ к буферу обмена в настройках вашего браузера.");
                } else {
                    alert("Не удалось скопировать данные в буфер обмена.");
                }
            }
        };

        const handlePaste = async () => {
            if (!activeCell) return;
    
            try {
                if (!document.hasFocus()) {
                    tableContainerRef.current?.focus();
                }

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
                            const start = parts[0] || '';
                            const end = parts.length > 1 ? (parts[1] || start) : start;
                            updatedAct.workStartDate = start;
                            updatedAct.workEndDate = end;
                        } else if (col.key === 'commissionGroup') {
                            const group = groups.find(g => g.name.toLowerCase() === cellData.toLowerCase().trim());
                            if(group) {
                                // This is complex, we need to apply the group logic.
                                // For now, let's just set the ID, a full paste logic would need handleGroupChange logic.
                                updatedAct.commissionGroupId = group.id;
                            }
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
                
                // Expand selection to pasted area
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
                 if (err instanceof DOMException && err.name === 'NotAllowedError') {
                    alert("Вставка не удалась. Пожалуйста, предоставьте разрешение на доступ к буферу обмена в настройках вашего браузера.");
                } else {
                    alert("Не удалось вставить данные из буфера обмена. Возможно, формат данных не поддерживается.");
                }
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (editingCell || (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'SELECT') {
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const isCtrlKey = isMac ? e.metaKey : e.ctrlKey;

            // Handle Delete
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCells.size > 0) {
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
            
            // Handle Copy - use e.code for layout-independent key presses
            if (e.code === 'KeyC' && isCtrlKey) {
                 e.preventDefault();
                 handleCopy();
            }
            
            // Handle Paste - use e.code for layout-independent key presses
            if (e.code === 'KeyV' && isCtrlKey) {
                e.preventDefault();
                handlePaste();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectedCells, activeCell, editingCell, acts, columns, groups, handleSaveWithTemplateResolution]);


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
    
    // Fill handle drag logic
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

                if (coords.rowIndex > maxRow) { // Dragging down
                     fillArea = { start: {rowIndex: maxRow + 1, colIndex: minCol}, end: {rowIndex: coords.rowIndex, colIndex: maxCol} };
                } else if (coords.rowIndex < minRow) { // Dragging up
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

            const { minRow: selMinRow, maxRow: selMaxRow, minCol: selMinCol, maxCol: selMaxCol } = selectionBounds;
            const patternHeight = selMaxRow - selMinRow + 1;
            
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

                for (let c = selMinCol; c <= selMaxCol; c++) {
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
                         // handleGroupChange already saves, so we need to be careful
                         // Let's modify the object directly and save at the end
                         const group = groups.find(g => g.id === sourceAct.commissionGroupId);
                         if (group) {
                            updatedAct.commissionGroupId = group.id;
                            // Re-implement simplified logic here to avoid multiple saves
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

    const handleGenerate = (act: Act) => {
        if (!template) {
            alert('Шаблон не загружен.');
            return;
        }
        generateDocument(template, act, people);
    };

    const isSelectionContiguous = useMemo((): boolean => {
        if (selectedCells.size === 0) return false;
        
        const coordsList = Array.from(selectedCells).map(id => {
            const [rowIndex, colIndex] = id.split(':').map(Number);
            return { rowIndex, colIndex };
        });
        
        const minRow = Math.min(...coordsList.map(c => c.rowIndex));
        const maxRow = Math.max(...coordsList.map(c => c.rowIndex));
        const minCol = Math.min(...coordsList.map(c => c.colIndex));
        const maxCol = Math.max(...coordsList.map(c => c.colIndex));
        
        const expectedSize = (maxRow - minRow + 1) * (maxCol - minCol + 1);
        return selectedCells.size === expectedSize;
    }, [selectedCells]);


    const FillHandle: React.FC<{ onMouseDown: (e: React.MouseEvent) => void }> = ({ onMouseDown }) => (
        <div
            onMouseDown={onMouseDown}
            className="absolute w-2.5 h-2.5 bg-blue-600 cursor-crosshair z-50 border border-white"
            style={{ bottom: '-5px', right: '-5px' }}
            title="Протянуть для копирования"
        />
    );


    return (
        <div ref={tableContainerRef} tabIndex={-1} className="h-full overflow-auto border border-slate-200 rounded-lg select-none focus:outline-none">
            <style>{`
                @keyframes pulse-green-bg {
                    0% { background-color: #dcfce7; }
                    50% { background-color: #bbf7d0; }
                    100% { background-color: #dcfce7; }
                }
                .copied-cell-bg {
                    animation: pulse-green-bg 2s ease-in-out infinite;
                }
            `}</style>
            <table className="text-sm table-fixed" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead className="bg-slate-50 sticky top-0 z-30">
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
                        <th className="px-4 py-3 text-right font-medium text-slate-500 uppercase tracking-wider sticky right-0 bg-slate-50 z-30 w-36">Действия</th>
                    </tr>
                </thead>
                <tbody className="bg-white">
                    {acts.map((act, rowIndex) => (
                        <tr key={act.id} data-actid={act.id} className="hover:bg-slate-50">
                            {columns.map((col, colIndex) => {
                                const cellId = getCellId(rowIndex, colIndex);
                                const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
                                
                                const isSelected = selectedCells.has(cellId);
                                const isCopied = copiedCells?.has(cellId) ?? false;
                                const isFillTarget = fillTargetArea ? normalizeSelection(fillTargetArea.start, fillTargetArea.end).minRow <= rowIndex && rowIndex <= normalizeSelection(fillTargetArea.start, fillTargetArea.end).maxRow && normalizeSelection(fillTargetArea.start, fillTargetArea.end).minCol <= colIndex && colIndex <= normalizeSelection(fillTargetArea.start, fillTargetArea.end).maxCol : false;
                                
                                let cellClassName = "px-0 py-0 align-top";
                                if (isFillTarget) {
                                    cellClassName += " bg-green-100";
                                } else if (isCopied) {
                                    cellClassName += " copied-cell-bg"; // Animation class for copied cells
                                } else if (isSelected) {
                                    cellClassName += " bg-blue-100";
                                }

                                const cellStyle: React.CSSProperties = { 
                                    position: 'relative',
                                    borderBottom: '1px solid #e2e8f0', // Default grid lines
                                    borderRight: '1px solid #e2e8f0',
                                };

                                if (isSelected || isCopied) {
                                    const borderSet = isCopied ? copiedCells : selectedCells;
                                    const color = isCopied ? '#16a34a' : '#2563eb'; // Green for copied, blue for selected
                                    const width = '2px';
                                    const shadows = [];

                                    const hasTop = !borderSet.has(getCellId(rowIndex - 1, colIndex));
                                    const hasBottom = !borderSet.has(getCellId(rowIndex + 1, colIndex));
                                    const hasLeft = !borderSet.has(getCellId(rowIndex, colIndex - 1));
                                    const hasRight = !borderSet.has(getCellId(rowIndex, colIndex + 1));

                                    if (hasTop) shadows.push(`inset 0 ${width} 0 0 ${color}`);
                                    if (hasBottom) shadows.push(`inset 0 -${width} 0 0 ${color}`);
                                    if (hasLeft) shadows.push(`inset ${width} 0 0 0 ${color}`);
                                    if (hasRight) shadows.push(`inset -${width} 0 0 0 ${color}`);
                                    
                                    if (shadows.length > 0) {
                                        cellStyle.boxShadow = shadows.join(', ');
                                    }
                                }

                                const handleFillMouseDown = (e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setIsFilling(true);
                                };
                                
                                const selectionBounds = isSelectionContiguous ? normalizeSelection(
                                    {rowIndex: Math.min(...Array.from(selectedCells).map(id => parseInt(id.split(':')[0],10))), colIndex: Math.min(...Array.from(selectedCells).map(id => parseInt(id.split(':')[1],10)))},
                                    {rowIndex: Math.max(...Array.from(selectedCells).map(id => parseInt(id.split(':')[0],10))), colIndex: Math.max(...Array.from(selectedCells).map(id => parseInt(id.split(':')[1],10)))}
                                ) : null;

                                const shouldHaveFillHandle = isSelectionContiguous && selectionBounds && rowIndex === selectionBounds.maxRow && colIndex === selectionBounds.maxCol;

                                let displayContent;
                                let editorContent = null;
                                let cellPaddingClass = 'p-2';
                                
                                if (col.key === 'commissionGroup') {
                                    cellPaddingClass = 'p-1';
                                    displayContent = (
                                        <select
                                            value={act.commissionGroupId || ''}
                                            onChange={(e) => handleGroupChange(act, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onDoubleClick={(e) => e.stopPropagation()}
                                            className="w-full h-full p-1 border-transparent rounded text-sm bg-transparent focus:ring-blue-500 focus:border-blue-500 focus:bg-white focus:shadow"
                                        >
                                            <option value="">-- Не выбрано --</option>
                                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                        </select>
                                    );
                                } else if (col.type === 'custom_date') {
                                    displayContent = (
                                        (act.workStartDate || act.workEndDate)
                                            ? `${act.workStartDate || '...'} - ${act.workEndDate || '...'}`
                                            : <span className="text-slate-400">...</span>
                                    );
                                    if (isEditing) {
                                        editorContent = (
                                            <DateCellEditor
                                                act={act}
                                                onSave={handleSaveWithTemplateResolution}
                                                onClose={() => setEditingCell(null)}
                                            />
                                        );
                                    }
                                } else {
                                     const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'id' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates' | 'commissionGroup'>;
                                    displayContent = act[columnKey] || <span className="text-slate-400">...</span>;
                                    if (isEditing) {
                                        if (col.type === 'textarea') {
                                            editorContent = (
                                                <textarea
                                                    ref={editorRef as React.RefObject<HTMLTextAreaElement>}
                                                    value={editorValue}
                                                    onChange={handleEditorChange}
                                                    onBlur={handleEditorSaveAndClose}
                                                    onKeyDown={handleEditorKeyDown}
                                                    className="absolute top-0 left-0 w-full p-2 ring-2 ring-blue-500 rounded-md resize-none focus:outline-none z-10 overflow-hidden"
                                                    style={{ minHeight: '100%' }}
                                                />
                                            );
                                        } else {
                                            editorContent = (
                                                <input
                                                    ref={editorRef as React.RefObject<HTMLInputElement>}
                                                    type={col.type}
                                                    value={editorValue}
                                                    onChange={handleEditorChange}
                                                    onBlur={handleEditorSaveAndClose}
                                                    onKeyDown={handleEditorKeyDown}
                                                    className="absolute top-0 left-0 w-full h-full p-2 ring-2 ring-blue-500 rounded-md focus:outline-none z-10"
                                                />
                                            );
                                        }
                                    }
                                }

                                return (
                                    <td
                                        key={col.key}
                                        data-row-index={rowIndex}
                                        data-col-index={colIndex}
                                        onMouseDown={(e) => handleCellMouseDown(e, rowIndex, colIndex)}
                                        onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                                        className={cellClassName}
                                        style={cellStyle}
                                    >
                                        <div className={`w-full min-h-[2.5rem] h-full ${cellPaddingClass} whitespace-pre-wrap break-words flex items-center`}>
                                            {displayContent}
                                        </div>
                                        
                                        {editorContent}

                                        {shouldHaveFillHandle && <FillHandle onMouseDown={handleFillMouseDown} />}
                                    </td>
                                );
                            })}
                            <td className="px-4 py-2 whitespace-nowrap text-right font-medium align-middle sticky right-0 bg-white z-20 w-36">
                                <div className="flex justify-end space-x-1">
                                    <button onClick={() => handleGenerate(act)} className="p-2 text-green-600 hover:bg-green-100 rounded-full" title="Скачать .docx"><DownloadIcon /></button>
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
        </div>
    );
};

export default ActsTable;