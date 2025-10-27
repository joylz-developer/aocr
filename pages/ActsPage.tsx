import React, { useState, useCallback } from 'react';
// FIX: Import ROLES to resolve reference error.
import { Act, Person, Organization, ProjectSettings, ROLES } from '../types';
import Modal from '../components/Modal';
import { PlusIcon, HelpIcon } from '../components/Icons';
import ActsTable from '../components/ActsTable';

interface ActsPageProps {
    acts: Act[];
    people: Person[];
    organizations: Organization[];
    template: string | null;
    settings: ProjectSettings;
    onSave: (act: Act) => void;
    onDelete: (id: string) => void;
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


const ActsPage: React.FC<ActsPageProps> = ({ acts, people, organizations, template, settings, onSave, onDelete }) => {
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    
    // This is a new handler to add an empty act row to the table
    const handleCreateNewAct = () => {
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
            additionalInfo: '', 
            copiesCount: String(settings.defaultCopiesCount), 
            attachments: '', 
            representatives: {},
        };
        onSave(newAct);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Акты скрытых работ</h1>
                    <button onClick={() => setIsHelpModalOpen(true)} className="text-slate-500 hover:text-blue-600" title="Справка">
                        <HelpIcon />
                    </button>
                </div>
                <button onClick={handleCreateNewAct} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    <PlusIcon /> Создать акт
                </button>
            </div>

            <ActsTable 
                acts={acts}
                people={people}
                organizations={organizations}
                template={template}
                settings={settings}
                onSave={onSave}
                onDelete={onDelete}
            />
            
            <Modal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} title="Справка по заполнению шаблона">
                <div className="prose max-w-none text-slate-700">
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
                        <li><CopyableTag tag="{certs}" /> &mdash; Документы о качестве (сертификаты, паспорта).</li>
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
