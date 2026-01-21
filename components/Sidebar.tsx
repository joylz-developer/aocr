
import React from 'react';
import { Page, Theme } from '../types';
import { ChevronLeftIcon, ActsIcon, PeopleIcon, OrganizationsIcon, SettingsIcon, GroupsIcon, TrashIcon, BookIcon, CertificateIcon, SunIcon, MoonIcon, EyeIcon } from './Icons';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    currentPage: Page;
    setCurrentPage: (page: Page) => void;
    isTemplateLoaded: boolean;
    trashCount: number;
    theme: Theme;
    onToggleTheme: () => void;
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
            : "text-slate-600 hover:bg-slate-200 hover:text-slate-800";

    return (
        <button
            className={`${baseClasses} ${sizeClasses} ${stateClasses} ${className || ''}`}
            disabled={disabled}
            title={isOpen ? undefined : title || label}
            {...props}
        >
            <div className="flex-shrink-0">{icon}</div>
            {isOpen && <span className="ml-4 text-sm font-medium whitespace-nowrap">{label}</span>}
             {badge > 0 && (
                <span className={`absolute top-1 text-white text-xs font-bold rounded-full h-5 min-w-[1.25rem] flex items-center justify-center px-1 ${isOpen ? 'right-2' : 'right-1'} ${isActive ? 'bg-blue-500' : 'bg-red-500'}`}>
                    {badge}
                </span>
            )}
        </button>
    );
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, currentPage, setCurrentPage, isTemplateLoaded, trashCount, theme, onToggleTheme }) => {
    const navItems = [
        { page: 'acts', label: 'Акты', icon: <ActsIcon className="w-5 h-5" /> },
        { page: 'people', label: 'Участники', icon: <PeopleIcon className="w-5 h-5" /> },
        { page: 'organizations', label: 'Организации', icon: <OrganizationsIcon className="w-5 h-5" /> },
        { page: 'groups', label: 'Группы комиссий', icon: <GroupsIcon className="w-5 h-5" /> },
        { page: 'certificates', label: 'Сертификаты', icon: <CertificateIcon className="w-5 h-5" /> },
        { page: 'regulations', label: 'Нормативы', icon: <BookIcon className="w-5 h-5" /> },
        { page: 'settings', label: 'Настройки', icon: <SettingsIcon className="w-5 h-5" /> },
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
            <div className={`flex items-center border-b h-16 flex-shrink-0 ${isOpen ? 'justify-between px-4' : 'justify-center'}`}>
                {isOpen && <h1 className="text-xl font-bold text-blue-700">DocGen AI</h1>}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 rounded-md hover:bg-slate-100 text-slate-500"
                    title={isOpen ? "Свернуть" : "Развернуть"}
                >
                    <ChevronLeftIcon className={`w-6 h-6 transition-transform duration-300 ${isOpen ? '' : 'rotate-180'}`} />
                </button>
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
            </nav>

            <div className="p-3 border-t space-y-1">
                 <SidebarButton
                    icon={<TrashIcon className="w-5 h-5" />}
                    label="Корзина"
                    isOpen={isOpen}
                    isActive={currentPage === 'trash'}
                    onClick={() => setCurrentPage('trash')}
                    badge={trashCount}
                 />
                 
                 <div className="my-1 border-t border-slate-100 pt-1"></div>
                 
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
