import { ref } from 'vue'
import axios from 'axios'

export type Resume = {
    id: string
    fileName: string
    text: string
    createdAt: string
    updatedAt: string
}

const api = axios.create({
    baseURL: (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000'
})

export function useResumes() {
    const resumes = ref<Resume[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function load() {
        loading.value = true
        error.value = null
        try {
            const res = await api.get<Resume[]>('/resumes')
            resumes.value = res.data
            return res.data
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to load resumes'
            throw e
        } finally {
            loading.value = false
        }
    }

    async function create(v: { fileName: string; text?: string; file?: File | null }) {
        loading.value = true
        error.value = null

        console.log('CREATE', v)
        try {
            let res
            if (v.file) {
                const fd = new FormData()
                fd.append('fileName', v.fileName)
                if (v.text) fd.append('text', v.text)
                fd.append('pdf', v.file)
                res = await api.post<Resume>('/resumes', fd)
            } else {
                res = await api.post<Resume>('/resumes', { fileName: v.fileName, text: v.text })
            }
            resumes.value = [res.data, ...resumes.value]
            return res.data
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to create resume'
            throw e
        } finally {
            loading.value = false
        }
    }

    async function update(id: string, v: Partial<{ fileName: string; text: string; file: File | null }>) {
        loading.value = true
        error.value = null

        console.log('UPDATE', v)
        try {
            let res
            if (v.file) {
                const fd = new FormData()
                if (v.fileName) fd.append('fileName', v.fileName)
                if (v.text) fd.append('text', v.text)
                fd.append('pdf', v.file)
                res = await api.put<Resume>(`/resumes/${id}`, fd)
            } else {
                res = await api.put<Resume>(`/resumes/${id}`, { fileName: v.fileName, text: v.text })
            }
            resumes.value = resumes.value.map(x => x.id === id ? res.data : x)
            return res.data
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to update resume'
            throw e
        } finally {
            loading.value = false
        }
    }

    async function remove(id: string) {
        loading.value = true
        error.value = null
        try {
            await api.delete(`/resumes/${id}`)
            resumes.value = resumes.value.filter(v => v.id !== id)
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to delete resume'
            throw e
        } finally {
            loading.value = false
        }
    }

    return { resumes, loading, error, load, create, update, remove }
}


