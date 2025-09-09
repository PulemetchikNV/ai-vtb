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

        // Проверяем и обновляем прогресс по блокам сценария
        const { scenarioTransition, currentBlock, forceFinish, checkerComment } = await updateScenarioProgress({ chatId, messageHistory })

        const assistantText = await dialogueService.getNextMessage({
            userMessage: userContent,
            messageHistory,
            chatId,
            analyzerMeta,
            scenarioTransition,
            currentBlock,
            forceFinish,
            checkerComment,
        })
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


export async function updateScenarioProgress(params: { chatId: string; messageHistory: Array<{ role: string; content: string }> }): Promise<{ scenarioTransition: any | null; currentBlock: any | null; forceFinish: boolean; checkerComment: string }> {
    const { chatId, messageHistory } = params
    let scenarioTransition: any | null = null
    let currentBlock: any | null = null
    let forceFinish = false
    let checkerComment = ''

    const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        select: { meta: true }
    })

    if (chat?.meta && typeof chat.meta === 'object' && 'scenario' in (chat.meta as any)) {
        const meta = chat.meta as any
        const scenario = meta.scenario
        console.log('=== SCENARIO ===', scenario)

        if (scenario && scenario.current_block) {
            // Всегда формируем информацию о текущем блоке
            currentBlock = {
                title: scenario.current_block.title,
                duration: scenario.current_block.duration,
                keypoints: scenario.current_block.keypoints || [],
                counter: scenario.counter,
                block_index: scenario.current_block_index,
                total_blocks: scenario.blocks.length
            }

            // Проверяем, завершен ли текущий блок
            const { scenarioCheckerChain } = await import('../chains/scenarioCheckerChain')

            const blockMessages = messageHistory
                .slice(-6)
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n')

            const checkerResult = await scenarioCheckerChain.invoke({
                scenario_block_name: scenario.current_block.title,
                messages: blockMessages,
                scenario_block_keypoints: scenario.current_block.keypoints || []
            })
            forceFinish = checkerResult.is_need_finish
            checkerComment = checkerResult.comment
            console.log('=== CHECKER RESULT ===', checkerResult)

            if (checkerResult.is_passed || scenario.counter >= (scenario.current_block.duration - 1 || 3)) {
                // Блок завершен, переходим к следующему
                const nextBlockIndex = scenario.current_block_index + 1
                if (nextBlockIndex < scenario.blocks.length) {
                    const nextBlock = scenario.blocks[nextBlockIndex]
                    const updatedMeta = {
                        ...meta,
                        scenario: {
                            ...scenario,
                            current_block_index: nextBlockIndex,
                            current_block: nextBlock,
                            counter: 0
                        }
                    }

                    await prisma.chat.update({ where: { id: chatId }, data: { meta: updatedMeta } })

                    scenarioTransition = {
                        from_block: scenario.current_block.title,
                        to_block: nextBlock.title,
                        block_keypoints: nextBlock.keypoints || []
                    }

                    // Обновляем currentBlock для нового блока
                    currentBlock = {
                        title: nextBlock.title,
                        duration: nextBlock.duration,
                        keypoints: nextBlock.keypoints || [],
                        counter: 0,
                        block_index: nextBlockIndex,
                        total_blocks: scenario.blocks.length
                    }
                }
            } else {
                // Блок не завершен, увеличиваем counter
                const updatedMeta = {
                    ...meta,
                    scenario: {
                        ...scenario,
                        counter: scenario.counter + 1
                    }
                }
                await prisma.chat.update({ where: { id: chatId }, data: { meta: updatedMeta } })
                // Обновляем counter в currentBlock
                currentBlock.counter = scenario.counter + 1
            }
        }
    }

    return { scenarioTransition, currentBlock, forceFinish, checkerComment }
}


