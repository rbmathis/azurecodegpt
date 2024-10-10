/**
 * Represents the settings for this extension, including Azure cloud environment and Key Vault configuration.
 */
export class ExtensionSettings {
  /**
   * Gets the URI for the Microsoft Graph API based on the Azure cloud setting.
   *
   * @returns {string} The Microsoft Graph API URI for the specified Azure cloud.
   *
   * @remarks
   * - If `azureCloud` is "AzureCloud", it returns the URI for the public Azure cloud.
   * - If `azureCloud` is "AzureUSGovernment", it returns the URI for the US Government Azure cloud.
   * - If `azureCloud` has any other value, it returns an error message indicating an invalid Azure Cloud setting.
   */
  public get graphUri(): string {
    const uriMap: { [key: string]: string } = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      AzureCloud: "https://graph.microsoft.com/.default",
      // eslint-disable-next-line @typescript-eslint/naming-convention
      AzureUSGovernment: "https://graph.microsoft.us/.default"
    };

    return uriMap[this.azureCloud] || "[Error]: Invalid Azure Cloud setting";
  }

  /**
   * Gets the URI of the Azure Key Vault based on the specified Azure cloud environment.
   *
   * @returns {string} The URI of the Azure Key Vault. If the Azure cloud environment is not recognized, returns an error message.
   *
   * The URI is constructed as follows:
   * - For `AzureCloud`, the URI is `https://<keyvaultName>.vault.azure.net`
   * - For `AzureUSGovernment`, the URI is `https://<keyvaultName>.vault.usgovcloudapi.net`
   * - For any other value of `azureCloud`, an error message is returned.
   */
  public get vaultUri(): string {
    const uriMap: { [key: string]: string } = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      AzureCloud: `https://${this.keyvaultName}.vault.azure.net`,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      AzureUSGovernment: `https://${this.keyvaultName}.vault.usgovcloudapi.net`
    };

    return uriMap[this.azureCloud] || "[Error]: Invalid Azure Cloud setting";
  }

  /**
   * Initializes a new instance of the ExtensionSettings class with the specified settings.
   *
   * @param azureCloud - The Azure cloud environment.
   * @param keyvaultName - The name of the Azure Key Vault.
   * @param selectedInsideCodeblock - A boolean indicating if the selection is inside a code block.
   * @param pasteOnClick - A boolean indicating if paste on click is enabled.
   * @param maxTokens - The maximum number of tokens.
   * @param temperature - The temperature setting for the model.
   */
  constructor(
    public azureCloud: string,
    public keyvaultName: string,
    public selectedInsideCodeblock: boolean = false,
    public pasteOnClick: boolean = false,
    public maxTokens: number = 0,
    public temperature: number = 0
  ) {}
}
