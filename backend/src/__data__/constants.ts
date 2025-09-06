export const REQUIREMENT_TYPES = [
    'technical_skill',
    'soft_skill',
    'other'
] as const

export type RequirementType = typeof REQUIREMENT_TYPES[number]


