
import React, { useState, useEffect } from 'react';
import { ProjectSettings } from '../types';

interface SettingsPageProps {
    settings: ProjectSettings;
    onSave: (settings: ProjectSettings) => void;
}

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


const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onSave }) => {
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
    
    const inputClass = "mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900";
    const labelClass = "block text-sm font-medium text-slate-700";

    return (
        <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">Настройки проекта</h1>
            <form onSubmit={handleSubmit} className="space-y-6">
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
                
                <div className="flex justify-end items-center pt-4 gap-4">
                    {isSaved && (
                        <p className="text-green-600 text-sm transition-opacity duration-300">
                           Настройки успешно сохранены!
                        </p>
                     )}
                     <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">
                        Сохранить настройки
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SettingsPage;