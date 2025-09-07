import { ref, onBeforeUnmount } from 'vue'

type SpeechSegmentPayload = {
    chatId: string
    segmentId: string
    recognized_text: string
    sentiment_model?: string | null
    sentiment_confidence?: number | null
    final_emotion?: { code: number | null; label: string | null; raw: string | null } | null
    pause_count?: number | null
    total_pause_duration_seconds?: number | null
    pauses_ms?: number[] | null
}

type AudioReadyPayload = {
    chatId: string
    segmentId: string
    text: string
    wavBase64: string
}

export function useVoiceChat(getChatId: () => string | null) {
    const isRecording = ref(false)
    const statusText = ref<'disconnected' | 'connected' | 'closed' | 'error' | 'permission-error'>('disconnected')
    const chunkCount = ref(0)
    const bytesSent = ref(0)
    const lastSegment = ref<SpeechSegmentPayload | null>(null)
    const lastAudioText = ref<string>('')

    let mediaRecorder: MediaRecorder | null = null
    let micStream: MediaStream | null = null
    let wsAudio: WebSocket | null = null
    let wsChat: WebSocket | null = null

    // Simple audio player for TTS
    const audioEl = new Audio()

    function disconnectWsAudio() {
        if (wsAudio) {
            try { wsAudio.close() } catch { }
            wsAudio = null
        }
    }

    function disconnectWsChat() {
        if (wsChat) {
            try { wsChat.close() } catch { }
            wsChat = null
        }
    }

    async function startRecording() {
        if (isRecording.value) return
        const chatId = getChatId()
        if (!chatId) return
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true })

            const wsBase = (import.meta as any).env?.VITE_BACKEND_WS_URL || 'ws://localhost:3000'

            // Audio streaming WS
            wsAudio = new WebSocket(`${wsBase}/ws/audio?chatId=${encodeURIComponent(chatId)}`)
            wsAudio.binaryType = 'arraybuffer'

            // Chat events WS (for TTS/audio.ready and speech.segment)
            wsChat = new WebSocket(`${wsBase}/ws/chat?chatId=${encodeURIComponent(chatId)}`)
            wsChat.onmessage = (ev) => {
                try {
                    const evt = JSON.parse(ev.data)
                    if (evt?.type === 'speech.segment') {
                        lastSegment.value = evt.payload as SpeechSegmentPayload
                    } else if (evt?.type === 'audio.ready') {
                        const p = evt.payload as AudioReadyPayload
                        lastAudioText.value = p.text
                        const wavBlob = b64ToBlob(p.wavBase64, 'audio/wav')
                        const url = URL.createObjectURL(wavBlob)
                        audioEl.src = url
                        audioEl.play().catch(() => { })
                    }
                } catch { }
            }

            wsAudio.onopen = () => {
                statusText.value = 'connected'
                mediaRecorder = new MediaRecorder(micStream as MediaStream, { mimeType: 'audio/webm;codecs=opus' })
                mediaRecorder.ondataavailable = (ev: BlobEvent) => {
                    if (!ev.data || ev.data.size === 0) return
                    ev.data.arrayBuffer().then((buf) => {
                        if (wsAudio && wsAudio.readyState === WebSocket.OPEN) {
                            wsAudio.send(buf)
                            chunkCount.value += 1
                            bytesSent.value += buf.byteLength
                        }
                    })
                }
                mediaRecorder.start(250)
                isRecording.value = true
            }

            wsAudio.onclose = () => { statusText.value = 'closed' }
            wsAudio.onerror = () => { statusText.value = 'error' }
        } catch (e) {
            statusText.value = 'permission-error'
            console.error(e)
        }
    }

    function stopRecording() {
        if (!isRecording.value) return
        mediaRecorder?.stop()
        mediaRecorder = null
        disconnectWsAudio()
        disconnectWsChat()
        if (micStream) {
            micStream.getTracks().forEach(t => t.stop())
            micStream = null
        }
        isRecording.value = false
    }

    function b64ToBlob(base64: string, contentType = '', sliceSize = 512): Blob {
        const byteCharacters = atob(base64)
        const byteArrays: Uint8Array[] = []
        for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            const slice = byteCharacters.slice(offset, offset + sliceSize)
            const byteNumbers = new Array(slice.length)
            for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i)
            const byteArray = new Uint8Array(byteNumbers)
            byteArrays.push(byteArray)
        }
        return new Blob(byteArrays, { type: contentType })
    }

    onBeforeUnmount(() => {
        stopRecording()
    })

    return { isRecording, statusText, chunkCount, bytesSent, lastSegment, lastAudioText, startRecording, stopRecording }
}


