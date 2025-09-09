import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import router from '../router'
import { chatHistory } from '../__data__/store'
import { axiosInstance } from '../plugins/axios'
import { addMessage } from '../__data__/notifications'

export type Chat = {
    id: string
    title: string | null
    lang: string
    createdAt: string
    updatedAt: string
    messages: Message[]
    is_finished: boolean
    analysis?: any
}

export type Message = {
    id: string
    chatId: string
    role: 'user' | 'assistant'
    content: string
    createdAt: string
}

export type ChatError = {
    type: 'validation' | 'network' | 'server' | 'websocket' | 'auth' | 'unknown'
    message: string
    code?: number
    details?: string
}

const api = axiosInstance

const isTtsClientMode = !!((import.meta as any).env?.VITE_TTS_CLIENT_MODE ?? 'true')

function parseError(error: any): ChatError {
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
            message: data?.message || 'Нет доступа к этому чату',
            code: 403
        }
    }

    if (status === 404) {
        return {
            type: 'server',
            message: data?.message || 'Чат не найден',
            code: 404
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

    // WebSocket ошибки
    if (error.isWebSocketError) {
        return {
            type: 'websocket',
            message: error.message || 'Ошибка подключения к серверу'
        }
    }

    // Fallback
    return {
        type: 'unknown',
        message: data?.message || error.message || 'Произошла неизвестная ошибка'
    }
}

export function useChat() {
    const route = useRoute()
    const currentChatId = computed<string | null>({
        get() {
            return route.params.chatId as string | null
        },
        set(value) {
            router.push({ name: undefined, params: { chatId: value } as any })
        }
    })
    const chat = ref<Chat | null>(null)
    const messages = computed<Message[]>({
        get() {
            return chat.value?.messages || []
        },
        set(value) {
            chat.value!.messages = value
        }
    })
    let ws: WebSocket | null = null
    const loading = ref(false)
    const error = ref<ChatError | null>(null)
    const wsConnected = ref(false)
    const wsReconnecting = ref(false)

    async function startChat(title?: string | null, vacancyId?: string | null, resumeId?: string | null, lang?: string) {
        loading.value = true
        error.value = null
        try {
            // Валидация на клиенте
            if (!vacancyId) {
                const validationError: ChatError = {
                    type: 'validation',
                    message: 'Необходимо выбрать вакансию для создания чата'
                }
                error.value = validationError
                throw validationError
            }

            const res = await api.post<Chat>('/chat', {
                title: title?.trim() || null,
                lang: lang || 'ru',
                vacancyId,
                resumeId: resumeId || null
            })
            currentChatId.value = res.data.id
            chat.value = res.data
            messages.value = []

            addMessage({
                severity: 'success',
                summary: 'Чат создан',
                detail: `Новый чат "${res.data.title || 'Без названия'}" успешно создан`,
                life: 3000
            })

            return res.data
        } catch (e: any) {
            const parsedError = parseError(e)
            error.value = parsedError

            addMessage({
                severity: parsedError.type === 'validation' ? 'warn' : 'error',
                summary: parsedError.type === 'validation' ? 'Проверьте данные' :
                    parsedError.type === 'network' ? 'Проблемы с сетью' : 'Ошибка',
                detail: parsedError.message,
                life: parsedError.type === 'network' ? 5000 : 4000
            })

            throw parsedError
        } finally {
            loading.value = false
        }
    }

    async function fetchChat(chatId?: string) {
        const id = chatId ?? currentChatId.value
        if (!id) return null
        loading.value = true
        error.value = null
        try {
            const res = await api.get<{ id: string; messages: Message[]; analysis?: any } & any>(`/chat/${id}`)
            if (!res.data.id) throw new Error('Chat not found')
            currentChatId.value = res.data.id
            chat.value = res.data
            if (res.data.analysis) {
                analysis.value = res.data.analysis
                analysisError.value = !!res.data.analysis?.error
            }
            return res.data
        } catch (e: any) {
            const parsedError = parseError(e)
            error.value = parsedError

            // Не показываем уведомления для 404 - это нормально при переходах
            if (parsedError.code !== 404) {
                addMessage({
                    severity: parsedError.type === 'network' ? 'warn' : 'error',
                    summary: parsedError.type === 'network' ? 'Проблемы с сетью' : 'Ошибка загрузки',
                    detail: parsedError.message,
                    life: 4000
                })
            }

            throw parsedError
        } finally {
            loading.value = false
        }
    }

    async function sendMessage(content: string) {
        if (!currentChatId.value) {
            const error: ChatError = { type: 'validation', message: 'Чат не инициализирован' }
            throw error
        }

        loading.value = true
        error.value = null
        try {
            // Валидация на клиенте
            if (!content?.trim()) {
                const validationError: ChatError = {
                    type: 'validation',
                    message: 'Сообщение не может быть пустым'
                }
                error.value = validationError
                throw validationError
            }

            if (content.trim().length > 10000) {
                const validationError: ChatError = {
                    type: 'validation',
                    message: 'Сообщение слишком длинное (максимум 10,000 символов)'
                }
                error.value = validationError
                throw validationError
            }

            const res = await api.post<{ user: Message; assistant: Message }>(`/chat/${currentChatId.value}/message`, {
                content: content.trim()
            })
            return res.data
        } catch (e: any) {
            const parsedError = parseError(e)
            error.value = parsedError

            addMessage({
                severity: parsedError.type === 'validation' ? 'warn' : 'error',
                summary: parsedError.type === 'validation' ? 'Проверьте сообщение' :
                    parsedError.type === 'network' ? 'Проблемы с сетью' : 'Ошибка отправки',
                detail: parsedError.message,
                life: parsedError.type === 'network' ? 5000 : 4000
            })

            throw parsedError
        } finally {
            loading.value = false
        }
    }

    async function deleteChat(chatId?: string) {
        const id = chatId ?? currentChatId.value
        if (!id) return
        loading.value = true
        error.value = null
        try {
            await api.delete(`/chat/${id}`)
            if (!chatId || chatId === currentChatId.value) {
                currentChatId.value = null
                chat.value = null
                messages.value = []
            }

            addMessage({
                severity: 'success',
                summary: 'Чат удален',
                detail: 'Чат успешно удален',
                life: 3000
            })
        } catch (e: any) {
            const parsedError = parseError(e)
            error.value = parsedError

            addMessage({
                severity: parsedError.type === 'auth' ? 'warn' : 'error',
                summary: parsedError.type === 'auth' ? 'Нет доступа' :
                    parsedError.type === 'network' ? 'Проблемы с сетью' : 'Ошибка удаления',
                detail: parsedError.message,
                life: parsedError.type === 'network' ? 5000 : 4000
            })

            throw parsedError
        } finally {
            loading.value = false
        }
    }

    const analysis = ref<any | null>(null)
    const analysisError = ref<boolean>(false)

    async function finishChat() {
        if (!currentChatId.value) return
        error.value = null
        analysis.value = { status: 'started' }
        analysisError.value = false
        try {
            await api.post(`/chat/${currentChatId.value}/finish`, {})
            // 204 — ждём события по WebSocket

            addMessage({
                severity: 'info',
                summary: 'Анализ запущен',
                detail: 'Генерация анализа чата начата',
                life: 3000
            })
        } catch (e: any) {
            const parsedError = parseError(e)
            error.value = parsedError
            analysisError.value = true

            addMessage({
                severity: 'error',
                summary: 'Ошибка анализа',
                detail: parsedError.message,
                life: 5000
            })

            throw parsedError
        }
    }

    async function loadChatHistory() {
        loading.value = true
        error.value = null
        console.log('loadChatHistory')
        try {
            const res = await api.get<Chat[]>('/chats')
            chatHistory.value = res.data
            return res.data
        } catch (e: any) {
            const parsedError = parseError(e)
            error.value = parsedError

            // Тихо логируем, не показываем уведомления для истории
            console.error('Failed to load chat history:', parsedError)

            throw parsedError
        } finally {
            loading.value = false
        }
    }

    let reconnectAttempts = 0
    const maxReconnectAttempts = 5
    let reconnectTimeout: number | null = null

    function disconnectWs() {
        if (ws) {
            try { ws.close() } catch { }
            ws = null
        }
        wsConnected.value = false
        wsReconnecting.value = false
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout)
            reconnectTimeout = null
        }
    }

    function connectWs(chatId: string, isReconnect = false) {
        disconnectWs()

        if (!isReconnect) {
            reconnectAttempts = 0
        }

        const url = (import.meta as any).env?.VITE_BACKEND_WS_URL || 'ws://localhost:3000'
        ws = new WebSocket(`${url}/ws/chat?chatId=${encodeURIComponent(chatId)}`)

        ws.onopen = () => {
            wsConnected.value = true
            wsReconnecting.value = false
            reconnectAttempts = 0
            console.log('WebSocket connected')
        }

        ws.onclose = (event) => {
            wsConnected.value = false
            console.log('WebSocket closed:', event.code, event.reason)

            // Попытка переподключения только если закрытие не было намеренным
            if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts && currentChatId.value) {
                wsReconnecting.value = true
                reconnectAttempts++
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000) // Exponential backoff

                console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts}) in ${delay}ms`)

                reconnectTimeout = setTimeout(() => {
                    if (currentChatId.value) {
                        connectWs(currentChatId.value, true)
                    }
                }, delay)
            } else if (reconnectAttempts >= maxReconnectAttempts) {
                wsReconnecting.value = false
                const wsError: ChatError = {
                    type: 'websocket',
                    message: 'Не удалось подключиться к серверу после нескольких попыток'
                }
                error.value = wsError

                addMessage({
                    severity: 'error',
                    summary: 'Ошибка подключения',
                    detail: 'Потеряно соединение с сервером. Попробуйте обновить страницу.',
                    life: 8000
                })
            }
        }

        ws.onerror = (event) => {
            console.error('WebSocket error:', event)
            const wsError: ChatError = {
                type: 'websocket',
                message: 'Ошибка соединения с сервером'
            }
            error.value = wsError
        }

        ws.onmessage = (ev) => {
            try {
                const evt = JSON.parse(ev.data)

                // Обработка ошибок от сервера
                if (evt?.type === 'error') {
                    const serverError: ChatError = {
                        type: 'server',
                        message: evt.payload?.message || 'Ошибка сервера'
                    }
                    error.value = serverError

                    addMessage({
                        severity: 'error',
                        summary: 'Ошибка сервера',
                        detail: serverError.message,
                        life: 5000
                    })
                    return
                }

                if (evt?.type === 'message.created') {
                    const msg: Message = evt.payload
                    if (msg.chatId === (currentChatId.value as string | null)) {
                        messages.value = [...messages.value, msg]

                        if (isTtsClientMode && msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.trim().length > 0) {
                            // Эмитируем событие для синхронизации с UI
                            const event = new CustomEvent('tts-message', {
                                detail: {
                                    messageId: msg.id,
                                    text: msg.content
                                }
                            })
                            window.dispatchEvent(event)
                        }
                    }
                } else if (evt?.type === 'analysis.started') {
                    analysis.value = { status: 'running' }
                } else if (evt?.type === 'analysis.progress') {
                    analysis.value = { ...(analysis.value || {}), last: evt.payload }
                } else if (evt?.type === 'analysis.completed') {
                    analysis.value = evt.payload
                    analysisError.value = !!evt.payload?.error

                    addMessage({
                        severity: 'success',
                        summary: 'Анализ завершен',
                        detail: 'Анализ чата успешно сгенерирован',
                        life: 4000
                    })
                } else if (evt?.type === 'analysis.error') {
                    analysisError.value = true
                    analysis.value = { error: true, message: evt.payload?.message }

                    addMessage({
                        severity: 'error',
                        summary: 'Ошибка анализа',
                        detail: evt.payload?.message || 'Не удалось сгенерировать анализ',
                        life: 6000
                    })
                } else if (evt?.type === 'message.deleted') {
                    messages.value = messages.value.filter(m => m.id !== evt.payload)
                }
            } catch (parseError) {
                console.error('Failed to parse WebSocket message:', parseError)
            }
        }
    }

    // Auto-connect to WS when chatId changes
    watch(() => currentChatId.value, (id: string | null) => {
        if (id) connectWs(id)
        else disconnectWs()
    }, { immediate: true })

    // Функция для получения пользовательского сообщения об ошибке
    function getErrorMessage(error: ChatError | null): string {
        if (!error) return ''

        const typeMessages = {
            validation: '⚠️ Ошибка валидации',
            network: '🌐 Проблемы с сетью',
            server: '🔧 Ошибка сервера',
            websocket: '🔌 Проблемы с подключением',
            auth: '🔐 Ошибка авторизации',
            unknown: '❓ Неизвестная ошибка'
        }

        return `${typeMessages[error.type]} • ${error.message}`
    }

    return {
        chat,
        currentChatId,
        messages,
        loading,
        error,
        wsConnected,
        wsReconnecting,
        startChat,
        fetchChat,
        sendMessage,
        deleteChat,
        loadChatHistory,
        finishChat,
        analysis,
        analysisError,
        getErrorMessage
    }
}
