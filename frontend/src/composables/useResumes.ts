import { ref } from 'vue'
import { axiosInstance } from '../plugins/axios'

export type Resume = {
    id: string
    fileName: string
    text: string
    createdAt: string
    updatedAt: string
}

export type ResumeError = {
    type: 'validation' | 'network' | 'server' | 'file' | 'auth' | 'unknown'
    message: string
    code?: number
    details?: string
}

const api = axiosInstance

function parseError(error: any): ResumeError {
    if (!error) {
        return { type: 'unknown', message: 'Неизвестная ошибка' }
    }

    const response = error.response
    const status = response?.status
    const data = response?.data

    // Обработка HTTP статусов
    if (status === 401) {
        return {
            type: 'auth',
            message: data?.message || 'Необходима авторизация',
            code: 401
        }
    }

    if (status === 403) {
        return {
            type: 'auth',
            message: data?.message || 'Нет доступа к этому ресурсу',
            code: 403
        }
    }

    if (status === 404) {
        return {
            type: 'server',
            message: data?.message || 'Резюме не найдено',
            code: 404
        }
    }

    if (status === 413) {
        return {
            type: 'file',
            message: data?.message || 'Файл слишком большой',
            code: 413
        }
    }

    if (status === 415) {
        return {
            type: 'file',
            message: data?.message || 'Неподдерживаемый тип файла',
            code: 415
        }
    }

    if (status >= 400 && status < 500) {
        return {
            type: 'validation',
            message: data?.message || 'Ошибка валидации данных',
            code: status,
            details: data?.detail
        }
    }

    if (status >= 500) {
        return {
            type: 'server',
            message: data?.message || 'Ошибка сервера. Попробуйте позже',
            code: status
        }
    }

    // Сетевые ошибки
    if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
        return {
            type: 'network',
            message: 'Проблемы с подключением к серверу'
        }
    }

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return {
            type: 'network',
            message: 'Превышено время ожидания ответа'
        }
    }

    // Fallback
    return {
        type: 'unknown',
        message: data?.message || error.message || 'Произошла неизвестная ошибка'
    }
}

export function useResumes() {
    const resumes = ref<Resume[]>([])
    const loading = ref(false)
    const error = ref<ResumeError | null>(null)

    async function load() {
        loading.value = true
        error.value = null
        try {
            const res = await api.get<Resume[]>('/resumes')
            resumes.value = res.data
            return res.data
        } catch (e: any) {
            const parsedError = parseError(e)
            error.value = parsedError
            throw parsedError
        } finally {
            loading.value = false
        }
    }

    async function create(v: { fileName: string; text?: string; file?: File | null }) {
        loading.value = true
        error.value = null

        try {
            // Валидация на клиенте
            if (!v.fileName?.trim()) {
                const validationError: ResumeError = {
                    type: 'validation',
                    message: 'Название файла обязательно'
                }
                error.value = validationError
                throw validationError
            }

            if (!v.file && !v.text?.trim()) {
                const validationError: ResumeError = {
                    type: 'validation',
                    message: 'Необходимо загрузить файл или ввести текст резюме'
                }
                error.value = validationError
                throw validationError
            }

            if (v.file && v.file.size > 10 * 1024 * 1024) {
                const validationError: ResumeError = {
                    type: 'file',
                    message: 'Размер файла превышает 10 МБ'
                }
                error.value = validationError
                throw validationError
            }

            let res
            if (v.file) {
                const fd = new FormData()
                fd.append('fileName', v.fileName.trim())
                if (v.text?.trim()) fd.append('text', v.text.trim())
                fd.append('pdf', v.file)
                res = await api.post<Resume>('/resumes', fd, {
                    timeout: 60000, // 60 секунд для загрузки файлов
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                })
            } else {
                res = await api.post<Resume>('/resumes', {
                    fileName: v.fileName.trim(),
                    text: v.text?.trim()
                })
            }

            resumes.value = [res.data, ...resumes.value]
            return res.data
        } catch (e: any) {
            const parsedError = parseError(e)
            error.value = parsedError
            throw parsedError
        } finally {
            loading.value = false
        }
    }

    async function update(id: string, v: Partial<{ fileName: string; text: string; file: File | null; pdfBase64?: string }>) {
        loading.value = true
        error.value = null

        try {
            // Валидация на клиенте
            if (!id?.trim()) {
                const validationError: ResumeError = {
                    type: 'validation',
                    message: 'ID резюме обязателен'
                }
                error.value = validationError
                throw validationError
            }

            if (!v.fileName?.trim() && !v.text?.trim() && !v.file && !v.pdfBase64) {
                const validationError: ResumeError = {
                    type: 'validation',
                    message: 'Необходимо обновить название файла или содержимое резюме'
                }
                error.value = validationError
                throw validationError
            }

            if (v.file && v.file.size > 10 * 1024 * 1024) {
                const validationError: ResumeError = {
                    type: 'file',
                    message: 'Размер файла превышает 10 МБ'
                }
                error.value = validationError
                throw validationError
            }

            let res
            if (v.file) {
                const fd = new FormData()
                if (v.fileName?.trim()) fd.append('fileName', v.fileName.trim())
                if (v.text?.trim()) fd.append('text', v.text.trim())
                fd.append('pdf', v.file)
                res = await api.put<Resume>(`/resumes/${id}`, fd, {
                    timeout: 60000,
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                })
            } else {
                const updateData: any = {}
                if (v.fileName?.trim()) updateData.fileName = v.fileName.trim()
                if (v.text?.trim()) updateData.text = v.text.trim()
                if (v.pdfBase64) updateData.pdfBase64 = v.pdfBase64
                res = await api.put<Resume>(`/resumes/${id}`, updateData)
            }

            resumes.value = resumes.value.map(x => x.id === id ? res.data : x)
            return res.data
        } catch (e: any) {
            const parsedError = parseError(e)
            error.value = parsedError
            throw parsedError
        } finally {
            loading.value = false
        }
    }

    async function remove(id: string) {
        loading.value = true
        error.value = null
        try {
            // Валидация на клиенте
            if (!id?.trim()) {
                const validationError: ResumeError = {
                    type: 'validation',
                    message: 'ID резюме обязателен'
                }
                error.value = validationError
                throw validationError
            }

            await api.delete(`/resumes/${id}`)
            resumes.value = resumes.value.filter(v => v.id !== id)
        } catch (e: any) {
            const parsedError = parseError(e)
            error.value = parsedError
            throw parsedError
        } finally {
            loading.value = false
        }
    }

    // Функция для получения пользовательского сообщения об ошибке
    function getErrorMessage(error: ResumeError | null): string {
        if (!error) return ''

        const typeMessages = {
            validation: '⚠️ Ошибка валидации',
            network: '🌐 Проблемы с сетью',
            server: '🔧 Ошибка сервера',
            file: '📄 Проблема с файлом',
            auth: '🔐 Ошибка авторизации',
            unknown: '❓ Неизвестная ошибка'
        }

        return `${typeMessages[error.type]} • ${error.message}`
    }

    return {
        resumes,
        loading,
        error,
        load,
        create,
        update,
        remove,
        getErrorMessage
    }
}


