import { prisma } from '../prisma'

export type LedgerStatus = 'active' | 'invalidated' | 'clarified'

export interface LedgerFact {
    fact_id: string
    fact: string
    topic?: string
    message_id?: string | null
    status: LedgerStatus
    invalidated_by: string | null
}

export type FactSource = 'chat' | 'resume'

export interface ContradictingFactRef {
    fact: string
    message_id: string | null
    source: FactSource
}

export interface Contradiction {
    explanation: string
    conflicting_facts: ContradictingFactRef[]
    sent?: boolean
}

export interface FactsMeta {
    fact_ledger: LedgerFact[]
    contradictions: Contradiction[]
}

function withDefaults(meta: any | null | undefined): FactsMeta {
    const base = (meta || {}) as Partial<FactsMeta>
    return {
        fact_ledger: Array.isArray(base.fact_ledger) ? base.fact_ledger as LedgerFact[] : [],
        contradictions: Array.isArray(base.contradictions) ? base.contradictions as Contradiction[] : [],
    }
}

export async function getFactsMeta(chatId: string): Promise<FactsMeta> {
    const chat = await prisma.chat.findUnique({ where: { id: chatId }, select: { facts_meta: true } })
    return withDefaults(chat?.facts_meta)
}

export async function setFactsMeta(chatId: string, meta: FactsMeta): Promise<void> {
    await prisma.chat.update({ where: { id: chatId }, data: { facts_meta: meta as any } })
}

export async function updateFactsMeta(chatId: string, updater: (prev: FactsMeta) => FactsMeta): Promise<FactsMeta> {
    const prev = await getFactsMeta(chatId)
    const next = updater(prev)
    await setFactsMeta(chatId, next)
    return next
}

export async function appendLedgerFacts(chatId: string, newFacts: LedgerFact[]): Promise<FactsMeta> {
    return updateFactsMeta(chatId, (prev) => ({
        ...prev,
        fact_ledger: [...prev.fact_ledger, ...newFacts],
    }))
}

export async function appendContradictions(chatId: string, items: Contradiction[]): Promise<FactsMeta> {
    const prepared = items.map(i => ({ ...i, sent: !!i.sent }))
    return updateFactsMeta(chatId, (prev) => ({
        ...prev,
        contradictions: [...prev.contradictions, ...prepared],
    }))
}

export async function markContradictionsSent(chatId: string): Promise<FactsMeta> {
    return updateFactsMeta(chatId, (prev) => ({
        ...prev,
        contradictions: prev.contradictions.map(c => ({ ...c, sent: true })),
    }))
}

export async function invalidateFact(chatId: string, target_fact_id: string, invalidator_fact_id: string): Promise<FactsMeta> {
    return updateFactsMeta(chatId, (prev) => ({
        ...prev,
        fact_ledger: prev.fact_ledger.map(lf => lf.fact_id === target_fact_id
            ? { ...lf, status: 'invalidated', invalidated_by: invalidator_fact_id }
            : lf),
    }))
}


