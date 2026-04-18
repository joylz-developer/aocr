import { ActTableColumnKey } from '../types';

export const ALL_COLUMNS: { 
    key: ActTableColumnKey; 
    label: string; 
    type: 'text' | 'date' | 'textarea' | 'custom_date' | 'materials' | 'schemes';
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
        label: 'Дата акта', 
        type: 'date', 
        widthClass: 'w-36', 
        description: 'Дата подписания акта комиссией.',
        example: '2024-10-15'
    },
    { 
        key: 'workName', 
        label: '1. Наименование работ', 
        type: 'textarea', 
        widthClass: 'w-64', 
        description: 'Точное наименование скрытых работ, подлежащих освидетельствованию.',
        example: 'Устройство арматурного каркаса монолитных стен подвала в осях А-В/1-3'
    },
    { 
        key: 'projectDocs', 
        label: '2. Проектная документация', 
        type: 'textarea', 
        widthClass: 'w-64', 
        description: 'Шифр проекта, номера чертежей, на основании которых выполнены работы.',
        example: 'Шифр 2024-01-КЖ, Листы 15-18, Изм. 2'
    },
    { 
        key: 'materials', 
        label: '3. Материалы', 
        type: 'materials', 
        widthClass: 'w-80', 
        description: 'Перечень примененных материалов и изделий с указанием сертификатов и паспортов качества.',
        example: 'Арматура А500С Ø12мм (сертификат №12345); Бетон B25 W6 F150 (паспорт №987)'
    },
    { 
        key: 'certs', 
        label: '4. Исполнительные схемы', 
        type: 'schemes',
        widthClass: 'w-80', 
        description: 'Перечень исполнительной геодезической документации, схем, результатов лабораторных испытаний.',
        example: 'Исполнительная схема №12 от 12.10.2024; Протокол испытания №5'
    },
    { 
        key: 'workDates', 
        label: '5. Даты работ', 
        type: 'custom_date', 
        widthClass: 'w-64', 
        description: 'Период выполнения работ: дата начала и дата окончания.',
        example: '2024-10-01 - 2024-10-14'
    },
    { 
        key: 'regulations', 
        label: '6. Нормативы', 
        type: 'textarea', 
        widthClass: 'w-64', 
        description: 'Нормативные документы (СП, ГОСТ, СНиП), требованиям которых соответствуют работы.',
        example: 'СП 70.13330.2012 "Несущие и ограждающие конструкции"'
    },
    { 
        key: 'nextWork', 
        label: '7. Последующие работы', 
        type: 'textarea', 
        widthClass: 'w-64', 
        description: 'Наименование последующих работ, к выполнению которых разрешается приступить.',
        example: 'Бетонирование монолитных стен подвала в осях А-В/1-3'
    },
    { 
        key: 'additionalInfo', 
        label: 'Доп. сведения', 
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