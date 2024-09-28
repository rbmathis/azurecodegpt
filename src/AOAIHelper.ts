import {
    OpenAIClient,
    AzureKeyCredential,
    ChatRequestMessage,
    ChatRequestSystemMessage, 
    ChatRequestUserMessage, 
    ChatRequestAssistantMessage
} from "@azure/openai";
import { AOAIEndpointSecrets, AOAIOptions } from "./AOAITypes";

/**
 * A helper class for interacting with the Azure OpenAI service.
 * This class follows the singleton pattern to ensure only one instance is created.
 */
export class AOAIHelper{
    private static instance: AOAIHelper;
    private _openai?: OpenAIClient;



    /**
     * Constructs an instance of AOAIHelper.
     * 
     * @param aoaiEndpointConfig - The configuration for the AOAI endpoint. This parameter cannot be null or undefined.
     * @param options - Additional options for the AOAIHelper instance.
     * 
     * @throws {Error} If the aoaiEndpointConfig is null or undefined.
     */
    private constructor(public aoaiEndpointConfig:AOAIEndpointSecrets, public options: AOAIOptions) {
        if (!aoaiEndpointConfig){
            throw new Error("AOAI Endpoint Config cannot be null or undefined.");
        }
        this.aoaiEndpointConfig = aoaiEndpointConfig;
        this.options = options;
    }




    /**
     * Retrieves an instance of the `AOAIHelper` class. If an `aoaiEndpointConfig` is provided, 
     * it creates a new instance and attempts to connect to AOAI. If the connection is successful, 
     * the new instance is set as the singleton instance. If the connection fails, an error is thrown.
     * If no `aoaiEndpointConfig` is provided, the existing singleton instance is returned.
     * 
     * @param aoaiEndpointConfig - Optional configuration for the AOAI endpoint.
     * @param options - Optional configuration options for the AOAI instance.
     * @returns The singleton instance of the `AOAIHelper` class.
     * @throws Will throw an error if the connection to AOAI fails.
     */
    public static getInstance(aoaiEndpointConfig?: AOAIEndpointSecrets, options?:AOAIOptions): AOAIHelper {

        if(aoaiEndpointConfig)//create a new instance
        {
            let tmp = new AOAIHelper(aoaiEndpointConfig, options ? options : this.instance.options);

            tmp.connectAOAI().then((result) => {
                if(result){
                    this.instance = tmp;
                }
                else{
                    throw new Error(`Could not connect to AOAI using endpoint:${this.instance.aoaiEndpointConfig.aoaiEndpoint} and deployment:${this.instance.aoaiEndpointConfig.aoaiDeployment}. Please verify KeyVault settings for API key, endpoint, and deployment name.`);
                }
            });
            this.instance = tmp;
            return tmp;
        }
        else{        
            if(options){
                this.instance.options = options;
            }
            return this.instance;
        }     
    }



    /**
     * Connects to the Azure OpenAI service and performs a simple test to verify the connection.
     * 
     * @returns {Promise<boolean | undefined>} A promise that resolves to `true` if the connection is successful, 
     * or throws an error if the connection fails.
     * 
     * @throws {Error} Throws an error if the endpoint or options are null or undefined, or if the connection to AOAI fails.
     * 
     * @remarks
     * This method initializes the OpenAIClient with the provided endpoint and key, and sends a test message to verify the connection.
     * Ensure that the `aoaiEndpointConfig` and `options` are properly set before calling this method.
     */
    private async connectAOAI() : Promise<boolean> {

        if ((!this.aoaiEndpointConfig) || (!this.options)) {
            throw new Error("EndPoint and Options cannot be null or undefined.");
        }

        //connect to AOAI and run a simple test
        //we should have all the settings and auth ready
        try{
            this._openai = new OpenAIClient(
                this.aoaiEndpointConfig.aoaiEndpoint,
                new AzureKeyCredential(this.aoaiEndpointConfig.aoaiKey)
            );

            await this._openai.getChatCompletions(this.aoaiEndpointConfig.aoaiDeployment, [
                { role: "user", content: "Hello, are you there?" },
            ]);
            return true;

        } catch (err) {
            throw new Error(`Could not connect to AOAI using endpoint:${this.aoaiEndpointConfig.aoaiEndpoint} and deployment:${this.aoaiEndpointConfig.aoaiDeployment}. Please verify KeyVault settings for API key, endpoint, and deployment name. Message: ${(err instanceof Error ? err.message : String(err))}`);
        }
    }


    /**
     * Creates a code prompt for a chat request message.
     *
     * @param systemPrompt - The system prompt to be used in the chat request.
     * @param question - The user's question to be included in the chat request.
     * @param selection - Optional. The code selection to be included in the chat request.
     * @param putSelectedInsideCodeBlock - Optional. If true, the code selection will be wrapped inside a code block.
     * @returns An array of `ChatRequestMessage` objects representing the chat request.
     */
    public createCodePrompt(systemPrompt:string, question: string, selection?: string, putSelectedInsideCodeBlock?: boolean): ChatRequestMessage[] {

        const chatMessageBuffer: ChatRequestMessage[] = [];
        
        //stitch together the user question and the code selection if it exists
        let userPrompt = "";
        if (selection) {
            if ( putSelectedInsideCodeBlock) {
                userPrompt = `${question}\n\`\`\`\n${selection}\n\`\`\``;
            } else {
                userPrompt = `${question}\n${selection}\n`;
            }
        } else {
            userPrompt = question;
        }

        // System message
        let sys: ChatRequestSystemMessage = {
            role: "system",
            content: systemPrompt.trim() 
        };
        chatMessageBuffer.push(sys);
    
        // User message
        let usr: ChatRequestUserMessage = {
            role: "user",
            content: userPrompt.trim() 
        };
        chatMessageBuffer.push(usr);
    
        // Assistant's initial placeholder response
        let ass: ChatRequestAssistantMessage = {
            role: "assistant",
            content: "..." 
        };
        chatMessageBuffer.push(ass);
    
        return chatMessageBuffer;
    }


    /**
     * Sends a chat request to the Azure OpenAI endpoint and returns the response.
     *
     * @param {ChatRequestMessage[]} prompt - An array of chat request messages to be sent to the OpenAI endpoint.
     * @returns {Promise<string | undefined>} - A promise that resolves to the response string from the OpenAI endpoint, or undefined if no response is received.
     * @throws {Error} - Throws an error if the OpenAI client is not initialized or if there is an issue getting chat completions from the AOAI.
     */
    public async doChat(prompt: ChatRequestMessage[]):Promise<string | undefined>{

        //stop if we don't have a chatclient ready
        if (!this._openai) {
            throw new Error("OpenAI client is not initialized.");
        }

        //populate the options from settings
        const options = {
            temperature: this.options.temperature,
            maxTokens: this.options.maxTokens,
            topP: 1.0,
            frequencyPenalty: 1,
            presencePenalty: 1,
            stop: ["\nUSER: ", "\nUSER", "\nASSISTANT"],
        };


        let response = "";
        let completion;
        try{
            //send the prompts to the AOAI endpoint
            completion = await this._openai.getChatCompletions(
                this.aoaiEndpointConfig.aoaiDeployment,
                prompt,
                options
            );
        
            //grab the response from AOAI
            response = completion.choices[0].message?.content || "";
        }
        catch (err) {
            throw new Error("Could not get chat completions from AOAI. Message: " + (err instanceof Error ? err.message : String(err)));   
        }
        return response;
    }
    
}