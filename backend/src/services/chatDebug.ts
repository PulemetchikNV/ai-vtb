import { promises as fs } from 'fs'
import { join } from 'path'

const LOGS_DIR = join(process.cwd(), 'backend', 'src', 'logs')

async function ensureLogsDir(): Promise<void> {
    try {
        await fs.mkdir(LOGS_DIR, { recursive: true })
    } catch {
        // noop
    }
}

function ts(): string {
    const d = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `(${pad(d.getHours())}:${pad(d.getMinutes())})`
}

export async function chatDebugSeparator(chatId: string): Promise<void> {
    await ensureLogsDir()
    const file = join(LOGS_DIR, `dialog-${chatId}.log`)
    await fs.appendFile(file, `====(separator)====\n`)
}

export async function chatDebugLog(chatId: string, ...lines: string[]): Promise<void> {
    await ensureLogsDir()
    const file = join(LOGS_DIR, `dialog-${chatId}.log`)
    const content = lines.map(l => `${ts()} ${l}`).join('\n') + '\n'
    await fs.appendFile(file, content)
}


