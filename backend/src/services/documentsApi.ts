import fetch from 'node-fetch'

const BASE_URL = process.env.RAG_API_URL || 'http://resumeparsing-dev:8000'

export const documentsApi = {
    async addDocument(payload: { source_id: string; source_type: 'resume' | 'dialogue' | 'vacancy'; document_name: string; content: string }) {
        const res = await fetch(`${BASE_URL}/api/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        if (!res.ok) {
            let msg = ''
            try { msg = await res.text() } catch { }
            throw new Error(`documentsApi.addDocument failed: ${res.status} ${msg}`)
        }
        return res.json()
    }
}

export default documentsApi


