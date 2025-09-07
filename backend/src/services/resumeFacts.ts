import { prisma } from '../prisma'
import { factsApi } from './factsApi'
import { appendLedgerFacts, type LedgerFact as MetaLedgerFact } from './factsMeta'
import { chatDebugLog } from './chatDebug'

type IngestParams = { chatId: string; resumeId: string }

export async function ingestResumeFactsToChat({ chatId, resumeId }: IngestParams): Promise<void> {
    const resume = await prisma.resume.findUnique({ where: { id: resumeId } }) as any
    const resumeFacts = Array.isArray(resume?.facts) ? resume.facts : []
    if (!resumeFacts.length) return

    await factsApi.ensureCollection(chatId)
    const now = Date.now()

    const normalized = (resumeFacts as any[])
        .map((f: any, idx: number) => {
            const factText = typeof f === 'string' ? f : (f?.fact || f?.text || '')
            const topic = typeof f === 'string' ? 'resume' : (f?.topic || 'resume')
            return { fact_id: `resume_${resumeId}_${now}_${idx}`, fact: String(factText || '').trim(), topic }
        })
        .filter((f: any) => f.fact.length > 0)

    for (const f of normalized) {
        await chatDebugLog(chatId, `(резюме) --| добавляем факт ${f.fact} в базу`)
        await factsApi.addDocument(chatId, { id: f.fact_id, text: f.fact, meta: { topic: f.topic, status: 'active', source: 'resume' } })
        await chatDebugLog(chatId, `(резюме) --| факт ${f.fact} добавлен в базу`)
    }

    await appendLedgerFacts(chatId, normalized.map(f => ({ ...f, status: 'active', invalidated_by: null })) as MetaLedgerFact[])
}

export default ingestResumeFactsToChat


