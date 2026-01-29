
import React from 'react';
import { Page, Theme, ConstructionObject } from '../types';
import { ChevronLeftIcon, ActsIcon, PeopleIcon, OrganizationsIcon, SettingsIcon, GroupsIcon, TrashIcon, BookIcon, CertificateIcon, SunIcon, MoonIcon, EyeIcon, ChevronDownIcon } from './Icons';

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
    isOpen, setIsOpen, currentPage, setCurrentPage, trashCount, theme, onToggleTheme,
    constructionObjects, currentObjectId
}) => {
    const currentObject = constructionObjects.find(o => o.id === currentObjectId);
    const displayName = currentObject?.shortName || currentObject?.name || 'Выберите объект';
    
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

            {/* Object Switcher Card - Navigates to Objects Page */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/30">
                {isOpen ? (
                    <button 
                        onClick={() => setCurrentPage('objects')}
                        className={`w-full bg-white border rounded-lg p-2.5 text-left transition-all group flex items-center justify-between ${currentPage === 'objects' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 hover:border-blue-400 hover:shadow-sm'}`}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0 border border-blue-200">
                                {displayName.substring(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Объект</div>
                                <div className="text-sm font-semibold text-slate-800 truncate leading-tight group-hover:text-blue-700">
                                    {displayName}
                                </div>
                            </div>
                        </div>
                        <ChevronDownIcon className={`w-4 h-4 text-slate-400 group-hover:text-blue-500 flex-shrink-0 ml-1 ${currentPage === 'objects' ? 'transform -rotate-90' : ''}`} />
                    </button>
                ) : (
                    <div className="flex justify-center">
                        <button 
                            onClick={() => { setIsOpen(true); setTimeout(() => setCurrentPage('objects'), 100); }}
                            className={`w-10 h-10 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-bold text-lg border hover:bg-blue-200 transition-colors ${currentPage === 'objects' ? 'border-blue-500 ring-2 ring-blue-500' : 'border-blue-200'}`}
                            title={displayName}
                        >
                            {displayName.substring(0, 1).toUpperCase()}
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
        </aside>
    );
};

export default Sidebar;