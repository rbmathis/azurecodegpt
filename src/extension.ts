import * as vscode from "vscode";
import { CodeGPTViewProvider } from "./CodeGPTViewProvider";

export function activate(context: vscode.ExtensionContext) {

    //startup
    const provider = new CodeGPTViewProvider(context.extensionUri);// Create a new CodeGPTViewProvider instance and register it with the extension's context
    const config = vscode.workspace.getConfiguration("azurecodegpt-auth");// Load the extension's configuration settings


    // Initialize the authentication
    provider.setAuthenticationInfo({
        graphUri: config.get("graphUri") || "",
        vaultUri: config.get("keyvaultUri") || "",
    });

    // Initialize the settings 
    provider.setSettings({
        selectedInsideCodeblock: config.get("selectedInsideCodeblock") || false,
        pasteOnClick: config.get("pasteOnClick") || false,
        maxTokens: config.get("maxTokens") || 500,
        temperature: config.get("temperature") || 0.5,
        model: config.get("model") || "text-davinci-003",
    });

    // Register the provider with the extension's context
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            CodeGPTViewProvider.viewType,
            provider,
            {
                webviewOptions: { retainContextWhenHidden: true },
            }
        )
    );


    // Define the command handler
    const commandHandler = (command: string) => {
        const config = vscode.workspace.getConfiguration("azurecodegpt-auth");
        const prompt = config.get(command) as string;
        provider.search(prompt);
    };






    // Register the commands that can be called from the extension's package.json
    context.subscriptions.push(
        vscode.commands.registerCommand("azurecodegpt-auth.ask", () =>
            vscode.window
                .showInputBox({ prompt: "What do you want to do?" })
                .then((value) => provider.search(value))
        ),
        vscode.commands.registerCommand("azurecodegpt-auth.explain", () =>
            commandHandler("promptPrefix.explain")
        ),
        vscode.commands.registerCommand("azurecodegpt-auth.refactor", () =>
            commandHandler("promptPrefix.refactor")
        ),
        vscode.commands.registerCommand("azurecodegpt-auth.optimize", () =>
            commandHandler("promptPrefix.optimize")
        ),
        vscode.commands.registerCommand("azurecodegpt-auth.findProblems", () =>
            commandHandler("promptPrefix.findProblems")
        ),
        vscode.commands.registerCommand("azurecodegpt-auth.documentation", () =>
            commandHandler("promptPrefix.documentation")
        )
    );






    // Change the extension's settings when configuration is changed
    vscode.workspace.onDidChangeConfiguration(
        (event: vscode.ConfigurationChangeEvent) => {
            let shouldRefreshAPI = false;
            if (
                event.affectsConfiguration("azurecodegpt-auth.selectedInsideCodeblock")
            ) {
                const config = vscode.workspace.getConfiguration("azurecodegpt-auth");
                provider.setSettings({
                    selectedInsideCodeblock:
                        config.get("selectedInsideCodeblock") || false,
                });
            } else if (event.affectsConfiguration("azurecodegpt-auth.pasteOnClick")) {
                const config = vscode.workspace.getConfiguration("azurecodegpt-auth");
                provider.setSettings({
                    pasteOnClick: config.get("pasteOnClick") || false,
                });
            } else if (event.affectsConfiguration("azurecodegpt-auth.maxTokens")) {
                const config = vscode.workspace.getConfiguration("azurecodegpt-auth");
                provider.setSettings({
                    maxTokens: config.get("maxTokens") || 500,
                });
            } else if (event.affectsConfiguration("azurecodegpt-auth.temperature")) {
                const config = vscode.workspace.getConfiguration("azurecodegpt-auth");
                provider.setSettings({
                    temperature: config.get("temperature") || 0.5,
                });
            } else if (event.affectsConfiguration("azurecodegpt-auth.model")) {
                const config = vscode.workspace.getConfiguration("azurecodegpt-auth");
                provider.setSettings({
                    model: config.get("model") || "text-davinci-003",
                });
            } else if (event.affectsConfiguration("azurecodegpt-auth.graphUri")) {
                const config = vscode.workspace.getConfiguration("azurecodegpt-auth");
                provider.setAuthenticationInfo({
                    graphUri: config.get("graphUri") || "",
                    vaultUri: config.get("keyvaultUri") || "",
                });
                shouldRefreshAPI = true;
            } else if (event.affectsConfiguration("azurecodegpt-auth.keyvaultUri")) {
                const config = vscode.workspace.getConfiguration("azurecodegpt-auth");
                provider.setAuthenticationInfo({
                    graphUri: config.get("graphUri") || "",
                    vaultUri: config.get("keyvaultUri") || "",
                });
                shouldRefreshAPI = true;
            }
            
            if (shouldRefreshAPI) {
                provider.resetSession();
            }
        }
    );
}



// This method is called when your extension is deactivated
export function deactivate() {}
