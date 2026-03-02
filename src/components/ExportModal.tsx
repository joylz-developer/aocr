
import React, { useState } from 'react';
import Modal from './Modal';
import { ExportSettings } from '../types';

interface ExportModalProps {
    onClose: () => void;
    onExport: (settings: ExportSettings) => void;
    counts: {
        acts: number;
        people: number;
        organizations: number;
        groups: number;
        regulations: number;
        certificates: number;
        deletedActs: number;
        deletedCertificates: number;
        hasTemplate: boolean;
        hasRegistryTemplate: boolean;
    };
}

const ExportModal: React.FC<ExportModalProps> = ({ onClose, onExport, counts }) => {
    const [settings, setSettings] = useState<ExportSettings>({
        template: counts.hasTemplate,
        registryTemplate: counts.hasRegistryTemplate,
        projectSettings: true,
        acts: counts.acts > 0,
        people: counts.people > 0,
        organizations: counts.organizations > 0,
        groups: counts.groups > 0,
        regulations: counts.regulations > 0,
        certificates: counts.certificates > 0,
        deletedActs: counts.deletedActs > 0,
        deletedCertificates: counts.deletedCertificates > 0,
    });

    const handleCheckboxChange = (key: keyof ExportSettings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSelectAll = (select: boolean) => {
        setSettings({
            template: select && counts.hasTemplate,
            registryTemplate: select && counts.hasRegistryTemplate,
            projectSettings: select,
            acts: select && counts.acts > 0,
            people: select && counts.people > 0,
            organizations: select && counts.organizations > 0,
            groups: select && counts.groups > 0,
            regulations: select && counts.regulations > 0,
            certificates: select && counts.certificates > 0,
            deletedActs: select && counts.deletedActs > 0,
            deletedCertificates: select && counts.deletedCertificates > 0,
        });
    };

    const handleExport = () => {
        onExport(settings);
    };

    const OptionRow: React.FC<{
        id: keyof ExportSettings;
        label: string;
        count?: number;
        disabled?: boolean;
    }> = ({ id, label, count, disabled = false }) => (
        <div className={`flex items-center justify-between p-3 border rounded-md ${disabled ? 'bg-slate-100 opacity-60' : 'bg-white'}`}>
            <div className="flex items-center">
                <input
                    type="checkbox"
                    id={`export-${id}`}
                    checked={settings[id]}
                    onChange={() => handleCheckboxChange(id)}
                    disabled={disabled}
                    className="h-5 w-5 form-checkbox-custom"
                />
                <label htmlFor={`export-${id}`} className={`ml-3 font-medium text-slate-800 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                    {label}
                </label>
            </div>
            {count !== undefined && <span className="text-sm text-slate-500">{count} шт.</span>}
        </div>
    );

    return (
        <Modal isOpen={true} onClose={onClose} title="Экспорт данных">
            <div className="space-y-4">
                <p className="text-slate-600 text-sm">
                    Выберите, какие данные включить в файл резервной копии (.json).
                </p>

                <div className="flex justify-end gap-2 text-sm text-blue-600">
                    <button onClick={() => handleSelectAll(true)} className="hover:underline">Выбрать все</button>
                    <button onClick={() => handleSelectAll(false)} className="hover:underline">Снять все</button>
                </div>

                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                    <OptionRow id="template" label="Шаблон документа (Акт)" disabled={!counts.hasTemplate} />
                    <OptionRow id="registryTemplate" label="Шаблон реестра материалов" disabled={!counts.hasRegistryTemplate} />
                    <OptionRow id="projectSettings" label="Настройки приложения" />
                    
                    <div className="border-t my-2"></div>
                    
                    <OptionRow id="acts" label="Акты" count={counts.acts} disabled={counts.acts === 0} />
                    <OptionRow id="people" label="Участники" count={counts.people} disabled={counts.people === 0} />
                    <OptionRow id="organizations" label="Организации" count={counts.organizations} disabled={counts.organizations === 0} />
                    <OptionRow id="groups" label="Группы комиссий" count={counts.groups} disabled={counts.groups === 0} />
                    <OptionRow id="certificates" label="Сертификаты" count={counts.certificates} disabled={counts.certificates === 0} />
                    <OptionRow id="regulations" label="Нормативные документы" count={counts.regulations} disabled={counts.regulations === 0} />
                    
                    <div className="border-t my-2"></div>
                    
                    <OptionRow id="deletedActs" label="Корзина (Акты)" count={counts.deletedActs} disabled={counts.deletedActs === 0} />
                    <OptionRow id="deletedCertificates" label="Корзина (Сертификаты)" count={counts.deletedCertificates} disabled={counts.deletedCertificates === 0} />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 mt-4">
                    <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">
                        Отмена
                    </button>
                    <button 
                        type="button" 
                        onClick={handleExport} 
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
                    >
                        Скачать файл
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ExportModal;
