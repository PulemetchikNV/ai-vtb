import type { WebSocket } from 'ws';
import type { Message } from '@prisma/client/generated/client-types';

type ChatId = string;

type ChatEvent =
    | { type: 'message.created'; payload: Message };

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
}

export const chatEventBus = new ChatEventBus();
