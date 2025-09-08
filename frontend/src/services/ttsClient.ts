let audioEl: HTMLAudioElement | null = null
let lastObjectUrl: string | null = null

function getAudio(): HTMLAudioElement {
    if (!audioEl) {
        audioEl = new Audio()
        audioEl.autoplay = true
        audioEl.muted = false
    }
    return audioEl
}

export async function synthesizeAndPlay(
    text: string,
    callbacks?: {
        onStart?: () => void,
        onEnd?: () => void,
        onError?: (error: Error) => void
    }
): Promise<void> {
    try {
        const base = (import.meta as any).env?.VITE_TTS_URL || 'http://localhost:8081'
        const url = `${String(base).replace(/\/$/, '')}/synthesize-ya`
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice: 'julia', role: 'strict' })
        })
        if (!res.ok) throw new Error(`tts http ${res.status}`)
        const buf = await res.arrayBuffer()
        const blob = new Blob([buf], { type: 'audio/wav' })
        if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl)
        const objectUrl = URL.createObjectURL(blob)
        lastObjectUrl = objectUrl
        const audio = getAudio()
        audio.src = objectUrl

        // Добавляем обработчики событий аудио
        audio.onended = () => {
            callbacks?.onEnd?.()
        }

        audio.onerror = () => {
            callbacks?.onError?.(new Error('Audio playback failed'))
        }

        await audio.play()
        callbacks?.onStart?.()
    } catch (error) {
        callbacks?.onError?.(error as Error)
        throw error
    }
}


