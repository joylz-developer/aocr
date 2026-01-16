
import React, { useState, useEffect, useRef } from 'react';
import { ProjectSettings, ROLES } from '../types';
import { ImportIcon, ExportIcon, TemplateIcon, DownloadIcon, QuestionMarkCircleIcon, CloudUploadIcon, DeleteIcon } from '../components/Icons';

interface SettingsPageProps {
    settings: ProjectSettings;
    onSave: (settings: ProjectSettings) => void;
    onImport: () => void;
    onExport: () => void;
    onChangeTemplate: () => void;
    onDownloadTemplate: (type?: 'main' | 'registry') => void;
    onUploadRegistryTemplate: (file: File) => void;
    isTemplateLoaded: boolean;
    isRegistryTemplateLoaded: boolean;
}

// --- Tooltip Logic ---
const TagTooltip: React.FC<{ tag: string; description: string }> = ({ tag, description }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [copied, setCopied] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLSpanElement>(null);

    const handleMouseEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            // Calculate position: above the element, centered
            let top = rect.top - 10;
            let left = rect.left + rect.width / 2;
            
            // Adjust if out of bounds (simplified check)
            if (top < 50) top = rect.bottom + 10; // Flip to bottom if too close to top
            if (left < 100) left = 100;
            if (left > window.innerWidth - 100) left = window.innerWidth - 100;

            setCoords({ top, left });
            setIsVisible(true);
        }
    };

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(tag);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <>
            <code
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setIsVisible(false)}
                onClick={handleCopy}
                className="bg-slate-100 text-blue-700 px-1.5 py-0.5 rounded-md cursor-pointer hover:bg-blue-200 transition-colors font-mono relative inline-block mx-0.5"
                title="Нажмите, чтобы скопировать"
            >
                {copied ? 'Скопировано!' : tag}
            </code>
            {isVisible && (
                <div 
                    className="fixed z-50 px-3 py-2 bg-slate-800 text-white text-xs rounded-md shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full w-max max-w-xs text-center"
                    style={{ top: coords.top, left: coords.left }}
                >
                    {description}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-slate-800 -mb-1"></div>
                </div>
            )}
        </>
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
                <QuestionMarkCircleIcon className="w-4 h-4" />
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
type HelpSubTab = 'main' | 'registry';

const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onSave, onImport, onExport, onChangeTemplate, onDownloadTemplate, onUploadRegistryTemplate, isTemplateLoaded, isRegistryTemplateLoaded }) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [helpSubTab, setHelpSubTab] = useState<HelpSubTab>('main');
    const [formData, setFormData] = useState<ProjectSettings>(settings);
    const [isSaved, setIsSaved] = useState(false);
    const registryInputRef = useRef<HTMLInputElement>(null);

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
    
    const handleRegistryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onUploadRegistryTemplate(e.target.files[0]);
            if (registryInputRef.current) registryInputRef.current.value = '';
        }
    }

    const inputClass = "mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900";
    const labelClass = "block text-sm font-medium text-slate-700";

    return (
        <form onSubmit={handleSubmit} className="h-full flex flex-col max-w-4xl mx-auto bg-white rounded-lg shadow-md overflow-hidden relative">
            <div className="p-6 pb-0 flex-shrink-0">
                <h1 className="text-2xl font-bold text-slate-800 mb-6">Настройки и Справка</h1>
                
                {/* Main Tabs */}
                <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg mb-4">
                    <button
                        type="button"
                        onClick={() => setActiveTab('general')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 ${activeTab === 'general' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Общие настройки
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('data')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 ${activeTab === 'data' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Данные и Шаблоны
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('help')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 ${activeTab === 'help' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Справка по тегам
                    </button>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto px-6 pb-20">
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
                            <legend className="text-base font-medium text-slate-800">Настройки формы акта</legend>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="historyDepth" className={labelClass}>
                                        Глубина истории (Undo/Redo)
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
                                    <p className="text-xs text-slate-500 mt-1">Количество сохраняемых действий для отмены.</p>
                                </div>
                                
                                <div>
                                    <label htmlFor="registryThreshold" className={labelClass}>
                                        Порог для реестра материалов
                                    </label>
                                    <input
                                        type="number"
                                        id="registryThreshold"
                                        name="registryThreshold"
                                        value={formData.registryThreshold ?? 5}
                                        onChange={handleNumberChange}
                                        className={inputClass}
                                        min="1"
                                        max="100"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Если материалов в акте больше этого числа, будет создан отдельный файл реестра.</p>
                                </div>
                            </div>

                            <SettingToggle id="showAdditionalInfo" label='Показывать поле "Дополнительные сведения"' formData={formData} handleChange={handleChange}>
                                <div className="mt-2">
                                    <label htmlFor="defaultAdditionalInfo" className="flex items-center text-xs font-medium text-slate-600 mb-1">
                                        <span>Значение по умолчанию</span>
                                        <VariableHelpTooltip />
                                    </label>
                                    <textarea id="defaultAdditionalInfo" name="defaultAdditionalInfo" value={formData.defaultAdditionalInfo || ''} onChange={handleChange} className={`${inputClass} text-sm`} rows={2} placeholder="Например: Работы выполнены в соответствии с..." />
                                </div>
                            </SettingToggle>

                            <SettingToggle id="showAttachments" label='Показывать поле "Приложения"' formData={formData} handleChange={handleChange}>
                                <div className="mt-2">
                                    <label htmlFor="defaultAttachments" className="flex items-center text-xs font-medium text-slate-600 mb-1">
                                        <span>Значение по умолчанию</span>
                                        <VariableHelpTooltip />
                                    </label>
                                    <textarea id="defaultAttachments" name="defaultAttachments" value={formData.defaultAttachments || ''} onChange={handleChange} className={`${inputClass} text-sm`} rows={2} placeholder="Например: Исполнительные схемы: {certs}" />
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
                                <TemplateIcon className="w-5 h-5"/> Шаблон Акта (Основной)
                            </h3>
                            <p className="text-sm text-slate-600 mb-4">
                                Основной шаблон документа .docx. Используется для генерации актов.
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
                                    onClick={() => onDownloadTemplate('main')}
                                    disabled={!isTemplateLoaded}
                                    className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <DownloadIcon className="w-4 h-4" /> Скачать текущий
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
                            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                                <TemplateIcon className="w-5 h-5"/> Шаблон Реестра Материалов
                            </h3>
                            <p className="text-sm text-slate-600 mb-4">
                                Дополнительный шаблон (.docx) для списка материалов. Генерируется, если количество материалов в акте превышает {formData.registryThreshold} шт.
                                <br/><span className="text-xs text-slate-500 italic">Примечание: Шаблон должен быть в формате Word с таблицей, а не Excel.</span>
                            </p>
                            <div className="flex gap-3 items-center">
                                <input type="file" ref={registryInputRef} onChange={handleRegistryFileChange} className="hidden" accept=".docx" />
                                
                                {isRegistryTemplateLoaded ? (
                                    <>
                                        <button 
                                            type="button"
                                            onClick={() => registryInputRef.current?.click()}
                                            className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 shadow-sm"
                                        >
                                            <TemplateIcon className="w-4 h-4" /> Заменить
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => onDownloadTemplate('registry')}
                                            className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 shadow-sm"
                                        >
                                            <DownloadIcon className="w-4 h-4" /> Скачать
                                        </button>
                                    </>
                                ) : (
                                    <button 
                                        type="button"
                                        onClick={() => registryInputRef.current?.click()}
                                        className="flex items-center gap-2 bg-blue-600 text-white border border-blue-600 px-4 py-2 rounded-md hover:bg-blue-700 shadow-sm"
                                    >
                                        <CloudUploadIcon className="w-4 h-4" /> Загрузить шаблон реестра
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'help' && (
                    <div className="flex flex-col h-full">
                        <div className="flex space-x-1 border-b border-slate-200 mb-4 pb-1">
                            <button
                                type="button"
                                onClick={() => setHelpSubTab('main')}
                                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${helpSubTab === 'main' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Шаблон Акта
                            </button>
                            <button
                                type="button"
                                onClick={() => setHelpSubTab('registry')}
                                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${helpSubTab === 'registry' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Шаблон Реестра
                            </button>
                        </div>

                        <div className="prose max-w-none text-slate-700 text-sm leading-relaxed pb-4">
                            {helpSubTab === 'main' ? (
                                <>
                                    <p>Используйте эти теги в основном шаблоне акта (.docx). При наведении на тег появится подсказка.</p>
                                    
                                    <h4 className="font-semibold mt-4">Основные данные</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <TagTooltip tag="{act_number}" description="Номер акта" />
                                        <TagTooltip tag="{object_name}" description="Наименование объекта строительства" />
                                        <TagTooltip tag="{act_day}" description="День подписания акта" />
                                        <TagTooltip tag="{act_month}" description="Месяц подписания" />
                                        <TagTooltip tag="{act_year}" description="Год подписания" />
                                        <TagTooltip tag="{copies_count}" description="Количество экземпляров" />
                                        <TagTooltip tag="{additional_info}" description="Дополнительные сведения" />
                                    </div>

                                    <h4 className="font-semibold mt-4">Организации</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <TagTooltip tag="{builder_details}" description="Реквизиты Застройщика" />
                                        <TagTooltip tag="{contractor_details}" description="Реквизиты Лица, осуществляющего строительство" />
                                        <TagTooltip tag="{designer_details}" description="Реквизиты Проектировщика" />
                                        <TagTooltip tag="{work_performer}" description="Реквизиты Лица, выполнившего работы" />
                                    </div>

                                    <h4 className="font-semibold mt-4">Работы и Даты</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <TagTooltip tag="{work_name}" description="Наименование выполненных работ" />
                                        <TagTooltip tag="{project_docs}" description="Проектная документация" />
                                        <TagTooltip tag="{materials}" description="Примененные материалы (или ссылка на реестр)" />
                                        <TagTooltip tag="{certs}" description="Документы о качестве/схемы" />
                                        <TagTooltip tag="{regulations}" description="Нормативные документы" />
                                        <TagTooltip tag="{next_work}" description="Разрешенные следующие работы" />
                                        <TagTooltip tag="{work_start_day}" description="День начала работ" />
                                        <TagTooltip tag="{work_end_day}" description="День окончания работ" />
                                    </div>

                                    <h4 className="font-semibold mt-4">Комиссия (Представители)</h4>
                                    <p className="text-xs text-slate-500 mb-2">Используйте <code>{`{#tnz}...{/tnz}`}</code> для скрытия пустых полей.</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                        {Object.entries(ROLES).map(([key, label]) => (
                                            <div key={key} className="border p-2 rounded">
                                                <div className="font-medium mb-1">{label} ({key})</div>
                                                <TagTooltip tag={`{${key}_details}`} description={`Полная строка (Должность, ФИО, Приказ)`} />
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    <TagTooltip tag={`{${key}_name}`} description="ФИО" />
                                                    <TagTooltip tag={`{${key}_position}`} description="Должность" />
                                                    <TagTooltip tag={`{${key}_org}`} description="Организация" />
                                                    <TagTooltip tag={`{${key}_auth_doc}`} description="Документ о полномочиях" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p>Используйте эти теги в шаблоне реестра (.docx). Обязательно создайте таблицу для списка материалов.</p>
                                    
                                    <h4 className="font-semibold mt-4">Шапка реестра (Общие данные)</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <TagTooltip tag="{act_number}" description="Номер акта, к которому относится реестр" />
                                        <TagTooltip tag="{object_name}" description="Наименование объекта" />
                                        <TagTooltip tag="{act_day}" description="День подписания акта" />
                                        <TagTooltip tag="{act_month}" description="Месяц подписания" />
                                        <TagTooltip tag="{act_year}" description="Год подписания" />
                                    </div>

                                    <h4 className="font-semibold mt-4">Таблица материалов</h4>
                                    <p className="text-xs text-slate-500 mb-2">
                                        Вставьте эти теги внутри строки таблицы. При генерации строка будет размножена для каждого материала.
                                    </p>
                                    <div className="border p-3 rounded bg-slate-50 mb-4">
                                        <p className="font-mono text-sm mb-2 text-slate-700">
                                            {'{#materials_list} ... {/materials_list}'}
                                        </p>
                                        <div className="flex flex-wrap gap-2 ml-4">
                                            <TagTooltip tag="{index}" description="Порядковый номер (1, 2, 3...)" />
                                            <TagTooltip tag="{name}" description="Полная строка материала (как в акте)" />
                                            <TagTooltip tag="{material_name}" description="Только наименование материала (до скобок)" />
                                            <TagTooltip tag="{cert_doc}" description="Документ о качестве (текст внутри скобок)" />
                                            <TagTooltip tag="{date}" description="Дата (пустая ячейка для ручного заполнения)" />
                                            <TagTooltip tag="{amount}" description="Кол-во листов (пустая ячейка)" />
                                        </div>
                                    </div>

                                    <h4 className="font-semibold mt-4">Комиссия (Представители)</h4>
                                    <p className="text-xs text-slate-500 mb-2">
                                        Те же теги, что и в основном акте. Используйте их для блока подписей внизу реестра.
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                        {Object.entries(ROLES).map(([key, label]) => (
                                            <div key={key} className="border p-2 rounded">
                                                <div className="font-medium mb-1">{label} ({key})</div>
                                                <TagTooltip tag={`{${key}_details}`} description={`Полная строка (Должность, ФИО, Приказ)`} />
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    <TagTooltip tag={`{${key}_name}`} description="ФИО" />
                                                    <TagTooltip tag={`{${key}_position}`} description="Должность" />
                                                    <TagTooltip tag={`{${key}_org}`} description="Организация" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Fixed Footer */}
            <div className="flex-shrink-0 bg-white border-t border-slate-200 p-4 flex justify-end">
                <button
                    type="submit"
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 shadow-sm font-medium transition-colors"
                >
                    {isSaved ? 'Сохранено!' : 'Сохранить настройки'}
                </button>
            </div>
        </form>
    );
};

export default SettingsPage;
