import { INITIAL_DIALOG_PROMPT } from "../__data__/prompts"
import { aiService } from "./ai"
import { prisma } from "../prisma"
import type { Vacancy, Message } from "../../prisma/generated/client"
import { chatDebugLog, chatDebugSeparator } from "./chatDebug"
import type { QualityAnalyzerOutput } from "../chains/qualityAnalyzerChain"
import type { ContradictingFactRef, Contradiction, FactsMeta } from "./factsMeta"

type GetNextMessageParams = {
    userMessage: string,
    messageHistory: Message[],
    chatId: string,
    analyzerMeta?: QualityAnalyzerOutput | null
}

export const dialogueService = {
    async getInitialMessage({ vacancy, resumeText }: { vacancy: Vacancy, resumeText?: string }) {
        const basePrompt = INITIAL_DIALOG_PROMPT({ vacancy })
        const prompt = resumeText ? `${basePrompt}
\n[Контекст из резюме кандидата (используй как фактическую информацию):\n${resumeText}\n]` : basePrompt
        const initialMessage = await aiService.communicateWithGemini([{ role: 'user', content: prompt }], true)

        return {
            systemPrompt: prompt,
            initialMessage
        }
    },
    async getNextMessage({ userMessage, messageHistory, chatId, analyzerMeta }: GetNextMessageParams) {
        await chatDebugSeparator(chatId)
        // fetch latest contradictions
        const chat = await prisma.chat.findUnique({ where: { id: chatId }, select: { facts_meta: true } }) as any
        const contradictions = (chat?.facts_meta as FactsMeta)?.contradictions || []
        const notSent = contradictions.filter((c: Contradiction) => !c.sent)
        chatDebugLog(chatId, `обнаружены несостыковки: ${JSON.stringify(notSent)}`)

        const contradictionsNote = notSent.length ? `
        \n\n[Обнаружены несостыковки, упомяни их в ответе и строй дальнейшие рассуждения,
        основываясь на том, как пользователь отреагирует на их упоминание.

        Несостыковки:
            ${notSent.map(
            (c: Contradiction) => `- ${c.explanation} 
                    (факты-основания: ${c.conflicting_facts
                    .map((f: ContradictingFactRef) => `${f.fact}(${f.source === 'resume' ? 'кандидат указал в резюме' : 'кандидат упоминал в чате'})`).join(', ')})`
            ).join('\n')
            }
        ]
        ` : ''

        const qualityNote = analyzerMeta ? `
        \n\n[Анализ качества ответа кандидата (относительно предыдущего вопроса интервьюера):
        - Шаблонный ответ: ${analyzerMeta.is_canned_answer ? 'да' : 'нет'}
        ${
            // analyzerMeta.is_canned_answer ? `Упомяни в своей фразе что этот ответ слишком общий и задай вопрос который покажет конкретные знания кандидата` : ''
            ''
        }
        - Уклончивость: ${analyzerMeta.is_evasive ? 'да' : 'нет'}
        ${
            // analyzerMeta.is_evasive ? `Верни русло разговора в предыдущую тему и заставь кандидата полностью раскрыть вопрос` : ''
            ''
        }
        - Неполный ответ: ${analyzerMeta.is_not_full_answer ? 'да' : 'нет'}
        ${
            // analyzerMeta.is_not_full_answer ? `Упомяни в своей фразе что этот ответ не раскрывает всю суть и задай вопрос который покажет конкретные знания кандидата` : ''
            ''
        }
        Пояснение: ${analyzerMeta.analysis}
        ]
        ` : ''

        const formattedMessages = messageHistory.slice(0, -1).map(message => ({
            role: message.role === 'user' ? 'user' as const : 'model' as const,
            content: `${message.content}${message.hiddenContent ? ` \n\n${message.hiddenContent}` : ''}`
        }
        ))
        formattedMessages.push({ role: 'user' as const, content: `${userMessage}${contradictionsNote}${qualityNote}`, })

        const aiResponse = await aiService.communicateWithGemini(formattedMessages)
        await chatDebugLog(chatId, `отправляем пользователю сообщение ${JSON.stringify(aiResponse)}`)
        // mark contradictions as sent
        if (notSent.length) {
            const current = (chat?.facts_meta) || {}
            const updated = (current.contradictions || []).map((c: Contradiction) => ({ ...c, sent: true }))
            await prisma.chat.update({ where: { id: chatId }, data: { facts_meta: { ...current, contradictions: updated } } })
        }
        return aiResponse
    }
}