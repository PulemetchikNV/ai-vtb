import { INITIAL_DIALOG_PROMPT } from "../__data__/prompts"
import { aiService } from "./ai"
import { prisma } from "../prisma"
import type { Vacancy, Message } from "../../prisma/generated/client"
import { chatDebugLog, chatDebugSeparator } from "./chatDebug"


export const dialogueService = {
    async getInitialMessage({ vacancy }: { vacancy: Vacancy }) {
        const prompt = INITIAL_DIALOG_PROMPT({ vacancy })
        const initialMessage = await aiService.communicateWithGemini([{ role: 'user', content: prompt }], true)

        return {
            systemPrompt: prompt,
            initialMessage
        }
    },
    async getNextMessage({ userMessage, messageHistory, chatId }: { userMessage: string, messageHistory: Message[], chatId: string }) {
        await chatDebugSeparator(chatId)
        // fetch latest contradictions
        const chat = await prisma.chat.findUnique({ where: { id: chatId }, select: { facts_meta: true } })
        const contradictions = (chat?.facts_meta as any)?.contradictions || []
        const notSent = contradictions.filter((c: any) => !c.sent)
        const contradictionsNote = notSent.length ? `
        \n\n[Обнаружены несостыковки, упомяни их в ответе и строй дальнейшие рассуждения,
        основываясь на том, как пользователь отреагирует на их упоминание.

        Несостыковки:
            ${notSent.map(
            (c: any) => `- ${c.explanation} 
                    (факты, на котором этот вывод основан: ${c.conflicting_facts.map((f: any) => f.message_id).join(', ')})`
        ).join('\n')
            }
        ]
        ` : ''

        const formattedMessages = messageHistory.map(message => ({
            role: message.role === 'user' ? 'user' as const : 'model' as const,
            content: `${message.content}${message.hiddenContent ? ` \n\n${message.hiddenContent}` : ''}`
        }
        ))
        formattedMessages.push({ role: 'user' as const, content: `${userMessage}${contradictionsNote}`, })

        const aiResponse = await aiService.communicateWithGemini(formattedMessages)
        await chatDebugLog(chatId, `отправляем пользователю сообщение ${JSON.stringify(aiResponse)}`)
        // mark contradictions as sent
        if (notSent.length) {
            const current = (chat?.facts_meta as any) || {}
            const updated = (current.contradictions || []).map((c: any) => ({ ...c, sent: true }))
            await prisma.chat.update({ where: { id: chatId }, data: { facts_meta: { ...current, contradictions: updated } } })
        }
        return aiResponse
    }
}