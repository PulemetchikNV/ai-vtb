import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { callModel } from "./shared/callModel";

export type ScenarioCheckerInput = {
    scenario_block_name: string;
    messages: string;
    scenario_block_keypoints: string[];
}

export type ScenarioCheckerOutput = {
    is_passed: boolean;
    is_need_finish: boolean;
}

const prompt = PromptTemplate.fromTemplate(
    `
    Ты - модератор собеседований. Вот предыдущие сообщения, относящиеся к блоку
    {scenario_block_name}:

    {messages}

    вот список ключевых точек блока:
    {scenario_block_keypoints}

    верни данные в объекте JSON вида {{is_passed: boolean, is_need_finish: boolean}}

    Проанализируй то, закончено ли осбуждение блока. если да то is_passed: true
    если нет то is_passed: false

    если пользователь повел себя некорректно или не по сценарию то is_need_finish: true
`
)

const parseText = new RunnableLambda<string, ScenarioCheckerOutput>({
    func: async (text: string) => {
        try {
            // Пытаемся распарсить JSON ответ
            const parsed = JSON.parse(text.trim());
            return { is_passed: Boolean(parsed.is_passed), is_need_finish: Boolean(parsed.is_need_finish) };
        } catch (e) {
            return { is_passed: false, is_need_finish: false };
        }
    }
})

export const scenarioCheckerChain = RunnableSequence.from<ScenarioCheckerInput, ScenarioCheckerOutput>([
    prompt,
    callModel,
    parseText,
])