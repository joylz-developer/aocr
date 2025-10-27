export interface Person {
    id: string;
    name: string;
    position: string;
    organization: string;
    authDoc?: string;
}

export interface Organization {
    id: string;
    name: string;
    ogrn: string;
    inn: string;
    kpp?: string;
    address: string;
    phone?: string;
    sro?: string;
}

// Map of representative roles to their descriptions
export const ROLES: { [key: string]: string } = {
    tnz: 'Представитель застройщика (технического заказчика) по вопросам строительного контроля',
    g: 'Представитель лица, осуществляющего строительство',
    tng: 'Представитель лица, осуществляющего строительство, по вопросам строительного контроля',
    pr: 'Представитель лица, осуществившего подготовку проектной документации',
    pd: 'Представитель лица, выполнившего работы, подлежащие освидетельствованию',
    i1: 'Представитель иной организации (1)',
    i2: 'Представитель иной организации (2)',
    i3: 'Представитель иной организации (3)',
};

export interface WorkItem {
    id: string;
    name: string;
    projectDocs: string;
    materials: string;
    certs: string;
    notes: string;
}

export interface Act {
    id: string;
    number: string;
    date: string; // YYYY-MM-DD
    objectName: string;
    builderDetails: string;
    contractorDetails: string;
    designerDetails: string;
    workPerformer: string;

    // DEPRECATED: These will be migrated to workItems
    workName?: string;
    projectDocs?: string;
    materials?: string;
    certs?: string;
    
    workItems: WorkItem[];

    workStartDate: string; // YYYY-MM-DD
    workEndDate: string; // YYYY-MM-DD
    regulations: string;
    nextWork: string;

    additionalInfo: string;
    copiesCount: string;
    attachments: string;

    // Maps role key to person ID
    representatives: {
        [key: string]: string; // e.g., { tnz: 'person-uuid-1', g: 'person-uuid-2' }
    };
}

// Types for Project Settings
export interface ProjectSettings {
    objectName: string;
    defaultCopiesCount: number;
    showAdditionalInfo: boolean;
    showAttachments: boolean;
    showCopiesCount?: boolean;
    showActDate?: boolean;
    showParticipantDetails?: boolean;
    useShortOrgNames?: boolean;
    geminiApiKey?: string;
    visibleWorkItemColumns?: string[];
}

// Types for Import/Export feature
export type ImportMode = 'replace' | 'merge';

export interface ImportSettingsCategory {
    import: boolean;
    mode: ImportMode;
    selectedIds?: string[];
}

export interface ImportSettings {
    template: boolean;
    projectSettings: boolean;
    acts: ImportSettingsCategory;
    people: ImportSettingsCategory;
    organizations: ImportSettingsCategory;
}


export interface ImportData {
    template?: string | null;
    projectSettings?: ProjectSettings;
    acts?: Act[];
    people?: Person[];
    organizations?: Organization[];
}