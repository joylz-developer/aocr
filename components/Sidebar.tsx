
import React, { useState, useRef, useEffect } from 'react';
import { Page, Theme, ConstructionObject } from '../types';
import { ChevronLeftIcon, ActsIcon, PeopleIcon, OrganizationsIcon, SettingsIcon, GroupsIcon, TrashIcon, BookIcon, CertificateIcon, SunIcon, MoonIcon, EyeIcon, PlusIcon, EditIcon, CheckIcon, CloseIcon } from './Icons';
import Modal from './Modal';
import CustomSelect from './CustomSelect';

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
    const [isObjectModalOpen, setIsObjectModalOpen] = useState(false);
    const [newObjectName, setNewObjectName] = useState('');
    const [isEditingObject, setIsEditingObject] = useState(false);
    
    // Cloning State
    const [cloneFromId, setCloneFromId] = useState<string>('');
    const [cloneCategories, setCloneCategories] = useState<{ [key: string]: boolean }>({
        people: true,
        organizations: true,
        groups: true,
        certificates: false,
        regulations: true
    });
    
    // For editing current object
    const [editMode, setEditMode] = useState(false);
    const [editName, setEditName] = useState('');
    
    const currentObject = constructionObjects.find(o => o.id === currentObjectId);
    
    // Options for CustomSelect
    const objectOptions = constructionObjects.map(obj => ({ value: obj.id, label: obj.name }));

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
            
            // Reset form
            setNewObjectName('');
            setCloneFromId('');
            setCloneCategories({ people: true, organizations: true, groups: true, certificates: false, regulations: true });
            setIsObjectModalOpen(false);
        }
    };
    
    const startEditing = () => {
        if (currentObject) {
            setEditName(currentObject.name);
            setEditMode(true);
        }
    };
    
    const saveEditing = () => {
        if (editName.trim() && currentObjectId) {
            onUpdateObject(currentObjectId, editName.trim());
            setEditMode(false);
        }
    };

    return (
        <aside className={`bg-white shadow-lg flex flex-col transition-all duration-300 ease-in-out ${isOpen ? 'w-64' : 'w-20'} z-20`}>
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

            {/* Construction Object Selector */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                {isOpen ? (
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Объект строительства</label>
                        
                        {editMode ? (
                            <div className="flex gap-1">
                                <input 
                                    type="text" 
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full text-sm border border-blue-300 rounded px-2 py-1 focus:outline-none"
                                    autoFocus
                                    onKeyDown={(e) => { if(e.key === 'Enter') saveEditing(); if(e.key === 'Escape') setEditMode(false); }}
                                />
                                <button onClick={saveEditing} className="p-1 text-green-600 hover:bg-green-100 rounded"><CheckIcon className="w-4 h-4"/></button>
                                <button onClick={() => setEditMode(false)} className="p-1 text-red-500 hover:bg-red-100 rounded"><CloseIcon className="w-4 h-4"/></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1">
                                <div className="flex-grow min-w-0">
                                    <CustomSelect 
                                        options={objectOptions}
                                        value={currentObjectId || ''} 
                                        onChange={(val) => onObjectChange(val)}
                                        buttonClassName="w-full text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 outline-none flex justify-between items-center text-left"
                                        placeholder="Выберите объект"
                                    />
                                </div>
                                <button 
                                    onClick={startEditing}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 transition-colors"
                                    title="Переименовать объект"
                                >
                                    <EditIcon className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => setIsObjectModalOpen(true)}
                                    className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shadow-sm"
                                    title="Создать новый объект"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex justify-center flex-col items-center gap-2">
                        <div 
                            className="w-10 h-10 bg-slate-200 rounded flex items-center justify-center text-slate-600 font-bold text-lg cursor-help border border-slate-300"
                            title={currentObject?.name}
                        >
                            {currentObject?.name.substring(0, 1).toUpperCase()}
                        </div>
                        <button 
                            onClick={() => { setIsOpen(true); setTimeout(() => setIsObjectModalOpen(true), 100); }}
                            className="p-1 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200"
                            title="Новый объект"
                        >
                            <PlusIcon className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </div>

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
                
                {/* Trash moved here to group with object-specific items */}
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

            {/* Footer with Settings and Theme */}
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

            <Modal isOpen={isObjectModalOpen} onClose={() => setIsObjectModalOpen(false)} title="Новый объект строительства">
                <form onSubmit={handleCreateObject} className="space-y-4">
                    <p className="text-sm text-slate-600">
                        Создайте новую папку (объект) для раздельного ведения документации.
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Наименование объекта</label>
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
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" className="form-checkbox-custom h-4 w-4" checked={cloneCategories.people} onChange={e => setCloneCategories(p => ({...p, people: e.target.checked}))} />
                                        Участники
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" className="form-checkbox-custom h-4 w-4" checked={cloneCategories.organizations} onChange={e => setCloneCategories(p => ({...p, organizations: e.target.checked}))} />
                                        Организации
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" className="form-checkbox-custom h-4 w-4" checked={cloneCategories.groups} onChange={e => setCloneCategories(p => ({...p, groups: e.target.checked}))} />
                                        Группы комиссий
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" className="form-checkbox-custom h-4 w-4" checked={cloneCategories.regulations} onChange={e => setCloneCategories(p => ({...p, regulations: e.target.checked}))} />
                                        Нормативы
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" className="form-checkbox-custom h-4 w-4" checked={cloneCategories.certificates} onChange={e => setCloneCategories(p => ({...p, certificates: e.target.checked}))} />
                                        Сертификаты
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setIsObjectModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200">Отмена</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">Создать</button>
                    </div>
                </form>
            </Modal>
        </aside>
    );
};

export default Sidebar;
