import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { extractJsonWithoutRegex } from "../utils";
import callModel from "./shared/callModel";

export type FactArbitratorInput = {
    old_fact_text: string;
    old_fact_id?: string;
    new_fact_text: string;
};

export const ArbitratorSchema = z.union([
    z.object({ action: z.literal('ADD_NEW') }),
    z.object({ action: z.literal('FLAG_CONTRADICTION'), note: z.string().optional() }),
    z.object({ action: z.literal('INVALIDATE_OLD'), target_fact_id: z.string() })
]);

export type FactArbitratorOutput = z.infer<typeof ArbitratorSchema>;

const prompt = PromptTemplate.fromTemplate(
    `Ты — арбитр фактов. Дано предыдущее и новое утверждения кандидата.
Сравни и верни строгий JSON одного из видов:
{{"action":"ADD_NEW"}}
{{"action":"FLAG_CONTRADICTION","note":"строка"}}
{{"action":"INVALIDATE_OLD","target_fact_id":"fact_123"}}

<section>
Правила:
- Если новое уточняет/исправляет старое — верни INVALIDATE_OLD.
- Если INVALIDATE_OLD и есть old_fact_id, заполни target_fact_id равным old_fact_id.

- Если найдена несостыковка - верни FLAG_CONTRADICTION.
- Если новое утверждение НИКАК не относится к старому (не дополняет его или НИКАК не противоречит ему) - верни ADD_NEW  

- Не добавляй пояснений, верни только JSON.
</section>

<section>
например:
'Старое утверждение: Имеет 5 лет опыта разработки на Vue\n' +
'ID старого утверждения (опционально): cmf8py8sd0000oar4syvg7r9o_1757190687114_1\n' +
'Новое утверждение: Написал первый проект 3 года назад'

твой ответ - {{"action":"FLAG_CONTRADICTION","note":"Новое утверждение противоречит старому, так как опыт работы с Vue не может составлять 5 лет, если проекты начали писать 3 года назад."}}
</section>

Старое утверждение: {old_fact_text}
ID старого утверждения (опционально): {old_fact_id}
Новое утверждение: {new_fact_text}`
);

const extractAndParseJson = async (rawText: string): Promise<FactArbitratorOutput> => {
    const rawJson = extractJsonWithoutRegex(rawText) ?? '{}';
    const parsed = await new JsonOutputParser().parse(rawJson) as any;
    return ArbitratorSchema.parse(parsed);
}

export const factArbitratorChain = RunnableSequence.from<FactArbitratorInput, FactArbitratorOutput>([
    prompt,
    callModel,
    extractAndParseJson,
]);

export default factArbitratorChain;


