
export interface ConstructionObject {
    id: string;
    name: string; // Full name for documents
    shortName?: string; // Short name for UI
    description?: string;
}

export interface Person {
    id: string;
    name: string;
    position: string;
    organization: string;
    authDoc?: string;
    constructionObjectId?: string; // Linked to object
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
    constructionObjectId?: string; // Now linked to object
}

export interface Regulation {
    id: string;
    designation: string; // Обозначение
    fullName: string; // Полное название
    status: string; // Статус
    title: string; // Заглавие на русском языке
    replacement?: string; // Обозначение заменяющего
    registrationDate?: string;
    approvalDate?: string;
    activeDate?: string;
    orgApprover?: string;
    fullJson?: any; // Keep original data just in case
    
    constructionObjectId?: string; // Linked to object
    
    // UI Only field for grouping
    embeddedChanges?: Regulation[]; 
}

export interface CertificateFile {
    id: string;
    type: 'pdf' | 'image';
    name: string;
    data: string; // Base64 string
}

export interface Certificate {
    id: string;
    number: string;
    validUntil: string; // YYYY-MM-DD
    amount?: string; // Number of pages/sheets
    
    // Multi-file support
    files: CertificateFile[];

    // Legacy single-file support (deprecated but kept for migration)
    fileType?: 'pdf' | 'image';
    fileName?: string;
    fileData?: string; 
    
    materials: string[]; // List of material names included in this certificate
    constructionObjectId?: string; // Linked to object
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
    objectName: string; // Snapshot of object name, but linked via ID
    
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
    nextWorkActId?: string;
    constructionObjectId?: string; // Linked to object
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
    constructionObjectId?: string; // Linked to object
}

// Types for Project Settings
export interface ProjectSettings {
    // objectName: string; // REMOVED: Now managed via ConstructionObject
    defaultCopiesCount: number;
    showAdditionalInfo: boolean;
    showAttachments: boolean;
    showCopiesCount?: boolean;
    showActDate?: boolean;
    showParticipantDetails?: boolean;
    geminiApiKey?: string;
    
    // New AI Settings
    aiModel?: string;
    customAiModel?: string; // For custom OpenRouter models
    openAiApiKey?: string;
    openAiBaseUrl?: string;

    defaultAttachments?: string;
    defaultAdditionalInfo?: string;
    defaultActDate?: string;
    historyDepth?: number; // Number of undo steps to save
    
    // Registry Settings
    registryThreshold?: number; // Count of materials to trigger registry generation
    
    // AI Prompts
    certificatePromptNumber?: string;
    certificatePromptDate?: string;
    certificatePromptMaterials?: string;
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
    registryTemplate?: boolean; // New import option
    projectSettings: boolean;
    acts: ImportSettingsCategory;
    people: ImportSettingsCategory;
    organizations: ImportSettingsCategory;
    groups: ImportSettingsCategory;
    regulations?: ImportSettingsCategory;
    certificates?: ImportSettingsCategory;
    deletedActs?: ImportSettingsCategory;
    constructionObjects?: ImportSettingsCategory; // New import category
}

export interface ExportSettings {
    template: boolean;
    registryTemplate?: boolean; // New export option
    projectSettings: boolean;
    acts: boolean;
    people: boolean;
    organizations: boolean;
    groups: boolean;
    regulations: boolean;
    certificates: boolean;
    deletedActs: boolean;
    deletedCertificates: boolean;
    constructionObjects?: boolean; // Export objects structure
}


export interface ImportData {
    template?: string | null;
    registryTemplate?: string | null; // New data field
    projectSettings?: ProjectSettings;
    constructionObjects?: ConstructionObject[]; // New
    acts?: Act[];
    people?: Person[];
    organizations?: Organization[];
    groups?: CommissionGroup[];
    regulations?: Regulation[];
    certificates?: Certificate[];
    deletedActs?: DeletedActEntry[];
    deletedCertificates?: DeletedCertificateEntry[];
}

// Defines which fields from the Act can be columns in the table
export type ActTableColumnKey = Exclude<keyof Act, 
    'representatives' | 'builderDetails' | 'contractorDetails' | 
    'designerDetails' | 'workPerformer' | 'builderOrgId' | 'contractorOrgId' | 
    'designerOrgId' | 'workPerformerOrgId' | 'commissionGroupId' | 'nextWorkActId' | 'constructionObjectId'
> | 'workDates' | 'commissionGroup';

// Defines the available pages in the application
export type Page = 'acts' | 'people' | 'organizations' | 'settings' | 'groups' | 'trash' | 'regulations' | 'certificates' | 'objects';

export type Coords = { rowIndex: number; colIndex: number };

export interface DeletedActEntry {
  act: Act;
  deletedOn: string; // ISO string
  associatedGroup?: CommissionGroup; // Snapshot of the group at time of deletion
}

export interface DeletedCertificateEntry {
    certificate: Certificate;
    deletedOn: string;
}

export type Theme = 'light' | 'dark' | 'eye-protection';
