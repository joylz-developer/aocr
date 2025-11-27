
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Regulation } from '../types';
import { PlusIcon, TrashIcon, BookIcon, CloseIcon } from '../components/Icons';
import Modal from '../components/Modal';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface RegulationsPageProps {
    regulations: Regulation[];
    onSaveRegulations: (newRegulations: Regulation[]) => void;
}

const RegulationDetails: React.FC<{ regulation: Regulation; onClose: () => void }> = ({ regulation, onClose }) => {
    // If fullJson exists, render key fields from it, otherwise use the Regulation interface fields
    const details = regulation.fullJson || {
        "Обозначение": regulation.designation,
        "Полное название": regulation.fullName,
        "Статус": regulation.status,
        "Заглавие": regulation.title,
        "Дата утверждения": regulation.approvalDate,
        "Дата регистрации": regulation.registrationDate,
        "Дата введения": regulation.activeDate,
        "Утвержден": regulation.orgApprover,
        "Заменен на": regulation.replacement
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-start mb-4 border-b pb-2">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">{regulation.designation}</h3>
                    <p className="text-sm text-slate-500">{regulation.status}</p>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                    <CloseIcon className="w-6 h-6" />
                </button>
            </div>
            <div className="overflow-y-auto flex-grow pr-2">
                <table className="w-full text-sm text-left">
                    <tbody>
                        {Object.entries(details).map(([key, value]) => {
                            if (!value || typeof value === 'object') return null;
                            // Filter out internal technical keys if needed, though most from JSON are valid
                            return (
                                <tr key={key} className="border-b border-slate-100 last:border-0">
                                    <td className="py-2 pr-4 font-medium text-slate-600 align-top w-1/3">{key}</td>
                                    <td className="py-2 text-slate-800 align-top whitespace-pre-wrap">{String(value)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
             <div className="mt-4 pt-4 border-t flex justify-end">
                <button 
                    onClick={onClose} 
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    Закрыть
                </button>
            </div>
        </div>
    );
}

const RegulationsPage: React.FC<RegulationsPageProps> = ({ regulations, onSaveRegulations }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [groupChanges, setGroupChanges] = useState(true);
    // Shared state for Active Only filter
    const [showActiveOnly, setShowActiveOnly] = useLocalStorage<boolean>('regulations_show_active_only', false);
    
    const [viewingRegulation, setViewingRegulation] = useState<Regulation | null>(null);
    const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = useState(false);

    // This useMemo handles Sorting, Grouping, and Filtering
    const displayedRegulations = useMemo(() => {
        let processed = [...regulations];

        // 1. Filter Inactive (Active Only)
        if (showActiveOnly) {
            processed = processed.filter(reg => reg.status.toLowerCase().includes('действует'));
        }

        // 2. Grouping Logic
        if (groupChanges) {
            const parentMap = new Map<string, Regulation>();
            const changes: Regulation[] = [];
            const others: Regulation[] = [];

            // Separate potential parents and changes
            processed.forEach(reg => {
                const changeMatch = reg.designation.match(/^Изменение №\s*(\d+)\s*к\s+(.*)$/i);
                if (changeMatch) {
                    changes.push(reg);
                } else {
                    // Clone to avoid mutating original state in strict mode issues, and init embeddedChanges
                    const parent = { ...reg, embeddedChanges: [] as Regulation[] };
                    parentMap.set(reg.designation.trim(), parent);
                    others.push(parent);
                }
            });

            // Associate changes with parents
            const orphanedChanges: Regulation[] = [];
            changes.forEach(change => {
                const changeMatch = change.designation.match(/^Изменение №\s*(\d+)\s*к\s+(.*)$/i);
                if (changeMatch) {
                    const parentName = changeMatch[2].trim();
                    const parent = parentMap.get(parentName);
                    if (parent) {
                        parent.embeddedChanges = parent.embeddedChanges || [];
                        parent.embeddedChanges.push(change);
                        // Sort embedded changes by number
                        parent.embeddedChanges.sort((a, b) => {
                             const numA = parseInt(a.designation.match(/^Изменение №\s*(\d+)/i)?.[1] || '0', 10);
                             const numB = parseInt(b.designation.match(/^Изменение №\s*(\d+)/i)?.[1] || '0', 10);
                             return numA - numB;
                        });
                    } else {
                        orphanedChanges.push(change);
                    }
                } else {
                    orphanedChanges.push(change);
                }
            });

            processed = [...others, ...orphanedChanges];
        }

        // 3. Sorting Logic - ALWAYS ON (Smart Sort)
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        processed.sort((a, b) => {
            return collator.compare(a.designation, b.designation);
        });

        // 4. Search Filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            processed = processed.filter(reg => 
                reg.designation.toLowerCase().includes(lowerTerm) || 
                reg.title.toLowerCase().includes(lowerTerm) || 
                (reg.replacement && reg.replacement.toLowerCase().includes(lowerTerm))
            );
        }

        return processed;
    }, [regulations, searchTerm, groupChanges, showActiveOnly]);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("Failed to read file");
                
                const json = JSON.parse(text);
                if (!Array.isArray(json)) throw new Error("Format error: Root must be an array");

                const parsedRegulations: Regulation[] = json.map((item: any) => ({
                    id: crypto.randomUUID(),
                    designation: item["Обозначение"] || item["Designation"] || '',
                    fullName: item["Полное название"] || item["Full Name"] || '',
                    status: item["Статус"] || item["Status"] || '',
                    title: item["Заглавие на русском языке"] || item["Title"] || '',
                    replacement: item["Обозначение заменяющего"] || item["Replacement"] || undefined,
                    registrationDate: item["Дата регистрации"],
                    approvalDate: item["Дата утверждения"],
                    activeDate: item["Дата введения в действие"],
                    orgApprover: item["Орган, утвердивший свод правил"],
                    fullJson: item
                })).filter(r => r.designation); // Filter out empty entries

                const existingDesignations = new Set(regulations.map(r => r.designation));
                const uniqueNew = parsedRegulations.filter(r => !existingDesignations.has(r.designation));
                
                if (uniqueNew.length === 0 && parsedRegulations.length > 0) {
                     alert("Все загруженные нормативы уже есть в базе.");
                } else {
                    onSaveRegulations([...regulations, ...uniqueNew]);
                    alert(`Успешно добавлено ${uniqueNew.length} документов.`);
                }

            } catch (error) {
                console.error("Error parsing JSON:", error);
                alert("Ошибка при чтении JSON файла. Проверьте формат.");
            } finally {
                setIsLoading(false);
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleClearDatabase = () => {
        if (confirm("Вы уверены, что хотите полностью очистить базу нормативов? Это действие необратимо.")) {
            onSaveRegulations([]);
        }
    };

    const handleNavigateToReplacement = (e: React.MouseEvent, replacementDesignation: string) => {
        e.stopPropagation();
        if (!replacementDesignation) return;

        // Try to find exact match first
        let target = regulations.find(r => r.designation.toLowerCase() === replacementDesignation.toLowerCase());
        
        // If strict match fails, try relaxed match (contains)
        if (!target) {
             target = regulations.find(r => r.designation.toLowerCase().includes(replacementDesignation.toLowerCase()));
        }

        if (target) {
            // Uncheck active filter if the target is inactive, so we can see it
            if (showActiveOnly && !target.status.toLowerCase().includes('действует')) {
                setShowActiveOnly(false);
                // We need a slight delay to allow re-render with inactive items shown
                setTimeout(() => {
                    setHighlightedRowId(target!.id);
                    const element = document.getElementById(`reg-row-${target!.id}`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            } else {
                setHighlightedRowId(target.id);
                // Scroll immediately
                setTimeout(() => {
                    const element = document.getElementById(`reg-row-${target!.id}`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            }

            // Remove highlight after animation duration (2s)
            setTimeout(() => setHighlightedRowId(null), 2000);
        } else {
            alert(`Документ "${replacementDesignation}" не найден в загруженной базе.`);
        }
    };

    const getStatusColor = (status: string) => {
        if (!status) return 'bg-gray-100 text-gray-800';
        if (status.toLowerCase().includes('действует')) return 'bg-green-100 text-green-800';
        if (status.toLowerCase().includes('заменен') || status.toLowerCase().includes('отменен')) return 'bg-red-100 text-red-800';
        return 'bg-blue-100 text-blue-800';
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 flex-shrink-0 gap-4">
                <h1 className="text-2xl font-bold text-slate-800">Нормативные документы (СП)</h1>
                <div className="flex flex-wrap gap-2">
                     <button 
                        onClick={handleClearDatabase} 
                        className="flex items-center bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-md hover:bg-red-100"
                        disabled={regulations.length === 0}
                    >
                        <TrashIcon className="w-5 h-5 mr-2" /> Очистить базу
                    </button>
                    <button 
                        onClick={handleUploadClick} 
                        disabled={isLoading}
                        className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-70"
                    >
                        <PlusIcon /> {isLoading ? 'Загрузка...' : 'Загрузить JSON'}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                </div>
            </div>

             <div className="flex flex-col gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Поиск по обозначению, названию..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700 bg-slate-50 p-3 rounded-md border border-slate-200">
                    <label className="flex items-center cursor-pointer select-none">
                        <input 
                            type="checkbox" 
                            className="h-4 w-4 form-checkbox-custom"
                            checked={groupChanges}
                            onChange={(e) => setGroupChanges(e.target.checked)}
                        />
                        <span className="ml-2">Группировать изменения с основным СП</span>
                    </label>
                    <label className="flex items-center cursor-pointer select-none">
                        <input 
                            type="checkbox" 
                            className="h-4 w-4 form-checkbox-custom"
                            checked={showActiveOnly}
                            onChange={(e) => setShowActiveOnly(e.target.checked)}
                        />
                        <span className="ml-2">Скрыть не действующие</span>
                    </label>
                </div>
            </div>

            <div className="flex-grow overflow-auto border border-slate-200 rounded-md relative">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-48">Обозначение</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-40">Изменения</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Название</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-32">Статус</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-40">Был заменен на:</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {displayedRegulations.length > 0 ? displayedRegulations.map(reg => (
                            <tr 
                                key={reg.id} 
                                id={`reg-row-${reg.id}`}
                                className={`hover:bg-slate-50 transition-colors duration-300 ${highlightedRowId === reg.id ? 'animate-highlight' : ''}`}
                            >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800 align-top">
                                    <button 
                                        onClick={() => setViewingRegulation(reg)}
                                        className="text-blue-700 hover:text-blue-900 hover:underline text-left font-bold"
                                        title="Нажмите, чтобы открыть подробности"
                                    >
                                        {reg.designation}
                                    </button>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 align-top">
                                    {reg.embeddedChanges && reg.embeddedChanges.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {reg.embeddedChanges.map(change => {
                                                const changeNum = change.designation.match(/№\s*(\d+)/)?.[1] || '?';
                                                return (
                                                    <button 
                                                        key={change.id} 
                                                        onClick={() => setViewingRegulation(change)}
                                                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border cursor-pointer hover:shadow-sm ${change.status.includes('Действует') ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
                                                        title={`${change.designation} (${change.status})\nНажмите для подробностей`}
                                                    >
                                                        №{changeNum}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <span className="text-slate-300">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 min-w-[300px] align-top">
                                    <div className="whitespace-normal" title={reg.title}>{reg.title}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap align-top">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(reg.status)}`}>
                                        {reg.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm align-top">
                                    {reg.replacement ? (
                                        <button 
                                            onClick={(e) => handleNavigateToReplacement(e, reg.replacement!)}
                                            className="text-blue-600 hover:text-blue-800 font-medium hover:underline text-left"
                                            title={`Перейти к ${reg.replacement}`}
                                        >
                                            {reg.replacement}
                                        </button>
                                    ) : (
                                        <span className="text-transparent selection:text-transparent select-none"></span>
                                    )}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="text-center py-16 text-slate-500">
                                    {regulations.length === 0 ? (
                                        <div className="flex flex-col items-center">
                                            <BookIcon className="w-12 h-12 mb-2 text-slate-300" />
                                            <p>База нормативов пуста.</p>
                                            <p className="text-sm">Загрузите JSON файл, чтобы начать работу.</p>
                                        </div>
                                    ) : (
                                        <p>Ничего не найдено по запросу "{searchTerm}" {showActiveOnly ? '(с учетом фильтра "Скрыть не действующие")' : ''}</p>
                                    )}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
             <div className="mt-2 text-xs text-slate-500 text-right">
                Отображено записей: {displayedRegulations.length} (Всего: {regulations.length})
            </div>

            {viewingRegulation && (
                <Modal 
                    isOpen={!!viewingRegulation} 
                    onClose={() => setViewingRegulation(null)} 
                    title="Карточка нормативного документа"
                >
                    <RegulationDetails 
                        regulation={viewingRegulation} 
                        onClose={() => setViewingRegulation(null)} 
                    />
                </Modal>
            )}
        </div>
    );
};

export default RegulationsPage;
