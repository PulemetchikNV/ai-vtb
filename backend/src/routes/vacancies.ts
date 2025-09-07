import { FastifyInstance, FastifySchema } from 'fastify';
import { prisma } from '../prisma';
import { REQUIREMENT_TYPES } from '../__data__/constants';

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
    server.get('/vacancies', async () => {
        const vacancies = await prisma.vacancy.findMany({
            orderBy: { updatedAt: 'desc' },
            select: { id: true, title: true, description_text: true, requirements_checklist: true, category_weights: true, createdAt: true, updatedAt: true }
        });
        return vacancies;
    });

    server.post('/vacancies', {
        schema: vacancySchema
    }, async (req, reply) => {
        const body = req.body as { title: string; description_text: string; requirements_checklist: unknown; category_weights?: Record<string, number> };
        const vacancy = await prisma.vacancy.create({ data: body as any });
        return reply.code(201).send(vacancy);
    });

    server.delete('/vacancies/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        await prisma.vacancy.delete({ where: { id } });
        return reply.code(204).send();
    });

    server.put('/vacancies/:id', {
        schema: vacancySchema
    }, async (req, reply) => {
        const { id } = req.params as { id: string };
        const body = req.body as Partial<{ title: string; description_text: string; requirements_checklist: unknown; category_weights?: Record<string, number> }>;
        const vacancy = await prisma.vacancy.update({ where: { id }, data: body as any });
        return reply.code(200).send(vacancy);
    });
}
