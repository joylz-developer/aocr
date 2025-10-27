import React, { useState, useCallback, useRef } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Act, Person, Organization, ImportSettings, ImportData, ProjectSettings } from './types';
import TemplateUploader from './components/TemplateUploader';
import ImportModal from './components/ImportModal';
import ActsPage from './pages/ActsPage';
import PeoplePage from './pages/PeoplePage';
import OrganizationsPage from './pages/OrganizationsPage';
import SettingsPage from './pages/SettingsPage';
import { saveAs } from 'file-saver';

type Page = 'acts' | 'people' | 'organizations' | 'settings';

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
        showParticipantDetails: false,
        geminiApiKey: '',
        // FIX: Removed 'visibleWorkItemColumns' property as it's not defined in the ProjectSettings type.
    });
    const [currentPage, setCurrentPage] = useState<Page>('acts');
    const importInputRef = useRef<HTMLInputElement>(null);
    const [importData, setImportData] = useState<ImportData | null>(null);
    
    const handleTemplateUpload = async (file: File) => {
        try {
            const isFirstTime = acts.length === 0 && people.length === 0 && organizations.length === 0;
            const base64 = await fileToBase64(file);
            setTemplate(base64);
            // If it's the first time setting up, guide user to settings page
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
            // Also remove this person from any acts
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
                
                // Basic validation
                if (data.template !== undefined || Array.isArray(data.acts) || Array.isArray(data.people) || Array.isArray(data.organizations) || data.projectSettings) {
                    setImportData(data); // Open modal with parsed data
                } else {
                    alert('Ошибка: Неверный формат файла.');
                }
            } catch (error) {
                console.error('Import error:', error);
                alert('Не удалось импортировать данные. Файл может быть поврежден или иметь неверный формат.');
            } finally {
                if(event.target) event.target.value = ''; // Reset input to allow re-importing same file
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
            } else { // merge
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
            } else { // merge
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
            } else { // merge
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

    const NavButton: React.FC<{ page: Page; label: string; disabled?: boolean }> = ({ page, label, disabled }) => (
        <button
            onClick={() => setCurrentPage(page)}
            disabled={disabled}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentPage === page && !disabled
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 hover:bg-slate-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            {label}
        </button>
    );

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
        <div className="bg-slate-100 min-h-screen font-sans text-slate-800">
            <header className="bg-white shadow-sm">
                <div className="px-4 py-4 flex justify-between items-center">
                     <h1 className="text-xl font-bold text-blue-700">DocGen AI</h1>
                     <nav className="flex items-center space-x-2">
                        <NavButton page="acts" label="Акты" disabled={!template} />
                        <NavButton page="people" label="Участники" disabled={!template} />
                        <NavButton page="organizations" label="Организации" disabled={!template} />
                        <NavButton page="settings" label="Настройки" disabled={!template} />
                     </nav>
                     <div className="flex items-center space-x-4">
                        <input type="file" ref={importInputRef} onChange={handleImportFileSelected} className="hidden" accept=".json" />
                        <button onClick={handleImportClick} className="text-sm text-slate-500 hover:text-blue-600">Импорт</button>
                        {template && (
                            <>
                                <button onClick={handleExportData} className="text-sm text-slate-500 hover:text-blue-600">Экспорт</button>
                                <button onClick={() => setTemplate(null)} className="text-sm text-slate-500 hover:text-red-600">Сменить шаблон</button>
                            </>
                        )}
                     </div>
                </div>
            </header>
            <main className="px-4 py-8">
                {!template ? (
                    <TemplateUploader onUpload={handleTemplateUpload} />
                ) : (
                    renderPage()
                )}
            </main>
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