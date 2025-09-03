import { computed, ref } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import router from '../router'
import { chatHistory } from '../__data__/store'

export type Chat = {
    id: string
    title: string | null
    createdAt: string
    updatedAt: string
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
    const messages = ref<Message[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function startChat(title?: string | null) {
        loading.value = true
        error.value = null
        try {
            const res = await api.post<Chat>('/chat', { title: title ?? null })
            currentChatId.value = res.data.id
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
            const res = await api.get<{ id: string; messages: Message[] }>(`/chat/${id}`)
            currentChatId.value = res.data.id
            messages.value = res.data.messages
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
            messages.value.push(res.data.user, res.data.assistant)
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
                messages.value = []
            }
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to delete chat'
            throw e
        } finally {
            loading.value = false
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

    return { currentChatId, messages, loading, error, startChat, fetchChat, sendMessage, deleteChat, loadChatHistory }
}
