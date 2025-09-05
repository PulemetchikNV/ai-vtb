import { FastifyInstance, FastifySchema } from 'fastify';
import { prisma } from '../prisma';
import { chatEventBus } from '../services/chatEventBus';
import { analyzer } from '../services/analyzer';
import { dialogueService } from '../services/dialogue';

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
    server.get('/chats', async () => {
        const chats = await prisma.chat.findMany({
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
                    vacancyId: { type: ['string', 'null'] }
                },
                additionalProperties: false
            } as FastifySchema
        }
    }, async (req, reply) => {
        const body = (req.body as { title?: string | null; vacancyId?: string | null }) || {};
        const vacancy = body.vacancyId ? await prisma.vacancy.findUnique({ where: { id: body.vacancyId } }) : null;
        const initialChecklist = vacancy?.requirements_checklist || [];

        const chat = await prisma.chat.create({
            data: {
                title: body.title ?? null,
                requirements_checklist: initialChecklist as any,
                ...(body.vacancyId
                    ? { vacancy: { connect: { id: body.vacancyId } } }
                    : {})
            }
        });
        if (vacancy) {
            try {
                const { systemPrompt, initialMessage } = await dialogueService.getInitialMessage({ vacancy });
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
        const { id } = req.params as { id: string };
        await prisma.message.deleteMany({ where: { chatId: id } });
        await prisma.chat.delete({ where: { id } });
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
        const { id } = req.params as { id: string };
        const { content } = req.body as { content: string };

        // Save user message
        const userMsg = await prisma.message.create({
            data: { chatId: id, role: 'user', content }
        });
        chatEventBus.broadcastMessageCreated(userMsg);
        const messageHistory = await prisma.message.findMany({ where: { chatId: id }, orderBy: { createdAt: 'asc' } });

        // Stub assistant reply
        try {
            const assistantText = await dialogueService.getNextMessage({ userMessage: content, messageHistory });
            const assistantMsg = await prisma.message.create({
                data: { chatId: id, role: 'assistant', content: assistantText }
            });
            chatEventBus.broadcastMessageCreated(assistantMsg);

            if (assistantMsg.content.includes('*FINISH CALL*')) {
                finishChat(id, async () => { }, 'Собеседник завершил разговор');
            }

            return reply.send({ user: userMsg, assistant: assistantMsg || null });
        } catch (e) {
            console.error('Error getting next message', e);
            await prisma.message.delete({ where: { id: userMsg.id } });
            chatEventBus.broadcastMessageDeleted(userMsg);
            return reply.status(500).send({ error: 'Error getting next message' });
        }
    });

    server.get('/chat/:id', async (req) => {
        const { id } = req.params as { id: string };
        const chat = await prisma.chat.findUnique({
            where: { id },
            include: { messages: { orderBy: { createdAt: 'asc' } } }
        });
        return chat;
    });

    server.post('/chat/:id/finish', async (req, reply) => {
        const { id } = req.params as { id: string };
        // пометить чат завершённым
        finishChat(id, () => reply.code(204).send());
    });
}