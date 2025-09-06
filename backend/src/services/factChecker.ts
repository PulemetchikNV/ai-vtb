import { prisma } from "../prisma";
import fetch from 'node-fetch';
import { logger } from "../server";
import { factAdjudicator, type LedgerFact } from "./factAdjudicator";
import { chatDebugLog } from "./chatDebug";
import { factsApi } from "./factsApi";
import { factExtractorChain } from "../chains/factExtractorChain";
import { factContradictionChain, type GuardianContradiction } from "../chains/factContradictionChain";

type ExtractedFact = {
    fact: string;
    topic: string;
    message_id?: string | null;
}

export const factChecker = {
    /**
     * Guardian: searches nearest facts in per-chat facts collection and asks LLM to detect contradictions.
     * Appends found contradictions into chat.facts_meta.contradictions.
     */
    runGuardianForFact: async ({ chatId, fact }: { chatId: string; fact: ExtractedFact }) => {
        await chatDebugLog(chatId, `(страж) проверяем противоречат ли факты чему-либо`)
        // 1) Find top-3 nearest facts in the per-chat collection
        const searchRes = await factsApi.search(chatId, { query: fact.fact, top_k: 3, where: { "status": { "$eq": "active" } } }) as any;

        const neighbors: string[] = searchRes?.documents?.[0] || [];
        if (!neighbors.length) return;

        // 2) Ask LLM via chain to extract contradictions
        try {
            const extracted = await factContradictionChain.invoke({
                new_fact_text: fact.fact,
                neighbor_facts: neighbors,
            }) as GuardianContradiction[];
            logger.info({ event: 'guardian_contradictions', chatId, count: Array.isArray(extracted) ? extracted.length : 0 }, 'Guardian extracted contradictions')
            await chatDebugLog(chatId, `(страж) финальные противоречащие друг другу факты для ответа: ${JSON.stringify(extracted)}`)
            if (Array.isArray(extracted) && extracted.length > 0) {
                // fetch latest facts_meta to avoid stale overwrites
                const chat = await prisma.chat.findUnique({ where: { id: chatId }, select: { facts_meta: true } });
                const current = chat?.facts_meta as any;
                const prepared = extracted.map((c) => ({ ...c, sent: false }));
                await prisma.chat.update({
                    where: { id: chatId },
                    data: {
                        facts_meta: {
                            fact_ledger: [...(current?.fact_ledger || [])],
                            contradictions: [...(current?.contradictions || []), ...prepared]
                        }
                    }
                });
            }
        } catch (e) {
            console.error('Guardian LLM failed:', e);
        }
    },

    handleMessage: async ({ content, chatId }: { content: string, chatId: string }) => {
        await chatDebugLog(chatId, `получили сообщение: ${JSON.stringify(content)}`)
        try {
            const extracted = await factExtractorChain.invoke({ candidate_sentence: content });
            console.log('=== EXTRACTED FACTS ===', extracted)
            await chatDebugLog(chatId, `получены факты (raw): ${JSON.stringify(extracted)}`)
            const parsed: ExtractedFact[] = extracted ? extracted.map(f => ({ fact: f.fact, topic: f.topic, message_id: null })) : [];
            logger.info({ event: 'facts_extracted', chatId, count: parsed.length }, 'Facts extracted from message')
            await chatDebugLog(chatId, `получены факты: ${JSON.stringify(parsed.map(f => f.fact))}`)
            if (!parsed.length) {
                return;
            }

            const chat = await prisma.chat.findUnique({ where: { id: chatId }, select: { facts_meta: true, id: true } });
            const currentFactsMeta = chat?.facts_meta as any;

            const now = Date.now()
            const currentBatchId = `${chatId}_${now}`
            const newLedgerFacts = parsed.map((f, idx) => ({
                fact_id: `${chatId}_${now}_${idx}`,
                fact: f.fact,
                topic: f.topic,
                message_id: f.message_id || null,
                status: 'active',
                invalidated_by: null,
            }))

            await prisma.chat.update({
                where: { id: chatId }, data: {
                    facts_meta: {
                        fact_ledger: [
                            ...((currentFactsMeta?.fact_ledger || []) as any[]),
                            ...newLedgerFacts,
                        ],
                        contradictions: [...(currentFactsMeta?.contradictions || [])]
                    }
                }
            });
            await chatDebugLog(chatId, `факты занесены в базу`)

            // Ensure per-chat facts collection exists and append facts as documents
            try {
                await factsApi.ensureCollection(chatId);
                // add each fact as separate document
                for (let i = 0; i < newLedgerFacts.length; i++) {
                    const f = newLedgerFacts[i] as any;
                    chatDebugLog(chatId, `(арбитратор) --| добавляем факт ${f.fact_id} в базу`)

                    await factsApi.addDocument(chatId, { id: f.fact_id, text: f.fact, meta: { topic: f.topic, status: 'active', ingest_batch: currentBatchId } });

                    // Adjudicator: decide lifecycle
                    const searchRes = await factsApi.search(chatId, { query: f.fact, top_k: 2, where: { "$and": [{ "status": { "$eq": "active" } }, { "ingest_batch": { "$ne": currentBatchId } }] } }) as any;
                    chatDebugLog(chatId, `(арбитратор) --| найдены соседи ${JSON.stringify(searchRes)}`)
                    const neighborDocs: string[] = searchRes?.documents?.[0] || []
                    const neighborIds: string[] = searchRes?.ids?.[0] || []
                    // filter out freshly ingested in this batch and the current one
                    const filteredById = neighborIds
                        .map((id, idx) => ({ id, text: neighborDocs[idx] }))
                        .filter(pair => pair.id && !pair.id.startsWith(`${currentBatchId}_`) && pair.id !== f.fact_id)
                    const filteredNeighbors: LedgerFact[] = filteredById.map(pair => ({
                        fact_id: pair.id, fact: pair.text, status: 'active', invalidated_by: null
                    })) as LedgerFact[]

                    const decision = filteredNeighbors.length ? await factAdjudicator.adjudicate(f, filteredNeighbors) : { action: 'ADD_NEW' }
                    chatDebugLog(chatId, `(арбитратор): решение ${JSON.stringify(decision)}`)
                    logger.info({ event: 'adjudicator_decision', chatId, fact_id: f.fact_id, decision }, 'Adjudicator decision')

                    if (decision.action === 'INVALIDATE_OLD' && (decision as any).target_fact_id) {
                        // invalidate in DB
                        const latest = (await prisma.chat.findUnique({ where: { id: chatId }, select: { facts_meta: true } }))?.facts_meta as any
                        const updatedLedger = (latest?.fact_ledger || []).map((lf: any) => lf.fact_id === (decision as any).target_fact_id
                            ? { ...lf, status: 'invalidated', invalidated_by: f.fact_id }
                            : lf)
                        await prisma.chat.update({ where: { id: chatId }, data: { facts_meta: { ...(latest || {}), fact_ledger: updatedLedger } } })
                        // invalidate in vectorstore
                        await factsApi.updateMetadata(chatId, { ids: [(decision as any).target_fact_id], metadatas: [{ status: 'invalidated', invalidated_by: f.fact_id }] })
                    }

                    if (decision.action === 'FLAG_CONTRADICTION') {
                        await factChecker.runGuardianForFact({ chatId, fact: f });
                    }
                }
            } catch (e) {
                console.error('Failed to upsert facts in vectorstore:', e);
            }

            return parsed;
        } catch (error) {
            console.error('Error parsing response:', error);
            return [];
        }
    }
}