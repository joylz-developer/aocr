
import React, { useState, useRef, useMemo } from 'react';
import { Regulation } from '../types';
import { PlusIcon, TrashIcon, BookIcon } from '../components/Icons';

interface RegulationsPageProps {
    regulations: Regulation[];
    onSaveRegulations: (newRegulations: Regulation[]) => void;
}

const RegulationsPage: React.FC<RegulationsPageProps> = ({ regulations, onSaveRegulations }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = useState(false);

    const filteredRegulations = useMemo(() => {
        if (!searchTerm) return regulations;
        const lowerTerm = searchTerm.toLowerCase();
        return regulations.filter(reg => 
            reg.designation.toLowerCase().includes(lowerTerm) || 
            reg.title.toLowerCase().includes(lowerTerm) || 
            (reg.replacement && reg.replacement.toLowerCase().includes(lowerTerm))
        );
    }, [regulations, searchTerm]);

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

                // Merge or Replace? Let's Merge by Designation for now to avoid duplicates if possible, or just Replace list.
                // Prompt implies "Load this database", so let's append but check duplicates? 
                // Simple approach: Replace list or Append. Let's Append but filter dupes by designation.
                
                const existingDesignations = new Set(regulations.map(r => r.designation));
                const uniqueNew = parsedRegulations.filter(r => !existingDesignations.has(r.designation));
                
                if (uniqueNew.length === 0 && parsedRegulations.length > 0) {
                     alert("Все загруженные нормативы уже есть в базе.");
                } else {
                    onSaveRegulations([...regulations, ...uniqueNew].sort((a,b) => a.designation.localeCompare(b.designation)));
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

    const getStatusColor = (status: string) => {
        if (!status) return 'bg-gray-100 text-gray-800';
        if (status.toLowerCase().includes('действует')) return 'bg-green-100 text-green-800';
        if (status.toLowerCase().includes('заменен') || status.toLowerCase().includes('отменен')) return 'bg-red-100 text-red-800';
        return 'bg-blue-100 text-blue-800';
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold text-slate-800">Нормативные документы (СП)</h1>
                <div className="flex gap-2">
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

            <div className="mb-4">
                 <input
                    type="text"
                    placeholder="Поиск по обозначению, названию..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="flex-grow overflow-auto border border-slate-200 rounded-md">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Обозначение</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Название</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Статус</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Замена</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {filteredRegulations.length > 0 ? filteredRegulations.map(reg => (
                            <tr key={reg.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800">{reg.designation}</td>
                                <td className="px-6 py-4 text-sm text-slate-600 min-w-[300px]">
                                    <div className="whitespace-normal line-clamp-2" title={reg.title}>{reg.title}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(reg.status)}`}>
                                        {reg.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                    {reg.replacement ? (
                                        <span className="text-red-600 font-medium">{reg.replacement}</span>
                                    ) : '-'}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="text-center py-16 text-slate-500">
                                    {regulations.length === 0 ? (
                                        <div className="flex flex-col items-center">
                                            <BookIcon className="w-12 h-12 mb-2 text-slate-300" />
                                            <p>База нормативов пуста.</p>
                                            <p className="text-sm">Загрузите JSON файл, чтобы начать работу.</p>
                                        </div>
                                    ) : (
                                        <p>Ничего не найдено по запросу "{searchTerm}"</p>
                                    )}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
             <div className="mt-2 text-xs text-slate-500 text-right">
                Всего документов: {regulations.length}
            </div>
        </div>
    );
};

export default RegulationsPage;
