
/**
 * Represents the settings for this extension, including Azure cloud environment and Key Vault configuration.
 */
export class ExtensionSettings  {
    
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
        if(this.azureCloud==="AzureCloud"){
            return "https://graph.microsoft.com/.default";
        }else if(this.azureCloud==="AzureUSGovernment"){
            return "https://graph.microsoft.us/.default";
        }else{
            return "[Error]: Invalid Azure Cloud setting ";
        }
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
        if(this.azureCloud==="AzureCloud"){
            return `https://${this.keyvaultName}.vault.azure.net`;
        }else if(this.azureCloud==="AzureUSGovernment"){
            return `https://${this.keyvaultName}.vault.usgovcloudapi.net`;
        }else{
            return "[Error]: Invalid Azure Cloud setting ";
        }
    }

    /**
     * Constructs an instance of ExtensionSettings.
     * 
     * @param azureCloud - The Azure cloud environment.
     * @param keyvaultName - The name of the Key Vault.
     * @param selectedInsideCodeblock - Optional flag indicating if selection is inside a code block.
     * @param pasteOnClick - Optional flag indicating if paste on click is enabled.
     * @param model - Optional model name.
     * @param maxTokens - Optional maximum number of tokens.
     * @param temperature - Optional temperature setting for the model.
     */
    constructor(public azureCloud: string, public keyvaultName: string, public selectedInsideCodeblock?: boolean, public pasteOnClick?: boolean, public model?: string, public maxTokens?: number, public temperature?: number) {

    }
};