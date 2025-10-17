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
            // Добавлено для предотвращения ошибок, если данные отсутствуют
            nullGetter: () => "", 
        });

        const [actYear, actMonth, actDay] = act.date ? act.date.split('-') : ['', '', ''];
        const [workStartYear, workStartMonth, workStartDay] = act.workStartDate ? act.workStartDate.split('-') : ['', '', ''];
        const [workEndYear, workEndMonth, workEndDay] = act.workEndDate ? act.workEndDate.split('-') : ['', '', ''];

        const data: { [key: string]: string } = {
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

        ROLES_KEYS.forEach(roleKey => {
            const personId = act.representatives[roleKey];
            const person = people.find(p => p.id === personId);
            data[`${roleKey}_name`] = person?.name || '';
            data[`${roleKey}_position`] = person?.position || '';
            data[`${roleKey}_org`] = person?.organization || '';
            data[`${roleKey}_auth_doc`] = person?.authDoc || '';
            data[`${roleKey}_details`] = person ? `${person.position}, ${person.name}, ${person.authDoc || '(нет данных о документе)'}` : '';
        });

        // Исправлено: используется современный метод render(data)
        doc.render(data);

        const out = doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

        saveAs(out, `Акт_скрытых_работ_${act.number || 'б-н'}.docx`);

    } catch (error) {
        console.error('Error generating document:', error);
        alert('Не удалось сгенерировать документ. Проверьте шаблон и данные. Подробности в консоли.');
    }
};