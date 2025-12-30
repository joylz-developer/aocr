
import React, { useState } from 'react';
import Modal from './Modal';
import { ImportData, ImportSettings, ImportMode, ImportSettingsCategory, Act, Person, Organization, ProjectSettings, CommissionGroup, DeletedActEntry, Certificate } from '../types';

interface ImportModalProps {
    data: ImportData;
    onClose: () => void;
    onImport: (settings: ImportSettings) => void;
}

type CategoryKey = 'acts' | 'people' | 'organizations' | 'groups' | 'deletedActs' | 'certificates';
type CategoryItem = Act | Person | Organization | CommissionGroup | DeletedActEntry | Certificate;

const ImportModal: React.FC<ImportModalProps> = ({ data, onClose, onImport }) => {

    const [settings, setSettings] = useState<ImportSettings>({
        template: data.template !== null && data.template !== undefined,
        projectSettings: data.projectSettings !== null && data.projectSettings !== undefined,
        acts: { import: !!data.acts?.length, mode: 'merge', selectedIds: data.acts?.map(i => i.id) },
        people: { import: !!data.people?.length, mode: 'merge', selectedIds: data.people?.map(i => i.id) },
        organizations: { import: !!data.organizations?.length, mode: 'merge', selectedIds: data.organizations?.map(i => i.id) },
        groups: { import: !!data.groups?.length, mode: 'merge', selectedIds: data.groups?.map(i => i.id) },
        deletedActs: { import: !!data.deletedActs?.length, mode: 'merge', selectedIds: data.deletedActs?.map(i => i.act.id) },
        certificates: { import: !!data.certificates?.length, mode: 'merge', selectedIds: data.certificates?.map(i => i.id) },
    });
    
    const isDataPresent =
        (data.template !== null && data.template !== undefined) ||
        (data.projectSettings !== null && data.projectSettings !== undefined) ||
        (data.acts && data.acts.length > 0) ||
        (data.people && data.people.length > 0) ||
        (data.organizations && data.organizations.length > 0) ||
        (data.groups && data.groups.length > 0) ||
        (data.deletedActs && data.deletedActs.length > 0) ||
        (data.certificates && data.certificates.length > 0);


    const handleCheckboxChange = (category: CategoryKey, value: boolean) => {
        setSettings(prev => ({
            ...prev,
            [category]: { ...prev[category], import: value },
        }));
    };
    
    const handleModeChange = (category: CategoryKey, mode: ImportMode) => {
        setSettings(prev => ({
            ...prev,
            [category]: { ...prev[category], mode: mode },
        }));
    };
    
     const handleItemSelectionChange = (category: CategoryKey, itemId: string, isSelected: boolean) => {
        setSettings(prev => {
            const currentSelection = prev[category].selectedIds || [];
            const newSelection = isSelected 
                ? [...currentSelection, itemId] 
                : currentSelection.filter(id => id !== itemId);
            return {
                ...prev,
                [category]: { ...prev[category], selectedIds: newSelection }
            };
        });
    };
    
    const handleSelectAll = (category: CategoryKey, selectAll: boolean) => {
        const allIds = (data[category] as CategoryItem[] | undefined)?.map(item => 'act' in item ? item.act.id : item.id) || [];
        setSettings(prev => ({
            ...prev,
            [category]: { ...prev[category], selectedIds: selectAll ? allIds : [] }
        }));
    };

    const handleSubmit = () => {
        onImport(settings);
    };

    const ImportOptionRow: React.FC<{
        category: CategoryKey;
        label: string;
        items: CategoryItem[] | undefined;
    }> = ({ category, label, items }) => {
        const count = items?.length || 0;
        if (count === 0) return null;
        
        const categorySettings = settings[category] as ImportSettingsCategory;

        return (
            <div className="p-4 border rounded-md bg-slate-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id={`import-${category}`}
                            checked={categorySettings.import}
                            onChange={(e) => handleCheckboxChange(category, e.target.checked)}
                            className="h-5 w-5 form-checkbox-custom"
                        />
                        <label htmlFor={`import-${category}`} className="ml-3 text-lg font-semibold text-slate-800 cursor-pointer">
                            {label}
                        </label>
                    </div>
                    <span className="text-sm text-slate-500">Найдено: {count}</span>
                </div>
                {categorySettings.import && (
                     <fieldset className="mt-4 pl-8">
                        <legend className="sr-only">Режим импорта для {label}</legend>
                        <div className="space-y-2">
                             <div className="flex items-center">
                                <input 
                                    type="radio" 
                                    id={`${category}-merge`} 
                                    name={`${category}-mode`} 
                                    value="merge"
                                    checked={categorySettings.mode === 'merge'}
                                    onChange={() => handleModeChange(category, 'merge')}
                                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor={`${category}-merge`} className="ml-3 block text-sm text-slate-700 cursor-pointer">
                                    <span className="font-medium">Добавить и обновить</span>
                                    <span className="block text-xs text-slate-500">Новые записи будут добавлены, существующие — обновлены.</span>
                                </label>
                            </div>
                            <div className="flex items-center">
                                <input 
                                    type="radio" 
                                    id={`${category}-replace`} 
                                    name={`${category}-mode`} 
                                    value="replace"
                                    checked={categorySettings.mode === 'replace'}
                                    onChange={() => handleModeChange(category, 'replace')}
                                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor={`${category}-replace`} className="ml-3 block text-sm text-slate-700 cursor-pointer">
                                    <span className="font-medium">Заменить все</span>
                                     <span className="block text-xs text-slate-500">Все текущие записи будут удалены перед импортом.</span>
                                </label>
                            </div>
                        </div>
                    </fieldset>
                )}
                {categorySettings.import && categorySettings.mode === 'merge' && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="flex justify-between items-center mb-2 px-1">
                             <h4 className="text-sm font-semibold text-slate-600">Выберите элементы для импорта:</h4>
                             <div className="space-x-2">
                                <button type="button" onClick={() => handleSelectAll(category, true)} className="text-xs font-medium text-blue-600 hover:underline">Выбрать все</button>
                                <button type="button" onClick={() => handleSelectAll(category, false)} className="text-xs font-medium text-blue-600 hover:underline">Снять все</button>
                             </div>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1 p-1 pr-2 rounded-md border bg-white">
                            {items.map(item => {
                                const id = 'act' in item ? item.act.id : item.id;
                                let displayName = 'Неизвестная запись';
                                if ('act' in item) {
                                    displayName = `Акт №${item.act.number || 'б/н'}`;
                                } else if ('name' in item) {
                                    displayName = item.name;
                                } else if ('number' in item) {
                                    displayName = `Сертификат №${item.number}`;
                                }

                                return (
                                <div key={id} className="flex items-center p-2 rounded hover:bg-slate-100">
                                    <input
                                        type="checkbox"
                                        id={`item-${category}-${id}`}
                                        checked={categorySettings.selectedIds?.includes(id)}
                                        onChange={(e) => handleItemSelectionChange(category, id, e.target.checked)}
                                        className="h-4 w-4 form-checkbox-custom"
                                    />
                                    <label htmlFor={`item-${category}-${id}`} className="ml-3 block text-sm text-slate-700 truncate cursor-pointer" title={displayName}>
                                       {displayName}
                                    </label>
                                </div>
                            )})}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Настройки импорта">
            <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-4">
                {!isDataPresent ? (
                     <p className="text-slate-600 text-center">В файле нет данных для импорта.</p>
                ) : (
                    <>
                    <p className="text-slate-600">Выберите, какие данные вы хотите импортировать из файла и как это сделать.</p>
                    
                    {data.template !== undefined && data.template !== null && (
                        <div className="p-4 border rounded-md bg-slate-50 flex items-center">
                            <input
                                type="checkbox"
                                id="import-template"
                                checked={settings.template}
                                onChange={(e) => setSettings(s => ({...s, template: e.target.checked}))}
                                className="h-5 w-5 form-checkbox-custom"
                            />
                            <label htmlFor="import-template" className="ml-3 text-lg font-semibold text-slate-800 cursor-pointer">
                                Шаблон документа
                            </label>
                        </div>
                    )}

                    {data.projectSettings && (
                        <div className="p-4 border rounded-md bg-slate-50 flex items-center">
                            <input
                                type="checkbox"
                                id="import-projectSettings"
                                checked={settings.projectSettings}
                                onChange={(e) => setSettings(s => ({...s, projectSettings: e.target.checked}))}
                                className="h-5 w-5 form-checkbox-custom"
                            />
                            <label htmlFor="import-projectSettings" className="ml-3 text-lg font-semibold text-slate-800 cursor-pointer">
                                Настройки проекта
                            </label>
                        </div>
                    )}
                    
                    <ImportOptionRow category="acts" label="Акты" items={data.acts} />
                    <ImportOptionRow category="people" label="Участники" items={data.people} />
                    <ImportOptionRow category="organizations" label="Организации" items={data.organizations} />
                    <ImportOptionRow category="groups" label="Группы комиссий" items={data.groups} />
                    <ImportOptionRow category="certificates" label="Сертификаты" items={data.certificates} />
                    <ImportOptionRow category="deletedActs" label="Акты в корзине" items={data.deletedActs} />
                    </>
                )}


                <div className="flex justify-end space-x-3 pt-4 sticky bottom-0 bg-white py-4">
                    <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">{isDataPresent ? 'Отмена' : 'Закрыть'}</button>
                    {isDataPresent && <button type="button" onClick={handleSubmit} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Импортировать</button>}
                </div>
            </div>
        </Modal>
    );
};

export default ImportModal;