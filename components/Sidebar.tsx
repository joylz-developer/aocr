import React from 'react';
import { Page } from '../App';
import { ChevronLeftIcon, ActsIcon, PeopleIcon, OrganizationsIcon, SettingsIcon, ImportIcon, ExportIcon, TemplateIcon } from './Icons';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    currentPage: Page;
    setCurrentPage: (page: Page) => void;
    isTemplateLoaded: boolean;
    onImport: () => void;
    onExport: () => void;
    onChangeTemplate: () => void;
}

const SidebarButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    isActive?: boolean;
    isOpen: boolean;
    disabled?: boolean;
    onClick?: () => void;
    title?: string;
}> = ({ icon, label, isActive = false, isOpen, disabled = false, title, ...props }) => {
    const baseClasses = "flex items-center w-full text-left rounded-md transition-colors duration-200";
    const sizeClasses = isOpen ? "px-4 py-2.5" : "p-3 justify-center";
    const stateClasses = disabled
        ? "text-slate-400 cursor-not-allowed"
        : isActive
            ? "bg-blue-600 text-white"
            : "text-slate-600 hover:bg-slate-200 hover:text-slate-800";

    return (
        <button
            className={`${baseClasses} ${sizeClasses} ${stateClasses}`}
            disabled={disabled}
            // FIX: Destructure `title` from props to resolve reference error. `title` was used here but not defined in the function scope.
            title={isOpen ? undefined : title || label}
            {...props}
        >
            <div className="flex-shrink-0">{icon}</div>
            {isOpen && <span className="ml-4 text-sm font-medium whitespace-nowrap">{label}</span>}
        </button>
    );
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, currentPage, setCurrentPage, isTemplateLoaded, onImport, onExport, onChangeTemplate }) => {
    const navItems = [
        { page: 'acts', label: 'Акты', icon: <ActsIcon className="w-5 h-5" /> },
        { page: 'people', label: 'Участники', icon: <PeopleIcon className="w-5 h-5" /> },
        { page: 'organizations', label: 'Организации', icon: <OrganizationsIcon className="w-5 h-5" /> },
        { page: 'settings', label: 'Настройки', icon: <SettingsIcon className="w-5 h-5" /> },
    ];

    return (
        <aside className={`bg-white shadow-lg flex flex-col transition-all duration-300 ease-in-out ${isOpen ? 'w-64' : 'w-20'}`}>
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

            <nav className="flex-grow p-3 space-y-1">
                {navItems.map(item => (
                    <SidebarButton
                        key={item.page}
                        icon={item.icon}
                        label={item.label}
                        isOpen={isOpen}
                        isActive={currentPage === item.page}
                        disabled={!isTemplateLoaded}
                        onClick={() => setCurrentPage(item.page as Page)}
                    />
                ))}
            </nav>

            <div className="p-3 border-t space-y-1">
                 <SidebarButton
                    icon={<ImportIcon className="w-5 h-5" />}
                    label="Импорт"
                    isOpen={isOpen}
                    onClick={onImport}
                 />
                 <SidebarButton
                    icon={<ExportIcon className="w-5 h-5" />}
                    label="Экспорт"
                    isOpen={isOpen}
                    disabled={!isTemplateLoaded}
                    onClick={onExport}
                 />
                 <SidebarButton
                    icon={<TemplateIcon className="w-5 h-5" />}
                    label="Сменить шаблон"
                    isOpen={isOpen}
                    disabled={!isTemplateLoaded}
                    onClick={onChangeTemplate}
                 />
            </div>
        </aside>
    );
};

export default Sidebar;