import type { WebSocket } from 'ws';
import type { Message } from '../../prisma/generated/client';

type ChatId = string;

type ChatEvent =
    | { type: 'message.created'; payload: Message }
    | { type: 'analysis.started'; payload: { chatId: string } }
    | { type: 'analysis.progress'; payload: any }
    | { type: 'analysis.completed'; payload: { chatId: string; items: any[]; categoryScores: Record<string, number>; finalScore: number; error?: boolean } }
    | { type: 'analysis.error'; payload: { chatId: string; message: string } }
    | { type: 'message.deleted'; payload: string }
    | {
        type: 'speech.segment'; payload: {
            chatId: string;
            segmentId: string;
            recognized_text: string;
            sentiment_model?: string | null;
            sentiment_confidence?: number | null;
            final_emotion?: { code: number | null; label: string | null; raw: string | null } | null;
            pause_count?: number | null;
            total_pause_duration_seconds?: number | null;
            pauses_ms?: number[] | null;
        }
    }
    | {
        type: 'audio.ready'; payload: {
            chatId: string;
            segmentId: string;
            text: string;
            wavBase64: string; // audio/wav in base64 for client playback
        }
    };

class ChatEventBus {
    private chatIdToClients: Map<ChatId, Set<WebSocket>> = new Map();

    register(chatId: ChatId, ws: WebSocket) {
        let set = this.chatIdToClients.get(chatId);
        if (!set) {
            set = new Set();
            this.chatIdToClients.set(chatId, set);
        }
        set.add(ws);
        ws.on('close', () => {
            this.unregister(chatId, ws);
        });
    }

    unregister(chatId: ChatId, ws: WebSocket) {
        const set = this.chatIdToClients.get(chatId);
        if (!set) return;
        set.delete(ws);
        if (set.size === 0) this.chatIdToClients.delete(chatId);
    }

    broadcast(chatId: ChatId, event: ChatEvent) {
        const set = this.chatIdToClients.get(chatId);
        if (!set || set.size === 0) return;
        const json = JSON.stringify(event);
        for (const client of set) {
            if ((client as any).readyState === 1 /* OPEN */) {
                client.send(json);
            }
        }
    }

    broadcastMessageCreated(message: Message) {
        this.broadcast(message.chatId, { type: 'message.created', payload: message });
    }

    broadcastMessageDeleted(message: Message) {
        this.broadcast(message.chatId, { type: 'message.deleted', payload: message.id });
    }

    broadcastAnalysisStarted(chatId: ChatId) {
        this.broadcast(chatId, { type: 'analysis.started', payload: { chatId } });
    }

    broadcastAnalysisProgress(chatId: ChatId, payload: any) {
        this.broadcast(chatId, { type: 'analysis.progress', payload });
    }

    broadcastAnalysisCompleted(payload: { chatId: string; items: any[]; categoryScores: Record<string, number>; finalScore: number; error?: boolean }) {
        this.broadcast(payload.chatId, { type: 'analysis.completed', payload });
    }

    broadcastAnalysisError(chatId: ChatId, message: string) {
        this.broadcast(chatId, { type: 'analysis.error', payload: { chatId, message } });
    }

    broadcastSpeechSegment(payload: {
        chatId: string;
        segmentId: string;
        recognized_text: string;
        sentiment_model?: string | null;
        sentiment_confidence?: number | null;
        final_emotion?: { code: number | null; label: string | null; raw: string | null } | null;
        pause_count?: number | null;
        total_pause_duration_seconds?: number | null;
        pauses_ms?: number[] | null;
    }) {
        this.broadcast(payload.chatId, { type: 'speech.segment', payload });
    }

    broadcastAudioReady(payload: { chatId: string; segmentId: string; text: string; wavBase64: string }) {
        this.broadcast(payload.chatId, { type: 'audio.ready', payload });
    }
}

export const chatEventBus = new ChatEventBus();
