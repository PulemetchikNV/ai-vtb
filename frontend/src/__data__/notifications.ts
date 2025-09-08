import { ref } from "vue";

export interface NotificationMessage {
    severity?: 'success' | 'info' | 'warn' | 'error';
    summary?: string;
    detail?: string;
    life?: number;
}

// Хранилище для уведомлений
export const pendingMessages = ref<NotificationMessage[]>([]);

export const addMessage = (message: NotificationMessage) => {
    if (!message.life) message.life = 2500;
    pendingMessages.value.push(message);
};

export const consumeMessages = (): NotificationMessage[] => {
    const messages = pendingMessages.value;
    pendingMessages.value = [];
    return messages;
};  