import { spawn } from 'child_process'

export type AudioInputFormat = 'webm-opus' | 'pcm16' | 'wavpcm'

export function pcm16ToWav(pcmBuffer: Buffer, sampleRate: number = 16000, channels: number = 1): Buffer {
    const byteRate = sampleRate * channels * 2
    const blockAlign = channels * 2
    const dataSize = pcmBuffer.length
    const buffer = Buffer.alloc(44 + dataSize)

    // RIFF header
    buffer.write('RIFF', 0)
    buffer.writeUInt32LE(36 + dataSize, 4)
    buffer.write('WAVE', 8)

    // fmt chunk
    buffer.write('fmt ', 12)
    buffer.writeUInt32LE(16, 16) // PCM chunk size
    buffer.writeUInt16LE(1, 20) // PCM format
    buffer.writeUInt16LE(channels, 22)
    buffer.writeUInt32LE(sampleRate, 24)
    buffer.writeUInt32LE(byteRate, 28)
    buffer.writeUInt16LE(blockAlign, 32)
    buffer.writeUInt16LE(16, 34) // bits per sample

    // data chunk
    buffer.write('data', 36)
    buffer.writeUInt32LE(dataSize, 40)
    pcmBuffer.copy(buffer, 44)

    return buffer
}

export async function transcodeWebmOpusToWav(webmBuffer: Buffer, sampleRate: number = 16000, channels: number = 1, ffmpegPath: string = process.env.FFMPEG_PATH || 'ffmpeg'): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const args = ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ac', String(channels), '-ar', String(sampleRate), '-sample_fmt', 's16', '-f', 'wav', 'pipe:1']
        const proc = spawn(ffmpegPath, args)
        const chunks: Buffer[] = []
        const errors: Buffer[] = []

        proc.stdout.on('data', (d: Buffer) => chunks.push(d))
        proc.stderr.on('data', (d: Buffer) => errors.push(d))
        proc.on('error', (err) => reject(err))
        proc.on('close', (code) => {
            if (code === 0) {
                resolve(Buffer.concat(chunks))
            } else {
                reject(new Error(`ffmpeg exited with code ${code}: ${Buffer.concat(errors).toString('utf8')}`))
            }
        })

        proc.stdin.write(webmBuffer)
        proc.stdin.end()
    })
}

export function isWav(buffer: Buffer): boolean {
    return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE'
}


