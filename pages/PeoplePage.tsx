import React, { useState, useRef, useMemo } from 'react';
import { Person, Organization, ProjectSettings, ConstructionObject } from '../types';
import Modal from '../components/Modal';
import CustomSelect from '../components/CustomSelect';
import { PlusIcon, EditIcon, DeleteIcon, CopyIcon } from '../components/Icons';
import { generateContent } from '../services/aiService';
import ObjectResourceImporter from '../components/ObjectResourceImporter';

interface PeoplePageProps {
    people: Person[]; // Current object's people
    allPeople: Person[]; // All people for copying
    organizations: Organization[]; // Current object's orgs
    constructionObjects: ConstructionObject[];
    currentObjectId: string | null;
    settings: ProjectSettings;
    onSave: (person: Person) => void;
    onDelete: (id: string) => void;
    onImport: (items: Person[]) => void;
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

const PersonForm: React.FC<{
    person: Person | null,
    organizations: Organization[],
    settings: ProjectSettings;
    onSave: (person: Person) => void,
    onClose: () => void
}> = ({ person, organizations, settings, onSave, onClose }) => {
    const [formData, setFormData] = useState<Person>(
        person || { id: crypto.randomUUID(), name: '', position: '', organization: '', authDoc: '', nrs: '' }
    );
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [ocrError, setOcrError] = useState<string | null>(null);
    const [ocrWarning, setOcrWarning] = useState<string | null>(null);
    const ocrInputRef = useRef<HTMLInputElement>(null);
    const isAiConfigured = settings.activeAiModelId 
        ? !!settings.aiModels?.find(m => m.id === settings.activeAiModelId)?.apiKey
        : (settings.aiModel === 'gemini-2.5-flash' ? !!settings.geminiApiKey : !!settings.openAiApiKey);

    const orgOptions = useMemo(() => {
        return organizations.map(org => ({
            value: org.name,
            label: org.name
        }));
    }, [organizations]);

    const normalizeOrgName = (name: string): string => {
        if (!name) return '';
        return name
            .trim()
            .toLowerCase()
            .replace(/["«»`“”'.,]/g, '')
            .replace(/\b(ооо|зао|пао|ао|ип)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleOcrClick = () => {
        ocrInputRef.current?.click();
    };

    const handleImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !isAiConfigured) return;

        setIsOcrLoading(true);
        setOcrError(null);
        setOcrWarning(null);

        try {
            const { mimeType, data: base64Data } = await imageFileToBase64(file);

            const prompt = settings.personExtractionPrompt || `
Analyze the provided document image. This is a personal identification document or certificate.
Extract the following information into a valid JSON object using STRICTLY these keys:
1. "name": The full name of the person (ФИО).
2. "position": The job title or position (if available).
3. "organization": The name of the organization (if available).
4. "authDoc": The document details confirming authority (e.g., "Order No. 123 from 01.01.2024").
5. "nrs": The National Register of Specialists (НРС) identification number (e.g., "НОСТРОЙ № 123456" or "НОПРИЗ № 123456", "П-123456").

If a field is not found, use an empty string.
Return ONLY the JSON object. Do not include markdown formatting.
            `.trim();

            const response = await generateContent(settings, prompt, mimeType, base64Data, true);

            const text = response.text;
            const jsonStartIndex = text.indexOf('{');
            const jsonEndIndex = text.lastIndexOf('}');
            if (jsonStartIndex === -1 || jsonEndIndex === -1) throw new Error("JSON structure not found in response");
            const jsonString = text.substring(jsonStartIndex, jsonEndIndex + 1);
            const result = JSON.parse(jsonString);

            setFormData(prev => {
                const aiOrgName = result.organization;
                let organizationToSet = prev.organization; 

                if (aiOrgName) {
                    const normalizedAiOrgName = normalizeOrgName(aiOrgName);
                    if (normalizedAiOrgName) { 
                        const matchingOrg = organizations.find(org => normalizeOrgName(org.name) === normalizedAiOrgName);
                        if (matchingOrg) {
                            organizationToSet = matchingOrg.name; 
                        } else {
                            organizationToSet = aiOrgName;
                            setOcrWarning(`Организация "${aiOrgName}" не найдена в текущем списке. Она будет сохранена текстом.`);
                        }
                    }
                }

                return {
                    ...prev,
                    name: result.name || prev.name,
                    position: result.position || prev.position,
                    organization: organizationToSet,
                    authDoc: result.authDoc || prev.authDoc,
                    nrs: result.nrs || prev.nrs, 
                };
            });

        } catch (error: any) {
            console.error("OCR error:", error);
            setOcrError(`Ошибка распознавания: ${error.message || "Неизвестная ошибка"}`);
        } finally {
            setIsOcrLoading(false);
            if (event.target) event.target.value = '';
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.position.trim()) {
            alert('Пожалуйста, заполните обязательные поля: ФИО и Должность.');
            return;
        }
        onSave(formData);
        onClose();
    };

    const inputClass = "mt-1 block w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100";
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {isAiConfigured && (
                <div>
                     <input type="file" ref={ocrInputRef} onChange={handleImageSelected} className="hidden" accept="image/*" />
                     <button type="button" onClick={handleOcrClick} disabled={isOcrLoading} className="w-full flex justify-center items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" title={isAiConfigured ? "Заполнить по фото документа" : "Настройте AI в Настройках, чтобы включить эту функцию"}>
                        <CameraIcon /> {isOcrLoading ? "Анализ изображения..." : "✨ Заполнить по фото"}
                    </button>
                    {ocrError && <p className="text-red-500 dark:text-red-400 text-sm mt-2 text-center select-text cursor-text">{ocrError}</p>}
                    {ocrWarning && <p className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-sm mt-2 text-center p-2 rounded-md select-text cursor-text">{ocrWarning}</p>}
                </div>
            )}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">ФИО <span className="text-red-500 dark:text-red-400">*</span></label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputClass} required />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Должность <span className="text-red-500 dark:text-red-400">*</span></label>
                <input type="text" name="position" value={formData.position} onChange={handleChange} className={inputClass} required />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Организация</label>
                 <CustomSelect
                    options={orgOptions}
                    value={formData.organization}
                    onChange={(value) => setFormData(prev => ({ ...prev, organization: value }))}
                    placeholder="-- Выберите или введите --"
                    className="mt-1"
                    allowClear
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Не обязательно</p>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Реквизиты документа о полномочиях</label>
                <input type="text" name="authDoc" value={formData.authDoc || ''} onChange={handleChange} className={inputClass} placeholder="Например: Приказ №123 от 01.01.2024" />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Номер НРС</label>
                <input type="text" name="nrs" value={formData.nrs || ''} onChange={handleChange} className={inputClass} placeholder="Например: НОСТРОЙ № 123456" />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onClose} className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-2 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600">Отмена</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Сохранить</button>
            </div>
        </form>
    );
};

const PeoplePage: React.FC<PeoplePageProps> = ({ people, allPeople, organizations, constructionObjects, currentObjectId, settings, onSave, onDelete, onImport }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingPerson, setEditingPerson] = useState<Person | null>(null);

    const handleOpenModal = (person: Person | null = null) => {
        setEditingPerson(person);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingPerson(null);
        setIsModalOpen(false);
    };

    const handleDelete = (id: string) => {
        onDelete(id);
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 flex-shrink-0 gap-4">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Участники</h1>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        title="Копировать из другого объекта"
                    >
                        <CopyIcon className="w-5 h-5 mr-1" /> Копировать
                    </button>
                    <button onClick={() => handleOpenModal()} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                        <PlusIcon /> Добавить человека
                    </button>
                </div>
            </div>

            <div className="flex-grow overflow-auto border border-slate-200 dark:border-slate-700 rounded-md">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">ФИО</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Должность</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Организация</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">НРС</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {people.length > 0 ? people.map(person => (
                            <tr key={person.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100 select-text cursor-text">{person.name}</td>
                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 max-w-sm whitespace-normal select-text cursor-text">{person.position}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 select-text cursor-text">{person.organization || <span className="text-slate-300 dark:text-slate-500 italic">Не указана</span>}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 select-text cursor-text">{person.nrs || <span className="text-slate-300 dark:text-slate-500 italic">-</span>}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end space-x-2">
                                        <button onClick={() => handleOpenModal(person)} className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-slate-700 rounded-full" title="Редактировать"><EditIcon /></button>
                                        <button onClick={() => handleDelete(person.id)} className="p-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-slate-700 rounded-full" title="Удалить"><DeleteIcon /></button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="text-center py-10 text-slate-500 dark:text-slate-400">
                                    Пока нет ни одного участника.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingPerson ? 'Редактировать данные' : 'Новый участник'}>
                <PersonForm
                    person={editingPerson}
                    organizations={organizations}
                    settings={settings}
                    onSave={onSave}
                    onClose={handleCloseModal}
                />
            </Modal>

            <ObjectResourceImporter 
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Копирование участников"
                constructionObjects={constructionObjects}
                currentObjectId={currentObjectId}
                allItems={allPeople}
                existingItems={people}
                isDuplicate={(item, existing) => existing.some(e => e.name === item.name && e.position === item.position)}
                onImport={onImport}
                // Именно здесь текст становился нечитаемым в модалке (text-slate-800 добавлен dark:text-slate-200)
                renderItem={(item) => (
                    <div>
                        <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{item.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{item.position} {item.organization && `(${item.organization})`}</div>
                    </div>
                )}
            />
        </div>
    );
};

export default PeoplePage;