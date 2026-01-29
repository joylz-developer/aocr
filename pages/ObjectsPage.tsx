
import React, { useState, useMemo } from 'react';
import { ConstructionObject } from '../types';
import { PlusIcon, EditIcon, CheckIcon, CloseIcon, ChevronLeftIcon, TrashIcon, CopyIcon } from '../components/Icons';
import ConfirmationModal from '../components/ConfirmationModal';

interface ObjectsPageProps {
    constructionObjects: ConstructionObject[];
    currentObjectId: string | null;
    onObjectChange: (id: string) => void;
    onAddObject: (name: string, shortName: string, cloneFromId?: string, cloneCategories?: string[]) => void;
    onUpdateObject: (id: string, name: string, shortName: string) => void;
    onDeleteObject: (id: string) => void;
    onCloneObject: (id: string) => void;
}

const ObjectsPage: React.FC<ObjectsPageProps> = ({ 
    constructionObjects, 
    currentObjectId, 
    onObjectChange, 
    onAddObject, 
    onUpdateObject,
    onDeleteObject,
    onCloneObject
}) => {
    const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Form State
    const [formData, setFormData] = useState({ id: '', name: '', shortName: '' });
    
    // Delete Confirmation
    const [objectToDelete, setObjectToDelete] = useState<ConstructionObject | null>(null);
    
    // Clone State
    const [cloneFromId, setCloneFromId] = useState<string>('');
    const [cloneCategories, setCloneCategories] = useState<{ [key: string]: boolean }>({
        people: true,
        organizations: true,
        groups: true,
        certificates: false,
        regulations: true
    });

    const filteredObjects = useMemo(() => {
        if (!searchQuery) return constructionObjects;
        const lowerQ = searchQuery.toLowerCase();
        return constructionObjects.filter(o => 
            o.name.toLowerCase().includes(lowerQ) || 
            (o.shortName && o.shortName.toLowerCase().includes(lowerQ))
        );
    }, [constructionObjects, searchQuery]);

    const handleStartCreate = () => {
        setFormData({ id: '', name: '', shortName: '' });
        setCloneFromId('');
        setView('create');
    };

    const handleStartEdit = (obj: ConstructionObject) => {
        setFormData({ id: obj.id, name: obj.name, shortName: obj.shortName || '' });
        setView('edit');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.name.trim()) return;

        if (view === 'create') {
            const categoriesToCopy = cloneFromId 
                ? Object.keys(cloneCategories).filter(k => cloneCategories[k]) 
                : undefined;
            onAddObject(formData.name.trim(), formData.shortName.trim(), cloneFromId || undefined, categoriesToCopy);
        } else {
            onUpdateObject(formData.id, formData.name.trim(), formData.shortName.trim());
        }
        setView('list');
    };
    
    const confirmDelete = () => {
        if (objectToDelete) {
            onDeleteObject(objectToDelete.id);
            setObjectToDelete(null);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
            {view === 'list' ? (
                <>
                    <div className="flex justify-between items-center mb-6 flex-shrink-0">
                        <h1 className="text-2xl font-bold text-slate-800">Объекты строительства</h1>
                        <button 
                            onClick={handleStartCreate}
                            className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
                        >
                            <PlusIcon className="w-5 h-5" /> Создать новый
                        </button>
                    </div>

                    <div className="mb-4">
                        <input 
                            type="text" 
                            placeholder="Поиск объекта..." 
                            className="w-full border border-slate-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex-grow overflow-y-auto border border-slate-200 rounded-md bg-slate-50 divide-y divide-slate-100">
                        {filteredObjects.length > 0 ? (
                            filteredObjects.map(obj => (
                                <div 
                                    key={obj.id} 
                                    className={`flex items-center justify-between p-4 hover:bg-white transition-colors group ${currentObjectId === obj.id ? 'bg-blue-50 hover:bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
                                >
                                    <div className="flex-grow min-w-0 pr-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`font-bold text-lg ${currentObjectId === obj.id ? 'text-blue-800' : 'text-slate-800'}`}>
                                                {obj.shortName || obj.name}
                                            </span>
                                            {currentObjectId === obj.id && (
                                                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-blue-200">
                                                    Текущий
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-slate-600 truncate" title={obj.name}>
                                            {obj.name}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {currentObjectId !== obj.id && (
                                            <button 
                                                onClick={() => onObjectChange(obj.id)}
                                                className="px-3 py-1.5 text-sm bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                            >
                                                Выбрать
                                            </button>
                                        )}
                                        
                                        <div className="h-6 w-px bg-slate-200 mx-1"></div>
                                        
                                        <button 
                                            onClick={() => onCloneObject(obj.id)}
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
                                            title="Клонировать объект"
                                        >
                                            <CopyIcon className="w-5 h-5" />
                                        </button>
                                        
                                        <button 
                                            onClick={() => handleStartEdit(obj)}
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
                                            title="Редактировать название"
                                        >
                                            <EditIcon className="w-5 h-5" />
                                        </button>
                                        
                                        <button 
                                            onClick={() => setObjectToDelete(obj)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Удалить объект"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-10 text-center text-slate-500">
                                Объекты не найдены
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <form onSubmit={handleSubmit} className="flex flex-col h-full max-w-3xl mx-auto w-full">
                    <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
                        <button type="button" onClick={() => setView('list')} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                            <ChevronLeftIcon className="w-6 h-6" />
                        </button>
                        <h2 className="text-xl font-bold text-slate-800">
                            {view === 'create' ? 'Создание нового объекта' : 'Редактирование объекта'}
                        </h2>
                    </div>

                    <div className="space-y-6 flex-grow">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Полное наименование <span className="text-red-500">*</span>
                            </label>
                            <input 
                                type="text" 
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Например: Многоквартирный жилой дом поз. 5 по ул. Ленина..."
                                required
                                autoFocus
                            />
                            <p className="text-xs text-slate-500 mt-1">Используется в генерируемых документах.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Краткое наименование
                            </label>
                            <input 
                                type="text" 
                                value={formData.shortName}
                                onChange={(e) => setFormData({...formData, shortName: e.target.value})}
                                className="w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Например: Жилой дом поз. 5"
                            />
                            <p className="text-xs text-slate-500 mt-1">Используется в интерфейсе приложения (сайдбар, списки).</p>
                        </div>

                        {view === 'create' && (
                            <div className="border border-slate-200 rounded-md p-4 bg-slate-50">
                                <label className="block text-sm font-medium text-slate-800 mb-2">Копировать данные из другого объекта</label>
                                <select 
                                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white mb-3"
                                    value={cloneFromId}
                                    onChange={(e) => setCloneFromId(e.target.value)}
                                >
                                    <option value="">-- Не копировать (пустой объект) --</option>
                                    {constructionObjects.map(obj => (
                                        <option key={obj.id} value={obj.id}>{obj.shortName || obj.name}</option>
                                    ))}
                                </select>

                                {cloneFromId && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 font-medium mb-1">Что скопировать:</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.keys(cloneCategories).map(key => (
                                                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                                    <input 
                                                        type="checkbox" 
                                                        className="form-checkbox-custom h-4 w-4" 
                                                        checked={cloneCategories[key]} 
                                                        onChange={e => setCloneCategories(p => ({...p, [key]: e.target.checked}))} 
                                                    />
                                                    {key === 'people' ? 'Участники' : 
                                                     key === 'organizations' ? 'Организации' :
                                                     key === 'groups' ? 'Группы комиссий' :
                                                     key === 'regulations' ? 'Нормативы' : 'Сертификаты'}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <button 
                            type="button" 
                            onClick={() => setView('list')} 
                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 font-medium"
                        >
                            Отмена
                        </button>
                        <button 
                            type="submit" 
                            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium flex items-center gap-2"
                        >
                            <CheckIcon className="w-4 h-4" />
                            {view === 'create' ? 'Создать объект' : 'Сохранить изменения'}
                        </button>
                    </div>
                </form>
            )}
            
            <ConfirmationModal 
                isOpen={!!objectToDelete} 
                onClose={() => setObjectToDelete(null)} 
                onConfirm={confirmDelete}
                title="Удаление объекта"
                confirmText="Удалить навсегда"
            >
                <div className="space-y-3">
                    <p>
                        Вы собираетесь удалить объект <strong>{objectToDelete?.name}</strong>.
                    </p>
                    <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-800">
                        <strong>Внимание!</strong> Все связанные данные будут безвозвратно удалены:
                        <ul className="list-disc pl-5 mt-1 opacity-80">
                            <li>Акты скрытых работ</li>
                            <li>Участники и Организации этого объекта</li>
                            <li>Группы комиссий</li>
                            <li>Сертификаты и Нормативы, созданные в этом объекте</li>
                        </ul>
                    </div>
                    <p>Это действие нельзя отменить.</p>
                </div>
            </ConfirmationModal>
        </div>
    );
};

export default ObjectsPage;
