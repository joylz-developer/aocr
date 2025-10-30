import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Act, Person, Organization, ProjectSettings, ROLES, CommissionGroup, Page } from '../types';
import { DeleteIcon, DownloadIcon } from './Icons';
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
const ActsTable: React.FC<ActsTableProps> = ({ acts, people, organizations, groups, template, settings, visibleColumns, onSave, onDelete, setCurrentPage }) => {
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

    const groupOptions = useMemo(() => {
        return groups.map(g => ({ value: g.id, label: g.name }));
    }, [groups]);
    
    const handleCreateNewGroup = () => {
        setCurrentPage('groups');
    };

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
        // Prevent text selection on double click
        if (e.detail > 1) {
            e.preventDefault();
        }

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
        if (window.getSelection) {
            window.getSelection()?.removeAllRanges();
        }
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

            if (e.key === 'Escape') {
                e.preventDefault();
                setSelectedCells(new Set());
                setActiveCell(null);
                setCopiedCells(null);
                tableContainerRef.current?.blur();
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

            const { minRow: selMinRow, maxRow: selMaxRow } = selectionBounds;
            const patternHeight = selMaxRow - selMinRow + 1;
            
             // Get all unique column indices from the selection, sorted
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
                     // This check is important for patterns with holes
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

    const fillHandleCell = useMemo(() => {
        if (selectedCells.size === 0) return null;

        let maxRow = -1;
        let maxColInMaxRow = -1;

        for (const cellId of selectedCells) {
            const [r, c] = cellId.split(':').map(Number);
            if (r > maxRow) {
                maxRow = r;
                maxColInMaxRow = c;
            } else if (r === maxRow) {
                if (c > maxColInMaxRow) {
                    maxColInMaxRow = c;
                }
            }
        }
        
        if (maxRow === -1) return null;

        return { rowIndex: maxRow, colIndex: maxColInMaxRow };

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


    return (
        <div className="h-full overflow-auto border border-slate-200 rounded-md relative focus:outline-none" ref={tableContainerRef} tabIndex={-1}>
            <table className="min-w-full text-sm border-separate border-spacing-0">
                <thead className="sticky top-0 bg-slate-50 z-20 shadow-sm">
                    <tr>
                        <th className="sticky left-0 bg-slate-50 p-0 w-16 min-w-[4rem] z-30 border-r border-b border-slate-200">
                             <div className="w-full h-full flex items-center justify-center text-xs font-medium text-slate-500 uppercase tracking-wider">Действия</div>
                        </th>
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
                    {acts.map((act, rowIndex) => (
                        <tr key={act.id}>
                            <td className="sticky left-0 bg-white p-2 w-16 min-w-[4rem] z-10 border-r border-b border-slate-200">
                                <div className="flex items-center justify-center space-x-1">
                                    <button onClick={() => handleGenerate(act)} className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-full" title="Скачать .docx"><DownloadIcon /></button>
                                    <button onClick={() => onDelete(act.id)} className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full" title="Удалить акт"><DeleteIcon /></button>
                                </div>
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
                                if (isFillTarget) {
                                    cellClassParts.push('bg-blue-200');
                                } else if (isSelected) {
                                    cellClassParts.push('bg-blue-100');
                                } else {
                                    cellClassParts.push('bg-white');
                                }
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
                                    if(col.type === 'custom_date') {
                                        cellContent = <DateCellEditor act={act} onSave={handleSaveWithTemplateResolution} onClose={() => setEditingCell(null)} />
                                    } else {
                                        const EditorComponent = col.type === 'textarea' ? 'textarea' : 'input';
                                        cellContent = (
                                            <EditorComponent
                                                ref={editorRef as any}
                                                value={editorValue}
                                                onChange={handleEditorChange}
                                                onBlur={handleEditorSaveAndClose}
                                                onKeyDown={handleEditorKeyDown}
                                                type={col.type === 'date' ? 'date' : 'text'}
                                                className={`absolute inset-0 w-full h-full p-2 border-2 border-blue-500 rounded-md z-30 resize-none text-sm outline-none`}
                                                onClick={e => e.stopPropagation()}
                                            />
                                        );
                                    }
                                } else {
                                    if(col.key === 'workDates') {
                                         cellContent = `${act.workStartDate || '...'} - ${act.workEndDate || '...'}`;
                                    } else if (col.key === 'commissionGroup') {
                                        cellContent = (
                                            <CustomSelect 
                                                options={groupOptions} 
                                                value={act.commissionGroupId || ''}
                                                onChange={(value) => handleGroupChange(act, value)}
                                                placeholder="-- Выберите группу --"
                                                onCreateNew={handleCreateNewGroup}
                                                buttonClassName="w-full h-full text-left bg-transparent border-none shadow-none py-2 px-3 focus:outline-none focus:ring-0 text-slate-900 flex justify-between items-center"
                                                dropdownClassName="absolute z-50 mt-1 w-auto min-w-full bg-white shadow-lg rounded-md border border-slate-200 max-h-60"
                                            />
                                        );
                                    } else {
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
                                        onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                                        onContextMenu={(e) => e.preventDefault()}
                                    >
                                        <div className="disable-cell-text-selection px-2 py-1.5 h-full w-full whitespace-pre-wrap leading-snug relative">
                                             {cellContent}
                                        </div>
                                        {borderDivs}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
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
    );
};

export default ActsTable;