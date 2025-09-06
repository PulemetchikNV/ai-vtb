import fetch from 'node-fetch'

const BASE_URL = process.env.RAG_API_URL

export const factsApi = {
    async ensureCollection(chatId: string) {
        const res = await fetch(`${BASE_URL}/api/facts/collections/${chatId}`, { method: 'POST' })
        return res.json().catch(() => ({}))
    },
    async addDocument(chatId: string, payload: { id?: string; text: string; meta?: Record<string, any> }) {
        const res = await fetch(`${BASE_URL}/api/facts/collections/${chatId}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        return res.json().catch(() => ({}))
    },
    async search(chatId: string, payload: { query: string; top_k?: number; where?: Record<string, any> }) {
        const res = await fetch(`${BASE_URL}/api/facts/collections/${chatId}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        return res.json().catch(() => ({}))
    },
    async updateMetadata(chatId: string, payload: { ids: string[]; metadatas: Record<string, any>[] }) {
        const res = await fetch(`${BASE_URL}/api/facts/collections/${chatId}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        return res.json().catch(() => ({}))
    }
}

export default factsApi


