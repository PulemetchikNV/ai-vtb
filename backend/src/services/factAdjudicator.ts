import { logger } from '../server'
import { chatDebugLog } from './chatDebug'
import { factArbitratorChain, type FactArbitratorOutput } from '../chains/factArbitratorChain'

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
        // Пробегаемся по ближайшим фактам и запрашиваем решение попарно
        let bestDecision: AdjudicationResult = { action: 'ADD_NEW' }
        for (const neighbor of neighbors) {
            try {
                const result = await factArbitratorChain.invoke({
                    old_fact_text: neighbor.fact,
                    old_fact_id: neighbor.fact_id,
                    new_fact_text: newFact.fact,
                }) as FactArbitratorOutput

                console.log('ARBITRATOR RESULT', result)
                // Логируем и сохраняем наиболее сильное решение
                await chatDebugLog(newFact.fact_id.split('_')[0] || 'unknown', `арбитр: решение по паре (${neighbor.fact_id} vs new): ${JSON.stringify(result)}`)
                logger.info({ event: 'fact_adjudication_pair', chatFact: newFact.fact_id, neighbor: neighbor.fact_id, action: (result as any).action, target: (result as any).target_fact_id }, 'Fact adjudication pair decision')

                if (result.action === 'INVALIDATE_OLD') {
                    bestDecision = { action: 'INVALIDATE_OLD', target_fact_id: (result as any).target_fact_id || neighbor.fact_id }
                    break
                }
                if (result.action === 'FLAG_CONTRADICTION' && bestDecision.action !== 'INVALIDATE_OLD') {
                    bestDecision = { action: 'FLAG_CONTRADICTION', note: (result as any).note }
                    // продолжаем перебор — вдруг найдётся INVALIDATE_OLD
                }
            } catch {
                // ignore and continue
            }
        }
        if (!bestDecision) return { action: 'ADD_NEW' }
        logger.info({ event: 'fact_adjudication', chatFact: newFact.fact_id, action: (bestDecision as any).action, target: (bestDecision as any).target_fact_id }, 'Fact adjudication decision')
        return bestDecision
    }
}


