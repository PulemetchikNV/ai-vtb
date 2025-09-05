import { aiService } from './ai'
import { extractJsonWithoutRegex } from '../utils'
import { logger } from '../server'

export type LedgerFact = {
    fact_id: string
    fact: string
    topic?: string
    message_id?: string | null
    status: 'active' | 'invalidated' | 'clarified'
    invalidated_by: string | null
}

export type AdjudicationResult =
    | { action: 'ADD_NEW' }
    | { action: 'FLAG_CONTRADICTION'; note?: string }
    | { action: 'INVALIDATE_OLD'; target_fact_id: string }

export const factAdjudicator = {
    async adjudicate(newFact: LedgerFact, neighbors: LedgerFact[]): Promise<AdjudicationResult> {
        const neighborText = neighbors
            .map(n => `- [${n.fact_id}] ${n.fact} (status: ${n.status})`)
            .join('\n')

        const prompt = `Ты — логический анализатор. Проанализируй новое утверждение кандидата в контексте предыдущих утверждений.
Верни строго JSON одного из видов:
{"action":"ADD_NEW"}
{"action":"FLAG_CONTRADICTION","note":"строка"}
{"action":"INVALIDATE_OLD","target_fact_id":"fact_123"}

Новое утверждение: ${newFact.fact}
Предыдущие утверждения:\n${neighborText}`

        try {
            const resp = await aiService.communicateWithGemini([{ role: 'user', content: prompt }], true, 'gemini-2.0-flash')
            const parsed = JSON.parse(extractJsonWithoutRegex(resp) ?? '{}') as AdjudicationResult
            if (!parsed || !('action' in parsed)) return { action: 'ADD_NEW' }
            logger.info({ event: 'fact_adjudication', chatFact: newFact.fact_id, action: (parsed as any).action, target: (parsed as any).target_fact_id }, 'Fact adjudication decision')
            return parsed
        } catch {
            return { action: 'ADD_NEW' }
        }
    }
}


