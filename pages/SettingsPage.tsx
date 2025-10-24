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

    // Fix: Widened event type to handle both Input and Textarea elements and adjusted logic to be type-safe.
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
                     <label htmlFor="defaultCopiesCount" className={labelClass}>
                        Количество экземпляров по умолчанию
                    </label>
                    <input
                        type="number"
                        id="defaultCopiesCount"
                        name="defaultCopiesCount"
                        value={formData.defaultCopiesCount}
                        onChange={handleNumberChange}
                        className={inputClass}
                        min="1"
                        required
                    />
                </div>

                <fieldset className="space-y-4">
                    <legend className="text-base font-medium text-slate-800">Настройки формы акта</legend>
                     <div className="relative flex items-start">
                        <div className="flex h-6 items-center">
                          <input
                            id="showAdditionalInfo"
                            name="showAdditionalInfo"
                            type="checkbox"
                            checked={formData.showAdditionalInfo}
                            onChange={handleChange}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                        <div className="ml-3 text-sm leading-6">
                          <label htmlFor="showAdditionalInfo" className="font-medium text-gray-900">
                            Показывать поле "Дополнительные сведения"
                          </label>
                        </div>
                      </div>
                      <div className="relative flex items-start">
                        <div className="flex h-6 items-center">
                          <input
                            id="showAttachments"
                            name="showAttachments"
                            type="checkbox"
                            checked={formData.showAttachments}
                            onChange={handleChange}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                        <div className="ml-3 text-sm leading-6">
                          <label htmlFor="showAttachments" className="font-medium text-gray-900">
                            Показывать поле "Приложения"
                          </label>
                           <p className="text-xs text-slate-500">Поле нередактируемое и заполняется автоматически, но его можно скрыть из формы.</p>
                        </div>
                      </div>
                      <div className="relative flex items-start">
                        <div className="flex h-6 items-center">
                            <input
                            id="showActDate"
                            name="showActDate"
                            type="checkbox"
                            checked={!!formData.showActDate}
                            onChange={handleChange}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                        </div>
                        <div className="ml-3 text-sm leading-6">
                            <label htmlFor="showActDate" className="font-medium text-gray-900">
                                Показывать поле "Дата акта"
                            </label>
                            <p className="text-xs text-slate-500">Полезно, если нужно вручную корректировать дату, которая по умолчанию равна дате окончания работ.</p>
                        </div>
                      </div>
                       <div className="relative flex items-start">
                        <div className="flex h-6 items-center">
                            <input
                            id="showParticipantDetails"
                            name="showParticipantDetails"
                            type="checkbox"
                            checked={!!formData.showParticipantDetails}
                            onChange={handleChange}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                        </div>
                        <div className="ml-3 text-sm leading-6">
                            <label htmlFor="showParticipantDetails" className="font-medium text-gray-900">
                                Показывать раздел "Реквизиты участников"
                            </label>
                            <p className="text-xs text-slate-500">Этот раздел заполняется автоматически, его можно скрыть для экономии места.</p>
                        </div>
                      </div>
                       <div className="relative flex items-start">
                        <div className="flex h-6 items-center">
                            <input
                            id="useShortOrgNames"
                            name="useShortOrgNames"
                            type="checkbox"
                            checked={!!formData.useShortOrgNames}
                            onChange={handleChange}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                        </div>
                        <div className="ml-3 text-sm leading-6">
                            <label htmlFor="useShortOrgNames" className="font-medium text-gray-900">
                                Использовать только наименование организации в реквизитах
                            </label>
                            <p className="text-xs text-slate-500">Вместо полных данных (ИНН, ОГРН, адрес) в поля акта будет подставляться только название.</p>
                        </div>
                      </div>
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