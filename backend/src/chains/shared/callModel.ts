import { RunnableLambda } from "@langchain/core/runnables";
import { aiService } from "../../services/ai";
import { StringPromptValue } from "@langchain/core/dist/prompt_values";

export const callModel = new RunnableLambda<any, string>({
    func: async (formattedPrompt: StringPromptValue) => {
        const content = formattedPrompt.toString()
        
        const text = await aiService.communicateWithGemini(
            [{ role: "user", content }],
            true,
            "gemini-2.0-flash"
        );
        return text;
    },
});

export default callModel;


