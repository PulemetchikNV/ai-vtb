import { INITIAL_DIALOG_PROMPT } from "../__data__/prompts"
import { aiService } from "./ai"
import { prisma } from "../prisma"
import type { Vacancy, Message } from "../../prisma/generated/client"
import { chatDebugLog, chatDebugSeparator } from "./chatDebug"
import type { QualityAnalyzerOutput } from "../chains/qualityAnalyzerChain"
import type { ContradictingFactRef, Contradiction, FactsMeta } from "./factsMeta"

type ScenarioTransition = {
    from_block: string;
    to_block: string;
    block_keypoints: string[];
}

type CurrentScenarioBlock = {
    title: string;
    duration?: number;
    keypoints?: string[];
    counter: number;
    block_index: number;
    total_blocks: number;
}

type GetNextMessageParams = {
    userMessage: string,
    messageHistory: Message[],
    chatId: string,
    analyzerMeta?: QualityAnalyzerOutput | null,
    scenarioTransition?: ScenarioTransition | null,
    currentBlock?: CurrentScenarioBlock | null,
    forceFinish?: boolean,
}

export const dialogueService = {
    async getInitialMessage({ vacancy, resumeText, lang }: { vacancy: Vacancy, resumeText?: string, lang?: string }) {
        if (!lang) lang = 'ru'

        const basePrompt = INITIAL_DIALOG_PROMPT({ vacancy })
        let prompt = basePrompt
        if (resumeText) {
            prompt += `
        \n[Контекст из резюме кандидата (используй как фактическую информацию):\n${resumeText}\n]`
        }
        prompt += `
        \n[ЯЗЫК ДИАЛОГА: ${lang}. НЕ ОБРАЩАЙ ВНИМАНИЕ НА ТО КАКОЙ ЯЗЫК В РЕЗЮМЕ, ВЕДИ ДИАЛОГ ТОЛЬКО НА НЕМ. Не вставляй никаких звездочек и прочих символов которые трудно произнеси]
        `

        const initialMessage = await aiService.communicateWithGemini([{ role: 'user', content: prompt }], true)

        return {
            systemPrompt: prompt,
            initialMessage
        }
    },
    async getNextMessage({ userMessage, messageHistory, chatId, analyzerMeta, scenarioTransition, currentBlock, forceFinish }: GetNextMessageParams) {
        await chatDebugSeparator(chatId)
        // fetch latest contradictions
        const chat = await prisma.chat.findUnique({ where: { id: chatId }, select: { facts_meta: true, lang: true } }) as any
        const chatLang = chat?.lang || 'ru'
        let finalMessage = '';
        let notSent = [];

        if (!forceFinish) {
            const contradictions = (chat?.facts_meta as FactsMeta)?.contradictions || []
            notSent = contradictions.filter((c: Contradiction) => !c.sent)
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

            const scenarioNote = scenarioTransition ? `
            \n\n[ПЕРЕХОД К СЛЕДУЮЩЕМУ БЛОКУ СЦЕНАРИЯ]:
            Завершен блок: "${scenarioTransition.from_block}"
            Переходим к блоку: "${scenarioTransition.to_block}"
            
            Ключевые точки нового блока:
            ${scenarioTransition.block_keypoints.map(point => `- ${point}`).join('\n')}
            
            Сделай плавный переход от предыдущей темы к новому блоку. Кратко подведи итог обсуждения предыдущего блока и переходи к новой теме, основываясь на ключевых точках.
            ]
            ` : ''

            const currentBlockNote = currentBlock ? `
            \n\n[ТЕКУЩИЙ БЛОК СЦЕНАРИЯ]:
            Блок: "${currentBlock.title}" (${currentBlock.block_index + 1}/${currentBlock.total_blocks})
            Счетчик сообщений: ${currentBlock.counter}/${currentBlock.duration || 3}
            
            Ключевые точки блока:
            ${(currentBlock.keypoints || []).map(point => `- ${point}`).join('\n')}
            
            Веди беседу в рамках текущего блока, фокусируясь на его ключевых точках. ${currentBlock.counter >= (currentBlock.duration || 3) - 1 ? 'Это может быть последнее сообщение в блоке - подготовься к возможному переходу к следующей теме.' : ''}
            ]
            ` : ''

            const langNote = `
            \n\n(НАПОМИНАНИЕ ОТ АДМИНИСТРАТОРА БЕСЕДЫ) [Язык ответа: ${chatLang}. Не вставляй никаких звездочек и прочих символов которые трудно произнеси]
            `

            finalMessage = `${userMessage}${contradictionsNote}${qualityNote}${scenarioNote}${currentBlockNote}${langNote}`
        } else {
            finalMessage = `${userMessage} [Комментарий администратора: Пользователь не прошел блок. Принудительно завершай разговор]`
        }

        const formattedMessages = messageHistory.slice(0, -1).map(message => ({
            role: message.role === 'user' ? 'user' as const : 'model' as const,
            content: `${message.content}${message.hiddenContent ? ` \n\n${message.hiddenContent}` : ''}`
        }
        ))


        formattedMessages.push({ role: 'user' as const, content: finalMessage, })

        try {
            const aiResponse = await aiService.communicateWithGemini(formattedMessages)
            await chatDebugLog(chatId, `отправляем пользователю сообщение ${JSON.stringify(aiResponse)}`)

            // mark contradictions as sent
            if (notSent.length) {
                const current = (chat?.facts_meta) || {}
                const updated = (current.contradictions || []).map((c: Contradiction) => ({ ...c, sent: true }))
                await prisma.chat.update({ where: { id: chatId }, data: { facts_meta: { ...current, contradictions: updated } } })
            }

            return aiResponse
        } catch (error: any) {
            await chatDebugLog(chatId, `ошибка при получении ответа от AI: ${error.message || error}`)
            console.error('Error in getNextMessage:', error)

            // Возвращаем сообщение-заглушку при ошибке
            const errorMessage = '🤖 *Извините, возникла техническая проблема при формировании ответа. Пожалуйста, повторите свой вопрос.*'
            return errorMessage
        }
    }
}