import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { extractJsonWithoutRegex } from "../utils";
import callModel from "./shared/callModel";

export type FactContradictionInput = {
    new_fact_text: string;
    neighbor_facts: string[];
};

export const GuardianContradictionSchema = z.object({
    explanation: z.string().min(1),
    conflicting_facts: z.array(
        z.object({
            fact: z.string().min(1),
            message_id: z.string().min(1),
        })
    )
});

export type GuardianContradiction = z.infer<typeof GuardianContradictionSchema>;

const prepareVars = new RunnableLambda<FactContradictionInput, { new_fact_text: string; neighbors_block: string }>({
    func: async (input: FactContradictionInput) => {
        const neighbors_block = (input.neighbor_facts || [])
            .map((d: string) => `- ${d}`)
            .join('\n');
        return {
            new_fact_text: input.new_fact_text,
            neighbors_block
        };
    }
});

const prompt = PromptTemplate.fromTemplate(
    `Проанализируй новый факт и список близких фактов из истории диалога.
    нужно понять, есть ли среди похожих фактов противоречащие новому.
    Верни JSON-массив элементов вида {{"explanation": "string", "conflicting_facts": [{{"fact": "string", "message_id": "string"}}]}}

Новый факт: "{new_fact_text}"
Похожие факты:
{neighbors_block}

Верни ответ СТРОГО в формате JSON массива без дополнительных комментариев.

В explanation пиши о каком факте идет речь (его суть). НЕЛЬЗЯ ПИСАТЬ "Новый факт"`
);

const parseArray = new RunnableLambda<string, GuardianContradiction[]>({
    func: async (rawText: string) => {
        const rawJson = extractJsonWithoutRegex(rawText) ?? '[]';
        const parsed = await new JsonOutputParser().parse(rawJson) as any;
        return z.array(GuardianContradictionSchema).parse(parsed);
    }
});

export const factContradictionChain = RunnableSequence.from<FactContradictionInput, GuardianContradiction[]>([
    prepareVars,
    prompt,
    callModel,
    parseArray,
]);

export default factContradictionChain;


