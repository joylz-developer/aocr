
import { Act, Person, ProjectSettings, Certificate } from '../types';
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

// Normalize newlines to ensure Docxtemplater handles them correctly
const normalizeNewlines = (str: string): string => {
    if (!str) return '';
    return str.replace(/\r\n|\r|\n|\v|\f|\u2028|\u2029/g, '\n');
};

// Helper to resolve simple templates inside text strings
const resolveStringTemplate = (templateStr: string, act: Act, overrides: Record<string, string> = {}): string => {
    if (!templateStr) return '';

    const keyMap: Record<string, keyof Act> = {
        'act_number': 'number',
        'object_name': 'objectName',
        'work_name': 'workName',
        'project_docs': 'projectDocs',
        'work_start_date': 'workStartDate',
        'work_end_date': 'workEndDate',
        'act_date': 'date',
    };

    return templateStr.replace(/\{(\w+)\}/g, (_, key) => {
        if (overrides[key] !== undefined) {
            return overrides[key];
        }
        const mappedKey = keyMap[key] || key;
        const value = (act as any)[mappedKey];
        if ((mappedKey === 'workStartDate' || mappedKey === 'workEndDate' || mappedKey === 'date') && value) {
             const parts = value.split('-');
             if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
        return value !== undefined && value !== null ? String(value) : '';
    });
};

// Helper to extract unique clean certificates from materials string
const extractUniqueCertificates = (materialsStr: string): string => {
    const uniqueDocs = new Set<string>();
    const items = materialsStr.split(';').map(s => s.trim()).filter(Boolean);

    items.forEach(item => {
        // Expected format: "Material Name (Cert Info)"
        const match = item.match(/^(.*)\s\((.*)\)\s*$/);
        if (match) {
            let certDoc = match[2].trim();
            // Remove "valid until" dates and phrases
            certDoc = certDoc.replace(/,?\s*(действителен|действ\.|до)\s*(\d{2}\.\d{2}\.\d{4})?.*/i, '').trim();
            // Remove just dates at the end (e.g. "Passport 123, 01.01.2024")
            certDoc = certDoc.replace(/,?\s*\d{2}\.\d{2}\.\d{4}$/, '').trim();
            
            if (certDoc) {
                uniqueDocs.add(certDoc);
            }
        }
    });

    return Array.from(uniqueDocs).join('; ');
};

// Function to generate data object for templates
const prepareDocData = (act: Act, people: Person[], currentAttachments: string, settings: ProjectSettings, overrideMaterials?: string, overrideMaterialDocs?: string) => {
    // Resolve Default Values if Act fields are empty OR if the field is hidden in settings
    
    // Logic for Date
    let effectiveDate = '';
    if (settings.showActDate) {
        effectiveDate = act.date;
    }
    if (!effectiveDate && settings.defaultActDate) {
        const resolved = resolveStringTemplate(settings.defaultActDate, act);
        if (resolved.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
            const [d, m, y] = resolved.split('.');
            effectiveDate = `${y}-${m}-${d}`;
        } else {
            effectiveDate = resolved; 
        }
    }

    // Logic for Additional Info
    let effectiveAdditionalInfo = '';
    if (settings.showAdditionalInfo) {
        effectiveAdditionalInfo = act.additionalInfo;
    }
    if (!effectiveAdditionalInfo && settings.defaultAdditionalInfo) {
        effectiveAdditionalInfo = resolveStringTemplate(settings.defaultAdditionalInfo, act);
    }

    const [actYear, actMonth, actDay] = effectiveDate ? effectiveDate.split('-') : ['', '', ''];
    const dateParts = effectiveDate && effectiveDate.includes('-') ? effectiveDate.split('-') : [];
    const finalActYear = dateParts[0] || '';
    const finalActMonth = dateParts[1] || '';
    const finalActDay = dateParts[2] || '';

    const [workStartYear, workStartMonth, workStartDay] = act.workStartDate ? act.workStartDate.split('-') : ['', '', ''];
    const [workEndYear, workEndMonth, workEndDay] = act.workEndDate ? act.workEndDate.split('-') : ['', '', ''];
    
    const uniqueDocsRaw = extractUniqueCertificates(act.materials);

    const data: { [key: string]: any } = {
        object_name: act.objectName,
        builder_details: act.builderDetails,
        contractor_details: act.contractorDetails,
        designer_details: act.designerDetails,
        act_number: act.number,
        act_day: finalActDay,
        act_month: finalActMonth,
        act_year: finalActYear,
        work_performer: act.workPerformer,
        work_name: act.workName,
        project_docs: act.projectDocs,
        
        // Materials logic
        materials: overrideMaterials !== undefined ? overrideMaterials : act.materials,
        materials_raw: act.materials,
        
        // Docs only logic
        material_docs: overrideMaterialDocs !== undefined ? overrideMaterialDocs : uniqueDocsRaw,
        material_docs_raw: uniqueDocsRaw,

        certs: act.certs,
        work_start_day: workStartDay,
        work_start_month: workStartMonth,
        work_start_year: workStartYear,
        work_end_day: workEndDay,
        work_end_month: workEndMonth,
        work_end_year: workEndYear,
        regulations: act.regulations,
        next_work: act.nextWork,
        additional_info: effectiveAdditionalInfo,
        copies_count: act.copiesCount,
        attachments: currentAttachments,
    };

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

    Object.keys(data).forEach(key => {
        const val = data[key];
        if (typeof val === 'string') {
            const listKey = `${key}_list`;
            const lines = normalizeNewlines(val).split('\n').filter(line => line.trim() !== '');
            
            if (lines.length === 0) {
                data[listKey] = [];
            } else {
                data[listKey] = lines.map((line, index) => {
                    const isLast = index === lines.length - 1;
                    const textWithBreak = isLast ? line : line + '\n';
                    const textClean = line; 
                    const item: any = { 
                        text: textWithBreak, 
                        text_clean: textClean 
                    };
                    item[key] = textWithBreak;
                    item[`${key}_clean`] = textClean;
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
    settings: ProjectSettings,
    certificates: Certificate[] = [] 
) => {
    try {
        const materialsList = act.materials.split(';').map(s => s.trim()).filter(Boolean);
        const threshold = settings.registryThreshold || 5;
        const shouldUseRegistry = materialsList.length > threshold && registryTemplateBase64;

        const registryReferenceString = `Приложение №1: Реестр материалов.`;
        
        const smartMaterialsValue = shouldUseRegistry 
            ? registryReferenceString
            : act.materials;
            
        const smartMaterialDocsValue = shouldUseRegistry
            ? registryReferenceString
            : undefined; // undefined triggers fallback to raw unique logic in prepareDocData

        // Logic for Attachments
        let attachmentsTemplate = '';
        if (settings.showAttachments) {
            attachmentsTemplate = act.attachments;
        }
        // If hidden (force default) OR visible but empty (fallback)
        if (!attachmentsTemplate && settings.defaultAttachments) {
            attachmentsTemplate = settings.defaultAttachments;
        }

        // Pre-resolve attachments to handle variables inside them (like {materials})
        // We pass "raw" materials here so the attachment list always has context if needed,
        // but typically attachments are just text.
        // If the user uses {materials} in attachments, it should respect the smart logic.
        const uniqueDocsRaw = extractUniqueCertificates(act.materials);
        let resolvedAttachments = resolveStringTemplate(attachmentsTemplate || '', act, {
            materials: smartMaterialsValue,
            materials_raw: act.materials,
            material_docs: smartMaterialDocsValue || uniqueDocsRaw,
            material_docs_raw: uniqueDocsRaw,
            certs: act.certs
        });
        
        resolvedAttachments = normalizeNewlines(resolvedAttachments);

        if (shouldUseRegistry) {
            const baseRegistryData = prepareDocData(act, people, resolvedAttachments, settings);
            const registryData = {
                ...baseRegistryData, 
                materials_list: materialsList.map((m, i) => {
                    let name = m;
                    let certDoc = '';
                    let date = '';
                    let amount = '1';

                    // Parse Material Format: "Name (CertInfo)"
                    const match = m.match(/^(.*)\s\((.*)\)\s*$/);
                    
                    if (match) {
                        name = match[1].trim();
                        const certInfo = match[2].trim();
                        
                        // 1. Extract Date from Cert Info (dd.mm.yyyy)
                        const dateMatch = certInfo.match(/(\d{2}\.\d{2}\.\d{4})/);
                        if (dateMatch) {
                            date = dateMatch[1];
                        }

                        // 2. Clean Cert Doc text
                        certDoc = certInfo.replace(/,?\s*(действителен|действ\.|до)\s*(\d{2}\.\d{2}\.\d{4})?.*/i, '').trim();
                        certDoc = certDoc.replace(new RegExp(`,?\\s*${date}$`), '').trim();

                        // 3. Find Amount from Certificate Object
                        const numberMatch = certInfo.match(/№\s*([^\s,]+)/);
                        if (numberMatch) {
                            const certNum = numberMatch[1];
                            const foundCert = certificates.find(c => c.number.includes(certNum));
                            if (foundCert && foundCert.amount) {
                                amount = foundCert.amount;
                            }
                        }
                    }

                    return { 
                        index: i + 1, 
                        name: m, 
                        material_name: name, 
                        cert_doc: certDoc,
                        date: date, 
                        amount: amount 
                    };
                })
            };
            const registryBuffer = renderDoc(registryTemplateBase64, registryData);

            // For the main act, use registry references
            const actData = prepareDocData(act, people, resolvedAttachments, settings, registryReferenceString, registryReferenceString);
            const actBuffer = renderDoc(templateBase64, actData);

            const packageZip = new PizZip();
            packageZip.file(`Акт_№${act.number || 'б-н'}.docx`, actBuffer);
            packageZip.file(`Приложение_1_Реестр_к_Акту_№${act.number || 'б-н'}.docx`, registryBuffer);

            const content = packageZip.generate({ type: "blob" });
            saveAs(content, `Пакет_Акт_№${act.number || 'б-н'}.zip`);

        } else {
            // No registry: Pass undefined for overrides to let logic compute normal values
            const data = prepareDocData(act, people, resolvedAttachments, settings, undefined, undefined);
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
