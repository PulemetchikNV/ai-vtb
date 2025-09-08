import { prisma } from '../prisma'

interface NotificationData {
    text: string
    userId: string
}

export class TelegramService {
    private botApiUrl: string

    constructor() {
        this.botApiUrl = process.env.BOT_API_URL || ''
        if (!this.botApiUrl) {
            console.warn('BOT_API_URL не установлен в переменных окружения')
        }
    }

    /**
     * Отправляет уведомление пользователю в Telegram
     * @param text - текст уведомления
     * @param userId - ID пользователя в системе
     * @returns Promise<boolean> - успешность отправки
     */
    async notifyTg(text: string, userId: string): Promise<boolean> {
        try {
            // Проверяем наличие BOT_API_URL
            if (!this.botApiUrl) {
                console.error('BOT_API_URL не настроен')
                return false
            }

            // Находим пользователя и его telegram_id
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { telegram_id: true }
            })

            if (!user || !user.telegram_id) {
                console.warn(`Пользователь ${userId} не найден или не имеет привязанного Telegram ID`)
                return false
            }

            // Подготавливаем данные для отправки
            const notificationData: NotificationData = {
                text,
                userId: user.telegram_id
            }

            // Отправляем запрос к боту
            const response = await fetch(`${this.botApiUrl}/notification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(notificationData)
            })

            if (!response.ok) {
                console.error(`Ошибка отправки уведомления в Telegram: ${response.status} ${response.statusText}`)
                return false
            }

            console.log(`Уведомление успешно отправлено пользователю ${userId} в Telegram`)
            return true
        } catch (error) {
            console.error('Ошибка при отправке уведомления в Telegram:', error)
            return false
        }
    }

    /**
     * Проверяет, подключен ли пользователь к Telegram
     * @param userId - ID пользователя в системе
     * @returns Promise<boolean> - подключен ли пользователь к Telegram
     */
    async isUserConnectedToTelegram(userId: string): Promise<boolean> {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { telegram_id: true }
            })
            return !!(user && user.telegram_id)
        } catch (error) {
            console.error('Ошибка при проверке подключения к Telegram:', error)
            return false
        }
    }
}

// Экспортируем экземпляр сервиса
export const telegramService = new TelegramService()
