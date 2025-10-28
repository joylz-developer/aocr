import React, { useState, useEffect } from 'react';
import { ProjectSettings } from '../types';

interface SettingsPageProps {
    settings: ProjectSettings;
    onSave: (settings: ProjectSettings) => void;
}

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

    const SettingToggle: React.FC<{
        id: keyof ProjectSettings;
        label: string;
        description?: string;
        children?: React.ReactNode;
    }> = ({ id, label, description, children }) => (
        <div className="relative flex items-start">
            <div className="flex h-6 items-center">
                <input
                    id={id}
                    name={id}
                    type="checkbox"
                    checked={!!formData[id]}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
            </div>
            <div className="ml-3 text-sm leading-6 flex-1">
                <label htmlFor={id} className="font-medium text-gray-900">
                    {label}
                </label>
                {description && <p className="text-xs text-slate-500">{description}</p>}
                {formData[id] && children}
            </div>
        </div>
    );

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
                    <legend className="text-base font-medium text-slate-800">Настройки формы акта</legend>

                    <SettingToggle id="showAdditionalInfo" label='Показывать поле "Дополнительные сведения"'>
                        <div className="mt-2">
                            <label htmlFor="defaultAdditionalInfo" className="block text-xs font-medium text-slate-600 mb-1">
                                Значение по умолчанию
                            </label>
                            <textarea id="defaultAdditionalInfo" name="defaultAdditionalInfo" value={formData.defaultAdditionalInfo || ''} onChange={handleChange} className={`${inputClass} text-sm`} rows={2} placeholder="Например: Работы выполнены в соответствии с..." />
                            <p className="text-xs text-slate-500 mt-1">
                                Можно использовать переменные, например: <code>{`{workName}`}</code>.
                                <br/><strong className="text-amber-700">Внимание:</strong> поле будет автоматически обновляться, перезаписывая ручной ввод.
                            </p>
                        </div>
                    </SettingToggle>

                    <SettingToggle id="showAttachments" label='Показывать поле "Приложения"'>
                         <div className="mt-2">
                            <label htmlFor="defaultAttachments" className="block text-xs font-medium text-slate-600 mb-1">
                                Значение по умолчанию
                            </label>
                            <textarea id="defaultAttachments" name="defaultAttachments" value={formData.defaultAttachments || ''} onChange={handleChange} className={`${inputClass} text-sm`} rows={2} placeholder="Например: Исполнительные схемы: {certs}" />
                             <p className="text-xs text-slate-500 mt-1">
                                Можно использовать переменные, например: <code>{`{materials}`}</code>, <code>{`{certs}`}</code>.
                                <br/><strong className="text-amber-700">Внимание:</strong> поле будет автоматически обновляться, перезаписывая ручной ввод.
                            </p>
                        </div>
                    </SettingToggle>

                    <SettingToggle id="showCopiesCount" label='Показывать поле "Количество экземпляров"'>
                        <div className="mt-2">
                            <label htmlFor="defaultCopiesCount" className="block text-xs font-medium text-slate-600 mb-1">
                                Количество экземпляров по умолчанию
                            </label>
                            <input type="number" id="defaultCopiesCount" name="defaultCopiesCount" value={formData.defaultCopiesCount} onChange={handleNumberChange} className={inputClass} min="1" required />
                        </div>
                    </SettingToggle>
                    
                    <SettingToggle id="showActDate" label='Показывать поле "Дата акта"' description="Полезно, если нужно вручную корректировать дату, которая по умолчанию равна дате окончания работ." />
                       
                    <SettingToggle id="showParticipantDetails" label='Показывать раздел "Реквизиты участников"' description="Этот раздел в модальном окне редактирования участников заполняется автоматически, его можно скрыть для экономии места." />

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