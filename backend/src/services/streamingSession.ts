import { FastifyBaseLogger } from 'fastify';
import { prisma } from '../prisma';
import { Transcriber } from './transcriber';
import { chatEventBus } from './chatEventBus';
import { chatDebugLog } from './chatDebug';
import { processSavedUserMessage } from './chatFlow';

export class StreamingAudioSession {
    private readonly logger: FastifyBaseLogger;
    private readonly transcriber: Transcriber;
    private readonly chatId: string;

    private bufferParts: Buffer[] = [];
    private lastChunkAt: number = Date.now();
    private vadTimer: NodeJS.Timeout | null = null;

    constructor(opts: { logger: FastifyBaseLogger; transcriber: Transcriber; chatId: string }) {
        this.logger = opts.logger;
        this.transcriber = opts.transcriber;
        this.chatId = opts.chatId;
    }

    handleChunk(data: Buffer) {
        this.bufferParts.push(data);
        this.lastChunkAt = Date.now();
        this.scheduleVadCheck();
    }

    private scheduleVadCheck() {
        if (this.vadTimer) clearTimeout(this.vadTimer);
        // simple VAD: consider utterance ended if 800ms without chunks
        this.vadTimer = setTimeout(() => this.flushUtterance().catch(err => this.logger.error(err)), 800);
    }

    async flushUtterance() {
        if (this.bufferParts.length === 0) return;
        const audio = Buffer.concat(this.bufferParts);
        this.bufferParts = [];
        try {
            const segmentId = `${this.chatId}_${Date.now()}`;
            const emotions = await this.transcriber.transcribeAudioWebmOpus(audio, { chatId: this.chatId, segmentId });
            const text = (emotions.recognized_text || '').trim();
            if (!text) return;

            // Save user message
            const userMsg = await prisma.message.create({
                data: { chatId: this.chatId, role: 'user', content: text }
            });
            chatEventBus.broadcastMessageCreated(userMsg);
            chatEventBus.broadcastSpeechSegment({
                chatId: this.chatId,
                segmentId,
                recognized_text: text,
                sentiment_model: emotions.sentiment_model ?? null,
                sentiment_confidence: emotions.sentiment_confidence ?? null,
                final_emotion: emotions.final_emotion ?? null,
                pause_count: emotions.pause_count ?? null,
                total_pause_duration_seconds: emotions.total_pause_duration_seconds ?? null,
                pauses_ms: emotions.pauses_ms ?? null,
            });
            await chatDebugLog(this.chatId, `получено голосовое сообщение: ${JSON.stringify(text)}`)

            // Build assistant reply using shared flow
            const { assistantMsg } = await processSavedUserMessage({ chatId: this.chatId, userContent: text })
            const assistantText = assistantMsg?.content || ''
            await chatDebugLog(this.chatId, `отправляем пользователю сообщение ${JSON.stringify(assistantText)}`)

            this.logger.info({ event: 'utterance-transcribed', chatId: this.chatId, userMsgId: userMsg.id });
        } catch (err) {
            this.logger.error({ err }, 'Failed to process utterance');
        }
    }

    async end() {
        if (this.vadTimer) clearTimeout(this.vadTimer);
        await this.flushUtterance();
    }
}
