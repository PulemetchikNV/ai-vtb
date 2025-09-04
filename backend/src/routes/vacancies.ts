import { FastifyInstance, FastifySchema } from 'fastify';
import { prisma } from '../prisma';

export default async function vacancyRoutes(server: FastifyInstance) {
    server.get('/vacancies', async () => {
        const vacancies = await prisma.vacancy.findMany({
            orderBy: { updatedAt: 'desc' },
            select: { id: true, title: true, description_text: true, requirements_checklist: true, createdAt: true, updatedAt: true }
        });
        return vacancies;
    });

    server.post('/vacancies', {
        schema: {
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
                                type: { type: 'string', enum: ['technical_skill', 'soft_skill'] },
                                weight: { type: 'number', minimum: 0, maximum: 10 }
                            },
                            additionalProperties: false
                        }
                    }
                },
                additionalProperties: false
            } as FastifySchema
        }
    }, async (req, reply) => {
        const body = req.body as { title: string; description_text: string; requirements_checklist: unknown };
        const vacancy = await prisma.vacancy.create({ data: body as any });
        return reply.code(201).send(vacancy);
    });

    server.delete('/vacancies/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        await prisma.vacancy.delete({ where: { id } });
        return reply.code(204).send();
    });
}
