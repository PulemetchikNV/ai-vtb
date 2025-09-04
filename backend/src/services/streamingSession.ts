import { FastifyBaseLogger } from 'fastify';
import { prisma } from '../prisma';
import { Transcriber } from './transcriber';
import { chatEventBus } from './chatEventBus';

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
            const text = await this.transcriber.transcribeAudioWebmOpus(audio);
            if (!text || !text.trim()) return;

            // Save user message
            const userMsg = await prisma.message.create({
                data: { chatId: this.chatId, role: 'user', content: text }
            });
            chatEventBus.broadcastMessageCreated(userMsg);

            // Echo assistant reply (placeholder)
            const assistantText = `Echo: ${text}`;
            const assistantMsg = await prisma.message.create({
                data: { chatId: this.chatId, role: 'assistant', content: assistantText }
            });
            chatEventBus.broadcastMessageCreated(assistantMsg);

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
