
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Act, Person, Organization, ImportSettings, ImportData, ProjectSettings, CommissionGroup, Page, DeletedActEntry, Regulation, Certificate, Theme, DeletedCertificateEntry, ExportSettings, CertificateFile, ConstructionObject } from './types';
import TemplateUploader from './components/TemplateUploader';
import ImportModal from './components/ImportModal';
import ExportModal from './components/ExportModal';
import ConfirmationModal from './components/ConfirmationModal';
import RestoreGroupConfirmationModal from './components/RestoreGroupConfirmationModal';
import ActsPage from './pages/ActsPage';
import PeoplePage from './pages/PeoplePage';
import OrganizationsPage from './pages/OrganizationsPage';
import SettingsPage from './pages/SettingsPage';
import GroupsPage from './pages/GroupsPage';
import TrashPage from './pages/TrashPage';
import RegulationsPage from './pages/RegulationsPage';
import CertificatesPage from './pages/CertificatesPage';
import ObjectsPage from './pages/ObjectsPage';
import Sidebar from './components/Sidebar';
import { saveAs } from 'file-saver';
import PizZip from 'pizzip';
import { CheckIcon } from './components/Icons';

const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                // Return only the base64 part
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error('Failed to read file as base64 string.'));
            }
        };
        reader.onerror = (error) => reject(error);
    });

const base64ToBlob = (base64: string, mimeType: string = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'): Blob => {
    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: mimeType });
};

// Helper to reconstruct Base64 from binary string (PizZip output)
const binaryStringToBase64 = (binary: string): string => {
    return window.btoa(binary);
};

const DEFAULT_PROMPT_NUMBER = "Тип документа (обязательно укажи 'Паспорт качества', 'Сертификат соответствия' или другой тип) + Номер документа. Пример: 'Паспорт качества № 123'";
const DEFAULT_PROMPT_DATE = "Дата выдачи/составления документа (НЕ дата окончания).";
const DEFAULT_PROMPT_MATERIALS = "Точное наименование продукции, марки, типы и размеры (например, 'Бетон B25 W6').";

const ToastNotification: React.FC<{ message: string | null; onClose: () => void }> = ({ message, onClose }) => {
    useEffect(() => {
        if (message) {
            const timer = setTimeout(onClose, 3000);
            return () => clearTimeout(timer);
        }
    }, [message, onClose]);

    if (!message) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
            <div className="bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
                <div className="bg-green-500 rounded-full p-1">
                    <CheckIcon className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-medium">{message}</span>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    const [template, setTemplate] = useLocalStorage<string | null>('docx_template', null);
    const [registryTemplate, setRegistryTemplate] = useLocalStorage<string | null>('docx_registry_template', null);
    
    // Core Data
    const [constructionObjects, setConstructionObjects] = useLocalStorage<ConstructionObject[]>('construction_objects', []);
    const [currentObjectId, setCurrentObjectId] = useLocalStorage<string | null>('current_construction_object_id', null);

    const [acts, setActs] = useLocalStorage<Act[]>('acts_data', []);
    const [deletedActs, setDeletedActs] = useLocalStorage<DeletedActEntry[]>('deleted_acts', []);
    const [people, setPeople] = useLocalStorage<Person[]>('people_data', []);
    const [organizations, setOrganizations] = useLocalStorage<Organization[]>('organizations_data', []);
    const [groups, setGroups] = useLocalStorage<CommissionGroup[]>('commission_groups', []);
    const [regulations, setRegulations] = useLocalStorage<Regulation[]>('regulations_data', []);
    const [certificates, setCertificates] = useLocalStorage<Certificate[]>('certificates_data', []);
    const [deletedCertificates, setDeletedCertificates] = useLocalStorage<DeletedCertificateEntry[]>('deleted_certificates', []);
    
    // Settings
    const [settings, setSettings] = useLocalStorage<ProjectSettings>('project_settings', {
        defaultCopiesCount: 2,
        showAdditionalInfo: true,
        showAttachments: true,
        showCopiesCount: true,
        showActDate: false,
        showParticipantDetails: true,
        geminiApiKey: '',
        aiModel: 'gemini-2.5-flash',
        openAiApiKey: '',
        openAiBaseUrl: 'https://openrouter.ai/api/v1',
        defaultActDate: '{workEndDate}',
        historyDepth: 20,
        registryThreshold: 5,
        certificatePromptNumber: DEFAULT_PROMPT_NUMBER,
        certificatePromptDate: DEFAULT_PROMPT_DATE,
        certificatePromptMaterials: DEFAULT_PROMPT_MATERIALS
    });
    
    // Notification State
    const [notification, setNotification] = useState<string | null>(null);

    // --- MIGRATION LOGIC for Construction Objects ---
    useEffect(() => {
        // Check if we have data but no objects (Legacy Mode)
        const hasData = acts.length > 0 || people.length > 0 || certificates.length > 0 || organizations.length > 0;
        const hasObjects = constructionObjects.length > 0;

        if (hasData && !hasObjects) {
            // Create a default object using the old objectName setting if available
            const legacyName = (settings as any).objectName || 'Мой объект';
            const newObj: ConstructionObject = { id: crypto.randomUUID(), name: legacyName, shortName: legacyName };
            
            setConstructionObjects([newObj]);
            setCurrentObjectId(newObj.id);

            // Function to migrate array items
            const migrate = (items: any[]) => items.map(i => ({ 
                ...i, 
                constructionObjectId: i.constructionObjectId || newObj.id 
            }));
            
            setActs(prev => migrate(prev));
            setPeople(prev => migrate(prev));
            setGroups(prev => migrate(prev));
            setRegulations(prev => migrate(prev));
            setCertificates(prev => migrate(prev));
            setOrganizations(prev => migrate(prev));
            
            // Clean up old settings
            const newSettings = { ...settings };
            delete (newSettings as any).objectName;
            setSettings(newSettings);
        } else if (!hasData && !hasObjects) {
             // Fresh start
             const newObj: ConstructionObject = { id: crypto.randomUUID(), name: 'Основной объект', shortName: 'Основной' };
             setConstructionObjects([newObj]);
             setCurrentObjectId(newObj.id);
        } else if (hasObjects && !currentObjectId) {
            // If objects exist but none selected, select first
            setCurrentObjectId(constructionObjects[0].id);
        }
    }, []); // Run once on mount

    // --- Computed Data for Current Object ---
    const currentActs = useMemo(() => acts.filter(a => a.constructionObjectId === currentObjectId), [acts, currentObjectId]);
    const currentPeople = useMemo(() => people.filter(p => p.constructionObjectId === currentObjectId), [people, currentObjectId]);
    const currentOrganizations = useMemo(() => organizations.filter(o => o.constructionObjectId === currentObjectId), [organizations, currentObjectId]);
    const currentGroups = useMemo(() => groups.filter(g => g.constructionObjectId === currentObjectId), [groups, currentObjectId]);
    const currentRegulations = useMemo(() => regulations.filter(r => r.constructionObjectId === currentObjectId), [regulations, currentObjectId]);
    const currentCertificates = useMemo(() => certificates.filter(c => c.constructionObjectId === currentObjectId), [certificates, currentObjectId]);
    // Trash is filtered to display only items from the current object
    const currentDeletedActs = useMemo(() => deletedActs.filter(d => d.act.constructionObjectId === currentObjectId), [deletedActs, currentObjectId]);
    const currentDeletedCertificates = useMemo(() => deletedCertificates.filter(d => d.certificate.constructionObjectId === currentObjectId), [deletedCertificates, currentObjectId]);

    // Theme state
    const [theme, setTheme] = useLocalStorage<Theme>('app_theme', 'light');

    useEffect(() => {
        const html = document.documentElement;
        html.classList.remove('theme-light', 'theme-dark', 'theme-eye-protection');
        html.classList.add(`theme-${theme}`);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => {
            if (prev === 'light') return 'dark';
            if (prev === 'dark') return 'eye-protection';
            return 'light';
        });
    };

    const [currentPage, setCurrentPage] = useState<Page>('acts');
    const [importData, setImportData] = useState<ImportData | null>(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [confirmationRequest, setConfirmationRequest] = useState<{ title: string, message: React.ReactNode, onConfirm: () => void } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Handlers for Construction Objects ---
    const handleAddObject = (name: string, shortName: string, cloneFromId?: string, cloneCategories?: string[]) => {
        const newObj: ConstructionObject = { id: crypto.randomUUID(), name, shortName };
        
        // 1. Create the object
        setConstructionObjects(prev => [...prev, newObj]);
        
        // 2. Clone data if requested
        if (cloneFromId && cloneCategories && cloneCategories.length > 0) {
            const shouldClone = (cat: string) => cloneCategories.includes(cat);
            
            if (shouldClone('organizations')) {
                const sourceOrgs = organizations.filter(o => o.constructionObjectId === cloneFromId);
                const newOrgs = sourceOrgs.map(o => ({ ...o, id: crypto.randomUUID(), constructionObjectId: newObj.id }));
                setOrganizations(prev => [...prev, ...newOrgs]);
            }
            
            if (shouldClone('people')) {
                const sourcePeople = people.filter(p => p.constructionObjectId === cloneFromId);
                const newPeople = sourcePeople.map(p => ({ ...p, id: crypto.randomUUID(), constructionObjectId: newObj.id }));
                setPeople(prev => [...prev, ...newPeople]);
            }
            
            if (shouldClone('groups')) {
                const sourceGroups = groups.filter(g => g.constructionObjectId === cloneFromId);
                const newGroups = sourceGroups.map(g => ({ 
                    ...g, 
                    id: crypto.randomUUID(), 
                    constructionObjectId: newObj.id,
                    representatives: {}, // Reset relations on simple copy to avoid confusion
                    builderOrgId: '',
                    contractorOrgId: '',
                    designerOrgId: '',
                    workPerformerOrgId: ''
                }));
                setGroups(prev => [...prev, ...newGroups]);
            }
            
            if (shouldClone('certificates')) {
                const sourceCerts = certificates.filter(c => c.constructionObjectId === cloneFromId);
                const newCerts = sourceCerts.map(c => ({ ...c, id: crypto.randomUUID(), constructionObjectId: newObj.id }));
                setCertificates(prev => [...prev, ...newCerts]);
            }
            
            if (shouldClone('regulations')) {
                const sourceRegs = regulations.filter(r => r.constructionObjectId === cloneFromId);
                const newRegs = sourceRegs.map(r => ({ ...r, id: crypto.randomUUID(), constructionObjectId: newObj.id }));
                setRegulations(prev => [...prev, ...newRegs]);
            }
        }

        setCurrentObjectId(newObj.id);
    };

    const handleUpdateObject = (id: string, name: string, shortName: string) => {
        setConstructionObjects(prev => prev.map(o => o.id === id ? { ...o, name, shortName } : o));
    };

    const handleDeleteObject = (id: string) => {
        // 1. Remove the object itself
        setConstructionObjects(prev => prev.filter(o => o.id !== id));

        // 2. Remove all related data
        setActs(prev => prev.filter(a => a.constructionObjectId !== id));
        setPeople(prev => prev.filter(p => p.constructionObjectId !== id));
        setOrganizations(prev => prev.filter(o => o.constructionObjectId !== id));
        setGroups(prev => prev.filter(g => g.constructionObjectId !== id));
        setRegulations(prev => prev.filter(r => r.constructionObjectId !== id));
        setCertificates(prev => prev.filter(c => c.constructionObjectId !== id));
        
        // 3. Remove from trash
        setDeletedActs(prev => prev.filter(d => d.act.constructionObjectId !== id));
        setDeletedCertificates(prev => prev.filter(d => d.certificate.constructionObjectId !== id));

        // 4. Handle Active Object Switch
        if (currentObjectId === id) {
            setConstructionObjects(currentList => {
                const remaining = currentList.filter(o => o.id !== id);
                if (remaining.length > 0) {
                    setCurrentObjectId(remaining[0].id);
                } else {
                    const newObj: ConstructionObject = { id: crypto.randomUUID(), name: 'Новый объект', shortName: 'Новый' };
                    setConstructionObjects([newObj]);
                    setCurrentObjectId(newObj.id);
                }
                return remaining;
            });
        }
    };

    const handleCloneObject = (sourceId: string) => {
        const sourceObj = constructionObjects.find(o => o.id === sourceId);
        if (!sourceObj) return;

        const newObj: ConstructionObject = {
            id: crypto.randomUUID(),
            name: `${sourceObj.name} (Копия)`,
            shortName: sourceObj.shortName ? `${sourceObj.shortName} (Копия)` : undefined
        };

        // --- DEEP COPY LOGIC WITH REFERENCE MAPPING ---
        const idMap = new Map<string, string>();

        // 1. Copy Organizations
        const sourceOrgs = organizations.filter(o => o.constructionObjectId === sourceId);
        const newOrgs = sourceOrgs.map(o => {
            const newId = crypto.randomUUID();
            idMap.set(o.id, newId);
            return { ...o, id: newId, constructionObjectId: newObj.id };
        });

        // 2. Copy People
        const sourcePeople = people.filter(p => p.constructionObjectId === sourceId);
        const newPeople = sourcePeople.map(p => {
            const newId = crypto.randomUUID();
            idMap.set(p.id, newId);
            return { ...p, id: newId, constructionObjectId: newObj.id };
        });

        // 3. Copy Groups (and update Org/Person refs)
        const sourceGroups = groups.filter(g => g.constructionObjectId === sourceId);
        const newGroups = sourceGroups.map(g => {
            const newGroupId = crypto.randomUUID();
            idMap.set(g.id, newGroupId);

            const newReps: { [key: string]: string } = {};
            Object.entries(g.representatives).forEach(([role, personId]) => {
                if (personId && idMap.has(personId)) {
                    newReps[role] = idMap.get(personId)!;
                }
            });

            return {
                ...g,
                id: newGroupId,
                constructionObjectId: newObj.id,
                representatives: newReps,
                builderOrgId: idMap.get(g.builderOrgId || '') || '',
                contractorOrgId: idMap.get(g.contractorOrgId || '') || '',
                designerOrgId: idMap.get(g.designerOrgId || '') || '',
                workPerformerOrgId: idMap.get(g.workPerformerOrgId || '') || '',
            };
        });

        // 4. Copy Acts (and update Org/Group/Rep refs)
        const sourceActs = acts.filter(a => a.constructionObjectId === sourceId);
        const newActs = sourceActs.map(a => {
            const newActId = crypto.randomUUID();
            
            const newReps: { [key: string]: string } = {};
            Object.entries(a.representatives).forEach(([role, personId]) => {
                if (personId && idMap.has(personId)) {
                    newReps[role] = idMap.get(personId)!;
                }
            });

            return {
                ...a,
                id: newActId,
                constructionObjectId: newObj.id,
                objectName: newObj.name, // Update object name snapshot
                representatives: newReps,
                commissionGroupId: idMap.get(a.commissionGroupId || '') || undefined,
                builderOrgId: idMap.get(a.builderOrgId || '') || undefined,
                contractorOrgId: idMap.get(a.contractorOrgId || '') || undefined,
                designerOrgId: idMap.get(a.designerOrgId || '') || undefined,
                workPerformerOrgId: idMap.get(a.workPerformerOrgId || '') || undefined,
                nextWorkActId: undefined // Break chains to avoid pointing to old acts
            };
        });

        // 5. Copy Regulations & Certificates (No ID mapping needed usually)
        const sourceRegs = regulations.filter(r => r.constructionObjectId === sourceId);
        const newRegs = sourceRegs.map(r => ({ ...r, id: crypto.randomUUID(), constructionObjectId: newObj.id }));

        const sourceCerts = certificates.filter(c => c.constructionObjectId === sourceId);
        const newCerts = sourceCerts.map(c => ({ ...c, id: crypto.randomUUID(), constructionObjectId: newObj.id }));

        // Update State
        setConstructionObjects(prev => [...prev, newObj]);
        setOrganizations(prev => [...prev, ...newOrgs]);
        setPeople(prev => [...prev, ...newPeople]);
        setGroups(prev => [...prev, ...newGroups]);
        setActs(prev => [...prev, ...newActs]);
        setRegulations(prev => [...prev, ...newRegs]);
        setCertificates(prev => [...prev, ...newCerts]);

        setCurrentObjectId(newObj.id);
        setNotification(`Объект "${sourceObj.name}" успешно склонирован!`);
    };

    // --- Template Handlers ---
    const handleTemplateUpload = (file: File) => {
        fileToBase64(file).then(base64 => {
            setTemplate(base64);
        }).catch(err => {
            console.error("Template upload failed", err);
            alert("Ошибка загрузки шаблона");
        });
    };

    const handleRegistryTemplateUpload = (file: File) => {
        fileToBase64(file).then(base64 => {
            setRegistryTemplate(base64);
            setNotification("Шаблон реестра успешно загружен.");
        }).catch(err => {
            console.error("Registry template upload failed", err);
            alert("Ошибка загрузки шаблона реестра");
        });
    };

    const handleDownloadTemplate = (type: 'main' | 'registry' = 'main') => {
        const tmpl = type === 'main' ? template : registryTemplate;
        const name = type === 'main' ? 'Шаблон_Акта.docx' : 'Шаблон_Реестра.docx';
        
        if (tmpl) {
            const blob = base64ToBlob(tmpl);
            saveAs(blob, name);
        }
    };

    // --- Data Handlers (Scoped to Current Object) ---

    // 1. Acts
    const handleSaveAct = (act: Act, insertAtIndex?: number) => {
        if (!currentObjectId) { alert("Выберите объект строительства"); return; }
        
        // Ensure act belongs to current object
        const actToSave = { ...act, constructionObjectId: currentObjectId };
        
        // Update object name snapshot from current object (for templates)
        const currentObj = constructionObjects.find(o => o.id === currentObjectId);
        if (currentObj) actToSave.objectName = currentObj.name;

        setActs(prev => {
            const existingIndex = prev.findIndex(a => a.id === actToSave.id);
            if (existingIndex >= 0) {
                const newActs = [...prev];
                newActs[existingIndex] = actToSave;
                return newActs;
            } else {
                if (insertAtIndex !== undefined) {
                    const newActs = [...prev];
                    newActs.splice(insertAtIndex, 0, actToSave);
                    return newActs;
                }
                return [...prev, actToSave];
            }
        });
    };

    // 2. People
    const handleSavePerson = (person: Person) => {
        if (!currentObjectId) return;
        const personToSave = { ...person, constructionObjectId: currentObjectId };
        setPeople(prev => {
            const index = prev.findIndex(p => p.id === personToSave.id);
            if (index >= 0) {
                const newPeople = [...prev];
                newPeople[index] = personToSave;
                return newPeople;
            }
            return [...prev, personToSave];
        });
    };

    const handleDeletePerson = (id: string) => {
        setPeople(prev => prev.filter(p => p.id !== id));
    };

    // 3. Organizations (Now Local)
    const handleSaveOrganization = (org: Organization) => {
        if (!currentObjectId) return;
        const orgToSave = { ...org, constructionObjectId: currentObjectId };
        setOrganizations(prev => {
            const index = prev.findIndex(o => o.id === orgToSave.id);
            if (index >= 0) {
                const newOrgs = [...prev];
                newOrgs[index] = orgToSave;
                return newOrgs;
            }
            return [...prev, orgToSave];
        });
    };

    const handleDeleteOrganization = (id: string) => {
        setOrganizations(prev => prev.filter(o => o.id !== id));
    };

    // 4. Groups
    const handleSaveGroup = (group: CommissionGroup) => {
        if (!currentObjectId) return;
        const groupToSave = { ...group, constructionObjectId: currentObjectId };
        setGroups(prev => {
            const index = prev.findIndex(g => g.id === groupToSave.id);
            if (index >= 0) {
                const newGroups = [...prev];
                newGroups[index] = groupToSave;
                return newGroups;
            }
            return [...prev, groupToSave];
        });
    };

    const handleDeleteGroup = (id: string) => {
        setGroups(prev => prev.filter(g => g.id !== id));
    };

    // 5. Regulations
    const handleSaveRegulations = (newRegulations: Regulation[]) => {
        if (!currentObjectId) return;
        const regsToSave = newRegulations.map(r => ({ ...r, constructionObjectId: currentObjectId }));
        setRegulations(prev => {
            const otherRegs = prev.filter(r => r.constructionObjectId !== currentObjectId);
            return [...otherRegs, ...regsToSave];
        });
    };

    // 6. Certificates
    const handleSaveCertificate = (cert: Certificate) => {
        if (!currentObjectId) return;
        const certToSave = { ...cert, constructionObjectId: currentObjectId };
        setCertificates(prev => {
            const index = prev.findIndex(c => c.id === certToSave.id);
            if (index >= 0) {
                const newCerts = [...prev];
                newCerts[index] = certToSave;
                return newCerts;
            }
            return [...prev, certToSave];
        });
    };

    const handleDeleteCertificate = (id: string) => {
        const certToDelete = certificates.find(c => c.id === id);
        if (certToDelete) {
            // Move to trash
            setDeletedCertificates(prev => [
                { certificate: certToDelete, deletedOn: new Date().toISOString() }, 
                ...prev
            ]);
            setCertificates(prev => prev.filter(c => c.id !== id));
        }
    };
    
    const handleUnlinkCertificate = (cert: Certificate, mode: 'remove_entry' | 'remove_reference') => {
        const searchStr = `(сертификат № ${cert.number}`;
        setActs(prevActs => prevActs.map(act => {
            if (act.constructionObjectId !== currentObjectId) return act;
            if (!act.materials.includes(searchStr)) return act;
            const materials = act.materials.split(';').map(s => s.trim());
            const newMaterials = materials.map(mat => {
                if (mat.includes(searchStr)) {
                    if (mode === 'remove_reference') {
                        return mat.split('(')[0].trim();
                    } else {
                        return null; 
                    }
                }
                return mat;
            }).filter(Boolean); 
            return { ...act, materials: newMaterials.join('; ') };
        }));
    };

    // --- Complex Copy/Import Logic ---
    const handleImportFromObject = (items: (Person | Organization | Certificate)[]) => {
        if (!currentObjectId || items.length === 0) return;

        // Determine type based on first item
        const isPerson = (i: any): i is Person => 'position' in i;
        const isOrg = (i: any): i is Organization => 'inn' in i;
        
        if (isOrg(items[0])) {
            const orgsToImport = items as Organization[];
            const newOrgs: Organization[] = [];
            
            orgsToImport.forEach(srcOrg => {
                // Check dupes in current object by INN
                const exists = currentOrganizations.some(curr => curr.inn === srcOrg.inn);
                if (!exists) {
                    newOrgs.push({
                        ...srcOrg,
                        id: crypto.randomUUID(),
                        constructionObjectId: currentObjectId
                    });
                }
            });
            
            if (newOrgs.length > 0) {
                setOrganizations(prev => [...prev, ...newOrgs]);
                setNotification(`Скопировано ${newOrgs.length} организаций.`);
            } else {
                setNotification("Все выбранные организации уже существуют в текущем объекте (проверка по ИНН).");
            }
        }
        else if (isPerson(items[0])) {
            const peopleToImport = items as Person[];
            const newPeople: Person[] = [];
            const newOrgs: Organization[] = []; // Potential dependencies
            
            peopleToImport.forEach(srcPerson => {
                // 1. Resolve Organization Dependency
                const sourceOrg = organizations.find(o => o.name === srcPerson.organization && o.constructionObjectId === srcPerson.constructionObjectId);
                
                if (srcPerson.organization) {
                    let targetOrg = currentOrganizations.find(o => o.name === srcPerson.organization);
                    
                    if (!targetOrg && sourceOrg) {
                        targetOrg = currentOrganizations.find(o => o.inn === sourceOrg.inn);
                    }
                    
                    if (!targetOrg && sourceOrg) {
                        const newOrg = { ...sourceOrg, id: crypto.randomUUID(), constructionObjectId: currentObjectId };
                        if (!newOrgs.some(no => no.inn === newOrg.inn)) {
                            newOrgs.push(newOrg);
                        }
                    }
                }
                
                newPeople.push({
                    ...srcPerson,
                    id: crypto.randomUUID(),
                    constructionObjectId: currentObjectId
                });
            });
            
            if (newOrgs.length > 0) setOrganizations(prev => [...prev, ...newOrgs]);
            if (newPeople.length > 0) setPeople(prev => [...prev, ...newPeople]);
            setNotification(`Скопировано ${newPeople.length} участников и ${newOrgs.length} связанных организаций.`);
        } else {
             // Certificates
             const certsToImport = items as Certificate[];
             const newCerts = certsToImport.map(c => ({
                 ...c,
                 id: crypto.randomUUID(),
                 constructionObjectId: currentObjectId
             }));
             setCertificates(prev => [...prev, ...newCerts]);
             setNotification(`Скопировано ${newCerts.length} сертификатов.`);
        }
    };

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Helpers for Global Import
    const handleGlobalImport = (importSettings: ImportSettings) => {
        if (!importData) return;
        
        if (importSettings.projectSettings && importData.projectSettings) {
            setSettings(importData.projectSettings);
        }
        if (importSettings.template && importData.template) {
            setTemplate(importData.template);
        }
        if (importSettings.registryTemplate && importData.registryTemplate) {
            setRegistryTemplate(importData.registryTemplate);
        }
        setImportData(null);
    };

    return (
        <div className={`flex h-screen bg-slate-100 font-sans text-slate-900 theme-${theme}`}>
            <Sidebar
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                isTemplateLoaded={!!template}
                trashCount={currentDeletedActs.length + currentDeletedCertificates.length}
                theme={theme}
                onToggleTheme={toggleTheme}
                constructionObjects={constructionObjects}
                currentObjectId={currentObjectId}
            />

            <main className="flex-1 h-full overflow-hidden relative">
                {!template && currentPage === 'acts' ? (
                    <TemplateUploader onUpload={handleTemplateUpload} />
                ) : (
                    <>
                        {currentPage === 'objects' && (
                            <ObjectsPage 
                                constructionObjects={constructionObjects}
                                currentObjectId={currentObjectId}
                                onObjectChange={setCurrentObjectId}
                                onAddObject={handleAddObject}
                                onUpdateObject={handleUpdateObject}
                                onDeleteObject={handleDeleteObject}
                                onCloneObject={handleCloneObject}
                            />
                        )}
                        {currentPage === 'acts' && (
                            <ActsPage
                                acts={currentActs}
                                people={currentPeople}
                                organizations={currentOrganizations}
                                groups={currentGroups}
                                regulations={currentRegulations}
                                certificates={currentCertificates}
                                template={template}
                                registryTemplate={registryTemplate}
                                settings={settings}
                                onSave={handleSaveAct}
                                onMoveToTrash={(ids) => {
                                    const actsToDelete = acts.filter(a => ids.includes(a.id));
                                    setDeletedActs(prev => [...actsToDelete.map(a => ({ act: a, deletedOn: new Date().toISOString() })), ...prev]);
                                    setActs(prev => prev.filter(a => !ids.includes(a.id)));
                                }}
                                onPermanentlyDelete={(ids) => setActs(prev => prev.filter(a => !ids.includes(a.id)))}
                                onReorderActs={(newActs) => {
                                    setActs(prev => {
                                        const other = prev.filter(a => a.constructionObjectId !== currentObjectId);
                                        return [...other, ...newActs];
                                    });
                                }}
                                setCurrentPage={setCurrentPage}
                                onNavigateToCertificate={(id) => {
                                    setCurrentPage('certificates');
                                }}
                            />
                        )}
                        {currentPage === 'people' && (
                            <PeoplePage
                                people={currentPeople}
                                allPeople={people}
                                organizations={currentOrganizations}
                                constructionObjects={constructionObjects}
                                currentObjectId={currentObjectId}
                                settings={settings}
                                onSave={handleSavePerson}
                                onDelete={handleDeletePerson}
                                onImport={handleImportFromObject}
                            />
                        )}
                        {currentPage === 'organizations' && (
                            <OrganizationsPage
                                organizations={currentOrganizations}
                                allOrganizations={organizations}
                                constructionObjects={constructionObjects}
                                currentObjectId={currentObjectId}
                                settings={settings}
                                onSave={handleSaveOrganization}
                                onDelete={handleDeleteOrganization}
                                onImport={handleImportFromObject}
                            />
                        )}
                        {currentPage === 'groups' && (
                            <GroupsPage
                                groups={currentGroups}
                                people={currentPeople}
                                organizations={currentOrganizations}
                                onSave={handleSaveGroup}
                                onDelete={handleDeleteGroup}
                            />
                        )}
                        {currentPage === 'regulations' && (
                            <RegulationsPage
                                regulations={currentRegulations}
                                onSaveRegulations={handleSaveRegulations}
                            />
                        )}
                        {currentPage === 'certificates' && (
                            <CertificatesPage
                                certificates={currentCertificates}
                                allCertificates={certificates}
                                acts={currentActs}
                                constructionObjects={constructionObjects}
                                currentObjectId={currentObjectId}
                                settings={settings}
                                onSave={handleSaveCertificate}
                                onDelete={handleDeleteCertificate}
                                onUnlink={handleUnlinkCertificate}
                                onImport={handleImportFromObject}
                            />
                        )}
                        {currentPage === 'settings' && (
                            <SettingsPage
                                settings={settings}
                                onSave={(s) => setSettings(s)}
                                onImport={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'application/json';
                                    input.onchange = (e) => {
                                        const file = (e.target as HTMLInputElement).files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (ev) => {
                                                try {
                                                    const json = JSON.parse(ev.target?.result as string);
                                                    setImportData(json);
                                                } catch (err) { alert('Invalid JSON'); }
                                            };
                                            reader.readAsText(file);
                                        }
                                    };
                                    input.click();
                                }}
                                onExport={() => setShowExportModal(true)}
                                onChangeTemplate={() => setTemplate(null)}
                                onDownloadTemplate={handleDownloadTemplate}
                                onUploadRegistryTemplate={handleRegistryTemplateUpload}
                                isTemplateLoaded={!!template}
                                isRegistryTemplateLoaded={!!registryTemplate}
                            />
                        )}
                        {currentPage === 'trash' && (
                            <TrashPage
                                deletedActs={currentDeletedActs}
                                deletedCertificates={currentDeletedCertificates}
                                onRestore={(entries) => {
                                    setActs(prev => [...prev, ...entries.map(e => e.act)]);
                                    setDeletedActs(prev => prev.filter(d => !entries.find(e => e.act.id === d.act.id)));
                                }}
                                onPermanentlyDelete={(ids) => setDeletedActs(prev => prev.filter(d => !ids.includes(d.act.id)))}
                                onRestoreCertificates={(entries) => {
                                    setCertificates(prev => [...prev, ...entries.map(e => e.certificate)]);
                                    setDeletedCertificates(prev => prev.filter(d => !entries.find(e => e.certificate.id === d.certificate.id)));
                                }}
                                onPermanentlyDeleteCertificates={(ids) => setDeletedCertificates(prev => prev.filter(d => !ids.includes(d.certificate.id)))}
                                requestConfirmation={(title, message, onConfirm) => {
                                    setConfirmationRequest({ title, message, onConfirm });
                                }}
                            />
                        )}
                    </>
                )}
            </main>

            {importData && (
                <ImportModal
                    data={importData}
                    onClose={() => setImportData(null)}
                    onImport={handleGlobalImport}
                />
            )}

            {showExportModal && (
                <ExportModal
                    onClose={() => setShowExportModal(false)}
                    onExport={(exportConfig) => {
                        const exportData: ImportData = {
                            projectSettings: exportConfig.projectSettings ? settings : undefined,
                            template: exportConfig.template ? template : undefined,
                            registryTemplate: exportConfig.registryTemplate ? registryTemplate : undefined,
                            constructionObjects: exportConfig.constructionObjects ? constructionObjects : undefined,
                            acts: exportConfig.acts ? acts : undefined,
                            people: exportConfig.people ? people : undefined,
                            organizations: exportConfig.organizations ? organizations : undefined,
                            groups: exportConfig.groups ? groups : undefined,
                            regulations: exportConfig.regulations ? regulations : undefined,
                            certificates: exportConfig.certificates ? certificates : undefined,
                            deletedActs: exportConfig.deletedActs ? deletedActs : undefined,
                            deletedCertificates: exportConfig.deletedCertificates ? deletedCertificates : undefined,
                        };
                        const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
                        saveAs(blob, 'backup.json');
                        setShowExportModal(false);
                    }}
                    counts={{
                        acts: currentActs.length,
                        people: currentPeople.length,
                        organizations: currentOrganizations.length,
                        groups: currentGroups.length,
                        regulations: currentRegulations.length,
                        certificates: currentCertificates.length,
                        deletedActs: currentDeletedActs.length,
                        deletedCertificates: currentDeletedCertificates.length,
                        hasTemplate: !!template,
                        hasRegistryTemplate: !!registryTemplate
                    }}
                />
            )}

            {confirmationRequest && (
                <ConfirmationModal
                    isOpen={!!confirmationRequest}
                    onClose={() => setConfirmationRequest(null)}
                    onConfirm={() => {
                        confirmationRequest.onConfirm();
                        setConfirmationRequest(null);
                    }}
                    title={confirmationRequest.title}
                >
                    {confirmationRequest.message}
                </ConfirmationModal>
            )}
            
            <ToastNotification message={notification} onClose={() => setNotification(null)} />
        </div>
    );
};

export default App;
