import { prisma } from '../prisma'
import { chatEventBus } from './chatEventBus'
import { analyzer } from './analyzer'
import { dialogueService } from './dialogue'
import { factChecker } from './factChecker'

export async function finishChat(chatId: string, notify?: () => any, finishMessage?: string): Promise<void> {
    const originalChat = await prisma.chat.findUnique({ where: { id: chatId } })
    const isOriginalFinished = originalChat?.is_finished

    if (!isOriginalFinished) {
        await prisma.chat.update({ where: { id: chatId }, data: { is_finished: true } })
        const systemMsg = await prisma.message.create({ data: { chatId, role: 'system', content: finishMessage ?? 'Разговор завершен' } })
        chatEventBus.broadcastMessageCreated(systemMsg)
    }
    if (notify) notify()
    try {
        chatEventBus.broadcastAnalysisStarted(chatId)
        const result = await analyzer.analyzeDialog(chatId)
        const updated = await prisma.chat.findUnique({ where: { id: chatId }, select: { analysis: true } })
        chatEventBus.broadcastAnalysisCompleted((updated?.analysis || result) as any)
    } catch (e: any) {
        await prisma.chat.update({ where: { id: chatId }, data: { analysis: { chatId, error: true } as any } as any })
        chatEventBus.broadcastAnalysisError(chatId, e?.message || 'unknown error')
    }
}

export async function processSavedUserMessage(params: { chatId: string; userContent: string }): Promise<{ assistantMsg: { id: string; content: string } | null }> {
    const { chatId, userContent } = params
    const messageHistory = await prisma.message.findMany({ where: { chatId }, orderBy: { createdAt: 'asc' } })

    try {
        const previousAssistant = messageHistory.length >= 2 ? messageHistory[messageHistory.length - 2] : null
        const analyzerPromise = (async () => {
            if (!previousAssistant) return null
            const { qualityAnalyzerChain } = await import('../chains/qualityAnalyzerChain')
            const messageLimit = 6
            const lastMessageIndex = messageHistory.length >= messageLimit ? messageHistory.length - messageLimit : 0
            const lastFewMessages = messageHistory.slice(lastMessageIndex, messageHistory.length)
                .map(message => `${message.role}: ${message.content}`).join('\n')

            return qualityAnalyzerChain.invoke({ last_few_messages: lastFewMessages })
        })()
        const factCheckerPromise = factChecker.handleMessage({ content: userContent, chatId })

        const [analyzerMeta] = await Promise.all([analyzerPromise, factCheckerPromise])

        const assistantText = await dialogueService.getNextMessage({ userMessage: userContent, messageHistory, chatId, analyzerMeta })
        const assistantMsg = await prisma.message.create({ data: { chatId, role: 'assistant', content: assistantText } })
        chatEventBus.broadcastMessageCreated(assistantMsg)

        if (assistantMsg.content.includes('*FINISH CALL*')) {
            await finishChat(chatId, undefined, 'Собеседник завершил разговор')
        }

        return { assistantMsg: { id: assistantMsg.id, content: assistantMsg.content } }
    } catch (e) {
        return { assistantMsg: null }
    }
}


