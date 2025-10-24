import { Act, Person } from '../types';
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

export const generateDocument = (templateBase64: string, act: Act, people: Person[]) => {
    try {
        const zip = new PizZip(base64ToArrayBuffer(templateBase64));
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            // Используется nullGetter, чтобы теги, для которых нет данных, были falsy.
            // Это необходимо для корректной работы условных блоков в шаблоне.
            nullGetter: () => null, 
        });

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
            // Sections
            work_name: act.workName,
            project_docs: act.projectDocs,
            materials: act.materials,
            certs: act.certs,
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

        // Добавляем данные о представителях как вложенные объекты.
        // Если представитель не выбран, его объект будет null,
        // что позволит скрыть его в шаблоне с помощью условных тегов.
        ROLES_KEYS.forEach(roleKey => {
            const personId = act.representatives[roleKey];
            const person = people.find(p => p.id === personId);

            if (person) {
                data[roleKey] = {
                    name: person.name || '',
                    position: person.position || '',
                    org: person.organization || '',
                    auth_doc: person.authDoc || '',
                    details: `${person.position}, ${person.name}, ${person.authDoc || '(нет данных о документе)'}`
                };
            } else {
                data[roleKey] = null; // Критически важно для условных блоков в docxtemplater
            }
        });

        doc.render(data);

        const out = doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

        saveAs(out, `Акт_скрытых_работ_${act.number || 'б-н'}.docx`);

    } catch (error: any) {
        console.error('Error generating document:', error);

        let userMessage = 'Не удалось сгенерировать документ. Проверьте шаблон и данные. Подробности в консоли.';
        
        // docxtemplater aggregates parsing errors in `error.properties.errors`
        const errors = error.properties?.errors;

        if (Array.isArray(errors) && errors.length > 0) {
            const firstError = errors[0];
            const { id, xtag, explanation } = firstError.properties;
            
            switch (id) {
                case 'unbalanced_loop_tags':
                    userMessage = `Ошибка в шаблоне: Несбалансированные теги.\n\nПроверьте, что для каждого открывающего тега цикла (например, {#items}) есть соответствующий закрывающий ({/items}).\n\nДетали: ${explanation}`;
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
                default:
                    userMessage = `В шаблоне обнаружена ошибка: ${firstError.message}. Пожалуйста, проверьте синтаксис тегов.`;
                    break;
            }
        } else if (error.properties?.id === 'scope_error') {
            // Handle scope errors (data not found for a tag) separately
            const { xtag, explanation } = error.properties;
            userMessage = `Ошибка в данных: Не удалось найти данные для тега "${xtag}".\n\nУбедитесь, что все поля в акте заполнены.\n\nДетали: ${explanation}`;
        }

        alert(userMessage);
    }
};
