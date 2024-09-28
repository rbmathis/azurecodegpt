export class Settings  {
    
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

    constructor(public azureCloud: string, public keyvaultName: string, public selectedInsideCodeblock?: boolean, public pasteOnClick?: boolean, public model?: string, public maxTokens?: number, public temperature?: number) {

    }
};