import { FastifyInstance, FastifySchema } from 'fastify'
import { prisma } from '../prisma'
import { hashPassword, verifyPassword, signJwt, type JwtPayload, verifyJwt } from '../services/auth'

export default async function authRoutes(server: FastifyInstance) {
    server.post('/auth/register', {
        schema: {
            body: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string' },
                    password: { type: 'string' },
                    role: { type: 'string', enum: ['user', 'hr'] }
                },
                additionalProperties: false
            } as FastifySchema
        }
    }, async (req, reply) => {
        const { email, password, role } = req.body as { email: string; password: string; role?: 'user' | 'hr' }
        const existing = await prisma.user.findUnique({ where: { email } }).catch(() => null)
        if (existing) return reply.code(409).send({ error: 'User exists' })
        const { hash, salt } = hashPassword(password)
        const created = await prisma.user.create({ data: { email, password: `${salt}:${hash}`, role: role || 'user' } as any })
        const token = signJwt({ sub: created.id, role: created.role as any })
        return reply.code(201).send({ token })
    })

    server.post('/auth/login', {
        schema: {
            body: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string' },
                    password: { type: 'string' }
                },
                additionalProperties: false
            } as FastifySchema
        }
    }, async (req, reply) => {
        const { email, password } = req.body as { email: string; password: string }
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return reply.code(401).send({ error: 'Invalid credentials' })
        const [salt, hash] = (user.password || '').split(':')
        if (!salt || !hash || !verifyPassword(password, hash, salt)) return reply.code(401).send({ error: 'Invalid credentials' })
        const token = signJwt({ sub: user.id, role: user.role as any })
        return reply.send({ token })
    })

    server.get('/auth/me', async (req, reply) => {
        const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
        const payload = auth ? verifyJwt(auth) : null
        if (!payload) return reply.code(401).send({ error: 'Unauthorized' })
        const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, role: true } })
        return reply.send(user)
    })

    // Protected toggle role (dev only)
    server.post('/auth/toggle-role', async (req, reply) => {
        const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
        const payload = auth ? verifyJwt(auth) : null
        if (!payload) return reply.code(401).send({ error: 'Unauthorized' })
        const current = await prisma.user.findUnique({ where: { id: payload.sub }, select: { role: true } })
        if (!current) return reply.code(404).send({ error: 'User not found' })
        const nextRole = (current.role === 'hr' ? 'user' : 'hr') as any
        const updated = await prisma.user.update({ where: { id: payload.sub }, data: { role: nextRole }, select: { id: true, email: true, role: true } as any })

        // Генерируем новый токен с обновленной ролью
        const newToken = signJwt({ sub: updated.id, role: updated.role as any })

        return reply.send({ ...updated, token: newToken })
    })

    // Связывание пользователя с Telegram ID
    server.post('/connect-tg', {
        schema: {
            querystring: {
                type: 'object',
                required: ['code', 'telegramId'],
                properties: {
                    code: { type: 'string' },
                    telegramId: { type: 'string' }
                },
                additionalProperties: false
            } as FastifySchema
        }
    }, async (req, reply) => {
        const { code, telegramId } = req.query as { code: string; telegramId: string }

        // Находим пользователя по его ID (code)
        const user = await prisma.user.findUnique({ where: { id: code } })
        if (!user) {
            return reply.code(404).send({ error: 'User not found' })
        }

        // Проверяем, не привязан ли уже этот Telegram ID к другому пользователю
        const existingTelegramUser = await prisma.user.findUnique({ where: { telegram_id: telegramId } })
        if (existingTelegramUser && existingTelegramUser.id !== code) {
            return reply.code(409).send({ error: 'Telegram ID already connected to another user' })
        }

        // Обновляем пользователя, добавляя telegram_id
        const updatedUser = await prisma.user.update({
            where: { id: code },
            data: { telegram_id: telegramId },
            select: { id: true, email: true, role: true, telegram_id: true }
        })

        return reply.send({
            success: true,
            message: 'Telegram successfully connected',
            user: updatedUser
        })
    })
}


