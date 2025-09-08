import { ref, onBeforeUnmount } from 'vue'
import { addMessage } from '../__data__/notifications'

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

export type VoiceError = {
    type: 'permission' | 'websocket' | 'audio' | 'network' | 'server' | 'unknown'
    message: string
    details?: string
}

export function useVoiceChat(getChatId: () => string | null) {
    const isRecording = ref(false)
    const statusText = ref<'disconnected' | 'connected' | 'closed' | 'error' | 'permission-error'>('disconnected')
    const chunkCount = ref(0)
    const bytesSent = ref(0)
    const lastSegment = ref<SpeechSegmentPayload | null>(null)
    const lastAudioText = ref<string>('')
    const playbackError = ref<string>('')
    const error = ref<VoiceError | null>(null)
    const wsAudioConnected = ref(false)
    const wsChatConnected = ref(false)

    let mediaRecorder: MediaRecorder | null = null
    let micStream: MediaStream | null = null
    let wsAudio: WebSocket | null = null
    let wsChat: WebSocket | null = null

    // Simple audio player for TTS
    const audioEl = new Audio()
    audioEl.autoplay = true
    audioEl.muted = false
    // object url tracking was used for client TTS here; now handled in services/ttsClient

    // Client-side TTS mode — moved to useChat via ttsClient service

    function disconnectWsAudio() {
        if (wsAudio) {
            try { wsAudio.close() } catch { }
            wsAudio = null
        }
        wsAudioConnected.value = false
    }

    function disconnectWsChat() {
        if (wsChat) {
            try { wsChat.close() } catch { }
            wsChat = null
        }
        wsChatConnected.value = false
    }

    async function startRecording() {
        if (isRecording.value) return
        const chatId = getChatId()
        if (!chatId) {
            const validationError: VoiceError = {
                type: 'unknown',
                message: 'Чат не инициализирован'
            }
            error.value = validationError
            addMessage({
                severity: 'warn',
                summary: 'Ошибка записи',
                detail: validationError.message,
                life: 3000
            })
            return
        }

        error.value = null
        playbackError.value = ''

        try {
            // Запрос разрешения на микрофон
            try {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
            } catch (permissionError: any) {
                statusText.value = 'permission-error'
                const voiceError: VoiceError = {
                    type: 'permission',
                    message: 'Нет доступа к микрофону',
                    details: permissionError.message
                }
                error.value = voiceError

                addMessage({
                    severity: 'warn',
                    summary: 'Нет доступа к микрофону',
                    detail: 'Разрешите доступ к микрофону для записи голоса',
                    life: 5000
                })
                return
            }

            const wsBase = (import.meta as any).env?.VITE_BACKEND_WS_URL || 'ws://localhost:3000'

            // Audio streaming WS
            wsAudio = new WebSocket(`${wsBase}/ws/audio?chatId=${encodeURIComponent(chatId)}`)
            wsAudio.binaryType = 'arraybuffer'

            wsAudio.onopen = () => {
                statusText.value = 'connected'
                wsAudioConnected.value = true

                try {
                    mediaRecorder = new MediaRecorder(micStream as MediaStream, { mimeType: 'audio/webm;codecs=opus' })
                    mediaRecorder.ondataavailable = (ev: BlobEvent) => {
                        if (!ev.data || ev.data.size === 0) return
                        ev.data.arrayBuffer().then((buf) => {
                            if (wsAudio && wsAudio.readyState === WebSocket.OPEN) {
                                wsAudio.send(buf)
                                chunkCount.value += 1
                                bytesSent.value += buf.byteLength
                            }
                        }).catch((e) => {
                            console.error('Failed to process audio chunk:', e)
                        })
                    }
                    mediaRecorder.start(250)
                    isRecording.value = true
                } catch (recorderError: any) {
                    const voiceError: VoiceError = {
                        type: 'audio',
                        message: 'Не удалось инициализировать запись звука',
                        details: recorderError.message
                    }
                    error.value = voiceError

                    addMessage({
                        severity: 'error',
                        summary: 'Ошибка записи',
                        detail: voiceError.message,
                        life: 4000
                    })
                }
            }

            wsAudio.onclose = (event) => {
                statusText.value = 'closed'
                wsAudioConnected.value = false

                if (event.code !== 1000 && isRecording.value) {
                    const wsError: VoiceError = {
                        type: 'websocket',
                        message: 'Соединение с сервером прервано'
                    }
                    error.value = wsError

                    addMessage({
                        severity: 'error',
                        summary: 'Соединение прервано',
                        detail: 'Аудио-соединение с сервером потеряно',
                        life: 4000
                    })
                }
            }

            wsAudio.onerror = () => {
                statusText.value = 'error'
                wsAudioConnected.value = false

                const wsError: VoiceError = {
                    type: 'websocket',
                    message: 'Ошибка аудио-соединения с сервером'
                }
                error.value = wsError

                addMessage({
                    severity: 'error',
                    summary: 'Ошибка соединения',
                    detail: wsError.message,
                    life: 4000
                })
            }

            // Chat events WS (for TTS/audio.ready and speech.segment)
            wsChat = new WebSocket(`${wsBase}/ws/chat?chatId=${encodeURIComponent(chatId)}`)

            wsChat.onopen = () => {
                wsChatConnected.value = true
            }

            wsChat.onclose = (event) => {
                wsChatConnected.value = false

                if (event.code !== 1000 && isRecording.value) {
                    console.warn('Chat WebSocket closed unexpectedly:', event.code, event.reason)
                }
            }

            wsChat.onerror = (event) => {
                wsChatConnected.value = false
                console.error('Chat WebSocket error:', event)
            }

            wsChat.onmessage = (ev) => {
                try {
                    const raw = JSON.parse(ev.data)
                    const type = raw?.type ?? raw?.payload?.type
                    const payload = raw?.payload ?? raw

                    if (type === 'speech.segment') {
                        lastSegment.value = payload as SpeechSegmentPayload
                    } else if (type === 'audio.ready') {
                        const p = payload as AudioReadyPayload
                        lastAudioText.value = p.text

                        try {
                            const wavBlob = b64ToBlob(p.wavBase64, 'audio/wav')
                            const url = URL.createObjectURL(wavBlob)
                            audioEl.src = url
                            audioEl.play()
                                .then(() => {
                                    playbackError.value = ''
                                })
                                .catch((e) => {
                                    playbackError.value = e?.message || 'playback blocked'

                                    const audioError: VoiceError = {
                                        type: 'audio',
                                        message: 'Не удалось воспроизвести аудио',
                                        details: e?.message
                                    }
                                    error.value = audioError
                                })
                        } catch (audioError: any) {
                            const voiceError: VoiceError = {
                                type: 'audio',
                                message: 'Ошибка обработки аудио',
                                details: audioError.message
                            }
                            error.value = voiceError
                            playbackError.value = voiceError.message
                        }
                    } else if (type === 'error') {
                        const serverError: VoiceError = {
                            type: 'server',
                            message: payload?.message || 'Ошибка сервера'
                        }
                        error.value = serverError

                        addMessage({
                            severity: 'error',
                            summary: 'Ошибка сервера',
                            detail: serverError.message,
                            life: 5000
                        })
                    }
                } catch (parseError: any) {
                    console.error('Failed to parse voice chat message:', parseError)
                    const voiceError: VoiceError = {
                        type: 'unknown',
                        message: 'Ошибка обработки сообщения сервера'
                    }
                    error.value = voiceError
                }
            }
        } catch (generalError: any) {
            statusText.value = 'error'
            const voiceError: VoiceError = {
                type: 'unknown',
                message: 'Неожиданная ошибка при запуске записи',
                details: generalError.message
            }
            error.value = voiceError

            addMessage({
                severity: 'error',
                summary: 'Ошибка записи',
                detail: voiceError.message,
                life: 5000
            })
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

    // Функция для получения пользовательского сообщения об ошибке
    function getErrorMessage(error: VoiceError | null): string {
        if (!error) return ''

        const typeMessages = {
            permission: '🎤 Нет доступа к микрофону',
            websocket: '🔌 Проблемы с подключением',
            audio: '🔊 Ошибка аудио',
            network: '🌐 Проблемы с сетью',
            server: '🔧 Ошибка сервера',
            unknown: '❓ Неизвестная ошибка'
        }

        return `${typeMessages[error.type]} • ${error.message}`
    }

    return {
        isRecording,
        statusText,
        chunkCount,
        bytesSent,
        lastSegment,
        lastAudioText,
        playbackError,
        error,
        wsAudioConnected,
        wsChatConnected,
        startRecording,
        stopRecording,
        getErrorMessage
    }
}


