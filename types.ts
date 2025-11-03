export interface Person {
    id: string;
    name: string;
    position: string;
    organization: string;
    authDoc?: string;
}

export interface Organization {
    id:string;
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

export interface Act {
    id: string;
    number: string;
    date: string; // YYYY-MM-DD
    objectName: string;
    
    // Legacy/generated fields
    builderDetails: string;
    contractorDetails: string;
    designerDetails: string;
    workPerformer: string;
    
    // IDs for selected orgs
    builderOrgId?: string;
    contractorOrgId?: string;
    designerOrgId?: string;
    workPerformerOrgId?: string;

    workName: string;
    projectDocs: string;
    materials: string;
    certs: string;

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
    
    commissionGroupId?: string;
}

export interface CommissionGroup {
    id: string;
    name: string;
    representatives: {
        [key: string]: string;
    };
    builderOrgId?: string;
    contractorOrgId?: string;
    designerOrgId?: string;
    workPerformerOrgId?: string;
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
    geminiApiKey?: string;
    defaultAttachments?: string;
    defaultAdditionalInfo?: string;
    defaultActDate?: string;
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
    groups: ImportSettingsCategory;
}


export interface ImportData {
    template?: string | null;
    projectSettings?: ProjectSettings;
    acts?: Act[];
    people?: Person[];
    organizations?: Organization[];
    groups?: CommissionGroup[];
}

// Defines which fields from the Act can be columns in the table
export type ActTableColumnKey = Exclude<keyof Act, 
    'representatives' | 'id' | 'builderDetails' | 'contractorDetails' | 
    'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 
    'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId'
> | 'workDates' | 'commissionGroup';

// Defines the available pages in the application
export type Page = 'acts' | 'people' | 'organizations' | 'settings' | 'groups';

export type Coords = { rowIndex: number; colIndex: number };