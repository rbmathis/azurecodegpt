import * as vscode from "vscode";
import { AOAIViewProvider } from "./AOAIViewProvider";
import { ExtensionSettings } from "./ExtensionSettings";

/**
 * Activates the AOAI extension.
 *
 * This function is called when the extension is activated. It initializes the extension's configuration,
 * sets up the AOAIViewProvider with the specified settings, registers the provider and commands, and handles
 * configuration changes.
 *
 * @param context - The extension context which contains the extension URI and subscriptions.
 */
export function activate(context: vscode.ExtensionContext) {
  //startup
  const config = vscode.workspace.getConfiguration("aoaicodegpt"); // Load the extension's configuration settings

  /**
   * Initializes a new instance of the AOAIViewProvider with the specified settings.
   *
   * @param context - The extension context which contains the extension URI.
   * @param context.extensionUri - The URI of the extension.
   * @param config - The configuration settings for the provider.
   * @param config.get("azureCloud") - The Azure cloud environment. Defaults to "AzureCloud".
   * @param config.get("keyvaultName") - The name of the Azure Key Vault. Defaults to an empty string.
   * @param config.get("selectedInsideCodeblock") - A boolean indicating if the selection is inside a code block. Defaults to false.
   * @param config.get("pasteOnClick") - A boolean indicating if paste on click is enabled. Defaults to false.
   * @param config.get<number>("maxTokens") - The maximum number of tokens. Defaults to 500.
   * @param config.get<number>("temperature") - The temperature setting for the model. Defaults to 0.5.
   */
  const provider = new AOAIViewProvider(
    context.extensionUri,
    new ExtensionSettings(
      config.get("azureCloud") ?? "AzureCloud",
      config.get("keyvaultName") ?? "",
      config.get("selectedInsideCodeblock") ?? false,
      config.get("pasteOnClick") ?? false,
      config.get<number>("maxTokens") ?? 500,
      config.get<number>("temperature") ?? 0.5
    )
  );

  // Register the provider with the extension's context
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AOAIViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
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
  const commands = [
    { name: "aoaicodegpt.ask", handler: () => vscode.window.showInputBox({ prompt: "What do you want to do?" }).then((value) => provider.runChat(value)) },
    { name: "aoaicodegpt.explain", handler: () => commandHandler("promptPrefix.explain") },
    { name: "aoaicodegpt.refactor", handler: () => commandHandler("promptPrefix.refactor") },
    { name: "aoaicodegpt.findProblems", handler: () => commandHandler("promptPrefix.findProblems") },
    { name: "aoaicodegpt.documentation", handler: () => commandHandler("promptPrefix.documentation") },
    { name: "aoaicodegpt.writetests", handler: () => commandHandler("promptPrefix.writetests") },
  ];

  commands.forEach((command) => {
    context.subscriptions.push(vscode.commands.registerCommand(command.name, command.handler));
  });

  // Change the extension's settings when configuration is changed
  vscode.workspace.onDidChangeConfiguration(() => {
    const config = vscode.workspace.getConfiguration("aoaicodegpt");

    provider.setSettings(
      new ExtensionSettings(
        config.get("azureCloud") ?? "AzureCloud",
        config.get("keyvaultName") ?? "",
        config.get("selectedInsideCodeblock") ?? false,
        config.get("pasteOnClick") ?? false,
        config.get<number>("maxTokens") ?? 500,
        config.get<number>("temperature") ?? 0.5
      )
    );
  });
}
