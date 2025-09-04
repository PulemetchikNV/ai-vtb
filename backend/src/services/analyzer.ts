import { GET_INTERVIEW_ANALYSIS_PROMPT } from "../__data__/prompts";
import { prisma } from "../prisma";
import { aiService } from "./ai";
import fetch from 'node-fetch';
import { chatEventBus } from './chatEventBus';

type ChecklistItemFinal = {
    id: string;
    description: string;
    type: string;
    weight: number;
    status: string;
    score: number;
    justification: string;
}

type RetrieverResponse = {
    documents?: string[][];
    metadatas?: any;
    ids?: string[];
};

async function analyzeDialog(chatId: string) {
    // Stub: fetch chat and vacancy, then fill requirements_checklist with default evaluation
    const chat = await prisma.chat.findUnique({ where: { id: chatId }, include: { vacancy: true } });
    if (!chat) return null;
    console.log('ANALYZER STARTED FOR CHAT', chatId)

    const base = Array.isArray(chat.requirements_checklist) ? chat.requirements_checklist as any[] : [];

    let checklist: any[] = base;
    if ((!checklist || checklist.length === -1) && chat.vacancy && Array.isArray((chat.vacancy as any).requirements_checklist)) {
        // map vacancy requirements to analysis schema
        const vacReqs = (chat.vacancy as any).requirements_checklist as Array<any>;
        checklist = vacReqs.map(req => ({
            id: req.id,
            description: req.description,
            type: req.type,
            weight: req.weight,
            status: 'unconfirmed',
            score: -1,
            justification: ''
        }));
    }

    // 1) Отправляем финальную запись диалога в resumeParsing (как документ типа dialogue)
    const transcript = (await prisma.message.findMany({ where: { chatId }, orderBy: { createdAt: 'asc' } }))
        .map(m => `${m.role === 'user' ? 'Кандидат' : 'Ассистент'}: ${m.content}`).join('\n');
    console.log('TRANSCRIPT', transcript)

    let hadError = false;
    try {
        await fetch('http://resumeparsing-dev:8000/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source_id: chatId,
                source_type: 'dialogue',
                document_name: `dialogue_${chatId}`,
                content: transcript,
            })
        });
        console.log('LOADED DIALOGUE TO RESUMEPARSING')
    } catch (e) {
        console.error('Failed to upload dialogue to resumeParsing:', e);
        hadError = true;
    }

    // 2) Для каждого требования — запрос к ретриверу по транскрипту, затем анализ через LLM
    await Promise.all((checklist as ChecklistItemFinal[]).map(async (item) => {
        let fragmentsText = '';
        try {
            console.log(`Getting resumeParsing query for item ${item.description}`)
            const qRes = await fetch('http://resumeparsing-dev:8000/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query_text: item.description,
                    filters: [
                        { field: 'source_id', operator: '$eq', value: chatId },
                        { field: 'source_type', operator: '$eq', value: 'dialogue' },
                    ],
                    top_k: 3,
                })
            });
            const data = (await qRes.json()) as RetrieverResponse;
            console.log('RESUMEPARSING QUERY RESPONSE', data)
            const docs: string[] = data?.documents?.[0] ?? [];
            if (!docs || docs.length === 0) {
                throw new Error('No documents found');
            }
            fragmentsText = docs.map((d, i) => `Фрагмент ${i + 1}: ${d}`).join('\n\n');
            chatEventBus.broadcastAnalysisProgress(chatId, { id: item.id, fragments: docs });
        } catch (e) {
            console.error('Retriever query failed:', e);
            // продолжим без фрагментов
            fragmentsText = '';
            hadError = true;
            chatEventBus.broadcastAnalysisProgress(chatId, { id: item.id, error: 'retriever_failed' });
        }

        const prompt = GET_INTERVIEW_ANALYSIS_PROMPT(item.description, [fragmentsText]);
        try {
            const response = await aiService.communicateWithGemini([{ role: 'user', content: prompt }], true);
            const parsed = JSON.parse(response) as Partial<ChecklistItemFinal>;
            if (typeof parsed.score === 'number') item.score = parsed.score;
            if (typeof parsed.justification === 'string') item.justification = parsed.justification;
            item.status = 'evaluated';
            chatEventBus.broadcastAnalysisProgress(chatId, { id: item.id, score: item.score, justification: item.justification });
        } catch (e) {
            console.error('Error analyzing dialog:', e);
            hadError = true;
            chatEventBus.broadcastAnalysisProgress(chatId, { id: item.id, error: 'llm_failed' });
        }
    }));
    console.log('ANALYZER RETRIEVE COMPLETED')

    // 3) Подсчёт агрегатов по категориям и финальный скор
    // Нормализация 0..10 -> 0..1
    const normalized = (val: number) => {
        if (!Number.isFinite(val)) return 0;
        return Math.min(1, Math.max(0, val / 10));
    };

    // Сводные веса категорий (мок, позже расширим)
    const CATEGORY_WEIGHTS: Record<string, number> = {
        technical_skill: 0.7,
        soft_skill: 0.3,
    };

    // Группировка по типам и средневзвешенные
    const byType = new Map<string, { sum: number; w: number }>();
    for (const it of checklist as ChecklistItemFinal[]) {
        const cat = it.type;
        const w = Number(it.weight) || 0;
        const n = normalized(Number(it.score));
        if (!byType.has(cat)) byType.set(cat, { sum: 0, w: 0 });
        const agg = byType.get(cat)!;
        agg.sum += n * w;
        agg.w += w;
    }

    const categoryScores: Record<string, number> = {};
    for (const [cat, { sum, w }] of byType.entries()) {
        categoryScores[cat] = w > 0 ? sum / w : 0;
    }

    console.log('ANALYZER CATEGORY SCORES', categoryScores)

    // Финальный скор как сумма categoryScore * CATEGORY_WEIGHTS
    let finalScore = 0;
    let totalCatWeight = 0;
    for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS)) {
        const cScore = categoryScores[cat] ?? 0;
        finalScore += cScore * weight;
        totalCatWeight += weight;
    }
    if (totalCatWeight > 0) finalScore = finalScore / totalCatWeight;

    const saved = await prisma.chat.update({
        where: { id: chatId },
        data: { requirements_checklist: checklist, is_finished: true, analysis: { chatId, items: checklist, categoryScores, finalScore, error: hadError } as any } as any
    });

    console.log('ANALYZER COMPLETED FOR CHAT', chatId)
    return saved.analysis as any;
}

export const analyzer = {
    analyzeDialog: analyzeDialog
}