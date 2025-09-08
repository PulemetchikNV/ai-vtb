export interface EmotionsResult {
    recognized_text: string
    sentiment_model?: string | null
    sentiment_confidence?: number | null
    final_emotion?: { code: number | null; label: string | null; raw: string | null } | null
    pause_count?: number | null
    total_pause_duration_seconds?: number | null
    pauses_ms?: number[] | null
}

export interface Transcriber {
    transcribeAudioWebmOpus(audioBuffer: Buffer, opts?: { chatId?: string; segmentId?: string; lang?: string }): Promise<EmotionsResult>;
}

export class StubTranscriber implements Transcriber {
    async transcribeAudioWebmOpus(audioBuffer: Buffer): Promise<EmotionsResult> {
        const approxSeconds = Math.max(1, Math.round(audioBuffer.length / (16_000 * 2)))
        return { recognized_text: `Голосовое сообщение (~${approxSeconds}s, ${audioBuffer.length} байт)` }
    }
}

export class EmotionsParserTranscriber implements Transcriber {
    private readonly baseUrl: string
    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, '')
    }

    async transcribeAudioWebmOpus(audioBuffer: Buffer, opts?: { chatId?: string; segmentId?: string; lang?: string }): Promise<EmotionsResult> {
        const { transcodeWebmOpusToWav, isWav } = await import('./audio')
        // Convert to WAV if needed
        const wavBuffer = isWav(audioBuffer) ? audioBuffer : await transcodeWebmOpusToWav(audioBuffer)

        // multipart/form-data
        const form = new FormData()
        const filename = `${opts?.segmentId || 'segment'}.wav`
        form.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), filename)

        // Добавляем язык в форму
        if (opts?.lang) {
            form.append('lang', opts.lang)
        }

        const url = `${this.baseUrl}/api/analyze`
        const res = await fetch(url, { method: 'POST', body: form as any })
        if (!res.ok) {
            const text = await res.text().catch(() => '')
            throw new Error(`emotions-parser ${res.status}: ${text}`)
        }
        const json = await res.json()
        return {
            recognized_text: json?.recognized_text || '',
            sentiment_model: json?.sentiment_model ?? null,
            sentiment_confidence: json?.sentiment_confidence ?? null,
            final_emotion: json?.final_emotion ?? null,
            pause_count: json?.pause_count ?? null,
            total_pause_duration_seconds: json?.total_pause_duration_seconds ?? null,
            pauses_ms: json?.pauses_ms ?? null,
        }
    }
}
