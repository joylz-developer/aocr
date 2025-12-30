
import React, { useState } from 'react';
import { Certificate } from '../types';
import { CertificateIcon } from './Icons';
import MaterialsModal from './MaterialsModal';

interface MaterialsInputProps {
    value: string;
    onChange: (value: string) => void;
    certificates: Certificate[];
}

const MaterialsInput: React.FC<MaterialsInputProps> = ({ value, onChange, certificates }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSelectMaterial = (text: string) => {
        const newValue = value ? `${value}; ${text}` : text;
        onChange(newValue);
        setIsModalOpen(false);
    };

    return (
        <div className="w-full h-full relative group">
            <textarea
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    // Resize logic matching ActsTable behavior
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                className="w-full h-full resize-none bg-transparent outline-none overflow-hidden pr-6" // Padding for icon
                rows={1}
                placeholder=""
                ref={(el) => {
                    if (el) {
                         el.style.height = 'auto';
                         el.style.height = `${el.scrollHeight}px`;
                    }
                }}
            />
            <button
                type="button"
                className="absolute top-0 right-0 p-1 text-slate-400 hover:text-blue-600 bg-white/50 hover:bg-white rounded shadow-sm z-10"
                title="Добавить из сертификатов"
                onClick={() => setIsModalOpen(true)}
            >
                <CertificateIcon className="w-4 h-4" />
            </button>

            {isModalOpen && (
                <MaterialsModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    certificates={certificates}
                    onSelect={handleSelectMaterial}
                />
            )}
        </div>
    );
};

export default MaterialsInput;