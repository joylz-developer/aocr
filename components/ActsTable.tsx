import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { Act, Person, Organization, ProjectSettings, ROLES, CommissionGroup, Page, Coords, Regulation, Certificate, ExecutiveScheme } from '../types';
import Modal from './Modal';
import { DeleteIcon, CalendarIcon, LinkIcon, EditIcon, CopyIcon, PasteIcon, SparklesIcon, RowAboveIcon, RowBelowIcon, BookIcon, CloseIcon, GripVerticalIcon, DownloadIcon, QuestionMarkCircleIcon, ArrowDownCircleIcon, PlusIcon, StarIcon } from './Icons';
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
import SchemesInput from './SchemesInput';
import SchemesPopover from './SchemesPopover'; 
import SchemesModal from './SchemesModal'; 

const AUTO_NEXT_ID = 'AUTO_NEXT';
const AUTO_NEXT_LABEL = '⬇️ Следующий по списку (Автоматически)';

const FilterIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
);

interface ActsTableProps {
    acts: Act[];
    people: Person[];
    organizations: Organization[];
    groups: CommissionGroup[];
    regulations: Regulation[];
    certificates?: Certificate[];
    schemes?: ExecutiveScheme[];
    template: string | null;
    registryTemplate: string | null;
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
    onNavigateToScheme?: (id: string) => void; 
}

interface PinnedColumnInfo {
    rowIndexDisplay: number;
    previewText: string;
    payload: any; 
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

const renderTextWithTags = (text: string) => {
    if (typeof text !== 'string') return text;
    const parts = text.split(/(\{[\w_]+\})/g);
    return parts.map((part, i) => {
        if (part.startsWith('{') && part.endsWith('}')) {
            return (
                <span 
                    key={i} 
                    className="bg-pink-100 text-pink-700 px-1 py-0.5 rounded cursor-help font-mono text-[11px] border border-pink-200 mx-0.5 inline-block align-middle shadow-sm [.theme-dark_&]:bg-pink-900/30 [.theme-dark_&]:text-pink-400 [.theme-dark_&]:border-pink-800/50"
                    title={`Переменная шаблона: при выгрузке вместо этого тега подставятся данные (${part})`}
                >
                    {part}
                </span>
            );
        }
        return part;
    });
};

const SingleDateEditorPopover: React.FC<{
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

    const handleDateChange = (value: string) => {
        onActChange({ ...act, date: value });
    };
    
    const addTime = (amount: number, unit: 'day' | 'week' | 'month') => {
        if (!act.date) return;
        const [year, month, day] = act.date.split('-').map(Number);
        const utcDate = new Date(Date.UTC(year, month - 1, day));

        if (unit === 'day') utcDate.setUTCDate(utcDate.getUTCDate() + amount);
        else if (unit === 'week') utcDate.setUTCDate(utcDate.getUTCDate() + amount * 7);
        else if (unit === 'month') utcDate.setUTCMonth(utcDate.getUTCMonth() + amount);
        
        const newDateYYYYMMDD = utcDate.toISOString().split('T')[0];
        handleDateChange(newDateYYYYMMDD);
    };

    const QuickAddButton: React.FC<{ children: React.ReactNode; onClick: () => void }> = ({ children, onClick }) => (
        <button type="button" onClick={onClick} className="px-2 py-1 text-xs bg-slate-200 hover:bg-slate-300 [.theme-dark_&]:bg-slate-700 [.theme-dark_&]:hover:bg-slate-600 [.theme-dark_&]:text-slate-200 rounded transition-colors">
            {children}
        </button>
    );

    const inputClass = "w-full p-1.5 border rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 border-slate-300 [.theme-dark_&]:bg-[#0d1117] [.theme-dark_&]:border-slate-600 [.theme-dark_&]:text-slate-200 [.theme-dark_&]:[color-scheme:dark]";

    return (
        <div 
            ref={containerRef} 
            className="absolute bg-white [.theme-dark_&]:bg-slate-800 p-3 border-2 border-blue-500 rounded-md z-40 flex flex-col gap-3 shadow-lg animate-fade-in-up" 
            style={{ top: position.top, left: position.left, minWidth: '220px' }}
            onMouseDown={e => e.stopPropagation()} 
        >
            <div>
                <label className="text-xs font-medium text-slate-600 [.theme-dark_&]:text-slate-300">Дата акта</label>
                <input
                    type="date"
                    value={act.date || ''}
                    onChange={e => handleDateChange(e.target.value)}
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
        <button type="button" onClick={onClick} className="px-2 py-1 text-xs bg-slate-200 hover:bg-slate-300 [.theme-dark_&]:bg-slate-700 [.theme-dark_&]:hover:bg-slate-600 [.theme-dark_&]:text-slate-200 rounded transition-colors">
            {children}
        </button>
    );

    const inputClass = "w-full p-1.5 border rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 border-slate-300 [.theme-dark_&]:bg-[#0d1117] [.theme-dark_&]:border-slate-600 [.theme-dark_&]:text-slate-200 [.theme-dark_&]:[color-scheme:dark]";

    return (
        <div 
            ref={containerRef} 
            className="absolute bg-white [.theme-dark_&]:bg-slate-800 p-3 border-2 border-blue-500 rounded-md z-40 flex flex-col gap-3 shadow-lg animate-fade-in-up" 
            style={{ top: position.top, left: position.left, minWidth: '220px' }}
            onMouseDown={e => e.stopPropagation()} 
        >
            <div>
                <label className="text-xs font-medium text-slate-600 [.theme-dark_&]:text-slate-300">Начало</label>
                <input
                    type="date"
                    value={act.workStartDate || ''}
                    onChange={e => handleDateChange('workStartDate', e.target.value)}
                    className={inputClass}
                />
            </div>
             <div>
                <label className="text-xs font-medium text-slate-600 [.theme-dark_&]:text-slate-300">Окончание</label>
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
            className="absolute z-50 bg-white [.theme-dark_&]:bg-slate-800 border border-slate-200 [.theme-dark_&]:border-slate-700 shadow-xl rounded-lg p-3 w-72 animate-fade-in-up"
            style={{ top: position.top, left: position.left }}
            onMouseDown={e => e.stopPropagation()} 
        >
            <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-slate-800 [.theme-dark_&]:text-slate-200 text-sm">{regulation.designation}</h4>
                 <span className={`text-[10px] px-1.5 py-0.5 rounded border ${regulation.status.includes('Действует') ? 'bg-green-50 text-green-700 border-green-200 [.theme-dark_&]:bg-green-900/30 [.theme-dark_&]:text-green-400 [.theme-dark_&]:border-green-800/50' : 'bg-red-50 text-red-700 border-red-200 [.theme-dark_&]:bg-red-900/30 [.theme-dark_&]:text-red-400 [.theme-dark_&]:border-red-800/50'}`}>
                    {regulation.status}
                </span>
            </div>
            <p className="text-xs text-slate-600 [.theme-dark_&]:text-slate-400 mb-3 line-clamp-3">{regulation.title}</p>
            <div className="flex justify-between items-center">
                <button 
                    onClick={onOpenDetails} 
                    className="text-xs text-blue-600 [.theme-dark_&]:text-blue-400 hover:text-blue-800 [.theme-dark_&]:hover:text-blue-300 font-medium hover:underline flex items-center gap-1"
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
            className="absolute z-50 bg-white [.theme-dark_&]:bg-slate-800 border border-slate-200 [.theme-dark_&]:border-slate-700 shadow-xl rounded-lg flex flex-col max-h-60 w-80 animate-fade-in-up"
            style={{ top: position.top, left: position.left }}
            onMouseDown={e => e.stopPropagation()}
        >
            <div className="p-2 border-b border-slate-100 [.theme-dark_&]:border-slate-700">
                <input 
                    type="text" 
                    placeholder="Поиск или ввод текста..." 
                    className="w-full text-sm border border-slate-300 [.theme-dark_&]:border-slate-600 bg-white [.theme-dark_&]:bg-[#0d1117] text-slate-900 [.theme-dark_&]:text-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                />
            </div>
            <div className="overflow-y-auto flex-1">
                 <button 
                    className="w-full text-left px-3 py-2 text-sm text-slate-500 [.theme-dark_&]:text-slate-400 hover:bg-slate-50 [.theme-dark_&]:hover:bg-slate-700/50 border-b border-slate-100 [.theme-dark_&]:border-slate-700 italic transition-colors"
                    onClick={() => onSelect(null)}
                >
                    -- Очистить / Нет связи --
                </button>
                
                {searchTerm.trim() && (
                     <button
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 [.theme-dark_&]:text-slate-200 hover:bg-slate-100 [.theme-dark_&]:hover:bg-slate-700/50 border-b border-slate-100 [.theme-dark_&]:border-slate-700 flex items-center gap-2 group transition-colors"
                        onClick={() => onSelect(searchTerm)}
                        title="Использовать введенный текст без привязки"
                    >
                        <EditIcon className="w-4 h-4 text-slate-400 group-hover:text-blue-500"/>
                        <span className="truncate">✍️ Ввести вручную: <span className="font-semibold">"{searchTerm}"</span></span>
                    </button>
                )}

                <button 
                    className="w-full text-left px-3 py-2 text-sm text-blue-700 [.theme-dark_&]:text-blue-400 bg-blue-50 [.theme-dark_&]:bg-blue-900/30 hover:bg-blue-100 [.theme-dark_&]:hover:bg-blue-900/50 border-b border-blue-100 [.theme-dark_&]:border-blue-900/50 font-medium flex items-center gap-2 transition-colors"
                    onClick={() => onSelect(AUTO_NEXT_ID)}
                >
                    <ArrowDownCircleIcon className="w-4 h-4"/> 
                    Следующий по списку (Автоматически)
                </button>
                {filteredActs.length > 0 ? filteredActs.map(act => (
                    <button
                        key={act.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 [.theme-dark_&]:hover:bg-slate-700/50 border-b border-slate-50 [.theme-dark_&]:border-slate-700 last:border-0 transition-colors"
                        onClick={() => onSelect(act)}
                    >
                        <div className="font-medium text-slate-800 [.theme-dark_&]:text-slate-200">Акт №{act.number || 'б/н'}</div>
                        <div className="text-xs text-slate-500 [.theme-dark_&]:text-slate-400 truncate">{act.workName || 'Без названия'}</div>
                    </button>
                )) : (
                     !searchTerm && <div className="px-3 py-4 text-center text-xs text-slate-400">Нет подходящих актов</div>
                )}
            </div>
        </div>
    );
};

const RichHeaderTooltip: React.FC<{ 
    column: typeof ALL_COLUMNS[0], 
    position: { top: number, left: number } | null 
}> = ({ column, position }) => {
    if (!position || !column.description) return null;

    return (
        <div 
            className="fixed z-50 w-80 bg-white [.theme-dark_&]:bg-slate-800 rounded-lg shadow-xl border border-slate-200 [.theme-dark_&]:border-slate-700 p-4 text-left pointer-events-none animate-fade-in-up"
            style={{ 
                top: position.top + 25, 
                left: position.left - 10,
            }}
        >
            <div className="absolute -top-1.5 left-4 w-3 h-3 bg-white [.theme-dark_&]:bg-slate-800 border-t border-l border-slate-200 [.theme-dark_&]:border-slate-700 transform rotate-45"></div>
            <h4 className="font-bold text-slate-800 [.theme-dark_&]:text-slate-200 mb-2 flex items-center gap-2">
                {column.label}
            </h4>
            <p className="text-sm text-slate-600 [.theme-dark_&]:text-slate-400 mb-3 leading-relaxed">
                {column.description}
            </p>
            {column.templateTag && (
                <div className="mb-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Переменная в шаблоне:</span>
                    <code className="text-xs bg-pink-50 [.theme-dark_&]:bg-pink-900/30 text-pink-700 [.theme-dark_&]:text-pink-400 border border-pink-200 [.theme-dark_&]:border-pink-800/50 px-1.5 py-0.5 rounded font-mono">{column.templateTag}</code>
                </div>
            )}
            {column.example && (
                <div className="bg-slate-50 [.theme-dark_&]:bg-[#0d1117] border border-slate-100 [.theme-dark_&]:border-slate-700 rounded p-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Пример заполнения:</span>
                    <code className="text-xs text-blue-700 [.theme-dark_&]:text-blue-400 font-mono break-words">{column.example}</code>
                </div>
            )}
        </div>
    );
};

const resolvePreviewTemplate = (template: string, act: Act): string => {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
        switch(key) {
            case 'act_number': return act.number;
            case 'object_name': return act.objectName;
            case 'work_name': return act.workName;
            case 'project_docs': return act.projectDocs;
            case 'work_start_date': return formatDateForDisplay(act.workStartDate);
            case 'work_end_date': return formatDateForDisplay(act.workEndDate);
            case 'materials': return act.materials;
            case 'materials_raw': return act.materials;
            case 'certs': return act.certs;
            case 'regulations': return act.regulations;
            case 'next_work': return act.nextWork;
            default: return '';
        }
    });
};

const ActsTable: React.FC<ActsTableProps> = ({ acts, people, organizations, groups, regulations, certificates = [], schemes = [], template, registryTemplate, settings, visibleColumns, columnOrder, onColumnOrderChange, activeCell, setActiveCell, selectedCells, setSelectedCells, onSave, onRequestDelete, onReorderActs, setCurrentPage, createNewAct, onNavigateToCertificate, onNavigateToScheme }) => {
    const [editingCell, setEditingCell] = useState<Coords | null>(null);
    const [editorValue, setEditorValue] = useState('');
    const editorValueRef = useRef<string>('');
    const currentEditingCellId = useRef<string | null>(null);

    const [dateError, setDateError] = useState<string | null>(null);
    const [copiedCells, setCopiedCells] = useState<Set<string> | null>(null);
    const [isDraggingSelection, setIsDraggingSelection] = useState(false);
    const [isFilling, setIsFilling] = useState(false);
    const [fillTargetArea, setFillTargetArea] = useState<{ start: Coords, end: Coords } | null>(null);
    
    // Новые стейты для фильтрации
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filters, setFilters] = useState<Record<string, any>>({});
    
    const [pinnedColumns, setPinnedColumns] = useState<Record<string, PinnedColumnInfo>>({});
    const [starPopoverState, setStarPopoverState] = useState<{colKey: string, position: {top: number, left: number}} | null>(null);

    const [datePopoverState, setDatePopoverState] = useState<{ act: Act; position: { top: number, left: number, width: number } } | null>(null);
    const [singleDatePopoverState, setSingleDatePopoverState] = useState<{ act: Act; position: { top: number, left: number, width: number } } | null>(null);

    const [fillHandleCoords, setFillHandleCoords] = useState<{top: number, left: number} | null>(null);

    const [hoveredColIndex, setHoveredColIndex] = useState<number | null>(null);

    const [hoveredHeaderKey, setHoveredHeaderKey] = useState<string | null>(null);
    const [hoveredHeaderPos, setHoveredHeaderPos] = useState<{top: number, left: number} | null>(null);

    const [dragIndicator, setDragIndicator] = useState<{
        type: 'row' | 'col';
        x: number;
        y: number;
        width: number;
        height: number;
    } | null>(null);

    const [draggedRowIndices, setDraggedRowIndices] = useState<number[] | null>(null);
    const [dropTargetRowIndex, setDropTargetRowIndex] = useState<number | null>(null);
    const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null);
    const dragHandlePressedRef = useRef(false);

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
    
    const [regulationPopoverState, setRegulationPopoverState] = useState<{
        regulation: Regulation;
        position: { top: number; left: number };
    } | null>(null);
    
    const [materialPopoverState, setMaterialPopoverState] = useState<{
        certificate: Certificate;
        actId: string;
        position: { top: number; left: number };
    } | null>(null);
    
    const [linkMaterialModalState, setLinkMaterialModalState] = useState<{
        isOpen: boolean;
        actId: string;
        itemIndex: number;
        initialSearch: string;
        editingMaterialTitle?: string;
    } | null>(null);

    const [schemePopoverState, setSchemePopoverState] = useState<{
        scheme: ExecutiveScheme;
        actId: string;
        itemIndex: number;
        position: { top: number; left: number };
    } | null>(null);

    const [linkSchemeModalState, setLinkSchemeModalState] = useState<{
        isOpen: boolean;
        actId: string;
        itemIndex: number;
        initialSearch: string;
        editingSchemeTitle?: string;
    } | null>(null);

    const [fullRegulationDetails, setFullRegulationDetails] = useState<Regulation | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowIndex: number; colIndex: number } | null>(null);
    const [numRowsToAdd, setNumRowsToAdd] = useState(1);
    
    const [dragOverCol, setDragOverCol] = useState<string | null>(null);

    const tableContainerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
    const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);

    const mousePosRef = useRef<{x: number, y: number} | null>(null);
    const autoScrollRaf = useRef<number | null>(null);

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

    // ФИЛЬТРАЦИЯ
    const hasActiveFilters = Object.values(filters).some(val => 
        typeof val === 'string' ? val !== '' : (val.start || val.end)
    );

    const filteredActs = useMemo(() => {
        return acts.filter(act => {
            for (const [key, filterValue] of Object.entries(filters)) {
                if (!filterValue || (typeof filterValue === 'object' && !filterValue.start && !filterValue.end)) continue;
                
                const col = columns.find(c => c.key === key);
                const isDate = col?.type === 'date' || key === 'workDates';

                if (isDate) {
                    const { start, end } = filterValue as { start?: string, end?: string };
                    
                    if (key === 'workDates') {
                        if (start && (!act.workStartDate || act.workStartDate < start)) return false;
                        if (end && (!act.workEndDate || act.workEndDate > end)) return false;
                    } else {
                        const actDate = act[key as keyof Act] as string;
                        if (start && (!actDate || actDate < start)) return false;
                        if (end && (!actDate || actDate > end)) return false;
                    }
                } else {
                    if (typeof filterValue === 'string') {
                        let actValue = '';
                        if (key === 'commissionGroup') {
                            const group = groups.find(g => g.id === act.commissionGroupId);
                            actValue = group ? group.name : '';
                        } else {
                            actValue = String(act[key as keyof Act] || '');
                        }
                        
                        if (!actValue.toLowerCase().includes(filterValue.toLowerCase())) {
                            return false;
                        }
                    }
                }
            }
            return true;
        });
    }, [acts, filters, columns, groups]);

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
        return act; 
    }, [settings]);

    const handleSaveWithTemplateResolution = useCallback((actToSave: Act) => {
        onSave(actToSave);
    }, [onSave]);
    
    const performBulkUpdate = useCallback((modifiedActsMap: Map<string, Act>) => {
        if (modifiedActsMap.size === 0) return;
        let hasChanges = false;
        const finalActs = acts.map(act => {
            if (modifiedActsMap.has(act.id)) {
                const updatedAct = modifiedActsMap.get(act.id)!;
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
    }, [acts, onReorderActs]);

    // ИСПРАВЛЕНИЕ: Динамическая сборка реквизитов организации по шаблону
    const getOrgDetailsString = useCallback((org: Organization, templateType: 'builder' | 'contractor' | 'designer' | 'performer'): string => {
        let template: string[] | undefined;
        if (templateType === 'builder') template = settings.builderDetailsTemplate;
        else if (templateType === 'contractor') template = settings.contractorDetailsTemplate;
        else if (templateType === 'designer') template = settings.designerDetailsTemplate;
        
        // Если шаблон пуст или не настроен, используем стандартный порядок
        const activeTemplate = template && template.length > 0 ? template : ['name', 'inn', 'ogrn', 'address'];

        return activeTemplate.map(key => {
            switch(key) {
                case 'name': return org.name;
                case 'inn': return org.inn ? `ИНН ${org.inn}` : '';
                case 'ogrn': return org.ogrn ? `ОГРН ${org.ogrn}` : '';
                case 'kpp': return org.kpp ? `КПП ${org.kpp}` : '';
                case 'address': return org.address;
                case 'phone': return org.phone ? `тел. ${org.phone}` : '';
                case 'sro': return org.sro ? `СРО: ${org.sro}` : '';
                default: return '';
            }
        }).filter(Boolean).join(', ');
    }, [settings]);

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
            
            // Теперь собираем строки строго по вашим шаблонам
            updatedAct.builderDetails = selectedGroup.builderOrgId && orgMap.has(selectedGroup.builderOrgId) 
                ? getOrgDetailsString(orgMap.get(selectedGroup.builderOrgId)!, 'builder') : '';
            updatedAct.contractorDetails = selectedGroup.contractorOrgId && orgMap.has(selectedGroup.contractorOrgId) 
                ? getOrgDetailsString(orgMap.get(selectedGroup.contractorOrgId)!, 'contractor') : '';
            updatedAct.designerDetails = selectedGroup.designerOrgId && orgMap.has(selectedGroup.designerOrgId) 
                ? getOrgDetailsString(orgMap.get(selectedGroup.designerOrgId)!, 'designer') : '';
            updatedAct.workPerformer = selectedGroup.workPerformerOrgId && orgMap.has(selectedGroup.workPerformerOrgId) 
                ? getOrgDetailsString(orgMap.get(selectedGroup.workPerformerOrgId)!, 'performer') : '';
        }
        handleSaveWithTemplateResolution(updatedAct);
    };

    const closeEditor = useCallback(() => {
        setEditingCell(null);
        setDateError(null);
    }, []);
    
    const handleNativeEditorChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const val = e.target.value;
        setEditorValue(val);
        editorValueRef.current = val;
        setDateError(null);
        if (e.target instanceof HTMLTextAreaElement) {
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
        }
    };

    const handleCustomEditorChange = (newVal: string) => {
        setEditorValue(newVal);
        editorValueRef.current = newVal;
        setDateError(null);
    };

    const handleEditorSave = useCallback(() => {
        if (!editingCell) return true;
        const { rowIndex, colIndex } = editingCell;
        const act = acts[rowIndex];
        const col = columns[colIndex];
        const updatedAct = { ...act };
        const currentValue = editorValueRef.current; 
        
        if (col.key === 'workDates') {
            const parts = currentValue.split('-').map(s => s.trim());
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
            (updatedAct as any)[columnKey] = currentValue;
            if (col.key === 'nextWork') {
                updatedAct.nextWork = currentValue;
                if (act.nextWorkActId === AUTO_NEXT_ID) { updatedAct.nextWorkActId = undefined; } else { updatedAct.nextWorkActId = undefined; }
            }
        }
        if (JSON.stringify(updatedAct) !== JSON.stringify(act)) {
            handleSaveWithTemplateResolution(updatedAct);
        }
        return true; 
    }, [acts, columns, editingCell, handleSaveWithTemplateResolution]);

    useEffect(() => {
        if (!editingCell) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (datePopoverState || singleDatePopoverState || regulationsModalOpen || regulationPopoverState || materialPopoverState || starPopoverState || schemePopoverState || linkSchemeModalState) return;
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
    }, [editingCell, datePopoverState, singleDatePopoverState, handleEditorSave, closeEditor, regulationsModalOpen, regulationPopoverState, materialPopoverState, starPopoverState, schemePopoverState, linkSchemeModalState]);

    useEffect(() => {
        const cellId = editingCell ? `${editingCell.rowIndex}:${editingCell.colIndex}` : null;
        if (cellId && cellId !== currentEditingCellId.current) {
            currentEditingCellId.current = cellId;
            const { rowIndex, colIndex } = editingCell!;
            const act = acts[rowIndex];
            const col = columns[colIndex];
            let initialValue;
            
            if (col.key === 'workDates') {
                const start = formatDateForDisplay(act.workStartDate);
                const end = formatDateForDisplay(act.workEndDate);
                initialValue = (start && end && start !== end) ? `${start} - ${end}` : (start || '');
            } else if (col.type === 'date') {
                const columnKey = col.key as keyof Act;
                initialValue = act[columnKey] as string || '';
            } else if (col.key === 'regulations') {
                initialValue = act.regulations || '';
            } else if (col.key === 'materials') {
                initialValue = act.materials || '';
            } else if (col.key === 'certs') {
                initialValue = act.certs || '';
            } else if (col.key === 'nextWork' && act.nextWorkActId === AUTO_NEXT_ID) {
                const nextAct = acts[rowIndex + 1];
                initialValue = nextAct ? `Работы по акту №${nextAct.number || 'б/н'} (${nextAct.workName || '...'})` : '';
            } else {
                const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates' | 'nextWorkActId'>;
                initialValue = act[columnKey] || '';
            }
            
            const stringVal = String(initialValue);
            setEditorValue(stringVal);
            editorValueRef.current = stringVal;

            setTimeout(() => {
                if (col.key !== 'regulations' && col.key !== 'materials' && col.key !== 'certs') { if (editorRef.current) editorRef.current.focus(); }
                if (editorRef.current instanceof HTMLTextAreaElement) {
                    const el = editorRef.current;
                    el.value = stringVal; 
                    el.style.height = 'auto';
                    el.style.height = `${el.scrollHeight}px`;
                    el.selectionStart = el.selectionEnd = el.value.length;
                } else if (editorRef.current instanceof HTMLInputElement) {
                    editorRef.current.value = stringVal;
                    if(col.type !== 'date') editorRef.current.select();
                }
            }, 0);
        } else if (!cellId) {
            currentEditingCellId.current = null;
        }
    }, [editingCell, acts, columns]); 
    
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
    
    const handleRegulationsSelect = (selectedRegs: Regulation[]) => {
        if (!editingCell) return;
        const newText = selectedRegs.map(reg => reg.designation).join('; ');
        const currentVal = editorValueRef.current;
        const newVal = currentVal ? (currentVal.trim().endsWith(';') ? currentVal + ' ' + newText : currentVal + '; ' + newText) : newText;
        handleCustomEditorChange(newVal);
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
        const match = text.match(/№\s*([^\s,)]+)/);
        if (match) {
            const certNum = match[1];
            return certificates?.find(c => c.number.includes(certNum));
        }
        return null;
    };

    const handleShowMaterialInfo = (text: string, target: HTMLElement, actId: string) => {
        const cert = findCertByText(text);
        if (cert) {
            const coords = getRelativeCoords(target);
            setMaterialPopoverState({ 
                certificate: cert, 
                actId: actId,
                position: { top: coords.top, left: coords.left } 
            });
        }
    };

    const findSchemeByText = (text: string) => {
        if (!schemes) return null;
        return schemes.find(s => text.includes(`№ ${s.number}`) || text.includes(`№${s.number}`) || text.includes(s.name));
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

    const handleCellMouseDown = (e: React.MouseEvent<HTMLTableCellElement>, absoluteRowIndex: number, colIndex: number) => {
        tableContainerRef.current?.focus({ preventScroll: true });
        setContextMenu(null); 
        if (e.detail > 1) e.preventDefault();
        setCopiedCells(null);
        setDatePopoverState(null);
        setSingleDatePopoverState(null);
        setRegulationPopoverState(null);
        setMaterialPopoverState(null);
        setNextWorkPopoverState(null);
        setStarPopoverState(null);
        setSchemePopoverState(null);
        if (e.button === 2) {
             const cellId = getCellId(absoluteRowIndex, colIndex);
             if (selectedCells.has(cellId)) return;
        }
        const cellId = getCellId(absoluteRowIndex, colIndex);
        if (e.shiftKey && activeCell) {
            // Для shift-выделения находим видимые индексы
            const startVisualRow = filteredActs.findIndex(a => a.id === acts[activeCell.rowIndex]?.id);
            const endVisualRow = filteredActs.findIndex(a => a.id === acts[absoluteRowIndex]?.id);
            
            if (startVisualRow !== -1 && endVisualRow !== -1) {
                const minV = Math.min(startVisualRow, endVisualRow);
                const maxV = Math.max(startVisualRow, endVisualRow);
                const minCol = Math.min(activeCell.colIndex, colIndex);
                const maxCol = Math.max(activeCell.colIndex, colIndex);

                const selection = new Set<string>();
                for (let v = minV; v <= maxV; v++) {
                    const absRow = acts.findIndex(a => a.id === filteredActs[v].id);
                    for (let c = minCol; c <= maxCol; c++) {
                        selection.add(getCellId(absRow, c));
                    }
                }
                setSelectedCells(selection);
            }
        } else if (e.ctrlKey || e.metaKey) {
            const newSelectedCells = new Set(selectedCells);
            if (newSelectedCells.has(cellId)) { newSelectedCells.delete(cellId); } else { newSelectedCells.add(cellId); }
            setSelectedCells(newSelectedCells);
            setActiveCell({ rowIndex: absoluteRowIndex, colIndex });
        } else {
            setSelectedCells(new Set([cellId]));
            setActiveCell({ rowIndex: absoluteRowIndex, colIndex });
            setIsDraggingSelection(true);
        }
    };
    
    const handleRowHeaderMouseDown = (e: React.MouseEvent, absoluteRowIndex: number) => {
        dragHandlePressedRef.current = true;
        tableContainerRef.current?.focus({ preventScroll: true });
        const isRowSelected = selectedRows.has(absoluteRowIndex);
        if (e.button === 2) { if (isRowSelected) return; }
        if (e.button === 0 && isRowSelected && !e.ctrlKey && !e.metaKey && !e.shiftKey) { return; }
        
        const newSelectedCells = new Set<string>();
        for (let c = 0; c < columns.length; c++) { newSelectedCells.add(getCellId(absoluteRowIndex, c)); }
        
        if (e.shiftKey && activeCell) {
            const startVisualRow = filteredActs.findIndex(a => a.id === acts[activeCell.rowIndex]?.id);
            const endVisualRow = filteredActs.findIndex(a => a.id === acts[absoluteRowIndex]?.id);
            
            if (startVisualRow !== -1 && endVisualRow !== -1) {
                const minV = Math.min(startVisualRow, endVisualRow);
                const maxV = Math.max(startVisualRow, endVisualRow);
                const expandedSelection = new Set<string>();
                for (let v = minV; v <= maxV; v++) {
                    const absRow = acts.findIndex(a => a.id === filteredActs[v].id);
                    for (let c = 0; c < columns.length; c++) { 
                        expandedSelection.add(getCellId(absRow, c)); 
                    }
                }
                setSelectedCells(expandedSelection);
            }
        } else if (e.ctrlKey || e.metaKey) {
             const updatedSelection = new Set(selectedCells);
             const firstCellId = getCellId(absoluteRowIndex, 0);
             const isThisRowSelected = selectedCells.has(firstCellId); 
             for (let c = 0; c < columns.length; c++) {
                 const id = getCellId(absoluteRowIndex, c);
                 if (isThisRowSelected) updatedSelection.delete(id);
                 else updatedSelection.add(id);
             }
             setSelectedCells(updatedSelection);
             setActiveCell({ rowIndex: absoluteRowIndex, colIndex: 0 });
        } else {
            setSelectedCells(newSelectedCells);
            setActiveCell({ rowIndex: absoluteRowIndex, colIndex: 0 });
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

    const handleSingleDateClick = (act: Act, target: HTMLElement) => {
        const coords = getRelativeCoords(target);
        setSingleDatePopoverState({
            act,
            position: { top: coords.top, left: coords.left, width: coords.width }
        });
    };

    const handleCellDoubleClick = (e: React.MouseEvent<HTMLTableCellElement>, rowIndex: number, colIndex: number) => {
        if (window.getSelection) { window.getSelection()?.removeAllRanges(); }
        const col = columns[colIndex];
        if (editingCell) {
            if (handleEditorSave()) { closeEditor(); } else { return; }
        }
        setDatePopoverState(null);
        setSingleDatePopoverState(null);
        setRegulationPopoverState(null);
        setMaterialPopoverState(null);
        setNextWorkPopoverState(null);
        setStarPopoverState(null);
        setSchemePopoverState(null);
        setSelectedCells(new Set());
        if (col?.key === 'nextWork') {
            const coords = getRelativeCoords(e.currentTarget);
            setNextWorkPopoverState({ rowIndex, colIndex, position: coords });
            return; 
        }
        if (col?.key === 'id') { return; }
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
            
            const selectedRowIndices = Array.from(new Set(coordsList.map(c => c.rowIndex))).sort((a,b) => a-b);
            const minCol = Math.min(...coordsList.map(c => c.colIndex));
            const maxCol = Math.max(...coordsList.map(c => c.colIndex));
            
            const copyData = [];
            for (const r of selectedRowIndices) {
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
                                if (act.nextWorkActId === AUTO_NEXT_ID) { rowData.push(AUTO_NEXT_LABEL); } else { rowData.push(act.nextWork || ''); }
                            } else {
                                 const key = col.key as Exclude<keyof Act, 'representatives' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates' | 'nextWorkActId'>;
                                rowData.push(act[key] || '');
                            }
                        } else { rowData.push(''); }
                    } else { rowData.push(''); }
                }
                copyData.push(rowData.join('\t'));
            }
            await navigator.clipboard.writeText(copyData.join('\n'));
            setCopiedCells(new Set(selectedCells));
        } catch (err) { console.error("Failed to copy: ", err); }
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
                    if(group) { updatedAct.commissionGroupId = group.id; }
                } else if (col.type === 'date') {
                    const columnKey = col.key as keyof Act;
                    (updatedAct as any)[columnKey] = parseDisplayDate(cellData) || '';
                } else if (col.key === 'nextWork') {
                    if (cellData.trim() === AUTO_NEXT_LABEL || cellData.includes('Следующий по списку (Автоматически)')) {
                        updatedAct.nextWorkActId = AUTO_NEXT_ID;
                        updatedAct.nextWork = ''; 
                    } else {
                        updatedAct.nextWork = cellData;
                        updatedAct.nextWorkActId = undefined;
                    }
                }
                else {
                    const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates' | 'nextWorkActId'>;
                    (updatedAct as any)[columnKey] = cellData;
                }
            }
            performBulkUpdate(modifiedActsMap);
            setCopiedCells(null);
        } catch (err) { console.error("Failed to paste: ", err); }
    }, [selectedCells, acts, columns, groups, performBulkUpdate]);
    
    const handleClearCells = useCallback(() => {
        const modifiedActsMap = new Map<string, Act>();
        selectedCells.forEach(cellId => {
            const [r, c] = cellId.split(':').map(Number);
            const originalAct = acts[r];
            if (!originalAct) return;
            let updatedAct = modifiedActsMap.get(originalAct.id);
            if (!updatedAct) { updatedAct = { ...originalAct }; modifiedActsMap.set(originalAct.id, updatedAct); }
            const col = columns[c];
            if (!col || col.key === 'id') return;
            if (col.key === 'workDates') { updatedAct.workStartDate = ''; updatedAct.workEndDate = ''; updatedAct.date = ''; 
            } else if (col.key === 'commissionGroup') { updatedAct.commissionGroupId = undefined;
            } else if (col.key === 'nextWork') { updatedAct.nextWork = ''; updatedAct.nextWorkActId = undefined;
            } else {
                const columnKey = col.key as Exclude<keyof Act, 'representatives' | 'builderDetails' | 'contractorDetails' | 'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'workDates' | 'nextWorkActId'>;
                (updatedAct as any)[columnKey] = '';
            }
        });
        performBulkUpdate(modifiedActsMap);
    }, [selectedCells, acts, columns, performBulkUpdate]);

    const handleBulkDownload = () => {
        if (!template) { alert('Сначала загрузите шаблон.'); return; }
        Array.from(selectedRows).forEach(rowIndex => {
            const act = acts[rowIndex];
            if (act) {
                const actToGenerate = { ...act };
                if (act.nextWorkActId === AUTO_NEXT_ID) {
                    const nextAct = acts[rowIndex + 1];
                    if (nextAct && (nextAct.number || nextAct.workName)) { 
                        actToGenerate.nextWork = `Работы по акту №${nextAct.number || 'б/н'} (${nextAct.workName || '...'})`; 
                    } else { 
                        actToGenerate.nextWork = ''; 
                    }
                }

                // РЕФРЕШ ДАННЫХ ОБ ОРГАНИЗАЦИЯХ ПЕРЕД СКАЧИВАНИЕМ
                const group = groups.find(g => g.id === act.commissionGroupId);
                const builderId = act.builderOrgId || group?.builderOrgId;
                const contractorId = act.contractorOrgId || group?.contractorOrgId;
                const designerId = act.designerOrgId || group?.designerOrgId;
                const performerId = act.workPerformerOrgId || group?.workPerformerOrgId;

                const orgMap = new Map(organizations.map(org => [org.id, org]));

                if (builderId && orgMap.has(builderId)) actToGenerate.builderDetails = getOrgDetailsString(orgMap.get(builderId)!, 'builder');
                if (contractorId && orgMap.has(contractorId)) actToGenerate.contractorDetails = getOrgDetailsString(orgMap.get(contractorId)!, 'contractor');
                if (designerId && orgMap.has(designerId)) actToGenerate.designerDetails = getOrgDetailsString(orgMap.get(designerId)!, 'designer');
                if (performerId && orgMap.has(performerId)) actToGenerate.workPerformer = getOrgDetailsString(orgMap.get(performerId)!, 'performer');

                generateDocument(template, registryTemplate, actToGenerate, people, settings, certificates); 
            }
        });
    };
    
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (editingCell) { return; }

        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            setSelectedCells(new Set());
            setActiveCell(null);
            setCopiedCells(null);
            e.currentTarget.blur();
            setDatePopoverState(null);
            setSingleDatePopoverState(null);
            setRegulationPopoverState(null);
            setMaterialPopoverState(null);
            setNextWorkPopoverState(null);
            setStarPopoverState(null);
            setSchemePopoverState(null);
            return;
        }
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isCtrlKey = isMac ? e.metaKey : e.ctrlKey;
        if (e.code === 'KeyC' && isCtrlKey) { e.preventDefault(); handleCopy(); return; }
        if (e.code === 'KeyV' && isCtrlKey) { e.preventDefault(); handlePaste(); return; }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            if (!activeCell) {
                if (filteredActs.length > 0 && columns.length > 0) { 
                    const firstAbsIndex = acts.findIndex(a => a.id === filteredActs[0].id);
                    setActiveCell({ rowIndex: firstAbsIndex, colIndex: 0 }); 
                    setSelectedCells(new Set([getCellId(firstAbsIndex, 0)])); 
                }
                return;
            }
            
            let { rowIndex: absRowIndex, colIndex } = activeCell;
            let currentVisualRow = filteredActs.findIndex(a => a.id === acts[absRowIndex]?.id);
            if (currentVisualRow === -1) currentVisualRow = 0;

            if (e.key === 'ArrowUp') currentVisualRow = Math.max(0, currentVisualRow - 1);
            if (e.key === 'ArrowDown') currentVisualRow = Math.min(filteredActs.length - 1, currentVisualRow + 1);
            if (e.key === 'ArrowLeft') colIndex = Math.max(0, colIndex - 1);
            if (e.key === 'ArrowRight') colIndex = Math.min(columns.length - 1, colIndex + 1);
            
            const newAbsoluteRowIndex = acts.findIndex(a => a.id === filteredActs[currentVisualRow].id);

            const newCellId = getCellId(newAbsoluteRowIndex, colIndex);
            setActiveCell({ rowIndex: newAbsoluteRowIndex, colIndex });
            setSelectedCells(new Set([newCellId]));
            const cellEl = document.querySelector(`td[data-row-index="${newAbsoluteRowIndex}"][data-col-index="${colIndex}"]`);
            cellEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            return;
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCells.size > 0) {
            e.preventDefault();
            handleClearCells();
        }
    }, [editingCell, selectedCells, handleClearCells, handleCopy, handlePaste, activeCell, setActiveCell, filteredActs, columns.length, setSelectedCells, acts]);

    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (!isDraggingSelection || !scrollContainer) return;
        let lastTime = 0;
        const autoScroll = (timestamp: number) => {
            if (!mousePosRef.current) { autoScrollRaf.current = requestAnimationFrame(autoScroll); return; }
            if (!lastTime) lastTime = timestamp;
            lastTime = timestamp;
            const { x, y } = mousePosRef.current;
            const { left, right, top, bottom } = scrollContainer.getBoundingClientRect();
            const edgeThreshold = 50; const maxSpeed = 30; let scrollX = 0; let scrollY = 0;
            if (x < left + edgeThreshold) { scrollX = -maxSpeed * ((left + edgeThreshold - x) / edgeThreshold); } else if (x > right - edgeThreshold) { scrollX = maxSpeed * ((x - (right - edgeThreshold)) / edgeThreshold); }
            if (y < top + edgeThreshold) { scrollY = -maxSpeed * ((top + edgeThreshold - y) / edgeThreshold); } else if (y > bottom - edgeThreshold) { scrollY = maxSpeed * ((y - (bottom - edgeThreshold)) / edgeThreshold); }
            if (scrollX !== 0 || scrollY !== 0) { scrollContainer.scrollLeft += scrollX; scrollContainer.scrollTop += scrollY; }
            autoScrollRaf.current = requestAnimationFrame(autoScroll);
        };
        autoScrollRaf.current = requestAnimationFrame(autoScroll);
        return () => { if (autoScrollRaf.current) { cancelAnimationFrame(autoScrollRaf.current); } };
    }, [isDraggingSelection]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
            if (!isDraggingSelection || !activeCell) return;
            const coords = getCellCoordsFromEvent(e);
            if (coords) {
                const { minRow, maxRow, minCol, maxCol } = normalizeSelection(activeCell, coords);
                const newSelection = new Set<string>();
                for (let r = minRow; r <= maxRow; r++) { for (let c = minCol; c <= maxCol; c++) { newSelection.add(getCellId(r,c)); } }
                setSelectedCells(newSelection);
            }
        };
        const handleMouseUp = () => { setIsDraggingSelection(false); mousePosRef.current = null; };
        if (isDraggingSelection) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp, { once: true }); }
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, [isDraggingSelection, activeCell, setSelectedCells]);

     useEffect(() => {
        const getSelectionBounds = (cells: Set<string>): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null => {
            const coordsList = Array.from(cells).map(id => { const [rowIndex, colIndex] = id.split(':').map(Number); return { rowIndex, colIndex }; });
            if (coordsList.length === 0) return null;
            return { minRow: Math.min(...coordsList.map(c => c.rowIndex)), maxRow: Math.max(...coordsList.map(c => c.rowIndex)), minCol: Math.min(...coordsList.map(c => c.colIndex)), maxCol: Math.max(...coordsList.map(c => c.colIndex)), };
        };
        const handleMouseMove = (e: MouseEvent) => {
            if (!isFilling || selectedCells.size === 0) return;
            const coords = getCellCoordsFromEvent(e);
            if (coords) {
                const selectionBounds = getSelectionBounds(selectedCells);
                if (!selectionBounds) return;
                const { minRow, maxRow, minCol, maxCol } = selectionBounds;
                let fillArea: { start: Coords, end: Coords } | null = null;
                if (coords.rowIndex > maxRow) { fillArea = { start: {rowIndex: maxRow + 1, colIndex: minCol}, end: {rowIndex: coords.rowIndex, colIndex: maxCol} }; } else if (coords.rowIndex < minRow) { fillArea = { start: {rowIndex: coords.rowIndex, colIndex: minCol}, end: {rowIndex: minRow - 1, colIndex: maxCol} }; }
                setFillTargetArea(fillArea);
            }
        };
        const handleMouseUp = () => {
            if (!isFilling || selectedCells.size === 0 || !fillTargetArea) { setIsFilling(false); setFillTargetArea(null); return; }
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
                const patternRowIndex = isFillingUpwards ? selMaxRow - ((selMinRow - 1 - r) % patternHeight) : selMinRow + ((r - (selMaxRow + 1)) % patternHeight);
                const sourceAct = acts[patternRowIndex];
                if (!sourceAct) continue;
                for (const c of selectedCols) {
                    const sourceCellId = getCellId(patternRowIndex, c);
                    if (!selectedCells.has(sourceCellId)) continue;
                    const colKey = columns[c]?.key;
                    if (!colKey) continue;
                    if (colKey === 'workDates') { updatedAct.workStartDate = sourceAct.workStartDate; updatedAct.workEndDate = sourceAct.workEndDate; updatedAct.date = sourceAct.workEndDate; 
                    } else if (colKey === 'commissionGroup') {
                         const group = groups.find(g => g.id === sourceAct.commissionGroupId);
                         if (group) {
                            updatedAct.commissionGroupId = group.id; updatedAct.representatives = { ...group.representatives }; updatedAct.builderOrgId = group.builderOrgId; updatedAct.contractorOrgId = group.contractorOrgId; updatedAct.designerOrgId = group.designerOrgId; updatedAct.workPerformerOrgId = group.workPerformerOrgId;
                            updatedAct.builderDetails = sourceAct.builderDetails; updatedAct.contractorDetails = sourceAct.contractorDetails; updatedAct.designerDetails = sourceAct.designerDetails; updatedAct.workPerformer = sourceAct.workPerformer;
                         } else { updatedAct.commissionGroupId = undefined; }
                    } else { const typedColKey = colKey as keyof Act; const sourceValue = sourceAct[typedColKey]; (updatedAct as any)[typedColKey] = sourceValue; }
                }
                actsToUpdate.set(updatedAct.id, updatedAct);
            }
            performBulkUpdate(actsToUpdate);
            setIsFilling(false);
            setFillTargetArea(null);
        };
        if (isFilling) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp, { once: true }); }
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, [isFilling, selectedCells, fillTargetArea, acts, columns, groups, performBulkUpdate]);

    const handleRowDragStart = (e: React.DragEvent<HTMLTableRowElement>, rowIndex: number) => {
        if (editingCell || hasActiveFilters) { e.preventDefault(); return; }
        if (!dragHandlePressedRef.current) { e.preventDefault(); return; }
        let indicesToDrag = [rowIndex];
        if (selectedRows.has(rowIndex)) indicesToDrag = Array.from(selectedRows).sort((a,b) => a-b);
        setDraggedRowIndices(indicesToDrag);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(indicesToDrag));
    };

    const handleRowDragOver = (e: React.DragEvent<HTMLTableRowElement>, rowIndex: number) => {
        e.preventDefault(); 
        if (!draggedRowIndices || hasActiveFilters) return;
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
        if (!draggedRowIndices || dropTargetRowIndex === null || !dropPosition || hasActiveFilters) { handleDragEnd(); return; }
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
        
        if (dragOverCol !== colKey) {
            setDragOverCol(colKey);
        }

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

    const handleColumnDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverCol(null);
        
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
        setDragOverCol(null);
        dragHandlePressedRef.current = false;
    };

    const updateFillHandlePosition = useCallback(() => {
        if (selectedCells.size > 0 && scrollContainerRef.current) {
            const coordsList = Array.from(selectedCells).map(id => {
                const [rowIndex, colIndex] = id.split(':').map(Number);
                return { rowIndex, colIndex };
            });
            const minRow = Math.min(...coordsList.map(c => c.rowIndex));
            const maxRow = Math.max(...coordsList.map(c => c.rowIndex));
            const minCol = Math.min(...coordsList.map(c => c.colIndex));
            const maxCol = Math.max(...coordsList.map(c => c.colIndex));
            
            const expectedCellsCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);
            if (selectedCells.size !== expectedCellsCount) {
                setFillHandleCoords(null);
                return;
            }

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
            return 'bg-blue-100/50 [.theme-dark_&]:bg-blue-900/40';
        }
        return '';
    };

    const handleContextMenu = (e: React.MouseEvent, rowIndex: number, colIndex: number) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, rowIndex, colIndex });
    };

    const handleStarClick = (e: React.MouseEvent, colKey: string, colIndex: number) => {
        e.stopPropagation(); 
        
        if (pinnedColumns[colKey]) {
            const coords = getRelativeCoords(e.currentTarget as HTMLElement);
            setStarPopoverState({ colKey, position: { top: coords.top + 20, left: coords.left - 100 } });
        } else {
            if (activeCell && activeCell.colIndex === colIndex) {
                const act = acts[activeCell.rowIndex];
                let preview = '';
                let payload: any;
                
                if (colKey === 'workDates') {
                    preview = `${formatDateForDisplay(act.workStartDate)} - ${formatDateForDisplay(act.workEndDate)}`;
                    payload = { start: act.workStartDate, end: act.workEndDate };
                } else if (colKey === 'commissionGroup') {
                    const group = groups.find(g => g.id === act.commissionGroupId);
                    preview = group?.name || 'Группа комиссий';
                    payload = {
                        id: act.commissionGroupId,
                        representatives: act.representatives,
                        builderOrgId: act.builderOrgId,
                        contractorOrgId: act.contractorOrgId,
                        designerOrgId: act.designerOrgId,
                        workPerformerOrgId: act.workPerformerOrgId,
                        builderDetails: act.builderDetails,
                        contractorDetails: act.contractorDetails,
                        designerDetails: act.designerDetails,
                        workPerformer: act.workPerformer
                    };
                } else {
                    preview = String((act as any)[colKey] || '');
                    payload = (act as any)[colKey];
                }

                setPinnedColumns(prev => ({
                    ...prev,
                    [colKey]: {
                        rowIndexDisplay: activeCell.rowIndex + 1,
                        previewText: preview.length > 40 ? preview.substring(0, 40) + '...' : preview,
                        payload
                    }
                }));
            }
        }
    };

    const handleUnpin = (colKey: string) => {
        setPinnedColumns(prev => {
            const newObj = { ...prev };
            delete newObj[colKey];
            return newObj;
        });
        setStarPopoverState(null);
    };

    const applyPinsToNewAct = (act: Act): Act => {
        if (Object.keys(pinnedColumns).length === 0) return act;
        const updated = { ...act };
        Object.entries(pinnedColumns).forEach(([colKey, pinInfo]) => {
            if (colKey === 'workDates') {
                updated.workStartDate = pinInfo.payload.start;
                updated.workEndDate = pinInfo.payload.end;
                updated.date = pinInfo.payload.end;
            } else if (colKey === 'commissionGroup') {
                if (pinInfo.payload.id) {
                    updated.commissionGroupId = pinInfo.payload.id;
                    updated.representatives = { ...pinInfo.payload.representatives };
                    updated.builderOrgId = pinInfo.payload.builderOrgId;
                    updated.contractorOrgId = pinInfo.payload.contractorOrgId;
                    updated.designerOrgId = pinInfo.payload.designerOrgId;
                    updated.workPerformerOrgId = pinInfo.payload.workPerformerOrgId;
                    updated.builderDetails = pinInfo.payload.builderDetails;
                    updated.contractorDetails = pinInfo.payload.contractorDetails;
                    updated.designerDetails = pinInfo.payload.designerDetails;
                    updated.workPerformer = pinInfo.payload.workPerformer;
                }
            } else {
                (updated as any)[colKey] = pinInfo.payload;
            }
        });
        return updated;
    };

    const handleAddRows = (count: number) => {
        if (count <= 0) return;
        const newActsToAdd = [];
        for (let i = 0; i < count; i++) { 
            newActsToAdd.push(applyPinsToNewAct(createNewAct())); 
        }
        const finalizedNewActs = newActsToAdd.map(act => applyTemplatesToAct(act));
        const updatedActs = [...acts, ...finalizedNewActs];
        onReorderActs(updatedActs);
        setNumRowsToAdd(1);
        setTimeout(() => { if (scrollContainerRef.current) { scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight; } }, 100);
    };

    const handleHeaderMouseEnter = (e: React.MouseEvent, key: string) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setHoveredHeaderPos({ top: rect.bottom, left: rect.left });
        setHoveredHeaderKey(key);
    };

    const handleHeaderMouseLeave = () => {
        setHoveredHeaderKey(null);
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

            {hoveredHeaderKey && hoveredHeaderPos && (
                <RichHeaderTooltip 
                    column={ALL_COLUMNS.find(c => c.key === hoveredHeaderKey)!} 
                    position={hoveredHeaderPos} 
                />
            )}

            <div 
                className="flex-grow overflow-auto relative scroll-shadows p-4" 
                ref={scrollContainerRef}
            >
                <table className="w-full border-collapse text-sm min-w-max">
                    <thead 
                        className="bg-slate-50 sticky top-0 z-10 shadow-sm"
                        onMouseLeave={() => setHoveredColIndex(null)}
                    >
                        <tr className="bg-slate-50 [.theme-dark_&]:bg-[#161b22] border-b border-slate-300 [.theme-dark_&]:border-slate-700">
                            <th className="w-12 border border-slate-300 [.theme-dark_&]:border-slate-700 px-2 py-2 font-medium text-slate-500 [.theme-dark_&]:text-slate-400 text-center select-none bg-slate-100 [.theme-dark_&]:bg-[#161b22] align-middle">
                                <button 
                                    onClick={() => setIsFilterOpen(!isFilterOpen)} 
                                    className={`p-1.5 rounded transition-colors w-full h-full flex justify-center items-center ${isFilterOpen || hasActiveFilters ? 'text-blue-600 bg-blue-100 [.theme-dark_&]:bg-blue-900/50 [.theme-dark_&]:text-blue-400' : 'hover:bg-slate-200 [.theme-dark_&]:hover:bg-slate-700'}`}
                                    title="Фильтры"
                                >
                                    <FilterIcon />
                                </button>
                            </th>
                            {columns.map((col, index) => {
                                const isActiveColumn = activeCell?.colIndex === index;
                                const isPinned = !!pinnedColumns[col.key];
                                const isDraggingOver = dragOverCol === col.key;
                                const isHoveredColumn = hoveredColIndex === index;
                                const isSelected = selectedColumns.has(index);

                                let bgClass = "bg-slate-100 [.theme-dark_&]:bg-[#161b22] text-slate-600 [.theme-dark_&]:text-slate-300";

                                if (isDraggingOver) {
                                    bgClass = "bg-blue-50 border-l-2 border-l-blue-500 [.theme-dark_&]:bg-[#1e2c4b] [.theme-dark_&]:border-l-blue-500 text-slate-800 [.theme-dark_&]:text-slate-200";
                                } else if (isSelected) {
                                    bgClass = "bg-blue-100 [.theme-dark_&]:bg-[#1e2e53] text-slate-800 [.theme-dark_&]:text-slate-200";
                                } else if (isPinned) {
                                    bgClass = "bg-amber-50 border-b-amber-200 text-amber-900 [.theme-dark_&]:bg-[#362c16] [.theme-dark_&]:border-b-amber-700/50 [.theme-dark_&]:text-amber-400";
                                }

                                const showIcons = isHoveredColumn || isPinned || isActiveColumn;

                                return (
                                    <th
                                        key={col.key}
                                        data-col-index={index}
                                        className={`
                                            border border-slate-300 [.theme-dark_&]:border-slate-700 px-2 py-2 font-medium text-left select-none relative
                                            ${col.widthClass}
                                            ${bgClass}
                                            ${draggedColKey === col.key ? 'opacity-50' : ''}
                                            grabbable group/th align-middle
                                        `}
                                        draggable={!editingCell && !hasActiveFilters}
                                        onDragStart={(e) => {
                                            if (hasActiveFilters) { e.preventDefault(); return; }
                                            handleColumnDragStart(e, col.key)
                                        }}
                                        onDragOver={(e) => handleColumnDragOver(e, col.key)}
                                        onDrop={handleColumnDrop}
                                        onDragEnd={handleDragEnd}
                                        onDragLeave={() => setDragOverCol(null)}
                                        onClick={(e) => handleColumnHeaderClick(e, index)}
                                        onMouseEnter={() => setHoveredColIndex(index)}
                                    >
                                        <div className="relative flex items-center justify-between w-full h-full min-w-max">
                                            <span className="truncate pr-10">{col.label}</span>
                                            
                                            <div className={`absolute right-0 top-1/2 -translate-y-1/2 flex items-center space-x-1 px-1 transition-opacity duration-200 
                                                ${showIcons ? 'opacity-100 pointer-events-auto z-10' : 'opacity-0 pointer-events-none'}`}>
                                                
                                                {(isPinned || isActiveColumn) && (
                                                    <span 
                                                        className={`cursor-pointer transition-opacity flex-shrink-0 bg-transparent ${isPinned ? 'text-amber-500 opacity-100 hover:text-amber-600' : 'text-slate-400 hover:text-amber-400'}`}
                                                        onClick={(e) => handleStarClick(e, col.key, index)}
                                                        title={isPinned ? "Управление закреплением" : "Закрепить текущее значение ячейки для новых актов"}
                                                    >
                                                        <StarIcon className="w-4 h-4" filled={isPinned} />
                                                    </span>
                                                )}
                                                {col.required && <span title="Обязательное поле" className="text-red-400 cursor-help font-bold">*</span>}
                                                {(col.description) && (
                                                    <span 
                                                        className="text-slate-400 hover:text-blue-600 cursor-help transition-opacity flex-shrink-0"
                                                        onMouseEnter={(e) => handleHeaderMouseEnter(e, col.key)}
                                                        onMouseLeave={handleHeaderMouseLeave}
                                                    >
                                                        <QuestionMarkCircleIcon className="w-4 h-4" />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                        {isFilterOpen && (
                            <tr className="bg-slate-100 [.theme-dark_&]:bg-slate-800 shadow-inner">
                                <th className="border border-slate-300 [.theme-dark_&]:border-slate-700 px-1 py-1 align-middle text-center bg-slate-100 [.theme-dark_&]:bg-[#161b22]">
                                    {hasActiveFilters && (
                                        <button 
                                            onClick={() => setFilters({})} 
                                            className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded [.theme-dark_&]:bg-red-900/30 [.theme-dark_&]:text-red-400 transition-colors mx-auto"
                                            title="Сбросить все фильтры"
                                        >
                                            <CloseIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </th>
                                {columns.map((col) => {
                                    const isDate = col.type === 'date' || col.key === 'workDates';
                                    return (
                                        <th key={`filter-${col.key}`} className="p-1 border border-slate-300 [.theme-dark_&]:border-slate-700 font-normal align-top bg-slate-50 [.theme-dark_&]:bg-[#161b22]">
                                            {isDate ? (
                                                <div className="flex flex-col gap-1">
                                                    <input 
                                                        type="date" 
                                                        title="От"
                                                        value={filters[col.key]?.start || ''} 
                                                        onChange={e => setFilters({...filters, [col.key]: { ...filters[col.key], start: e.target.value }})} 
                                                        className="w-full text-xs p-1 rounded border border-slate-300 [.theme-dark_&]:border-slate-600 bg-white [.theme-dark_&]:bg-[#0d1117] text-slate-700 [.theme-dark_&]:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 [.theme-dark_&]:[color-scheme:dark]" 
                                                    />
                                                    <input 
                                                        type="date" 
                                                        title="До"
                                                        value={filters[col.key]?.end || ''} 
                                                        onChange={e => setFilters({...filters, [col.key]: { ...filters[col.key], end: e.target.value }})} 
                                                        className="w-full text-xs p-1 rounded border border-slate-300 [.theme-dark_&]:border-slate-600 bg-white [.theme-dark_&]:bg-[#0d1117] text-slate-700 [.theme-dark_&]:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 [.theme-dark_&]:[color-scheme:dark]" 
                                                    />
                                                </div>
                                            ) : (
                                                <input 
                                                    type="text" 
                                                    placeholder="Поиск..." 
                                                    value={filters[col.key] || ''} 
                                                    onChange={e => setFilters({...filters, [col.key]: e.target.value})} 
                                                    className="w-full text-xs p-1.5 rounded border border-slate-300 [.theme-dark_&]:border-slate-600 bg-white [.theme-dark_&]:bg-[#0d1117] text-slate-700 [.theme-dark_&]:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500" 
                                                />
                                            )}
                                        </th>
                                    );
                                })}
                            </tr>
                        )}
                    </thead>
                    <tbody
                        onMouseLeave={() => setHoveredColIndex(null)}
                        onMouseOver={(e) => {
                            const td = (e.target as HTMLElement).closest('td');
                            if (td && td.dataset.colIndex) {
                                setHoveredColIndex(Number(td.dataset.colIndex));
                            }
                        }}
                    >
                        {filteredActs.map((act, visualRowIndex) => {
                            const absoluteIndex = acts.findIndex(a => a.id === act.id);
                            const isRowSelected = selectedRows.has(absoluteIndex);
                            const isRowDragged = draggedRowIndices?.includes(absoluteIndex);
                            
                            return (
                                <tr 
                                    key={act.id} 
                                    className={`
                                        group
                                        ${isRowSelected ? 'bg-blue-50 [.theme-dark_&]:bg-blue-900/20' : 'hover:bg-slate-50 [.theme-dark_&]:hover:bg-slate-800/50'}
                                        ${isRowDragged ? 'opacity-40' : ''}
                                        ${actPickerState?.sourceRowIndex === absoluteIndex ? 'act-picker-source-row' : ''}
                                    `}
                                    draggable={!editingCell && !hasActiveFilters}
                                    onDragStart={(e) => {
                                        if (hasActiveFilters) { e.preventDefault(); return; }
                                        handleRowDragStart(e, absoluteIndex);
                                    }}
                                    onDragOver={(e) => handleRowDragOver(e, absoluteIndex)}
                                    onDrop={handleRowDrop}
                                    onDragEnd={handleDragEnd}
                                >
                                    <td 
                                        className={`
                                            row-drag-handle border border-slate-300 [.theme-dark_&]:border-slate-700 px-1 py-1 text-center text-xs select-none relative group/handle
                                            ${isRowSelected ? 'bg-blue-100 border-blue-200 z-20 [.theme-dark_&]:bg-blue-900/40 [.theme-dark_&]:border-blue-800' : 'bg-slate-50 text-slate-400 [.theme-dark_&]:bg-[#161b22] [.theme-dark_&]:text-slate-500'}
                                            ${hasActiveFilters ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}
                                        `}
                                        onMouseDown={(e) => handleRowHeaderMouseDown(e, absoluteIndex)}
                                        onMouseUp={handleRowHeaderMouseUp}
                                    >
                                       <div className="pointer-events-none flex items-center justify-between h-full w-full pl-1">
                                            <div className={`p-0.5 rounded flex-shrink-0 ${isRowSelected ? 'text-blue-500' : 'text-slate-300 group-hover:text-slate-500'} ${hasActiveFilters ? 'opacity-20' : ''}`}>
                                                <GripVerticalIcon className="w-4 h-4" />
                                            </div>
                                            <span className={`flex-grow text-center ${isRowSelected ? 'font-semibold text-blue-700 [.theme-dark_&]:text-blue-400' : ''}`}>{absoluteIndex + 1}</span>
                                       </div>
                                    </td>
                                    {columns.map((col, colIndex) => {
                                        const cellId = getCellId(absoluteIndex, colIndex);
                                        const isSelected = selectedCells.has(cellId);
                                        const isEditing = editingCell?.rowIndex === absoluteIndex && editingCell?.colIndex === colIndex;
                                        const isCopied = copiedCells?.has(cellId);
                                        const isPinned = !!pinnedColumns[col.key];
                                        
                                        const isTopSelected = selectedCells.has(getCellId(absoluteIndex - 1, colIndex));
                                        const isBottomSelected = selectedCells.has(getCellId(absoluteIndex + 1, colIndex));
                                        const isLeftSelected = selectedCells.has(getCellId(absoluteIndex, colIndex - 1));
                                        const isRightSelected = selectedCells.has(getCellId(absoluteIndex, colIndex + 1));

                                        let selectionShadow = undefined;
                                        if (isSelected) {
                                            const shadows = [];
                                            if (!isTopSelected) shadows.push('inset 0 2px 0 0 #3b82f6');
                                            if (!isBottomSelected) shadows.push('inset 0 -2px 0 0 #3b82f6');
                                            if (!isLeftSelected) shadows.push('inset 2px 0 0 0 #3b82f6');
                                            if (!isRightSelected) shadows.push('inset -2px 0 0 0 #3b82f6');
                                            if (shadows.length > 0) selectionShadow = shadows.join(', ');
                                        }

                                        let displayContent: React.ReactNode = String(act[col.key as keyof Act] || '');
                                        
                                        if (col.key === 'workDates') {
                                            displayContent = (
                                                <span className={!act.workStartDate || !act.workEndDate ? 'text-slate-400' : ''}>
                                                    {act.workStartDate && act.workEndDate ? `${formatDateForDisplay(act.workStartDate)} - ${formatDateForDisplay(act.workEndDate)}` : 'Укажите даты'}
                                                </span>
                                            );
                                        } else if (col.key === 'commissionGroup') {
                                            displayContent = groups.find(g => g.id === act.commissionGroupId)?.name || <span className="text-slate-300 italic">Не выбрано</span>;
                                        } else if (col.type === 'date') {
                                            const val = act[col.key as keyof Act] as string;
                                            if (!val && col.key === 'date' && settings.defaultActDate) {
                                                const defaultResolved = resolvePreviewTemplate(settings.defaultActDate, act);
                                                const parsedDefault = parseDisplayDate(defaultResolved);
                                                
                                                if (parsedDefault) {
                                                    displayContent = (
                                                        <span className="text-slate-400 italic flex items-center gap-1 group/date" title={`Автоматически: ${defaultResolved}`}>
                                                            {formatDateForDisplay(parsedDefault)}
                                                            <SparklesIcon className="w-3 h-3 text-slate-300 opacity-50 group-hover/date:opacity-100" />
                                                        </span>
                                                    );
                                                } else {
                                                    displayContent = <span className="text-slate-300 text-xs italic">(Автоматически)</span>;
                                                }
                                            } else {
                                                displayContent = formatDateForDisplay(val);
                                            }
                                        } else if (col.key === 'regulations') {
                                            displayContent = (
                                                <div className="flex flex-wrap gap-1">
                                                    {(act.regulations || '').split(';').map(s => s.trim()).filter(Boolean).map((item, idx) => {
                                                        const reg = regulations.find(r => r.designation === item);
                                                        let chipClass = "bg-slate-100 text-slate-800 border-slate-300 [.theme-dark_&]:bg-slate-800 [.theme-dark_&]:border-slate-700 [.theme-dark_&]:text-slate-300";
                                                        if (reg) {
                                                             if (reg.status.toLowerCase().includes('действует')) chipClass = "bg-green-100 text-green-800 border-green-200 [.theme-dark_&]:bg-green-900/30 [.theme-dark_&]:border-green-800 [.theme-dark_&]:text-green-400";
                                                             else if (reg.status.toLowerCase().includes('заменен')) chipClass = "bg-red-100 text-red-800 border-red-200 [.theme-dark_&]:bg-red-900/30 [.theme-dark_&]:border-red-800 [.theme-dark_&]:text-red-400";
                                                             else chipClass = "bg-blue-100 text-blue-800 border-blue-200 [.theme-dark_&]:bg-blue-900/30 [.theme-dark_&]:border-blue-800 [.theme-dark_&]:text-blue-400";
                                                        }
                                                        return (
                                                            <span 
                                                                key={idx} 
                                                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border ${chipClass} cursor-pointer hover:underline`}
                                                                onClick={(e) => { e.stopPropagation(); handleShowRegulationInfo(item, e.currentTarget); }}
                                                            >
                                                                {item}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        } else if (col.key === 'materials') {
                                            const mappings = (act as any).materialMappings || {};
                                            
                                            displayContent = (
                                                <div className="flex flex-wrap gap-1">
                                                    {(act.materials || '').split(';').map(s => s.trim()).filter(Boolean).map((item, idx) => {
                                                        const cert = findCertByText(item);
                                                        const chipClass = cert ? "bg-green-100 text-green-800 border-green-200 [.theme-dark_&]:bg-green-900/30 [.theme-dark_&]:border-green-800 [.theme-dark_&]:text-green-400" : "bg-red-100 text-red-800 border-red-200 [.theme-dark_&]:bg-red-900/30 [.theme-dark_&]:border-red-800 [.theme-dark_&]:text-red-400";
                                                        
                                                        const displayTitle = item.split('(')[0].trim();

                                                        return (
                                                            <span 
                                                                key={idx} 
                                                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border ${chipClass} cursor-pointer hover:underline max-w-full`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (cert) { 
                                                                        handleShowMaterialInfo(item, e.currentTarget, act.id); 
                                                                    } else { 
                                                                        setLinkMaterialModalState({ isOpen: true, actId: act.id, itemIndex: idx, initialSearch: item, editingMaterialTitle: item }); 
                                                                    }
                                                                }}
                                                                title={cert ? "Редактировать материалы сертификата в этом акте" : "Нажмите, чтобы выбрать сертификат из базы"}
                                                            >
                                                                <span className="truncate max-w-[200px] block">{displayTitle}</span>
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        } else if (col.key === 'certs') { 
                                            displayContent = (
                                                <div className="flex flex-wrap gap-1">
                                                    {(act.certs || '').split(';').map(s => s.trim()).filter(Boolean).map((item, idx) => {
                                                        const scheme = findSchemeByText(item);
                                                        const isLinked = !!scheme;
                                                        const chipClass = isLinked ? "bg-indigo-100 text-indigo-800 border-indigo-200 [.theme-dark_&]:bg-indigo-900/30 [.theme-dark_&]:border-indigo-800 [.theme-dark_&]:text-indigo-400" : "bg-slate-100 text-slate-800 border-slate-200 [.theme-dark_&]:bg-slate-800 [.theme-dark_&]:border-slate-700 [.theme-dark_&]:text-slate-300";
                                                        return (
                                                            <span 
                                                                key={idx} 
                                                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border ${chipClass} cursor-pointer hover:underline max-w-full transition-all`} 
                                                                title={isLinked ? "Управление привязанной схемой" : "Нажмите, чтобы привязать к схеме из базы"}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (scheme) {
                                                                        setSchemePopoverState({
                                                                            scheme,
                                                                            actId: act.id,
                                                                            itemIndex: idx,
                                                                            position: getRelativeCoords(e.currentTarget)
                                                                        });
                                                                    } else {
                                                                        setLinkSchemeModalState({
                                                                            isOpen: true,
                                                                            actId: act.id,
                                                                            itemIndex: idx,
                                                                            initialSearch: item,
                                                                            editingSchemeTitle: item
                                                                        });
                                                                    }
                                                                }}
                                                            >
                                                                <span className="truncate max-w-[250px] block">{item}</span>
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        } else if (col.key === 'nextWork' && act.nextWorkActId === AUTO_NEXT_ID) {
                                            const nextAct = acts[absoluteIndex + 1];
                                            if (nextAct) {
                                                const hasContent = nextAct.number || nextAct.workName;
                                                if (hasContent) {
                                                    displayContent = (
                                                        <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 [.theme-dark_&]:bg-blue-900/30 [.theme-dark_&]:text-blue-400 [.theme-dark_&]:border-blue-800 flex items-center gap-1.5 inline-flex max-w-full">
                                                            <ArrowDownCircleIcon className="w-3 h-3 flex-shrink-0" />
                                                            <span className="truncate">Акт №{nextAct.number || 'б/н'} ({nextAct.workName || '...'})</span>
                                                        </span>
                                                    );
                                                } else {
                                                    displayContent = <span className="text-slate-300 italic text-xs">Следующий акт пуст</span>;
                                                }
                                            } else { displayContent = <span className="text-slate-300 italic text-xs">Конец списка</span>; }
                                        } else if (col.key === 'additionalInfo' || col.key === 'attachments') {
                                            const val = act[col.key];
                                            const defaultTemplate = col.key === 'additionalInfo' ? settings.defaultAdditionalInfo : settings.defaultAttachments;
                                            
                                            if (!val && defaultTemplate) {
                                                const resolved = resolvePreviewTemplate(defaultTemplate, act);
                                                displayContent = (
                                                    <span className="text-slate-400 italic flex items-start gap-1 group/default" title={`Автоматически: ${resolved}`}>
                                                        <SparklesIcon className="w-3 h-3 text-slate-300 opacity-50 group-hover/default:opacity-100 mt-0.5 flex-shrink-0" />
                                                        <span className="truncate">{renderTextWithTags(resolved || '(Пусто)')}</span>
                                                    </span>
                                                );
                                            }
                                        }

                                        return (
                                            <td
                                                key={col.key}
                                                data-row-index={absoluteIndex}
                                                data-col-index={colIndex}
                                                onMouseEnter={() => setHoveredColIndex(colIndex)}
                                                className={`
                                                    border border-slate-300 [.theme-dark_&]:border-slate-700 px-2 py-1 relative align-top transition-colors
                                                    ${isPinned && !isSelected && !isEditing ? 'bg-amber-50/40 [.theme-dark_&]:bg-amber-900/20' : ''}
                                                    ${isSelected ? 'bg-blue-100 z-10 [.theme-dark_&]:bg-blue-900/30' : ''}
                                                    ${isCopied ? 'relative' : ''}
                                                    ${getHighlightClass(absoluteIndex, colIndex)}
                                                    ${col.key === 'id' ? 'text-xs text-slate-400 select-all' : ''}
                                                    ${col.key === 'commissionGroup' ? 'text-slate-600 [.theme-dark_&]:text-slate-400' : ''}
                                                    cursor-default
                                                `}
                                                onMouseDown={(e) => handleCellMouseDown(e, absoluteIndex, colIndex)}
                                                onDoubleClick={(e) => handleCellDoubleClick(e, absoluteIndex, colIndex)}
                                                onContextMenu={(e) => handleContextMenu(e, absoluteIndex, colIndex)}
                                                style={{ height: '1px', boxShadow: selectionShadow }} 
                                            >
                                                {isCopied && <div className="copied-cell-overlay" />}
                                                
                                                {isEditing ? (
                                                    <div ref={editorContainerRef} className="h-full w-full min-h-[1.5em] bg-transparent flex items-center">
                                                       {col.key === 'commissionGroup' ? (
                                                            <CustomSelect options={groupOptions} value={editorValue} onChange={(val) => { handleGroupChange(act, val); closeEditor(); }} startOpen={true} onCreateNew={handleCreateNewGroup} allowClear className="w-full" />
                                                        ) : col.key === 'regulations' ? (
                                                            <RegulationsInput value={editorValue} onChange={handleCustomEditorChange} regulations={regulations} onOpenDictionary={() => setRegulationsModalOpen(true)} onInfoClick={(des, target) => handleShowRegulationInfo(des, target)} />
                                                        ) : col.key === 'materials' ? (
                                                            <MaterialsInput value={editorValue} onChange={handleCustomEditorChange} certificates={certificates} onNavigateToCertificate={onNavigateToCertificate} />
                                                        ) : col.key === 'certs' ? (
                                                            <SchemesInput value={editorValue} onChange={handleCustomEditorChange} schemes={schemes || []} />
                                                        ) : col.type === 'date' ? (
                                                            <div className="flex items-center w-full gap-1">
                                                                <input 
                                                                    ref={editorRef as React.RefObject<HTMLInputElement>} 
                                                                    type="date" 
                                                                    defaultValue={editorValue} 
                                                                    onChange={handleNativeEditorChange} 
                                                                    onKeyDown={handleEditorKeyDown} 
                                                                    className="w-full h-full bg-transparent outline-none p-1 text-sm rounded border border-blue-300 focus:ring-1 focus:ring-blue-500 [.theme-dark_&]:[color-scheme:dark]" 
                                                                />
                                                                {editorValue && (
                                                                    <button 
                                                                        onMouseDown={(e) => {
                                                                            e.preventDefault(); 
                                                                            editorValueRef.current = '';
                                                                            if (editorRef.current) editorRef.current.value = '';
                                                                            const updatedAct = { ...act, [col.key]: '' };
                                                                            handleSaveWithTemplateResolution(updatedAct);
                                                                            closeEditor();
                                                                        }}
                                                                        className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 [.theme-dark_&]:hover:bg-red-900/30 rounded"
                                                                        title="Сбросить (использовать по умолчанию)"
                                                                    >
                                                                        <CloseIcon className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="w-full h-full relative">
                                                                <textarea 
                                                                    ref={editorRef as React.RefObject<HTMLTextAreaElement>} 
                                                                    defaultValue={editorValue} 
                                                                    onChange={handleNativeEditorChange} 
                                                                    onKeyDown={handleEditorKeyDown} 
                                                                    className="w-full h-full resize-none bg-transparent outline-none overflow-hidden pr-6" 
                                                                    rows={1} 
                                                                    placeholder={col.key === 'workDates' ? 'ДД.ММ.ГГГГ - ДД.ММ.ГГГГ' : ''} 
                                                                />
                                                                {editorValue && ((col.key === 'additionalInfo' && settings.defaultAdditionalInfo) || (col.key === 'attachments' && settings.defaultAttachments)) && (
                                                                    <button 
                                                                        onMouseDown={(e) => {
                                                                            e.preventDefault(); 
                                                                            editorValueRef.current = '';
                                                                            if (editorRef.current) editorRef.current.value = '';
                                                                            const updatedAct = { ...act, [col.key]: '' };
                                                                            handleSaveWithTemplateResolution(updatedAct);
                                                                            closeEditor();
                                                                        }}
                                                                        className="absolute top-0 right-0 text-red-400 hover:text-red-600 p-1 hover:bg-red-50 [.theme-dark_&]:hover:bg-red-900/30 rounded"
                                                                        title="Сбросить (использовать по умолчанию)"
                                                                    >
                                                                        <CloseIcon className="w-3 h-3" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                        {dateError && col.key === 'workDates' && (
                                                            <div className="absolute top-full left-0 z-50 bg-red-100 text-red-700 text-xs px-2 py-1 rounded shadow-md mt-1 border border-red-200 [.theme-dark_&]:bg-red-900/90 [.theme-dark_&]:text-red-200 [.theme-dark_&]:border-red-800">
                                                                {dateError}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-full min-h-[1.5em] whitespace-pre-wrap flex items-center justify-between group/cell">
                                                        <span className="flex-grow">
                                                            {typeof displayContent === 'string' ? renderTextWithTags(displayContent) : displayContent}
                                                        </span>
                                                        {(col.key === 'workDates' || col.key === 'date') && (
                                                            <button className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 ml-2 transition-opacity flex-shrink-0" onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                if (col.key === 'workDates') handleDateClick(act, e.currentTarget); 
                                                                else handleSingleDateClick(act, e.currentTarget);
                                                            }}>
                                                                <CalendarIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                         {col.key === 'nextWork' && act.nextWorkActId && act.nextWorkActId !== AUTO_NEXT_ID && (
                                                            <div className="ml-2 text-blue-600" title="Связано с другим актом"><LinkIcon className="w-4 h-4" /></div>
                                                         )}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        {filteredActs.length === 0 && acts.length > 0 && (
                            <tr>
                                <td colSpan={columns.length + 1} className="text-center py-8 text-slate-500 [.theme-dark_&]:text-slate-400 bg-slate-50 [.theme-dark_&]:bg-[#161b22]">
                                    По вашему запросу ничего не найдено.
                                </td>
                            </tr>
                        )}
                        {(!isFilterOpen || filteredActs.length > 0) && (
                            <tr className="h-10 group cursor-pointer" onClick={() => handleAddRows(1)}>
                                <td colSpan={columns.length + 1} className="p-0 border border-t-0 border-slate-300 [.theme-dark_&]:border-slate-700 border-dashed bg-slate-50 [.theme-dark_&]:bg-[#161b22] hover:bg-blue-50 [.theme-dark_&]:hover:bg-blue-900/20 transition-colors">
                                    <div className="sticky left-0 w-max flex items-center gap-10 px-4 py-2 text-slate-500 [.theme-dark_&]:text-slate-400 group-hover:text-blue-600 [.theme-dark_&]:group-hover:text-blue-400 select-none">
                                        <div className="flex items-center gap-2 font-medium">
                                            <PlusIcon className="w-5 h-5"/>
                                            <span>Добавить новый акт</span>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                            <span className="text-xs">Добавить сразу:</span>
                                            <input type="number" min="1" max="50" value={numRowsToAdd} onChange={(e) => setNumRowsToAdd(Math.max(1, parseInt(e.target.value) || 1))} className="w-12 h-7 px-1 text-center border border-slate-300 [.theme-dark_&]:border-slate-600 rounded text-sm focus:outline-none focus:border-blue-500 [.theme-dark_&]:bg-[#0d1117] [.theme-dark_&]:text-slate-200 [.theme-dark_&]:[color-scheme:dark]" />
                                            <button onClick={(e) => { e.stopPropagation(); handleAddRows(numRowsToAdd); }} className="bg-white [.theme-dark_&]:bg-[#21262d] border border-slate-300 [.theme-dark_&]:border-slate-600 px-3 py-1 rounded text-xs hover:bg-blue-600 hover:text-white hover:border-blue-600 [.theme-dark_&]:hover:bg-blue-600 transition-colors">Добавить</button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {fillHandleCoords && !editingCell && (
                    <div className="absolute w-2.5 h-2.5 bg-blue-600 border border-white cursor-crosshair z-20" style={{ top: fillHandleCoords.top, left: fillHandleCoords.left }} onMouseDown={(e) => { e.preventDefault(); setIsFilling(true); }} />
                )}
            </div>

             {selectedRows.size > 0 && (
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white shadow-xl border border-slate-200 rounded-full px-6 py-2 flex items-center gap-4 z-50 animate-fade-in-up">
                    <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Выбрано: {selectedRows.size}</span>
                    <div className="h-4 w-px bg-slate-300"></div>
                    <button onClick={handleBulkDownload} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors" title="Скачать выделенные акты"><DownloadIcon className="w-4 h-4" /> Скачать</button>
                    <button onClick={() => { const idsToDelete = Array.from(selectedRows).map(idx => acts[idx].id); onRequestDelete(idsToDelete); }} className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800 font-medium transition-colors" title="Удалить выделенные акты"><DeleteIcon className="w-4 h-4" /> Удалить</button>
                </div>
            )}

            {starPopoverState && pinnedColumns[starPopoverState.colKey] && (() => {
                const pinInfo = pinnedColumns[starPopoverState.colKey];
                const isComplex = typeof pinInfo.payload === 'object';
                return (
                    <div className="absolute z-50 bg-white [.theme-dark_&]:bg-slate-800 border border-amber-300 [.theme-dark_&]:border-amber-700/50 shadow-xl rounded-lg p-3 w-64 animate-fade-in-up"
                         style={{ top: starPopoverState.position.top, left: starPopoverState.position.left }}
                         onMouseDown={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-amber-700 [.theme-dark_&]:text-amber-500 uppercase">Значение закреплено</span>
                            <StarIcon className="w-4 h-4 text-amber-500" filled />
                        </div>
                        <p className="text-[10px] text-slate-500 [.theme-dark_&]:text-slate-400 mb-3">
                            Акт источник: <strong>№{pinInfo.rowIndexDisplay}</strong>
                        </p>
                        
                        {!isComplex ? (
                            <div className="mb-3">
                                <label className="text-xs font-medium text-slate-700 [.theme-dark_&]:text-slate-300 mb-1 block">Ручной ввод значения:</label>
                                <textarea 
                                    className="w-full text-sm bg-white [.theme-dark_&]:bg-[#0d1117] text-slate-900 [.theme-dark_&]:text-slate-200 border border-slate-300 [.theme-dark_&]:border-slate-600 rounded p-1.5 focus:ring-1 focus:ring-amber-500 outline-none min-h-[60px] resize-y"
                                    value={pinInfo.payload || ''}
                                    onChange={(e) => {
                                        const newVal = e.target.value;
                                        setPinnedColumns(prev => ({
                                            ...prev,
                                            [starPopoverState.colKey]: {
                                                ...pinInfo,
                                                payload: newVal,
                                                previewText: newVal.length > 40 ? newVal.substring(0, 40) + '...' : newVal
                                            }
                                        }));
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="bg-slate-50 [.theme-dark_&]:bg-slate-900/50 p-2 rounded border border-slate-100 [.theme-dark_&]:border-slate-700 text-xs text-slate-600 [.theme-dark_&]:text-slate-400 mb-3 italic break-words">
                                "{pinInfo.previewText || '(Пусто)'}"
                            </div>
                        )}

                        <button onClick={() => handleUnpin(starPopoverState.colKey)}
                                className="w-full py-1.5 bg-red-50 [.theme-dark_&]:bg-red-900/20 text-red-600 [.theme-dark_&]:text-red-400 hover:bg-red-100 [.theme-dark_&]:hover:bg-red-900/40 rounded text-sm font-medium transition-colors border border-red-100 [.theme-dark_&]:border-red-900/50">
                            Отменить привязку
                        </button>
                    </div>
                );
            })()}

            {datePopoverState && <DateEditorPopover act={datePopoverState.act} onActChange={(updatedAct) => { handleSaveWithTemplateResolution(updatedAct); setDatePopoverState(prev => prev ? { ...prev, act: updatedAct } : null); }} onClose={() => setDatePopoverState(null)} position={datePopoverState.position} />}
            {singleDatePopoverState && <SingleDateEditorPopover act={singleDatePopoverState.act} onActChange={(updatedAct) => { handleSaveWithTemplateResolution(updatedAct); setSingleDatePopoverState(prev => prev ? { ...prev, act: updatedAct } : null); }} onClose={() => setSingleDatePopoverState(null)} position={singleDatePopoverState.position} />}
            {regulationPopoverState && <RegulationPopover regulation={regulationPopoverState.regulation} position={regulationPopoverState.position} onClose={() => setRegulationPopoverState(null)} onOpenDetails={() => { setFullRegulationDetails(regulationPopoverState.regulation); setRegulationPopoverState(null); }} />}
            
            {/* Окно управления материалами */}
            {materialPopoverState && (() => {
                const targetAct = acts.find(a => a.id === materialPopoverState.actId);
                if (!targetAct) return null;
                return (
                    <MaterialPopover 
                        certificate={materialPopoverState.certificate} 
                        act={targetAct}
                        position={materialPopoverState.position} 
                        onClose={() => setMaterialPopoverState(null)} 
                        onNavigate={onNavigateToCertificate ? (id) => { onNavigateToCertificate(id); setMaterialPopoverState(null); } : undefined} 
                        onUpdateAct={(updatedAct) => {
                            handleSaveWithTemplateResolution(updatedAct);
                        }}
                    />
                );
            })()}

            {linkMaterialModalState && <MaterialsModal isOpen={linkMaterialModalState.isOpen} onClose={() => setLinkMaterialModalState(null)} certificates={certificates || []} initialSearch={linkMaterialModalState.initialSearch} editingMaterialTitle={linkMaterialModalState.editingMaterialTitle} onSelect={(text) => { const act = acts.find(a => a.id === linkMaterialModalState.actId); if (act) { const items = act.materials.split(';').map(s => s.trim()); if (items[linkMaterialModalState.itemIndex] !== undefined) { items[linkMaterialModalState.itemIndex] = text; const updatedAct = { ...act, materials: items.join('; ') }; handleSaveWithTemplateResolution(updatedAct); } } setLinkMaterialModalState(null); }} />}
            
            {/* РЕНДЕР ОКОН ДЛЯ СХЕМ */}
            {schemePopoverState && (() => {
                const targetAct = acts.find(a => a.id === schemePopoverState.actId);
                if (!targetAct) return null;
                return (
                    <SchemesPopover
                        scheme={schemePopoverState.scheme}
                        act={targetAct}
                        position={schemePopoverState.position}
                        onClose={() => setSchemePopoverState(null)}
                        onNavigate={onNavigateToScheme ? () => { onNavigateToScheme(schemePopoverState.scheme.id); setSchemePopoverState(null); } : undefined}
                        onReplace={() => {
                            setLinkSchemeModalState({
                                isOpen: true,
                                actId: targetAct.id,
                                itemIndex: schemePopoverState.itemIndex,
                                initialSearch: schemePopoverState.scheme.number,
                                editingSchemeTitle: targetAct.certs.split(';')[schemePopoverState.itemIndex].trim()
                            });
                            setSchemePopoverState(null);
                        }}
                    />
                );
            })()}

            {linkSchemeModalState && (
                <SchemesModal
                    isOpen={linkSchemeModalState.isOpen}
                    onClose={() => setLinkSchemeModalState(null)}
                    schemes={schemes || []}
                    initialSearch={linkSchemeModalState.initialSearch}
                    editingSchemeTitle={linkSchemeModalState.editingSchemeTitle}
                    onSelect={(newText) => {
                        const act = acts.find(a => a.id === linkSchemeModalState.actId);
                        if (act) {
                            const items = act.certs.split(';').map(s => s.trim());
                            if (items[linkSchemeModalState.itemIndex] !== undefined) {
                                items[linkSchemeModalState.itemIndex] = newText;
                                const updatedAct = { ...act, certs: items.join('; ') };
                                handleSaveWithTemplateResolution(updatedAct);
                            }
                        }
                        setLinkSchemeModalState(null);
                    }}
                />
            )}

            {nextWorkPopoverState && <NextWorkPopover acts={acts} currentActId={acts[nextWorkPopoverState.rowIndex].id} position={nextWorkPopoverState.position} onClose={() => setNextWorkPopoverState(null)} onSelect={(selectedActOrId) => { const sourceAct = acts[nextWorkPopoverState.rowIndex]; if (sourceAct) { const updatedAct = { ...sourceAct }; if (selectedActOrId === AUTO_NEXT_ID) { updatedAct.nextWorkActId = AUTO_NEXT_ID; updatedAct.nextWork = ''; } else if (selectedActOrId && typeof selectedActOrId === 'object') { const selectedAct = selectedActOrId as Act; updatedAct.nextWork = `Работы по акту №${selectedAct.number || 'б/н'} (${selectedAct.workName || '...'})`; updatedAct.nextWorkActId = selectedAct.id; } else if (typeof selectedActOrId === 'string') { updatedAct.nextWork = selectedActOrId; updatedAct.nextWorkActId = undefined; } else { updatedAct.nextWork = ''; updatedAct.nextWorkActId = undefined; } handleSaveWithTemplateResolution(updatedAct); } setNextWorkPopoverState(null); }} />}
            {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}> <MenuItem label="Копировать" shortcut="Ctrl+C" icon={<CopyIcon className="w-4 h-4" />} onClick={() => { handleCopy(); setContextMenu(null); }} disabled={selectedCells.size === 0} /> <MenuItem label="Вставить" shortcut="Ctrl+V" icon={<PasteIcon className="w-4 h-4" />} onClick={() => { handlePaste(); setContextMenu(null); }} /> <MenuSeparator /> <MenuItem label="Очистить ячейки" shortcut="Del" onClick={() => { handleClearCells(); setContextMenu(null); }} disabled={selectedCells.size === 0} /> <MenuSeparator /> <MenuItem label="Вставить строку выше" icon={<RowAboveIcon className="w-4 h-4" />} onClick={() => { const newAct = applyPinsToNewAct(createNewAct()); onSave(newAct, contextMenu.rowIndex); setContextMenu(null); }} /> <MenuItem label="Вставить строку ниже" icon={<RowBelowIcon className="w-4 h-4" />} onClick={() => { const newAct = applyPinsToNewAct(createNewAct()); onSave(newAct, contextMenu.rowIndex + 1); setContextMenu(null); }} /> <MenuSeparator /> <MenuItem label="Удалить акт(ы)" icon={<DeleteIcon className="w-4 h-4 text-red-600" />} className="text-red-600 hover:bg-red-50" onClick={() => { const rowIndices = Array.from(affectedRowsFromSelection); const indicesToDelete = rowIndices.includes(contextMenu.rowIndex) ? rowIndices : [contextMenu.rowIndex]; const idsToDelete = indicesToDelete.map(idx => acts[idx].id); onRequestDelete(idsToDelete); setContextMenu(null); }} /> </ContextMenu>}
            {regulationsModalOpen && <RegulationsModal isOpen={regulationsModalOpen} onClose={() => setRegulationsModalOpen(false)} regulations={regulations} onSelect={handleRegulationsSelect} />}
            {fullRegulationDetails && <Modal isOpen={!!fullRegulationDetails} onClose={() => setFullRegulationDetails(null)} title="" hideHeader={true}> <RegulationDetails regulation={fullRegulationDetails} onClose={() => setFullRegulationDetails(null)} /> </Modal>}
        </div>
    );
};

export default ActsTable;