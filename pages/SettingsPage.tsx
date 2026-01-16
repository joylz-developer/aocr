
import React, { useState, useEffect } from 'react';
import { ProjectSettings, ROLES } from '../types';
import { ImportIcon, ExportIcon, TemplateIcon, DownloadIcon, DeleteIcon, CloudUploadIcon } from '../components/Icons';

interface SettingsPageProps {
    settings: ProjectSettings;
    onSave: (settings: ProjectSettings) => void;
    onImport: () => void;
    onExport: () => void;
    onChangeTemplate: () => void;
    onDownloadTemplate: () => void;
    isTemplateLoaded: boolean;
    // Registry Props
    isRegistryTemplateLoaded?: boolean;
    onUploadRegistryTemplate?: (file: File) => void;
    onDownloadRegistryTemplate?: () => void;
    onDeleteRegistryTemplate?: () => void;
}

// Helper component for interactive tags in the help tab
const CopyableTag: React.FC<{ tag: string; description?: string }> = ({ tag, description }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(tag);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500); // Reset after 1.5 seconds
    };

    return (
        <div className="relative inline-block group mr-1.5 align-middle">
            <code
                onClick={handleCopy}
                className="bg-slate-200 text-blue-700 px-1.5 py-0.5 rounded-md cursor-pointer hover:bg-blue-200 transition-colors font-mono text-sm border border-slate-300 select-none whitespace-nowrap"
                title={description ? undefined : "Нажмите, чтобы скопировать"}
            >
                {copied ? 'Скопировано!' : tag}
            </code>
            {description && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[250px] px-3 py-2 bg-slate-800 text-white text-xs rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 text-center whitespace-normal leading-snug">
                    {description}
                    {/* Triangle Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                </div>
            )}
        </div>
    );
};

const VariableHelpTooltip: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    const variables = [
        { name: '{number}', desc: 'Номер акта' },
        { name: '{objectName}', desc: 'Наименование объекта' },
        { name: '{workName}', desc: 'Наименование работ' },
        { name: '{projectDocs}', desc: 'Проектная документация' },
        { name: '{materials}', desc: 'Примененные материалы' },
        { name: '{certs}', desc: 'Исполнительные схемы' },
        { name: '{workStartDate}', desc: 'Дата начала работ' },
        { name: '{workEndDate}', desc: 'Дата окончания работ' },
        { name: '{regulations}', desc: 'Нормативные документы' },
        { name: '{nextWork}', desc: 'Следующие работы' },
        { name: '{copiesCount}', desc: 'Количество экземпляров' },
    ];

    return (
        <div className="relative inline-flex ml-2" onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
            <button type="button" className="text-slate-400 hover:text-blue-600 focus:outline-none" aria-label="Показать доступные переменные">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </button>
            {isVisible && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-slate-800 text-white text-sm rounded-lg shadow-lg p-3 z-10">
                    <h4 className="font-bold mb-2">Доступные переменные:</h4>
                    <ul className="space-y-1">
                        {variables.map(v => (
                             <li key={v.name} className="flex justify-between">
                                <code className="text-cyan-300">{v.name}</code>
                                <span className="text-slate-300 text-right">{v.desc}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-slate-800 -mb-2"></div>
                </div>
            )}
        </div>
    );
};


interface SettingToggleProps {
    id: keyof ProjectSettings;
    label: string;
    description?: string;
    children?: React.ReactNode;
    formData: ProjectSettings;
    handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SettingToggle: React.FC<SettingToggleProps> = ({ id, label, description, children, formData, handleChange }) => (
    <div className="relative flex items-start">
        <div className="flex h-6 items-center">
            <input
                id={id}
                name={id}
                type="checkbox"
                checked={!!formData[id]}
                onChange={handleChange}
                className="h-4 w-4 form-checkbox-custom"
            />
        </div>
        <div className="ml-3 text-sm leading-6 flex-1">
            <label htmlFor={id} className="font-medium text-gray-900 cursor-pointer">
                {label}
            </label>
            {description && <p className="text-xs text-slate-500">{description}</p>}
            {children}
        </div>
    </div>
);

type SettingsTab = 'general' | 'data' | 'help';
type HelpSection = 'main' | 'registry'; // New type for help sub-tabs

const SettingsPage: React.FC<SettingsPageProps> = ({ 
    settings, onSave, onImport, onExport, 
    onChangeTemplate, onDownloadTemplate, isTemplateLoaded,
    isRegistryTemplateLoaded, onUploadRegistryTemplate, onDownloadRegistryTemplate, onDeleteRegistryTemplate
}) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [helpSection, setHelpSection] = useState<HelpSection>('main'); // State for help sub-tabs
    const [formData, setFormData] = useState<ProjectSettings>(settings);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        setFormData(settings);
    }, [settings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }));
    };
    
    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
         const { name, value } = e.target;
         setFormData(prev => ({
            ...prev,
            [name]: parseInt(value, 10) || 0,
        }));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
    };
    
    const handleRegistryFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && onUploadRegistryTemplate) {
            onUploadRegistryTemplate(file);
            event.target.value = ''; // Reset input
        }
    };
    
    const inputClass = "mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900";
    const labelClass = "block text-sm font-medium text-slate-700";

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md h-full flex flex-col max-w-4xl mx-auto overflow-hidden">
            {/* Header */}
            <div className="p-6 pb-0 flex-shrink-0">
                <h1 className="text-2xl font-bold text-slate-800 mb-6">Настройки и Справка</h1>
                
                {/* Tabs */}
                <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
                    <button
                        type="button"
                        onClick={() => setActiveTab('general')}
                        className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Общие настройки
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('data')}
                        className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'data' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Данные и Шаблон
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('help')}
                        className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'help' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Справка по тегам
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-y-auto p-6">
                {activeTab === 'general' && (
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="objectName" className={labelClass}>
                                Наименование объекта капитального строительства
                            </label>
                            <textarea
                                id="objectName"
                                name="objectName"
                                value={formData.objectName}
                                onChange={handleChange}
                                className={inputClass}
                                rows={3}
                                required
                            />
                            <p className="text-xs text-slate-500 mt-1">Это название будет автоматически подставляться во все новые акты.</p>
                        </div>
                        
                        <div>
                            <label htmlFor="geminiApiKey" className={labelClass}>
                                Gemini API Key
                            </label>
                            <input
                                type="password"
                                id="geminiApiKey"
                                name="geminiApiKey"
                                value={formData.geminiApiKey || ''}
                                onChange={handleChange}
                                className={inputClass}
                                placeholder="Введите ваш API ключ"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Получите ваш ключ в <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>.
                                Ключ хранится локально в вашем браузере.
                            </p>
                        </div>

                        <fieldset className="space-y-4 pt-4 border-t">
                            <legend className="text-base font-medium text-slate-800">Автоматизация реестра материалов</legend>
                            <SettingToggle id="enableMaterialRegistry" label="Генерировать отдельный реестр материалов" description="Если количество материалов превышает порог, будет создан дополнительный документ реестра." formData={formData} handleChange={handleChange}>
                                {formData.enableMaterialRegistry && (
                                    <div className="mt-2 pl-1">
                                        <label htmlFor="materialRegistryThreshold" className="block text-xs font-medium text-slate-600 mb-1">
                                            Порог срабатывания (кол-во материалов)
                                        </label>
                                        <input
                                            type="number"
                                            id="materialRegistryThreshold"
                                            name="materialRegistryThreshold"
                                            value={formData.materialRegistryThreshold ?? 5}
                                            onChange={handleNumberChange}
                                            className="w-20 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                            min="1"
                                        />
                                    </div>
                                )}
                            </SettingToggle>
                        </fieldset>

                        <fieldset className="space-y-4 pt-4 border-t">
                            <legend className="text-base font-medium text-slate-800">Настройки ИИ (Сканирование сертификатов)</legend>
                            <p className="text-xs text-slate-500 mb-4">Настройте, как ИИ должен искать информацию в документах. Пишите простым языком.</p>
                            
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="certificatePromptNumber" className={labelClass}>
                                        Правило поиска Номера документа
                                    </label>
                                    <textarea
                                        id="certificatePromptNumber"
                                        name="certificatePromptNumber"
                                        value={formData.certificatePromptNumber || ''}
                                        onChange={handleChange}
                                        className={`${inputClass} text-sm`}
                                        rows={2}
                                        placeholder="Что искать в поле номера..."
                                    />
                                </div>

                                <div>
                                    <label htmlFor="certificatePromptDate" className={labelClass}>
                                        Правило поиска Даты документа
                                    </label>
                                    <textarea
                                        id="certificatePromptDate"
                                        name="certificatePromptDate"
                                        value={formData.certificatePromptDate || ''}
                                        onChange={handleChange}
                                        className={`${inputClass} text-sm`}
                                        rows={2}
                                        placeholder="Какую дату искать..."
                                    />
                                </div>

                                <div>
                                    <label htmlFor="certificatePromptMaterials" className={labelClass}>
                                        Правило поиска Материалов
                                    </label>
                                    <textarea
                                        id="certificatePromptMaterials"
                                        name="certificatePromptMaterials"
                                        value={formData.certificatePromptMaterials || ''}
                                        onChange={handleChange}
                                        className={`${inputClass} text-sm`}
                                        rows={3}
                                        placeholder="Как описывать материалы..."
                                    />
                                </div>
                            </div>
                        </fieldset>

                        <fieldset className="space-y-4 pt-4 border-t">
                            <legend className="text-base font-medium text-slate-800">Настройки формы акта</legend>

                            <div>
                                <label htmlFor="historyDepth" className={labelClass}>
                                    Количество действий для отмены (History Undo/Redo)
                                </label>
                                <input
                                    type="number"
                                    id="historyDepth"
                                    name="historyDepth"
                                    value={formData.historyDepth ?? 20}
                                    onChange={handleNumberChange}
                                    className={inputClass}
                                    min="1"
                                    max="500"
                                />
                                <p className="text-xs text-slate-500 mt-1">Сколько последних изменений сохранять для возможности отмены (Ctrl+Z).</p>
                            </div>

                            <SettingToggle id="showAdditionalInfo" label='Показывать поле "Дополнительные сведения"' formData={formData} handleChange={handleChange}>
                                <div className="mt-2">
                                    <label htmlFor="defaultAdditionalInfo" className="flex items-center text-xs font-medium text-slate-600 mb-1">
                                        <span>Значение по умолчанию</span>
                                        <VariableHelpTooltip />
                                    </label>
                                    <textarea id="defaultAdditionalInfo" name="defaultAdditionalInfo" value={formData.defaultAdditionalInfo || ''} onChange={handleChange} className={`${inputClass} text-sm`} rows={2} placeholder="Например: Работы выполнены в соответствии с..." />
                                    <p className="text-xs text-slate-500 mt-1">
                                        <strong className="text-amber-700">Внимание:</strong> при изменении других полей акта, это поле будет автоматически обновляться, перезаписывая ручной ввод.
                                    </p>
                                </div>
                            </SettingToggle>

                            <SettingToggle id="showAttachments" label='Показывать поле "Приложения"' formData={formData} handleChange={handleChange}>
                                <div className="mt-2">
                                    <label htmlFor="defaultAttachments" className="flex items-center text-xs font-medium text-slate-600 mb-1">
                                        <span>Значение по умолчанию</span>
                                        <VariableHelpTooltip />
                                    </label>
                                    <textarea id="defaultAttachments" name="defaultAttachments" value={formData.defaultAttachments || ''} onChange={handleChange} className={`${inputClass} text-sm`} rows={2} placeholder="Например: Исполнительные схемы: {certs}" />
                                    <p className="text-xs text-slate-500 mt-1">
                                        <strong className="text-amber-700">Внимание:</strong> при изменении других полей акта, это поле будет автоматически обновляться, перезаписывая ручной ввод.
                                    </p>
                                </div>
                            </SettingToggle>

                            <SettingToggle id="showCopiesCount" label='Показывать поле "Количество экземпляров"' formData={formData} handleChange={handleChange}>
                                <div className="mt-2">
                                    <label htmlFor="defaultCopiesCount" className="block text-xs font-medium text-slate-600 mb-1">
                                        Количество экземпляров по умолчанию
                                    </label>
                                    <input type="number" id="defaultCopiesCount" name="defaultCopiesCount" value={formData.defaultCopiesCount} onChange={handleNumberChange} className={inputClass} min="1" required />
                                </div>
                            </SettingToggle>
                            
                            <SettingToggle id="showActDate" label='Показывать поле "Дата акта"' description="Полезно, если нужно вручную корректировать дату." formData={formData} handleChange={handleChange}>
                                <div className="mt-2">
                                    <label htmlFor="defaultActDate" className="flex items-center text-xs font-medium text-slate-600 mb-1">
                                        <span>Значение по умолчанию</span>
                                        <VariableHelpTooltip />
                                    </label>
                                    <input 
                                        type="text" 
                                        id="defaultActDate" 
                                        name="defaultActDate" 
                                        value={formData.defaultActDate || ''} 
                                        onChange={handleChange} 
                                        className={`${inputClass} text-sm`} 
                                        placeholder="По умолчанию: {workEndDate}" 
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        По умолчанию дата акта равна дате окончания работ.
                                    </p>
                                </div>
                            </SettingToggle>
                            
                            <SettingToggle id="showParticipantDetails" label='Показывать раздел "Реквизиты участников"' description="Этот раздел в модальном окне редактирования участников заполняется автоматически, его можно скрыть для экономии места." formData={formData} handleChange={handleChange}/>

                        </fieldset>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-6">
                        <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
                            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                                <ImportIcon className="w-5 h-5"/> Управление данными
                            </h3>
                            <p className="text-sm text-slate-600 mb-4">
                                Вы можете сохранить резервную копию выбранных данных в файл JSON или восстановить данные из файла.
                            </p>
                            <div className="flex gap-3">
                                <button 
                                    type="button"
                                    onClick={onImport}
                                    className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 shadow-sm"
                                >
                                    <ImportIcon className="w-4 h-4" /> Импорт данных
                                </button>
                                <button 
                                    type="button"
                                    onClick={onExport}
                                    className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 shadow-sm"
                                >
                                    <ExportIcon className="w-4 h-4" /> Экспорт данных
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
                            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                                <TemplateIcon className="w-5 h-5"/> Основной шаблон (АОСР)
                            </h3>
                            <p className="text-sm text-slate-600 mb-4">
                                Текущий шаблон используется для генерации всех актов.
                            </p>
                            <div className="flex gap-3">
                                <button 
                                    type="button"
                                    onClick={onChangeTemplate}
                                    className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 shadow-sm"
                                >
                                    <TemplateIcon className="w-4 h-4" /> Сменить шаблон
                                </button>
                                <button 
                                    type="button"
                                    onClick={onDownloadTemplate}
                                    disabled={!isTemplateLoaded}
                                    className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <DownloadIcon className="w-4 h-4" /> Скачать текущий
                                </button>
                            </div>
                        </div>

                        {onUploadRegistryTemplate && (
                            <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
                                <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                                    <TemplateIcon className="w-5 h-5 text-violet-600"/> Реестр материалов (Шаблон)
                                </h3>
                                <p className="text-sm text-slate-600 mb-4">
                                    Шаблон используется, если количество материалов превышает установленный порог.
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    <div className="relative">
                                        <input
                                            type="file"
                                            id="registry-upload"
                                            className="hidden"
                                            accept=".docx"
                                            onChange={handleRegistryFileChange}
                                        />
                                        <label 
                                            htmlFor="registry-upload"
                                            className="cursor-pointer flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 shadow-sm"
                                        >
                                            <CloudUploadIcon className="w-4 h-4" /> {isRegistryTemplateLoaded ? 'Заменить шаблон' : 'Загрузить шаблон'}
                                        </label>
                                    </div>
                                    
                                    <button 
                                        type="button"
                                        onClick={onDownloadRegistryTemplate}
                                        disabled={!isRegistryTemplateLoaded}
                                        className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <DownloadIcon className="w-4 h-4" /> Скачать
                                    </button>

                                    {isRegistryTemplateLoaded && onDeleteRegistryTemplate && (
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                if(confirm("Удалить шаблон реестра?")) onDeleteRegistryTemplate();
                                            }}
                                            className="flex items-center gap-2 bg-white text-red-600 border border-red-200 px-4 py-2 rounded-md hover:bg-red-50 shadow-sm"
                                        >
                                            <DeleteIcon className="w-4 h-4" /> Удалить
                                        </button>
                                    )}
                                </div>
                                {isRegistryTemplateLoaded ? (
                                    <p className="text-xs text-green-600 mt-2 font-medium">✓ Шаблон загружен</p>
                                ) : (
                                    <p className="text-xs text-slate-400 mt-2">Шаблон не загружен (будет использоваться только АОСР)</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'help' && (
                    <div className="prose max-w-none text-slate-700 allow-text-selection pb-10">
                        {/* Sub-tabs for Help Sections */}
                        <div className="flex border-b border-slate-200 mb-6">
                            <button
                                type="button"
                                onClick={() => setHelpSection('main')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                    helpSection === 'main'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                }`}
                            >
                                Шаблон Акта (АОСР)
                            </button>
                            <button
                                type="button"
                                onClick={() => setHelpSection('registry')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                    helpSection === 'registry'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                }`}
                            >
                                Шаблон Реестра Материалов
                            </button>
                        </div>

                        {helpSection === 'main' && (
                            <>
                                <p className="mb-4 text-sm bg-blue-50 p-3 rounded-md border border-blue-100">
                                    Этот набор тегов используется для основного шаблона (формат .docx), который генерируется для каждого акта.
                                    Наведите курсор на тег, чтобы увидеть описание. Нажмите, чтобы скопировать.
                                </p>
                                
                                <h4 className="font-semibold mt-4">Основные теги</h4>
                                <ul className="list-disc space-y-2 pl-5 mt-2">
                                    <li><CopyableTag tag="{object_name}" description="Полное наименование объекта строительства (из настроек)" /> &mdash; Наименование объекта.</li>
                                    <li>
                                        <CopyableTag tag="{act_number}" description="Номер текущего акта" />, 
                                        <CopyableTag tag="{act_day}" description="День подписания (01-31)" />, 
                                        <CopyableTag tag="{act_month}" description="Месяц подписания (01-12)" />, 
                                        <CopyableTag tag="{act_year}" description="Год подписания (4 цифры)" />
                                    </li>
                                    <li>
                                        <CopyableTag tag="{builder_details}" description="Реквизиты Застройщика" />, 
                                        <CopyableTag tag="{contractor_details}" description="Реквизиты Лица, осуществляющего строительство" />, 
                                        <CopyableTag tag="{designer_details}" description="Реквизиты Проектировщика" />, 
                                        <CopyableTag tag="{work_performer}" description="Реквизиты Исполнителя работ" />
                                    </li>
                                    <li>
                                        <CopyableTag tag="{work_start_day}" description="День начала работ" />, 
                                        <CopyableTag tag="{work_start_month}" description="Месяц начала работ" />, 
                                        <CopyableTag tag="{work_start_year}" description="Год начала работ" /> &mdash; Дата начала работ.
                                    </li>
                                    <li>
                                        <CopyableTag tag="{work_end_day}" description="День окончания работ" />, 
                                        <CopyableTag tag="{work_end_month}" description="Месяц окончания работ" />, 
                                        <CopyableTag tag="{work_end_year}" description="Год окончания работ" /> &mdash; Дата окончания работ.
                                    </li>
                                    <li><CopyableTag tag="{regulations}" description="Перечень нормативных документов (СП, ГОСТ)" /> &mdash; Нормативные документы.</li>
                                    <li><CopyableTag tag="{next_work}" description="Разрешенные последующие работы" /> &mdash; Разрешается производство следующих работ.</li>
                                    <li>
                                        <CopyableTag tag="{additional_info}" description="Дополнительные сведения из формы" />, 
                                        <CopyableTag tag="{copies_count}" description="Количество экземпляров акта" />, 
                                        <CopyableTag tag="{attachments}" description="Список приложений к акту" />
                                    </li>
                                </ul>
                                
                                <h4 className="font-semibold mt-6">Выполненные работы</h4>
                                <ul className="list-disc space-y-2 pl-5 mt-2">
                                    <li><CopyableTag tag="{work_name}" description="Наименование скрытых работ" /> &mdash; Наименование работ.</li>
                                    <li><CopyableTag tag="{project_docs}" description="Шифр проекта, номера чертежей" /> &mdash; Проектная документация.</li>
                                    <li><CopyableTag tag="{materials}" description="Список материалов и документов (строкой)" /> &mdash; Примененные материалы (одной строкой).</li>
                                    <li><CopyableTag tag="{certs}" description="Список исполнительных схем" /> &mdash; Исполнительные схемы.</li>
                                </ul>

                                <h4 className="font-semibold mt-6">Представители (Комиссия)</h4>
                                <div className="my-2 p-3 rounded-md bg-white border border-slate-200 shadow-sm">
                                    <p className="text-sm">Используйте <strong>условные блоки</strong>, чтобы скрыть строки, если представитель не выбран. Для этого оберните нужный текст в теги <code>{`{#ключ}...{/ключ}`}</code>.</p>
                                </div>

                                <ul className="list-disc space-y-2 pl-5 text-sm mt-3">
                                    {Object.entries(ROLES).map(([key, label]) => (
                                        <li key={key} className="leading-relaxed mb-2">
                                            <strong>{label}</strong> (код: <code>{key}</code>)<br/>
                                            Теги: 
                                            <CopyableTag tag={`{${key}_name}`} description={`ФИО представителя: ${label}`} />
                                            <CopyableTag tag={`{${key}_position}`} description={`Должность представителя: ${label}`} />
                                            <CopyableTag tag={`{${key}_org}`} description={`Организация представителя: ${label}`} />
                                            <CopyableTag tag={`{${key}_auth_doc}`} description={`Приказ/Доверенность: ${label}`} />
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}

                        {helpSection === 'registry' && (
                            <>
                                <p className="mb-4 text-sm bg-violet-50 p-3 rounded-md border border-violet-100 text-violet-800">
                                    Этот набор тегов используется <strong>только</strong> для шаблона Реестра материалов.
                                    Файл шаблона должен быть в формате <strong>.docx</strong> (Word), но содержать таблицу, похожую на Excel.
                                </p>

                                <div className="bg-white p-4 rounded-md border border-slate-200 shadow-sm mb-6">
                                    <h5 className="font-semibold text-slate-800 mb-2">Как создать таблицу в Word:</h5>
                                    <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
                                        <li>Создайте таблицу в Word с нужным количеством столбцов (например: № п/п, Наименование, Документ, Дата, Кол-во).</li>
                                        <li>В <strong>первую ячейку</strong> строки данных добавьте открывающий тег цикла: <CopyableTag tag="{#materials_registry}" description="Начало цикла списка материалов (ставить в первой ячейке строки)" /></li>
                                        <li>Заполните остальные ячейки тегами данных (см. ниже).</li>
                                        <li>В <strong>последнюю ячейку</strong> той же строки добавьте закрывающий тег: <CopyableTag tag="{/materials_registry}" description="Конец цикла списка материалов (ставить в последней ячейке строки)" /></li>
                                    </ol>
                                </div>

                                <h4 className="font-semibold mt-4">Теги столбцов таблицы</h4>
                                <ul className="list-disc space-y-2 pl-5 mt-2">
                                    <li><CopyableTag tag="{num}" description="Порядковый номер в списке (1, 2, 3...)" /> &mdash; Порядковый номер (1, 2, 3...)</li>
                                    <li><CopyableTag tag="{name}" description="Название материала (без инфо о сертификате)" /> &mdash; Наименование материала (извлекается из акта)</li>
                                    <li><CopyableTag tag="{doc}" description="Номер и тип документа о качестве" /> &mdash; Документ о качестве (извлекается из скобок в названии материала)</li>
                                    <li><CopyableTag tag="{date}" description="Дата документа о качестве" /> &mdash; Дата документа (если найдена)</li>
                                    <li><CopyableTag tag="{count}" description="Пустое поле для ввода количества" /> &mdash; Кол-во листов (по умолчанию пустое поле)</li>
                                </ul>

                                <h4 className="font-semibold mt-6">Общие данные акта</h4>
                                <p className="text-sm text-slate-600 mb-2">Эти теги берутся из основного акта и доступны для использования в шапке или подвале реестра:</p>
                                <ul className="list-disc space-y-2 pl-5 mt-2">
                                    <li><CopyableTag tag="{object_name}" description="Наименование объекта строительства" /> &mdash; Наименование объекта.</li>
                                    <li><CopyableTag tag="{act_number}" description="Номер акта" /> &mdash; Номер акта.</li>
                                    <li>
                                        <CopyableTag tag="{act_day}" description="День акта" />, 
                                        <CopyableTag tag="{act_month}" description="Месяц акта" />, 
                                        <CopyableTag tag="{act_year}" description="Год акта" /> &mdash; Дата акта.
                                    </li>
                                    <li><CopyableTag tag="{work_name}" description="Наименование работ из акта" /> &mdash; Наименование работ.</li>
                                </ul>

                                <h4 className="font-semibold mt-6">Представители (Комиссия)</h4>
                                <p className="text-sm text-slate-600 mb-2">Используйте эти теги для блока подписей (аналогично основному акту):</p>
                                
                                <ul className="list-disc space-y-2 pl-5 text-sm mt-3">
                                    {Object.entries(ROLES).map(([key, label]) => (
                                        <li key={key} className="leading-relaxed mb-2">
                                            <strong>{label}</strong> (код: <code>{key}</code>)<br/>
                                            Теги: 
                                            <CopyableTag tag={`{${key}_name}`} description={`ФИО представителя: ${label}`} />
                                            <CopyableTag tag={`{${key}_position}`} description={`Должность представителя: ${label}`} />
                                            <CopyableTag tag={`{${key}_org}`} description={`Организация представителя: ${label}`} />
                                            <CopyableTag tag={`{${key}_auth_doc}`} description={`Приказ/Доверенность: ${label}`} />
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Footer with Save Button - Fixed at bottom */}
            {activeTab === 'general' && (
                <div className="p-4 border-t border-slate-200 bg-white flex justify-end items-center gap-4 flex-shrink-0">
                    {isSaved && (
                        <p className="text-green-600 text-sm transition-opacity duration-300 font-medium">
                        Настройки сохранены!
                        </p>
                    )}
                    <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 shadow-md font-medium">
                        Сохранить настройки
                    </button>
                </div>
            )}
        </form>
    );
};

export default SettingsPage;
