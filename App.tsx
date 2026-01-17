
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Act, Person, Organization, ImportSettings, ImportData, ProjectSettings, CommissionGroup, Page, DeletedActEntry, Regulation, Certificate, Theme, DeletedCertificateEntry, ExportSettings, CertificateFile } from './types';
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
    
    const [acts, setActs] = useLocalStorage<Act[]>('acts_data', []);
    const [deletedActs, setDeletedActs] = useLocalStorage<DeletedActEntry[]>('deleted_acts', []);
    const [people, setPeople] = useLocalStorage<Person[]>('people_data', []);
    const [organizations, setOrganizations] = useLocalStorage<Organization[]>('organizations_data', []);
    const [groups, setGroups] = useLocalStorage<CommissionGroup[]>('commission_groups', []);
    const [regulations, setRegulations] = useLocalStorage<Regulation[]>('regulations_data', []);
    const [certificates, setCertificates] = useLocalStorage<Certificate[]>('certificates_data', []);
    const [deletedCertificates, setDeletedCertificates] = useLocalStorage<DeletedCertificateEntry[]>('deleted_certificates', []);
    const [settings, setSettings] = useLocalStorage<ProjectSettings>('project_settings', {
        objectName: '',
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
        autoAppendRegistryReference: true,
        certificatePromptNumber: DEFAULT_PROMPT_NUMBER,
        certificatePromptDate: DEFAULT_PROMPT_DATE,
        certificatePromptMaterials: DEFAULT_PROMPT_MATERIALS
    });
    
    // Theme State
    const [theme, setTheme] = useLocalStorage<Theme>('app_theme', 'light');

    // Persist current page to localStorage
    const [currentPage, setCurrentPage] = useLocalStorage<Page>('app_current_page', 'acts');
    
    // State to handle cross-page navigation to a specific certificate
    const [targetCertificateId, setTargetCertificateId] = useState<string | null>(null);

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const importInputRef = useRef<HTMLInputElement>(null);
    const [importData, setImportData] = useState<ImportData | null>(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    const [confirmation, setConfirmation] = useState<{
        title: string;
        message: React.ReactNode;
        onConfirm: () => void;
        confirmText?: string;
    } | null>(null);
    
    const [restoreGroupConfirmation, setRestoreGroupConfirmation] = useState<{
        entriesToRestore: DeletedActEntry[];
        groupsToRestore: CommissionGroup[];
        onConfirm: (restoreGroups: boolean) => void;
    } | null>(null);

    // History State
    const [past, setPast] = useState<Act[][]>([]);
    const [future, setFuture] = useState<Act[][]>([]);

    // Apply Theme
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('theme-dark', 'theme-eye-protection');
        
        if (theme === 'dark') {
            root.classList.add('theme-dark');
        } else if (theme === 'eye-protection') {
            root.classList.add('theme-eye-protection');
        }
    }, [theme]);

    const handleToggleTheme = () => {
        setTheme(prev => {
            if (prev === 'light') return 'dark';
            if (prev === 'dark') return 'eye-protection';
            return 'light';
        });
    };

    const handleTemplateUpload = async (file: File) => {
        try {
            const isFirstTime = acts.length === 0 && people.length === 0 && organizations.length === 0;
            const base64 = await fileToBase64(file);
            setTemplate(base64);
            if (isFirstTime) {
                setCurrentPage('settings');
            } else {
                setCurrentPage('acts');
            }
        } catch (error) {
            console.error("Error converting file to base64:", error);
            alert("Не удалось загрузить шаблон.");
        }
    };

    const handleRegistryTemplateUpload = async (file: File) => {
        try {
            const base64 = await fileToBase64(file);
            setRegistryTemplate(base64);
            alert("Шаблон реестра успешно загружен.");
        } catch (error) {
            console.error("Error converting file to base64:", error);
            alert("Не удалось загрузить шаблон реестра.");
        }
    };

    const handleDownloadTemplate = (type: 'main' | 'registry' = 'main') => {
        const temp = type === 'registry' ? registryTemplate : template;
        const name = type === 'registry' ? 'registry_template.docx' : 'template.docx';
        
        if (!temp) {
            alert('Шаблон не загружен.');
            return;
        }
        try {
            const blob = base64ToBlob(temp);
            saveAs(blob, name);
        } catch (error) {
            console.error('Error downloading template:', error);
            alert('Ошибка при скачивании шаблона.');
        }
    };

    // Wrapper to update acts and push to history
    const updateActsWithHistory = (newActs: Act[]) => {
        setPast(prev => {
            const newPast = [...prev, acts];
            const limit = settings.historyDepth || 20;
            if (newPast.length > limit) return newPast.slice(newPast.length - limit);
            return newPast;
        });
        setFuture([]);
        setActs(newActs);
    };

    const undo = useCallback(() => {
        if (past.length === 0) return;
        const previous = past[past.length - 1];
        const newPast = past.slice(0, past.length - 1);
        setFuture(prev => [acts, ...prev]);
        setActs(previous);
        setPast(newPast);
    }, [acts, past, setActs]);

    const redo = useCallback(() => {
        if (future.length === 0) return;
        const next = future[0];
        const newFuture = future.slice(1);
        setPast(prev => [...prev, acts]);
        setActs(next);
        setFuture(newFuture);
    }, [acts, future, setActs]);


    const handleSaveAct = useCallback((actToSave: Act, insertAtIndex?: number) => {
        // Calculate new state based on current 'acts'
        let newActs = [...acts];
        const existsIndex = newActs.findIndex(a => a.id === actToSave.id);
        
        if (existsIndex !== -1) {
            newActs[existsIndex] = actToSave;
        } else {
            const finalIndex = insertAtIndex === undefined ? newActs.length : insertAtIndex;
            newActs.splice(finalIndex, 0, actToSave);
        }
        
        // Dynamic Update: Check for other acts that link TO this act and update their text
        newActs = newActs.map(act => {
            if (act.nextWorkActId === actToSave.id) {
                return {
                    ...act,
                    nextWork: `Работы по акту №${actToSave.number || 'б/н'} (${actToSave.workName || '...'})`
                };
            }
            return act;
        });

        // Use the history wrapper instead of direct setActs
        updateActsWithHistory(newActs);
    }, [acts, settings.historyDepth]); // Depend on acts to calculate next state

    const handleReorderActs = useCallback((newActs: Act[]) => {
        updateActsWithHistory(newActs);
    }, [acts, settings.historyDepth]);

    const handleMoveActsToTrash = useCallback((actIds: string[]) => {
        const actsToMove = acts.filter(a => actIds.includes(a.id));
        const remainingActs = acts.filter(a => !actIds.includes(a.id));
        
        const groupsMap = new Map(groups.map(g => [g.id, g]));

        const newDeletedEntries: DeletedActEntry[] = actsToMove.map(act => ({
            act,
            deletedOn: new Date().toISOString(),
            associatedGroup: act.commissionGroupId ? groupsMap.get(act.commissionGroupId) : undefined
        }));
        
        const updatedRemainingActs = remainingActs.map(act => {
            if (act.nextWorkActId && actIds.includes(act.nextWorkActId)) {
                const deletedLinkedAct = actsToMove.find(a => a.id === act.nextWorkActId);
                return {
                    ...act,
                    nextWork: deletedLinkedAct?.workName || `[Удаленный Акт №${deletedLinkedAct?.number || 'б/н'}]`,
                    nextWorkActId: undefined
                };
            }
            return act;
        });

        setDeletedActs(prev => [...prev, ...newDeletedEntries].sort((a,b) => new Date(b.deletedOn).getTime() - new Date(a.deletedOn).getTime()));
        // Use history wrapper
        updateActsWithHistory(updatedRemainingActs);
    }, [acts, groups, setDeletedActs, settings.historyDepth]);

    const handleDirectPermanentDelete = useCallback((actIds: string[]) => {
        const remainingActs = acts.filter(a => !actIds.includes(a.id));
        
        const updatedRemainingActs = remainingActs.map(act => {
            if (act.nextWorkActId && actIds.includes(act.nextWorkActId)) {
                return {
                    ...act,
                    nextWork: `[Удаленный Акт]`,
                    nextWorkActId: undefined
                };
            }
            return act;
        });

        // Use history wrapper, but do NOT add to deletedActs (Trash)
        updateActsWithHistory(updatedRemainingActs);
    }, [acts, settings.historyDepth]);

    const handleRestoreActs = useCallback((entriesToRestore: DeletedActEntry[]) => {
        const uniqueGroupsToRestore = new Map<string, CommissionGroup>();
        
        entriesToRestore.forEach(entry => {
            if (entry.associatedGroup) {
                const groupExists = groups.some(g => g.id === entry.associatedGroup!.id);
                if (!groupExists) {
                    uniqueGroupsToRestore.set(entry.associatedGroup.id, entry.associatedGroup);
                }
            }
        });

        const groupsToRestoreList = Array.from(uniqueGroupsToRestore.values());

        const performRestore = (restoreAssociatedGroups: boolean) => {
            const actsToRestore = entriesToRestore.map(entry => entry.act);
            
            if (!restoreAssociatedGroups) {
                actsToRestore.forEach(act => {
                    if (act.commissionGroupId && uniqueGroupsToRestore.has(act.commissionGroupId)) {
                        act.commissionGroupId = undefined;
                    }
                });
            }
            
            // For restore, we also want to push to history
            const newActs = [...acts, ...actsToRestore];
            updateActsWithHistory(newActs);
            
            if (restoreAssociatedGroups) {
                setGroups(prev => [...prev, ...groupsToRestoreList].sort((a, b) => a.name.localeCompare(b.name)));
            }

            const entryIdsToRestore = new Set(entriesToRestore.map(e => e.act.id));
            setDeletedActs(prev => prev.filter(entry => !entryIdsToRestore.has(entry.act.id)));
            setRestoreGroupConfirmation(null);
        };

        if (groupsToRestoreList.length > 0) {
            setRestoreGroupConfirmation({
                entriesToRestore,
                groupsToRestore: groupsToRestoreList,
                onConfirm: performRestore
            });
        } else {
            performRestore(false);
        }
    }, [acts, groups, setGroups, setDeletedActs, settings.historyDepth]);

    const handlePermanentlyDeleteActs = useCallback((entryIds: string[]) => {
        setDeletedActs(prev => prev.filter(entry => !entryIds.includes(entry.act.id)));
    }, [setDeletedActs]);

    
    const handleSavePerson = useCallback((personToSave: Person) => {
        setPeople(prevPeople => {
            const exists = prevPeople.some(p => p.id === personToSave.id);
            if (exists) {
                return prevPeople.map(p => (p.id === personToSave.id ? personToSave : p));
            }
            return [...prevPeople, personToSave].sort((a, b) => a.name.localeCompare(b.name));
        });
    }, [setPeople]);

    const handleDeletePerson = useCallback((id: string) => {
        const personToDelete = people.find(p => p.id === id);
        if (!personToDelete) return;

        setConfirmation({
            title: 'Подтверждение удаления',
            message: `Вы уверены, что хотите удалить участника "${personToDelete.name}"? Он также будет удален из всех актов и групп комиссий.`,
            onConfirm: () => {
                setPeople(prevPeople => prevPeople.filter(p => p.id !== id));
                
                const updateRepresentatives = (reps: { [key: string]: string }) => {
                    const newReps = { ...reps };
                    Object.keys(newReps).forEach(key => {
                        if (newReps[key] === id) {
                            delete newReps[key];
                        }
                    });
                    return newReps;
                };

                setActs(prevActs => prevActs.map(act => ({
                     ...act, 
                     representatives: updateRepresentatives(act.representatives)
                })));

                setGroups(prevGroups => prevGroups.map(group => ({
                    ...group,
                    representatives: updateRepresentatives(group.representatives)
                })));

                setConfirmation(null);
            }
        });
    }, [people, setPeople, setActs, setGroups]);

    const handleSaveOrganization = useCallback((orgToSave: Organization) => {
        setOrganizations(prevOrgs => {
            const exists = prevOrgs.some(o => o.id === orgToSave.id);
            if (exists) {
                return prevOrgs.map(o => (o.id === orgToSave.id ? orgToSave : o));
            }
            return [...prevOrgs, orgToSave].sort((a, b) => a.name.localeCompare(b.name));
        });
    }, [setOrganizations]);

    const handleDeleteOrganization = useCallback((id: string) => {
        const orgToDelete = organizations.find(o => o.id === id);
        if (!orgToDelete) return;

        const isOrgInUse = people.some(p => p.organization === orgToDelete.name);

        if (isOrgInUse) {
            alert(`Нельзя удалить организацию "${orgToDelete.name}", так как она используется как минимум одним участником. Пожалуйста, сначала измените или удалите соответствующих участников.`);
            return;
        }

        setConfirmation({
            title: 'Подтверждение удаления',
            message: `Вы уверены, что хотите удалить организацию "${orgToDelete.name}"?`,
            onConfirm: () => {
                setOrganizations(prevOrgs => prevOrgs.filter(o => o.id !== id));
                setConfirmation(null);
            }
        });
    }, [organizations, people, setOrganizations]);

    const handleSaveGroup = useCallback((groupToSave: CommissionGroup) => {
        setGroups(prevGroups => {
            const exists = prevGroups.some(g => g.id === groupToSave.id);
            if (exists) {
                return prevGroups.map(g => (g.id === groupToSave.id ? groupToSave : g));
            }
            return [...prevGroups, groupToSave].sort((a,b) => a.name.localeCompare(b.name));
        });
    }, [setGroups]);

    const handleDeleteGroup = useCallback((id: string) => {
        const groupToDelete = groups.find(g => g.id === id);
        if(!groupToDelete) return;

        const isGroupInUse = acts.some(a => a.commissionGroupId === id);
        const confirmMessage = isGroupInUse 
            ? `Группа "${groupToDelete.name}" используется в некоторых актах. Вы уверены, что хотите ее удалить? Связь с актами будет потеряна.`
            : `Вы уверены, что хотите удалить группу "${groupToDelete.name}"?`;

        setConfirmation({
            title: 'Подтверждение удаления',
            message: confirmMessage,
            onConfirm: () => {
                setGroups(prev => prev.filter(g => g.id !== id));
                if (isGroupInUse) {
                    setActs(prev => prev.map(act => act.commissionGroupId === id ? { ...act, commissionGroupId: undefined } : act));
                }
                setConfirmation(null);
            }
        });
    }, [groups, acts, setGroups, setActs]);
    
    const handleSaveCertificate = useCallback((cert: Certificate) => {
        setCertificates(prev => {
            const exists = prev.some(c => c.id === cert.id);
            if (exists) {
                return prev.map(c => c.id === cert.id ? cert : c);
            }
            return [...prev, cert];
        });
    }, [setCertificates]);

    const handleMoveCertificateToTrash = useCallback((id: string) => {
         const certToDelete = certificates.find(c => c.id === id);
         if (!certToDelete) return;

         const newDeletedEntry: DeletedCertificateEntry = {
             certificate: certToDelete,
             deletedOn: new Date().toISOString()
         };

         setDeletedCertificates(prev => [newDeletedEntry, ...prev]);
         setCertificates(prev => prev.filter(c => c.id !== id));
    }, [certificates, setCertificates, setDeletedCertificates]);

    const handleRemoveCertificateLinksFromActs = useCallback((cert: Certificate) => {
        const updatedActs = acts.map(act => {
            let materials = act.materials;
            const regex = new RegExp(`\\(сертификат №\\s*${cert.number}.*?\\)`, 'i');
            
            if (regex.test(materials)) {
                const parts = materials.split(';').map(s => s.trim());
                const cleanParts = parts.filter(part => !part.includes(`сертификат № ${cert.number}`));
                return { ...act, materials: cleanParts.join('; ') };
            }
            return act;
        });
        
        updateActsWithHistory(updatedActs);
    }, [acts, updateActsWithHistory]);

    const handleRestoreCertificate = useCallback((entries: DeletedCertificateEntry[]) => {
        const certsToRestore = entries.map(e => e.certificate);
        setCertificates(prev => [...prev, ...certsToRestore]);
        setDeletedCertificates(prev => prev.filter(e => !entries.some(re => re.certificate.id === e.certificate.id)));
    }, [setCertificates, setDeletedCertificates]);

    const handlePermanentDeleteCertificate = useCallback((ids: string[]) => {
        setDeletedCertificates(prev => prev.filter(e => !ids.includes(e.certificate.id)));
    }, [setDeletedCertificates]);

    const handleNavigateToCertificate = (id: string) => {
        setTargetCertificateId(id);
        setCurrentPage('certificates');
    };

    const handleSaveSettings = useCallback((newSettings: ProjectSettings) => {
        setSettings(newSettings);
    }, [setSettings]);
    
    const handleExportClick = () => {
        setIsExportModalOpen(true);
    };

    // --- NEW EXPORT LOGIC ---
    const handleExecuteExport = (exportSettings: ExportSettings) => {
        try {
            const zip = new PizZip();

            // 1. Create the "System Backup" JSON (Acts, People, Settings, etc. - NO Certificates here)
            const backupData: any = {};
            if (exportSettings.template) backupData.template = template;
            if (exportSettings.registryTemplate) backupData.registryTemplate = registryTemplate;
            if (exportSettings.projectSettings) backupData.projectSettings = settings;
            if (exportSettings.acts) backupData.acts = acts;
            if (exportSettings.people) backupData.people = people;
            if (exportSettings.organizations) backupData.organizations = organizations;
            if (exportSettings.groups) backupData.groups = groups;
            if (exportSettings.regulations) backupData.regulations = regulations;
            if (exportSettings.deletedActs) backupData.deletedActs = deletedActs;
            if (exportSettings.deletedCertificates) backupData.deletedCertificates = deletedCertificates;
            
            zip.file("backup_restore.json", JSON.stringify(backupData, null, 2));

            // 2. Add Human Readable separate JSONs
            if (exportSettings.projectSettings) zip.file("settings.json", JSON.stringify(settings, null, 2));
            if (exportSettings.people && people.length > 0) zip.file("people.json", JSON.stringify(people, null, 2));
            if (exportSettings.organizations && organizations.length > 0) zip.file("organizations.json", JSON.stringify(organizations, null, 2));
            if (exportSettings.acts && acts.length > 0) zip.file("acts.json", JSON.stringify(acts, null, 2));
            if (exportSettings.regulations && regulations.length > 0) zip.file("regulations.json", JSON.stringify(regulations, null, 2));

            // 3. Template File (Real DOCX)
            if (exportSettings.template && template) {
                 zip.file("template.docx", template, { base64: true });
            }
            if (exportSettings.registryTemplate && registryTemplate) {
                 zip.file("registry_template.docx", registryTemplate, { base64: true });
            }

            // 4. Certificates: Folder Structure
            if (exportSettings.certificates && certificates.length > 0) {
                const certsRoot = zip.folder("certificates");
                if (certsRoot) {
                    certificates.forEach((cert) => {
                        // Create folder name: "Num_ID_snippet"
                        const safeNum = cert.number.replace(/[^a-z0-9а-яё]/gi, '_').substring(0, 50);
                        const folderName = `Cert_${safeNum}_${cert.id.substring(0, 6)}`;
                        const certFolder = certsRoot.folder(folderName);
                        
                        if (certFolder) {
                            // a) Metadata file
                            const info = {
                                id: cert.id,
                                number: cert.number,
                                validUntil: cert.validUntil,
                                materials: cert.materials
                            };
                            certFolder.file("info.json", JSON.stringify(info, null, 2));

                            // b) Binary files
                            const filesToSave = cert.files && cert.files.length > 0 
                                ? cert.files 
                                : (cert.fileData ? [{ id: 'legacy', name: cert.fileName || 'doc', type: cert.fileType || 'image', data: cert.fileData }] : []);

                            filesToSave.forEach((f, idx) => {
                                // @ts-ignore
                                const mimeMatch = f.data.match(/^data:(.*?);base64,(.*)$/);
                                if (mimeMatch) {
                                    const mime = mimeMatch[1];
                                    const b64 = mimeMatch[2];
                                    let ext = 'bin';
                                    if (mime.includes('pdf')) ext = 'pdf';
                                    else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
                                    else if (mime.includes('png')) ext = 'png';
                                    
                                    // Clean name or generic name
                                    // @ts-ignore
                                    let fileName = f.name || `file_${idx + 1}`;
                                    if (!fileName.endsWith(`.${ext}`)) fileName += `.${ext}`;
                                    
                                    certFolder.file(fileName, b64, { base64: true });
                                }
                            });
                        }
                    });
                }
            }

            const content = zip.generate({ type: "blob" });
            const timestamp = new Date().toISOString().split('.')[0].replace('T', '_').replace(/:/g, '-');
            saveAs(content, `Project_Export_${timestamp}.zip`);
            
            setIsExportModalOpen(false);
        } catch (error) {
            console.error('Export error:', error);
            alert('Не удалось создать архив экспорта.');
        }
    };
    
    const handleImportClick = () => {
        importInputRef.current?.click();
    };

    // --- NEW IMPORT LOGIC ---
    const handleImportFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const isZip = file.name.toLowerCase().endsWith('.zip');
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                if (isZip) {
                    // --- ZIP IMPORT ---
                    const zip = new PizZip(e.target?.result as string | ArrayBuffer);
                    
                    // 1. Read Backup JSON (Acts, etc.)
                    let mainData: ImportData = {};
                    const backupFile = zip.file("backup_restore.json");
                    if (backupFile) {
                        try {
                            mainData = JSON.parse(backupFile.asText());
                        } catch(err) { console.error("Bad backup json", err); }
                    }

                    // 2. Scan Certificates folders to reconstruct Certs
                    const reconstructedCerts: Certificate[] = [];
                    // Using direct files iteration to avoid PizZip types limitation
                    
                    const certMap = new Map<string, { info?: any, files: CertificateFile[] }>();

                    Object.keys(zip.files).forEach((relativePath) => {
                        if (!relativePath.startsWith("certificates/")) return;
                        const fileEntry = zip.files[relativePath];
                        if (fileEntry.dir) return; 
                        
                        // relativePath is like "certificates/FolderName/FileName"
                        const parts = relativePath.split('/'); 
                        if (parts.length < 3) return; // Must be inside a subfolder
                        
                        const folderName = parts[1];
                        const fileName = parts.slice(2).join('/');
                        
                        if (!certMap.has(folderName)) {
                            certMap.set(folderName, { files: [] });
                        }
                        const entry = certMap.get(folderName)!;

                        if (fileName === 'info.json') {
                            try {
                                entry.info = JSON.parse(fileEntry.asText());
                            } catch(err) { console.warn("Failed to parse info.json in " + folderName); }
                        } else {
                            // It's a binary file (image/pdf)
                            const binary = fileEntry.asBinary();
                            const b64 = binaryStringToBase64(binary);
                            
                            let mime = 'application/octet-stream';
                            let type: 'pdf' | 'image' = 'image';
                            
                            if (fileName.toLowerCase().endsWith('.pdf')) {
                                mime = 'application/pdf';
                                type = 'pdf';
                            } else if (fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg')) {
                                mime = 'image/jpeg';
                            } else if (fileName.toLowerCase().endsWith('.png')) {
                                mime = 'image/png';
                            }

                            entry.files.push({
                                id: crypto.randomUUID(),
                                name: fileName,
                                type: type,
                                data: `data:${mime};base64,${b64}`
                            });
                        }
                    });

                    // Convert Map to Certificate[]
                    certMap.forEach((val) => {
                        if (val.info) {
                            reconstructedCerts.push({
                                id: val.info.id || crypto.randomUUID(),
                                number: val.info.number || '?',
                                validUntil: val.info.validUntil || '',
                                materials: Array.isArray(val.info.materials) ? val.info.materials : [],
                                files: val.files
                            });
                        }
                    });

                    // Merge reconstructed certs into mainData
                    if (reconstructedCerts.length > 0) {
                        mainData.certificates = reconstructedCerts;
                    }

                    // Proceed to Modal
                    if (Object.keys(mainData).length > 0) {
                        setImportData(mainData);
                    } else {
                        alert("Не удалось найти данные в архиве.");
                    }

                } else {
                    // --- JSON IMPORT (Legacy/Single File) ---
                    const text = e.target?.result as string;
                    const data: ImportData = JSON.parse(text);
                    if (data.template !== undefined || Array.isArray(data.acts) || Array.isArray(data.people)) {
                        setImportData(data);
                    } else {
                        alert('Ошибка: Неверный формат JSON файла.');
                    }
                }
            } catch (error) {
                console.error('Import error:', error);
                alert('Не удалось импортировать данные. Файл может быть поврежден.');
            } finally {
                if(event.target) event.target.value = '';
            }
        };

        if (isZip) {
            reader.readAsBinaryString(file); // PizZip expects binary string or arraybuffer
        } else {
            reader.readAsText(file); // JSON
        }
    };

    const handleExecuteImport = (importSettings: ImportSettings) => {
        if (!importData) return;

        if (importSettings.template && importData.template !== undefined) {
            setTemplate(importData.template);
        }
        if (importSettings.registryTemplate && importData.registryTemplate !== undefined) {
            setRegistryTemplate(importData.registryTemplate);
        }
        if (importSettings.projectSettings && importData.projectSettings) {
            setSettings(importData.projectSettings);
        }
        
        const mergeOrReplace = <T extends {id: string} | DeletedActEntry | DeletedCertificateEntry>(
            key: 'acts' | 'people' | 'organizations' | 'groups' | 'deletedActs' | 'regulations' | 'certificates' | 'deletedCertificates',
            setData: React.Dispatch<React.SetStateAction<any>>,
            sortFn: ((a: T, b: T) => number) | null
        ) => {
            // @ts-ignore dynamic access
            if ((importSettings[key]?.import || (key === 'deletedCertificates' && importSettings['deletedActs']?.import)) && importData[key]) {
                 // @ts-ignore
                 const mode = importSettings[key]?.mode || 'merge';
                 // @ts-ignore
                 const selectedIds = importSettings[key]?.selectedIds;

                 if (mode === 'replace') {
                    // @ts-ignore
                    setData(importData[key]);
                } else {
                     // @ts-ignore
                    const selectedItems = (importData[key] as T[]).filter(item => {
                        const id = 'act' in item ? item.act.id : 'certificate' in item ? item.certificate.id : item.id;
                        return selectedIds?.includes(id)
                    });
                    setData((prev: T[]) => {
                        const itemMap = new Map(prev.map(item => ['act' in item ? item.act.id : 'certificate' in item ? item.certificate.id : item.id, item]));
                        selectedItems.forEach(item => itemMap.set('act' in item ? item.act.id : 'certificate' in item ? item.certificate.id : item.id, item));
                        const newArray = Array.from(itemMap.values());
                        return sortFn ? newArray.sort(sortFn) : newArray;
                    });
                }
            }
        };

        mergeOrReplace('acts', setActs, null);
        mergeOrReplace('deletedActs', setDeletedActs, (a, b) => new Date((b as DeletedActEntry).deletedOn).getTime() - new Date((a as DeletedActEntry).deletedOn).getTime());
        mergeOrReplace('people', setPeople, (a,b) => (a as Person).name.localeCompare((b as Person).name));
        mergeOrReplace('organizations', setOrganizations, (a,b) => (a as Organization).name.localeCompare((b as Organization).name));
        mergeOrReplace('groups', setGroups, (a,b) => (a as CommissionGroup).name.localeCompare((b as CommissionGroup).name));
        mergeOrReplace('regulations', setRegulations, (a,b) => (a as Regulation).designation.localeCompare((b as Regulation).designation));
        mergeOrReplace('certificates', setCertificates, (a,b) => (a as Certificate).number.localeCompare((b as Certificate).number));
        // Simple merge for deleted certs for now, assuming if user imports data they want trash too if present
        if (importData.deletedCertificates) {
             setDeletedCertificates(prev => [...prev, ...importData.deletedCertificates!]);
        }
        
        // Reset history on import to avoid conflicts
        setPast([]);
        setFuture([]);

        setImportData(null);
        alert('Данные успешно импортированы!');
    };

    const handleChangeTemplate = () => {
        setConfirmation({
            title: 'Сменить шаблон',
            message: 'Вы уверены, что хотите сменить шаблон? Текущий шаблон будет удален.',
            confirmText: 'Сменить',
            onConfirm: () => {
                setTemplate(null);
                setConfirmation(null);
            }
        });
    }

    const requestConfirmation = (
        title: string, 
        message: React.ReactNode, 
        onConfirm: () => void, 
        confirmText?: string
    ) => {
        setConfirmation({
            title,
            message,
            onConfirm: () => {
                onConfirm();
                setConfirmation(null);
            },
            confirmText,
        });
    };

    const renderPage = () => {
        switch (currentPage) {
            case 'acts':
                return <ActsPage 
                            acts={acts} 
                            people={people} 
                            organizations={organizations}
                            groups={groups}
                            regulations={regulations}
                            certificates={certificates}
                            template={template}
                            registryTemplate={registryTemplate}
                            settings={settings}
                            onSave={handleSaveAct} 
                            onMoveToTrash={handleMoveActsToTrash}
                            onPermanentlyDelete={handleDirectPermanentDelete}
                            onReorderActs={handleReorderActs}
                            setCurrentPage={setCurrentPage}
                            onUndo={undo}
                            onRedo={redo}
                            onNavigateToCertificate={handleNavigateToCertificate}
                        />;
            case 'people':
                return <PeoplePage people={people} organizations={organizations} settings={settings} onSave={handleSavePerson} onDelete={handleDeletePerson} />;
            case 'organizations':
                 return <OrganizationsPage organizations={organizations} settings={settings} onSave={handleSaveOrganization} onDelete={handleDeleteOrganization} />;
             case 'groups':
                return <GroupsPage groups={groups} people={people} organizations={organizations} onSave={handleSaveGroup} onDelete={handleDeleteGroup} />;
            case 'trash':
                return <TrashPage 
                            deletedActs={deletedActs}
                            deletedCertificates={deletedCertificates}
                            onRestoreActs={handleRestoreActs}
                            onRestoreCertificates={handleRestoreCertificate}
                            onPermanentlyDeleteActs={handlePermanentlyDeleteActs}
                            onPermanentlyDeleteCertificates={handlePermanentDeleteCertificate}
                            requestConfirmation={requestConfirmation}
                        />;
            case 'regulations':
                return <RegulationsPage regulations={regulations} onSaveRegulations={setRegulations} />;
            case 'certificates':
                return <CertificatesPage 
                            certificates={certificates} 
                            acts={acts}
                            settings={settings} 
                            onSave={handleSaveCertificate} 
                            onDelete={(id) => handleMoveCertificateToTrash(id)}
                            onUnlink={(cert) => handleRemoveCertificateLinksFromActs(cert)}
                            initialOpenId={targetCertificateId}
                            onClearInitialOpenId={() => setTargetCertificateId(null)}
                        />;
            case 'settings':
                return <SettingsPage 
                            settings={settings} 
                            onSave={handleSaveSettings} 
                            onImport={handleImportClick}
                            onExport={handleExportClick}
                            onChangeTemplate={handleChangeTemplate}
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
        <div className="flex h-screen bg-slate-100 font-sans text-slate-800">
             <input type="file" ref={importInputRef} onChange={handleImportFileSelected} className="hidden" accept=".json,.zip" />
             <Sidebar
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                isTemplateLoaded={!!template}
                trashCount={deletedActs.length + deletedCertificates.length}
                theme={theme}
                onToggleTheme={handleToggleTheme}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
                 <main className="flex-1 overflow-y-auto">
                    {!template ? (
                        <div className="h-full flex items-center justify-center">
                            <TemplateUploader onUpload={handleTemplateUpload} />
                        </div>
                    ) : (
                        renderPage()
                    )}
                </main>
            </div>
            
            {importData && (
                <ImportModal 
                    data={importData}
                    onClose={() => setImportData(null)}
                    onImport={handleExecuteImport}
                />
            )}

            {isExportModalOpen && (
                <ExportModal
                    onClose={() => setIsExportModalOpen(false)}
                    onExport={handleExecuteExport}
                    counts={{
                        acts: acts.length,
                        people: people.length,
                        organizations: organizations.length,
                        groups: groups.length,
                        regulations: regulations.length,
                        certificates: certificates.length,
                        deletedActs: deletedActs.length,
                        deletedCertificates: deletedCertificates.length,
                        hasTemplate: !!template,
                        hasRegistryTemplate: !!registryTemplate
                    }}
                />
            )}

            {confirmation && (
                <ConfirmationModal
                    isOpen={!!confirmation}
                    onClose={() => setConfirmation(null)}
                    onConfirm={confirmation.onConfirm}
                    title={confirmation.title}
                    confirmText={confirmation.confirmText}
                >
                    {confirmation.message}
                </ConfirmationModal>
            )}

            {restoreGroupConfirmation && (
                 <RestoreGroupConfirmationModal
                    isOpen={!!restoreGroupConfirmation}
                    onClose={() => setRestoreGroupConfirmation(null)}
                    groupsToRestore={restoreGroupConfirmation.groupsToRestore}
                    onConfirm={restoreGroupConfirmation.onConfirm}
                />
            )}
        </div>
    );
};

export default App;