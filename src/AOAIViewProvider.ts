import * as vscode from "vscode";
import {
    OpenAIClient,
    AzureKeyCredential,
    ChatRequestMessage,
} from "@azure/openai";
import { AzureCliCredential } from "@azure/identity";
import { AuthInfo, AuthHelper } from "./AuthHelper";
import { Settings } from "./Settings";
import { PromptHelper } from "./PromptHelper";
import { ensureCodeBlocks } from "./Helpers";

export class AOAIViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "azurecodegpt-auth.chatView";
    private _view?: vscode.WebviewView;

    private _openai?: OpenAIClient;

    private _response?: string;
    private _prompt?: string;
    private _fullPrompt?: ChatRequestMessage[];
    private _currentMessageNumber = 0;

    private credential = new AzureCliCredential();

    private _settings: Settings = {
        graphUri: "",
        vaultUri: "",
        selectedInsideCodeblock: false,
        pasteOnClick: true,
        maxTokens: 500,
        temperature: 0.5,
    };

    private authInfo?: AuthInfo;


    // In the constructor, we store the URI of the extension
    constructor(private readonly _extensionUri: vscode.Uri) {    }


    // Merge settings from current configuration with new settings
    public async setSettings(settings: Settings) {
        this._settings = { ...this._settings, ...settings };

        //connect to Azure OpenAI API using the new settings
        await this._connectToAzureOpenAPI(this.authInfo);
    }

    // Return the current settings
    public getSettings() {
        return this._settings;
    }

    // Connect to Azure OpenAI API
    private async _connectToAzureOpenAPI(authInfo?: AuthInfo) {

        //ensure authentication info is loaded
        if((!this.authInfo) || (this.authInfo.hasError)) {
            this.authInfo = await AuthHelper.authenticate(this._settings);
        }

        //check for errors
        if (this.authInfo?.hasError) {
            // this.authInfo = undefined;
            vscode.window.showErrorMessage(this.authInfo!.messages.join("\n"));
            return;
        }
        else {
            vscode.window.showInformationMessage(this.authInfo!.messages.join("\n"));
        }


        try{
            //connect to AOAI and run a simple test
            this._openai = new OpenAIClient(
                this.authInfo!.aoaiEndpoint!,
                new AzureKeyCredential(this.authInfo!.aoaiKey!)
            );

            await this._openai.getChatCompletions(this.authInfo!.aoaiDeployment!, [
                { role: "user", content: "Hello, are you there?" },
            ]);

            vscode.window.showInformationMessage("azurecodegpt-auth: [Success] connected to Azure OpenAI API.");

        } catch (err) {
            vscode.window.showErrorMessage("azurecodegpt-auth: [Error] - Could not connect to Azure OpenAI API. Please check your API key, endpoint, and deployment name. Message: " + (err instanceof Error ? err.message : String(err)));
        }
        
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
        await this._connectToAzureOpenAPI();
    }


    public async runChat(prompt?: string) {
        this._prompt = prompt;
        if (!prompt) {
            return;
        }

        // Check if the ChatGPTAPI instance is defined
        if (!this._openai) {
            await this._connectToAzureOpenAPI(this.authInfo);
        }

        // focus gpt activity from activity bar
        if (!this._view) {
            await vscode.commands.executeCommand("azurecodegpt-auth.chatView.focus");
        } else {
            this._view?.show?.(true);
        }

        let response = "";
        this._response = "";

        // Get the selected text of the active editor
        const selection = vscode.window.activeTextEditor?.selection;
        const selectedText = vscode.window.activeTextEditor?.document.getText(selection);

        //Create a prompt to send to the OpenAI API
        let searchPrompt = PromptHelper.createPrompt(prompt, this._settings, selectedText);
        this._fullPrompt = searchPrompt;

        if (!this._openai) {
            response = "[ERROR] API key, endpoint or model not set, please go to extension settings to set it (read README.md for more info)";
        } else {
            // If successfully signed in
            console.log("sendMessage");

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

            try {
                let currentMessageNumber = this._currentMessageNumber;

                //populate the options from settings
                const options = {
                    temperature: this._settings.temperature,
                    maxTokens: this._settings.maxTokens,
                    topP: 1.0,
                    frequencyPenalty: 1,
                    presencePenalty: 1,
                    stop: ["\nUSER: ", "\nUSER", "\nASSISTANT"],
                };

                //dunno what this is, so commenting it for now
                // if (this._currentMessageNumber !== currentMessageNumber) {
                //     return;
                // }
                
                //send the prompts to the AOAI endpoint
                let completion;
                completion = await this._openai.getChatCompletions(
                    this.authInfo?.aoaiDeployment!,
                    searchPrompt,
                    options
                );

                //grab the response from AOAI
                response = completion.choices[0].message?.content || "";
                response = ensureCodeBlocks(response);//fixup incomplete codeblocks that might be returned

            } catch (error: any) {
                let e = "";
                if (error.response) {
                    e = `${error.response.status} ${error.response.data.message}`;
                } else {
                    e = error.message;
                }
                vscode.window.showErrorMessage("azurecodegpt-auth: [Error] - Chat failed. Message: " + e);
                response += `\n\n---\n[ERROR] ${e}`;
            }
        }

        // Saves the response
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