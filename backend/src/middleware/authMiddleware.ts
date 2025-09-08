import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import { verifyJwt } from '../services/auth'

export type AuthUser = { id: string; role: 'user' | 'hr' }

// Fastify plugin-style middleware using @fastify/middie
export default async function registerAuthMiddleware(fastify: FastifyInstance) {
    // First hook: parse Authorization header early and attach req.user
    fastify.addHook('onRequest', async (req: FastifyRequest) => {
        const authHeader = req.headers.authorization || ''
        const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : ''
        const payload: any = token ? verifyJwt(token) : null;

        (req as any).user = payload ? ({ id: payload.sub, role: payload.role } as AuthUser) : null
    })

    // Optional connect-style middleware (runs at hook configured in server: preHandler)
    fastify.use((req: any, _res, next) => {
        // no-op; could add request-scoped logging/correlation
        next()
    })

    // Another hook if we need preHandler checks; keep lightweight
    fastify.addHook('preHandler', async (_req, _reply) => {
        // place for generic pre-handler auth checks if needed
    })
}

export function requireAuth(req: FastifyRequest): AuthUser | null {
    const user = (req as any).user as AuthUser | null | undefined
    if (user && user.id) return user
    const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    const payload = auth ? verifyJwt(auth) : null
    if (!payload) return null
    return { id: payload.sub, role: payload.role }
}

export function requireRole(user: AuthUser, role: 'user' | 'hr', reply: FastifyReply): boolean {
    if (user.role !== role) {
        reply.code(403).send({ error: 'Forbidden' })
        return false
    }
    return true
}
