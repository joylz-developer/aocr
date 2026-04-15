import { ActTableColumnKey } from '../types';

export const ALL_COLUMNS: { 
    key: ActTableColumnKey; 
    label: string; 
    type: 'text' | 'date' | 'textarea' | 'custom_date' | 'materials' | 'schemes'; // ДОБАВЛЕНО 'schemes'
    widthClass: string; 
    description?: string;
    example?: string;
}[] = [
    { 
        key: 'number', 
        label: '№ акта', 
        type: 'text', 
        widthClass: 'w-24', 
        description: 'Уникальный номер акта освидетельствования скрытых работ.',
        example: '14-А'
    },
    { 
        key: 'date', 
        label: 'Дата', 
        type: 'date', 
        widthClass: 'w-36', 
        description: 'Дата подписания акта комиссией.',
        example: '2024-10-15'
    },
    { 
        key: 'workName', 
        label: 'Наименование работ', 
        type: 'textarea', 
        widthClass: 'w-64', 
        description: 'Точное наименование скрытых работ, подлежащих освидетельствованию.',
        example: 'Устройство арматурного каркаса монолитных стен подвала в осях А-В/1-3'
    },
    { 
        key: 'workDates', 
        label: 'Даты работ', 
        type: 'custom_date', 
        widthClass: 'w-64', 
        description: 'Период выполнения работ: дата начала и дата окончания.',
        example: '2024-10-01 - 2024-10-14'
    },
    { 
        key: 'projectDocs', 
        label: '1. Проектная документация', 
        type: 'textarea', 
        widthClass: 'w-64', 
        description: 'Шифр проекта, номера чертежей, на основании которых выполнены работы.',
        example: 'Шифр 2024-01-КЖ, Листы 15-18, Изм. 2'
    },
    { 
        key: 'materials', 
        label: '2. Материалы', 
        type: 'materials', 
        widthClass: 'w-80', 
        description: 'Перечень примененных материалов и изделий с указанием сертификатов и паспортов качества.',
        example: 'Арматура А500С Ø12мм (сертификат №12345); Бетон B25 W6 F150 (паспорт №987)'
    },
    { 
        key: 'regulations', 
        label: '3. Нормативы', 
        type: 'textarea', 
        widthClass: 'w-64', 
        description: 'Нормативные документы (СП, ГОСТ, СНиП), требованиям которых соответствуют работы.',
        example: 'СП 70.13330.2012 "Несущие и ограждающие конструкции"'
    },
    { 
        key: 'certs', 
        label: '4. Исполнительные схемы', 
        type: 'schemes', // ИЗМЕНЕНО с 'textarea' на 'schemes'
        widthClass: 'w-80', 
        description: 'Перечень исполнительной геодезической документации, схем, результатов лабораторных испытаний.',
        example: 'Исполнительная схема №12 от 12.10.2024; Протокол испытания №5'
    },
    { 
        key: 'nextWork', 
        label: '5. Разрешение на работы', 
        type: 'textarea', 
        widthClass: 'w-64', 
        description: 'Наименование последующих работ, к выполнению которых разрешается приступить.',
        example: 'Бетонирование монолитных стен подвала в осях А-В/1-3'
    },
    { 
        key: 'additionalInfo', 
        label: '6. Доп. сведения', 
        type: 'textarea', 
        widthClass: 'w-48', 
        description: 'Любая дополнительная информация, замечания комиссии.',
        example: 'Работы выполнены в соответствии с ППР.'
    },
    { 
        key: 'attachments', 
        label: 'Приложения', 
        type: 'textarea', 
        widthClass: 'w-48', 
        description: 'Количество приложений к акту (страниц, листов).',
        example: 'Приложения на 15 листах'
    },
    { 
        key: 'copiesCount', 
        label: 'Кол-во экз.', 
        type: 'text', 
        widthClass: 'w-24', 
        description: 'Количество составленных экземпляров акта.',
        example: '4'
    },
    { 
        key: 'commissionGroup', 
        label: 'Комиссия', 
        type: 'text', 
        widthClass: 'w-48', 
        description: 'Выбранная группа представителей (комиссия), подписывающая акт.',
        example: 'Основная комиссия (Подрядчик + Заказчик)'
    }
];