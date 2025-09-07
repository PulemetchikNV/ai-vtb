import { computed, ref, watch } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import router from '../router'
import { chatHistory } from '../__data__/store'

export type Chat = {
    id: string
    title: string | null
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

const api = axios.create({
    baseURL: (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3000'
})

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
    const error = ref<string | null>(null)

    async function startChat(title?: string | null, vacancyId?: string | null, resumeId?: string | null) {
        loading.value = true
        error.value = null
        try {
            const res = await api.post<Chat>('/chat', { title: title ?? null, vacancyId: vacancyId ?? null, resumeId: resumeId ?? null })
            currentChatId.value = res.data.id
            chat.value = res.data
            messages.value = []
            return res.data
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to start chat'
            throw e
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
            currentChatId.value = res.data.id
            chat.value = res.data
            if (res.data.analysis) {
                analysis.value = res.data.analysis
                analysisError.value = !!res.data.analysis?.error
            }
            return res.data
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to fetch chat'
            throw e
        } finally {
            loading.value = false
        }
    }

    async function sendMessage(content: string) {
        if (!currentChatId.value) throw new Error('Chat is not initialized')
        loading.value = true
        error.value = null
        try {
            const res = await api.post<{ user: Message; assistant: Message }>(`/chat/${currentChatId.value}/message`, { content })
            return res.data
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to send message'
            throw e
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
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to delete chat'
            throw e
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
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to finish chat'
            throw e
        }
    }

    async function loadChatHistory() {
        loading.value = true
        error.value = null
        try {
            const res = await api.get<Chat[]>('/chats')
            chatHistory.value = res.data
            return res.data
        }
        finally {
            loading.value = false
        }
    }

    function disconnectWs() {
        if (ws) {
            try { ws.close() } catch { }
            ws = null
        }
    }

    function connectWs(chatId: string) {
        disconnectWs()
        const url = (import.meta as any).env?.VITE_BACKEND_WS_URL || 'ws://localhost:3000'
        ws = new WebSocket(`${url}/ws/chat?chatId=${encodeURIComponent(chatId)}`)
        ws.onmessage = (ev) => {
            try {
                const evt = JSON.parse(ev.data)
                if (evt?.type === 'message.created') {
                    const msg: Message = evt.payload
                    if (msg.chatId === (currentChatId.value as string | null)) {
                        messages.value = [...messages.value, msg]
                    }
                } else if (evt?.type === 'analysis.started') {
                    analysis.value = { status: 'running' }
                } else if (evt?.type === 'analysis.progress') {
                    analysis.value = { ...(analysis.value || {}), last: evt.payload }
                } else if (evt?.type === 'analysis.completed') {
                    analysis.value = evt.payload
                    analysisError.value = !!evt.payload?.error
                } else if (evt?.type === 'analysis.error') {
                    analysisError.value = true
                    analysis.value = { error: true, message: evt.payload?.message }
                } else if (evt?.type === 'message.deleted') {
                    messages.value = messages.value.filter(m => m.id !== evt.payload)
                }
            } catch { }
        }
    }

    // Auto-connect to WS when chatId changes
    watch(() => currentChatId.value, (id: string | null) => {
        if (id) connectWs(id)
        else disconnectWs()
    }, { immediate: true })

    return { chat, currentChatId, messages, loading, error, startChat, fetchChat, sendMessage, deleteChat, loadChatHistory, finishChat, analysis, analysisError }
}
