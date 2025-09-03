import { ref } from "vue"

export type ChatItem = {
    id: string
    title: string | null
    createdAt: string
    updatedAt: string
}
export const chatHistory = ref<ChatItem[]>([])