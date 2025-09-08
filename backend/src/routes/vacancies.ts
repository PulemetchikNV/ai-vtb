import { FastifyInstance, FastifySchema } from 'fastify';
import { prisma } from '../prisma';
import { REQUIREMENT_TYPES } from '../__data__/constants';
import { requireAuth, requireRole } from '../middleware/authMiddleware'

const vacancySchema = {
    body: {
        type: 'object',
        required: ['title', 'description_text', 'requirements_checklist'],
        properties: {
            title: { type: 'string' },
            description_text: { type: 'string' },
            requirements_checklist: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['id', 'description', 'type', 'weight'],
                    properties: {
                        id: { type: 'string' },
                        description: { type: 'string' },
                        type: { type: 'string' },
                        weight: { type: 'number', minimum: 0, maximum: 10 }
                    },
                    additionalProperties: false
                }
            },
            category_weights: {
                type: 'object',
                properties: {
                    technical_skill: { type: 'number', minimum: 0, maximum: 1 },
                    soft_skill: { type: 'number', minimum: 0, maximum: 1 }
                },
                additionalProperties: true
            }
        },
        additionalProperties: false
    } as FastifySchema
}

export default async function vacancyRoutes(server: FastifyInstance) {
    server.get('/vacancies', async (req, reply) => {
        const user = requireAuth(req); if (!user) return reply.code(401).send({ error: 'Unauthorized' })
        const vacancies = await prisma.vacancy.findMany({
            orderBy: { updatedAt: 'desc' },
            select: { id: true, title: true, description_text: true, requirements_checklist: true, category_weights: true, createdAt: true, updatedAt: true }
        });
        return vacancies;
    });

    server.post('/vacancies', {
        schema: vacancySchema
    }, async (req, reply) => {
        const user = requireAuth(req); if (!user) return reply.code(401).send({ error: 'Unauthorized' })
        if (!requireRole(user, 'hr', reply)) return
        const body = req.body as { title: string; description_text: string; requirements_checklist: unknown; category_weights?: Record<string, number> };
        const vacancy = await prisma.vacancy.create({ data: ({ ...body, userId: user.id } as any) });
        return reply.code(201).send(vacancy);
    });

    server.delete('/vacancies/:id', async (req, reply) => {
        const user = requireAuth(req); if (!user) return reply.code(401).send({ error: 'Unauthorized' })
        if (!requireRole(user, 'hr', reply)) return
        const { id } = req.params as { id: string };
        await prisma.vacancy.delete({ where: { id } });
        return reply.code(204).send();
    });

    server.put('/vacancies/:id', {
        schema: vacancySchema
    }, async (req, reply) => {
        const user = requireAuth(req); if (!user) return reply.code(401).send({ error: 'Unauthorized' })
        if (!requireRole(user, 'hr', reply)) return
        const { id } = req.params as { id: string };
        const body = req.body as Partial<{ title: string; description_text: string; requirements_checklist: unknown; category_weights?: Record<string, number> }>;
        const vacancy = await prisma.vacancy.update({ where: { id }, data: body as any });
        return reply.code(200).send(vacancy);
    });

    // Get single vacancy details
    server.get('/vacancy/:id', async (req, reply) => {
        const user = requireAuth(req); if (!user) return reply.code(401).send({ error: 'Unauthorized' })
        const { id } = req.params as { id: string };
        const vacancy = await prisma.vacancy.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                description_text: true,
                requirements_checklist: true,
                category_weights: true,
                createdAt: true,
                updatedAt: true,
                userId: true
            }
        });
        if (!vacancy) return reply.code(404).send({ error: 'Vacancy not found' });
        return vacancy;
    });

    // Get vacancy analytics (HR only)
    server.get('/vacancy/:id/analytics', async (req, reply) => {
        const user = requireAuth(req); 
        console.log('user', user)
        if (!user) return reply.code(401).send({ error: 'Unauthorized' })
        if (!requireRole(user, 'hr', reply)) return
        const { id } = req.params as { id: string };

        // Get all chats for this vacancy with analysis data
        const chats = await prisma.chat.findMany({
            where: { vacancyId: id },
            select: {
                id: true,
                createdAt: true,
                updatedAt: true,
                is_finished: true,
                analysis: true,
                user: {
                    select: {
                        id: true,
                        email: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Get date range for last year
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        // Filter chats from last year and group by date
        const chatsByDate = chats
            .filter(chat => new Date(chat.createdAt) >= oneYearAgo)
            .reduce((acc, chat) => {
                const date = new Date(chat.createdAt).toISOString().split('T')[0];
                if (!acc[date]) {
                    acc[date] = {
                        total: 0,
                        finished: 0,
                        analyzed: 0
                    };
                }
                acc[date].total++;
                if (chat.is_finished) acc[date].finished++;
                if (chat.analysis) acc[date].analyzed++;
                return acc;
            }, {} as Record<string, { total: number; finished: number; analyzed: number }>);

        return {
            vacancy: await prisma.vacancy.findUnique({
                where: { id },
                select: { id: true, title: true }
            }),
            totalChats: chats.length,
            finishedChats: chats.filter(c => c.is_finished).length,
            analyzedChats: chats.filter(c => c.analysis).length,
            chatsByDate,
            recentChats: chats.slice(0, 10) // Last 10 chats for additional insights
        };
    });

    // Get chats for specific date and vacancy (HR only)
    server.get('/vacancy/:id/chats/:date', async (req, reply) => {
        const user = requireAuth(req); if (!user) return reply.code(401).send({ error: 'Unauthorized' })
        if (!requireRole(user, 'hr', reply)) return
        const { id, date } = req.params as { id: string; date: string };

        // Parse date and create date range for the specific day
        const targetDate = new Date(date);
        const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

        const chats = await prisma.chat.findMany({
            where: {
                vacancyId: id,
                createdAt: {
                    gte: startOfDay,
                    lt: endOfDay
                }
            },
            select: {
                id: true,
                title: true,
                createdAt: true,
                is_finished: true,
                analysis: true,
                user: {
                    select: {
                        id: true,
                        email: true
                    }
                },
                resume: {
                    select: {
                        id: true,
                        fileName: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Calculate score from analysis if available
        const chatsWithScores = chats.map(chat => ({
            ...chat,
            score: chat.analysis && typeof chat.analysis === 'object' && 'overallScore' in chat.analysis
                ? (chat.analysis as any).overallScore
                : null
        }));

        return chatsWithScores;
    });
}
