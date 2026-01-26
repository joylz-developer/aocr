
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
import Sidebar from './components/Sidebar';
import { saveAs } from 'file-saver';
import PizZip from 'pizzip';

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
        defaultActDate: '{workEndDate}',
        historyDepth: 20,
        registryThreshold: 5,
        certificatePromptNumber: DEFAULT_PROMPT_NUMBER,
        certificatePromptDate: DEFAULT_PROMPT_DATE,
        certificatePromptMaterials: DEFAULT_PROMPT_MATERIALS
    });
    
    // --- MIGRATION LOGIC for Construction Objects ---
    useEffect(() => {
        // Check if we have data but no objects (Legacy Mode)
        const hasData = acts.length > 0 || people.length > 0 || certificates.length > 0 || organizations.length > 0;
        const hasObjects = constructionObjects.length > 0;

        if (hasData && !hasObjects) {
            // Create a default object using the old objectName setting if available
            const legacyName = (settings as any).objectName || 'Мой объект';
            const newObj: ConstructionObject = { id: crypto.randomUUID(), name: legacyName };
            
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
             const newObj: ConstructionObject = { id: crypto.randomUUID(), name: 'Основной объект' };
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
    // Trash is global or filtered? Better filtered to avoid confusion
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
    const [restoreGroupConfirmData, setRestoreGroupConfirmData] = useState<{ groups: CommissionGroup[], entriesToRestore: DeletedActEntry[] } | null>(null);
    const [confirmationRequest, setConfirmationRequest] = useState<{ title: string, message: React.ReactNode, onConfirm: () => void } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Handlers for Construction Objects ---
    const handleAddObject = (name: string) => {
        const newObj: ConstructionObject = { id: crypto.randomUUID(), name };
        setConstructionObjects(prev => [...prev, newObj]);
        setCurrentObjectId(newObj.id);
    };

    const handleUpdateObject = (id: string, name: string) => {
        setConstructionObjects(prev => prev.map(o => o.id === id ? { ...o, name } : o));
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
            alert("Шаблон реестра успешно загружен.");
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
                alert(`Скопировано ${newOrgs.length} организаций.`);
            } else {
                alert("Все выбранные организации уже существуют в текущем объекте (проверка по ИНН).");
            }
        }
        else if (isPerson(items[0])) {
            const peopleToImport = items as Person[];
            const newPeople: Person[] = [];
            const newOrgs: Organization[] = []; // Potential dependencies
            
            peopleToImport.forEach(srcPerson => {
                // 1. Resolve Organization Dependency
                // Find source org details (Global/All lookup)
                const sourceOrg = organizations.find(o => o.name === srcPerson.organization && o.constructionObjectId === srcPerson.constructionObjectId);
                
                // If person has an org, ensure it exists in target
                if (srcPerson.organization) {
                    // Check if org with same name/INN exists in target
                    let targetOrg = currentOrganizations.find(o => o.name === srcPerson.organization);
                    
                    // If not found by name, try to find by INN if we know source org
                    if (!targetOrg && sourceOrg) {
                        targetOrg = currentOrganizations.find(o => o.inn === sourceOrg.inn);
                    }

                    // If still not found, we need to create it
                    if (!targetOrg && sourceOrg) {
                        // Check if we already queued it for creation in this batch
                        const alreadyQueued = newOrgs.find(o => o.inn === sourceOrg.inn);
                        if (!alreadyQueued) {
                            newOrgs.push({
                                ...sourceOrg,
                                id: crypto.randomUUID(),
                                constructionObjectId: currentObjectId
                            });
                        }
                    } else if (!targetOrg && !sourceOrg) {
                        // Edge case: Person has org string, but Org entity doesn't exist in source either.
                        // Just copy the string name, nothing to do.
                    }
                }

                // 2. Create Person Copy
                // Check dupes by Name + Position
                const exists = currentPeople.some(p => p.name === srcPerson.name && p.position === srcPerson.position);
                if (!exists) {
                    newPeople.push({
                        ...srcPerson,
                        id: crypto.randomUUID(),
                        constructionObjectId: currentObjectId
                        // Organization name string remains the same
                    });
                }
            });

            if (newOrgs.length > 0) {
                setOrganizations(prev => [...prev, ...newOrgs]);
            }
            
            if (newPeople.length > 0) {
                setPeople(prev => [...prev, ...newPeople]);
                alert(`Скопировано ${newPeople.length} человек` + (newOrgs.length > 0 ? ` и ${newOrgs.length} связанных организаций.` : '.'));
            } else {
                alert("Все выбранные люди уже существуют в текущем объекте.");
            }
        }
        else {
            // Certificates
            const certsToImport = items as Certificate[];
            const newCerts: Certificate[] = [];
            
            certsToImport.forEach(srcCert => {
                const exists = currentCertificates.some(c => c.number === srcCert.number);
                if (!exists) {
                    newCerts.push({
                        ...srcCert,
                        id: crypto.randomUUID(),
                        constructionObjectId: currentObjectId
                    });
                }
            });
            
            if (newCerts.length > 0) {
                setCertificates(prev => [...prev, ...newCerts]);
                alert(`Скопировано ${newCerts.length} сертификатов.`);
            } else {
                alert("Все выбранные сертификаты уже существуют (проверка по номеру).");
            }
        }
    };

    // --- Trash & Restore Logic ---
    const handleMoveActsToTrash = (actIds: string[]) => {
        const actsToDelete = acts.filter(a => actIds.includes(a.id));
        const entries: DeletedActEntry[] = actsToDelete.map(act => {
            const associatedGroup = groups.find(g => g.id === act.commissionGroupId);
            return { act, deletedOn: new Date().toISOString(), associatedGroup };
        });
        setDeletedActs(prev => [...entries, ...prev]);
        setActs(prev => prev.filter(a => !actIds.includes(a.id)));
    };

    const handleRestoreActs = (entriesToRestore: DeletedActEntry[]) => {
        const missingGroups = new Set<string>();
        entriesToRestore.forEach(entry => {
            if (entry.act.commissionGroupId && !groups.some(g => g.id === entry.act.commissionGroupId)) {
                if (entry.associatedGroup) {
                    missingGroups.add(JSON.stringify(entry.associatedGroup));
                }
            }
        });

        if (missingGroups.size > 0) {
            const groupsToRestore = Array.from(missingGroups).map(s => JSON.parse(s));
            setRestoreGroupConfirmData({ groups: groupsToRestore, entriesToRestore });
        } else {
            performRestore(entriesToRestore, false);
        }
    };

    const performRestore = (entries: DeletedActEntry[], restoreGroups: boolean) => {
        const actsToRestore = entries.map(e => e.act);
        
        // Restore acts
        setActs(prev => [...actsToRestore, ...prev]);
        
        // Restore groups if requested
        if (restoreGroups && restoreGroupConfirmData) {
            setGroups(prev => {
                const newGroups = [...prev];
                restoreGroupConfirmData.groups.forEach(g => {
                    if (!newGroups.some(existing => existing.id === g.id)) {
                        newGroups.push(g);
                    }
                });
                return newGroups;
            });
        }

        // Remove from trash
        const idsToRemove = new Set(entries.map(e => e.act.id));
        setDeletedActs(prev => prev.filter(e => !idsToRemove.has(e.act.id)));
        setRestoreGroupConfirmData(null);
    };

    const handlePermanentlyDeleteActs = (actIds: string[]) => {
        setDeletedActs(prev => prev.filter(e => !actIds.includes(e.act.id)));
    };
    
    const handleRestoreCertificates = (entries: DeletedCertificateEntry[]) => {
        const certsToRestore = entries.map(e => e.certificate);
        setCertificates(prev => [...prev, ...certsToRestore]);
        const idsToRemove = new Set(entries.map(e => e.certificate.id));
        setDeletedCertificates(prev => prev.filter(e => !idsToRemove.has(e.certificate.id)));
    };
    
    const handlePermanentlyDeleteCertificates = (ids: string[]) => {
        setDeletedCertificates(prev => prev.filter(e => !ids.includes(e.certificate.id)));
    };

    // --- Import / Export ---
    const handleExport = (exportSettings: ExportSettings) => {
        const zip = new PizZip();
        
        // 1. GLOBAL SETTINGS & DATA
        const globalData: ImportData = {
            template: exportSettings.template ? template : undefined,
            registryTemplate: exportSettings.registryTemplate ? registryTemplate : undefined,
            projectSettings: exportSettings.projectSettings ? settings : undefined,
            constructionObjects: exportSettings.constructionObjects ? constructionObjects : undefined,
        };
        
        zip.file('global.json', JSON.stringify(globalData, null, 2));

        // 2. PER-OBJECT DATA (Separate Folders)
        constructionObjects.forEach(obj => {
            const objActs = exportSettings.acts ? acts.filter(a => a.constructionObjectId === obj.id) : [];
            const objPeople = exportSettings.people ? people.filter(p => p.constructionObjectId === obj.id) : [];
            const objOrgs = exportSettings.organizations ? organizations.filter(o => o.constructionObjectId === obj.id) : [];
            const objGroups = exportSettings.groups ? groups.filter(g => g.constructionObjectId === obj.id) : [];
            const objRegs = exportSettings.regulations ? regulations.filter(r => r.constructionObjectId === obj.id) : [];
            const objCerts = exportSettings.certificates ? certificates.filter(c => c.constructionObjectId === obj.id) : [];
            const objDeletedActs = exportSettings.deletedActs ? deletedActs.filter(d => d.act.constructionObjectId === obj.id) : [];
            const objDeletedCerts = exportSettings.deletedCertificates ? deletedCertificates.filter(d => d.certificate.constructionObjectId === obj.id) : [];

            // If object has any data to export
            if (objActs.length || objPeople.length || objGroups.length || objRegs.length || objCerts.length || objDeletedActs.length || objDeletedCerts.length || objOrgs.length) {
                const objectData: ImportData = {
                    acts: objActs,
                    people: objPeople,
                    organizations: objOrgs,
                    groups: objGroups,
                    regulations: objRegs,
                    certificates: objCerts,
                    deletedActs: objDeletedActs,
                    deletedCertificates: objDeletedCerts
                };
                
                // Sanitize folder name
                const safeName = obj.name.replace(/[<>:"/\\|?*]+/g, '_').trim();
                const folderName = `${safeName}_${obj.id.slice(0, 6)}`;
                zip.folder(folderName)?.file('data.json', JSON.stringify(objectData, null, 2));
            }
        });

        // 3. GENERATE ZIP
        const content = zip.generate({ type: "blob" });
        const dateStr = new Date().toISOString().slice(0, 10);
        saveAs(content, `backup_full_${dateStr}.zip`);
        
        setShowExportModal(false);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        
        if (file.name.endsWith('.zip')) {
            // ZIP IMPORT LOGIC
            reader.readAsArrayBuffer(file);
            reader.onload = (event) => {
                try {
                    const zip = new PizZip(event.target?.result as ArrayBuffer);
                    const files = zip.files;
                    
                    const aggregatedData: ImportData = {
                        acts: [], people: [], organizations: [], groups: [], regulations: [], certificates: [], deletedActs: [], deletedCertificates: [], constructionObjects: []
                    };

                    // Process global.json
                    if (files['global.json']) {
                        const globalJson = JSON.parse(files['global.json'].asText());
                        if (globalJson.template) aggregatedData.template = globalJson.template;
                        if (globalJson.registryTemplate) aggregatedData.registryTemplate = globalJson.registryTemplate;
                        if (globalJson.projectSettings) aggregatedData.projectSettings = globalJson.projectSettings;
                        if (globalJson.constructionObjects) aggregatedData.constructionObjects = globalJson.constructionObjects;
                    }

                    // Process folders
                    Object.keys(files).forEach(fileName => {
                        // Check if it is a data.json inside a folder
                        if (fileName.match(/\/[^/]+\.json$/) || (fileName.endsWith('.json') && fileName !== 'global.json')) {
                             const content = files[fileName].asText();
                             try {
                                 const objData: ImportData = JSON.parse(content);
                                 if (objData.acts) aggregatedData.acts?.push(...objData.acts);
                                 if (objData.people) aggregatedData.people?.push(...objData.people);
                                 if (objData.organizations) aggregatedData.organizations?.push(...objData.organizations);
                                 if (objData.groups) aggregatedData.groups?.push(...objData.groups);
                                 if (objData.regulations) aggregatedData.regulations?.push(...objData.regulations);
                                 if (objData.certificates) aggregatedData.certificates?.push(...objData.certificates);
                                 if (objData.deletedActs) aggregatedData.deletedActs?.push(...objData.deletedActs);
                                 if (objData.deletedCertificates) aggregatedData.deletedCertificates?.push(...objData.deletedCertificates);
                             } catch (err) {
                                 console.warn("Failed to parse " + fileName, err);
                             }
                        }
                    });
                    
                    setImportData(aggregatedData);

                } catch (error) {
                    console.error(error);
                    alert("Ошибка при чтении ZIP архива.");
                }
            };
        } else {
            // LEGACY JSON IMPORT LOGIC
            reader.readAsText(file);
            reader.onload = (event) => {
                try {
                    const json = JSON.parse(event.target?.result as string);
                    setImportData(json);
                } catch (error) {
                    alert('Неверный формат файла JSON');
                }
            };
        }
        
        if (e.target) e.target.value = '';
    };

    const handleImportConfirm = (importSettings: ImportSettings) => {
        if (!importData) return;

        // Helper to merge data based on settings
        const mergeData = <T extends { id: string }>(
            currentData: T[],
            newData: T[] | undefined,
            categorySettings: { import: boolean; mode: 'replace' | 'merge'; selectedIds?: string[] }
        ): T[] => {
            if (!categorySettings.import || !newData) return currentData;
            
            const filteredNewData = newData.filter(item => categorySettings.selectedIds?.includes(item.id));

            if (categorySettings.mode === 'replace') {
                return filteredNewData;
            } else {
                // Merge: Update existing, add new
                const currentMap = new Map(currentData.map(item => [item.id, item]));
                filteredNewData.forEach(item => currentMap.set(item.id, item));
                return Array.from(currentMap.values());
            }
        };

        if (importSettings.template && importData.template) setTemplate(importData.template);
        if (importSettings.registryTemplate && importData.registryTemplate) setRegistryTemplate(importData.registryTemplate);
        if (importSettings.projectSettings && importData.projectSettings) setSettings(importData.projectSettings);
        
        // Handle construction objects first to ensure linking works
        if (importData.constructionObjects && importData.constructionObjects.length > 0) {
             setConstructionObjects(prev => {
                 const currentMap = new Map(prev.map(o => [o.id, o]));
                 importData.constructionObjects!.forEach(o => currentMap.set(o.id, o));
                 return Array.from(currentMap.values());
             });
        }

        setActs(prev => mergeData(prev, importData.acts, importSettings.acts));
        setPeople(prev => mergeData(prev, importData.people, importSettings.people));
        setOrganizations(prev => mergeData(prev, importData.organizations, importSettings.organizations));
        setGroups(prev => mergeData(prev, importData.groups, importSettings.groups));
        setRegulations(prev => mergeData(prev, importData.regulations, importSettings.regulations as any));
        setCertificates(prev => mergeData(prev, importData.certificates, importSettings.certificates as any));
        
        // Handle trash logic
        if (importSettings.deletedActs.import && importData.deletedActs) {
             const newDeletedActs = importData.deletedActs.filter(d => importSettings.deletedActs.selectedIds?.includes(d.act.id));
             if (importSettings.deletedActs.mode === 'replace') {
                 setDeletedActs(newDeletedActs);
             } else {
                 const currentMap = new Map(deletedActs.map(d => [d.act.id, d]));
                 newDeletedActs.forEach(d => currentMap.set(d.act.id, d));
                 setDeletedActs(Array.from(currentMap.values()));
             }
        }

        setImportData(null);
    };

    // Calculate export stats
    const exportCounts = {
        acts: acts.length,
        people: people.length,
        organizations: organizations.length,
        groups: groups.length,
        regulations: regulations.length,
        certificates: certificates.length,
        deletedActs: deletedActs.length,
        deletedCertificates: deletedCertificates.length,
        hasTemplate: !!template,
        hasRegistryTemplate: !!registryTemplate,
    };

    if (!template) {
        return <TemplateUploader onUpload={handleTemplateUpload} />;
    }

    const renderPage = () => {
        switch (currentPage) {
            case 'acts':
                return <ActsPage
                    acts={currentActs}
                    people={currentPeople}
                    organizations={currentOrganizations} // Pass filtered orgs
                    groups={currentGroups}
                    regulations={currentRegulations}
                    certificates={currentCertificates}
                    template={template}
                    registryTemplate={registryTemplate}
                    settings={settings}
                    onSave={handleSaveAct}
                    onMoveToTrash={handleMoveActsToTrash}
                    onPermanentlyDelete={(ids) => setActs(prev => prev.filter(a => !ids.includes(a.id)))}
                    onReorderActs={(newActs) => {
                        setActs(prev => {
                            const otherActs = prev.filter(a => a.constructionObjectId !== currentObjectId);
                            return [...otherActs, ...newActs];
                        });
                    }}
                    setCurrentPage={setCurrentPage}
                    onNavigateToCertificate={(id) => {
                        setCurrentPage('certificates');
                    }}
                />;
            case 'people':
                return <PeoplePage
                    people={currentPeople}
                    allPeople={people} // Pass all for copying
                    organizations={currentOrganizations} // Pass filtered orgs
                    constructionObjects={constructionObjects}
                    currentObjectId={currentObjectId}
                    settings={settings}
                    onSave={handleSavePerson}
                    onDelete={handleDeletePerson}
                    onImport={handleImportFromObject}
                />;
            case 'organizations':
                return <OrganizationsPage
                    organizations={currentOrganizations}
                    allOrganizations={organizations} // Pass all for copying
                    constructionObjects={constructionObjects}
                    currentObjectId={currentObjectId}
                    settings={settings}
                    onSave={handleSaveOrganization}
                    onDelete={handleDeleteOrganization}
                    onImport={handleImportFromObject}
                />;
            case 'groups':
                return <GroupsPage
                    groups={currentGroups}
                    people={currentPeople}
                    organizations={currentOrganizations}
                    onSave={handleSaveGroup}
                    onDelete={handleDeleteGroup}
                />;
            case 'certificates':
                return <CertificatesPage 
                    certificates={currentCertificates}
                    allCertificates={certificates} // Pass all for copying
                    acts={currentActs}
                    constructionObjects={constructionObjects}
                    currentObjectId={currentObjectId}
                    settings={settings}
                    onSave={handleSaveCertificate}
                    onDelete={handleDeleteCertificate}
                    onUnlink={handleUnlinkCertificate}
                    onImport={handleImportFromObject}
                />
            case 'regulations':
                return <RegulationsPage 
                    regulations={currentRegulations}
                    onSaveRegulations={handleSaveRegulations}
                />
            case 'trash':
                return <TrashPage
                    deletedActs={currentDeletedActs}
                    deletedCertificates={currentDeletedCertificates}
                    onRestoreActs={handleRestoreActs}
                    onRestoreCertificates={handleRestoreCertificates}
                    onPermanentlyDeleteActs={handlePermanentlyDeleteActs}
                    onPermanentlyDeleteCertificates={handlePermanentlyDeleteCertificates}
                    requestConfirmation={(title, message, onConfirm) => setConfirmationRequest({ title, message, onConfirm })}
                />;
            case 'settings':
                return <SettingsPage
                    settings={settings}
                    onSave={setSettings}
                    onImport={handleImportClick}
                    onExport={() => setShowExportModal(true)}
                    onChangeTemplate={() => setTemplate(null)}
                    onDownloadTemplate={handleDownloadTemplate}
                    onUploadRegistryTemplate={handleRegistryTemplateUpload}
                    isTemplateLoaded={!!template}
                    isRegistryTemplateLoaded={!!registryTemplate}
                />;
            default:
                return null;
        }
    };

    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar 
                isOpen={true} // Usually controlled by layout, simplified here
                setIsOpen={() => {}} 
                currentPage={currentPage} 
                setCurrentPage={setCurrentPage}
                isTemplateLoaded={!!template}
                trashCount={currentDeletedActs.length + currentDeletedCertificates.length}
                theme={theme}
                onToggleTheme={toggleTheme}
                // Object Props
                constructionObjects={constructionObjects}
                currentObjectId={currentObjectId}
                onObjectChange={setCurrentObjectId}
                onAddObject={handleAddObject}
                onUpdateObject={handleUpdateObject}
            />
            
            <main className="flex-1 overflow-hidden relative">
                {renderPage()}
            </main>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".json,.zip"
                onChange={handleFileImport}
            />

            {importData && (
                <ImportModal
                    data={importData}
                    onClose={() => setImportData(null)}
                    onImport={handleImportConfirm}
                />
            )}

            {showExportModal && (
                <ExportModal
                    onClose={() => setShowExportModal(false)}
                    onExport={handleExport}
                    counts={exportCounts}
                />
            )}

            {/* Re-implement Restore Confirmation Modal logic because the above JSX is disconnected from the logic flow */}
            {/* The logic `handleRestoreActs` sets `restoreGroupConfirmData`. */}
            {/* The modal should call `performRestore` on confirm. */}
            {restoreGroupConfirmData && (
                 <RestoreGroupConfirmationModal
                    isOpen={true}
                    onClose={() => setRestoreGroupConfirmData(null)}
                    groupsToRestore={restoreGroupConfirmData.groups}
                    onConfirm={(restoreGroups) => performRestore(restoreGroupConfirmData.entriesToRestore, restoreGroups)}
                />
            )}

            {confirmationRequest && (
                <ConfirmationModal
                    isOpen={true}
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
        </div>
    );
};

export default App;
