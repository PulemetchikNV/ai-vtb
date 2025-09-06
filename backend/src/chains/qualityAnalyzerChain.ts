import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { extractJsonWithoutRegex } from "../utils";
import callModel from "./shared/callModel";

export type QualityAnalyzerInput = {
    last_few_messages: string;
};

export const QualityAnalysisSchema = z.object({
    is_canned_answer: z.boolean(),
    is_evasive: z.boolean(),
    is_not_full_answer: z.boolean(),
    analysis: z.string().min(1),
});

export type QualityAnalyzerOutput = z.infer<typeof QualityAnalysisSchema>;

const prompt = PromptTemplate.fromTemplate(
    `Ты — аналитик собеседований. Оцени качество ответа кандидата на текущий вопрос интервьюера.
    Учти признаки шаблонности (общие фразы без конкретики) и 
    уклончивости (уход от сути вопроса, отсутствие примеров/деталей).

    Верни СТРОГО JSON без комментариев вида {{
        "is_canned_answer": boolean, // шаблонный ответ
        "is_evasive": boolean, // уклончивость
        "is_not_full_answer": boolean, // кандидат не раскрыл тему полностью
        "analysis": "string" // пояснение к оценке
    }}.

    Последние несколько сообщений диалога: "{last_few_messages}"`
);

const parseJson = new RunnableLambda<string, QualityAnalyzerOutput>({
    func: async (rawText: string) => {
        const rawJson = extractJsonWithoutRegex(rawText) ?? '{}';
        const parsed = await new JsonOutputParser().parse(rawJson) as any;
        return QualityAnalysisSchema.parse(parsed);
    },
});

export const qualityAnalyzerChain = RunnableSequence.from<QualityAnalyzerInput, QualityAnalyzerOutput>([
    prompt,
    callModel,
    parseJson,
]);

export default qualityAnalyzerChain;


