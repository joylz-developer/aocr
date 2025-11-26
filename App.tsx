
import React, { useState, useCallback, useRef } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Act, Person, Organization, ImportSettings, ImportData, ProjectSettings, CommissionGroup, Page, DeletedActEntry, Regulation } from './types';
import TemplateUploader from './components/TemplateUploader';
import ImportModal from './components/ImportModal';
import ConfirmationModal from './components/ConfirmationModal';
import RestoreGroupConfirmationModal from './components/RestoreGroupConfirmationModal';
import ActsPage from './pages/ActsPage';
import PeoplePage from './pages/PeoplePage';
import OrganizationsPage from './pages/OrganizationsPage';
import SettingsPage from './pages/SettingsPage';
import GroupsPage from './pages/GroupsPage';
import TrashPage from './pages/TrashPage';
import RegulationsPage from './pages/RegulationsPage';
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
    const [deletedActs, setDeletedActs] = useLocalStorage<DeletedActEntry[]>('deleted_acts', []);
    const [people, setPeople] = useLocalStorage<Person[]>('people_data', []);
    const [organizations, setOrganizations] = useLocalStorage<Organization[]>('organizations_data', []);
    const [groups, setGroups] = useLocalStorage<CommissionGroup[]>('commission_groups', []);
    const [regulations, setRegulations] = useLocalStorage<Regulation[]>('regulations_data', []);
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
    
    const [restoreGroupConfirmation, setRestoreGroupConfirmation] = useState<{
        entriesToRestore: DeletedActEntry[];
        groupsToRestore: CommissionGroup[];
        onConfirm: (restoreGroups: boolean) => void;
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

    const handleReorderActs = useCallback((newActs: Act[]) => {
        setActs(newActs);
    }, [setActs]);

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
        setActs(updatedRemainingActs);
    }, [acts, groups, setActs, setDeletedActs]);

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
            
            setActs(prev => [...prev, ...actsToRestore]);
            
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
    }, [groups, setActs, setGroups, setDeletedActs]);

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
                regulations,
                projectSettings: settings,
                deletedActs,
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
                
                if (data.template !== undefined || Array.isArray(data.acts) || Array.isArray(data.people) || Array.isArray(data.organizations) || Array.isArray(data.groups) || Array.isArray(data.regulations) || data.projectSettings || Array.isArray(data.deletedActs)) {
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
        
        const mergeOrReplace = <T extends {id: string} | DeletedActEntry>(
            key: 'acts' | 'people' | 'organizations' | 'groups' | 'deletedActs' | 'regulations',
            setData: React.Dispatch<React.SetStateAction<any>>,
            sortFn: ((a: T, b: T) => number) | null
        ) => {
            if (importSettings[key]?.import && importData[key]) {
                 if (importSettings[key].mode === 'replace') {
                    setData(importData[key]);
                } else {
                    const selectedItems = (importData[key] as T[]).filter(item => {
                        const id = 'act' in item ? item.act.id : item.id;
                        return importSettings[key].selectedIds?.includes(id)
                    });
                    setData((prev: T[]) => {
                        const itemMap = new Map(prev.map(item => ['act' in item ? item.act.id : item.id, item]));
                        selectedItems.forEach(item => itemMap.set('act' in item ? item.act.id : item.id, item));
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
                            template={template}
                            settings={settings}
                            onSave={handleSaveAct} 
                            onMoveToTrash={handleMoveActsToTrash}
                            onReorderActs={handleReorderActs}
                            setCurrentPage={setCurrentPage}
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
                            onRestore={handleRestoreActs}
                            onPermanentlyDelete={handlePermanentlyDeleteActs}
                            requestConfirmation={requestConfirmation}
                        />;
            case 'regulations':
                return <RegulationsPage regulations={regulations} onSaveRegulations={setRegulations} />;
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
                trashCount={deletedActs.length}
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