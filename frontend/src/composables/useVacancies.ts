import { ref } from 'vue'
import axios from 'axios'

export type VacancyRequirement = {
    id: string
    description: string
    type: 'technical_skill' | 'soft_skill'
    weight: number
}

export type Vacancy = {
    id: string
    title: string
    description_text: string
    requirements_checklist: VacancyRequirement[]
    category_weights?: Record<string, number>
    createdAt: string
    updatedAt: string
}

const api = axios.create({
    baseURL: (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000'
})

export function useVacancies() {
    const vacancies = ref<Vacancy[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function load() {
        loading.value = true
        error.value = null
        try {
            const res = await api.get<Vacancy[]>('/vacancies')
            vacancies.value = res.data
            return res.data
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to load vacancies'
            throw e
        } finally {
            loading.value = false
        }
    }

    async function create(v: { title: string; description_text: string; requirements_checklist: VacancyRequirement[]; category_weights?: Record<string, number> }) {
        loading.value = true
        error.value = null
        try {
            const res = await api.post<Vacancy>('/vacancies', v)
            vacancies.value = [res.data, ...vacancies.value]
            return res.data
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to create vacancy'
            throw e
        } finally {
            loading.value = false
        }
    }

    async function remove(id: string) {
        loading.value = true
        error.value = null
        try {
            await api.delete(`/vacancies/${id}`)
            vacancies.value = vacancies.value.filter(v => v.id !== id)
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to delete vacancy'
            throw e
        } finally {
            loading.value = false
        }
    }

    async function update(id: string, v: Partial<{ title: string; description_text: string; requirements_checklist: VacancyRequirement[]; category_weights?: Record<string, number> }>) {
        loading.value = true
        error.value = null
        try {
            const res = await api.put<Vacancy>(`/vacancies/${id}`, v)
            vacancies.value = vacancies.value.map(x => x.id === id ? res.data : x)
            return res.data
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to update vacancy'
            throw e
        } finally {
            loading.value = false
        }
    }

    return { vacancies, loading, error, load, create, remove, update }
}
