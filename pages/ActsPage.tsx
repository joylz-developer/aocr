import React, { useState, useEffect } from 'react';
import { Act, Person, Organization, ROLES, ProjectSettings, WorkItem } from '../types';
import Modal from '../components/Modal';
import { PlusIcon, EditIcon, DeleteIcon, DownloadIcon, HelpIcon } from '../components/Icons';
import { generateDocument } from '../services/docGenerator';
import { GoogleGenAI } from "@google/genai";

interface ActsPageProps {
    acts: Act[];
    people: Person[];
    organizations: Organization[];
    template: string | null;
    settings: ProjectSettings;
    onSave: (act: Act) => void;
    onDelete: (id: string) => void;
}

const formatOrganizationDetails = (org: Organization): string => {
    const parts = [
        org.name,
        `ОГРН ${org.ogrn}`,
        `ИНН ${org.inn}`,
    ];
    if (org.kpp) parts.push(`КПП ${org.kpp}`);
    parts.push(org.address);
    if (org.phone) parts.push(`тел. ${org.phone}`);
    if (org.sro) parts.push(`СРО: ${org.sro}`);
    return parts.join(', ');
};

const ConfirmationModal: React.FC<{
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    suppress: boolean;
    onSuppressChange: (value: boolean) => void;
}> = ({ message, onConfirm, onCancel, suppress, onSuppressChange }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex justify-center items-center">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">Подтверждение</h3>
            <p className="text-slate-600 whitespace-pre-wrap mb-6">{message}</p>
            <div className="mb-6">
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="suppressWarning"
                        checked={suppress}
                        onChange={(e) => onSuppressChange(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="suppressWarning" className="ml-2 text-sm font-medium text-slate-700">
                        Не показывать это уведомление в течение 1 часа
                    </label>
                </div>
            </div>
            <div className="flex justify-end space-x-3">
                <button type="button" onClick={onCancel} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">Отмена</button>
                <button type="button" onClick={onConfirm} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Создать</button>
            </div>
        </div>
    </div>
);


const ActForm: React.FC<{
    act: Act | null;
    people: Person[];
    organizations: Organization[];
    settings: ProjectSettings;
    onSave: (act: Act) => void;
    onClose: () => void;
}> = ({ act, people, organizations, settings, onSave, onClose }) => {
    const [formData, setFormData] = useState<Act>(() => {
        const initialAct = act || {
            id: crypto.randomUUID(),
            number: '', date: '', objectName: settings.objectName, builderDetails: '', contractorDetails: '',
            designerDetails: '', workPerformer: '', workItems: [], workStartDate: '', workEndDate: '', 
            regulations: '', nextWork: '', additionalInfo: '', 
            copiesCount: String(settings.defaultCopiesCount), attachments: '', representatives: {},
        };
        
        // Backward compatibility: migrate old data structure to new workItems table
        if (act && !act.workItems && (act as any).workName) {
            const legacyAct = act as any;
            initialAct.workItems = [{
                id: crypto.randomUUID(),
                name: legacyAct.workName || '',
                projectDocs: legacyAct.projectDocs || '',
                materials: legacyAct.materials || '',
                certs: legacyAct.certs || '',
                notes: '',
            }];
        } else if (!initialAct.workItems || initialAct.workItems.length === 0) {
            // Ensure there's at least one empty row for new acts
            initialAct.workItems = [{ id: crypto.randomUUID(), name: '', projectDocs: '', materials: '', certs: '', notes: '' }];
        }
        return initialAct;
    });

    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [showOtherReps, setShowOtherReps] = useState(false);
    const [confirmation, setConfirmation] = useState<{ message: string; onConfirm: () => void } | null>(null);
    const [suppressWarning, setSuppressWarning] = useState(false);
    
    const ai = settings.geminiApiKey ? new GoogleGenAI({ apiKey: settings.geminiApiKey }) : null;

    const availableColumns: { key: keyof WorkItem, label: string }[] = [
        { key: 'name', label: '1. Наименование работ' },
        { key: 'projectDocs', label: '2. Проектная документация' },
        { key: 'materials', label: '3. Примененные материалы' },
        { key: 'certs', label: '4. Документы о качестве' },
        { key: 'notes', label: 'Примечания' },
    ];

    const visibleColumns = availableColumns.filter(c => settings.visibleWorkItemColumns?.includes(c.key));

    // Effect to auto-update attachments from workItems
    useEffect(() => {
        const materials = formData.workItems.map(item => item.materials).filter(Boolean).join('\n');
        const certs = formData.workItems.map(item => item.certs).filter(Boolean).join('\n');
        const combined = [materials, certs].filter(Boolean).join('\n\n');

        if (combined !== formData.attachments) {
            setFormData(prev => ({ ...prev, attachments: combined }));
        }
    }, [formData.workItems]);

    // Effect to sync act date with work end date
    useEffect(() => {
        if (formData.workEndDate && formData.date !== formData.workEndDate) {
            setFormData(prev => ({ ...prev, date: prev.workEndDate }));
        }
    }, [formData.workEndDate]);
    
    // Effect to derive organization details from representatives
    useEffect(() => {
        const roleToFieldMapping: { [key: string]: keyof Act } = {
            tnz: 'builderDetails',
            g: 'contractorDetails',
            pr: 'designerDetails',
            pd: 'workPerformer',
        };

        const newDetails: Partial<Act> = {};
        let changed = false;

        for (const role in roleToFieldMapping) {
            const personId = formData.representatives[role];
            const field = roleToFieldMapping[role] as keyof Pick<Act, 'builderDetails'|'contractorDetails'|'designerDetails'|'workPerformer'>;
            let detailString = '';

            if (personId) {
                const person = people.find(p => p.id === personId);
                if (person) {
                    const org = organizations.find(o => o.name === person.organization);
                    if (org) {
                        detailString = settings.useShortOrgNames ? org.name : formatOrganizationDetails(org);
                    }
                }
            }
            
            if (formData[field] !== detailString) {
               newDetails[field] = detailString;
               changed = true;
            }
        }

        if (changed) {
            setFormData(prev => ({ ...prev, ...newDetails }));
        }

    }, [formData.representatives, people, organizations, settings.useShortOrgNames]);

    useEffect(() => {
        if (!showOtherReps) {
            const newReps = { ...formData.representatives };
            let changed = false;
            ['i1', 'i2', 'i3'].forEach(key => {
                if (newReps[key]) {
                    delete newReps[key];
                    changed = true;
                }
            });
            if (changed) {
                setFormData(prev => ({ ...prev, representatives: newReps }));
            }
        }
    }, [showOtherReps]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleWorkItemChange = (index: number, field: keyof WorkItem, value: string) => {
        const newWorkItems = [...formData.workItems];
        newWorkItems[index] = { ...newWorkItems[index], [field]: value };
        setFormData(prev => ({ ...prev, workItems: newWorkItems }));
    };

    const handleAddWorkItem = () => {
        setFormData(prev => ({
            ...prev,
            workItems: [...prev.workItems, { id: crypto.randomUUID(), name: '', projectDocs: '', materials: '', certs: '', notes: '' }]
        }));
    };

    const handleRemoveWorkItem = (index: number) => {
        if (formData.workItems.length <= 1) {
            alert("Нельзя удалить последнюю строку.");
            return;
        }
        const newWorkItems = formData.workItems.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, workItems: newWorkItems }));
    };


    const handleRepChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            representatives: { ...prev.representatives, [name]: value }
        }));
    };
    
    const handleAiFill = async () => {
        if (!ai) {
             setAiError("API-ключ для Gemini не настроен. Пожалуйста, добавьте его в Настройках.");
             return;
        }
        
        const workNames = formData.workItems.map(item => item.name).filter(Boolean).join('; ');
        if (!workNames) {
            alert("Пожалуйста, заполните наименования работ в таблице 'Выполненные работы'.");
            return;
        }

        setIsAiLoading(true);
        setAiError(null);
        try {
            const prompt = `На основе следующего списка работ: "${workNames}", предложи список нормативных документов (СП, ГОСТ), в соответствии с которыми эти работы должны выполняться.
            Верни результат в формате JSON с одним ключом "regulations".
            
            Пример ответа:
            {
              "regulations": "СП 70.13330.2012 'Несущие и ограждающие конструкции'. СП 63.13330.2018 'Бетонные и желебетонные конструкции. Основные положения'."
            }
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                }
            });
            const text = response.text;
            const result = JSON.parse(text);
            
            if (result.regulations) {
                 setFormData(prev => ({
                    ...prev,
                    regulations: result.regulations
                }));
            }
        } catch (error) {
            console.error("AI fill error:", error);
            setAiError("Не удалось получить данные от AI. Проверьте API ключ и попробуйте снова.");
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const requiredFields: { key: keyof Act | 'workItems', label: string }[] = [
            { key: 'number', label: 'Номер акта' },
            { key: 'workItems', label: 'Таблица "Выполненные работы"' },
            { key: 'workStartDate', label: 'Дата начала работ' },
            { key: 'workEndDate', label: 'Дата окончания работ' },
            { key: 'regulations', label: 'Нормативные документы' },
            { key: 'nextWork', label: 'Разрешается производство следующих работ' },
        ];
        
        const missingFields = requiredFields.filter(f => {
            if (f.key === 'workItems') {
                return formData.workItems.length === 0 || formData.workItems.every(item => !item.name.trim());
            }
            return !(formData[f.key as keyof Act] as string)?.trim()
        });

        const warningSuppressedUntil = localStorage.getItem('suppressActWarningUntil');
        const isSuppressed = warningSuppressedUntil && new Date().getTime() < parseInt(warningSuppressedUntil, 10);

        if (missingFields.length > 0 && !isSuppressed) {
            const message = `Акт будет создан, но следующие поля/разделы не заполнены:\n\n- ${missingFields.map(f => f.label).join('\n- ')}\n\nПродолжить?`;
            
            setConfirmation({
                message,
                onConfirm: () => {
                    if (suppressWarning) {
                        const oneHour = new Date().getTime() + 60 * 60 * 1000;
                        localStorage.setItem('suppressActWarningUntil', oneHour.toString());
                    }
                    onSave(formData);
                    onClose();
                }
            });
        } else {
            onSave(formData);
            onClose();
        }
    };

    const inputClass = "mt-1 block w-full bg-white border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-slate-900";
    const selectClass = inputClass + " bg-white";
    const textareaClass = inputClass;
    const labelClass = "block text-sm font-medium text-slate-700";
    const readOnlyTextareaClass = textareaClass + " bg-slate-100 cursor-not-allowed";
    const tableTextareaClass = "w-full p-2 border-none focus:ring-1 focus:ring-blue-500 focus:outline-none bg-transparent resize-none h-full";


    const renderSection = (title: string, children: React.ReactNode) => (
        <div className="border border-slate-200 rounded-md p-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {children}
            </div>
        </div>
    );

    return (
        <>
        {confirmation && (
            <ConfirmationModal
                message={confirmation.message}
                onConfirm={confirmation.onConfirm}
                onCancel={() => setConfirmation(null)}
                suppress={suppressWarning}
                onSuppressChange={setSuppressWarning}
            />
        )}
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto pr-4">
            <div className="p-4 rounded-md bg-blue-50 border border-blue-200">
                <p className="text-sm text-slate-700"><span className="font-semibold">Объект:</span> {settings.objectName || "не указан в настройках"}</p>
            </div>

            {renderSection("Основная информация", <>
                <div>
                    <label className={labelClass}>Номер акта</label>
                    <input type="text" name="number" value={formData.number} onChange={handleChange} className={inputClass} />
                </div>
                 {settings.showActDate && <div>
                    <label className={labelClass}>Дата акта (авто)</label>
                    <input type="date" name="date" value={formData.date} className={inputClass + " bg-slate-100"} readOnly />
                </div>}
            </>)}

            {/* NEW WORK ITEMS TABLE */}
             <div className="border border-slate-200 rounded-md p-4">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Выполненные работы</h3>
                 <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse border border-slate-300">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="border border-slate-300 px-2 py-2 text-left text-sm font-medium text-slate-600 w-12">№</th>
                                {visibleColumns.map(col => (
                                    <th key={col.key} className="border border-slate-300 px-2 py-2 text-left text-sm font-medium text-slate-600">{col.label}</th>
                                ))}
                                <th className="border border-slate-300 px-2 py-2 text-center text-sm font-medium text-slate-600 w-16">...</th>
                            </tr>
                        </thead>
                        <tbody>
                            {formData.workItems.map((item, index) => (
                                <tr key={item.id} className="group hover:bg-slate-50">
                                    <td className="border border-slate-300 px-2 py-1 text-center text-sm text-slate-500">{index + 1}</td>
                                    {visibleColumns.map(col => (
                                         <td key={col.key} className="border border-slate-300 p-0 align-top">
                                            <textarea
                                                value={item[col.key]}
                                                onChange={(e) => handleWorkItemChange(index, col.key, e.target.value)}
                                                className={tableTextareaClass}
                                                rows={2}
                                            />
                                         </td>
                                    ))}
                                    <td className="border border-slate-300 px-2 py-1 text-center align-middle">
                                        <button type="button" onClick={() => handleRemoveWorkItem(index)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Удалить строку">
                                            <DeleteIcon />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4">
                    <button type="button" onClick={handleAddWorkItem} className="flex items-center text-sm text-blue-600 font-medium hover:text-blue-800">
                        <PlusIcon /> Добавить строку
                    </button>
                </div>
            </div>

            {renderSection("Информация о работах (продолжение)", <>
                 <div className="md:col-span-2">
                    <label className={labelClass}>5. Даты производства работ</label>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                        <div>
                             <label htmlFor="workStartDate" className="text-sm text-slate-600">Начало работ</label>
                            <input id="workStartDate" type="date" name="workStartDate" value={formData.workStartDate} onChange={handleChange} className={inputClass} />
                        </div>
                        <div>
                            <label htmlFor="workEndDate" className="text-sm text-slate-600">Окончание работ</label>
                            <input id="workEndDate" type="date" name="workEndDate" value={formData.workEndDate} onChange={handleChange} className={inputClass} />
                        </div>
                     </div>
                </div>
                <div className="md:col-span-2">
                    <label className={labelClass}>6. Работы выполнены в соответствии с</label>
                    <div className="flex items-start gap-2">
                        <textarea name="regulations" value={formData.regulations} onChange={handleChange} className={textareaClass} rows={2} style={{flexGrow: 1}}/>
                        <button type="button" onClick={handleAiFill} disabled={isAiLoading || !ai} className="mt-1 flex-shrink-0 flex justify-center items-center gap-2 px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" title={ai ? "Заполнить с помощью Gemini" : "Введите API ключ в Настройках, чтобы включить эту функцию"}>
                             ✨
                        </button>
                    </div>
                    {aiError && <p className="text-red-500 text-sm mt-1 text-center">{aiError}</p>}
                </div>
                 <div className="md:col-span-2">
                    <label className={labelClass}>7. Разрешается производство следующих работ</label>
                    <textarea name="nextWork" value={formData.nextWork} onChange={handleChange} className={textareaClass} rows={2} />
                </div>
            </>)}

            {settings.showParticipantDetails && renderSection("Реквизиты участников (авто)", <>
                <div>
                    <label className={labelClass}>Застройщик (Тех. заказчик)</label>
                    <textarea value={formData.builderDetails} className={readOnlyTextareaClass} readOnly rows={4} />
                </div>
                 <div>
                    <label className={labelClass}>Лицо, осуществляющее строительство</label>
                    <textarea value={formData.contractorDetails} className={readOnlyTextareaClass} readOnly rows={4} />
                </div>
                 <div>
                    <label className={labelClass}>Проектировщик</label>
                    <textarea value={formData.designerDetails} className={readOnlyTextareaClass} readOnly rows={4} />
                </div>
                 <div>
                    <label className={labelClass}>Исполнитель работ</label>
                    <textarea value={formData.workPerformer} className={readOnlyTextareaClass} readOnly rows={4} />
                </div>
            </>)}
            
            {renderSection("Представители (комиссия)", 
                <>
                {Object.entries(ROLES).filter(([key]) => !['i1','i2','i3'].includes(key)).map(([key, description]) => (
                    <div key={key}>
                        <label className={labelClass}>{description}</label>
                        <select name={key} value={formData.representatives[key] || ''} onChange={handleRepChange} className={selectClass}>
                            <option value="">Не выбрано</option>
                            {people.map(p => <option key={p.id} value={p.id}>{p.name}, {p.position}</option>)}
                        </select>
                    </div>
                ))}
                 <div className="md:col-span-2 border-t pt-4 mt-2">
                     <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="showOtherReps"
                            checked={showOtherReps}
                            onChange={(e) => setShowOtherReps(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="showOtherReps" className="ml-2 text-sm font-medium text-slate-700">
                           Добавить представителей иных организаций
                        </label>
                    </div>
                </div>
                {showOtherReps && Object.entries(ROLES).filter(([key]) => ['i1','i2','i3'].includes(key)).map(([key, description]) => (
                     <div key={key}>
                        <label className={labelClass}>{description}</label>
                        <select name={key} value={formData.representatives[key] || ''} onChange={handleRepChange} className={selectClass}>
                            <option value="">Не выбрано</option>
                            {people.map(p => <option key={p.id} value={p.id}>{p.name}, {p.position}</option>)}
                        </select>
                    </div>
                ))}
                </>
            )}

            {renderSection("Дополнительная информация", <>
                {settings.showAdditionalInfo && <div className="md:col-span-2">
                    <label className={labelClass}>Дополнительные сведения</label>
                    <textarea name="additionalInfo" value={formData.additionalInfo} onChange={handleChange} className={textareaClass} rows={2} />
                </div>}
                {settings.showCopiesCount && (
                     <div>
                        <label className={labelClass}>Количество экземпляров</label>
                        <input type="number" name="copiesCount" value={formData.copiesCount} onChange={handleChange} className={inputClass} min="1" />
                    </div>
                )}
                {settings.showAttachments && <div className="md:col-span-2">
                    <label className={labelClass}>Приложения</label>
                    <textarea 
                        name="attachments" 
                        value={formData.attachments} 
                        readOnly
                        className={readOnlyTextareaClass}
                        rows={3} 
                    />
                    <p className="text-xs text-slate-500 mt-1">Это поле заполняется автоматически на основе таблицы работ.</p>
                </div>}
            </>)}

            <div className="flex justify-end space-x-3 pt-4 sticky bottom-0 bg-white py-4">
                <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">Отмена</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Сохранить</button>
            </div>
        </form>
        </>
    );
};

// Helper component for interactive tags in the help modal
const CopyableTag: React.FC<{ tag: string }> = ({ tag }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(tag);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500); // Reset after 1.5 seconds
    };

    return (
        <code
            onClick={handleCopy}
            className="bg-slate-200 text-blue-700 px-1.5 py-0.5 rounded-md cursor-pointer hover:bg-blue-200 transition-colors font-mono"
            title="Нажмите, чтобы скопировать"
        >
            {copied ? 'Скопировано!' : tag}
        </code>
    );
};


const ActsPage: React.FC<ActsPageProps> = ({ acts, people, organizations, template, settings, onSave, onDelete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAct, setEditingAct] = useState<Act | null>(null);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

    const handleOpenModal = (act: Act | null = null) => {
        setEditingAct(act);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingAct(null);
        setIsModalOpen(false);
    };

    const handleDelete = (id: string) => {
        onDelete(id);
    };
    
    const handleGenerate = (act: Act) => {
        if (!template) {
            alert('Шаблон не загружен. Пожалуйста, сначала загрузите шаблон.');
            return;
        }
        generateDocument(template, act, people);
    };
    
    // Get the first work name for display in the list
    const getActTitle = (act: Act): string => {
        if (act.workItems && act.workItems.length > 0 && act.workItems[0].name) {
            return act.workItems[0].name;
        }
        return act.workName || '(Без наименования)'; // Fallback for old data
    }


    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Акты скрытых работ</h1>
                    <button onClick={() => setIsHelpModalOpen(true)} className="text-slate-500 hover:text-blue-600" title="Справка">
                        <HelpIcon />
                    </button>
                </div>
                <button onClick={() => handleOpenModal()} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    <PlusIcon /> Создать акт
                </button>
            </div>

            <div className="overflow-x-auto">
                 <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Номер</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Дата</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Наименование работ</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {acts.length > 0 ? acts.map(act => (
                            <tr key={act.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{act.number}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{new Date(act.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-sm text-slate-600 max-w-md truncate" title={getActTitle(act)}>{getActTitle(act)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end space-x-2">
                                        <button 
                                            onClick={() => handleGenerate(act)} 
                                            className="p-2 rounded-full transition-colors text-green-600 hover:text-green-800 hover:bg-green-100"
                                            title="Скачать .docx"
                                        >
                                            <DownloadIcon />
                                        </button>
                                        <button onClick={() => handleOpenModal(act)} className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full" title="Редактировать"><EditIcon /></button>
                                        <button onClick={() => handleDelete(act.id)} className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full" title="Удалить"><DeleteIcon /></button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="text-center py-10 text-slate-500">
                                    Пока нет ни одного акта.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingAct ? 'Редактировать акт' : 'Новый акт'}>
                <ActForm
                    act={editingAct}
                    people={people}
                    organizations={organizations}
                    settings={settings}
                    onSave={onSave}
                    onClose={handleCloseModal}
                />
            </Modal>
            
            <Modal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} title="Справка по заполнению шаблона">
                <div className="prose max-w-none text-slate-700">
                    <p>Для генерации документов ваш .docx шаблон должен содержать теги-заполнители. Приложение заменит эти теги на данные из формы. Нажмите на любой тег ниже, чтобы скопировать его.</p>
                    
                    <h4 className="font-semibold mt-4">Основные теги</h4>
                     <ul className="list-disc space-y-2 pl-5 mt-2">
                        <li><CopyableTag tag="{object_name}" /> &mdash; Наименование объекта.</li>
                        <li><CopyableTag tag="{act_number}" />, <CopyableTag tag="{act_day}" />, <CopyableTag tag="{act_month}" />, <CopyableTag tag="{act_year}" /></li>
                        <li><CopyableTag tag="{builder_details}" />, <CopyableTag tag="{contractor_details}" />, <CopyableTag tag="{designer_details}" />, <CopyableTag tag="{work_performer}" /></li>
                        <li><CopyableTag tag="{work_start_day}" />, <CopyableTag tag="{work_start_month}" />, <CopyableTag tag="{work_start_year}" /> &mdash; Дата начала работ.</li>
                        <li><CopyableTag tag="{work_end_day}" />, <CopyableTag tag="{work_end_month}" />, <CopyableTag tag="{work_end_year}" /> &mdash; Дата окончания работ.</li>
                        <li><CopyableTag tag="{regulations}" /> &mdash; Нормативные документы.</li>
                        <li><CopyableTag tag="{next_work}" /> &mdash; Разрешается производство следующих работ.</li>
                        <li><CopyableTag tag="{additional_info}" />, <CopyableTag tag="{copies_count}" />, <CopyableTag tag="{attachments}" /></li>
                    </ul>
                    
                     <h4 className="font-semibold mt-6">Таблица работ (Новый синтаксис)</h4>
                    <div className="my-2 p-3 rounded-md bg-blue-50 border border-blue-200">
                        <p className="text-sm mt-1">Для вставки данных о выполненных работах используется **цикл**. Это позволяет автоматически создавать столько строк в таблице вашего документа, сколько вы добавили в форме.</p>
                    </div>
                    <p>В вашем шаблоне .docx создайте таблицу. В первой ячейке первой строки таблицы, предназначенной для данных, поставьте тег начала цикла <CopyableTag tag="{#work_items}" />. В последней ячейке этой же строки поставьте тег конца цикла <CopyableTag tag="{/work_items}" />. Между этими тегами размещайте теги для данных строки.</p>
                    <p className="font-medium mt-2">Пример для строки таблицы в Word:</p>
                    <pre className="bg-slate-200 p-2 rounded mt-2 text-xs whitespace-pre-wrap"><code>{`| {#work_items}{num} | {name} | {project_docs} | {materials} | {certs} | {notes}{/work_items} |`}</code></pre>
                    <p className="mt-3">Доступные теги внутри цикла <CopyableTag tag="{#work_items}" />:</p>
                    <ul className="list-disc space-y-1 pl-5">
                        <li><CopyableTag tag="{num}" /> &mdash; Порядковый номер строки.</li>
                        <li><CopyableTag tag="{name}" /> &mdash; Наименование работ.</li>
                        <li><CopyableTag tag="{project_docs}" /> &mdash; Проектная документация.</li>
                        <li><CopyableTag tag="{materials}" /> &mdash; Примененные материалы.</li>
                        <li><CopyableTag tag="{certs}" /> &mdash; Документы о качестве (сертификаты, паспорта).</li>
                        <li><CopyableTag tag="{notes}" /> &mdash; Примечания.</li>
                    </ul>

                    <h4 className="font-semibold mt-6">Представители (Комиссия)</h4>
                     <div className="my-2 p-3 rounded-md bg-blue-50 border border-blue-200">
                        <h5 className="font-semibold text-blue-800">✨ Важное обновление синтаксиса</h5>
                        <p className="text-sm mt-1">Для вставки данных представителей теперь рекомендуется использовать синтаксис с подчеркиванием, например <CopyableTag tag="{tnz_name}" />. Этот формат более надежен.</p>
                    </div>

                     <p className="mt-2">Используйте <strong>условные блоки</strong>, чтобы скрыть строки, если представитель не выбран. Для этого оберните нужный текст в теги <code>{`{#ключ}...{/ключ}`}</code>, где "ключ" - это код роли (например, <code>tnz</code>).</p>

                     <p className="mt-2 font-medium">Расшифровка ключей ролей:</p>
                     <ul className="list-disc space-y-2 pl-5 mt-2">
                         {Object.entries(ROLES).map(([key, description]) => (
                            <li key={key}>
                                <CopyableTag tag={key} /> &mdash; {description}
                            </li>
                         ))}
                    </ul>
                    <p className="mt-3">Полный список тегов для представителя (замените <strong>tnz</strong> на нужный ключ из списка выше):</p>
                    <ul className="list-disc space-y-1 pl-5">
                        <li><CopyableTag tag="{tnz_name}" />: ФИО, <CopyableTag tag="{tnz_position}" />: Должность, <CopyableTag tag="{tnz_org}" />: Организация, <CopyableTag tag="{tnz_auth_doc}" />: Документ, <CopyableTag tag="{tnz_details}" />: Сводная строка.</li>
                    </ul>
                </div>
            </Modal>
        </div>
    );
};

export default ActsPage;