import { AzureOpenAI, AzureClientOptions } from "openai";
import { AOAIEndpointSecrets, AOAIOptions } from "./AOAITypes";
import ChatCompletionsAPI from "openai";

/**
 * A helper class for interacting with the Azure OpenAI service.
 * This class follows the singleton pattern to ensure only one instance is created.
 */
export class AOAIHelper {
  private static instance: AOAIHelper;
  private _openai: AzureOpenAI;
  private _tokenCount: number = 0;

  public get tokenCount(): number {
    return this._tokenCount;
  }

  /**
   * Constructs an instance of AOAIHelper.
   *
   * @param aoaiEndpointConfig - The configuration for the AOAI endpoint. This parameter cannot be null or undefined.
   * @param options - Additional options for the AOAIHelper instance.
   *
   * @throws {Error} If the aoaiEndpointConfig is null or undefined.
   */
  private constructor(public aoaiEndpointConfig: AOAIEndpointSecrets, public options: AOAIOptions) {
    if (!aoaiEndpointConfig) {
      throw new Error("AOAI Endpoint Config cannot be null or undefined.");
    }
    this.aoaiEndpointConfig = aoaiEndpointConfig;
    this.options = options;
    const opts: AzureClientOptions = {
      deployment: this.aoaiEndpointConfig.aoaiDeployment,
      apiVersion: this.aoaiEndpointConfig.aoaiapiVersion,
      apiKey: this.aoaiEndpointConfig.aoaiKey,
      endpoint: this.aoaiEndpointConfig.aoaiEndpoint,
    };
    this._openai = new AzureOpenAI(opts);
  }

  /**
   * Retrieves an instance of `AOAIHelper`. If `aoaiEndpointConfig` is provided, it attempts to create a new instance
   * and connect to AOAI using the provided configuration. If the connection is successful, the instance is stored
   * and returned. If the connection fails, an error is thrown. If `aoaiEndpointConfig` is not provided, it returns
   * the existing instance if available, otherwise throws an error indicating that the instance is not initialized.
   *
   * @param aoaiEndpointConfig - Optional configuration for the AOAI endpoint.
   * @param options - Optional settings for the AOAI instance.
   * @returns A promise that resolves to an instance of `AOAIHelper`.
   * @throws Will throw an error if the connection to AOAI fails or if the instance is not initialized when `aoaiEndpointConfig` is not provided.
   */
  public static async getInstance(aoaiEndpointConfig?: AOAIEndpointSecrets, options?: AOAIOptions): Promise<AOAIHelper> {
    if (aoaiEndpointConfig) {
      const tmp = new AOAIHelper(aoaiEndpointConfig, options || this.instance?.options || {});

      const result = await tmp.connectAOAI();
      if (result) {
        this.instance = tmp;
      } else {
        throw new Error(
          `Could not connect to AOAI using endpoint:${aoaiEndpointConfig.aoaiEndpoint} and deployment:${aoaiEndpointConfig.aoaiDeployment}. Please verify KeyVault settings for API key, endpoint, and deployment name.`
        );
      }
      return tmp;
    } else {
      if (!this.instance) {
        throw new Error("Instance not initialized. Please provide aoaiEndpointConfig to initialize.");
      }
      if (options) {
        this.instance.options = options;
      }
      return this.instance;
    }
  }

  /**
   * Connects to the Azure OpenAI Interface (AOAI) and performs a test chat to verify the connection.
   *
   * @returns {Promise<boolean>} - A promise that resolves to `true` if the connection is successful.
   *
   * @throws {Error} - Throws an error if the endpoint or options are null or undefined, or if the connection fails.
   * The error message will include details about the endpoint and deployment configuration.
   */
  private async connectAOAI(): Promise<boolean> {
    if (!this.aoaiEndpointConfig || !this.options) {
      throw new Error("Endpoint and Options cannot be null or undefined.");
    }

    try {
      const testMessage: ChatCompletionsAPI.ChatCompletionMessageParam = { role: "user", content: "Say hello!" };
      const result = await this.doChat([testMessage]);
      console.log(`aiaogpt: [Success] Test chat successful: '${result}'`);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Could not connect to AOAI using endpoint: ${this.aoaiEndpointConfig.aoaiEndpoint} and deployment: ${this.aoaiEndpointConfig.aoaiDeployment}. Please verify KeyVault settings for API key, endpoint, and deployment name. Message: ${errorMessage}`
      );
    }
  }

  /**
   * Creates a prompt for a chat completion API by constructing a series of messages
   * including system, user, and assistant roles.
   *
   * @param systemPrompt - The initial system message to set the context for the chat.
   * @param question - The question or task to be included in the user message.
   * @param selection - Optional. A code selection or additional context to include in the user message.
   * @param putSelectedInsideCodeBlock - Optional. Defaults to false. If true, wraps the selection inside a code block.
   * @returns An array of chat completion message parameters to be used with the chat completion API.
   */
  public createCodePrompt(systemPrompt: string, question: string, selection?: string, putSelectedInsideCodeBlock: boolean = false): ChatCompletionsAPI.Chat.Completions.ChatCompletionMessageParam[] {
    const chatMessageBuffer: ChatCompletionsAPI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Construct the user prompt
    const userPrompt = selection ? `${question}\n${putSelectedInsideCodeBlock ? `\`\`\`\n${selection}\n\`\`\`` : selection}` : question;

    // Add system message
    chatMessageBuffer.push({
      role: "system",
      content: systemPrompt.trim(),
    });

    // Add user message
    chatMessageBuffer.push({
      role: "user",
      content: userPrompt.trim(),
    });

    // Add assistant's initial placeholder response
    chatMessageBuffer.push({
      role: "assistant",
      content: "...",
    });

    return chatMessageBuffer;
  }

  /**
   * Sends a chat prompt to the OpenAI API and returns the response.
   *
   * @param prompt - An array of chat completion message parameters to send to the OpenAI API.
   * @returns A promise that resolves to the response string from the OpenAI API.
   * @throws Will throw an error if the OpenAI client is not initialized or if there is an issue with the API request.
   */
  public async doChat(prompt: ChatCompletionsAPI.Chat.Completions.ChatCompletionMessageParam[]): Promise<string> {
    if (!this._openai) {
      throw new Error("OpenAI client is not initialized.");
    }

    try {
      const result = await this._openai.chat.completions.create({
        model: this.aoaiEndpointConfig.aoaiDeployment,
        messages: prompt,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        max_tokens: this.options.maxTokens,
        temperature: this.options.temperature,
        stop: ["\nUSER: ", "\nUSER", "\nASSISTANT"],
      });

      console.log(result.usage?.total_tokens);
      this._tokenCount += result.usage?.total_tokens!;
      return result.choices[0].message?.content || "";
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      throw new Error(`Could not get chat completions from AOAI. Message: ${errorMessage}`);
    }
  }
}
