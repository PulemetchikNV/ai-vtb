export const REQUIREMENT_TYPES = [
    'technical_skill',
    'soft_skill',
    'other'
] as const

export type RequirementType = typeof REQUIREMENT_TYPES[number]

// Константы для блоков сценария
export const SCENARIO_BLOCKS = {
    INTRODUCTION: {
        title: 'Вступление',
        duration: 3,
        keypoints: [
            'Приветствие и знакомство',
            'Рассказ о компании и позиции',
            'Объяснение формата интервью'
        ]
    },
    CONCLUSION: {
        title: 'Завершение',
        duration: 2,
        keypoints: [
            'Ответы на вопросы кандидата',
            'Информация о следующих шагах',
            'Благодарность за участие'
        ]
    }
} as const

