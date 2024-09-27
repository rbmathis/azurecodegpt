import {
    OpenAIClient,
    AzureKeyCredential,
    ChatRequestMessage,
    ChatRequestSystemMessage, 
    ChatRequestUserMessage, 
    ChatRequestAssistantMessage
} from "@azure/openai";
import type { AOAIEndpointSecrets, AOAIOptions } from "./AOAITypes";
import { Settings } from "./Settings";


export class AOAIHelper{
    private static instance: AOAIHelper;

    private _openai?: OpenAIClient;
    private _messages: string[];
    private _isConnected: boolean = false;
    private _hasError: boolean = false;



    private constructor(public aoaiEndpointConfig:AOAIEndpointSecrets, public options: AOAIOptions) {
        if (!aoaiEndpointConfig){
            throw new Error("AOAI Endpoint Config cannot be null or undefined.");
        }
        this._messages = [];
        this.aoaiEndpointConfig = aoaiEndpointConfig;
        this.options = options;
    }

    



    public get messages(): string[] {
        return this._messages;
    }


    public get isConnected(): boolean {
        return this._isConnected;
    }

    public get hasError(): boolean {
        return this._hasError;
    }



    public static getInstance(aoaiEndpointConfig?: AOAIEndpointSecrets, options?:AOAIOptions): AOAIHelper {

        
        if(aoaiEndpointConfig)//create a new instance
        {
            let x = new AOAIHelper(aoaiEndpointConfig, options || this.instance.options);
            x.connectAOAI().then((result) => {
                if(result){
                    this.instance = x;
                }
                else{
                    throw new Error("Could not connect to AOAI.");
                }
            });
            this.instance = x;
            return x;
        }
        else{        
            if(options){
                this.instance.options = options;
            }
            return AOAIHelper.instance;
        }     
    }



    private async connectAOAI() : Promise<boolean | undefined> {

        if ((!this.aoaiEndpointConfig) || (!this.options)) {
            throw new Error("EndPoint and Options cannot be null or undefined.");
        }

        //clear historical messages
        this._messages = [];

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
            this._isConnected = true;
            this._hasError = false;
            this._messages.push("aoaicodegpt: [Success] connected to Azure OpenAI API.");
            return true;

        } catch (err) {
            this._messages.push("aoaicodegpt: [Error] - Could not connect to Azure OpenAI API. Please check your API key, endpoint, and deployment name. Message: " + (err instanceof Error ? err.message : String(err)));
            this._hasError = true;
            return false;
        }
    }


    public createPrompt(systemPrompt:string, question: string, selection?: string, putSelectedInsideCodeBlock?: boolean): ChatRequestMessage[] {

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


    public async doChat(prompt: ChatRequestMessage[]):Promise<string | undefined>{

        this._messages= [];

        //populate the options from settings
        const options = {
            temperature: this.options.temperature,
            maxTokens: this.options.maxTokens,
            topP: 1.0,
            frequencyPenalty: 1,
            presencePenalty: 1,
            stop: ["\nUSER: ", "\nUSER", "\nASSISTANT"],
        };

        //barf if we don't have a chatclient ready
        if (!this._openai) {
            this._messages.push("aoaigpt: [Error] - Could not get chat completions from Azure OpenAI API.");
            this._hasError = true;
            throw new Error("OpenAI client is not initialized.");
        }

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
            response="Could not get chat completions from Azure OpenAI API. Message: " + (err instanceof Error ? err.message : String(err));   
            this._messages.push("aoaigpt: [Error] - Could not get chat completions from Azure OpenAI API. Message: " + (err instanceof Error ? err.message : String(err)));            
            this._hasError = true;
        }
        return response;
    }
    
}