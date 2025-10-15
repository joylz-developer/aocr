import React, { useState, useRef } from 'react';
import { Person, Organization } from '../types';
import Modal from '../components/Modal';
import { PlusIcon, EditIcon, DeleteIcon } from '../components/Icons';
import { GoogleGenAI } from '@google/genai';

interface PeoplePageProps {
    people: Person[];
    organizations: Organization[];
    onSave: (person: Person) => void;
    onDelete: (id: string) => void;
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
    onSave: (person: Person) => void,
    onClose: () => void
}> = ({ person, organizations, onSave, onClose }) => {
    const [formData, setFormData] = useState<Person>(
        person || { id: crypto.randomUUID(), name: '', position: '', organization: '', authDoc: '' }
    );
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [ocrError, setOcrError] = useState<string | null>(null);
    const [ocrWarning, setOcrWarning] = useState<string | null>(null);
    const ocrInputRef = useRef<HTMLInputElement>(null);
    const ai = process.env.API_KEY ? new GoogleGenAI({ apiKey: process.env.API_KEY }) : null;

    // Helper function for more robust string comparison
    const normalizeOrgName = (name: string): string => {
        if (!name) return '';
        return name
            .trim()
            .toLowerCase()
            // Replace various quote types and punctuation
            .replace(/["«»`“”'.,]/g, '')
            // Remove common legal entity abbreviations
            .replace(/\b(ооо|зао|пао|ао|ип)\b/g, '')
            // Collapse multiple spaces into a single space
            .replace(/\s+/g, ' ')
            .trim();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
        setOcrWarning(null);

        try {
            const { mimeType, data: base64Data } = await imageFileToBase64(file);

            const prompt = `Проанализируй изображение и извлеки информацию о человеке. Верни результат в формате JSON со следующими ключами: "name", "position", "organization", "authDoc".
            - "name": Полное имя (ФИО).
            - "position": Должность.
            - "organization": Название организации.
            - "authDoc": Реквизиты документа, подтверждающего полномочия (например, "Приказ №123 от 01.01.2024").
            Если какое-то поле не найдено, оставь для него пустую строку.`;

            const imagePart = { inlineData: { mimeType, data: base64Data } };
            const textPart = { text: prompt };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [imagePart, textPart] },
                config: { responseMimeType: "application/json" }
            });

            const result = JSON.parse(response.text);

            setFormData(prev => {
                const aiOrgName = result.organization;
                let organizationToSet = prev.organization; // Default to previous value

                if (aiOrgName) {
                    const normalizedAiOrgName = normalizeOrgName(aiOrgName);
                    if (normalizedAiOrgName) { // Ensure we don't match on empty strings
                        const matchingOrg = organizations.find(org => normalizeOrgName(org.name) === normalizedAiOrgName);
                        if (matchingOrg) {
                            organizationToSet = matchingOrg.name; // Set the exact name from the list
                        } else {
                            // Not found, show a warning and don't change the selection
                            setOcrWarning(`Организация "${aiOrgName}" не найдена. Пожалуйста, добавьте ее на странице 'Организации', а затем выберите из списка.`);
                        }
                    }
                }

                return {
                    ...prev,
                    name: result.name || prev.name,
                    position: result.position || prev.position,
                    organization: organizationToSet,
                    authDoc: result.authDoc || prev.authDoc,
                };
            });

        } catch (error) {
            console.error("OCR error:", error);
            setOcrError("Не удалось распознать данные. Попробуйте другое изображение.");
        } finally {
            setIsOcrLoading(false);
            if (event.target) event.target.value = '';
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    const inputClass = "mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900";
    const selectClass = inputClass;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {ai && (
                <div>
                     <input type="file" ref={ocrInputRef} onChange={handleImageSelected} className="hidden" accept="image/*" />
                     <button type="button" onClick={handleOcrClick} disabled={isOcrLoading} className="w-full flex justify-center items-center gap-2 px-4 py-2 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                        <CameraIcon /> {isOcrLoading ? "Анализ изображения..." : "✨ Заполнить по фото"}
                    </button>
                    {ocrError && <p className="text-red-500 text-sm mt-2 text-center">{ocrError}</p>}
                    {ocrWarning && <p className="text-amber-700 bg-amber-50 border border-amber-200 text-sm mt-2 text-center p-2 rounded-md">{ocrWarning}</p>}
                </div>
            )}
            <div>
                <label className="block text-sm font-medium text-slate-700">ФИО</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputClass} required />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700">Должность</label>
                <input type="text" name="position" value={formData.position} onChange={handleChange} className={inputClass} required />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700">Организация</label>
                <select name="organization" value={formData.organization} onChange={handleChange} className={selectClass} required>
                    <option value="">-- Выберите организацию --</option>
                    {organizations.map(org => (
                        <option key={org.id} value={org.name}>{org.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700">Реквизиты документа о полномочиях</label>
                <input type="text" name="authDoc" value={formData.authDoc} onChange={handleChange} className={inputClass} placeholder="Например: Приказ №123 от 01.01.2024" />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">Отмена</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Сохранить</button>
            </div>
        </form>
    );
};

const PeoplePage: React.FC<PeoplePageProps> = ({ people, organizations, onSave, onDelete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
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
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Участники</h1>
                <button onClick={() => handleOpenModal()} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    <PlusIcon /> Добавить человека
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ФИО</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Должность</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Организация</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {people.length > 0 ? people.map(person => (
                            <tr key={person.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{person.name}</td>
                                <td className="px-6 py-4 text-sm text-slate-600 max-w-sm whitespace-normal">{person.position}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{person.organization}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end space-x-2">
                                        <button onClick={() => handleOpenModal(person)} className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full" title="Редактировать"><EditIcon /></button>
                                        <button onClick={() => handleDelete(person.id)} className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full" title="Удалить"><DeleteIcon /></button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="text-center py-10 text-slate-500">
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
                    onSave={onSave}
                    onClose={handleCloseModal}
                />
            </Modal>
        </div>
    );
};

export default PeoplePage;