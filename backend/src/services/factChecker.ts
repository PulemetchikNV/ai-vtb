import { GET_FACTS_PROMPT } from "../__data__/prompts";
import { aiService } from "./ai";
import { extractJsonWithoutRegex } from "../utils";
import { prisma } from "../prisma";
import fetch from 'node-fetch';
import { logger } from "../server";
import { factAdjudicator, type LedgerFact } from "./factAdjudicator";
import { chatDebugLog } from "./chatDebug";

type FactItem = {
    fact: string;
    topic: string;
    project: string;
    message_id?: string;
}

export const factChecker = {
    /**
     * Guardian: searches nearest facts in per-chat facts collection and asks LLM to detect contradictions.
     * Appends found contradictions into chat.facts_meta.contradictions.
     */
    runGuardianForFact: async ({ chatId, fact }: { chatId: string; fact: FactItem }) => {
        await chatDebugLog(chatId, `проверяем противоречат ли факты чему-либо`)
        // 1) Find top-3 nearest facts in the per-chat collection
        const searchRes = await fetch(`http://resumeparsing-dev:8000/api/facts/collections/${chatId}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: fact.fact, top_k: 3, where: { "status": { "$eq": "active" } } })
        }).then(r => r.json()) as any;

        const neighbors: string[] = searchRes?.documents?.[0] || [];
        if (!neighbors.length) return;

        // 2) Ask LLM to extract contradictions
        const guardianPrompt = `
        Проанализируй новый факт и список близких фактов из истории диалога.
        Верни JSON-массив элементов вида {"explanation": "string", "conflicting_facts": [{"fact": "string", "message_id": "string"}]}

        Новый факт: "${fact.fact}"
        Похожие факты:
        ${neighbors.map((d, idx) => `- ${d}`).join('\n')}

        Верни ответ СТРОГО в формате JSON массива без дополнительных комментариев.
        
        В explanation пиши о каком факте идет речь (его суть). НЕЛЬЗЯ ПИСАТЬ "Новый факт"
        `;

        try {
            const guardianResp = await aiService.communicateWithGemini([{ role: 'user', content: guardianPrompt }], true, 'gemini-2.0-flash');
            const extracted = JSON.parse(extractJsonWithoutRegex(guardianResp) ?? '[]') as any[];
            logger.info({ event: 'guardian_contradictions', chatId, count: Array.isArray(extracted) ? extracted.length : 0 }, 'Guardian extracted contradictions')
            await chatDebugLog(chatId, `финальные факты для ответа: ${JSON.stringify(extracted)}`)
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
        const prompt = GET_FACTS_PROMPT(content);
        const response = await aiService.communicateWithGemini([{ role: 'user', content: prompt }], true, 'gemini-2.0-flash');

        try {
            const parsed = JSON.parse(extractJsonWithoutRegex(response) ?? '') as FactItem[];
            logger.info({ event: 'facts_extracted', chatId, count: Array.isArray(parsed) ? parsed.length : 0 }, 'Facts extracted from message')
            await chatDebugLog(chatId, `получены факты: ${JSON.stringify(parsed.map(f => f.fact))}`)
            if (!Array.isArray(parsed)) {
                throw new Error('Invalid response');
            }

            if (!parsed.length) {
                return;
            }

            if (!('fact' in parsed[0]) || !('topic' in parsed[0]) || !('project' in parsed[0])) {
                throw new Error('Invalid response');
            }

            const chat = await prisma.chat.findUnique({ where: { id: chatId }, select: { facts_meta: true, id: true } });
            const currentFactsMeta = chat?.facts_meta as any;

            const now = Date.now()
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
                await fetch(`http://resumeparsing-dev:8000/api/facts/collections/${chatId}`, { method: 'POST' });
                // add each fact as separate document
                for (let i = 0; i < newLedgerFacts.length; i++) {
                    const f = newLedgerFacts[i] as any;
                    await fetch(`http://resumeparsing-dev:8000/api/facts/collections/${chatId}/documents`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: f.fact_id, text: f.fact, meta: { topic: f.topic, status: 'active' } })
                    });

                    // Adjudicator: decide lifecycle
                    const searchRes = await fetch(`http://resumeparsing-dev:8000/api/facts/collections/${chatId}/search`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: f.fact, top_k: 2, where: { "status": { "$eq": "active" } } })
                    }).then(r => r.json()) as any;
                    const neighborDocs: string[] = searchRes?.documents?.[0] || []
                    const neighborIds: string[] = searchRes?.ids?.[0] || []
                    const neighbors: LedgerFact[] = neighborDocs.map((text, idx) => ({
                        fact_id: neighborIds[idx], fact: text, status: 'active', invalidated_by: null
                    })) as LedgerFact[]

                    const decision = await factAdjudicator.adjudicate(f, neighbors)
                    logger.info({ event: 'adjudicator_decision', chatId, fact_id: f.fact_id, decision }, 'Adjudicator decision')
                    if (decision.action === 'INVALIDATE_OLD' && (decision as any).target_fact_id) {
                        // invalidate in DB
                        const latest = (await prisma.chat.findUnique({ where: { id: chatId }, select: { facts_meta: true } }))?.facts_meta as any
                        const updatedLedger = (latest?.fact_ledger || []).map((lf: any) => lf.fact_id === (decision as any).target_fact_id
                            ? { ...lf, status: 'invalidated', invalidated_by: f.fact_id }
                            : lf)
                        await prisma.chat.update({ where: { id: chatId }, data: { facts_meta: { ...(latest || {}), fact_ledger: updatedLedger } } })
                        // invalidate in vectorstore
                        await fetch(`http://resumeparsing-dev:8000/api/facts/collections/${chatId}/update`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ids: [(decision as any).target_fact_id], metadatas: [{ status: 'invalidated', invalidated_by: f.fact_id }] })
                        })
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