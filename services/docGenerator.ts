
import { Act, Person, ProjectSettings } from '../types';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

const ROLES_KEYS = ['tnz', 'g', 'tng', 'pr', 'pd', 'i1', 'i2', 'i3'];

function base64ToArrayBuffer(base64: string) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

const shortenName = (fullName: string): string => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return fullName;
    const surname = parts[0];
    const initials = parts.slice(1).map(p => p[0] ? `${p[0].toUpperCase()}.` : '').join('');
    return `${surname} ${initials}`;
};

// Helper to resolve simple templates inside text strings (e.g. default Attachments)
const resolveStringTemplate = (templateStr: string, act: Act, overrides: Record<string, string> = {}): string => {
    if (!templateStr) return '';

    // Mapping from Word Template tags to internal Act properties
    const keyMap: Record<string, keyof Act> = {
        'act_number': 'number',
        'object_name': 'objectName',
        'work_name': 'workName',
        'project_docs': 'projectDocs',
        'work_start_date': 'workStartDate', // Allow snake_case
        'work_end_date': 'workEndDate',     // Allow snake_case
        'act_date': 'date',                 // Allow snake_case
    };

    return templateStr.replace(/\{(\w+)\}/g, (_, key) => {
        // 1. Check overrides first (e.g. for smart materials logic)
        if (overrides[key] !== undefined) {
            return overrides[key];
        }
        
        // 2. Map alias to actual key (e.g. act_number -> number), or use key as is
        const mappedKey = keyMap[key] || key;
        
        // 3. Check direct Act properties
        const value = (act as any)[mappedKey];
        
        // Format dates for display if needed
        if ((mappedKey === 'workStartDate' || mappedKey === 'workEndDate' || mappedKey === 'date') && value) {
             const parts = value.split('-');
             if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
        
        return value !== undefined && value !== null ? String(value) : '';
    });
};

// Function to generate data object for templates
const prepareDocData = (act: Act, people: Person[], currentAttachments: string, overrideMaterials?: string, registryReferenceText: string = '') => {
    const [actYear, actMonth, actDay] = act.date ? act.date.split('-') : ['', '', ''];
    const [workStartYear, workStartMonth, workStartDay] = act.workStartDate ? act.workStartDate.split('-') : ['', '', ''];
    const [workEndYear, workEndMonth, workEndDay] = act.workEndDate ? act.workEndDate.split('-') : ['', '', ''];
    
    const data: { [key: string]: any } = {
        // Header
        object_name: act.objectName,
        builder_details: act.builderDetails,
        contractor_details: act.contractorDetails,
        designer_details: act.designerDetails,
        // Act info
        act_number: act.number,
        act_day: actDay,
        act_month: actMonth,
        act_year: actYear,
        work_performer: act.workPerformer,
        // Work details
        work_name: act.workName,
        project_docs: act.projectDocs,
        
        // Materials Logic
        materials: overrideMaterials !== undefined ? overrideMaterials : act.materials, // Smart switch
        materials_raw: act.materials, // Always the full text
        registry_text: registryReferenceText, // "See attachment..." if registry exists, else empty
        
        certs: act.certs,
        // Sections
        work_start_day: workStartDay,
        work_start_month: workStartMonth,
        work_start_year: workStartYear,
        work_end_day: workEndDay,
        work_end_month: workEndMonth,
        work_end_year: workEndYear,
        regulations: act.regulations,
        next_work: act.nextWork,
        // Footer
        additional_info: act.additionalInfo,
        copies_count: act.copiesCount,
        attachments: currentAttachments, // Use processed attachments string
    };

    // Add representatives data
    ROLES_KEYS.forEach(roleKey => {
        const personId = act.representatives[roleKey];
        const person = people.find(p => p.id === personId);

        if (person) {
            const shortName = shortenName(person.name || '');
            const personData = {
                name: person.name || '',
                name_short: shortName,
                position: person.position || '',
                org: person.organization || '',
                auth_doc: person.authDoc || '',
                details: `${person.position}, ${person.name}, ${person.authDoc || '(нет данных о документе)'}`,
                details_short: `${person.position}, ${shortName}, ${person.authDoc || '(нет данных о документе)'}`
            };
            
            data[roleKey] = personData;
            data[`${roleKey}_name`] = personData.name;
            data[`${roleKey}_name_short`] = personData.name_short;
            data[`${roleKey}_position`] = personData.position;
            data[`${roleKey}_org`] = personData.org;
            data[`${roleKey}_auth_doc`] = personData.auth_doc;
            data[`${roleKey}_details`] = personData.details;
            data[`${roleKey}_details_short`] = personData.details_short;
        } else {
            data[roleKey] = null;
            data[`${roleKey}_name`] = null;
            data[`${roleKey}_name_short`] = null;
            data[`${roleKey}_position`] = null;
            data[`${roleKey}_org`] = null;
            data[`${roleKey}_auth_doc`] = null;
            data[`${roleKey}_details`] = null;
            data[`${roleKey}_details_short`] = null;
        }
    });

    // UNIVERSAL LIST GENERATOR
    Object.keys(data).forEach(key => {
        const val = data[key];
        if (typeof val === 'string') {
            const listKey = `${key}_list`;
            // Split by newline, trim whitespace, remove empty lines
            const lines = val.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            
            if (lines.length === 0) {
                data[listKey] = [];
            } else {
                data[listKey] = lines.map((line, index) => {
                    const isLast = index === lines.length - 1;
                    
                    // 1. Text with forced newline (Default)
                    // We append '\n' to all except the last one.
                    // This ensures that when looping in a single cell, lines don't merge.
                    const textWithBreak = isLast ? line : line + '\n';
                    
                    // 2. Clean text (for native Word lists)
                    // No newlines, let Word handle the list item flow
                    const textClean = line; 
                    
                    const item: any = { 
                        text: textWithBreak, // Default {text} now has breaks
                        text_clean: textClean // {text_clean} is plain
                    };
                    
                    // Support using the key name itself
                    item[key] = textWithBreak;          // {attachments} -> has break (GOOD for inline)
                    item[`${key}_clean`] = textClean;   // {attachments_clean} -> no break (GOOD for lists)
                    
                    return item;
                });
            }
        }
    });

    return data;
};

const renderDoc = (templateBase64: string, data: any): ArrayBuffer => {
    const zip = new PizZip(base64ToArrayBuffer(templateBase64));
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => null, 
    });
    doc.render(data);
    return doc.getZip().generate({
        type: 'arraybuffer',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
};

export const generateDocument = (
    templateBase64: string, 
    registryTemplateBase64: string | null,
    act: Act, 
    people: Person[], 
    settings: ProjectSettings
) => {
    try {
        const materialsList = act.materials.split(';').map(s => s.trim()).filter(Boolean);
        const threshold = settings.registryThreshold || 5;
        const shouldUseRegistry = materialsList.length > threshold && registryTemplateBase64;

        // --- Prepare dynamic values ---
        const registryReferenceString = `Приложение №1: Реестр материалов.`;
        
        const smartMaterialsValue = shouldUseRegistry 
            ? registryReferenceString
            : act.materials;

        // --- Resolve Attachments Field ---
        let attachmentsTemplate = act.attachments;
        if (!attachmentsTemplate && settings.showAttachments && settings.defaultAttachments) {
            attachmentsTemplate = settings.defaultAttachments;
        }

        let resolvedAttachments = resolveStringTemplate(attachmentsTemplate || '', act, {
            materials: smartMaterialsValue
        }).replace(/\r\n/g, '\n');

        if (shouldUseRegistry) {
            const baseRegistryData = prepareDocData(act, people, resolvedAttachments);
            const registryData = {
                ...baseRegistryData, 
                materials_list: materialsList.map((m, i) => {
                    let name = m;
                    let cert = '';
                    const match = m.match(/^(.*)\s\((.*)\)[^)]*$/);
                    if (match) {
                        name = match[1].trim();
                        cert = match[2].trim();
                    }
                    return { 
                        index: i + 1, 
                        name: m, 
                        material_name: name, 
                        cert_doc: cert,
                        date: '', 
                        amount: '' 
                    };
                })
            };
            const registryBuffer = renderDoc(registryTemplateBase64, registryData);

            let finalAttachments = resolvedAttachments;
            if (!finalAttachments.includes('Реестр материалов')) {
                 finalAttachments = finalAttachments 
                    ? `${finalAttachments}\n${registryReferenceString}` 
                    : registryReferenceString;
            }

            const actData = prepareDocData(act, people, finalAttachments, registryReferenceString, registryReferenceString);
            const actBuffer = renderDoc(templateBase64, actData);

            const packageZip = new PizZip();
            packageZip.file(`Акт_№${act.number || 'б-н'}.docx`, actBuffer);
            packageZip.file(`Приложение_1_Реестр_к_Акту_№${act.number || 'б-н'}.docx`, registryBuffer);

            const content = packageZip.generate({ type: "blob" });
            saveAs(content, `Пакет_Акт_№${act.number || 'б-н'}.zip`);

        } else {
            const data = prepareDocData(act, people, resolvedAttachments, undefined, '');
            const buffer = renderDoc(templateBase64, data);
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            saveAs(blob, `Акт_скрытых_работ_${act.number || 'б-н'}.docx`);
        }

    } catch (error: any) {
        console.error('Error generating document:', error);

        let userMessage = 'Не удалось сгенерировать документ. Проверьте шаблон и данные. Подробности в консоли.';
        
        const errors = error.properties?.errors;

        if (Array.isArray(errors) && errors.length > 0) {
            const firstError = errors[0];
            const { id, xtag, explanation } = firstError.properties;
            
            switch (id) {
                case 'unbalanced_loop_tags':
                    userMessage = `Ошибка в шаблоне: Несбалансированные теги.\n\nПроверьте, что для каждого открывающего тега цикла (например, {#work_items}) есть соответствующий закрывающий ({/work_items}).\n\nДетали: ${explanation}`;
                    break;
                case 'duplicate_open_tag':
                    userMessage = `Ошибка в шаблоне: Найден дублирующийся открывающий тег "${xtag}".\n\nВозможно, вы случайно напечатали '{{{' вместо '{' или использовали неверный синтаксис.\n\nДетали: ${explanation}`;
                    break;
                case 'unclosed_tag':
                    userMessage = `Ошибка в шаблоне: Незакрытый тег "${xtag}".\n\nПроверьте, что у каждого тега есть закрывающая часть '}'.\n\nДетали: ${explanation}`;
                    break;
                case 'closing_tag_does_not_match_opening_tag':
                     userMessage = `Ошибка в шаблоне: Закрывающий тег не соответствует открывающему.\n\nПроверьте парные теги, например {#users} ... {/users}.\n\nДетали: ${explanation}`;
                    break;
                 case 'loop_outside_of_table':
                    userMessage = `Ошибка в шаблоне: Тег цикла {#${xtag}} должен находиться внутри ячейки таблицы, а не охватывать несколько строк.\n\nПравильно: в первой ячейке строки ставится {#work_items}, а в последней {/work_items}.\n\nДетали: ${explanation}`;
                    break;
                default:
                    userMessage = `В шаблоне обнаружена ошибка: ${firstError.message}. Пожалуйста, проверьте синтаксис тегов.`;
                    break;
            }
        } else if (error.properties?.id === 'scope_error') {
            const { xtag, explanation } = error.properties;
            userMessage = `Ошибка в данных: Не удалось найти данные для тега "${xtag}".\n\nУбедитесь, что все поля в акте заполнены.\n\nДетали: ${explanation}`;
        }

        alert(userMessage);
    }
};
