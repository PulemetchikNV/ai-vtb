import { FastifyInstance, FastifySchema } from 'fastify';
import { prisma } from '../prisma';
import { chatEventBus } from '../services/chatEventBus';
import { analyzer } from '../services/analyzer';

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

        // Stub assistant reply
        const assistantText = `Echo: ${content}`;
        const assistantMsg = await prisma.message.create({
            data: { chatId: id, role: 'assistant', content: assistantText }
        });
        chatEventBus.broadcastMessageCreated(assistantMsg);

        return reply.send({ user: userMsg, assistant: assistantMsg });
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
        await prisma.chat.update({ where: { id }, data: { is_finished: true } });
        // fire-and-forget: шлём 204 сразу
        reply.code(204).send();
        // запустим/перезапустим анализ в фоне и транслируем прогресс через WS
        try {
            chatEventBus.broadcastAnalysisStarted(id);
            const result = await analyzer.analyzeDialog(id);
            // сохраняется в analyzer; здесь дополнительно читаем чат и берём analysis из БД как источник истины
            const updated = await prisma.chat.findUnique({ where: { id }, select: { analysis: true } });
            chatEventBus.broadcastAnalysisCompleted((updated?.analysis || result) as any);
        } catch (e: any) {
            chatEventBus.broadcastAnalysisError(id, e?.message || 'unknown error');
        }
    });
}
