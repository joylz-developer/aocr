import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { Act, Person, ProjectSettings, Certificate, ROLES, Regulation, ExecutiveScheme } from '../types';

function base64ToBinaryString(base64: string) {
    const marker = ';base64,';
    const markerIndex = base64.indexOf(marker);
    if (markerIndex === -1) {
        return atob(base64); 
    }
    const raw = base64.substring(markerIndex + marker.length);
    return atob(raw);
}

const getShortName = (fullName: string) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    if (parts.length >= 3) {
        return `${parts[0]} ${parts[1][0]}.${parts[2][0]}.`;
    }
    return `${parts[0]} ${parts[1][0]}.`;
};

const MONTHS = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

const parseDateParts = (dateStr: string) => {
    if (!dateStr) return { day: '___', month: '___________', year: '202_' };
    const [y, m, d] = dateStr.split('-');
    return {
        day: d,
        month: MONTHS[parseInt(m, 10) - 1] || '___________',
        year: y
    };
};

const formatDateStandard = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
};

const formatPersonDetails = (personId: string | undefined, template: string[] | undefined, peopleList: Person[]) => {
    if (!personId) return '';
    const person = peopleList.find(p => p.id === personId);
    if (!person) return '';

    const activeTemplate = template && template.length > 0 ? template : ['position', 'name', 'authDoc'];

    return activeTemplate.map(key => {
        switch(key) {
            case 'name': return person.name;
            case 'position': return person.position;
            case 'organization': return person.organization;
            case 'authDoc': return person.authDoc;
            case 'nrs': return person.nrs ? `НРС ${person.nrs}` : '';
            default: return '';
        }
    }).filter(Boolean).join(', ');
};

// ИСПРАВЛЕНИЕ: Добавлены значения по умолчанию (= []), чтобы предотвратить падение генератора
export const generateDocument = async (
    templateBase64: string,
    registryTemplateBase64: string | null,
    act: Act,
    people: Person[] = [],
    settings: ProjectSettings,
    certificates: Certificate[] = [],
    regulationsList: Regulation[] = [],
    schemesList: ExecutiveScheme[] = [] 
) => {
    try {
        let finalActDate = act.date;
        if (!finalActDate && settings.defaultActDate) {
            if (settings.defaultActDate.includes('{work_end_date}')) finalActDate = act.workEndDate;
            else if (settings.defaultActDate.includes('{work_start_date}')) finalActDate = act.workStartDate;
        }

        const actDate = parseDateParts(finalActDate);
        const startDate = parseDateParts(act.workStartDate);
        const endDate = parseDateParts(act.workEndDate);

        // Форматирование СП и ГОСТ
        const formattedRegulations = (act.regulations || '')
            .split(';')
            .map(s => s.trim())
            .filter(Boolean)
            .map(designation => {
                const foundReg = regulationsList.find(r => r.designation === designation);
                if (foundReg && foundReg.title) {
                    return `${designation} «${foundReg.title}»`;
                }
                return designation;
            })
            .join('; ');

        // ОЧИСТКА: Последующие работы
        let finalNextWork = act.nextWork || '';
        const matchNW = finalNextWork.match(/^Работы по акту №.*?\((.*)\)$/);
        if (matchNW) {
            finalNextWork = matchNW[1].trim(); 
        }

        // ОЧИСТКА И ФОРМАТИРОВАНИЕ: Исполнительные схемы
        const formattedCerts = (act.certs || '')
            .split(';')
            .map(s => s.trim())
            .filter(Boolean)
            .map(certStr => {
                const foundScheme = schemesList.find(sch => certStr.includes(sch.number) || certStr.includes(sch.name));
                if (foundScheme) {
                    return `Исполнительная схема №${foundScheme.number} - ${foundScheme.name} (${foundScheme.amount} л.)`;
                }
                return certStr; // Если это обычный паспорт качества - оставляем как есть
            })
            .join('; ');

        // Обработка материалов и реестра
        const materialsArray = (act.materials || '').split(';').map(m => m.trim()).filter(Boolean);
        const threshold = settings.registryThreshold || 5;
        const useRegistry = materialsArray.length > threshold && registryTemplateBase64;

        let materialsOutput = act.materials;
        if (useRegistry) {
            materialsOutput = `согласно Реестру документов о качестве (Приложение №1 к настоящему акту)`;
        }

        const certDocsRaw = materialsArray.map(m => {
            const match = m.match(/\((.*?)\)/);
            return match ? match[1] : '';
        }).filter(Boolean);
        const uniqueDocs = Array.from(new Set(certDocsRaw));

        // Подготовка данных представителей комиссии
        const repsData: Record<string, any> = {};
        
        Object.keys(ROLES).forEach(role => {
            const personId = act.representatives?.[role];
            const person = people.find(p => p.id === personId);
            
            repsData[role] = !!person;
            repsData[`${role}_name`] = person?.name || '';
            repsData[`${role}_name_short`] = getShortName(person?.name || '');
            repsData[`${role}_position`] = person?.position || '';
            repsData[`${role}_org`] = person?.organization || '';
            repsData[`${role}_auth_doc`] = person?.authDoc || '';
            
            let templateToUse = settings.otherRepsDetailsTemplate;
            if (role === 'tnz') templateToUse = settings.tnzDetailsTemplate;
            else if (role === 'g') templateToUse = settings.gDetailsTemplate;
            else if (role === 'tng') templateToUse = settings.tngDetailsTemplate;
            else if (role === 'pr') templateToUse = settings.prDetailsTemplate;
            else if (role === 'pd') templateToUse = settings.pdDetailsTemplate;

            repsData[`${role}_details`] = formatPersonDetails(personId, templateToUse, people);
            
            repsData[`${role}_details_short`] = person 
                ? [person.position, getShortName(person.name), person.authDoc].filter(Boolean).join(', ')
                : '';
        });

        // Сборка объекта данных для Word
        const data = {
            act_number: act.number || 'б/н',
            object_name: act.objectName || '',
            work_name: act.workName || '',
            project_docs: act.projectDocs || '',
            regulations: formattedRegulations,
            next_work: finalNextWork, 
            
            act_day: actDate.day,
            act_month: actDate.month,
            act_year: actDate.year,
            date: formatDateStandard(finalActDate),

            work_start_day: startDate.day,
            work_start_month: startDate.month,
            work_start_year: startDate.year,
            
            work_end_day: endDate.day,
            work_end_month: endDate.month,
            work_end_year: endDate.year,

            work_start_date: formatDateStandard(act.workStartDate),
            work_end_date: formatDateStandard(act.workEndDate),

            copies_count: act.copiesCount || settings.defaultCopiesCount || 4,
            additional_info: act.additionalInfo || '',
            attachments: act.attachments || '',

            materials: materialsOutput,
            materials_raw: act.materials || '',
            material_docs: useRegistry ? materialsOutput : uniqueDocs.join('; '),
            material_docs_raw: uniqueDocs.join('; '),
            certs: formattedCerts, 

            builder_details: act.builderDetails || '',
            contractor_details: act.contractorDetails || '',
            designer_details: act.designerDetails || '',
            work_performer: act.workPerformer || '',

            ...repsData
        };

        const zip = new PizZip(base64ToBinaryString(templateBase64));
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            nullGetter: () => ''
        });

        doc.render(data);
        const out = doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        saveAs(out, `Акт_АОСР_${act.number || 'б-н'}.docx`);

        if (useRegistry && registryTemplateBase64) {
            const materialsList = materialsArray.map((matStr, index) => {
                const match = matStr.match(/^(.*?)\((.*?)\)$/);
                let matName = matStr;
                let certDoc = '';
                let amount = '';

                if (match) {
                    matName = match[1].trim();
                    certDoc = match[2].trim();
                    
                    const certNumMatch = certDoc.match(/№\s*([^\s,)]+)/);
                    if (certNumMatch) {
                        const cert = certificates.find(c => c.number.includes(certNumMatch[1]));
                        if (cert && cert.amount) {
                            amount = cert.amount;
                        }
                    }
                }

                return {
                    index: index + 1,
                    name: matStr,
                    material_name: matName,
                    cert_doc: certDoc,
                    amount: amount,
                    date: '' 
                };
            });

            const registryData = {
                ...data, 
                materials_list: materialsList
            };

            const regZip = new PizZip(base64ToBinaryString(registryTemplateBase64));
            const regDoc = new Docxtemplater(regZip, {
                paragraphLoop: true,
                linebreaks: true,
                nullGetter: () => ''
            });

            regDoc.render(registryData);
            const regOut = regDoc.getZip().generate({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });
            saveAs(regOut, `Реестр_материалов_к_акту_${act.number || 'б-н'}.docx`);
        }

    } catch (error) {
        console.error('Ошибка при генерации документа:', error);
        alert('Произошла ошибка при создании документа. Проверьте правильность тегов в шаблоне Word.');
    }
};