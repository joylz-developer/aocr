
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

// Function to generate data object for templates
const prepareDocData = (act: Act, people: Person[], overrideMaterials?: string) => {
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
        materials: overrideMaterials !== undefined ? overrideMaterials : act.materials, // Use override if provided
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
        attachments: act.attachments,
    };

    // Add representatives data
    ROLES_KEYS.forEach(roleKey => {
        const personId = act.representatives[roleKey];
        const person = people.find(p => p.id === personId);

        if (person) {
            const personData = {
                name: person.name || '',
                position: person.position || '',
                org: person.organization || '',
                auth_doc: person.authDoc || '',
                details: `${person.position}, ${person.name}, ${person.authDoc || '(нет данных о документе)'}`
            };
            
            data[roleKey] = personData;
            data[`${roleKey}_name`] = personData.name;
            data[`${roleKey}_position`] = personData.position;
            data[`${roleKey}_org`] = personData.org;
            data[`${roleKey}_auth_doc`] = personData.auth_doc;
            data[`${roleKey}_details`] = personData.details;
        } else {
            data[roleKey] = null;
            data[`${roleKey}_name`] = null;
            data[`${roleKey}_position`] = null;
            data[`${roleKey}_org`] = null;
            data[`${roleKey}_auth_doc`] = null;
            data[`${roleKey}_details`] = null;
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

        if (shouldUseRegistry) {
            // --- Generate Two Documents (Act + Registry) zipped ---
            
            // 1. Generate Registry Doc
            // We use the same base data (reps, dates, etc) for the registry header/footer
            const baseRegistryData = prepareDocData(act, people);
            
            const registryData = {
                ...baseRegistryData, // Include all standard act fields (representatives, dates, object name)
                materials_list: materialsList.map((m, i) => {
                    // Try to parse "Material Name (Certificate Info)"
                    // Pattern: Everything before the last open parenthesis is Name, everything inside is Cert.
                    let name = m;
                    let cert = '';
                    
                    const match = m.match(/^(.*)\s\((.*)\)[^)]*$/);
                    if (match) {
                        name = match[1].trim();
                        cert = match[2].trim();
                    }

                    return { 
                        index: i + 1, 
                        name: m, // Full original string
                        material_name: name, // Just the material name part
                        cert_doc: cert, // Just the certificate part (if found in brackets)
                        date: '', // Placeholder for manual entry in Word if needed
                        amount: '' // Placeholder for quantity/sheets
                    };
                })
            };
            
            const registryBuffer = renderDoc(registryTemplateBase64, registryData);

            // 2. Generate Main Act Doc
            // Replace materials text with reference
            const referenceText = `см. Приложение №1 (Реестр материалов)`;
            const actData = prepareDocData(act, people, referenceText);
            
            // Append registry to existing attachments text if possible, or ensure it's noted
            const existingAttachments = actData.attachments || '';
            actData.attachments = existingAttachments 
                ? `${existingAttachments}\nПриложение №1: Реестр материалов.` 
                : `Приложение №1: Реестр материалов.`;

            const actBuffer = renderDoc(templateBase64, actData);

            // 3. Zip them together
            const packageZip = new PizZip();
            packageZip.file(`Акт_№${act.number || 'б-н'}.docx`, actBuffer);
            packageZip.file(`Приложение_1_Реестр_к_Акту_№${act.number || 'б-н'}.docx`, registryBuffer);

            const content = packageZip.generate({ type: "blob" });
            saveAs(content, `Пакет_Акт_№${act.number || 'б-н'}.zip`);

        } else {
            // --- Generate Single Document ---
            const data = prepareDocData(act, people);
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
