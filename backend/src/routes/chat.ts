import { FastifyInstance, FastifySchema } from 'fastify';
import { prisma } from '../prisma';
import { chatEventBus } from '../services/chatEventBus';
import { requireAuth } from '../middleware/authMiddleware'
import { analyzer } from '../services/analyzer';
import { dialogueService } from '../services/dialogue';
import { factChecker } from '../services/factChecker';
import { processSavedUserMessage, finishChat as flowFinishChat } from '../services/chatFlow'
import { factsApi } from '../services/factsApi';
import { ingestResumeFactsToChat } from '../services/resumeFacts';

async function finishChat(chatId: string, callback: () => any, finishMessage?: string) {
    const originalChat = await prisma.chat.findUnique({ where: { id: chatId } });
    const isOriginalFinished = originalChat?.is_finished;

    if (!isOriginalFinished) {
        await prisma.chat.update({ where: { id: chatId }, data: { is_finished: true } });
        const systemMsg = await prisma.message.create({ data: { chatId, role: 'system', content: finishMessage ?? 'Разговор завершен' } });
        chatEventBus.broadcastMessageCreated(systemMsg);
    }
    // fire-and-forget: шлём 204 сразу
    callback();
    // запустим/перезапустим анализ в фоне и транслируем прогресс через WS
    try {
        chatEventBus.broadcastAnalysisStarted(chatId);
        const result = await analyzer.analyzeDialog(chatId);
        // сохраняется в analyzer; здесь дополнительно читаем чат и берём analysis из БД как источник истины
        const updated = await prisma.chat.findUnique({ where: { id: chatId }, select: { analysis: true } });
        chatEventBus.broadcastAnalysisCompleted((updated?.analysis || result) as any);
    } catch (e: any) {
        await prisma.chat.update({
            where: { id: chatId },
            data: { analysis: { chatId, error: true } as any } as any
        });
        chatEventBus.broadcastAnalysisError(chatId, e?.message || 'unknown error');
    }
}

export default async function chatRoutes(server: FastifyInstance) {
    server.get('/chats', async (req, reply) => {
        const user = requireAuth(req); if (!user) return reply.code(401).send({ error: 'Unauthorized' })
        const chats = await prisma.chat.findMany({
            where: { user: { id: user.id } } as any,
            orderBy: { updatedAt: 'desc' },
            select: { id: true, title: true, createdAt: true, updatedAt: true }
        });
        return chats;
    });
    server.post('/chat', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    title: { type: ['string', 'null'] },
                    lang: { type: 'string' },
                    vacancyId: { type: ['string', 'null'] },
                    resumeId: { type: ['string', 'null'] }
                },
                additionalProperties: false
            } as FastifySchema
        }
    }, async (req, reply) => {
        const user = requireAuth(req); if (!user) return reply.code(401).send({ error: 'Unauthorized' })
        const body = (req.body as { title?: string | null; lang?: string; vacancyId?: string | null; resumeId?: string | null }) || {};
        const vacancy = body.vacancyId ? await prisma.vacancy.findUnique({ where: { id: body.vacancyId } }) : null;
        const initialChecklist = vacancy?.requirements_checklist || [];

        const chat = await prisma.chat.create({
            data: ({
                user: { connect: { id: user.id } },
                title: body.title ?? null,
                lang: body.lang ?? 'ru',
                requirements_checklist: initialChecklist as any,
                ...(body.vacancyId
                    ? { vacancy: { connect: { id: body.vacancyId } } }
                    : {}),
                ...(body.resumeId
                    ? { resume: { connect: { id: body.resumeId } } }
                    : {}),
                facts_meta: { fact_ledger: [], contradictions: [] } as any
            } as any)
        });

        // If resume selected, push its facts into per-chat vectorstore and ledger
        if (body.resumeId) {
            await ingestResumeFactsToChat({ chatId: chat.id, resumeId: body.resumeId }).catch(e => console.error('Failed to ingest resume facts:', e))
        }

        if (vacancy) {
            try {
                // Подмешаем строковое резюме, если оно привязано
                const resume = body.resumeId ? (await prisma.resume.findUnique({ where: { id: body.resumeId } })) : null;

                const resumeText = resume?.text ?? resume?.text_raw ?? '';
                const { systemPrompt, initialMessage } = await dialogueService.getInitialMessage({ vacancy, resumeText, lang: body.lang });
                await prisma.message.create({ data: { chatId: chat.id, role: 'user', content: ``, hiddenContent: systemPrompt } });
                await prisma.message.create({ data: { chatId: chat.id, role: 'assistant', content: initialMessage } });
            } catch (e) {
                console.error('Error getting initial message', e);
                await prisma.chat.delete({ where: { id: chat.id } });
                return reply.code(500).send({ error: 'Error getting initial message' });
            }
        }
        return reply.code(201).send(chat);
    });

    server.delete('/chat/:id', async (req, reply) => {
        const user = requireAuth(req); if (!user) return reply.code(401).send({ error: 'Unauthorized' })
        const { id } = req.params as { id: string };
        await prisma.message.deleteMany({ where: { chatId: id, chat: { user: { id: user.id } } } as any });
        await prisma.chat.delete({ where: { id, user: { id: user.id } } as any });
        return reply.code(204).send();
    });

    server.post('/chat/:id/message', {
        schema: {
            body: {
                type: 'object',
                required: ['content'],
                properties: {
                    content: { type: 'string' }
                },
                additionalProperties: false
            } as FastifySchema
        }
    }, async (req, reply) => {
        const user = requireAuth(req); if (!user) return reply.code(401).send({ error: 'Unauthorized' })
        const { id } = req.params as { id: string };
        const { content } = req.body as { content: string };

        // Save user message
        const chatOwner = await prisma.chat.findUnique({ where: { id }, select: { user: { select: { id: true } } } as any }) as any
        if (!chatOwner || chatOwner.user.id !== user.id) return reply.code(404).send({ error: 'Chat not found' })

        const userMsg = await prisma.message.create({ data: { chatId: id, role: 'user', content } });
        chatEventBus.broadcastMessageCreated(userMsg);

        const messageHistory = await prisma.message.findMany({ where: { chatId: id }, orderBy: { createdAt: 'asc' } });

        // Run analysis and fact extraction in parallel
        try {
            const { assistantMsg } = await processSavedUserMessage({ chatId: id, userContent: content })

            return reply.send({ user: userMsg, assistant: assistantMsg || null });
        } catch (e) {
            console.error('Error getting next message', e);
            await prisma.message.delete({ where: { id: userMsg.id } });
            chatEventBus.broadcastMessageDeleted(userMsg);
            return reply.status(500).send({ error: 'Error getting next message' });
        }
    });

    server.get('/chat/:id', async (req, reply) => {
        const user = requireAuth(req); if (!user) return reply.code(401).send({ error: 'Unauthorized' })
        const { id } = req.params as { id: string };

        // HR can access any chat, users can only access their own chats
        const whereCondition = user.role === 'hr' ? { id } : { id, user: { id: user.id } };

        const chat = await prisma.chat.findFirst({
            where: whereCondition as any,
            include: {
                messages: { orderBy: { createdAt: 'asc' } },
                user: { select: { id: true, email: true } },
                resume: { select: { id: true, fileName: true } },
                vacancy: { select: { id: true, title: true } }
            }
        });
        return chat;
    });

    server.post('/chat/:id/finish', async (req, reply) => {
        const user = requireAuth(req); if (!user) return reply.code(401).send({ error: 'Unauthorized' })
        const { id } = req.params as { id: string };
        // пометить чат завершённым
        flowFinishChat(id, () => reply.code(204).send());
    });
}