import React, { useState, useCallback, useRef } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Act, Person, Organization, ImportSettings, ImportData, ProjectSettings, CommissionGroup, Page } from './types';
import TemplateUploader from './components/TemplateUploader';
import ImportModal from './components/ImportModal';
import ConfirmationModal from './components/ConfirmationModal';
import ActsPage from './pages/ActsPage';
import PeoplePage from './pages/PeoplePage';
import OrganizationsPage from './pages/OrganizationsPage';
import SettingsPage from './pages/SettingsPage';
import GroupsPage from './pages/GroupsPage';
import Sidebar from './components/Sidebar';
import { saveAs } from 'file-saver';

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

const App: React.FC = () => {
    const [template, setTemplate] = useLocalStorage<string | null>('docx_template', null);
    const [acts, setActs] = useLocalStorage<Act[]>('acts_data', []);
    const [people, setPeople] = useLocalStorage<Person[]>('people_data', []);
    const [organizations, setOrganizations] = useLocalStorage<Organization[]>('organizations_data', []);
    const [groups, setGroups] = useLocalStorage<CommissionGroup[]>('commission_groups', []);
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
    });
    const [currentPage, setCurrentPage] = useState<Page>('acts');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const importInputRef = useRef<HTMLInputElement>(null);
    const [importData, setImportData] = useState<ImportData | null>(null);
    const [confirmation, setConfirmation] = useState<{
        title: string;
        message: React.ReactNode;
        onConfirm: () => void;
        confirmText?: string;
    } | null>(null);
    
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

    const handleSaveAct = useCallback((actToSave: Act, insertAtIndex?: number) => {
        setActs(prevActs => {
            const exists = prevActs.some(a => a.id === actToSave.id);
            if (exists) {
                return prevActs.map(a => (a.id === actToSave.id ? actToSave : a));
            }
            
            const newActs = [...prevActs];
            const finalIndex = insertAtIndex === undefined ? newActs.length : insertAtIndex;
            newActs.splice(finalIndex, 0, actToSave);
            return newActs;
        });
    }, [setActs]);

    const handleDeleteAct = useCallback((id: string) => {
        setActs(prevActs => prevActs.filter(a => a.id !== id));
    }, [setActs]);
    
    const handleReorderActs = useCallback((newActs: Act[]) => {
        setActs(newActs);
    }, [setActs]);
    
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
            message: `Вы уверены, что хотите удалить участника "${personToDelete.name}"? Он также будет удален из всех актов.`,
            onConfirm: () => {
                setPeople(prevPeople => prevPeople.filter(p => p.id !== id));
                setActs(prevActs => prevActs.map(act => {
                    const newReps = { ...act.representatives };
                    Object.keys(newReps).forEach(key => {
                        const repKey = key as keyof typeof newReps;
                        if (newReps[repKey] === id) {
                            delete newReps[repKey];
                        }
                    });
                    return { ...act, representatives: newReps };
                }));
                setConfirmation(null);
            }
        });
    }, [people, setPeople, setActs]);

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

    const handleSaveSettings = useCallback((newSettings: ProjectSettings) => {
        setSettings(newSettings);
    }, [setSettings]);
    
    const handleExportData = () => {
        try {
            const dataToExport = {
                template,
                acts,
                people,
                organizations,
                groups,
                projectSettings: settings,
            };
            const jsonString = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const timestamp = new Date().toISOString().split('.')[0].replace('T', '_').replace(/:/g, '-');
            saveAs(blob, `docgen-ai-backup-${timestamp}.json`);
        } catch (error) {
            console.error('Export error:', error);
            alert('Не удалось экспортировать данные.');
        }
    };
    
    const handleImportClick = () => {
        importInputRef.current?.click();
    };

    const handleImportFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("Failed to read file");
                
                const data: ImportData = JSON.parse(text);
                
                if (data.template !== undefined || Array.isArray(data.acts) || Array.isArray(data.people) || Array.isArray(data.organizations) || Array.isArray(data.groups) || data.projectSettings) {
                    setImportData(data);
                } else {
                    alert('Ошибка: Неверный формат файла.');
                }
            } catch (error) {
                console.error('Import error:', error);
                alert('Не удалось импортировать данные. Файл может быть поврежден или иметь неверный формат.');
            } finally {
                if(event.target) event.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleExecuteImport = (importSettings: ImportSettings) => {
        if (!importData) return;

        if (importSettings.template && importData.template !== undefined) {
            setTemplate(importData.template);
        }
        if (importSettings.projectSettings && importData.projectSettings) {
            setSettings(importData.projectSettings);
        }
        
        const mergeOrReplace = <T extends {id: string}>(
            key: 'acts' | 'people' | 'organizations' | 'groups',
            setData: React.Dispatch<React.SetStateAction<T[]>>,
            sortFn: ((a: T, b: T) => number) | null
        ) => {
            if (importSettings[key]?.import && importData[key]) {
                 if (importSettings[key].mode === 'replace') {
                    // FIX: Cast to unknown first to satisfy TypeScript's strict type checking for generic unions.
                    setData(importData[key] as unknown as T[]);
                } else {
                    // FIX: Cast to unknown first to satisfy TypeScript's strict type checking for generic unions.
                    const selectedItems = (importData[key] as unknown as T[]).filter(item => importSettings[key].selectedIds?.includes(item.id));
                    setData(prev => {
                        const itemMap = new Map(prev.map(item => [item.id, item]));
                        selectedItems.forEach(item => itemMap.set(item.id, item));
                        const newArray = Array.from(itemMap.values());
                        return sortFn ? newArray.sort(sortFn) : newArray;
                    });
                }
            }
        };

        mergeOrReplace('acts', setActs, null);
        mergeOrReplace('people', setPeople, (a,b) => a.name.localeCompare(b.name));
        mergeOrReplace('organizations', setOrganizations, (a,b) => a.name.localeCompare(b.name));
        mergeOrReplace('groups', setGroups, (a,b) => a.name.localeCompare(b.name));
        
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
                            template={template}
                            settings={settings}
                            onSave={handleSaveAct} 
                            onDelete={handleDeleteAct}
                            onReorderActs={handleReorderActs}
                            setCurrentPage={setCurrentPage}
                            requestConfirmation={requestConfirmation}
                        />;
            case 'people':
                return <PeoplePage people={people} organizations={organizations} settings={settings} onSave={handleSavePerson} onDelete={handleDeletePerson} />;
            case 'organizations':
                 return <OrganizationsPage organizations={organizations} settings={settings} onSave={handleSaveOrganization} onDelete={handleDeleteOrganization} />;
             case 'groups':
                return <GroupsPage groups={groups} people={people} organizations={organizations} onSave={handleSaveGroup} onDelete={handleDeleteGroup} />;
            case 'settings':
                return <SettingsPage settings={settings} onSave={handleSaveSettings} />;
            default:
                return null;
        }
    };

    return (
        <div className="flex h-screen bg-slate-100 font-sans text-slate-800">
             <input type="file" ref={importInputRef} onChange={handleImportFileSelected} className="hidden" accept=".json" />
             <Sidebar
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                isTemplateLoaded={!!template}
                onImport={handleImportClick}
                onExport={handleExportData}
                onChangeTemplate={handleChangeTemplate}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
                 <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
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
        </div>
    );
};

export default App;
