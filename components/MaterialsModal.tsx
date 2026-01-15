
import React, { useState, useMemo, useEffect } from 'react';
import Modal from './Modal';
import { Certificate } from '../types';
import { CertificateIcon, PlusIcon, CloseIcon, LinkIcon } from './Icons';

interface MaterialsModalProps {
    isOpen: boolean;
    onClose: () => void;
    certificates: Certificate[];
    onSelect: (selectedString: string) => void;
    initialSearch?: string;
    editingMaterialTitle?: string;
    onNavigateToCertificate?: (id: string) => void;
}

// --- Shared Fuzzy Logic (Duplicated from MaterialsInput to keep files self-contained) ---

const levenshteinDistance = (a: string, b: string): number => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

const HighlightMatch: React.FC<{ text: string; query: string }> = ({ text, query }) => {
    if (!query || !text) return <>{text}</>;

    const t = text.toLowerCase();
    const tokens = query.toLowerCase().split(/\s+/).filter(tk => tk.length > 0);
    const n = t.length;
    
    if (tokens.length === 0) return <>{text}</>;

    const matchedIndices = new Set<number>();

    const computeLCSIndices = (token: string) => {
        const m = token.length;
        if (m === 0) return;
        
        const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

        for (let i = 1; i <= n; i++) {
            for (let j = 1; j <= m; j++) {
                if (t[i - 1] === token[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        let i = n, j = m;
        while (i > 0 && j > 0) {
            if (t[i - 1] === token[j - 1]) {
                matchedIndices.add(i - 1);
                i--;
                j--;
            } else if (dp[i - 1][j] > dp[i][j - 1]) {
                i--;
            } else {
                j--;
            }
        }
    };

    tokens.forEach(token => computeLCSIndices(token));

    const elements: React.ReactNode[] = [];
    let lastIdx = 0;
    let isHighlighting = false;

    for (let k = 0; k < n; k++) {
        const isMatch = matchedIndices.has(k);
        if (isMatch !== isHighlighting) {
            if (k > lastIdx) {
                const chunk = text.substring(lastIdx, k);
                elements.push(
                    isHighlighting 
                        ? <span key={lastIdx} className="font-extrabold text-blue-600 bg-blue-50 rounded-[1px] px-0">{chunk}</span>
                        : <span key={lastIdx}>{chunk}</span>
                );
            }
            lastIdx = k;
            isHighlighting = isMatch;
        }
    }
    
    if (lastIdx < n) {
        const chunk = text.substring(lastIdx);
        elements.push(
            isHighlighting 
                ? <span key={lastIdx} className="font-extrabold text-blue-600 bg-blue-50 rounded-[1px] px-0">{chunk}</span>
                : <span key={lastIdx}>{chunk}</span>
        );
    }

    return <>{elements}</>;
};

// --- End Shared Logic ---

interface FilteredData {
    cert: Certificate;
    materials: { name: string; score: number }[];
    bestScore: number;
}

const MaterialsModal: React.FC<MaterialsModalProps> = ({ isOpen, onClose, certificates, onSelect, initialSearch, editingMaterialTitle, onNavigateToCertificate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCertId, setExpandedCertId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && initialSearch) {
            setSearchTerm(initialSearch);
        } else if (isOpen) {
            setSearchTerm('');
        }
    }, [isOpen, initialSearch]);

    const filteredData: FilteredData[] = useMemo(() => {
        if (!searchTerm.trim()) {
            // Return all, mapped to structure
            return certificates.map(cert => ({
                cert,
                materials: cert.materials.map(m => ({ name: m, score: 0 })),
                bestScore: 0
            }));
        }

        const tokens = searchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
        const results: FilteredData[] = [];

        certificates.forEach(cert => {
            const certNumLower = cert.number.toLowerCase();
            const matchedMaterials: { name: string; score: number }[] = [];
            let bestScoreForCert = 10000;

            cert.materials.forEach(mat => {
                const lowerMat = mat.toLowerCase();
                let totalScore = 0;
                let allTokensMatch = true;
                
                const matWords = lowerMat.split(/[\s,.\(\)]+/).filter(w => w.length > 0);

                for (const token of tokens) {
                    let tokenMatched = false;
                    let bestTokenScore = 1000;

                    // 1. Exact/Substring in Material Name
                    if (lowerMat.includes(token)) {
                        tokenMatched = true;
                        bestTokenScore = 0;
                        if (lowerMat.indexOf(token) === 0) bestTokenScore = -10; // Boost prefix
                    }
                    // 2. Exact/Substring in Certificate Number (Context)
                    else if (certNumLower.includes(token)) {
                        tokenMatched = true;
                        bestTokenScore = 5; // Good, but material match is better
                    }
                    else {
                        // 3. Fuzzy Match against Material words
                        const threshold = token.length < 3 ? 0 : Math.floor(token.length / 3);
                        for (const word of matWords) {
                            if (Math.abs(word.length - token.length) <= 3) {
                                const dist = levenshteinDistance(token, word);
                                if (dist <= threshold) {
                                    tokenMatched = true;
                                    bestTokenScore = Math.min(bestTokenScore, 10 + dist);
                                }
                            }
                        }
                    }

                    if (!tokenMatched) {
                        allTokensMatch = false;
                        break;
                    }
                    totalScore += bestTokenScore;
                }

                if (allTokensMatch) {
                    matchedMaterials.push({ name: mat, score: totalScore });
                    if (totalScore < bestScoreForCert) bestScoreForCert = totalScore;
                }
            });

            if (matchedMaterials.length > 0) {
                // Sort materials by score
                matchedMaterials.sort((a, b) => a.score - b.score);
                results.push({
                    cert,
                    materials: matchedMaterials,
                    bestScore: bestScoreForCert
                });
            }
        });

        // Sort certificates by best score
        results.sort((a, b) => a.bestScore - b.bestScore);
        return results;
    }, [certificates, searchTerm]);

    const handleSelectMaterial = (cert: Certificate, materialName: string) => {
        const dateObj = new Date(cert.validUntil);
        const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('ru-RU') : cert.validUntil;
        const resultString = `${materialName} (сертификат № ${cert.number}, действителен до ${dateStr})`;
        onSelect(resultString);
    };

    const toggleExpand = (id: string) => {
        setExpandedCertId(prev => prev === id ? null : id);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
    };

    const handleNavigate = (e: React.MouseEvent, certId: string) => {
        e.stopPropagation();
        if (onNavigateToCertificate) {
            onNavigateToCertificate(certId);
            onClose(); // Close modal on navigation
        }
    };

    const modalTitle = editingMaterialTitle 
        ? `Привязка к сертификату: "${editingMaterialTitle}"`
        : "Выбор материала из сертификатов";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
            <div className="flex flex-col h-[60vh]">
                <div className="mb-4 relative">
                    <input 
                        type="text" 
                        placeholder="Поиск по названию материала, номеру сертификата..." 
                        className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={e => e.stopPropagation()} 
                        autoFocus
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={handleClearSearch}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
                            title="Очистить поиск"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="flex-grow overflow-y-auto border border-slate-200 rounded-md bg-slate-50 p-2 space-y-2">
                    {filteredData.length > 0 ? filteredData.map(({ cert, materials }) => {
                        // Auto-expand if searching, otherwise use manual state
                        const isSearching = searchTerm.length > 0;
                        const isExpanded = isSearching ? true : expandedCertId === cert.id;
                        
                        return (
                            <div key={cert.id} className="bg-white border border-slate-200 rounded-md overflow-hidden">
                                <div 
                                    className="p-3 bg-slate-50 hover:bg-slate-100 cursor-pointer flex justify-between items-center"
                                    onClick={() => toggleExpand(cert.id)}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <CertificateIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-slate-700 truncate">
                                                    Сертификат № <HighlightMatch text={cert.number} query={searchTerm} />
                                                </span>
                                            </div>
                                            <span className="text-xs text-slate-500 truncate">(до {new Date(cert.validUntil).toLocaleDateString()})</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {onNavigateToCertificate && (
                                            <button
                                                onMouseDown={(e) => handleNavigate(e, cert.id)}
                                                className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors mr-1"
                                                title="Открыть сертификат"
                                            >
                                                <LinkIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        <span className="text-xs text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100">
                                            {materials.length} {isSearching ? 'совп.' : 'мат.'}
                                        </span>
                                    </div>
                                </div>
                                
                                {isExpanded && (
                                    <div className="border-t border-slate-100">
                                        {materials.length > 0 ? (
                                            materials.map((mat, idx) => (
                                                <button
                                                    key={`${idx}-${mat.name}`}
                                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 border-b border-slate-50 last:border-0 flex items-center group"
                                                    onClick={() => handleSelectMaterial(cert, mat.name)}
                                                >
                                                    <PlusIcon className="w-3 h-3 mr-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                                    <span className="truncate">
                                                        <HighlightMatch text={mat.name} query={searchTerm} />
                                                    </span>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-2 text-xs text-slate-400 italic text-center">Нет материалов</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    }) : (
                         <div className="text-center py-10 text-slate-500">
                            Ничего не найдено.
                        </div>
                    )}
                </div>

                <div className="mt-4 flex justify-end">
                    <button onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">
                        Закрыть
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default MaterialsModal;
