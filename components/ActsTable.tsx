import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Act, Person, Organization, ProjectSettings, ROLES, CommissionGroup, Page } from '../types';
import CustomSelect from './CustomSelect';
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
    setCurrentPage: (page: Page) => void;
    selectedActIds: Set<string>;
    setSelectedActIds: React.Dispatch<React.SetStateAction<Set<string>>>;
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
    }, [startDate, endDate, act, onSave, onClose]);

    const handleSave = useCallback(() => {
        if (act.workStartDate !== startDate || act.workEndDate !== endDate) {
            onSave({ ...act, workStartDate: startDate, workEndDate: endDate });
        }
        onClose();
    }, [act, startDate, endDate, onSave, onClose]);

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
const ActsTable: React.FC<ActsTableProps> = ({ acts, people, organizations, groups, template, settings, visibleColumns, onSave, setCurrentPage, selectedActIds, setSelectedActIds }) => {
    const [editingCell, setEditingCell] = useState<Coords | null>(null);
    const [editorValue, setEditorValue] = useState('');
    const [activeCell, setActiveCell] = useState<Coords | null>(null);
    const [isFilling, setIsFilling] = useState(false);
    const [fillTargetArea, setFillTargetArea] = useState<{ start: Coords, end: Coords } | null>(null);
    
    // Row selection states
    const [lastSelectedRowIndex, setLastSelectedRowIndex] = useState<number | null>(null);
    const [isRowDragSelecting, setIsRowDragSelecting] = useState(false);

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

    const handleSaveWithTemplateResolution = useCallback((actToSave: Act) => {
        const resolvedAct = { ...actToSave };

        const resolve = (templateStr: string, contextAct: Act) => {
            if (!templateStr || typeof templateStr !== 'string') return templateStr;
            return templateStr.replace(/\{(\w+)\}/g, (_, key) => {
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
        
        const dateTemplate = settings.defaultActDate !== undefined ? settings.defaultActDate : '{workEndDate}';
        resolvedAct.date = resolve(dateTemplate, context);

        onSave(resolvedAct);
    }, [onSave, settings]);
    
    const getOrgDetailsString = useCallback((org: Organization): string => {
        return `${org.name}, ИНН ${org.inn}, ОГРН ${org.ogrn}, ${org.address}`;
    }, []);

    const handleGroupChange = useCallback((act: Act, groupId: string) => {
        const selectedGroup = groups.find(g => g.id === groupId);
        const orgMap = new Map(organizations.map(org => [org.id, org]));
        
        const updatedAct = { ...act, commissionGroupId: groupId || undefined };

        if (selectedGroup) {
            updatedAct.representatives = { ...selectedGroup.representatives };
            updatedAct.builderOrgId = selectedGroup.builderOrgId;
            updatedAct.contractorOrgId = selectedGroup.contractorOrgId;
            updatedAct.designerOrgId = selectedGroup.designerOrgId;
            updatedAct.workPerformerOrgId = selectedGroup.workPerformerOrgId;

            updatedAct.builderDetails = selectedGroup.builderOrgId && orgMap.get(selectedGroup.builderOrgId) 
                ? getOrgDetailsString(orgMap.get(selectedGroup.builderOrgId)!) : '';
            updatedAct.contractorDetails = selectedGroup.contractorOrgId && orgMap.get(selectedGroup.contractorOrgId) 
                ? getOrgDetailsString(orgMap.get(selectedGroup.contractorOrgId)!) : '';
            updatedAct.designerDetails = selectedGroup.designerOrgId && orgMap.get(selectedGroup.designerOrgId) 
                ? getOrgDetailsString(orgMap.get(selectedGroup.designerOrgId)!) : '';
            updatedAct.workPerformer = selectedGroup.workPerformerOrgId && orgMap.get(selectedGroup.workPerformerOrgId) 
                ? getOrgDetailsString(orgMap.get(selectedGroup.workPerformerOrgId)!) : '';
        }

        handleSaveWithTemplateResolution(updatedAct);
    }, [groups, organizations, getOrgDetailsString, handleSaveWithTemplateResolution]);

    const handleCreateNewGroup = () => {
        setCurrentPage('groups');
    };

    useEffect(() => {
        if (editingCell && editorRef.current) {
            const { rowIndex, colIndex } = editingCell;
            const act = acts[rowIndex];
            const col = columns[colIndex];
            const columnKey = col.key as keyof Act;
            const initialValue = act[columnKey] as string || '';
            setEditorValue(initialValue);
            
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
        if (e.target instanceof HTMLTextAreaElement) {
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
        }
    };
    
    const handleEditorSaveAndClose = useCallback(() => {
        if (!editingCell) return;
        const { rowIndex, colIndex } = editingCell;
        const act = acts[rowIndex];
        const col = columns[colIndex];
        const columnKey = col.key as keyof Act;
        
        const currentValue = act[columnKey] as string || '';
        if (currentValue !== editorValue) {
            handleSaveWithTemplateResolution({ ...act, [columnKey]: editorValue });
        }
        setEditingCell(null);
    }, [editingCell, acts, columns, editorValue, handleSaveWithTemplateResolution]);
    
    const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            setEditingCell(null);
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            if (e.currentTarget instanceof HTMLInputElement || (e.currentTarget instanceof HTMLTextAreaElement && (e.ctrlKey || e.metaKey))) {
                e.preventDefault();
                handleEditorSaveAndClose();
            }
        }
    };

    const handleCellDoubleClick = (rowIndex: number, colIndex: number) => {
        const col = columns[colIndex];
        if (col.type !== 'custom_date' && col.key !== 'commissionGroup') {
            setEditingCell({ rowIndex, colIndex });
            setActiveCell({ rowIndex, colIndex });
        } else if (col.type === 'custom_date') {
             setEditingCell({ rowIndex, colIndex });
             setActiveCell({ rowIndex, colIndex });
        }
    };
    
    const handleRowSelectionMouseDown = (e: React.MouseEvent, rowIndex: number, actId: string) => {
        e.preventDefault();
        setActiveCell(null); // Focus is on the row, not a cell
        
        const isShift = e.shiftKey;
        const isCtrl = e.ctrlKey || e.metaKey;

        if (isShift && lastSelectedRowIndex !== null) {
            const start = Math.min(lastSelectedRowIndex, rowIndex);
            const end = Math.max(lastSelectedRowIndex, rowIndex);
            const rangeIds = acts.slice(start, end + 1).map(a => a.id);
            const newSelection = new Set(selectedActIds);
            rangeIds.forEach(id => newSelection.add(id));
            setSelectedActIds(newSelection);
        } else if (isCtrl) {
            const newSelection = new Set(selectedActIds);
            if (newSelection.has(actId)) {
                newSelection.delete(actId);
            } else {
                newSelection.add(actId);
            }
            setSelectedActIds(newSelection);
            setLastSelectedRowIndex(rowIndex);
        } else {
             const isCurrentlySelected = selectedActIds.has(actId);
            if (isCurrentlySelected && selectedActIds.size === 1) {
                // It's the only selected row, so deselect it.
                setSelectedActIds(new Set());
            } else {
                // Otherwise, select just this one row.
                setSelectedActIds(new Set([actId]));
            }
            setLastSelectedRowIndex(rowIndex);
            setIsRowDragSelecting(true);
        }
    };
    
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isRowDragSelecting || lastSelectedRowIndex === null) return;
            const target = e.target as HTMLElement;
            const row = target.closest('tr');
            if (row && row.dataset.rowIndex) {
                const currentIndex = parseInt(row.dataset.rowIndex, 10);
                const start = Math.min(lastSelectedRowIndex, currentIndex);
                const end = Math.max(lastSelectedRowIndex, currentIndex);
                const rangeIds = new Set(acts.slice(start, end + 1).map(a => a.id));
                setSelectedActIds(rangeIds);
            }
        };

        const handleMouseUp = () => {
            setIsRowDragSelecting(false);
        };

        if (isRowDragSelecting) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp, { once: true });
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isRowDragSelecting, lastSelectedRowIndex, acts, setSelectedActIds]);


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

    return (
        <div className="h-full overflow-auto border border-slate-200 rounded-md relative" ref={tableContainerRef} tabIndex={-1}>
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
                    {acts.map((act, rowIndex) => (
                        <tr key={act.id} data-row-index={rowIndex} className={selectedActIds.has(act.id) ? 'bg-blue-50' : ''}>
                           <td 
                                className="sticky left-0 p-2 w-12 min-w-[3rem] z-10 border-r border-b border-slate-200 cursor-pointer"
                                style={{ backgroundColor: selectedActIds.has(act.id) ? '#eff6ff' : '#ffffff' }}
                                onMouseDown={(e) => handleRowSelectionMouseDown(e, rowIndex, act.id)}
                            >
                                <div className="flex items-center justify-center">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 form-checkbox-custom"
                                        checked={selectedActIds.has(act.id)}
                                        readOnly
                                    />
                                </div>
                            </td>
                            {columns.map((col, colIndex) => {
                                const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
                                const isActive = activeCell?.rowIndex === rowIndex && activeCell?.colIndex === colIndex;
                                const cellId = `${rowIndex}:${colIndex}`;

                                const cellClass = [
                                    "p-0 border-b border-slate-200 relative",
                                    colIndex < columns.length -1 ? 'border-r' : '',
                                    isActive ? 'outline outline-2 outline-blue-500 outline-offset-[-2px]' : '',
                                ].filter(Boolean).join(' ');

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
                                                buttonClassName="w-full h-full text-left bg-transparent border-none shadow-none py-2 px-3 focus:outline-none focus:ring-0 text-slate-900 flex justify-between items-center"
                                                dropdownClassName="absolute z-50 mt-1 w-auto min-w-full bg-white shadow-lg rounded-md border border-slate-200 max-h-60"
                                                onCreateNew={handleCreateNewGroup}
                                                onCreateNewText="Создать группу"
                                            />
                                        );
                                    } else {
                                        const key = col.key as keyof Act;
                                        cellContent = act[key] as string || '';
                                    }
                                }
                                
                                return (
                                    <td 
                                        key={col.key}
                                        className={cellClass}
                                        onClick={() => setActiveCell({ rowIndex, colIndex })}
                                        onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                                    >
                                        <div className="px-2 py-1.5 h-full w-full whitespace-pre-wrap leading-snug">
                                             {cellContent}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ActsTable;