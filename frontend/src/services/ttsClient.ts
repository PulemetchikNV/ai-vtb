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

export async function synthesizeAndPlay(text: string): Promise<void> {
    const base = (import.meta as any).env?.VITE_TTS_URL || 'http://localhost:8081'
    const url = `${String(base).replace(/\/$/, '')}/synthesize`
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice_name: 'Zephyr', temperature: 1.0 })
    })
    if (!res.ok) throw new Error(`tts http ${res.status}`)
    const buf = await res.arrayBuffer()
    const blob = new Blob([buf], { type: 'audio/wav' })
    if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl)
    const objectUrl = URL.createObjectURL(blob)
    lastObjectUrl = objectUrl
    const audio = getAudio()
    audio.src = objectUrl
    await audio.play()
}


