import { Settings } from "./Settings";
import { ChatRequestMessage, ChatRequestSystemMessage, ChatRequestUserMessage, ChatRequestAssistantMessage } from "@azure/openai";


export class PromptHelper{

    public static createPrompt(question: string, settings: Settings, selection?: string): ChatRequestMessage[] {
        const messages: ChatRequestMessage[] = [];
        
        //stitch together the user question and the code selection if it exists
        let userPrompt = "";
        if (selection) {
            if (settings.selectedInsideCodeblock) {
                userPrompt = `${question}\n\`\`\`\n${selection}\n\`\`\``;
            } else {
                userPrompt = `${question}\n${selection}\n`;
            }
        } else {
            userPrompt = question;
        }


        //prepare the system prompt
        let systemPrompt = "";
        if (settings.model !== "ChatGPT") {
            systemPrompt = `You are ASSISTANT helping the USER with coding. 
    You are intelligent, helpful and an expert developer, who always gives the correct answer and only does what instructed. You always answer truthfully and don't make things up. 
    (When responding to the following prompt, please make sure to properly style your response using Github Flavored Markdown. 
    Use markdown syntax for things like headings, lists, colored text, code blocks, highlights etc. Make sure not to mention markdown or stying in your actual response. 
    Try to write code inside a single code block if possible)
    \n\nUSER: `;
        } else {
            systemPrompt = `You are ChatGPT, a large language model trained by OpenAI. Please answer as concisely as possible for each response, keeping the list items to a minimum. \nUser: `;
        }
    
        // System message
        let sys: ChatRequestSystemMessage = {
            role: "system",
            content: systemPrompt.trim() 
        };
        messages.push(sys);
    
        // User message
        let usr: ChatRequestUserMessage = {
            role: "user",
            content: userPrompt.trim() 
        };
        messages.push(usr);
    
        // Assistant's initial placeholder response
        let ass: ChatRequestAssistantMessage = {
            role: "assistant",
            content: "..." 
        };
        messages.push(ass);
    
        return messages;
    }
}
