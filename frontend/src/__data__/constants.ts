export const REQUIREMENT_TYPES = [
    { value: 'technical_skill', label: 'Hard скилл' },
    { value: 'soft_skill', label: 'Soft скилл' },
    { value: 'other', label: 'Другое' },
] as const


export const TOKEN_KEY = 'token'

export const LANG_OPTIONS = [
    { value: 'ru', label: 'Русский', ttsOptions: { voice: 'masha', role: 'friendly' } },
    { value: 'en', label: 'Английский', ttsOptions: { voice: 'john' } },
] as const