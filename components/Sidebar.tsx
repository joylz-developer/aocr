
import React, { useState, useMemo } from 'react';
import { Page, Theme, ConstructionObject } from '../types';
import { ChevronLeftIcon, ActsIcon, PeopleIcon, OrganizationsIcon, SettingsIcon, GroupsIcon, TrashIcon, BookIcon, CertificateIcon, SunIcon, MoonIcon, EyeIcon, PlusIcon, EditIcon, CheckIcon, CloseIcon, ChevronDownIcon, SearchIcon } from './Icons'; // Assuming SearchIcon exists or we use text
import Modal from './Modal';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    currentPage: Page;
    setCurrentPage: (page: Page) => void;
    isTemplateLoaded: boolean;
    trashCount: number;
    theme: Theme;
    onToggleTheme: () => void;
    
    // Objects Props
    constructionObjects: ConstructionObject[];
    currentObjectId: string | null;
    onObjectChange: (id: string) => void;
    onAddObject: (name: string, cloneFromId?: string, cloneCategories?: string[]) => void;
    onUpdateObject: (id: string, name: string) => void;
}

const SidebarButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    badge?: number;
    isActive?: boolean;
    isOpen: boolean;
    disabled?: boolean;
    onClick?: () => void;
    title?: string;
    className?: string;
}> = ({ icon, label, badge, isActive = false, isOpen, disabled = false, title, className, ...props }) => {
    const baseClasses = "flex items-center w-full text-left rounded-md transition-colors duration-200 relative";
    const sizeClasses = isOpen ? "px-4 py-2.5" : "p-3 justify-center";
    const stateClasses = disabled
        ? "text-slate-400 cursor-not-allowed"
        : isActive
            ? "bg-blue-600 text-white"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900";

    return (
        <button
            className={`${baseClasses} ${sizeClasses} ${stateClasses} ${className || ''}`}
            disabled={disabled}
            title={isOpen ? undefined : title || label}
            {...props}
        >
            <div className="flex-shrink-0">{icon}</div>
            {isOpen && <span className="ml-4 text-sm font-medium whitespace-nowrap">{label}</span>}
             {badge !== undefined && badge > 0 && (
                <span className={`absolute top-1 text-white text-xs font-bold rounded-full h-5 min-w-[1.25rem] flex items-center justify-center px-1 ${isOpen ? 'right-2' : 'right-1'} ${isActive ? 'bg-blue-500' : 'bg-red-500'}`}>
                    {badge}
                </span>
            )}
        </button>
    );
};

const Sidebar: React.FC<SidebarProps> = ({ 
    isOpen, setIsOpen, currentPage, setCurrentPage, isTemplateLoaded, trashCount, theme, onToggleTheme,
    constructionObjects, currentObjectId, onObjectChange, onAddObject, onUpdateObject
}) => {
    // Manager State
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const [managerView, setManagerView] = useState<'list' | 'create'>('list');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Creation State
    const [newObjectName, setNewObjectName] = useState('');
    const [cloneFromId, setCloneFromId] = useState<string>('');
    const [cloneCategories, setCloneCategories] = useState<{ [key: string]: boolean }>({
        people: true,
        organizations: true,
        groups: true,
        certificates: false,
        regulations: true
    });
    
    // Inline Edit State (in Manager)
    const [editingObjId, setEditingObjId] = useState<string | null>(null);
    const [editNameValue, setEditNameValue] = useState('');
    
    const currentObject = constructionObjects.find(o => o.id === currentObjectId);
    
    // Filtered objects for list
    const filteredObjects = useMemo(() => {
        if (!searchQuery) return constructionObjects;
        return constructionObjects.filter(o => o.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [constructionObjects, searchQuery]);

    // Order: Acts -> People -> Organizations -> Groups ...
    const navItems = [
        { page: 'acts', label: 'АОСР', icon: <ActsIcon className="w-5 h-5" /> },
        { page: 'people', label: 'Участники', icon: <PeopleIcon className="w-5 h-5" /> },
        { page: 'organizations', label: 'Организации', icon: <OrganizationsIcon className="w-5 h-5" /> },
        { page: 'groups', label: 'Группы комиссий', icon: <GroupsIcon className="w-5 h-5" /> },
        { page: 'certificates', label: 'Сертификаты', icon: <CertificateIcon className="w-5 h-5" /> },
        { page: 'regulations', label: 'Нормативы', icon: <BookIcon className="w-5 h-5" /> },
    ];

    const getThemeIcon = () => {
        switch (theme) {
            case 'dark': return <MoonIcon className="w-5 h-5" />;
            case 'eye-protection': return <EyeIcon className="w-5 h-5" />;
            default: return <SunIcon className="w-5 h-5" />;
        }
    };

    const getThemeLabel = () => {
        switch (theme) {
            case 'dark': return 'Темная тема';
            case 'eye-protection': return 'Защита глаз';
            default: return 'Светлая тема';
        }
    };
    
    const handleCreateObject = (e: React.FormEvent) => {
        e.preventDefault();
        if (newObjectName.trim()) {
            const categoriesToCopy = cloneFromId 
                ? Object.keys(cloneCategories).filter(k => cloneCategories[k]) 
                : undefined;
            
            onAddObject(newObjectName.trim(), cloneFromId || undefined, categoriesToCopy);
            
            // Reset & Close
            setNewObjectName('');
            setCloneFromId('');
            setCloneCategories({ people: true, organizations: true, groups: true, certificates: false, regulations: true });
            setManagerView('list');
            setIsManagerOpen(false);
        }
    };
    
    const startEditing = (obj: ConstructionObject) => {
        setEditingObjId(obj.id);
        setEditNameValue(obj.name);
    };
    
    const saveEditing = (id: string) => {
        if (editNameValue.trim()) {
            onUpdateObject(id, editNameValue.trim());
        }
        setEditingObjId(null);
    };

    const handleSelectObject = (id: string) => {
        onObjectChange(id);
        setIsManagerOpen(false);
    };

    return (
        <aside className={`bg-white shadow-lg flex flex-col transition-all duration-300 ease-in-out ${isOpen ? 'w-64' : 'w-20'} z-20`}>
            {/* Header: Toggle & Brand */}
            <div className={`flex items-center border-b border-slate-100 h-16 flex-shrink-0 ${isOpen ? 'justify-between px-4' : 'justify-center'}`}>
                {isOpen && <h1 className="text-xl font-bold text-blue-700">DocGen AI</h1>}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 rounded-md hover:bg-slate-100 text-slate-500"
                    title={isOpen ? "Свернуть" : "Развернуть"}
                >
                    <ChevronLeftIcon className={`w-6 h-6 transition-transform duration-300 ${isOpen ? '' : 'rotate-180'}`} />
                </button>
            </div>

            {/* NEW: Object Switcher Card */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/30">
                {isOpen ? (
                    <button 
                        onClick={() => { setIsManagerOpen(true); setManagerView('list'); }}
                        className="w-full bg-white border border-slate-200 hover:border-blue-400 hover:shadow-sm rounded-lg p-2.5 text-left transition-all group flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0 border border-blue-200">
                                {currentObject?.name.substring(0, 1).toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Объект</div>
                                <div className="text-sm font-semibold text-slate-800 truncate leading-tight group-hover:text-blue-700">
                                    {currentObject?.name || 'Выберите объект'}
                                </div>
                            </div>
                        </div>
                        <ChevronDownIcon className="w-4 h-4 text-slate-400 group-hover:text-blue-500 flex-shrink-0 ml-1" />
                    </button>
                ) : (
                    <div className="flex justify-center">
                        <button 
                            onClick={() => { setIsOpen(true); setTimeout(() => setIsManagerOpen(true), 100); }}
                            className="w-10 h-10 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-bold text-lg border border-blue-200 hover:bg-blue-200 transition-colors"
                            title={currentObject?.name}
                        >
                            {currentObject?.name.substring(0, 1).toUpperCase()}
                        </button>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-grow p-3 space-y-1 overflow-y-auto">
                {navItems.map(item => (
                    <SidebarButton
                        key={item.page}
                        icon={item.icon}
                        label={item.label}
                        isOpen={isOpen}
                        isActive={currentPage === item.page}
                        onClick={() => setCurrentPage(item.page as Page)}
                    />
                ))}
                
                <div className="my-2 border-t border-slate-100 mx-1"></div>
                <SidebarButton
                    icon={<TrashIcon className="w-5 h-5" />}
                    label="Корзина"
                    isOpen={isOpen}
                    isActive={currentPage === 'trash'}
                    onClick={() => setCurrentPage('trash')}
                    badge={trashCount}
                 />
            </nav>

            {/* Footer */}
            <div className="p-3 border-t border-slate-100 space-y-1 mt-auto bg-slate-50/50">
                 <SidebarButton
                    icon={<SettingsIcon className="w-5 h-5" />}
                    label="Настройки"
                    isOpen={isOpen}
                    isActive={currentPage === 'settings'}
                    onClick={() => setCurrentPage('settings')}
                 />
                 
                 <SidebarButton
                    icon={getThemeIcon()}
                    label={getThemeLabel()}
                    isOpen={isOpen}
                    onClick={onToggleTheme}
                    className="text-slate-600 hover:bg-slate-100"
                 />
            </div>

            {/* --- OBJECT MANAGER MODAL --- */}
            <Modal 
                isOpen={isManagerOpen} 
                onClose={() => setIsManagerOpen(false)} 
                title={managerView === 'list' ? "Выбор объекта" : "Новый объект"}
                maxWidth="max-w-xl"
            >
                {managerView === 'list' ? (
                    <div className="flex flex-col h-[60vh]">
                        {/* Search & Actions */}
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="text" 
                                placeholder="Поиск объекта..." 
                                className="flex-grow border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                            <button 
                                onClick={() => setManagerView('create')}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 flex items-center gap-2 whitespace-nowrap"
                            >
                                <PlusIcon className="w-4 h-4" /> Создать
                            </button>
                        </div>

                        {/* Object List */}
                        <div className="flex-grow overflow-y-auto border border-slate-200 rounded-md bg-slate-50 divide-y divide-slate-100">
                            {filteredObjects.length > 0 ? (
                                filteredObjects.map(obj => (
                                    <div 
                                        key={obj.id} 
                                        className={`flex items-center justify-between p-3 hover:bg-white transition-colors group ${currentObjectId === obj.id ? 'bg-blue-50 hover:bg-blue-50 ring-1 ring-inset ring-blue-200' : ''}`}
                                    >
                                        {editingObjId === obj.id ? (
                                            <div className="flex-grow flex items-center gap-2 mr-2">
                                                <input 
                                                    type="text" 
                                                    value={editNameValue}
                                                    onChange={(e) => setEditNameValue(e.target.value)}
                                                    className="w-full border border-blue-400 rounded px-2 py-1 text-sm outline-none shadow-sm"
                                                    autoFocus
                                                    onKeyDown={(e) => { if(e.key === 'Enter') saveEditing(obj.id); if(e.key === 'Escape') setEditingObjId(null); }}
                                                />
                                                <button onClick={() => saveEditing(obj.id)} className="p-1 text-green-600 hover:bg-green-100 rounded"><CheckIcon className="w-4 h-4"/></button>
                                                <button onClick={() => setEditingObjId(null)} className="p-1 text-red-500 hover:bg-red-100 rounded"><CloseIcon className="w-4 h-4"/></button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => handleSelectObject(obj.id)}
                                                className="flex-grow text-left flex items-center gap-3 min-w-0"
                                            >
                                                <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-sm flex-shrink-0 border ${currentObjectId === obj.id ? 'bg-blue-200 text-blue-800 border-blue-300' : 'bg-white text-slate-500 border-slate-200'}`}>
                                                    {obj.name.substring(0, 1).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className={`font-medium truncate ${currentObjectId === obj.id ? 'text-blue-800' : 'text-slate-700'}`}>{obj.name}</div>
                                                    {currentObjectId === obj.id && <div className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">Текущий</div>}
                                                </div>
                                            </button>
                                        )}

                                        {/* Actions */}
                                        {!editingObjId && (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); startEditing(obj); }}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded"
                                                    title="Переименовать"
                                                >
                                                    <EditIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-500">
                                    Объекты не найдены
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // CREATE VIEW
                    <form onSubmit={handleCreateObject} className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <button type="button" onClick={() => setManagerView('list')} className="text-slate-400 hover:text-slate-600">
                                <ChevronLeftIcon className="w-5 h-5" />
                            </button>
                            <h3 className="font-semibold text-lg">Создание объекта</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Наименование</label>
                            <input 
                                type="text" 
                                value={newObjectName}
                                onChange={(e) => setNewObjectName(e.target.value)}
                                className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Например: Жилой дом поз. 5"
                                autoFocus
                                required
                            />
                        </div>

                        <div className="border-t border-slate-200 pt-4 mt-2">
                            <label className="block text-sm font-medium text-slate-800 mb-2">Копировать данные из другого объекта</label>
                            <select 
                                className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white"
                                value={cloneFromId}
                                onChange={(e) => setCloneFromId(e.target.value)}
                            >
                                <option value="">-- Не копировать (пустой объект) --</option>
                                {constructionObjects.map(obj => (
                                    <option key={obj.id} value={obj.id}>{obj.name}</option>
                                ))}
                            </select>

                            {cloneFromId && (
                                <div className="mt-3 space-y-2 bg-slate-50 p-3 rounded border border-slate-200">
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

                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={() => setManagerView('list')} className="px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200">Назад</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">Создать</button>
                        </div>
                    </form>
                )}
            </Modal>
        </aside>
    );
};

export default Sidebar;
