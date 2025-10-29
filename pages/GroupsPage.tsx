import React, { useState, useMemo } from 'react';
import { CommissionGroup, Person, ROLES } from '../types';
import Modal from '../components/Modal';
import { PlusIcon, EditIcon, DeleteIcon } from '../components/Icons';

interface GroupsPageProps {
    groups: CommissionGroup[];
    people: Person[];
    onSave: (group: CommissionGroup) => void;
    onDelete: (id: string) => void;
}

const GroupForm: React.FC<{
    group: CommissionGroup | null;
    people: Person[];
    onSave: (group: CommissionGroup) => void;
    onClose: () => void;
}> = ({ group, people, onSave, onClose }) => {
    const [formData, setFormData] = useState<CommissionGroup>(
        group || { id: crypto.randomUUID(), name: '', representatives: {} }
    );

    const [showOtherReps, setShowOtherReps] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleRepChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            representatives: { ...prev.representatives, [name]: value }
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    const inputClass = "mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900";
    const selectClass = inputClass;
    const labelClass = "block text-sm font-medium text-slate-700";

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div>
                <label htmlFor="name" className={labelClass}>Название группы</label>
                <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Например, 'Рабочая комиссия'"
                    required
                />
            </div>
            <div className="border border-slate-200 rounded-md p-4">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Состав комиссии</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(ROLES).filter(([key]) => !['i1','i2','i3'].includes(key)).map(([key, description]) => (
                        <div key={key}>
                            <label className={labelClass}>{description}</label>
                            <select name={key} value={formData.representatives[key] || ''} onChange={handleRepChange} className={selectClass}>
                                <option value="">Не выбрано</option>
                                {people.map(p => <option key={p.id} value={p.id}>{p.name}, {p.position}</option>)}
                            </select>
                        </div>
                    ))}
                    <div className="md:col-span-2 border-t pt-4 mt-2">
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="showOtherReps"
                                checked={showOtherReps}
                                onChange={(e) => setShowOtherReps(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="showOtherReps" className="ml-2 text-sm font-medium text-slate-700">
                                Добавить представителей иных организаций
                            </label>
                        </div>
                    </div>
                    {showOtherReps && Object.entries(ROLES).filter(([key]) => ['i1','i2','i3'].includes(key)).map(([key, description]) => (
                        <div key={key}>
                            <label className={labelClass}>{description}</label>
                            <select name={key} value={formData.representatives[key] || ''} onChange={handleRepChange} className={selectClass}>
                                <option value="">Не выбрано</option>
                                {people.map(p => <option key={p.id} value={p.id}>{p.name}, {p.position}</option>)}
                            </select>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">Отмена</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Сохранить</button>
            </div>
        </form>
    );
};

const GroupsPage: React.FC<GroupsPageProps> = ({ groups, people, onSave, onDelete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<CommissionGroup | null>(null);

    const peopleMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

    const handleOpenModal = (group: CommissionGroup | null = null) => {
        setEditingGroup(group);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingGroup(null);
        setIsModalOpen(false);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Группы комиссий</h1>
                <button onClick={() => handleOpenModal()} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    <PlusIcon /> Создать группу
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Название группы</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Состав</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {groups.length > 0 ? groups.map(group => (
                            <tr key={group.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 align-top">{group.name}</td>
                                <td className="px-6 py-4 text-sm text-slate-600 align-top">
                                    <ul className="list-disc pl-5 space-y-1">
                                        {Object.entries(group.representatives)
                                            .filter(([, personId]) => personId && peopleMap.has(personId))
                                            .map(([role, personId]) => (
                                            <li key={role}>
                                                <span className="font-medium">{ROLES[role]}:</span> {peopleMap.get(personId)?.name}
                                            </li>
                                        ))}
                                    </ul>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium align-top">
                                    <div className="flex justify-end space-x-2">
                                        <button onClick={() => handleOpenModal(group)} className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full" title="Редактировать"><EditIcon /></button>
                                        <button onClick={() => onDelete(group.id)} className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full" title="Удалить"><DeleteIcon /></button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={3} className="text-center py-10 text-slate-500">
                                    Пока нет ни одной группы.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingGroup ? 'Редактировать группу' : 'Новая группа'}>
                <GroupForm
                    group={editingGroup}
                    people={people}
                    onSave={onSave}
                    onClose={handleCloseModal}
                />
            </Modal>
        </div>
    );
};

export default GroupsPage;
