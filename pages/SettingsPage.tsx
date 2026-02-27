
import React, { useState, useEffect, useRef } from 'react';
import { ProjectSettings, ROLES } from '../types';
import { generateContent } from '../services/aiService';
import { ImportIcon, ExportIcon, TemplateIcon, DownloadIcon, QuestionMarkCircleIcon, CloudUploadIcon, DeleteIcon, CopyIcon, SparklesIcon } from '../components/Icons';

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
            let top = rect.top - 10;
            let left = rect.left + rect.width / 2;
            
            if (top < 50) top = rect.bottom + 10;
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
    
    // Updated: Use standard tag for consistency and wrapping support
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
                {/* RECOMMENDED OPTION */}
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
                            <li>
                                Скопируйте блок ниже и вставьте в ячейку таблицы Word.
                            </li>
                            <li>
                                <span className="text-red-600 font-bold">Важно:</span> Выделите <strong>только среднюю строку</strong> (где имя поля) и нажмите кнопку "Нумерованный список" в Word.
                            </li>
                            <li>
                                Верхний и нижний теги должны остаться <strong>без цифр</strong>.
                            </li>
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

                {/* SIMPLE OPTION */}
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm relative opacity-90 hover:opacity-100 transition-opacity">
                    <h5 className="font-bold text-base text-slate-700 mb-4 flex items-center gap-2">
                        <span className="bg-slate-100 text-slate-500 rounded-full w-6 h-6 flex items-center justify-center text-xs border border-slate-200">2</span>
                        Простой текст (одной строкой)
                    </h5>
                    
                    <div className="text-sm text-slate-600 space-y-3 mb-4">
                        <p className="font-medium text-slate-800">Как это работает:</p>
                        <ul className="list-disc pl-5 space-y-2 marker:text-slate-400">
                            <li>
                                Весь текст вставляется в одну ячейку.
                            </li>
                            <li>
                                Переносы строк сохраняются, но это не список Word.
                            </li>
                            <li>
                                Подходит, если вы не используете авто-нумерацию Word.
                            </li>
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

const VariableHelpTooltip: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    // Using unified tags that match Word template usage
    const variables = [
        { name: '{act_number}', desc: 'Номер акта' },
        { name: '{materials}', desc: 'Список материалов' },
        { name: '{material_docs}', desc: 'Список уникальных документов (паспортов)' },
        { name: '{certs}', desc: 'Исполнительные схемы' },
        { name: '{work_start_date}', desc: 'Дата начала работ' },
        { name: '{work_end_date}', desc: 'Дата окончания работ' },
        { name: '{project_docs}', desc: 'Проектная документация' },
        { name: '{regulations}', desc: 'Нормативные документы' },
        { name: '{object_name}', desc: 'Наименование объекта' },
        { name: '{work_name}', desc: 'Наименование работ' },
    ];

    return (
        <div className="relative inline-flex ml-2" onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
            <button type="button" className="text-slate-400 hover:text-blue-600 focus:outline-none" aria-label="Показать доступные переменные">
                <QuestionMarkCircleIcon className="w-4 h-4" />
            </button>
            {isVisible && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 bg-slate-800 text-white text-sm rounded-lg shadow-lg p-3 z-10">
                    <h4 className="font-bold mb-2 text-xs uppercase tracking-wider text-slate-400">Можно использовать теги:</h4>
                    <ul className="space-y-1 mb-2">
                        {variables.map(v => (
                             <li key={v.name} className="flex justify-between">
                                <code className="text-cyan-300">{v.name}</code>
                                <span className="text-slate-300 text-right text-xs">{v.desc}</span>
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
                        <div className="space-y-4">
                            <h3 className="text-base font-medium text-slate-800 border-b border-slate-100 pb-2 mb-4">Настройки AI (Распознавание документов)</h3>
                            
                            <div>
                                <label htmlFor="aiModel" className={labelClass}>
                                    AI Модель
                                </label>
                                <select
                                    id="aiModel"
                                    name="aiModel"
                                    value={formData.aiModel || 'gemini-2.5-flash'}
                                    onChange={handleChange}
                                    className={inputClass}
                                >
                                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (Google API Key)</option>
                                    <optgroup label="OpenRouter (Платные / Дешевые)">
                                        <option value="qwen/qwen-2.5-vl-72b-instruct">Qwen 2.5 VL 72B Instruct</option>
                                        <option value="qwen/qwen-2.5-vl-7b-instruct">Qwen 2.5 VL 7B Instruct</option>
                                    </optgroup>
                                    <optgroup label="OpenRouter (Бесплатные)">
                                        <option value="google/gemini-2.0-flash-thinking-exp:free">Gemini 2.0 Flash Thinking Exp (Free)</option>
                                        <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash Exp (Free)</option>
                                    </optgroup>
                                    <option value="custom">Ввести свой ID модели...</option>
                                </select>
                            </div>

                            {formData.aiModel === 'custom' && (
                                <div>
                                    <label htmlFor="customAiModel" className={labelClass}>
                                        ID Модели (с OpenRouter)
                                    </label>
                                    <input
                                        type="text"
                                        id="customAiModel"
                                        name="customAiModel"
                                        value={formData.customAiModel || ''}
                                        onChange={handleChange}
                                        className={inputClass}
                                        placeholder="например: google/gemini-2.0-pro-exp-02-05:free"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        Найдите ID модели на <a href="https://openrouter.ai/models?q=free" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenRouter Models</a>.
                                    </p>
                                </div>
                            )}

                            {(!formData.aiModel || formData.aiModel === 'gemini-2.5-flash') && (
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
                            )}

                            {formData.aiModel && formData.aiModel !== 'gemini-2.5-flash' && (
                                <>
                                    <div>
                                        <label htmlFor="openAiApiKey" className={labelClass}>
                                            OpenRouter API Key
                                        </label>
                                        <input
                                            type="password"
                                            id="openAiApiKey"
                                            name="openAiApiKey"
                                            value={formData.openAiApiKey || ''}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="sk-or-v1-..."
                                        />
                                        <p className="text-xs text-slate-500 mt-1">
                                            Получите ключ на <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenRouter</a>.
                                        </p>
                                    </div>
                                    <div>
                                        <label htmlFor="openAiBaseUrl" className={labelClass}>
                                            OpenAI Base URL (Опционально)
                                            <div className="relative inline-flex ml-2 group">
                                                <button type="button" className="text-slate-400 hover:text-blue-600 focus:outline-none" aria-label="Справка">
                                                    <QuestionMarkCircleIcon className="w-4 h-4" />
                                                </button>
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 bg-slate-800 text-white text-xs rounded-lg shadow-lg p-3 z-50 hidden group-hover:block pointer-events-none">
                                                    <p className="font-semibold mb-1">Базовый адрес API:</p>
                                                    <ul className="list-disc pl-4 space-y-1 text-slate-300">
                                                        <li>Оставьте пустым для <strong>OpenRouter</strong> (по умолчанию).</li>
                                                        <li>Используйте для переключения на других провайдеров (DeepSeek, Together AI).</li>
                                                        <li>Для локальных нейросетей (Ollama, LM Studio): <code className="text-cyan-300">http://localhost:11434/v1</code></li>
                                                    </ul>
                                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-slate-800 -mb-2"></div>
                                                </div>
                                            </div>
                                        </label>
                                        <input
                                            type="text"
                                            id="openAiBaseUrl"
                                            name="openAiBaseUrl"
                                            value={formData.openAiBaseUrl || 'https://openrouter.ai/api/v1'}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="https://openrouter.ai/api/v1"
                                        />
                                    </div>
                                </>
                            )}
                            
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

                        <div className="space-y-4 pt-4">
                            <h3 className="text-base font-medium text-slate-800 border-b border-slate-100 pb-2 mb-4">Настройки формы акта</h3>

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
                                    <textarea id="defaultAdditionalInfo" name="defaultAdditionalInfo" value={formData.defaultAdditionalInfo || ''} onChange={handleChange} className={`${inputClass} text-sm`} rows={6} placeholder="Например: Работы выполнены в соответствии с..." />
                                </div>
                            </SettingToggle>

                            <SettingToggle id="showAttachments" label='Показывать поле "Приложения"' formData={formData} handleChange={handleChange}>
                                <div className="mt-2">
                                    <label htmlFor="defaultAttachments" className="flex items-center text-xs font-medium text-slate-600 mb-1">
                                        <span>Значение по умолчанию</span>
                                        <VariableHelpTooltip />
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
                                        <VariableHelpTooltip />
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
                            
                        </div>
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
                                    
                                    <div className="bg-blue-50 border border-blue-100 p-3 rounded mb-4 mt-2">
                                        <h4 className="font-semibold text-blue-800 mb-1">Использование в полях по умолчанию</h4>
                                        <p className="text-xs text-blue-700">
                                            Теги можно использовать не только в Word-шаблоне, но и в настройках приложения (например, в полях "Приложения" или "Доп. сведения").
                                            При генерации документа программа заменит их на данные из текущего акта.
                                        </p>
                                        <div className="mt-2 text-xs">
                                            <strong>Пример для поля "Приложения":</strong>
                                            <code className="block mt-1 bg-white border border-blue-200 p-1.5 rounded text-slate-600">
                                                Исполнительная схема; {'{certs}'};{'\n'}
                                                {'{materials}'}
                                            </code>
                                        </div>
                                    </div>

                                    <h4 className="font-semibold mt-4">Основные данные</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <TagTooltip tag="{act_number}" description="Номер акта" />
                                        <TagTooltip tag="{object_name}" description="Наименование объекта строительства" />
                                        <TagTooltip tag="{act_day}" description="День подписания акта" />
                                        <TagTooltip tag="{act_month}" description="Месяц подписания" />
                                        <TagTooltip tag="{act_year}" description="Год подписания" />
                                        <TagTooltip tag="{copies_count}" description="Количество экземпляров" />
                                        <TagTooltip tag="{additional_info}" description="Дополнительные сведения" />
                                        <TagTooltip tag="{attachments}" description="Текст из поля Приложения (одной строкой с переносами)" />
                                    </div>

                                    {/* GENERATOR COMPONENT */}
                                    <TagGenerator />

                                    <h4 className="font-semibold mt-4">Организации-участники</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <TagTooltip tag="{builder_details}" description="Реквизиты Застройщика" />
                                        <TagTooltip tag="{contractor_details}" description="Реквизиты Лица, осуществляющего строительство" />
                                        <TagTooltip tag="{designer_details}" description="Реквизиты Проектировщика" />
                                    </div>

                                    <h4 className="font-semibold mt-4">Произвели осмотр работ</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <TagTooltip tag="{work_performer}" description="Реквизиты Лица, выполнившего работы" />
                                    </div>

                                    <h4 className="font-semibold mt-4">Работы, Материалы, Даты</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <TagTooltip tag="{work_name}" description="Наименование выполненных работ" />
                                        <TagTooltip tag="{project_docs}" description="Проектная документация" />
                                        
                                        <TagTooltip tag="{materials}" description="Автоматически: 'Текст материалов' ИЛИ 'ссылка на реестр' (если материалов > порога)" />
                                        <TagTooltip tag="{materials_raw}" description="Всегда полный список материалов текстом" />
                                        
                                        <TagTooltip tag="{material_docs}" description="Уникальные паспорта/сертификаты (без названий материалов). Смарт: если материалов много, будет ссылка на реестр." />
                                        <TagTooltip tag="{material_docs_raw}" description="Все уникальные паспорта/сертификаты (без названий) всегда полным списком." />

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
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    <TagTooltip tag={`{${key}_details}`} description={`Должность, ФИО, Документ`} />
                                                    <TagTooltip tag={`{${key}_details_short}`} description={`Должность, Фамилия И.О., Документ`} />
                                                    <TagTooltip tag={`{${key}_name}`} description="Полное ФИО" />
                                                    <TagTooltip tag={`{${key}_name_short}`} description="Фамилия И.О." />
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

                                    <h4 className="font-semibold mt-4">Таблица материалов (Цикл строки)</h4>
                                    <p className="text-xs text-slate-500 mb-2">
                                        Чтобы строка таблицы повторялась для каждого материала, нужно использовать "обнимающие" теги:
                                    </p>
                                    
                                    {/* Visual Representation of Table Row Loop */}
                                    <div className="bg-slate-50 border border-slate-200 rounded p-4 mb-4 overflow-x-auto">
                                        <p className="text-xs text-slate-600 mb-2 font-semibold">Схема таблицы в Word:</p>
                                        <table className="w-full text-xs text-left border-collapse bg-white">
                                            <thead>
                                                <tr className="bg-slate-100">
                                                    <th className="border p-2 w-16">№</th>
                                                    <th className="border p-2">Наименование</th>
                                                    <th className="border p-2">Документ</th>
                                                    <th className="border p-2 w-24">Кол-во</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td className="border p-2 align-top bg-blue-50 text-blue-700 font-mono">
                                                        {'{#materials_list}'} <br/>
                                                        {'{index}'}
                                                    </td>
                                                    <td className="border p-2 align-top text-slate-700 font-mono">
                                                        {'{material_name}'}
                                                    </td>
                                                    <td className="border p-2 align-top text-slate-700 font-mono">
                                                        {'{cert_doc}'}
                                                    </td>
                                                    <td className="border p-2 align-top bg-blue-50 text-blue-700 font-mono">
                                                        {'{amount}'} <br/>
                                                        {'{/materials_list}'}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <p className="text-[10px] text-slate-500 mt-2 italic">
                                            * Тег <code>{`{#materials_list}`}</code> ставится в первую ячейку, а <code>{`{/materials_list}`}</code> в последнюю.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2 ml-4">
                                        <TagTooltip tag="{index}" description="Порядковый номер (1, 2, 3...)" />
                                        <TagTooltip tag="{name}" description="Полная строка материала (как в акте)" />
                                        <TagTooltip tag="{material_name}" description="Только наименование материала (до скобок)" />
                                        <TagTooltip tag="{cert_doc}" description="Документ о качестве (текст внутри скобок)" />
                                        <TagTooltip tag="{date}" description="Дата (пустая ячейка для ручного заполнения)" />
                                        <TagTooltip tag="{amount}" description="Кол-во листов (пустая ячейка)" />
                                    </div>

                                    <h4 className="font-semibold mt-4">Комиссия (Представители)</h4>
                                    <p className="text-xs text-slate-500 mb-2">
                                        Те же теги, что и в основном акте. Используйте их для блока подписей внизу реестра.
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                        {Object.entries(ROLES).map(([key, label]) => (
                                            <div key={key} className="border p-2 rounded">
                                                <div className="font-medium mb-1">{label} ({key})</div>
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    <TagTooltip tag={`{${key}_details_short}`} description={`Должность, Фамилия И.О., Документ`} />
                                                    <TagTooltip tag={`{${key}_name_short}`} description="Фамилия И.О." />
                                                    <TagTooltip tag={`{${key}_position}`} description="Должность" />
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
