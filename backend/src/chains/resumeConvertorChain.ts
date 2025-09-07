import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { callModel } from "./shared/callModel";

export type ResumeConvertorInput = {
    text: string;
}

const prompt = PromptTemplate.fromTemplate(
`
    вот результат парсинга файла с резюме:
    {text}
    верни результат с понятным форматированием и группировкой, без анализа и доп комментариев и выводов.
    если в тексте есть артефакты - обрежь их
`
)

const parseText = new RunnableLambda<string, string>({
    func: async (text: string) => {
        return text
    }
})

export const resumeConvertorChain = RunnableSequence.from<ResumeConvertorInput, string>([
    prompt,
    callModel,
    parseText,
])