import { ActTableColumnKey } from '../types';

export const ALL_COLUMNS: { key: ActTableColumnKey; label: string; type: 'text' | 'date' | 'textarea' | 'custom_date', widthClass: string }[] = [
    { key: 'number', label: '№', type: 'text', widthClass: 'w-24' },
    { key: 'date', label: 'Дата акта', type: 'date', widthClass: 'w-40' },
    { key: 'workName', label: '1. Наименование работ', type: 'textarea', widthClass: 'w-96 min-w-[24rem]' },
    { key: 'projectDocs', label: '2. Проектная документация', type: 'textarea', widthClass: 'w-80' },
    { key: 'materials', label: '3. Материалы', type: 'textarea', widthClass: 'w-80' },
    { key: 'certs', label: '4. исполнительные схемы', type: 'textarea', widthClass: 'w-80' },
    { key: 'workDates', label: '5. Даты работ', type: 'custom_date', widthClass: 'w-64' },
    { key: 'regulations', label: '6. Нормативы', type: 'textarea', widthClass: 'w-80' },
    { key: 'nextWork', label: '7. Следующие работы', type: 'textarea', widthClass: 'w-80' },
    { key: 'additionalInfo', label: 'Доп. сведения', type: 'textarea', widthClass: 'w-80' },
    { key: 'attachments', label: 'Приложения', type: 'textarea', widthClass: 'w-80' },
    { key: 'copiesCount', label: 'Кол-во экз.', type: 'text', widthClass: 'w-32' },
];
