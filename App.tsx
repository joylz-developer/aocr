import React, { useState, useCallback, useRef } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Act, Person, Organization, ImportSettings, ImportData, ProjectSettings } from './types';
import TemplateUploader from './components/TemplateUploader';
import ImportModal from './components/ImportModal';
import ActsPage from './pages/ActsPage';
import PeoplePage from './pages/PeoplePage';
import OrganizationsPage from './pages/OrganizationsPage';
import SettingsPage from './pages/SettingsPage';
import Sidebar from './components/Sidebar';
import { saveAs } from 'file-saver';

export type Page = 'acts' | 'people' | 'organizations' | 'settings';

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

    const handleSaveAct = useCallback((actToSave: Act) => {
        setActs(prevActs => {
            const exists = prevActs.some(a => a.id === actToSave.id);
            if (exists) {
                return prevActs.map(a => (a.id === actToSave.id ? actToSave : a));
            }
            return [...prevActs, actToSave].sort((a, b) => a.date.localeCompare(b.date));
        });
    }, [setActs]);

    const handleDeleteAct = useCallback((id: string) => {
        if (window.confirm('Вы уверены, что хотите удалить этот акт?')) {
            setActs(prevActs => prevActs.filter(a => a.id !== id));
        }
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

        if (window.confirm(`Вы уверены, что хотите удалить участника "${personToDelete.name}"? Он также будет удален из всех актов.`)) {
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
        }
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

        if (window.confirm(`Вы уверены, что хотите удалить организацию "${orgToDelete.name}"?`)) {
            setOrganizations(prevOrgs => prevOrgs.filter(o => o.id !== id));
        }
    }, [organizations, people, setOrganizations]);

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
                
                if (data.template !== undefined || Array.isArray(data.acts) || Array.isArray(data.people) || Array.isArray(data.organizations) || data.projectSettings) {
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
        
        if (importSettings.acts.import && importData.acts) {
            if (importSettings.acts.mode === 'replace') {
                setActs(importData.acts);
            } else {
                const selectedItems = importData.acts.filter(item => importSettings.acts.selectedIds?.includes(item.id));
                setActs(prev => {
                    const itemMap = new Map(prev.map(item => [item.id, item]));
                    selectedItems.forEach(item => itemMap.set(item.id, item));
                    return Array.from(itemMap.values()).sort((a,b) => a.date.localeCompare(b.date));
                });
            }
        }

        if (importSettings.people.import && importData.people) {
            if (importSettings.people.mode === 'replace') {
                setPeople(importData.people);
            } else {
                const selectedItems = importData.people.filter(item => importSettings.people.selectedIds?.includes(item.id));
                setPeople(prev => {
                    const itemMap = new Map(prev.map(item => [item.id, item]));
                    selectedItems.forEach(item => itemMap.set(item.id, item));
                    return Array.from(itemMap.values()).sort((a,b) => a.name.localeCompare(b.name));
                });
            }
        }
        
        if (importSettings.organizations.import && importData.organizations) {
            if (importSettings.organizations.mode === 'replace') {
                setOrganizations(importData.organizations);
            } else {
                const selectedItems = importData.organizations.filter(item => importSettings.organizations.selectedIds?.includes(item.id));
                setOrganizations(prev => {
                    const itemMap = new Map(prev.map(item => [item.id, item]));
                    selectedItems.forEach(item => itemMap.set(item.id, item));
                    return Array.from(itemMap.values()).sort((a,b) => a.name.localeCompare(b.name));
                });
            }
        }
        
        setImportData(null);
        alert('Данные успешно импортированы!');
    };

    const handleChangeTemplate = () => {
        if (window.confirm('Вы уверены, что хотите сменить шаблон? Текущий шаблон будет удален.')) {
            setTemplate(null);
        }
    }

    const renderPage = () => {
        switch (currentPage) {
            case 'acts':
                return <ActsPage 
                            acts={acts} 
                            people={people} 
                            organizations={organizations}
                            template={template}
                            settings={settings}
                            onSave={handleSaveAct} 
                            onDelete={handleDeleteAct} 
                        />;
            case 'people':
                return <PeoplePage people={people} organizations={organizations} settings={settings} onSave={handleSavePerson} onDelete={handleDeletePerson} />;
            case 'organizations':
                 return <OrganizationsPage organizations={organizations} settings={settings} onSave={handleSaveOrganization} onDelete={handleDeleteOrganization} />;
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
        </div>
    );
};

export default App;