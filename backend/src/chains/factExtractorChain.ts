import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { extractJsonWithoutRegex } from "../utils";
import callModel from "./shared/callModel";

export type FactExtractorInput = {
    candidate_sentence: string;
};

export const FactSchema = z.array(z.object({
    fact: z.string().min(1),
    topic: z.string().min(1),
}));

export type FactExtractorOutput = z.infer<typeof FactSchema>;

const prompt = PromptTemplate.fromTemplate(
    `Ты — извлекатель фактов из контекста.
Твоя задача — извлечь МАКСИМУМ {max_facts} ключевых утверждений и кратко нормализовать его.

Требования к ответу:
- Верни СТРОГО МАССИВ В JSON без пояснений и комментариев.
- Поля: [{{"fact": string, "topic": string}}]. Пример topic: "experience", "skill", "education".

Контекст: "{context}"
`
);

// callModel вынесен в shared/callModel

const extractAndParseJson = new RunnableLambda<string, FactExtractorOutput>({
    func: async (rawText: string) => {
        const rawJson = extractJsonWithoutRegex(rawText) ?? "{}";
        const parsed = await new JsonOutputParser().parse(rawJson) as any;
        return FactSchema.parse(parsed);
    },
});

export const factExtractorChain = RunnableSequence.from<FactExtractorInput, FactExtractorOutput>([
    prompt,
    callModel,
    extractAndParseJson,
]);

export default factExtractorChain;


