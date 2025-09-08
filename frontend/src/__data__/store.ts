import { ref } from "vue"
import { TOKEN_KEY } from "./constants"

export type ChatItem = {
    id: string
    title: string | null
    createdAt: string
    updatedAt: string
}
export const chatHistory = ref<ChatItem[]>([])

// Authorization state derived from localStorage token on init
export const isAuthorized = ref<boolean>(!!(typeof window !== 'undefined' && localStorage.getItem(TOKEN_KEY)))