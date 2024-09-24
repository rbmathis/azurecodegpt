import * as vscode from "vscode";
import {
    OpenAIClient,
    AzureKeyCredential,
    ChatRequestMessage,
} from "@azure/openai";
import { SecretClient } from "@azure/keyvault-secrets";	
import { AzureCliCredential } from "@azure/identity";
import { AuthInfo, Settings } from "./Helpers";
import createPrompt from "./prompt";

export class CodeGPTViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "azurecodegpt-auth.chatView";
    private _view?: vscode.WebviewView;

    private _openai?: OpenAIClient;

    private _response?: string;
    private _prompt?: string;
    private _fullPrompt?: ChatRequestMessage[];
    private _currentMessageNumber = 0;

    private credential = new AzureCliCredential();

    private _settings: Settings = {
        selectedInsideCodeblock: false,
        pasteOnClick: true,
        maxTokens: 500,
        temperature: 0.5,
    };

    private authInfo?: AuthInfo;


    // In the constructor, we store the URI of the extension
    constructor(private readonly _extensionUri: vscode.Uri) {
        //const credential = new AzureCliCredential();   
    }



    // Set the session token and create a new API instance based on this token
    public async setAuthenticationInfo(authInfo: AuthInfo) {
        
        //quick exit if settings are not set
        if(!authInfo.graphUri|| !authInfo.vaultUri) {
            vscode.window.showWarningMessage(
                `azurecodegpt-auth: [Warning] - graphUri and keyvaultUri are requied, but not set. Please go to extension settings to set them (read README.md for more info).`
            );
            return;
        }


        //get token for current user. This will show an error if the user is not logged in via the Azure CLI
        try{
            let x = await this.credential.getToken(authInfo.graphUri);
            //vscode.window.showInformationMessage(x.token);
        }
        catch (e) {
            if (e instanceof Error) {
                vscode.window.showInformationMessage("error fetching token for the current user. Are you sure you've signed in through 'az login' via a terminal prompt?: " + e.message);
            } else {
                vscode.window.showInformationMessage("error fetching token for the current user. Are you sure you've signed in through 'az login' via a terminal prompt?");
            }
            return;
        }



        //connect to KeyVault and get AOAI settings
        const client = new SecretClient(authInfo.vaultUri, this.credential);
        const s1 = "AOAIEndpoint";
        try {
            const secret = await client.getSecret(s1);
            //vscode.window.showInformationMessage("endpoint: "+secret.value);
            authInfo.endpoint = secret.value;
        }
        catch (e) {
            if (e instanceof Error) {
                vscode.window.showInformationMessage("error fetching AOAI endpoint: " + e.message);
            } else {
                vscode.window.showInformationMessage("error fetching AOAI endpoint.");
            }
        }

        const s2 = "AOAIKey";
        try {
            const secret2 = await client.getSecret(s2);
            //vscode.window.showInformationMessage("key: "+secret2.value);
            authInfo.apiKey = secret2.value;
        }
        catch (e) {
            if (e instanceof Error) {
                vscode.window.showInformationMessage("error fetching AOAIKey: " + e.message);
            } else {
                vscode.window.showInformationMessage("error fetching AOAIKey.");
            }
        }

        const s3 = "AOAIDeployment";
        try {
            const secret3 = await client.getSecret(s3);
            //vscode.window.showInformationMessage("deployment: "+secret3.value);
            authInfo.deploymentName = secret3.value;
        }
        catch (e) {
            if (e instanceof Error) {
                vscode.window.showInformationMessage("error fetching AOAI deployment name: " + e.message);
            } else {
                vscode.window.showInformationMessage("error fetching AOAI deployment name.");
            }
        }


        this.authInfo = authInfo;

        await this._newAPI(authInfo);
    }



    public setSettings(settings: Settings) {
        this._settings = { ...this._settings, ...settings };
    }

    public getSettings() {
        return this._settings;
    }
    private async _newAPI(authInfo?: AuthInfo) {

        //quick exit if settings are missing
        if(!authInfo) {
            vscode.window.showInformationMessage("Authentication info is missing. Please ensure the configuration of your KeyVault. ");
            return;
        }

        if(!authInfo.endpoint || !authInfo.apiKey || !authInfo.deploymentName) {
            vscode.window.showErrorMessage(
                "azurecodegpt-auth: [Error] - settings were loaded successfully, but one or more items is blank. Please ensure the configuration of your KeyVault. "
            );
        }
        else{

            try{
                this._openai = new OpenAIClient(
                    authInfo.endpoint,
                    new AzureKeyCredential(authInfo.apiKey)
                );

                await this._openai.getChatCompletions(authInfo.deploymentName, [
                    { role: "user", content: "Hello, are you there?" },
                ]);

                vscode.window.showInformationMessage(
                    "azurecodegpt-auth: Successfully connected to Azure OpenAI API."
                );
            } catch (err) {
                vscode.window.showErrorMessage(
                    "azurecodegpt-auth: [Error] - Could not connect to Azure OpenAI API. Please check your API key, endpoint, and deployment name. Message: " + (err instanceof Error ? err.message : String(err))
                );
            }
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
                    this.search(data.value);
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
        await this._newAPI();
    }

    public async search(prompt?: string) {
        this._prompt = prompt;
        if (!prompt) {
            return;
        }

        // Check if the ChatGPTAPI instance is defined
        if (!this._openai) {
            await this._newAPI(this.authInfo);
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
        const selectedText =
            vscode.window.activeTextEditor?.document.getText(selection);
        let searchPrompt = createPrompt(prompt, this._settings, selectedText);
        this._fullPrompt = searchPrompt;

        if (!this._openai) {
            response =
                "[ERROR] API key, endpoint or model not set, please go to extension settings to set it (read README.md for more info)";
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

                // Send the search prompt to the OpenAI API and store the response

                const options = {
                    temperature: this._settings.temperature,
                    maxTokens: this._settings.maxTokens,
                    topP: 1.0,
                    frequencyPenalty: 1,
                    presencePenalty: 1,
                    stop: ["\nUSER: ", "\nUSER", "\nASSISTANT"],
                };

                let completion;
                if (this._currentMessageNumber !== currentMessageNumber) {
                    return;
                }

                completion = await this._openai.getChatCompletions(
                    this.authInfo?.deploymentName!,
                    searchPrompt,
                    options
                );

                response = completion.choices[0].message?.content || "";

                // close unclosed codeblocks
                // Use a regular expression to find all occurrences of the substring in the string
                const REGEX_CODEBLOCK = new RegExp("```", "g");
                const matches = response.match(REGEX_CODEBLOCK);
                // Return the number of occurrences of the substring in the response, check if even
                const count = matches ? matches.length : 0;
                if (count % 2 !== 0) {
                    //  append ``` to the end to make the last code block complete
                    response += "\n```";
                }

                response += `\n\n---\n`;
            } catch (error: any) {
                let e = "";
                if (error.response) {
                    console.log(error.response.status);
                    console.log(error.response.data);
                    e = `${error.response.status} ${error.response.data.message}`;
                } else {
                    console.log(error.message);
                    e = error.message;
                }
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
                "showdown.min.js"
            )
        );
        const showdownUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                "media",
                "scripts",
                "tailwind.min.js"
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