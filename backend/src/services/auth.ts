import crypto from 'crypto'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

export type JwtPayload = { sub: string; role: 'user' | 'hr' }

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const usedSalt = salt || crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(password, usedSalt, 100_000, 64, 'sha512').toString('hex')
    return { hash, salt: usedSalt }
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
    const { hash: calc } = hashPassword(password, salt)
    return crypto.timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(hash, 'hex'))
}

export function signJwt(payload: JwtPayload, expiresIn: string = '7d'): string {
    return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn })
}

export function verifyJwt(token: string): JwtPayload | null {
    try { return jwt.verify(token, JWT_SECRET) as JwtPayload } catch { return null }
}


