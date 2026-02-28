import React, { useState, useEffect } from 'react';
import FileUploader from './components/FileUploader';
import { ConstructionObject } from './types';

// Inline useLocalStorage since the hook file was deleted
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };

    return [storedValue, setValue];
}

const App: React.FC = () => {
    const [template, setTemplate] = useLocalStorage<string | null>('docx_template', null);
    const [theme, setTheme] = useLocalStorage<'light' | 'dark' | 'eye-protection'>('app_theme', 'light');

    useEffect(() => {
        const html = document.documentElement;
        html.classList.remove('theme-light', 'theme-dark', 'theme-eye-protection');
        html.classList.add(`theme-${theme}`);
    }, [theme]);

    const handleTemplateUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
             if (typeof e.target?.result === 'string') {
                 const base64 = e.target.result.split(',')[1];
                 setTemplate(base64);
             }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className={`min-h-screen bg-slate-100 font-sans text-slate-900 theme-${theme} p-8`}>
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">Document Generator</h1>
                
                {!template ? (
                    <FileUploader onUpload={handleTemplateUpload} />
                ) : (
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-semibold mb-4">Template Loaded</h2>
                        <p className="mb-4">The template has been loaded successfully.</p>
                        <p className="text-red-500">
                            Warning: Many components (Acts, People, Organizations, etc.) were deleted from the project.
                            Functionality is currently limited to template uploading.
                        </p>
                        <button 
                            onClick={() => setTemplate(null)}
                            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                            Reset Template
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
