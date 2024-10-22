import * as vscode from "vscode";
import { AzureCliCredential } from "@azure/identity";
import { KeyVaultHelper } from "./KeyVaultHelper";
import { AOAIHelper } from "./AOAIHelper";
import { ExtensionSettings } from "./ExtensionSettings";
import { ensureCodeBlocks } from "./Helpers";
import { AOAIEndpointSecrets, AOAIOptions } from "./AOAITypes";
import ChatCompletionsAPI from "openai";

/**
 * Provides a webview view for the AOAI extension.
 *
 * This class implements the `vscode.WebviewViewProvider` interface to create and manage a webview view
 * for interacting with Azure OpenAI (AOAI) services. It handles the initialization of settings, connection
 * to Azure services, and communication between the webview and the extension.
 */
export class AOAIViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "aoaicodegpt.chatView";
  private _view?: vscode.WebviewView;
  private _prompt?: string;
  private readonly credential = new AzureCliCredential();
  private _settings: ExtensionSettings;
  private _kvHelper?: KeyVaultHelper;
  private _aoaiHelper?: AOAIHelper;

  /**
   * Constructs an instance of AOAIViewProvider.
   *
   * @param _extensionUri - The URI of the extension.
   * @param settings - The settings for the extension.
   *
   * @remarks
   * This constructor ensures that the settings are properly configured.
   * If the settings, azureCloud, or keyvaultName are not provided, an error message is shown.
   */
  constructor(private readonly _extensionUri: vscode.Uri, settings: ExtensionSettings) {
    this.displayResponseInView(`\n\n---\n aoaicodegpt: [Info] - Loading configuration...`);

    //ensure settings are configured
    this._settings = settings;
    if (!settings?.azureCloud || !settings?.keyvaultName) {
      vscode.window.showErrorMessage("aoaicodegpt: [Error] - Settings must be configured for [azureCloud] and [keyvaultName].");
      this.displayResponseInView(`\n\n---\naoaicodegpt: [Error] - Settings must be configured for [azureCloud] and [keyvaultName].`);
    }
  }

  /**
   * Sets the settings for the extension and connects to Azure OpenAI (AOAI) services.
   *
   * @param settings - The settings to apply.
   *
   * @remarks
   * This method validates the settings before applying them and attempts to connect to Azure AOAI.
   * If the settings are invalid or the connection fails, an error message is shown.
   */
  public async setSettings(settings: ExtensionSettings): Promise<void> {
    try {
      // Validate settings before applying them
      this.validateSettings(settings);

      // Apply the settings
      this._settings = settings;

      //show the "connecting" prompt in the webview
      this._view?.webview.postMessage({
        type: "setPrompt",
        value: "Establishing connection to AOAI. Please wait...",
      });

      // Attempt to connect to Azure AOAI
      await this.connectToAzureAOAI();

      //show the "connecting" prompt in the webview
      this._view?.webview.postMessage({
        type: "setPrompt",
        value: "",
      });
    } catch (error) {
      // Handle any errors that occur during the process
      this.handleError(error);
    }
  }

  /**
   * Validates the provided settings.
   *
   * @param settings - The settings to validate.
   * @throws {Error} If the settings are invalid.
   */
  private validateSettings(settings: ExtensionSettings): void {
    if (!settings) {
      throw new Error("Settings cannot be null or undefined.");
    }
    // Add additional validation logic as needed
  }

  /**
   * Connects to Azure OpenAI (AOAI) service by loading secrets from Azure Key Vault,
   * validating the endpoint for government cloud if necessary, and initializing the AOAI helper.
   *
   * @returns {Promise<void>} A promise that resolves when the connection is successful.
   *
   * @throws Will show an error message if the connection to AOAI fails or if the endpoint
   *         is not configured correctly for AzureUSGovernment.
   *
   * @remarks
   * - Loads secrets for AOAI deployment, endpoint, and key from Azure Key Vault.
   * - Ensures the AOAI endpoint is configured for government cloud if the setting is set to AzureUSGovernment.
   * - Initializes the AOAI helper with the loaded secrets and settings.
   * - Displays a success message upon successful connection, or an error message if the connection fails.
   */
  private async connectToAzureAOAI(): Promise<void> {
    try {
      // Load secrets from Key Vault
      this._kvHelper = KeyVaultHelper.getInstance(this.credential, this._settings.vaultUri)!;
      const secrets = await this.loadAOAISecrets();

      // Ensure AOAI endpoint is for govcloud if the setting is set
      if (this._settings.azureCloud === "AzureUSGovernment" && !secrets.aoaiEndpoint.endsWith(".us/") && !secrets.aoaiEndpoint.endsWith(".us")) {
        vscode.window.showErrorMessage(
          "aoaicodegpt: [Error] - The setting for [AzureCloud] is set for AzureUSGovernment, but the AOAI endpoint loaded from KeyVault doesn't appear to be a GovCloud endpoint. Please check the secrets in KeyVault to ensure the value for [AOAIEndpoint] is configured for a govCloud AOAI endpoint."
        );
        return;
      }

      // Connect to AOAI
      const options: AOAIOptions = {
        model: secrets.aoaiDeployment,
        maxTokens: this._settings.maxTokens,
        temperature: this._settings.temperature,
      };
      this._aoaiHelper = await AOAIHelper.getInstance(secrets, options);

      vscode.window.showInformationMessage("aoaicodegpt: [Success] - Connected to Azure successfully and loaded AOAI configuration.");
      this.displayResponseInView(`\n\n---\naoaicodegpt: [Success] - Connected to Azure successfully and loaded AOAI configuration.`);
    } catch (e: any) {
      this.handleError(e);
    }
  }

  /**
   * Loads the secrets required to access the Azure OpenAI endpoint from Azure Key Vault.
   *
   * @returns {Promise<AOAIEndpointSecrets>} A promise that resolves to the secrets required to access the Azure OpenAI endpoint.
   *
   * @throws Will throw an error if the secrets cannot be loaded from Key Vault.
   *
   * @remarks
   * This method loads the secrets all properties of the 'AOAIEndpointSecrets' object from Azure Key Vault.
   */
  private async loadAOAISecrets(): Promise<AOAIEndpointSecrets> {
    const secrets = new AOAIEndpointSecrets();
    const secretKeys = Object.keys(secrets) as (keyof AOAIEndpointSecrets)[];

    const secretValues = await Promise.all(secretKeys.map((key) => this._kvHelper!.loadSecret(key)));

    secretKeys.forEach((key, index) => {
      secrets[key] = secretValues[index];
    });

    return secrets;
  }

  /**
   * Resolves the webview view by setting the options and HTML content.
   *
   * @param webviewView - The webview view to be resolved.
   * @param context - The context for resolving the webview view.
   * @param _token - The cancellation token.
   *
   * @remarks
   * This method sets the options for the webview view, including enabling scripts and setting the local resource roots.
   * It also sets the HTML content for the webview view and adds an event listener for messages received by the webview.
   */
  public resolveWebviewView(webviewView: vscode.WebviewView, _context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken) {
    this._view = webviewView;

    // Set options for the webview, allow scripts
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // Set the HTML for the webview
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Add an event listener for messages received by the webview
    webviewView.webview.onDidReceiveMessage(this.handleWebviewMessage.bind(this));
  }

  /**
   * Handles messages received by the webview.
   *
   * @param data - The data received by the webview.
   *
   * @remarks
   * This method handles messages received by the webview and performs actions based on the message type.
   * The following message types are supported:
   * - codeSelected: Inserts the selected code into the active text editor.
   * - prompt: Executes a chat interaction using the provided prompt.
   */
  private handleWebviewMessage(data: any) {
    switch (data.type) {
      case "codeSelected":
        this.handleCodeSelected(data.value);
        break;
      case "prompt":
        this.runChat(data.value);
        break;
    }
  }

  /**
   * Handles the selected code by inserting it into the active text editor.
   *
   * @param code - The code to be inserted into the active text editor.
   *
   * @remarks
   * This method inserts the code as a snippet into the active text editor if the pasteOnClick option is enabled.
   */
  private handleCodeSelected(code: string) {
    // Do nothing if the pasteOnClick option is disabled
    if (!this._settings.pasteOnClick) {
      return;
    }

    // Insert the code as a snippet into the active text editor
    const snippet = new vscode.SnippetString();
    snippet.appendText(code);
    vscode.window.activeTextEditor?.insertSnippet(snippet);
  }

  /**
   * Runs a chat interaction using the provided prompt.
   *
   * @param prompt - The prompt for the chat interaction.
   *
   * @remarks
   * This method runs a chat interaction using the provided prompt and displays the response in the webview.
   * If the Azure OpenAI API is not connected, an error message is shown.
   */
  public async runChat(prompt?: string) {
    if (!prompt) {
      return;
    }

    this._prompt = prompt;

    if (!this._aoaiHelper) {
      this.connectToAzureAOAI();
      vscode.window.showErrorMessage("aoaicodegpt: [Error] - Azure OpenAI API not connected. Please check your settings.");
      return;
    }

    await this.focusChatView();

    const selectedText = this.getSelectedText();
    const systemPrompt = `You are ChatGPT, a large language model trained by OpenAI to focus on programming languages, syntax and optimization. Please answer as concisely as possible for each response, keeping the list items to a minimum. \nUser: `;
    const searchPrompt = this._aoaiHelper.createCodePrompt(systemPrompt, prompt, selectedText, this._settings.selectedInsideCodeblock);

    this.displayPromptInView();

    try {
      const response = await this.getChatResponse(searchPrompt);
      this.displayResponseInView(response);
    } catch (error: any) {
      this.handleError(error);
    }
  }

  /**
   * Focuses the chat view in the AOAI extension.
   *
   * If the chat view is not already created, it executes the command to focus the chat view.
   * If the chat view is already created, it shows the view.
   *
   * @returns {Promise<void>} A promise that resolves when the chat view is focused or shown.
   */
  private async focusChatView() {
    if (!this._view) {
      await vscode.commands.executeCommand("aoaicodegpt.chatView.focus");
    } else {
      this._view.show?.(true);
    }
  }

  /**
   * Retrieves the currently selected text in the active text editor.
   *
   * @returns {string | undefined} The selected text, or `undefined` if there is no active text editor or no selection.
   */
  private getSelectedText(): string | undefined {
    const selection = vscode.window.activeTextEditor?.selection;
    return vscode.window.activeTextEditor?.document.getText(selection);
  }

  /**
   * Sends messages to the webview to set the prompt and add a placeholder response.
   *
   * This method posts two messages to the webview:
   * 1. A message of type "setPrompt" with the current prompt value.
   * 2. A message of type "addResponse" with a placeholder value ("...").
   *
   * @private
   */
  private displayPromptInView() {
    this._view?.webview.postMessage({
      type: "setPrompt",
      value: this._prompt,
    });
    this._view?.webview.postMessage({
      type: "addResponse",
      value: "...",
    });
  }

  /**
   * Retrieves the response to a chat interaction from the Azure OpenAI API.
   *
   * @param searchPrompt - The prompt for the chat interaction.
   *
   * @returns {Promise<string>} A promise that resolves to the response from the Azure OpenAI API.
   *
   * @throws Will show an error message if the chat interaction fails.
   */
  private async getChatResponse(searchPrompt: ChatCompletionsAPI.Chat.Completions.ChatCompletionMessageParam[]): Promise<string> {
    let response = (await this._aoaiHelper!.doChat(searchPrompt)) || "";
    return ensureCodeBlocks(response);
  }

  /**
   * Displays the response in the webview.
   *
   * @param response - The response to be displayed in the webview.
   *
   * @private
   */
  private displayResponseInView(response: string) {
    this._view?.show?.(true);
    this._view?.webview.postMessage({
      type: "addResponse",
      value: response,
    });
    this._view?.webview.postMessage({
      type: "setTokenCount",
      value: this._aoaiHelper!.tokenCount,
    });
  }

  /**
   * Handles errors that occur during a chat interaction.
   *
   * @param error - The error that occurred during the chat interaction.
   *
   * @private
   */
  private handleError(error: any) {
    const errorMessage = error.response ? `${error.response.status} ${error.response.data.message}` : error.message;
    vscode.window.showErrorMessage("aoaicodegpt: [Error] - Extension error occurred. Message: " + errorMessage);
    this.displayResponseInView(`\n\n---\n[ERROR] ${errorMessage}`);
  }

  /**
   * Generates the HTML content for the webview.
   *
   * @param webview - The webview for which to generate the HTML content.
   *
   * @returns {string} The HTML content for the webview.
   *
   * @private
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const getWebviewUri = (path: string) => webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, ...path.split("/")));

    const scriptUri = getWebviewUri("media/main.js");
    const microlightUri = getWebviewUri("media/scripts/microlight.min.js");
    const tailwindUri = getWebviewUri("media/scripts/tailwind.min.js");
    const showdownUri = getWebviewUri("media/scripts/showdown.min.js");

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <script src="${tailwindUri}"></script>
                <script src="${showdownUri}"></script>
                <script src="${microlightUri}"></script>
                <style>
                .code {
                    white-space: pre;
                }
                p {
                    padding-top: 0.4rem;
                    padding-bottom: 0.4rem;
                }
                /* overrides vscodes style reset, displays as if inside web browser */
                ul, ol {
                    list-style: initial !important;
                    margin-left: 10px !important;
                }
                h1, h2, h3, h4, h5, h6 {
                    font-weight: bold !important;
                }
                </style>
            </head>
            <body>
                <input class="h-10 w-full text-white bg-stone-700 p-4 text-sm" placeholder="ex: Refactor and optimize this code and explain the changes." id="prompt-input" />
                <div id="response" class="pt-4 text-sm">
                </div>
                <div style="display:flex;align-items: flex-end;"> Total Tokens This Session: <span id="token-count" class="text-sm"></span>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
  }
}
