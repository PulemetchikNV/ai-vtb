import { INITIAL_DIALOG_PROMPT } from "../__data__/prompts"
import { aiService } from "./ai"
import type { Vacancy, Message } from "../../prisma/generated/client"


export const dialogueService = {
    async getInitialMessage({ vacancy }: { vacancy: Vacancy }) {
        const prompt = INITIAL_DIALOG_PROMPT({ vacancy })
        const initialMessage = await aiService.communicateWithGemini([{ role: 'user', content: prompt }], true)

        return {
            systemPrompt: prompt,
            initialMessage
        }
    },
    async getNextMessage({ userMessage, messageHistory }: { userMessage: string, messageHistory: Message[] }) {
        const formattedMessages = messageHistory.map(message => ({
            role: message.role === 'user' ? 'user' as const : 'model' as const,
            content: `${message.content}${message.hiddenContent ? ` \n\n${message.hiddenContent}` : ''}`
        }
        ))
        formattedMessages.push({ role: 'user' as const, content: userMessage })

        const aiResponse = await aiService.communicateWithGemini(formattedMessages)
        return aiResponse
    }
}