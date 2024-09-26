

/**
 * Represents the settings for connecting to Azure services.
 * 
 * @class Settings
 * @property {string} azureCloud - The Azure cloud environment (e.g., "AzureCloud", "AzureUSGovernment").
 * @property {string} keyvaultName - The name of the Azure Key Vault.
 * @property {boolean} [selectedInsideCodeblock] - Optional flag indicating if the selection is inside a code block.
 * @property {boolean} [pasteOnClick] - Optional flag indicating if pasting should occur on click.
 * @property {string} [model] - Optional model name.
 * @property {number} [maxTokens] - Optional maximum number of tokens.
 * @property {number} [temperature] - Optional temperature setting for the model.
 * 
 * @property {boolean} _isValid - Indicates if the settings are valid.
 * @property {string} _graphUri - The URI for the Microsoft Graph API.
 * @property {string} _vaultUri - The URI for the Azure Key Vault.
 * 
 * @property {string} graphUri - Gets the URI for the Microsoft Graph API.
 * @property {string} vaultUri - Gets the URI for the Azure Key Vault.
 * @property {boolean} isValid - Gets the validity status of the settings.
 * 
 * @constructor
 * @param {string} azureCloud - The Azure cloud environment.
 * @param {string} keyvaultName - The name of the Azure Key Vault.
 * @param {boolean} [selectedInsideCodeblock] - Optional flag indicating if the selection is inside a code block.
 * @param {boolean} [pasteOnClick] - Optional flag indicating if pasting should occur on click.
 * @param {string} [model] - Optional model name.
 * @param {number} [maxTokens] - Optional maximum number of tokens.
 * @param {number} [temperature] - Optional temperature setting for the model.
 */
export class Settings  {
    
    // private _isValid: boolean= false;

    private _graphUri: string; 
    private _vaultUri: string;
    
    public get graphUri(): string {
        if(this.azureCloud==="AzureCloud"){
            return "https://graph.microsoft.com/.default";
        }else if(this.azureCloud==="AzureUSGovernment"){
            return "https://graph.microsoft.us/.default";
        }else{
            return "[Error]: Invalid Azure Cloud setting ";
        }
    }
    public get vaultUri(): string {
        if(this.azureCloud==="AzureCloud"){
            return `https://${this.keyvaultName}.vault.azure.net`;
        }else if(this.azureCloud==="AzureUSGovernment"){
            return `https://${this.keyvaultName}.vault.usgovcloudapi.net`;
        }else{
            return "[Error]: Invalid Azure Cloud setting ";
        }
    }
    // public get isValid(): boolean {
    //     return this._isValid;
    // }


    constructor(public azureCloud: string, public keyvaultName: string, public selectedInsideCodeblock?: boolean, public pasteOnClick?: boolean, public model?: string, public maxTokens?: number, public temperature?: number) {

        this._graphUri = "";
        this._vaultUri = "";
        // if(azureCloud==="AzureCloud"){
        //     this._graphUri = "https://graph.microsoft.com/.default";
        //     this._vaultUri = `https://${this.keyvaultName}.vault.azure.net`;
        //     // this._isValid = true;
        // }else if(azureCloud==="AzureUSGovernment"){
        //     this._graphUri = "https://graph.microsoft.us/.default";
        //     this._vaultUri = `https://${this.keyvaultName}.vault.usgovcloudapi.net`;
        //     // this._isValid = true;
        // }else{
        //     this._graphUri = "[Error]: Invalid Azure Cloud setting ";
        //     this._vaultUri = "[Error]: Invalid Azure Cloud setting ";
        //     // this._isValid = false;
        // }
        
    }
};