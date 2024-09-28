import * as vscode from "vscode";
import {
    OpenAIClient,
    ChatRequestMessage,
} from "@azure/openai";
import { AzureCliCredential } from "@azure/identity";
import { KeyVaultHelper } from "./KeyVaultHelper";
import { AOAIHelper } from "./AOAIHelper";
import { Settings } from "./Settings";
import { ensureCodeBlocks } from "./Helpers";
import { AOAIEndpointSecrets, AOAIOptions } from "./AOAITypes";


export class AOAIViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "aoaicodegpt.chatView";
    private _view?: vscode.WebviewView;
    private _response?: string;
    private _prompt?: string;
    private _fullPrompt?: ChatRequestMessage[];
    private _currentMessageNumber = 0;
    private credential = new AzureCliCredential();
    private _settings: Settings;
    private _kv?: KeyVaultHelper;
    private _aoai?: AOAIHelper;

    

    constructor(private readonly _extensionUri: vscode.Uri, settings:Settings) {  
        
        this._settings = settings;

        //ensure settings are configured
        if ((!settings) || (!settings.azureCloud) || (!settings.keyvaultName)) {
            vscode.window.showErrorMessage("aoaicodegpt: [Error] - Settings must be configured for [azureCloud] and [keyvaultName].");
            return;
        }

    }


    public async setSettings(settings: Settings) {
        this._settings = settings;
        this.connectToAzureAOAI();
    }



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


    public getSettings() {
        return this._settings;
    }



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


    public async resetSession() {
        this._prompt = "";
        this._response = "";
        this._fullPrompt = [];
        this._view?.webview.postMessage({ type: "setPrompt", value: "" });
        this._view?.webview.postMessage({ type: "addResponse", value: "" });
    }


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


        //ensure we have an object
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


        this._response = "";
        let searchPrompt: ChatRequestMessage[] = [];
        searchPrompt = this._aoai.createPrompt(systemPrompt, prompt, selectedText, this._settings.selectedInsideCodeblock);
        this._fullPrompt = searchPrompt;
        

        // Make sure the prompt is shown
        this._view?.webview.postMessage({
            type: "setPrompt",
            value: this._prompt,
        });
        this._view?.webview.postMessage({
            type: "addResponse",
            value: "...",
        });

        // Increment the message number
        this._currentMessageNumber++;

        
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
        
        // Save the response
        this._response = response;

        // Show the view and send a message to the webview with the response
        if (this._view) {
            this._view.show?.(true);
            this._view.webview.postMessage({
                type: "addResponse",
                value: response,
            });
        }
    }


    
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