import { AuthHelper } from "./AuthHelper";
import {
    OpenAIClient,
    AzureKeyCredential,
    ChatRequestMessage,
    ChatRequestSystemMessage, 
    ChatRequestUserMessage, 
    ChatRequestAssistantMessage
} from "@azure/openai";
import { Settings } from "./Settings";


/**
 * The `AOAIHelper` class provides methods to interact with the Azure OpenAI API (AOAI).
 * It follows the singleton pattern to ensure only one instance of the helper is created.
 * 
 * @class
 * @classdesc This class handles authentication, connection, and communication with the Azure OpenAI API.
 * It provides methods to create prompts and send chat messages to the API.
 * 
 * @example
 * ```typescript
 * const authHelper = new AuthHelper();
 * const settings = new Settings();
 * const aoaiHelper = AOAIHelper.getInstance(authHelper, settings);
 * 
 * // Connect to AOAI
 * const isConnected = await aoaiHelper._connectAOAI(authHelper);
 * 
 * // Create a prompt
 * const prompt = aoaiHelper.createPrompt("What is TypeScript?", settings);
 * 
 * // Send a chat message
 * const response = await aoaiHelper.doChat(prompt);
 * console.log(response);
 * ```
 * 
 * @remarks
 * The class ensures that authentication information is loaded before attempting to connect to the AOAI.
 * It also handles errors and maintains a list of messages for debugging purposes.
 * 
 * @see {@link AuthHelper}
 * @see {@link Settings}
 * @see {@link OpenAIClient}
 */
export class AOAIHelper{
    private static instance: AOAIHelper;

    private _authHelper: AuthHelper;
    private _settings: Settings;
    private _openai?: OpenAIClient;

    private _messages: string[];
    private _isConnected: boolean = false;
    private _hasError: boolean = false;




    /**
     * Constructs an instance of AOAIHelper.
     * 
     * @param authHelper - An instance of AuthHelper. Must not be null or undefined.
     * @param settings - An instance of Settings. Must not be null or undefined.
     * @throws {Error} If either authHelper or settings is null or undefined.
     */
    private constructor(public settings: Settings, public authHelper: AuthHelper) {
        if ((!authHelper) || (!settings)) {
            throw new Error("AuthHelper and Settings cannot be null or undefined.");
        }
        this._authHelper = authHelper;
        this._messages = [];
        this._settings = settings;
    }


    /**
     * Retrieves the array of messages.
     * 
     * @returns {string[]} An array of message strings.
     */
    public get messages(): string[] {
        return this._messages;
    }
    /**
     * Checks if the connection is established.
     * 
     * @returns {boolean} - Returns `true` if connected, otherwise `false`.
     */
    public get isConnected(): boolean {
        return this._isConnected;
    }
    /**
     * Gets a value indicating whether there is an error.
     * 
     * @returns {boolean} True if there is an error; otherwise, false.
     */
    public get hasError(): boolean {
        return this._hasError;
    }


        /**
     * Retrieves an instance of `AOAIHelper`. If an instance does not already exist, it initializes one with the provided settings and authentication helper.
     * If an instance already exists, it updates the settings and authentication helper if provided.
     * 
     * @param settings - Optional settings for initializing or updating the `AOAIHelper` instance.
     * @param authHelper - Optional authentication helper for initializing or updating the `AOAIHelper` instance.
     * @returns A promise that resolves to the `AOAIHelper` instance or undefined.
     * @throws Will throw an error if settings and authentication helper are not provided during the first initialization.
     */
    public static async getInstance(): Promise<AOAIHelper | undefined>;
    public static async getInstance(settings: Settings, authHelper:AuthHelper): Promise<AOAIHelper | undefined>;
    public static async getInstance(settings?: Settings, authHelper?:AuthHelper): Promise<AOAIHelper | undefined> {
        if (!AOAIHelper.instance) {
            if ((!settings)||(!authHelper)) {
                throw new Error("Settings and Auth must be provided for the first initialization.");
            } else {
                AOAIHelper.instance = new AOAIHelper(settings, authHelper);
            }
        } else {
            if(settings){
                AOAIHelper.instance._settings = settings;
                AOAIHelper.instance._messages = [];
                AOAIHelper.instance._hasError = false;
                AOAIHelper.instance._isConnected = false;
            }
            if(authHelper){
                AOAIHelper.instance._authHelper = authHelper;
                AOAIHelper.instance._messages = [];
                AOAIHelper.instance._hasError = false;
                AOAIHelper.instance._isConnected = false;
            }
        }
        if(!AOAIHelper.instance.isConnected) {
            await AOAIHelper.connectAOAI();
        }
        return AOAIHelper.instance;
    }


    /**
     * Connects to Azure OpenAI API (AOAI) using the provided authentication helper.
     * 
     * This method performs the following steps:
     * 1. Clears historical messages.
     * 2. Ensures authentication information is loaded.
     * 3. Checks for authentication errors.
     * 4. Attempts to connect to AOAI and run a simple test.
     * 
     * @param {AuthHelper} authHelper - The authentication helper instance.
     * @returns {Promise<boolean | undefined>} - Returns a promise that resolves to `true` if the connection is successful,
     *                                           `false` if there is an error, or `undefined` if the authentication is not loaded.
     * 
     * @throws {Error} - Throws an error if the connection to AOAI fails.
     */
    private static async connectAOAI() : Promise<AOAIHelper | undefined> {

        if ((!AOAIHelper.instance.authHelper) || (!AOAIHelper.instance.settings)) {
            throw new Error("AuthHelper and Settings cannot be null or undefined.");
        }

        //clear historical messages
        AOAIHelper.instance._messages = [];

        //connect to AOAI and run a simple test
        try{
            AOAIHelper.instance._openai = new OpenAIClient(
                AOAIHelper.instance._authHelper.secrets.aoaiEndpoint,
                new AzureKeyCredential(AOAIHelper.instance.authHelper.secrets.aoaiKey)
            );

            await AOAIHelper.instance._openai.getChatCompletions(AOAIHelper.instance.authHelper.secrets.aoaiDeployment, [
                { role: "user", content: "Hello, are you there?" },
            ]);

            AOAIHelper.instance._messages.push("aoaicodegpt: [Success] connected to Azure OpenAI API.");

        } catch (err) {
            AOAIHelper.instance._messages.push("aoaicodegpt: [Error] - Could not connect to Azure OpenAI API. Please check your API key, endpoint, and deployment name. Message: " + (err instanceof Error ? err.message : String(err)));
            AOAIHelper.instance._hasError = true;
            return AOAIHelper.instance;
        }
        return AOAIHelper.instance;
    }


    /**
     * Creates a prompt for the chat assistant based on the user's question, settings, and optional code selection.
     * 
     * @param question - The user's question to be included in the prompt.
     * @param settings - The settings that influence how the prompt is created.
     * @param selection - An optional code selection to be included in the prompt.
     * @returns An array of `ChatRequestMessage` objects representing the prompt.
     */
    public createPrompt(question: string, selection?: string): ChatRequestMessage[] {

        const chatMessageBuffer: ChatRequestMessage[] = [];
        
        //stitch together the user question and the code selection if it exists
        let userPrompt = "";
        if (selection) {
            if ( AOAIHelper.instance.settings.selectedInsideCodeblock) {
                userPrompt = `${question}\n\`\`\`\n${selection}\n\`\`\``;
            } else {
                userPrompt = `${question}\n${selection}\n`;
            }
        } else {
            userPrompt = question;
        }


        //prepare the system prompt
        let systemPrompt = "";
        if (AOAIHelper.instance.settings.model !== "ChatGPT") {
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
     * Sends a chat prompt to the Azure OpenAI API and returns the response.
     *
     * @param {ChatRequestMessage[]} prompt - An array of chat request messages to be sent to the API.
     * @returns {Promise<string | undefined>} - A promise that resolves to the response from the API, or undefined if an error occurs.
     *
     * @throws {Error} - Throws an error if the OpenAI client is not initialized.
     */
    public async doChat(prompt: ChatRequestMessage[]):Promise<string | undefined>{

        this._messages= [];

        //populate the options from settings
        const options = {
            temperature: this._settings.temperature,
            maxTokens: this._settings.maxTokens,
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
                this._authHelper.secrets.aoaiDeployment!,
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