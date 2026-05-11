import React, { useState, useEffect, useRef } from 'react';
import { ProjectSettings, ROLES, AiModelConfig } from '../types';
import { generateContent } from '../services/aiService';
import { ImportIcon, ExportIcon, TemplateIcon, DownloadIcon, QuestionMarkCircleIcon, CloudUploadIcon, DeleteIcon, CopyIcon, SparklesIcon, GripVerticalIcon, CloseIcon, PlusIcon } from '../components/Icons';

interface SettingsPageProps {
    settings: ProjectSettings;
    onSave: (settings: ProjectSettings) => void;
    onImport: () => void;
    onExport: () => void;
    onChangeTemplate?: () => void; 
    onUploadTemplate?: (file: File) => void; 
    onDownloadTemplate: (type?: 'main' | 'registry') => void;
    onUploadRegistryTemplate: (file: File) => void;
    isTemplateLoaded: boolean;
    isRegistryTemplateLoaded: boolean;
    onDeleteTemplate?: (type: 'main' | 'registry') => void;
    templateUpdateDate?: string;
    registryUpdateDate?: string;
}

const ORG_FIELDS = [
    { id: 'name', label: 'Наименование' },
    { id: 'inn', label: 'ИНН' },
    { id: 'ogrn', label: 'ОГРН' },
    { id: 'kpp', label: 'КПП' },
    { id: 'address', label: 'Адрес' },
    { id: 'phone', label: 'Телефон' },
    { id: 'sro', label: 'СРО' },
];

const PERSON_FIELDS = [
    { id: 'position', label: 'Должность' },
    { id: 'name', label: 'ФИО' },
    { id: 'organization', label: 'Организация' },
    { id: 'authDoc', label: 'Основание (Приказ)' },
    { id: 'nrs', label: 'НРС' },
];

const TemplateBuilder = ({ 
    title, 
    description,
    availableFields, 
    currentTemplate, 
    onChange 
}: { 
    title: string, 
    description: string,
    availableFields: {id: string, label: string}[], 
    currentTemplate: string[] | undefined, 
    onChange: (newTemplate: string[]) => void 
}) => {
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

    const activeFields = currentTemplate && currentTemplate.length > 0 ? currentTemplate : availableFields.map(f => f.id);
    const inactiveFields = availableFields.filter(f => !activeFields.includes(f.id));

    const handleDragStart = (index: number) => setDraggedIdx(index);
    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIdx === null || draggedIdx === index) return;
        const newList = [...activeFields];
        const item = newList.splice(draggedIdx, 1)[0];
        newList.splice(index, 0, item);
        setDraggedIdx(index);
        onChange(newList);
    };

    const handleRemove = (id: string) => onChange(activeFields.filter(f => f !== id));
    const handleAdd = (id: string) => onChange([...activeFields, id]);

    return (
        <div className="mb-6 p-4 border border-slate-200 [.theme-dark_&]:border-slate-700 rounded-lg bg-slate-50/50 [.theme-dark_&]:bg-slate-900/20">
            <div className="mb-3">
                <h4 className="text-sm font-bold text-slate-700 [.theme-dark_&]:text-slate-200">{title}</h4>
                <p className="text-xs text-slate-500">{description}</p>
            </div>

            <div className="mb-4 p-3 bg-white [.theme-dark_&]:bg-[#0d1117] border border-slate-200 [.theme-dark_&]:border-slate-700 rounded min-h-[60px] flex flex-wrap gap-2 items-start shadow-inner">
                {activeFields.length === 0 && <span className="text-xs text-slate-400 italic py-1">Вы удалили все поля. Выберите из списка ниже.</span>}
                {activeFields.map((fieldId, idx) => {
                    const field = availableFields.find(f => f.id === fieldId);
                    if (!field) return null;
                    return (
                        <div
                            key={fieldId}
                            draggable
                            onDragStart={() => handleDragStart(idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDragEnd={() => setDraggedIdx(null)}
                            className={`
                                flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium cursor-move select-none transition-all
                                ${draggedIdx === idx ? 'opacity-40 scale-95 border-blue-400 bg-blue-50' : 'bg-blue-50 [.theme-dark_&]:bg-blue-900/30 border-blue-200 [.theme-dark_&]:border-blue-800 text-blue-700 [.theme-dark_&]:text-blue-300 shadow-sm'}
                            `}
                        >
                            <GripVerticalIcon className="w-3 h-3 text-blue-400 opacity-50" />
                            {field.label}
                            <button type="button" onClick={() => handleRemove(fieldId)} className="ml-1 text-blue-400 hover:text-red-500 transition-colors bg-white/50 [.theme-dark_&]:bg-black/20 rounded p-0.5">
                                <CloseIcon className="w-3 h-3" />
                            </button>
                        </div>
                    );
                })}
            </div>

            {inactiveFields.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 pt-3 border-t border-slate-200 [.theme-dark_&]:border-slate-700">
                    <span className="text-xs font-medium text-slate-500 w-full mb-1">Доступные поля:</span>
                    {inactiveFields.map(field => (
                        <button
                            key={field.id}
                            type="button"
                            onClick={() => handleAdd(field.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 [.theme-dark_&]:border-slate-600 bg-white [.theme-dark_&]:bg-slate-800 text-slate-600 [.theme-dark_&]:text-slate-300 text-xs hover:border-green-400 hover:text-green-600 [.theme-dark_&]:hover:text-green-400 transition-colors shadow-sm"
                        >
                            <PlusIcon className="w-3 h-3" /> {field.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const TagCard: React.FC<{ tag: string; description: string }> = ({ tag, description }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(tag);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div 
            onClick={handleCopy}
            className="flex flex-col gap-1 bg-slate-50 border border-slate-200 p-2.5 rounded cursor-pointer hover:border-blue-400 hover:bg-blue-50/50"
            title="Нажмите, чтобы скопировать"
        >
            <code className="text-blue-700 font-bold font-mono text-xs w-max">
                {copied ? 'Скопировано!' : tag}
            </code>
            <span className="text-[11px] text-slate-600 leading-tight">
                {description}
            </span>
        </div>
    );
};

const CopyableCode: React.FC<{ children: React.ReactNode; textToCopy: string; title?: string }> = ({ children, textToCopy, title }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="mb-3">
            {title && <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">{title}</p>}
            <div 
                className="group relative bg-white p-3 rounded border border-slate-200 text-xs font-mono text-slate-600 cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all"
                onClick={handleCopy}
                title="Нажмите, чтобы скопировать код"
            >
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {copied ? (
                        <span className="text-green-600 font-bold bg-green-50 px-1 rounded">Скопировано!</span>
                    ) : (
                        <CopyIcon className="w-4 h-4 text-blue-500" />
                    )}
                </div>
                {children}
            </div>
        </div>
    );
};

const TagGenerator: React.FC = () => {
    const [fieldInput, setFieldInput] = useState('');
    
    const generateListCode = (type: 'sandwich' | 'simple') => {
        const cleanName = fieldInput.trim().replace(/[{}]/g, '') || 'имя_поля';
        if (type === 'sandwich') {
            return `{#${cleanName}_list}\n{${cleanName}_clean}\n{/${cleanName}_list}`;
        }
        return `{#${cleanName}_list}{${cleanName}}{/${cleanName}_list}`;
    };

    return (
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg my-4">
            <h4 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
                <SparklesIcon className="w-5 h-5" /> Генератор тегов для списков
            </h4>
            
            <div className="mb-6">
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Шаг 1: Введите имя поля</label>
                <div className="flex items-center gap-2">
                    <input 
                        type="text" 
                        value={fieldInput}
                        onChange={(e) => setFieldInput(e.target.value)}
                        placeholder="например: attachments"
                        className="w-full max-w-sm text-sm border border-slate-300 rounded px-3 py-2 focus:outline-none focus:border-blue-500 shadow-sm"
                    />
                    <span className="text-sm text-slate-500">
                        (например: <code>attachments</code>, <code>material_docs</code>)
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-lg border-2 border-blue-400 shadow-md relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] px-3 py-1 rounded-bl-lg font-bold uppercase tracking-widest shadow-sm">
                        Рекомендуем
                    </div>
                    
                    <h5 className="font-bold text-base text-blue-900 mb-4 flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-sm border border-blue-200">1</span>
                        Метод "Сэндвич" (для нумерации)
                    </h5>
                    
                    <div className="text-sm text-slate-600 space-y-3 mb-4">
                        <p className="font-medium text-slate-800">Чтобы Word создавал список (1. 2. 3.), теги нужно разнести по строкам:</p>
                        <ol className="list-decimal pl-5 space-y-2 marker:text-blue-500 marker:font-bold">
                            <li>Скопируйте блок ниже и вставьте в ячейку таблицы Word.</li>
                            <li><span className="text-red-600 font-bold">Важно:</span> Выделите <strong>только среднюю строку</strong> (где имя поля) и нажмите кнопку "Нумерованный список" в Word.</li>
                            <li>Верхний и нижний теги должны остаться <strong>без цифр</strong>.</li>
                        </ol>
                    </div>

                    <CopyableCode textToCopy={generateListCode('sandwich')} title="Код для шаблона (3 строки)">
                        <div className="whitespace-pre-wrap break-all text-blue-700 font-bold bg-blue-50 p-2 rounded border border-blue-100 font-mono text-xs">
                            {generateListCode('sandwich')}
                        </div>
                    </CopyableCode>
                    
                    <div className="text-xs text-slate-500 italic mt-3 bg-slate-50 p-2 rounded border border-slate-100">
                        <span className="font-bold">Как это будет выглядеть в Word:</span><br/>
                        {`{#${fieldInput || '...'}_list}`}<br/>
                        1. {`{${fieldInput || '...'}_clean}`}<br/>
                        {`{/${fieldInput || '...'}_list}`}
                    </div>
                </div>

                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm relative opacity-90 hover:opacity-100">
                    <h5 className="font-bold text-base text-slate-700 mb-4 flex items-center gap-2">
                        <span className="bg-slate-100 text-slate-500 rounded-full w-6 h-6 flex items-center justify-center text-xs border border-slate-200">2</span>
                        Простой текст (одной строкой)
                    </h5>
                    
                    <div className="text-sm text-slate-600 space-y-3 mb-4">
                        <p className="font-medium text-slate-800">Как это работает:</p>
                        <ul className="list-disc pl-5 space-y-2 marker:text-slate-400">
                            <li>Весь текст вставляется в одну ячейку.</li>
                            <li>Переносы строк сохраняются, но это не список Word.</li>
                            <li>Подходит, если вы не используете авто-нумерацию Word.</li>
                        </ul>
                    </div>

                    <CopyableCode textToCopy={generateListCode('simple')} title="Код для шаблона">
                        <div className="whitespace-pre-wrap break-all text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 font-mono text-xs">{generateListCode('simple')}</div>
                    </CopyableCode>
                </div>
            </div>
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

type SettingsTab = 'general' | 'act' | 'ai' | 'data';

const SettingsPage: React.FC<SettingsPageProps> = ({ 
    settings, 
    onSave, 
    onImport, 
    onExport, 
    onUploadTemplate,
    onDownloadTemplate, 
    onUploadRegistryTemplate, 
    isTemplateLoaded, 
    isRegistryTemplateLoaded,
    onDeleteTemplate,
    templateUpdateDate,
    registryUpdateDate
}) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [helpType, setHelpType] = useState<'main' | 'registry'>('main');

    const [formData, setFormData] = useState<ProjectSettings>(settings);
    const [isSaved, setIsSaved] = useState(false);
    const [editingModel, setEditingModel] = useState<AiModelConfig | null>(null);
    
    // Ссылки на скрытые input-файлы
    const registryInputRef = useRef<HTMLInputElement>(null);
    const mainInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setFormData(settings);
    }, [settings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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

    const handleAddNewModel = () => {
        setEditingModel({ 
            id: crypto.randomUUID(), 
            name: 'Новая модель', 
            modelId: '',
            provider: 'openai',
            apiKey: '',
            baseUrl: 'https://openrouter.ai/api/v1'
        });
    };

    const handleEditModel = (model: AiModelConfig) => {
        setEditingModel({ ...model });
    };

    const handleCancelEdit = () => {
        setEditingModel(null);
    };

    const handleSaveModel = () => {
        if (!editingModel) return;
        
        setFormData(prev => {
            const exists = prev.aiModels?.some(m => m.id === editingModel.id);
            const newModels = exists 
                ? prev.aiModels!.map(m => m.id === editingModel.id ? editingModel : m)
                : [...(prev.aiModels || []), editingModel];
            
            const newData = { ...prev, aiModels: newModels };
            
            setTimeout(() => onSave(newData), 0);
            return newData;
        });
        setEditingModel(null);
    };

    const handleRemoveAiModel = (id: string) => {
        setFormData(prev => {
            const newModels = (prev.aiModels || []).filter(model => model.id !== id);
            const newActiveId = prev.activeAiModelId === id ? '' : prev.activeAiModelId;
            const newData = { ...prev, aiModels: newModels, activeAiModelId: newActiveId };
            
            setTimeout(() => onSave(newData), 0);
            return newData;
        });
    };
    
    const handleActiveModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setFormData(prev => {
            const newData = { ...prev, activeAiModelId: val };
            setTimeout(() => onSave(newData), 0);
            return newData;
        });
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
    };

    // НОВАЯ ФУНКЦИЯ: Загрузка основного шаблона
    const handleMainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            if (onUploadTemplate) {
                onUploadTemplate(e.target.files[0]);
            } else {
                alert("Ошибка: Функция onUploadTemplate не привязана в App.tsx. Шаблон загрузить не удалось.");
            }
            if (mainInputRef.current) mainInputRef.current.value = '';
        }
    }
    
    const handleRegistryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onUploadRegistryTemplate(e.target.files[0]);
            if (registryInputRef.current) registryInputRef.current.value = '';
        }
    }

    const openHelp = (type: 'main' | 'registry') => {
        setHelpType(type);
        setIsHelpOpen(true);
    };

    const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState<string | null>(null);

    const handleTestConnection = async () => {
        setTestStatus('loading');
        setTestMessage(null);
        try {
            const response = await generateContent(formData, "Hello, are you working?", undefined, undefined, false);
            if (response.text) {
                setTestStatus('success');
                setTestMessage("Подключение успешно! Ответ: " + response.text.substring(0, 50) + "...");
            }
        } catch (error: any) {
            setTestStatus('error');
            setTestMessage("Ошибка подключения: " + (error.message || "Неизвестная ошибка"));
        }
    };

    const inputClass = "mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900";
    const labelClass = "block text-sm font-medium text-slate-700";

    return (
        <form onSubmit={handleSubmit} className="h-full flex flex-col w-full bg-white rounded-lg shadow-md overflow-hidden relative">
            <div className="p-6 pb-0 flex-shrink-0">
                <h1 className="text-2xl font-bold text-slate-800 mb-6">Настройки</h1>
                
                {/* Вкладки */}
                <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg mb-4">
                    <button
                        type="button"
                        onClick={() => setActiveTab('general')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 ${activeTab === 'general' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Общие
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('act')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 ${activeTab === 'act' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Настройки акта
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('ai')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 ${activeTab === 'ai' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        AI
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('data')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 ${activeTab === 'data' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Данные и Шаблоны
                    </button>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto px-6 pb-20">
                
                {/* 1. ВКЛАДКА: ОБЩИЕ */}
                {activeTab === 'general' && (
                    <div className="space-y-6 max-w-4xl">
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
                                <p className="text-xs text-slate-500 mt-1">Количество сохраняемых действий для отмены в таблице актов.</p>
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
                    </div>
                )}

                {/* 2. ВКЛАДКА: НАСТРОЙКИ АКТА */}
                {activeTab === 'act' && (
                    <div className="space-y-6 max-w-4xl">
                        <h3 className="text-base font-medium text-slate-800 border-b border-slate-100 pb-2 mb-4">Настройки формы акта</h3>

                        <SettingToggle id="showAdditionalInfo" label='Показывать поле "Дополнительные сведения"' formData={formData} handleChange={handleChange}>
                            <div className="mt-2">
                                <label htmlFor="defaultAdditionalInfo" className="flex items-center text-xs font-medium text-slate-600 mb-1">
                                    <span>Значение по умолчанию</span>
                                </label>
                                <textarea id="defaultAdditionalInfo" name="defaultAdditionalInfo" value={formData.defaultAdditionalInfo || ''} onChange={handleChange} className={`${inputClass} text-sm`} rows={6} placeholder="Например: Работы выполнены в соответствии с..." />
                            </div>
                        </SettingToggle>

                        <SettingToggle id="showAttachments" label='Показывать поле "Приложения"' formData={formData} handleChange={handleChange}>
                            <div className="mt-2">
                                <label htmlFor="defaultAttachments" className="flex items-center text-xs font-medium text-slate-600 mb-1">
                                    <span>Значение по умолчанию</span>
                                </label>
                                <textarea id="defaultAttachments" name="defaultAttachments" value={formData.defaultAttachments || ''} onChange={handleChange} className={`${inputClass} text-sm`} rows={6} placeholder="Например: Исполнительная схема; {certs};" />
                                <p className="text-xs text-slate-500 mt-1">
                                    Вы можете использовать теги (например, {'{materials}'}) в этом поле. При генерации они заменятся на данные из акта. Переносы строк сохраняются.
                                    <br/><strong>Совет:</strong> Используйте {'{materials_raw}'} чтобы всегда выводить полный список материалов, даже если включен реестр.
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
                                </label>
                                <input 
                                    type="text" 
                                    id="defaultActDate" 
                                    name="defaultActDate" 
                                    value={formData.defaultActDate || ''} 
                                    onChange={handleChange} 
                                    className={`${inputClass} text-sm`} 
                                    placeholder="{work_end_date}" 
                                />
                            </div>
                        </SettingToggle>

                        {/* НАСТРОЙКИ ВЫВОДА ДАННЫХ */}
                        <div className="pt-6 border-t border-slate-200 mt-8">
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    Организации
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">Сконфигурируйте порядок данных для реквизитов организаций в шаблоне Word.</p>
                            </div>
                            
                            <TemplateBuilder 
                                title="Застройщик {builder_details}" 
                                description="Настройка вывода для Застройщика (технического заказчика)"
                                availableFields={ORG_FIELDS}
                                currentTemplate={(formData as any).builderDetailsTemplate || []}
                                onChange={(newTemplate) => setFormData({...formData, builderDetailsTemplate: newTemplate} as any)}
                            />

                            <TemplateBuilder 
                                title="Подрядчик {contractor_details}" 
                                description="Настройка вывода для Лица, осуществляющего строительство"
                                availableFields={ORG_FIELDS}
                                currentTemplate={(formData as any).contractorDetailsTemplate || []}
                                onChange={(newTemplate) => setFormData({...formData, contractorDetailsTemplate: newTemplate} as any)}
                            />

                            <TemplateBuilder 
                                title="Проектировщик {designer_details}" 
                                description="Настройка вывода для Проектировщика"
                                availableFields={ORG_FIELDS}
                                currentTemplate={(formData as any).designerDetailsTemplate || []}
                                onChange={(newTemplate) => setFormData({...formData, designerDetailsTemplate: newTemplate} as any)}
                            />
                        </div>

                        <div className="pt-6 border-t border-slate-200 mt-8">
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    Комиссия (Представители)
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">Настройте порядок вывода данных индивидуально для каждого представителя.</p>
                            </div>
                            
                            <TemplateBuilder 
                                title="Представитель застройщика {tnz_details}" 
                                description={ROLES.tnz}
                                availableFields={PERSON_FIELDS}
                                currentTemplate={(formData as any).tnzDetailsTemplate || []}
                                onChange={(newTemplate) => setFormData({...formData, tnzDetailsTemplate: newTemplate} as any)}
                            />

                            <TemplateBuilder 
                                title="Представитель подрядчика {g_details}" 
                                description={ROLES.g}
                                availableFields={PERSON_FIELDS}
                                currentTemplate={(formData as any).gDetailsTemplate || []}
                                onChange={(newTemplate) => setFormData({...formData, gDetailsTemplate: newTemplate} as any)}
                            />

                            <TemplateBuilder 
                                title="Представитель подрядчика (строй. контроль) {tng_details}" 
                                description={ROLES.tng}
                                availableFields={PERSON_FIELDS}
                                currentTemplate={(formData as any).tngDetailsTemplate || []}
                                onChange={(newTemplate) => setFormData({...formData, tngDetailsTemplate: newTemplate} as any)}
                            />

                            <TemplateBuilder 
                                title="Проектировщик {pr_details}" 
                                description={ROLES.pr}
                                availableFields={PERSON_FIELDS}
                                currentTemplate={(formData as any).prDetailsTemplate || []}
                                onChange={(newTemplate) => setFormData({...formData, prDetailsTemplate: newTemplate} as any)}
                            />

                            <TemplateBuilder 
                                title="Лицо, выполнившее работы {pd_details}" 
                                description={ROLES.pd}
                                availableFields={PERSON_FIELDS}
                                currentTemplate={(formData as any).pdDetailsTemplate || []}
                                onChange={(newTemplate) => setFormData({...formData, pdDetailsTemplate: newTemplate} as any)}
                            />

                            <TemplateBuilder 
                                title="Иные представители {i1_details}, {i2_details}, {i3_details}" 
                                description="Общий шаблон для всех иных представителей"
                                availableFields={PERSON_FIELDS}
                                currentTemplate={(formData as any).otherRepsDetailsTemplate || []}
                                onChange={(newTemplate) => setFormData({...formData, otherRepsDetailsTemplate: newTemplate} as any)}
                            />
                        </div>
                    </div>
                )}

                {/* 3. ВКЛАДКА: AI */}
                {activeTab === 'ai' && (
                    <div className="space-y-8 max-w-4xl">
                        
                        <div className="space-y-4">
                            <h3 className="text-base font-medium text-slate-800 border-b border-slate-100 pb-2 mb-4">Настройки AI (Модели и API)</h3>
                            
                            <div>
                                <label htmlFor="activeAiModelId" className={labelClass}>
                                    Активная AI Модель
                                </label>
                                <select
                                    id="activeAiModelId"
                                    name="activeAiModelId"
                                    value={formData.activeAiModelId || ''}
                                    onChange={handleActiveModelChange}
                                    className={inputClass}
                                >
                                    <option value="">-- Не выбрана --</option>
                                    {formData.aiModels?.map(model => (
                                        <option key={model.id} value={model.id}>{model.name} ({model.modelId})</option>
                                    ))}
                                    {!formData.activeAiModelId && (formData.geminiApiKey || formData.openAiApiKey) && (
                                        <option value="" disabled>-- Используются устаревшие настройки --</option>
                                    )}
                                </select>
                            </div>

                            <div className="mt-6 border border-slate-200 rounded-md p-4 bg-slate-50">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-sm font-medium text-slate-700">Настроенные модели</h4>
                                    {!editingModel && (
                                        <button
                                            type="button"
                                            onClick={handleAddNewModel}
                                            className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-200 transition-colors font-medium"
                                        >
                                            + Добавить модель
                                        </button>
                                    )}
                                </div>
                                
                                {editingModel ? (
                                    <div className="bg-white p-4 border border-blue-200 rounded-md shadow-sm">
                                        <h5 className="text-sm font-medium text-slate-800 mb-4 border-b border-slate-100 pb-2">
                                            {formData.aiModels?.some(m => m.id === editingModel.id) ? 'Редактирование модели' : 'Новая модель'}
                                        </h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Название (для вас)</label>
                                                <input
                                                    type="text"
                                                    value={editingModel.name}
                                                    onChange={(e) => setEditingModel({...editingModel, name: e.target.value})}
                                                    placeholder="Например: Мой Gemini"
                                                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Провайдер API</label>
                                                <select
                                                    value={editingModel.provider}
                                                    onChange={(e) => setEditingModel({...editingModel, provider: e.target.value as 'gemini'|'openai'})}
                                                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:border-blue-500 focus:outline-none bg-white"
                                                >
                                                    <option value="openai">OpenRouter / OpenAI Compatible</option>
                                                    <option value="gemini">Google Gemini API (Native)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">ID Модели</label>
                                                <input
                                                    type="text"
                                                    value={editingModel.modelId}
                                                    onChange={(e) => setEditingModel({...editingModel, modelId: e.target.value})}
                                                    placeholder={editingModel.provider === 'gemini' ? "gemini-2.5-flash" : "qwen/qwen-2.5-vl-72b-instruct"}
                                                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:border-blue-500 focus:outline-none font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">API Ключ</label>
                                                <input
                                                    type="password"
                                                    value={editingModel.apiKey}
                                                    onChange={(e) => setEditingModel({...editingModel, apiKey: e.target.value})}
                                                    placeholder="sk-or-v1-..."
                                                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:border-blue-500 focus:outline-none font-mono"
                                                />
                                            </div>
                                            {editingModel.provider === 'openai' && (
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">Base URL</label>
                                                    <input
                                                        type="text"
                                                        value={editingModel.baseUrl}
                                                        onChange={(e) => setEditingModel({...editingModel, baseUrl: e.target.value})}
                                                        placeholder="https://openrouter.ai/api/v1"
                                                        className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:border-blue-500 focus:outline-none font-mono"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-4 flex justify-end gap-2 pt-4 border-t border-slate-100">
                                            <button
                                                type="button"
                                                onClick={handleCancelEdit}
                                                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                                            >
                                                Отмена
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveModel}
                                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                                            >
                                                Сохранить модель
                                            </button>
                                        </div>
                                    </div>
                                ) : (!formData.aiModels || formData.aiModels.length === 0) ? (
                                    <div className="text-center py-6 bg-white border border-slate-200 rounded-md">
                                        <p className="text-sm text-slate-500 mb-2">Нет добавленных моделей</p>
                                        <button type="button" onClick={handleAddNewModel} className="text-sm text-blue-600 hover:underline">Добавить первую модель</button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {formData.aiModels.map(model => (
                                            <div key={model.id} className="bg-white p-3 border border-slate-200 rounded-md flex justify-between items-center shadow-sm hover:border-blue-300 transition-colors">
                                                <div>
                                                    <div className="font-medium text-sm text-slate-800 flex items-center gap-2">
                                                        {model.name}
                                                        {formData.activeAiModelId === model.id && (
                                                            <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Активная</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded">{model.provider === 'gemini' ? 'Gemini API' : 'OpenRouter'}</span>
                                                        <span className="font-mono">{model.modelId}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditModel(model)}
                                                        className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors"
                                                        title="Редактировать"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveAiModel(model.id)}
                                                        className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                                                        title="Удалить"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {!editingModel && (
                                    <p className="text-xs text-slate-500 mt-4">
                                        Найдите ID моделей на <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenRouter Models</a>.
                                    </p>
                                )}
                            </div>

                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={handleTestConnection}
                                    disabled={testStatus === 'loading'}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 text-sm font-medium flex items-center gap-2"
                                >
                                    {testStatus === 'loading' ? 'Проверка...' : 'Проверить подключение'}
                                </button>
                                {testMessage && (
                                    <p className={`text-xs mt-2 ${testStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                        {testMessage}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4 pt-6 border-t border-slate-200">
                            <h3 className="text-base font-medium text-slate-800 border-b border-slate-100 pb-2 mb-4">Промпты для AI-Распознавания</h3>
                            
                            <div>
                                <label htmlFor="certificatePromptNumber" className={labelClass}>Номер документа</label>
                                <textarea id="certificatePromptNumber" name="certificatePromptNumber" value={formData.certificatePromptNumber || ''} onChange={handleChange} rows={6} className={`${inputClass} min-h-[100px] font-mono text-xs`} />
                            </div>
                            <div>
                                <label htmlFor="certificatePromptDate" className={labelClass}>Дата от</label>
                                <textarea id="certificatePromptDate" name="certificatePromptDate" value={formData.certificatePromptDate || ''} onChange={handleChange} rows={6} className={`${inputClass} min-h-[100px] font-mono text-xs`} />
                            </div>
                            <div>
                                <label htmlFor="certificatePromptDateTo" className={labelClass}>Дата до</label>
                                <textarea id="certificatePromptDateTo" name="certificatePromptDateTo" value={(formData as any).certificatePromptDateTo || ''} onChange={handleChange} rows={6} className={`${inputClass} min-h-[100px] font-mono text-xs`} />
                            </div>
                            <div>
                                <label htmlFor="certificatePromptSupplier" className={labelClass}>Поставщик</label>
                                <textarea id="certificatePromptSupplier" name="certificatePromptSupplier" value={(formData as any).certificatePromptSupplier || ''} onChange={handleChange} rows={6} className={`${inputClass} min-h-[100px] font-mono text-xs`} />
                            </div>
                            <div>
                                <label htmlFor="certificatePromptMaterials" className={labelClass}>Материалы</label>
                                <textarea id="certificatePromptMaterials" name="certificatePromptMaterials" value={formData.certificatePromptMaterials || ''} onChange={handleChange} rows={6} className={`${inputClass} min-h-[100px] font-mono text-xs`} />
                            </div>
                            <div>
                                <label htmlFor="personExtractionPrompt" className={labelClass}>Промпт (Люди)</label>
                                <textarea id="personExtractionPrompt" name="personExtractionPrompt" value={formData.personExtractionPrompt || ''} onChange={handleChange} className={`${inputClass} min-h-[100px] font-mono text-xs`} />
                            </div>
                            <div>
                                <label htmlFor="organizationExtractionPrompt" className={labelClass}>Промпт (Организации)</label>
                                <textarea id="organizationExtractionPrompt" name="organizationExtractionPrompt" value={formData.organizationExtractionPrompt || ''} onChange={handleChange} className={`${inputClass} min-h-[100px] font-mono text-xs`} />
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. ВКЛАДКА: ДАННЫЕ И ШАБЛОНЫ */}
                {activeTab === 'data' && (
                    <div className="space-y-6 mt-2 max-w-4xl">
                        
                        {/* 1. Блок Управление данными */}
                        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm relative">
                            <div className="flex items-start mb-3 gap-3">
                                <div className="p-3 rounded-full bg-blue-50 text-blue-600">
                                    <ImportIcon className="w-6 h-6"/>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base">Управление данными</h3>
                                    <p className="text-sm text-slate-500 mt-1">Резервное копирование и восстановление.</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                                <button type="button" onClick={onImport} className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded text-sm hover:bg-slate-50 transition-colors">
                                    <ImportIcon className="w-4 h-4" /> Импорт
                                </button>
                                <button type="button" onClick={onExport} className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded text-sm hover:bg-slate-50 transition-colors">
                                    <ExportIcon className="w-4 h-4" /> Экспорт
                                </button>
                            </div>
                        </div>

                        {/* 2. Блок Шаблон Акта */}
                        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm relative">
                            <input type="file" ref={mainInputRef} onChange={handleMainFileChange} className="hidden" accept=".docx" />
                            
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-start gap-3">
                                    <div className={`p-3 rounded-full ${isTemplateLoaded ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <TemplateIcon className="w-6 h-6"/>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                            Шаблон Акта (Основной)
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1 text-xs">
                                            {isTemplateLoaded ? (
                                                <>
                                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Загружен</span>
                                                    <span className="text-slate-400">Добавлен: {templateUpdateDate || 'Дата неизвестна'}</span>
                                                </>
                                            ) : (
                                                <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Не загружен</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button type="button" onClick={() => openHelp('main')} className="text-blue-600 text-sm hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full transition-colors">
                                    <QuestionMarkCircleIcon className="w-4 h-4"/> Справка по тегам
                                </button>
                            </div>
                            
                            <p className="text-sm text-slate-600 mb-4 mt-2">Основной шаблон документа .docx. Используется для генерации актов.</p>
                            
                            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => mainInputRef.current?.click()} className="flex items-center gap-2 bg-blue-600 text-white border border-blue-600 px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors">
                                    <CloudUploadIcon className="w-4 h-4" /> {isTemplateLoaded ? 'Заменить' : 'Загрузить'}
                                </button>
                                
                                {isTemplateLoaded && (
                                    <>
                                        <button type="button" onClick={() => onDownloadTemplate('main')} className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded text-sm hover:bg-slate-50 transition-colors">
                                            <DownloadIcon className="w-4 h-4" /> Скачать
                                        </button>
                                        <button type="button" onClick={() => onDeleteTemplate && onDeleteTemplate('main')} className="flex items-center gap-2 bg-white text-red-600 border border-red-200 px-4 py-2 rounded text-sm hover:bg-red-50 transition-colors">
                                            <DeleteIcon className="w-4 h-4" /> Удалить
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* 3. Блок Шаблон Реестра */}
                        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm relative">
                            <input type="file" ref={registryInputRef} onChange={handleRegistryFileChange} className="hidden" accept=".docx" />
                            
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-start gap-3">
                                    <div className={`p-3 rounded-full ${isRegistryTemplateLoaded ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <TemplateIcon className="w-6 h-6"/>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                            Шаблон Реестра Материалов
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1 text-xs">
                                            {isRegistryTemplateLoaded ? (
                                                <>
                                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Загружен</span>
                                                    <span className="text-slate-400">Добавлен: {registryUpdateDate || 'Дата неизвестна'}</span>
                                                </>
                                            ) : (
                                                <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Не загружен</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button type="button" onClick={() => openHelp('registry')} className="text-blue-600 text-sm hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full transition-colors">
                                    <QuestionMarkCircleIcon className="w-4 h-4"/> Справка по тегам
                                </button>
                            </div>
                            
                            <p className="text-sm text-slate-600 mb-4 mt-2">
                                Дополнительный шаблон (.docx) для списка материалов. Генерируется автоматически, если материалов &gt; {formData.registryThreshold} шт.
                            </p>
                            
                            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => registryInputRef.current?.click()} className="flex items-center gap-2 bg-blue-600 text-white border border-blue-600 px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors">
                                    <CloudUploadIcon className="w-4 h-4" /> {isRegistryTemplateLoaded ? 'Заменить' : 'Загрузить'}
                                </button>
                                
                                {isRegistryTemplateLoaded && (
                                    <>
                                        <button type="button" onClick={() => onDownloadTemplate('registry')} className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded text-sm hover:bg-slate-50 transition-colors">
                                            <DownloadIcon className="w-4 h-4" /> Скачать
                                        </button>
                                        <button type="button" onClick={() => onDeleteTemplate && onDeleteTemplate('registry')} className="flex items-center gap-2 bg-white text-red-600 border border-red-200 px-4 py-2 rounded text-sm hover:bg-red-50 transition-colors">
                                            <DeleteIcon className="w-4 h-4" /> Удалить
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                    </div>
                )}
            </div>

            {/* Fixed Footer */}
            <div className="flex-shrink-0 bg-white border-t border-slate-200 p-4 flex justify-end relative z-10">
                <button
                    type="submit"
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 shadow-sm font-medium transition-colors"
                >
                    {isSaved ? 'Сохранено!' : 'Сохранить настройки'}
                </button>
            </div>

            {/* =========================================
                МОДАЛЬНОЕ ОКНО СО СПРАВКОЙ ПО ТЕГАМ (Оптимизировано от лагов)
            ========================================= */}
            {isHelpOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
                    <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <QuestionMarkCircleIcon className="w-6 h-6 text-blue-600" />
                                Справка по тегам шаблонов
                            </h2>
                            <button 
                                type="button" 
                                onClick={() => setIsHelpOpen(false)} 
                                className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 p-1.5 rounded-full transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="flex-grow overflow-y-auto p-6 bg-white">
                            <div className="flex space-x-1 border-b border-slate-200 mb-6 pb-1 sticky top-0 bg-white z-10">
                                <button
                                    type="button"
                                    onClick={() => setHelpType('main')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${helpType === 'main' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                >
                                    Для Шаблона Акта
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setHelpType('registry')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${helpType === 'registry' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                >
                                    Для Шаблона Реестра
                                </button>
                            </div>

                            <div className="text-slate-700 text-sm leading-relaxed pb-4">
                                {helpType === 'main' ? (
                                    <>
                                        <p className="mb-4">Используйте эти теги в основном шаблоне акта (.docx). Они будут автоматически заменены на реальные данные при скачивании.</p>
                                        
                                        <h4 className="font-semibold mt-4 mb-3 text-slate-800 border-b pb-1">Основные данные</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                                            <TagCard tag="{act_number}" description="Номер акта" />
                                            <TagCard tag="{object_name}" description="Наименование объекта строительства" />
                                            <TagCard tag="{act_day}" description="День подписания акта" />
                                            <TagCard tag="{act_month}" description="Месяц подписания" />
                                            <TagCard tag="{act_year}" description="Год подписания" />
                                            <TagCard tag="{copies_count}" description="Количество экземпляров" />
                                            <TagCard tag="{additional_info}" description="Дополнительные сведения" />
                                            <TagCard tag="{attachments}" description="Текст из поля Приложения" />
                                        </div>

                                        <TagGenerator />

                                        <h4 className="font-semibold mt-8 mb-3 text-slate-800 border-b pb-1">Работы, Материалы, Даты</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                                            <TagCard tag="{work_name}" description="Наименование выполненных работ" />
                                            <TagCard tag="{project_docs}" description="Проектная документация" />
                                            
                                            <TagCard tag="{materials}" description="Автоматически: Текст или ссылка на реестр" />
                                            <TagCard tag="{materials_raw}" description="Всегда полный список материалов текстом" />
                                            
                                            <TagCard tag="{material_docs}" description="Уникальные паспорта. Смарт: ссылка на реестр при лимите." />
                                            <TagCard tag="{material_docs_raw}" description="Все уникальные паспорта всегда текстом." />

                                            <TagCard tag="{certs}" description="Документы о качестве/схемы" />
                                            <TagCard tag="{regulations}" description="Нормативные документы" />
                                            <TagCard tag="{next_work}" description="Разрешенные следующие работы" />
                                            
                                            <TagCard tag="{work_start_day}" description="День начала работ" />
                                            <TagCard tag="{work_start_month}" description="Месяц начала работ" />
                                            <TagCard tag="{work_start_year}" description="Год начала работ" />
                                            
                                            <TagCard tag="{work_end_day}" description="День окончания работ" />
                                            <TagCard tag="{work_end_month}" description="Месяц окончания работ" />
                                            <TagCard tag="{work_end_year}" description="Год окончания работ" />
                                        </div>

                                        <h4 className="font-semibold mt-8 mb-3 text-slate-800 border-b pb-1">Организации-участники</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                                            <TagCard tag="{builder_details}" description="Реквизиты Застройщика" />
                                            <TagCard tag="{contractor_details}" description="Реквизиты Лица, осуществляющего строительство" />
                                            <TagCard tag="{designer_details}" description="Реквизиты Проектировщика" />
                                            <TagCard tag="{work_performer}" description="Реквизиты Лица, выполнившего работы" />
                                        </div>

                                        <h4 className="font-semibold mt-8 mb-3 text-slate-800 border-b pb-1">Комиссия (Представители)</h4>
                                        <p className="text-xs text-slate-500 mb-3">Используйте <code>{`{#tnz}...{/tnz}`}</code> вокруг блока текста, чтобы скрыть его, если этот представитель не выбран.</p>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                                            {Object.entries(ROLES).map(([key, label]) => (
                                                <div key={key} className="border border-slate-200 bg-slate-50 p-3 rounded">
                                                    <div className="font-semibold mb-2 text-slate-800">{label} ({key})</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <TagCard tag={`{${key}_details}`} description={`Полная строка по шаблону`} />
                                                        <TagCard tag={`{${key}_details_short}`} description={`Краткая строка`} />
                                                        <TagCard tag={`{${key}_name}`} description="Полное ФИО" />
                                                        <TagCard tag={`{${key}_name_short}`} description="Фамилия И.О." />
                                                        <TagCard tag={`{${key}_position}`} description="Должность" />
                                                        <TagCard tag={`{${key}_org}`} description="Организация" />
                                                        <TagCard tag={`{${key}_auth_doc}`} description="Основание" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="mb-4">Используйте эти теги в шаблоне реестра (.docx). Обязательно создайте таблицу для списка материалов.</p>
                                        
                                        <h4 className="font-semibold mt-4 mb-3 text-slate-800 border-b pb-1">Шапка реестра (Общие данные)</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                                            <TagCard tag="{act_number}" description="Номер акта" />
                                            <TagCard tag="{object_name}" description="Наименование объекта" />
                                            <TagCard tag="{act_day}" description="День подписания акта" />
                                            <TagCard tag="{act_month}" description="Месяц подписания" />
                                            <TagCard tag="{act_year}" description="Год подписания" />
                                        </div>

                                        <h4 className="font-semibold mt-6 mb-2 text-slate-800 border-b pb-1">Таблица материалов (Цикл строки)</h4>
                                        <p className="text-xs text-slate-500 mb-3">
                                            Чтобы строка таблицы повторялась для каждого материала, нужно использовать "обнимающие" теги:
                                        </p>
                                        
                                        <div className="bg-slate-50 border border-slate-200 rounded p-4 mb-4 overflow-x-auto">
                                            <p className="text-xs text-slate-600 mb-2 font-semibold">Схема таблицы в Word:</p>
                                            <table className="w-full text-xs text-left border-collapse bg-white shadow-sm">
                                                <thead>
                                                    <tr className="bg-slate-100">
                                                        <th className="border border-slate-200 p-2 w-16">№</th>
                                                        <th className="border border-slate-200 p-2">Наименование</th>
                                                        <th className="border border-slate-200 p-2">Документ</th>
                                                        <th className="border border-slate-200 p-2 w-24">Кол-во</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td className="border border-slate-200 p-2 align-top bg-blue-50 text-blue-700 font-mono">
                                                            {'{#materials_list}'} <br/>
                                                            {'{index}'}
                                                        </td>
                                                        <td className="border border-slate-200 p-2 align-top text-slate-700 font-mono">
                                                            {'{material_name}'}
                                                        </td>
                                                        <td className="border border-slate-200 p-2 align-top text-slate-700 font-mono">
                                                            {'{cert_doc}'}
                                                        </td>
                                                        <td className="border border-slate-200 p-2 align-top bg-blue-50 text-blue-700 font-mono">
                                                            {'{amount}'} <br/>
                                                            {'{/materials_list}'}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                            <p className="text-[10px] text-slate-500 mt-3 italic">
                                                * Тег <code className="bg-white px-1 border border-slate-200 rounded">{`{#materials_list}`}</code> ставится в первую ячейку, а <code className="bg-white px-1 border border-slate-200 rounded">{`{/materials_list}`}</code> в последнюю.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                                            <TagCard tag="{index}" description="Порядковый номер (1, 2, 3...)" />
                                            <TagCard tag="{name}" description="Полная строка материала (как в акте)" />
                                            <TagCard tag="{material_name}" description="Только наименование (до скобок)" />
                                            <TagCard tag="{cert_doc}" description="Документ о качестве (текст в скобках)" />
                                            <TagCard tag="{date}" description="Дата (пустая ячейка для ручного заполнения)" />
                                            <TagCard tag="{amount}" description="Кол-во листов (из базы сертификатов)" />
                                        </div>

                                        <h4 className="font-semibold mt-8 mb-3 text-slate-800 border-b pb-1">Комиссия (Представители)</h4>
                                        <p className="text-xs text-slate-500 mb-3">
                                            Те же теги, что и в основном акте. Используйте их для блока подписей внизу реестра.
                                        </p>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                                            {Object.entries(ROLES).map(([key, label]) => (
                                                <div key={key} className="border border-slate-200 bg-slate-50 p-3 rounded">
                                                    <div className="font-semibold mb-2 text-slate-800">{label} ({key})</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <TagCard tag={`{${key}_details_short}`} description={`Должность, Фамилия И.О., Документ`} />
                                                        <TagCard tag={`{${key}_name_short}`} description="Фамилия И.О." />
                                                        <TagCard tag={`{${key}_position}`} description="Должность" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
};

export default SettingsPage;