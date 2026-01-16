
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Act, Person, Organization, ProjectSettings, ROLES, CommissionGroup, Page, Coords, Regulation, Certificate } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import Modal from '../components/Modal';
import { ColumnsIcon, SparklesIcon } from '../components/Icons';
import ActsTable from '../components/ActsTable';
import DeleteActsConfirmationModal from '../components/DeleteActsConfirmationModal';
import { ALL_COLUMNS } from '../components/ActsTableConfig';
import { GoogleGenAI } from '@google/genai';

interface ActsPageProps {
    acts: Act[];
    people: Person[];
    organizations: Organization[];
    groups: CommissionGroup[];
    regulations: Regulation[];
    certificates: Certificate[];
    template: string | null;
    registryTemplate?: string | null; // Added prop
    settings: ProjectSettings;
    onSave: (act: Act, insertAtIndex?: number) => void;
    onMoveToTrash: (ids: string[]) => void;
    onPermanentlyDelete: (ids: string[]) => void;
    onReorderActs: (newActs: Act[]) => void;
    setCurrentPage: (page: Page) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onNavigateToCertificate?: (id: string) => void;
}

const ColumnPicker: React.FC<{
    pickableColumns: typeof ALL_COLUMNS;
    visibleColumns: Set<string>;
    setVisibleColumns: (updater: (prev: Set<string>) => Set<string>) => void;
}> = ({ pickableColumns, visibleColumns, setVisibleColumns }) => {
    const [isOpen, setIsOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleToggleColumn = (key: string) => {
        setVisibleColumns(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

    return (
        <div className="relative" ref={pickerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-md hover:bg-slate-100 border border-slate-300"
                title="Настроить видимость колонок"
            >
                <ColumnsIcon /> Колонки
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-md shadow-lg z-50 p-4">
                    <h4 className="font-semibold text-slate-800 mb-3">Отображение колонок</h4>
                    <div className="flex flex-col space-y-2">
                    {pickableColumns.map(col => (
                        <label key={col.key} className="flex items-center space-x-3 text-sm text-slate-700 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="h-4 w-4 form-checkbox-custom"
                                checked={visibleColumns.has(col.key)}
                                onChange={() => handleToggleColumn(col.key)}
                            />
                            <span>{col.label}</span>
                        </label>
                    ))}
                    </div>
                </div>
            )}
        </div>
    );
};


const ActsPage: React.FC<ActsPageProps> = ({ acts, people, organizations, groups, regulations, certificates, template, registryTemplate, settings, onSave, onMoveToTrash, onPermanentlyDelete, onReorderActs, setCurrentPage, onUndo, onRedo, onNavigateToCertificate }) => {
    const [activeCell, setActiveCell] = useState<Coords | null>(null);
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [visibleColumns, setVisibleColumns] = useLocalStorage<Set<string>>(
        'acts_table_visible_columns_v4', 
        new Set(ALL_COLUMNS.filter(c => c.key !== 'id').map(c => c.key))
    );
    // New state for column order
    const [columnOrder, setColumnOrder] = useLocalStorage<string[]>(
        'acts_table_column_order',
        ALL_COLUMNS.map(c => c.key)
    );

    const [actsPendingDeletion, setActsPendingDeletion] = useState<Act[] | null>(null);
    
    // AI Edit State
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    
    const pickableColumns = useMemo(() => {
        return ALL_COLUMNS.filter(col => {
            if (col.key === 'date' && !settings.showActDate) return false;
            if (col.key === 'additionalInfo' && !settings.showAdditionalInfo) return false;
            if (col.key === 'attachments' && !settings.showAttachments) return false;
            if (col.key === 'copiesCount' && !settings.showCopiesCount) return false;
            return true;
        });
    }, [settings]);

    // Handle Global Undo/Redo Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if focus is in an input or textarea (native undo/redo takes precedence)
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const isCtrlKey = isMac ? e.metaKey : e.ctrlKey;

            if (isCtrlKey && e.code === 'KeyZ') {
                e.preventDefault();
                if (e.shiftKey) {
                    onRedo?.();
                } else {
                    onUndo?.();
                }
            } else if (isCtrlKey && e.code === 'KeyY' && !isMac) {
                // Windows standard Redo: Ctrl+Y
                e.preventDefault();
                onRedo?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onUndo, onRedo]);

    const createNewActFactory = () => {
         return {
            id: crypto.randomUUID(),
            number: '', 
            date: new Date().toISOString().split('T')[0],
            objectName: settings.objectName, 
            builderDetails: '', 
            contractorDetails: '',
            designerDetails: '', 
            workPerformer: '', 
            workName: '', 
            projectDocs: '', 
            materials: '', 
            certs: '',
            workStartDate: '', 
            workEndDate: '', 
            regulations: '', 
            nextWork: '', 
            additionalInfo: settings.defaultAdditionalInfo || '', 
            copiesCount: String(settings.defaultCopiesCount), 
            attachments: settings.defaultAttachments || '', 
            representatives: {},
        };
    };

    const handleRequestDelete = (actIds: string[]) => {
        const actsToDelete = acts.filter(a => actIds.includes(a.id));
        setActsPendingDeletion(actsToDelete);
    };

    const handleAiEditClick = () => {
        if (selectedCells.size === 0) {
            alert("Пожалуйста, выделите ячейки для редактирования.");
            return;
        }
        if (!settings.geminiApiKey) {
            alert("Пожалуйста, добавьте API ключ Gemini в настройках.");
            setCurrentPage('settings');
            return;
        }
        setIsAiModalOpen(true);
    };

    const handleAiEditSubmit = async () => {
        if (!aiPrompt.trim()) return;
        setAiLoading(true);

        try {
            // Reconstruct visible columns logic to map colIndex to key
            const colMap = new Map(ALL_COLUMNS.map(col => [col.key, col]));
            const orderedCols = columnOrder
                .filter(key => colMap.has(key as any) && visibleColumns.has(key))
                .map(key => colMap.get(key as any)!);
            
            const finalCols = [...orderedCols, ...ALL_COLUMNS.filter(c => visibleColumns.has(c.key) && !orderedCols.some(oc => oc.key === c.key))].filter(col => {
                 if (col.key === 'date' && !settings.showActDate) return false;
                if (col.key === 'additionalInfo' && !settings.showAdditionalInfo) return false;
                if (col.key === 'attachments' && !settings.showAttachments) return false;
                if (col.key === 'copiesCount' && !settings.showCopiesCount) return false;
                return true;
            });

            // Track unique columns involved in the selection to tailor the prompt
            const involvedFieldKeys = new Set<string>();

            const cellsToUpdate = Array.from(selectedCells).map(cellId => {
                const [rowIndex, colIndex] = cellId.split(':').map(Number);
                const act = acts[rowIndex];
                const col = finalCols[colIndex];
                if (!act || !col) return null;
                
                involvedFieldKeys.add(col.key);

                // Special handling for calculated/virtual fields if needed, 
                // but for editing we mainly care about direct properties
                let value = '';
                 if (col.key === 'workDates') {
                     value = `${act.workStartDate} - ${act.workEndDate}`;
                 } else {
                     // @ts-ignore
                     value = act[col.key] || '';
                 }
                
                return {
                    id: act.id,
                    field: col.key,
                    value: value
                };
            }).filter(Boolean);

            if (cellsToUpdate.length === 0) return;

            const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey! });
            
            // Define data formats for specific columns
            const columnRules: Record<string, string> = {
                number: "String/Number. Act number (e.g. '1', '14-A').",
                date: "Date (YYYY-MM-DD). Date of the act signing.",
                workDates: "Date Range (YYYY-MM-DD - YYYY-MM-DD). Start and End date of works.",
                workName: "Text. Specific construction work description (e.g. 'Installation of concrete foundations').",
                projectDocs: "Text. References to project drawings/sheets.",
                materials: "Text. List of materials used (name, brand, certificate).",
                certs: "Text. Executive schemes and drawings.",
                regulations: "Text. Building codes and regulations (SNiP, SP, GOST).",
                nextWork: "Text. Description of next construction stage allowed.",
                additionalInfo: "Text. Any additional notes.",
                copiesCount: "Integer. Number of copies.",
                attachments: "Text. List of attached documents.",
                commissionGroup: "Text. Name of the commission group."
            };

            const involvedColumnsInfo = Array.from(involvedFieldKeys).map(key => {
                const colDef = ALL_COLUMNS.find(c => c.key === key);
                return `- Field "${key}" (${colDef?.label}): ${columnRules[key] || "Text"}`;
            }).join('\n');

            const prompt = `
                I have a list of table cells from a Construction Act (AOSR) document.
                
                User Instruction: "${aiPrompt}"
                
                You must update the cell values based on the User Instruction.
                
                CRITICAL: You must strictly follow the data format for each column type defined below.
                If the user asks to "generate data", generate realistic Russian construction data appropriate for each specific column.
                
                Column Definitions and Formats:
                ${involvedColumnsInfo}
                
                Current Cells Data (JSON):
                ${JSON.stringify(cellsToUpdate)}
                
                Output Rule:
                - Return the updated values in JSON format as an array of objects.
                - Format: [ { "id": "record_id", "field": "field_key", "value": "new_value" }, ... ]
                - Do not include markdown formatting. Just the raw JSON string.
                - Dates MUST be YYYY-MM-DD.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: "application/json" }
            });

            const result = JSON.parse(response.text);
            
            if (Array.isArray(result)) {
                result.forEach((update: any) => {
                    const actToUpdate = acts.find(a => a.id === update.id);
                    if (actToUpdate) {
                         const newAct = { ...actToUpdate };
                         if (update.field === 'workDates') {
                             const parts = update.value.split(' - ').map((s: string) => s.trim());
                             newAct.workStartDate = parts[0] || '';
                             newAct.workEndDate = parts[1] || parts[0] || '';
                         } else {
                             // @ts-ignore
                             newAct[update.field] = update.value;
                         }
                         onSave(newAct);
                    }
                });
            }
            
            setIsAiModalOpen(false);
            setAiPrompt('');
        } catch (error) {
            console.error(error);
            alert("Ошибка при обработке AI запроса.");
        } finally {
            setAiLoading(false);
        }
    };


    return (
        <div className="bg-white p-4 sm:p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Акты скрытых работ</h1>
                </div>
                <div className="flex items-center gap-3">
                     <button 
                        onClick={handleAiEditClick}
                        disabled={selectedCells.size === 0}
                        className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white px-4 py-2 rounded-md hover:from-violet-600 hover:to-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                        title="Редактировать выделенные ячейки с помощью AI"
                    >
                        <SparklesIcon className="w-5 h-5" /> AI Редактор
                    </button>
                    <ColumnPicker 
                        pickableColumns={pickableColumns}
                        visibleColumns={visibleColumns} 
                        setVisibleColumns={setVisibleColumns} 
                    />
                </div>
            </div>
            
            <div className="flex-grow min-h-0">
                <ActsTable 
                    acts={acts}
                    people={people}
                    organizations={organizations}
                    groups={groups}
                    regulations={regulations}
                    certificates={certificates}
                    template={template}
                    settings={settings}
                    visibleColumns={visibleColumns}
                    columnOrder={columnOrder}
                    onColumnOrderChange={setColumnOrder}
                    activeCell={activeCell}
                    setActiveCell={setActiveCell}
                    selectedCells={selectedCells}
                    setSelectedCells={setSelectedCells}
                    createNewAct={createNewActFactory}
                    onSave={onSave}
                    onRequestDelete={handleRequestDelete}
                    onReorderActs={onReorderActs}
                    setCurrentPage={setCurrentPage}
                    onNavigateToCertificate={onNavigateToCertificate}
                    density="standard"
                />
            </div>
            
            {actsPendingDeletion && (
                <DeleteActsConfirmationModal
                    isOpen={!!actsPendingDeletion}
                    onClose={() => setActsPendingDeletion(null)}
                    actsToDelete={actsPendingDeletion}
                    allActs={acts}
                    onConfirm={(finalActIdsToDelete) => {
                        onMoveToTrash(finalActIdsToDelete);
                        setActsPendingDeletion(null);
                    }}
                    onDeletePermanently={(finalActIdsToDelete) => {
                        onPermanentlyDelete(finalActIdsToDelete);
                        setActsPendingDeletion(null);
                    }}
                />
            )}
            
            <Modal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} title="AI Редактор ячеек">
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                        Опишите, как нужно изменить данные в выделенных ячейках ({selectedCells.size} шт.).
                    </p>
                    <textarea
                        className="w-full h-32 p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none resize-none"
                        placeholder="Например: 'Переведи на английский', 'Исправь опечатки', 'Сгенерируй случайные даты'..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        autoFocus
                    />
                    <div className="flex justify-end gap-3 pt-2">
                        <button 
                            onClick={() => setIsAiModalOpen(false)}
                            className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                        >
                            Отмена
                        </button>
                        <button 
                            onClick={handleAiEditSubmit}
                            disabled={aiLoading || !aiPrompt.trim()}
                            className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {aiLoading ? 'Обработка...' : <><SparklesIcon className="w-4 h-4" /> Выполнить</>}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ActsPage;
