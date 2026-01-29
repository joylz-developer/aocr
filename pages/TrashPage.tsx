
import React, { useState } from 'react';
import { DeletedActEntry, DeletedCertificateEntry } from '../types';
import { RestoreIcon, DeleteIcon, TrashIcon, CertificateIcon, ActsIcon } from '../components/Icons';

interface TrashPageProps {
    deletedActs: DeletedActEntry[];
    deletedCertificates?: DeletedCertificateEntry[]; // New optional prop
    onRestoreActs?: (entries: DeletedActEntry[]) => void; // Renamed for clarity
    onRestoreCertificates?: (entries: DeletedCertificateEntry[]) => void;
    onPermanentlyDeleteActs?: (actIds: string[]) => void;
    onPermanentlyDeleteCertificates?: (certIds: string[]) => void;
    
    // Legacy support for App.tsx before full update
    onRestore?: (entries: DeletedActEntry[]) => void;
    onPermanentlyDelete?: (actIds: string[]) => void;
    
    requestConfirmation: (title: string, message: React.ReactNode, onConfirm: () => void) => void;
}

type Tab = 'acts' | 'certificates';

const TrashPage: React.FC<TrashPageProps> = ({ 
    deletedActs, 
    deletedCertificates = [], 
    onRestoreActs, 
    onRestoreCertificates,
    onPermanentlyDeleteActs, 
    onPermanentlyDeleteCertificates,
    onRestore, 
    onPermanentlyDelete, 
    requestConfirmation 
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('acts');
    const [selectedActIds, setSelectedActIds] = useState<Set<string>>(new Set());
    const [selectedCertIds, setSelectedCertIds] = useState<Set<string>>(new Set());

    // Normalize handlers
    const restoreActsHandler = onRestoreActs || onRestore;
    const deleteActsHandler = onPermanentlyDeleteActs || onPermanentlyDelete;

    // --- Acts Logic ---
    const handleToggleAllActs = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) setSelectedActIds(new Set(deletedActs.map(entry => entry.act.id)));
        else setSelectedActIds(new Set());
    };

    const handleToggleOneAct = (actId: string) => {
        setSelectedActIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(actId)) newSet.delete(actId);
            else newSet.add(actId);
            return newSet;
        });
    };

    const handleBulkRestoreActs = () => {
        const entriesToRestore = deletedActs.filter(entry => selectedActIds.has(entry.act.id));
        if (entriesToRestore.length > 0 && restoreActsHandler) {
            restoreActsHandler(entriesToRestore);
            setSelectedActIds(new Set());
        }
    };
    
    const handleBulkDeleteActs = () => {
        if(selectedActIds.size === 0 || !deleteActsHandler) return;
        requestConfirmation(
            'Окончательное удаление',
            `Вы уверены, что хотите навсегда удалить ${selectedActIds.size} акт(ов)? Это действие необратимо.`,
            () => {
                deleteActsHandler(Array.from(selectedActIds));
                setSelectedActIds(new Set());
            }
        );
    };

    const handleEmptyActsTrash = () => {
         if(deletedActs.length === 0 || !deleteActsHandler) return;
        requestConfirmation(
            'Очистить корзину актов',
            'Вы уверены, что хотите навсегда удалить все акты из корзины? Это действие необратимо.',
            () => {
                deleteActsHandler(deletedActs.map(entry => entry.act.id));
                setSelectedActIds(new Set());
            }
        );
    };

    // --- Certificates Logic ---
    const handleToggleAllCerts = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) setSelectedCertIds(new Set(deletedCertificates.map(entry => entry.certificate.id)));
        else setSelectedCertIds(new Set());
    };

    const handleToggleOneCert = (id: string) => {
        setSelectedCertIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleBulkRestoreCerts = () => {
        const entriesToRestore = deletedCertificates.filter(entry => selectedCertIds.has(entry.certificate.id));
        if (entriesToRestore.length > 0 && onRestoreCertificates) {
            onRestoreCertificates(entriesToRestore);
            setSelectedCertIds(new Set());
        }
    };

    const handleBulkDeleteCerts = () => {
        if(selectedCertIds.size === 0 || !onPermanentlyDeleteCertificates) return;
        requestConfirmation(
            'Окончательное удаление',
            `Вы уверены, что хотите навсегда удалить ${selectedCertIds.size} сертификат(ов)? Это действие необратимо.`,
            () => {
                onPermanentlyDeleteCertificates(Array.from(selectedCertIds));
                setSelectedCertIds(new Set());
            }
        );
    };

    const handleEmptyCertsTrash = () => {
        if(deletedCertificates.length === 0 || !onPermanentlyDeleteCertificates) return;
        requestConfirmation(
            'Очистить корзину сертификатов',
            'Вы уверены, что хотите навсегда удалить все сертификаты? Это действие необратимо.',
            () => {
                onPermanentlyDeleteCertificates(deletedCertificates.map(entry => entry.certificate.id));
                setSelectedCertIds(new Set());
            }
        );
    };


    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h1 className="text-2xl font-bold text-slate-800">Корзина</h1>
                
                {/* Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('acts')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'acts' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <ActsIcon className="w-4 h-4" /> Акты ({deletedActs.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('certificates')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'certificates' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <CertificateIcon className="w-4 h-4" /> Сертификаты ({deletedCertificates.length})
                    </button>
                </div>
            </div>

            {/* ACTS VIEW */}
            {activeTab === 'acts' && (
                <div className="flex flex-col h-full overflow-hidden">
                    <div className="flex justify-end mb-4">
                        <button 
                            onClick={handleEmptyActsTrash} 
                            disabled={deletedActs.length === 0}
                            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-1.5 text-sm rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">
                            <DeleteIcon className="w-4 h-4" /> Очистить
                        </button>
                    </div>

                    {selectedActIds.size > 0 && (
                        <div className="mb-4 bg-slate-50 p-3 rounded-md border border-slate-200 flex items-center justify-between animate-fade-in-up">
                            <span className="text-sm font-semibold text-slate-700">Выбрано: {selectedActIds.size}</span>
                            <div className="flex items-center gap-3">
                                <button onClick={handleBulkRestoreActs} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 text-sm rounded-md hover:bg-blue-700">
                                    <RestoreIcon className="w-4 h-4" /> Восстановить
                                </button>
                                <button onClick={handleBulkDeleteActs} className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 text-sm rounded-md hover:bg-red-700">
                                    <DeleteIcon className="w-4 h-4" /> Удалить
                                </button>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex-grow min-h-0 overflow-y-auto border border-slate-200 rounded-md">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left w-10">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 form-checkbox-custom"
                                            checked={deletedActs.length > 0 && selectedActIds.size === deletedActs.length}
                                            onChange={handleToggleAllActs}
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Акт</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Дата удаления</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Связанная группа</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {deletedActs.length > 0 ? deletedActs.map(entry => (
                                    <tr key={entry.act.id} className={`hover:bg-slate-50 ${selectedActIds.has(entry.act.id) ? 'bg-blue-50' : ''}`}>
                                        <td className="px-4 py-4">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 form-checkbox-custom"
                                                checked={selectedActIds.has(entry.act.id)}
                                                onChange={() => handleToggleOneAct(entry.act.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-slate-900">№{entry.act.number || '(б/н)'}</div>
                                            <div className="text-sm text-slate-500 truncate max-w-xs" title={entry.act.workName}>{entry.act.workName}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDate(entry.deletedOn)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            {entry.associatedGroup ? entry.associatedGroup.name : <span className="text-slate-400 italic">Нет</span>}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="text-center py-16 text-slate-500">
                                            <TrashIcon className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                                            Корзина актов пуста
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* CERTIFICATES VIEW */}
            {activeTab === 'certificates' && (
                <div className="flex flex-col h-full overflow-hidden">
                    <div className="flex justify-end mb-4">
                        <button 
                            onClick={handleEmptyCertsTrash} 
                            disabled={deletedCertificates.length === 0}
                            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-1.5 text-sm rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">
                            <DeleteIcon className="w-4 h-4" /> Очистить
                        </button>
                    </div>

                    {selectedCertIds.size > 0 && (
                        <div className="mb-4 bg-slate-50 p-3 rounded-md border border-slate-200 flex items-center justify-between animate-fade-in-up">
                            <span className="text-sm font-semibold text-slate-700">Выбрано: {selectedCertIds.size}</span>
                            <div className="flex items-center gap-3">
                                <button onClick={handleBulkRestoreCerts} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 text-sm rounded-md hover:bg-blue-700">
                                    <RestoreIcon className="w-4 h-4" /> Восстановить
                                </button>
                                <button onClick={handleBulkDeleteCerts} className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 text-sm rounded-md hover:bg-red-700">
                                    <DeleteIcon className="w-4 h-4" /> Удалить
                                </button>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex-grow min-h-0 overflow-y-auto border border-slate-200 rounded-md">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left w-10">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 form-checkbox-custom"
                                            checked={deletedCertificates.length > 0 && selectedCertIds.size === deletedCertificates.length}
                                            onChange={handleToggleAllCerts}
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Сертификат</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Дата удаления</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Материалы</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {deletedCertificates.length > 0 ? deletedCertificates.map(entry => (
                                    <tr key={entry.certificate.id} className={`hover:bg-slate-50 ${selectedCertIds.has(entry.certificate.id) ? 'bg-blue-50' : ''}`}>
                                        <td className="px-4 py-4">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 form-checkbox-custom"
                                                checked={selectedCertIds.has(entry.certificate.id)}
                                                onChange={() => handleToggleOneCert(entry.certificate.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-slate-900">{entry.certificate.number}</div>
                                            <div className="text-xs text-slate-500">Действ. до: {new Date(entry.certificate.validUntil).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatDate(entry.deletedOn)}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            <span className="truncate block max-w-xs" title={entry.certificate.materials.join(', ')}>
                                                {entry.certificate.materials.join(', ')}
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="text-center py-16 text-slate-500">
                                            <TrashIcon className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                                            Корзина сертификатов пуста
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrashPage;
