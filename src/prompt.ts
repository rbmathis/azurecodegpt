import { Settings } from "./Helpers";
import { ChatRequestMessage } from "@azure/openai";

export default (
    question: string,
    settings: Settings,
    selection?: string
): ChatRequestMessage[] => {
    const messages: ChatRequestMessage[] = [];
    let systemMessage = "";

    if (selection) {
        if (settings.selectedInsideCodeblock) {
            systemMessage = `${question}\n\`\`\`\n${selection}\n\`\`\``;
        } else {
            systemMessage = `${question}\n${selection}\n`;
        }
    } else {
        systemMessage = question;
    }

    let assistantPrefix = "";

    if (settings.model !== "ChatGPT") {
        assistantPrefix = `You are ASSISTANT helping the USER with coding. 
You are intelligent, helpful and an expert developer, who always gives the correct answer and only does what instructed. You always answer truthfully and don't make things up. 
(When responding to the following prompt, please make sure to properly style your response using Github Flavored Markdown. 
Use markdown syntax for things like headings, lists, colored text, code blocks, highlights etc. Make sure not to mention markdown or stying in your actual response. 
Try to write code inside a single code block if possible)
\n\nUSER: `;
    } else {
        assistantPrefix = `You are ChatGPT, a large language model trained by OpenAI. Please answer as concisely as possible for each response, keeping the list items to a minimum. \nUser: `;
    }

    // System message
    messages.push({ role: "system", content: assistantPrefix.trim() });

    // User message
    messages.push({ role: "user", content: systemMessage.trim() });

    // Assistant's initial response placeholder
    messages.push({ role: "assistant", content: "..." });

    return messages;
};
