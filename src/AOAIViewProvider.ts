import * as vscode from "vscode";
import {
    OpenAIClient,
    ChatRequestMessage,
} from "@azure/openai";
import { AzureCliCredential } from "@azure/identity";
import { KeyVaultHelper } from "./KeyVaultHelper";
import { AOAIHelper } from "./AOAIHelper";
import { ExtensionSettings } from "./ExtensionSettings";
import { ensureCodeBlocks } from "./Helpers";
import { AOAIEndpointSecrets, AOAIOptions } from "./AOAITypes";


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
    private credential = new AzureCliCredential();
    private _settings: ExtensionSettings;
    private _kv?: KeyVaultHelper;
    private _aoai?: AOAIHelper;

    

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
    constructor(private readonly _extensionUri: vscode.Uri, settings:ExtensionSettings) {  
        
        //ensure settings are configured
        this._settings = settings;
        if ((!settings) || (!settings.azureCloud) || (!settings.keyvaultName)) {
            vscode.window.showErrorMessage("aoaicodegpt: [Error] - Settings must be configured for [azureCloud] and [keyvaultName].");
            return;
        }
    }


    /**
     * Sets the extension settings and initiates a connection to Azure AOAI.
     *
     * @param settings - The settings to be applied to the extension.
     * @returns A promise that resolves when the settings have been applied and the connection to Azure AOAI has been initiated.
     */
    public async setSettings(settings: ExtensionSettings) {
        this._settings = settings;
        this.connectToAzureAOAI();
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

            //load secrets from keyvault
            this._kv = KeyVaultHelper.getInstance(this.credential, this._settings.vaultUri)!;
            let secrets = new AOAIEndpointSecrets();
            secrets.aoaiDeployment = await this._kv.loadSecret("aoaiDeployment");
            secrets.aoaiEndpoint = await this._kv.loadSecret("aoaiEndpoint");
            secrets.aoaiKey = await this._kv.loadSecret("aoaiKey");

            //ensure AOAI is govcloud if the setting is set
            if(this._settings.azureCloud === "AzureUSGovernment") {
                if(secrets.aoaiEndpoint.lastIndexOf(".us") === -1) {
                    vscode.window.showErrorMessage("aoaicodegpt: [Error] - The setting for [AzureCloud] is set for AzureUSGoverment, but the AOAI endpoint loaded from KeyVault doesn't appear to be a GovCloud endpoint.  Please check the secrets in KeyVault to ensure the value for [AOAIEndpoint] is configured for a govCloud AOAI endpoint.");
                    return;
                }
            }

            //connect to AOAI
            let options: AOAIOptions = {
                model: this._settings.model,
                maxTokens: this._settings.maxTokens,
                temperature: this._settings.temperature
            };
            this._aoai = AOAIHelper.getInstance(secrets, options);

            vscode.window.showInformationMessage("aoaicodegpt: [Success] - Connected to Azure successfuly and loaded AOAI configuration.");

        }catch(e:any){
            vscode.window.showErrorMessage(`aoaicodegpt: [Error] - Connection to AOAI Failed. Message: ${e.message}`);
        }
    }



    /**
     * Resolves the webview view when it is first created.
     *
     * @param webviewView - The webview view being resolved.
     * @param context - Additional context for the resolve request.
     * @param _token - A cancellation token.
     *
     * This method sets up the webview with the necessary options and HTML content.
     * It also adds an event listener to handle messages received from the webview.
     * 
     * The following message types are handled:
     * - "codeSelected": Inserts the selected code as a snippet into the active text editor if the pasteOnClick setting is enabled.
     * - "prompt": Executes the runChat method with the provided value.
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        // set options for the webview, allow scripts
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        // set the HTML for the webview
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // add an event listener for messages received by the webview
        webviewView.webview.onDidReceiveMessage((data) => {
            switch (data.type) {
                case "codeSelected": {
                    // do nothing if the pasteOnClick option is disabled
                    if (!this._settings.pasteOnClick) {
                        break;
                    }
                    let code = data.value;
                    //code = code.replace(/([^\\])(\$)([^{0-9])/g, "$1\\$$$3");
                    const snippet = new vscode.SnippetString();
                    snippet.appendText(code);
                    // insert the code as a snippet into the active text editor
                    vscode.window.activeTextEditor?.insertSnippet(snippet);
                    break;
                }
                case "prompt": {
                    this.runChat(data.value);
                }
            }
        });
    }


    /**
     * Executes a chat interaction using the provided prompt.
     * 
     * @param prompt - The prompt string to initiate the chat. If not provided, the function exits early.
     * 
     * The function performs the following steps:
     * 1. Sets the prompt and exits if no prompt is provided.
     * 2. Focuses on the chat view if it exists, otherwise executes a command to focus on it.
     * 3. Retrieves the selected text from the active editor.
     * 4. Ensures an Azure OpenAI API object is available, showing an error message if not.
     * 5. Creates a system prompt based on the model settings.
     * 6. Constructs a chat request message array using the system prompt, user prompt, and selected text.
     * 7. Displays the prompt in the chat view.
     * 8. Sends the chat request to the Azure OpenAI API and processes the response.
     * 9. Handles any errors that occur during the chat request, displaying an error message if needed.
     * 10. Displays the chat response in the chat view.
     */
    public async runChat(prompt?: string) {
        
        //quick exit if no prompt
        this._prompt = prompt;
        if (!prompt) {
            return;
        }

        // focus on the chatView
        if (!this._view) {
            await vscode.commands.executeCommand("aoaicodegpt.chatView.focus");
        } else {
            this._view?.show?.(true);
        }

        // Get the selected text of the active editor
        const selection = vscode.window.activeTextEditor?.selection;
        const selectedText = vscode.window.activeTextEditor?.document.getText(selection);


        //ensure we have an AOAI object
        if(!this._aoai) {
            vscode.window.showErrorMessage("aoaicodegpt: [Error] - Azure OpenAI API not connected. Please check your settings.");
            return;
        }

        //create the system prompt to send in advance of the user question
        let systemPrompt = "";
        if (this._settings.model !== "ChatGPT") {
            systemPrompt = `You are ASSISTANT helping the USER with coding. 
    You are intelligent, helpful and an expert developer, who always gives the correct answer and only does what instructed. You always answer truthfully and don't make things up. 
    (When responding to the following prompt, please make sure to properly style your response using Github Flavored Markdown. 
    Use markdown syntax for things like headings, lists, colored text, code blocks, highlights etc. Make sure not to mention markdown or stying in your actual response. 
    Try to write code inside a single code block if possible)
    \n\nUSER: `;
        } else {
            systemPrompt = `You are ChatGPT, a large language model trained by OpenAI. Please answer as concisely as possible for each response, keeping the list items to a minimum. \nUser: `;
        }

        //do the chat
        let searchPrompt: ChatRequestMessage[] = [];
        searchPrompt = this._aoai.createCodePrompt(systemPrompt, prompt, selectedText, this._settings.selectedInsideCodeblock);
       

        // Make sure the prompt is shown
        this._view?.webview.postMessage({
            type: "setPrompt",
            value: this._prompt,
        });
        this._view?.webview.postMessage({
            type: "addResponse",
            value: "...",
        });

        
        let response = "";
        try {
            response = (await this._aoai.doChat(searchPrompt)) || "";
            
            //fixup incomplete codeblocks that might be returned
            response = ensureCodeBlocks(response);

        } catch (error: any) {
            let e = "";
            if (error.response) {
                e = `${error.response.status} ${error.response.data.message}`;
            } else {
                e = error.message;
            }
            vscode.window.showErrorMessage("aoaicodegpt: [Error] - Chat failed. Message: " + e);
            response += `\n\n---\n[ERROR] ${e}`;
        }

        // Show the view and send a message to the webview with the response
        if (this._view) {
            this._view.show?.(true);
            this._view.webview.postMessage({
                type: "addResponse",
                value: response,
            });
        }
    }


    
    /**
     * Generates the HTML content for the webview.
     *
     * This method constructs an HTML string that includes references to various
     * scripts and stylesheets required for the webview. It also sets up the basic
     * structure of the webview's HTML, including an input field and a response
     * container.
     *
     * @param webview - The webview instance for which the HTML content is being generated.
     * @returns A string containing the HTML content for the webview.
     */
    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", "main.js")
        );
        const microlightUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                "media",
                "scripts",
                "microlight.min.js"
            )
        );
        const tailwindUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                "media",
                "scripts",
                "tailwind.min.js"
            )
        );
        const showdownUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                "media",
                "scripts",
                "showdown.min.js"
            )
        );

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
				<input class="h-10 w-full text-white bg-stone-700 p-4 text-sm" placeholder="Ask anything" id="prompt-input" />
				
				<div id="response" class="pt-4 text-sm">
				</div>

				<script src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}