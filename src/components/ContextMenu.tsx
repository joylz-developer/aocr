import React, { useRef, useEffect, useState, ReactNode } from 'react';

interface MenuItemProps {
    icon?: React.ReactNode;
    label: string;
    shortcut?: string;
    disabled?: boolean;
    className?: string;
    onClick?: () => void;
}

export const MenuItem: React.FC<MenuItemProps> = ({ icon, label, shortcut, disabled, className, onClick }) => {
    const handleClick = (e: React.MouseEvent) => {
        if (disabled) return;
        e.stopPropagation();
        onClick?.();
    };

    return (
        <button
            onClick={handleClick}
            disabled={disabled}
            className={`flex items-center w-full text-left px-3 py-1.5 text-sm rounded transition-colors ${
                disabled
                    ? 'text-slate-400 cursor-not-allowed'
                    : `text-slate-800 hover:bg-slate-100 ${className || ''}`
            }`}
        >
            {icon && <span className="mr-3 w-5 h-5 flex items-center justify-center">{icon}</span>}
            <span className="flex-grow">{label}</span>
            {shortcut && <span className="text-xs text-slate-400 ml-4">{shortcut}</span>}
        </button>
    );
};

export const MenuSeparator: React.FC = () => (
    <div className="h-px bg-slate-200 my-1 mx-2" />
);

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    children: ReactNode;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, children }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x, y });

    useEffect(() => {
        if (menuRef.current) {
            const menuRect = menuRef.current.getBoundingClientRect();
            let newX = x;
            let newY = y;

            if (x + menuRect.width > window.innerWidth) {
                newX = window.innerWidth - menuRect.width - 10;
            }
            if (y + menuRect.height > window.innerHeight) {
                newY = window.innerHeight - menuRect.height - 10;
            }
            setPosition({ x: newX, y: newY });
        }
    }, [x, y]);

    useEffect(() => {
        const handleInteraction = (e: MouseEvent | KeyboardEvent) => {
            if (e instanceof KeyboardEvent && e.key === 'Escape') {
                onClose();
                return;
            }
            if (e instanceof MouseEvent) {
                if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                    onClose();
                }
            }
        };

        // Timeout to prevent the same click that opened the menu from closing it
        const timerId = setTimeout(() => {
            document.addEventListener('mousedown', handleInteraction);
            document.addEventListener('keydown', handleInteraction);
        }, 0);

        return () => {
            clearTimeout(timerId);
            document.removeEventListener('mousedown', handleInteraction);
            document.removeEventListener('keydown', handleInteraction);
        };
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            style={{ top: position.y, left: position.x }}
            className="fixed bg-white shadow-lg rounded-md border border-slate-200 p-1.5 z-50 w-64 select-none animate-fade-in-up"
            onContextMenu={(e) => e.preventDefault()}
        >
            {children}
        </div>
    );
};