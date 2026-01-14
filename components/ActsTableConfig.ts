
import { ActTableColumnKey } from '../types';

export const ALL_COLUMNS: { key: ActTableColumnKey; label: string; type: 'text' | 'date' | 'textarea' | 'custom_date' | 'materials', widthClass: string; helpText?: string }[] = [
    { key: 'id', label: 'ID', type: 'text', widthClass: 'w-48' },
    { key: 'number', label: '№', type: 'text', widthClass: 'w-24', helpText: 'Номер акта (например, 1, 14-А, 3/1).' },
    { key: 'commissionGroup', label: 'Группа', type: 'text', widthClass: 'w-64', helpText: 'Группа, определяющая состав комиссии и реквизиты организаций. Выберите из списка.' },
    { key: 'date', label: 'Дата акта', type: 'date', widthClass: 'w-40', helpText: 'Дата подписания акта. Обычно совпадает с датой окончания работ.' },
    { key: 'workName', label: '1. Наименование работ', type: 'textarea', widthClass: 'w-96 min-w-[24rem]', helpText: 'Точное название выполненных работ согласно смете/проекту. Пример: "Устройство бетонной подготовки под фундаменты".' },
    { key: 'projectDocs', label: '2. Проектная документация', type: 'textarea', widthClass: 'w-80', helpText: 'Шифр проекта, номера чертежей и листов. Пример: "КР-1 лист 5, 6".' },
    { key: 'materials', label: '3. Материалы', type: 'materials', widthClass: 'w-80', helpText: 'Список материалов и документов о качестве. Используйте иконку сертификата для быстрой вставки.' },
    { key: 'certs', label: '4. Исполнительные схемы', type: 'textarea', widthClass: 'w-80', helpText: 'Перечень исполнительных схем и чертежей с датами. Пример: "Исполнительная схема №3 от 10.10.2024".' },
    { key: 'workDates', label: '5. Даты работ', type: 'custom_date', widthClass: 'w-64', helpText: 'Период выполнения работ (начало - окончание). Используйте календарь для выбора.' },
    { key: 'regulations', label: '6. Нормативы', type: 'textarea', widthClass: 'w-80', helpText: 'СП, ГОСТ и другие нормативные документы, соблюдение которых подтверждается. Можно выбрать из справочника.' },
    { key: 'nextWork', label: '7. Следующие работы', type: 'textarea', widthClass: 'w-80', helpText: 'Наименование работ, которые разрешается производить после подписания этого акта. Можно выбрать "Автоматически" для связи со следующим актом в списке.' },
    { key: 'additionalInfo', label: 'Доп. сведения', type: 'textarea', widthClass: 'w-80', helpText: 'Любая дополнительная информация для акта.' },
    { key: 'attachments', label: 'Приложения', type: 'textarea', widthClass: 'w-80', helpText: 'Список приложений к акту (указывается в конце документа).' },
    { key: 'copiesCount', label: 'Кол-во экз.', type: 'text', widthClass: 'w-32', helpText: 'Количество экземпляров акта.' },
];
