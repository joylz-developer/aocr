
import React, { useCallback, useState } from 'react';

interface TemplateUploaderProps {
    onUpload: (file: File) => void;
}

const FileUploader: React.FC<TemplateUploaderProps> = ({ onUpload }) => {
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                setError(null);
                onUpload(file);
            } else {
                setError('Пожалуйста, выберите файл в формате .docx');
            }
        }
    }, [onUpload]);

    return (
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-lg mx-auto mt-10">
            <h2 className="text-2xl font-bold mb-4">Начало работы</h2>
            <p className="text-slate-600 mb-6">
                Для начала, пожалуйста, загрузите ваш шаблон акта в формате .docx.
                Приложение сохранит его в вашем браузере.
            </p>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 hover:border-blue-500 transition-colors">
                 <input
                    type="file"
                    id="template-upload"
                    className="hidden"
                    accept=".docx"
                    onChange={handleFileChange}
                />
                <label htmlFor="template-upload" className="cursor-pointer bg-blue-600 text-white font-semibold py-2 px-6 rounded-md hover:bg-blue-700 transition-colors">
                    Выбрать файл .docx
                </label>
                {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
            </div>
             <p className="text-xs text-slate-400 mt-4">
               Вся информация хранится локально в вашем браузере и никуда не передается.
            </p>
        </div>
    );
};

export default FileUploader;
