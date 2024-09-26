import * as vscode from "vscode";
import { AOAIViewProvider } from "./AOAIViewProvider";
import {Settings} from "./Settings";

// This method is called when your extension is activated
/**
 * Activates the Azure Code GPT extension.
 * 
 * @param {vscode.ExtensionContext} context - The context in which the extension is activated.
 * 
 * This function performs the following tasks:
 * - Loads the extension's configuration settings.
 * - Initializes a new instance of the `AOAIViewProvider` class with the configuration settings.
 * - Registers the provider with the extension's context.
 * - Defines and registers command handlers for various commands that can be called from the extension's package.json.
 * - Listens for configuration changes and updates the provider's settings accordingly.
 */
export function activate(context: vscode.ExtensionContext) {

    //startup
    const config = vscode.workspace.getConfiguration("aoaicodegpt");// Load the extension's configuration settings



    /**
     * Initializes a new instance of the `AOAIViewProvider` class.
     * 
     * @param {vscode.Uri} context.extensionUri - The URI of the extension.
     * @param {Object} config - The configuration object.
     * @param {string} config.graphUri - The URI of the graph, defaults to an empty string if not provided.
     * @param {string} config.vaultUri - The URI of the key vault, defaults to an empty string if not provided.
     * @param {boolean} config.selectedInsideCodeblock - Indicates if selection inside code blocks is enabled, defaults to false if not provided.
     * @param {boolean} config.pasteOnClick - Indicates if paste on click is enabled, defaults to false if not provided.
     * @param {number} config.maxTokens - The maximum number of tokens, defaults to 500 if not provided.
     * @param {number} config.temperature - The temperature setting for the model, defaults to 0.5 if not provided.
     * @param {string} config.model - The model to use, defaults to "text-davinci-003" if not provided.
     */
    const provider = new AOAIViewProvider(context.extensionUri,
        new Settings(
            config.get("azureCloud") || "AzureCloud",
            config.get("keyvaultName") || "",
            config.get("selectedInsideCodeblock") || false,
            config.get("pasteOnClick") || false,
            config.get("model") || "gpt-3.5-turbo",
            config.get<number>("maxTokens") || 500,
            config.get<number>("temperature") || 0.5,
            
        )
    );


    // Register the provider with the extension's context
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            AOAIViewProvider.viewType,
            provider,
            {
                webviewOptions: { retainContextWhenHidden: true },
            }
        )
    );


    /**
     * Handles the execution of a given command by retrieving the corresponding prompt
     * from the configuration and running the chat provider with that prompt.
     *
     * @param command - The command string used to fetch the corresponding prompt from the configuration.
     */
    const commandHandler = (command: string) => {
        const config = vscode.workspace.getConfiguration("aoaicodegpt");
        const prompt = config.get(command) as string;
        provider.runChat(prompt);
    };


    // Register the commands that can be called from the extension's package.json
    context.subscriptions.push(
        vscode.commands.registerCommand("aoaicodegpt.ask", () =>
            vscode.window
                .showInputBox({ prompt: "What do you want to do?" })
                .then((value) => provider.runChat(value))
        ),
        vscode.commands.registerCommand("aoaicodegpt.explain", () =>
            commandHandler("promptPrefix.explain")
        ),
        vscode.commands.registerCommand("aoaicodegpt.refactor", () =>
            commandHandler("promptPrefix.refactor")
        ),
        vscode.commands.registerCommand("aoaicodegpt.optimize", () =>
            commandHandler("promptPrefix.optimize")
        ),
        vscode.commands.registerCommand("aoaicodegpt.findProblems", () =>
            commandHandler("promptPrefix.findProblems")
        ),
        vscode.commands.registerCommand("aoaicodegpt.documentation", () =>
            commandHandler("promptPrefix.documentation")
        )
    );


    // Change the extension's settings when configuration is changed
    vscode.workspace.onDidChangeConfiguration(
        (event: vscode.ConfigurationChangeEvent) => {
            let shouldRefreshAPI = false;
            const config = vscode.workspace.getConfiguration("aoaicodegpt");

            
                provider.setSettings(new Settings(
                    config.get("azureCloud") || "AzureCloud",
                    config.get("keyvaultName") || "",
                    config.get("selectedInsideCodeblock") || false,
                    config.get("pasteOnClick") || false,
                    config.get<string>("model") || "gpt-3.5-turbo",
                    config.get<number>("maxTokens") || 500,
                    config.get<number>("temperature") || 0.5,
                ));



            // if (event.affectsConfiguration("aoaicodegpt.azureCloud") || (event.affectsConfiguration("aoaicodegpt.keyvaultName"))){
            //     //provider.resetSession();
            // }
        }
    );
    
}



// This method is called when your extension is deactivated
export function deactivate() {}
