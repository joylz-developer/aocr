import React, { useState, useMemo } from 'react';
import { ExecutiveScheme, Act } from '../types';
import Modal from '../components/Modal';
import { PlusIcon, DeleteIcon, SchemeIcon, LinkIcon } from '../components/Icons';

interface SchemesPageProps {
    schemes: ExecutiveScheme[];
    acts: Act[];
    onSave: (scheme: ExecutiveScheme) => void;
    onDelete: (id: string) => void;
}

const SchemesPage: React.FC<SchemesPageProps> = ({ schemes, acts, onSave, onDelete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingScheme, setEditingScheme] = useState<ExecutiveScheme | null>(null);
    const [formData, setFormData] = useState({ name: '', number: '', amount: '1' });

    const openModal = (scheme?: ExecutiveScheme) => {
        if (scheme) {
            setEditingScheme(scheme);
            setFormData({ name: scheme.name, number: scheme.number, amount: scheme.amount || '1' });
        } else {
            setEditingScheme(null);
            setFormData({ name: '', number: '', amount: '1' });
        }
        setIsModalOpen(true);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: editingScheme ? editingScheme.id : crypto.randomUUID(),
            name: formData.name.trim(),
            number: formData.number.trim(),
            amount: formData.amount.trim(),
        });
        setIsModalOpen(false);
    };

    // Определяем, в каких актах используется каждая схема
    const usageMap = useMemo(() => {
        const map = new Map<string, string[]>();
        schemes.forEach(s => {
            const usedIn: string[] = [];
            acts.forEach(act => {
                if (act.certs && (act.certs.includes(s.number) || act.certs.includes(s.name))) {
                    usedIn.push(act.number || 'б/н');
                }
            });
            map.set(s.id, usedIn);
        });
        return map;
    }, [schemes, acts]);

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Исполнительные схемы</h1>
                <button 
                    onClick={() => openModal()} 
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                >
                    <PlusIcon /> Добавить схему
                </button>
            </div>

            <div className="flex-grow overflow-auto pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {schemes.map(scheme => {
                        const usedInActs = usageMap.get(scheme.id) || [];
                        return (
                            <div key={scheme.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white flex flex-col h-full">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                            <SchemeIcon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-sm" title="Номер схемы">№ {scheme.number}</h3>
                                            <span className="text-xs text-slate-500">Листов: {scheme.amount}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => openModal(scheme)} 
                                            className="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 p-1.5 rounded transition-colors text-xs font-medium"
                                        >
                                            Изм.
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if (window.confirm('Вы уверены, что хотите удалить эту схему?')) {
                                                    onDelete(scheme.id);
                                                }
                                            }} 
                                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                                            title="Удалить"
                                        >
                                            <DeleteIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-700 mb-4 flex-grow font-medium line-clamp-3" title={scheme.name}>
                                    {scheme.name}
                                </p>
                                
                                <div className="mt-auto pt-3 border-t border-slate-100">
                                    {usedInActs.length > 0 ? (
                                        <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded">
                                            <LinkIcon className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                                            <span className="leading-relaxed">
                                                В актах: <span className="font-semibold text-slate-700">{usedInActs.join(', ')}</span>
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-400 italic flex items-center gap-1">
                                            Не используется в актах
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {schemes.length === 0 && (
                        <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                            <SchemeIcon className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg font-medium text-slate-500">Список исполнительных схем пуст</p>
                            <p className="text-sm mt-1">Добавьте первую схему, чтобы использовать её в актах АОСР.</p>
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingScheme ? "Редактировать схему" : "Новая исполнительная схема"}>
                <form onSubmit={handleSave} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Наименование схемы <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            required 
                            value={formData.name} 
                            onChange={e => setFormData({...formData, name: e.target.value})} 
                            className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" 
                            placeholder="Например: Исполнительная схема планово-высотного положения..." 
                        />
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Номер схемы <span className="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                required 
                                value={formData.number} 
                                onChange={e => setFormData({...formData, number: e.target.value})} 
                                className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" 
                                placeholder="Например: 12-ИС"
                            />
                        </div>
                        <div className="w-1/3">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Кол-во листов</label>
                            <input 
                                type="number" 
                                min="1" 
                                value={formData.amount} 
                                onChange={e => setFormData({...formData, amount: e.target.value})} 
                                className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" 
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors font-medium">Отмена</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors font-medium">Сохранить</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default SchemesPage;