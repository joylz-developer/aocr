import React, { useState, useEffect } from 'react';
import { Act, Person, Organization, ROLES, ProjectSettings } from '../types';
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
    const [formData, setFormData] = useState<Act>(
        act || {
            id: crypto.randomUUID(),
            number: '', date: '', objectName: settings.objectName, builderDetails: '', contractorDetails: '',
            designerDetails: '', workPerformer: '', workName: '', projectDocs: '', materials: '',
            certs: '', workStartDate: '', workEndDate: '', regulations: '', nextWork: '',
            additionalInfo: '', copiesCount: String(settings.defaultCopiesCount), attachments: '', representatives: {},
        }
    );
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [showOtherReps, setShowOtherReps] = useState(false);
    const [confirmation, setConfirmation] = useState<{ message: string; onConfirm: () => void } | null>(null);
    const [suppressWarning, setSuppressWarning] = useState(false);
    
    // FIX: Switched from `import.meta.env.VITE_API_KEY` to `process.env.API_KEY` to follow Gemini API guidelines and resolve TypeScript errors.
    const ai = process.env.API_KEY ? new GoogleGenAI({apiKey: process.env.API_KEY}) : null;

    // Effect to auto-update attachments from materials and certs
    useEffect(() => {
        const combined = [formData.materials, formData.certs].filter(Boolean).join('\n\n');
        if (combined !== formData.attachments) {
            setFormData(prev => ({ ...prev, attachments: combined }));
        }
    }, [formData.materials, formData.certs]);

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
        // If "show other reps" is unchecked, clear their values
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

    const handleRepChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            representatives: { ...prev.representatives, [name]: value }
        }));
    };
    
    const handleAiFill = async () => {
        if (!ai) {
             setAiError("API-ключ для Gemini не настроен.");
             return;
        }
        if (!formData.workName) {
            alert("Пожалуйста, сначала заполните пункт 1 'Работы, подлежащие освидетельствованию'.");
            return;
        }

        setIsAiLoading(true);
        setAiError(null);
        try {
            const prompt = `На основе следующего наименования работ: "${formData.workName}", предложи список нормативных документов (СП, ГОСТ), в соответствии с которыми эти работы должны выполняться.
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
            setAiError("Не удалось получить данные от AI. Попробуйте снова.");
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const requiredFields: { key: keyof Act, label: string }[] = [
            { key: 'number', label: 'Номер акта' },
            { key: 'workName', label: 'Работы, подлежащие освидетельствованию' },
            { key: 'projectDocs', label: 'Проектная документация' },
            { key: 'materials', label: 'Примененные материалы' },
            { key: 'certs', label: 'Предъявлены документы' },
            { key: 'workStartDate', label: 'Дата начала работ' },
            { key: 'workEndDate', label: 'Дата окончания работ' },
            { key: 'regulations', label: 'Нормативные документы' },
            { key: 'nextWork', label: 'Разрешается производство следующих работ' },
        ];
        
        const missingFields = requiredFields.filter(f => !(formData[f.key] as string)?.trim());

        const warningSuppressedUntil = localStorage.getItem('suppressActWarningUntil');
        const isSuppressed = warningSuppressedUntil && new Date().getTime() < parseInt(warningSuppressedUntil, 10);

        if (missingFields.length > 0 && !isSuppressed) {
            const message = `Акт будет создан, но следующие поля не заполнены:\n\n- ${missingFields.map(f => f.label).join('\n- ')}\n\nПродолжить?`;
            
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

            {renderSection("Информация о работах", <>
                <div className="md:col-span-2">
                    <label className={labelClass}>1. Работы, подлежащие освидетельствованию</label>
                    <textarea name="workName" value={formData.workName} onChange={handleChange} className={textareaClass} rows={3} />
                </div>
                <div className="md:col-span-2">
                    <label className={labelClass}>2. Проектная документация</label>
                    <textarea name="projectDocs" value={formData.projectDocs} onChange={handleChange} className={textareaClass} rows={2} />
                </div>
                <div className="md:col-span-2">
                    <label className={labelClass}>3. Примененные материалы</label>
                    <textarea name="materials" value={formData.materials} onChange={handleChange} className={textareaClass} rows={2} />
                </div>
                <div className="md:col-span-2">
                    <label className={labelClass}>4. Предъявлены документы</label>
                    <textarea name="certs" value={formData.certs} onChange={handleChange} className={textareaClass} rows={2} />
                </div>
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
                        <button type="button" onClick={handleAiFill} disabled={isAiLoading || !ai || !formData.workName} className="mt-1 flex-shrink-0 flex justify-center items-center gap-2 px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" title="Заполнить с помощью Gemini">
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
                 <div>
                    <label className={labelClass}>Количество экземпляров</label>
                    <input type="number" name="copiesCount" value={formData.copiesCount} onChange={handleChange} className={inputClass} min="1" />
                </div>
                {settings.showAttachments && <div className="md:col-span-2">
                    <label className={labelClass}>Приложения</label>
                    <textarea 
                        name="attachments" 
                        value={formData.attachments} 
                        readOnly
                        className={readOnlyTextareaClass}
                        rows={3} 
                    />
                    <p className="text-xs text-slate-500 mt-1">Это поле заполняется автоматически на основе пунктов 3 и 4.</p>
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
                                <td className="px-6 py-4 text-sm text-slate-600 max-w-md truncate" title={act.workName}>{act.workName}</td>
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
                    <p>Теги для основной информации об акте:</p>
                    <ul className="list-disc space-y-2 pl-5 mt-2">
                        <li><CopyableTag tag="{object_name}" /> &mdash; Наименование объекта (из настроек проекта).</li>
                        <li><CopyableTag tag="{act_number}" /> &mdash; Номер акта.</li>
                        <li><CopyableTag tag="{act_day}" />, <CopyableTag tag="{act_month}" />, <CopyableTag tag="{act_year}" /> &mdash; Дата составления акта (день, месяц, год).</li>
                        <li><CopyableTag tag="{builder_details}" /> &mdash; Реквизиты застройщика (технического заказчика).</li>
                        <li><CopyableTag tag="{contractor_details}" /> &mdash; Реквизиты лица, осуществляющего строительство.</li>
                        <li><CopyableTag tag="{designer_details}" /> &mdash; Реквизиты проектировщика.</li>
                        <li><CopyableTag tag="{work_performer}" /> &mdash; Реквизиты исполнителя работ.</li>
                        <li><CopyableTag tag="{work_name}" /> &mdash; Наименование работ, подлежащих освидетельствованию.</li>
                        <li><CopyableTag tag="{project_docs}" /> &mdash; Проектная документация.</li>
                        <li><CopyableTag tag="{materials}" /> &mdash; Примененные материалы.</li>
                        <li><CopyableTag tag="{certs}" /> &mdash; Предъявленные документы (сертификаты, паспорта).</li>
                        <li><CopyableTag tag="{work_start_day}" />, <CopyableTag tag="{work_start_month}" />, <CopyableTag tag="{work_start_year}" /> &mdash; Дата начала работ.</li>
                        <li><CopyableTag tag="{work_end_day}" />, <CopyableTag tag="{work_end_month}" />, <CopyableTag tag="{work_end_year}" /> &mdash; Дата окончания работ.</li>
                        <li><CopyableTag tag="{regulations}" /> &mdash; Нормативные документы (СП, ГОСТ).</li>
                        <li><CopyableTag tag="{next_work}" /> &mdash; Разрешается производство следующих работ.</li>
                        <li><CopyableTag tag="{additional_info}" /> &mdash; Дополнительные сведения.</li>
                        <li><CopyableTag tag="{copies_count}" /> &mdash; Количество экземпляров акта.</li>
                        <li><CopyableTag tag="{attachments}" /> &mdash; Приложения к акту.</li>
                    </ul>

                    <h4 className="font-semibold mt-4">Представители (Комиссия)</h4>
                     <div className="my-2 p-3 rounded-md bg-blue-50 border border-blue-200">
                        <h5 className="font-semibold text-blue-800">✨ Условное отображение</h5>
                        <p className="text-sm mt-1">Теперь вы можете использовать <strong>условные блоки</strong>, чтобы скрыть целые разделы (включая пустые строки), если представитель не был выбран. Для этого оберните нужный текст в теги <code>{`{#ключ}...{/ключ}`}</code>.</p>
                        <p className="text-sm mt-1"><strong>Пример:</strong> Блок ниже появится, только если выбран "Представитель иной организации (1)":</p>
                        <pre className="bg-slate-200 p-2 rounded mt-2 text-xs"><code>{`{#i1}
Представитель иной организации: {i1.position}, {i1.name}{/i1}`}</code></pre>
                    </div>

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
                        <li><CopyableTag tag="{tnz.name}" />: ФИО представителя.</li>
                        <li><CopyableTag tag="{tnz.position}" />: Должность.</li>
                        <li><CopyableTag tag="{tnz.org}" />: Организация.</li>
                        <li><CopyableTag tag="{tnz.auth_doc}" />: Документ о полномочиях.</li>
                        <li><CopyableTag tag="{tnz.details}" />: Сводная строка (должность, ФИО, документ).</li>
                    </ul>
                </div>
            </Modal>
        </div>
    );
};

export default ActsPage;