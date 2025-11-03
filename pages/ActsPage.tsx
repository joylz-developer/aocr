import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Act, Person, Organization, ProjectSettings, ROLES, CommissionGroup, Page, Coords } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import Modal from '../components/Modal';
import { PlusIcon, HelpIcon, ColumnsIcon } from '../components/Icons';
import ActsTable from '../components/ActsTable';
import { ALL_COLUMNS } from '../components/ActsTableConfig';

interface ActsPageProps {
    acts: Act[];
    people: Person[];
    organizations: Organization[];
    groups: CommissionGroup[];
    template: string | null;
    settings: ProjectSettings;
    onSave: (act: Act, index?: number) => void;
    onDelete: (id: string) => void;
    setCurrentPage: (page: Page) => void;
}

// Helper component for interactive tags in the help modal
const CopyableTag: React.FC<{ tag: string }> = ({ tag }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(tag);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500); // Reset after 1.5 seconds
    };

    return (
        <code
            onClick={handleCopy}
            className="bg-slate-200 text-blue-700 px-1.5 py-0.5 rounded-md cursor-pointer hover:bg-blue-200 transition-colors font-mono"
            title="Нажмите, чтобы скопировать"
        >
            {copied ? 'Скопировано!' : tag}
        </code>
    );
};

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


const ActsPage: React.FC<ActsPageProps> = ({ acts, people, organizations, groups, template, settings, onSave, onDelete, setCurrentPage }) => {
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [visibleColumns, setVisibleColumns] = useLocalStorage<Set<string>>(
        'acts_table_visible_columns_v3', 
        new Set(ALL_COLUMNS.map(c => c.key))
    );
    
    const [activeCell, setActiveCell] = useState<Coords | null>(null);
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

    const pickableColumns = useMemo(() => {
        return ALL_COLUMNS.filter(col => {
            if (col.key === 'date' && !settings.showActDate) return false;
            if (col.key === 'additionalInfo' && !settings.showAdditionalInfo) return false;
            if (col.key === 'attachments' && !settings.showAttachments) return false;
            if (col.key === 'copiesCount' && !settings.showCopiesCount) return false;
            return true;
        });
    }, [settings]);

    const handleCreateNewAct = () => {
        let insertionIndex = acts.length;

        if (selectedRows.size > 0) {
            const maxRow = Math.max(...Array.from(selectedRows));
            insertionIndex = maxRow + 1;
        } else if (selectedCells.size > 0) {
            const rowIndexes = Array.from(selectedCells).map(id => parseInt(id.split(':')[0], 10));
            const maxRow = Math.max(...rowIndexes);
            insertionIndex = maxRow + 1;
        }

        const newAct: Act = {
            id: crypto.randomUUID(),
            number: '', 
            date: new Date().toISOString().split('T')[0], // Default to today
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
        onSave(newAct, insertionIndex);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Акты скрытых работ</h1>
                    <button onClick={() => setIsHelpModalOpen(true)} className="text-slate-500 hover:text-blue-600" title="Справка">
                        <HelpIcon />
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <ColumnPicker 
                        pickableColumns={pickableColumns}
                        visibleColumns={visibleColumns} 
                        setVisibleColumns={setVisibleColumns} 
                    />
                    <button onClick={handleCreateNewAct} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                        <PlusIcon /> Создать акт
                    </button>
                </div>
            </div>
            
            <div className="flex-grow min-h-0">
                <ActsTable 
                    acts={acts}
                    people={people}
                    organizations={organizations}
                    groups={groups}
                    template={template}
                    settings={settings}
                    visibleColumns={visibleColumns}
                    onSave={onSave}
                    onDelete={onDelete}
                    setCurrentPage={setCurrentPage}
                    activeCell={activeCell}
                    setActiveCell={setActiveCell}
                    selectedCells={selectedCells}
                    setSelectedCells={setSelectedCells}
                    selectedRows={selectedRows}
                    setSelectedRows={setSelectedRows}
                />
            </div>
            
            <Modal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} title="Справка по заполнению шаблона">
                <div className="prose max-w-none text-slate-700 allow-text-selection">
                    <p>Для генерации документов ваш .docx шаблон должен содержать теги-заполнители. Приложение заменит эти теги на данные из формы. Нажмите на любой тег ниже, чтобы скопировать его.</p>
                    
                    <h4 className="font-semibold mt-4">Основные теги</h4>
                     <ul className="list-disc space-y-2 pl-5 mt-2">
                        <li><CopyableTag tag="{object_name}" /> &mdash; Наименование объекта.</li>
                        <li><CopyableTag tag="{act_number}" />, <CopyableTag tag="{act_day}" />, <CopyableTag tag="{act_month}" />, <CopyableTag tag="{act_year}" /></li>
                        <li><CopyableTag tag="{builder_details}" />, <CopyableTag tag="{contractor_details}" />, <CopyableTag tag="{designer_details}" />, <CopyableTag tag="{work_performer}" /></li>
                        <li><CopyableTag tag="{work_start_day}" />, <CopyableTag tag="{work_start_month}" />, <CopyableTag tag="{work_start_year}" /> &mdash; Дата начала работ.</li>
                        <li><CopyableTag tag="{work_end_day}" />, <CopyableTag tag="{work_end_month}" />, <CopyableTag tag="{work_end_year}" /> &mdash; Дата окончания работ.</li>
                        <li><CopyableTag tag="{regulations}" /> &mdash; Нормативные документы.</li>
                        <li><CopyableTag tag="{next_work}" /> &mdash; Разрешается производство следующих работ.</li>
                        <li><CopyableTag tag="{additional_info}" />, <CopyableTag tag="{copies_count}" />, <CopyableTag tag="{attachments}" /></li>
                    </ul>
                    
                    <h4 className="font-semibold mt-6">Выполненные работы</h4>
                    <ul className="list-disc space-y-2 pl-5 mt-2">
                        <li><CopyableTag tag="{work_name}" /> &mdash; Наименование работ.</li>
                        <li><CopyableTag tag="{project_docs}" /> &mdash; Проектная документация.</li>
                        <li><CopyableTag tag="{materials}" /> &mdash; Примененные материалы.</li>
                        <li><CopyableTag tag="{certs}" /> &mdash; Исполнительные схемы.</li>
                    </ul>

                    <h4 className="font-semibold mt-6">Представители (Комиссия)</h4>
                     <div className="my-2 p-3 rounded-md bg-blue-50 border border-blue-200">
                        <h5 className="font-semibold text-blue-800">✨ Важное обновление синтаксиса</h5>
                        <p className="text-sm mt-1">Для вставки данных представителей теперь рекомендуется использовать синтаксис с подчеркиванием, например <CopyableTag tag="{tnz_name}" />. Этот формат более надежен.</p>
                    </div>

                     <p className="mt-2">Используйте <strong>условные блоки</strong>, чтобы скрыть строки, если представитель не выбран. Для этого оберните нужный текст в теги <code>{`{#ключ}...{/ключ}`}</code>, где "ключ" - это код роли (например, <code>tnz</code>).</p>

                     <p className="mt-2 font-medium">Расшифровка ключей ролей:</p>
                     <ul className="list-disc space-y-2 pl-5 mt-2">
                         {Object.entries(ROLES).map(([key, description]) => (
                            <li key={key}>
                                <CopyableTag tag={key} /> &mdash; {description}
                            </li>
                         ))}
                    </ul>
                    <p className="mt-3">Полный список тегов для представителя (замените <strong>tnz</strong> на нужный ключ из списка выше):</p>
                    <ul className="list-disc space-y-1 pl-5">
                        <li><CopyableTag tag="{tnz_name}" />: ФИО, <CopyableTag tag="{tnz_position}" />: Должность, <CopyableTag tag="{tnz_org}" />: Организация, <CopyableTag tag="{tnz_auth_doc}" />: Документ, <CopyableTag tag="{tnz_details}" />: Сводная строка.</li>
                    </ul>
                </div>
            </Modal>
        </div>
    );
};

export default ActsPage;