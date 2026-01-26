
import React, { useState, useEffect, useRef } from 'react';
import { Organization, ProjectSettings, ConstructionObject } from '../types';
import Modal from '../components/Modal';
import { PlusIcon, EditIcon, DeleteIcon, CopyIcon } from '../components/Icons';
import { GoogleGenAI } from '@google/genai';
import ObjectResourceImporter from '../components/ObjectResourceImporter';

interface OrganizationsPageProps {
    organizations: Organization[]; // Current object's orgs
    allOrganizations: Organization[]; // All orgs for copying
    constructionObjects: ConstructionObject[];
    currentObjectId: string | null;
    settings: ProjectSettings;
    onSave: (org: Organization) => void;
    onDelete: (id: string) => void;
    onImport: (items: Organization[]) => void;
}

const CameraIcon: React.FC = () => (
    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
);

const imageFileToBase64 = (file: File): Promise<{ mimeType: string, data: string }> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                const [header, data] = reader.result.split(',');
                const mimeType = header.match(/:(.*?);/)?.[1];
                if (mimeType && data) {
                    resolve({ mimeType, data });
                } else {
                    reject(new Error('Failed to parse file data URL.'));
                }
            } else {
                reject(new Error('Failed to read file as base64 string.'));
            }
        };
        reader.onerror = (error) => reject(error);
    });


const OrganizationForm: React.FC<{
    organization: Organization | null,
    settings: ProjectSettings,
    onSave: (org: Organization) => void,
    onClose: () => void
}> = ({ organization, settings, onSave, onClose }) => {
    const [formData, setFormData] = useState({
        name: '', ogrn: '', inn: '', kpp: '',
        address: '', phone: '', sro: '',
    });
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [ocrError, setOcrError] = useState<string | null>(null);
    const ocrInputRef = useRef<HTMLInputElement>(null);
    const ai = settings.geminiApiKey ? new GoogleGenAI({ apiKey: settings.geminiApiKey }) : null;


    useEffect(() => {
        if (organization) {
            setFormData({
                name: organization.name || '',
                ogrn: organization.ogrn || '',
                inn: organization.inn || '',
                kpp: organization.kpp || '',
                address: organization.address || '',
                phone: organization.phone || '',
                sro: organization.sro || '',
            });
        }
    }, [organization]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };
    
    const handleOcrClick = () => {
        ocrInputRef.current?.click();
    };

    const handleImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !ai) return;

        setIsOcrLoading(true);
        setOcrError(null);

        try {
            const { mimeType, data: base64Data } = await imageFileToBase64(file);
            
            const prompt = `Извлеки из этого изображения информацию об организации и верни в формате JSON.
            Ключи JSON должны быть: "name", "ogrn", "inn", "kpp", "address", "phone", "sro".
            - name: Полное наименование организации.
            - ogrn: ОГРН.
            - inn: ИНН.
            - kpp: КПП (если есть).
            - address: Юридический/почтовый адрес.
            - phone: Контактный телефон/факс.
            - sro: Информация о членстве в СРО.
            Если какое-то поле не найдено, оставь для него пустую строку.`;

            const imagePart = { inlineData: { mimeType, data: base64Data } };
            const textPart = { text: prompt };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [imagePart, textPart] },
                config: { responseMimeType: "application/json" }
            });

            const result = JSON.parse(response.text);

            setFormData(prev => ({
                ...prev,
                name: result.name || prev.name,
                ogrn: result.ogrn || prev.ogrn,
                inn: result.inn || prev.inn,
                kpp: result.kpp || prev.kpp,
                address: result.address || prev.address,
                phone: result.phone || prev.phone,
                sro: result.sro || prev.sro,
            }));

        } catch (error) {
            console.error("OCR error:", error);
            setOcrError("Не удалось распознать данные. Попробуйте другое изображение.");
        } finally {
            setIsOcrLoading(false);
            if (event.target) event.target.value = '';
        }
    }


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Validation: Name, INN, OGRN, Address are required
        if (!formData.name.trim() || !formData.inn.trim() || !formData.ogrn.trim() || !formData.address.trim()) {
            alert("Пожалуйста, заполните обязательные поля: Наименование, ИНН, ОГРН, Адрес.");
            return;
        }

        onSave({
            id: organization?.id || crypto.randomUUID(),
            ...formData,
        });
        onClose();
    };

    const inputClass = "mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900";
    const labelClass = "block text-sm font-medium text-slate-700";

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             {ai && (
                <div>
                     <input type="file" ref={ocrInputRef} onChange={handleImageSelected} className="hidden" accept="image/*" />
                     <button type="button" onClick={handleOcrClick} disabled={isOcrLoading} className="w-full flex justify-center items-center gap-2 px-4 py-2 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" title={ai ? "Заполнить по фото документа" : "Введите API ключ в Настройках, чтобы включить эту функцию"}>
                        <CameraIcon /> {isOcrLoading ? "Анализ изображения..." : "✨ Заполнить по фото"}
                    </button>
                    {ocrError && <p className="text-red-500 text-sm mt-2 text-center">{ocrError}</p>}
                </div>
            )}
            <div>
                <label className={labelClass}>Наименование организации <span className="text-red-500">*</span></label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputClass} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>ИНН <span className="text-red-500">*</span></label>
                    <input type="text" name="inn" value={formData.inn} onChange={handleChange} className={inputClass} required />
                </div>
                <div>
                    <label className={labelClass}>ОГРН <span className="text-red-500">*</span></label>
                    <input type="text" name="ogrn" value={formData.ogrn} onChange={handleChange} className={inputClass} required />
                </div>
            </div>
            <div>
                <label className={labelClass}>КПП (если применимо)</label>
                <input type="text" name="kpp" value={formData.kpp} onChange={handleChange} className={inputClass} />
            </div>
            <div>
                <label className={labelClass}>Юридический/почтовый адрес <span className="text-red-500">*</span></label>
                <input type="text" name="address" value={formData.address} onChange={handleChange} className={inputClass} required />
            </div>
            <div>
                <label className={labelClass}>Телефон/факс</label>
                <input type="text" name="phone" value={formData.phone} onChange={handleChange} className={inputClass} />
            </div>
            <div>
                <label className={labelClass}>Информация о СРО</label>
                <input type="text" name="sro" value={formData.sro} onChange={handleChange} className={inputClass} placeholder="Например: СРО-С-280-20062017 Ассоциация 'СК ЛО'" />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">Отмена</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Сохранить</button>
            </div>
        </form>
    );
};

const OrganizationsPage: React.FC<OrganizationsPageProps> = ({ organizations, allOrganizations, constructionObjects, currentObjectId, settings, onSave, onDelete, onImport }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);

    const handleOpenModal = (org: Organization | null = null) => {
        setEditingOrg(org);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingOrg(null);
        setIsModalOpen(false);
    };

    const handleDelete = (id: string) => {
        onDelete(id);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 flex-shrink-0 gap-4">
                <h1 className="text-2xl font-bold text-slate-800">Организации</h1>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center bg-slate-100 text-slate-700 border border-slate-300 px-3 py-2 rounded-md hover:bg-slate-200 transition-colors"
                        title="Копировать из другого объекта"
                    >
                        <CopyIcon className="w-5 h-5 mr-1" /> Копировать
                    </button>
                    <button onClick={() => handleOpenModal()} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                        <PlusIcon /> Добавить организацию
                    </button>
                </div>
            </div>

            <div className="flex-grow overflow-auto border rounded-md">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Наименование и реквизиты</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Контактная информация</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {organizations.length > 0 ? organizations.map(org => (
                            <tr key={org.id} className="hover:bg-slate-50 allow-text-selection">
                                <td className="px-6 py-4 align-top">
                                    <div className="text-sm font-medium text-slate-900">{org.name}</div>
                                    <div className="text-sm text-slate-500">
                                        ИНН: {org.inn}, ОГРН: {org.ogrn}{org.kpp && `, КПП: ${org.kpp}`}
                                    </div>
                                </td>
                                <td className="px-6 py-4 align-top text-sm text-slate-600">
                                    <p className="whitespace-pre-wrap">{org.address}</p>
                                    {org.phone && <p className="text-xs text-slate-500 mt-1">Тел: {org.phone}</p>}
                                    {org.sro && <p className="text-xs text-slate-500 mt-1">СРО: {org.sro}</p>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium align-top">
                                    <div className="flex justify-end space-x-2">
                                        <button onClick={() => handleOpenModal(org)} className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full" title="Редактировать"><EditIcon /></button>
                                        <button onClick={() => handleDelete(org.id)} className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full" title="Удалить"><DeleteIcon /></button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={3} className="text-center py-10 text-slate-500">
                                    Пока нет ни одной организации.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingOrg ? 'Редактировать данные' : 'Новая организация'}>
                <OrganizationForm organization={editingOrg} settings={settings} onSave={onSave} onClose={handleCloseModal} />
            </Modal>

            <ObjectResourceImporter 
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Копирование организаций"
                constructionObjects={constructionObjects}
                currentObjectId={currentObjectId}
                allItems={allOrganizations}
                existingItems={organizations}
                isDuplicate={(item, existing) => existing.some(e => e.inn === item.inn || e.ogrn === item.ogrn)}
                onImport={onImport}
                renderItem={(item) => (
                    <div>
                        <div className="font-semibold text-sm text-slate-800">{item.name}</div>
                        <div className="text-xs text-slate-500">ИНН: {item.inn} | ОГРН: {item.ogrn}</div>
                    </div>
                )}
            />
        </div>
    );
};

export default OrganizationsPage;
