import { FastifyInstance, FastifySchema } from 'fastify';
import { prisma } from '../prisma';

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
                    title: { type: ['string', 'null'] }
                },
                additionalProperties: false
            } as FastifySchema
        }
    }, async (req, reply) => {
        const body = (req.body as { title?: string | null }) || {};
        const chat = await prisma.chat.create({ data: { title: body.title ?? null } });
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

        // Stub assistant reply
        const assistantText = `Echo: ${content}`;
        const assistantMsg = await prisma.message.create({
            data: { chatId: id, role: 'assistant', content: assistantText }
        });

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
}
