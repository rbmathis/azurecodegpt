import { AzureCliCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";	
import { AOAIEndpointSecrets } from "./AOAITypes";
import { AuthHelper } from "./AuthHelper";


export class KeyVaultHelper
{
    private static instance: KeyVaultHelper;
    private _messages: string[];
    private _hasError: boolean = false;
    private _isLoaded: boolean = false;
    private _secrets: AOAIEndpointSecrets;
    
    
    /**
     * Gets the list of messages.
     * 
     * @returns {string[]} An array of message strings.
     */
    public get messages(): string[] {
        return this._messages;
    }
    /**
     * Gets a value indicating whether there is an error.
     * 
     * @returns {boolean} True if there is an error; otherwise, false.
     */
    public get hasError(): boolean {
        return this._hasError;
    }    
    /**
     * Gets a value indicating whether the authentication helper is loaded.
     * 
     * @returns {boolean} True if the authentication helper is loaded; otherwise, false.
     */
    public get isLoaded(): boolean {
        return this._isLoaded;
    }
    public get getSecrets(): AOAIEndpointSecrets {
        if(!this._secrets){
            throw new Error("Secrets have not been loaded.");
        }
        else{
            return this._secrets;
        }
    }

    
    private constructor(public cliCredential: AzureCliCredential, public vaultUri: string) {
        this._messages = [];
        this._hasError = false;
        this._isLoaded = false;
        this._secrets = new AOAIEndpointSecrets();

        AuthHelper.ensureCliCredential(cliCredential, vaultUri).then((result: any) => {
            if(!result){
                throw new Error("Error authenticating.");
            }
        });
    }


    public static getInstance(cliCredential?: AzureCliCredential, vaultUri?:string): KeyVaultHelper {

        //no args, so just return the existing instance
        if((!cliCredential)&&(!vaultUri)) {
            if(KeyVaultHelper.instance) {
                return KeyVaultHelper.instance;
            }
            else {
                throw new Error("Credentials and VaultUri must provided for the first initialization.");
            }
        }

        //all new args, so create a new instance
        if ((cliCredential)&&(vaultUri)) {
            KeyVaultHelper.instance = new KeyVaultHelper(cliCredential, vaultUri);
            return KeyVaultHelper.instance;
        }

        //we have only some args, so we need to determine what to do
        if(cliCredential) {//new auth, so recreate the instance
            KeyVaultHelper.instance = new KeyVaultHelper(cliCredential, this.instance.vaultUri);
            return KeyVaultHelper.instance;
        }
        else if(vaultUri) {//new endpoint, so recreate the instance
            KeyVaultHelper.instance = new KeyVaultHelper(this.instance.cliCredential, vaultUri);
            return KeyVaultHelper.instance;
        }
        return KeyVaultHelper.instance;
    }
   

    public async loadSecret(name:string) : Promise<string> {
        const client = new SecretClient(KeyVaultHelper.instance.vaultUri, this.cliCredential);
        let secretValue = "";
        try{
            const secret = await client.getSecret(name);
            secretValue = secret.value!;
            KeyVaultHelper.instance.messages.push('aoaicodegpt: [Success] - Fetched ['+name+'] successfully.');
        }
        catch (e) {
            KeyVaultHelper.instance._hasError = true;
            KeyVaultHelper.instance._messages.push('aoaicodegpt: [Error]- Fetching ['+name+'] from Key Vault ['+KeyVaultHelper.instance.vaultUri+']. Message: '+(e instanceof Error ? e.message : String(e)));
            throw new Error("Error loading secret.");
        }
        return secretValue;
    }


    // public async loadSecrets(secrets: AOAIEndpointSecrets): Promise<AOAIEndpointSecrets> {

    //     const client = new SecretClient(KeyVaultHelper.instance.vaultUri, this.cliCredential);

    //     let z = await this.loadSecret("aoaiEndpoint");
        

    //     //loop through the secrets and fetch them
    //     Object.entries(secrets).forEach(async ([key, value]) => {

    //         const secretKey = key as keyof typeof secrets;

    //         try{
    //             let secretval = await this.loadSecret(secretKey);

    //             secrets[secretKey] = secretval;
    //             KeyVaultHelper.instance.messages.push('aoaicodegpt: [Success] - Fetched ['+secretKey+'] successfully.');
    //         }
    //         catch (e) {
    //             KeyVaultHelper.instance.getSecrets[secretKey] = "";
    //             KeyVaultHelper.instance._hasError = true;
    //             KeyVaultHelper.instance._messages.push('aoaicodegpt: [Error]- Fetching ['+secretKey+'] from Key Vault ['+KeyVaultHelper.instance.vaultUri+']. Message: '+(e instanceof Error ? e.message : String(e)));
    //             throw new Error("Error loading secrets.");
    //         }
    //     });
    //     return secrets;
    // }





    /**
     * Authenticates the user by obtaining a token using Azure CLI credentials and fetching secrets from Azure Key Vault.
     * 
     * @returns {Promise<KeyVaultHelper | undefined>} A promise that resolves to the AuthHelper instance if authentication is successful, or undefined if an error occurs.
     * 
     * @remarks
     * - Ensures that the Azure CLI credential is initialized before attempting to authenticate.
     * - Attempts to get a token for the current user using the Azure CLI credential. If the user is not logged in via the Azure CLI, an error message is logged and the method returns early.
     * - Connects to Azure Key Vault using the Azure CLI credential and loads the specified secrets. If an error occurs while fetching secrets, an error message is logged.
     * 
     * @throws {Error} If there is an issue fetching the token or secrets, an error message is logged and the method returns early.
     */
    private static async authenticate(): Promise<boolean | undefined> {

        // //clear historical messages
        // KeyVaultHelper.instance._messages = [];
        // return await KeyVaultHelper.loadSecrets(KeyVaultHelper.instance.cliCredential);


        // if(! await KeyVaultHelper.loadSecrets(KeyVaultHelper.instance.cliCredential))
        // {
        //     //unable to load secrets, return early
        //     return false;
        // }
    
        //connect to KeyVault and load settings
        //this simply uses the list of secrets to fetch and assigns them to the class properties
        //const client = new SecretClient(KeyVaultHelper.instance._settings.vaultUri, KeyVaultHelper.instance._cliCredential);
            // Object.entries(KeyVaultHelper.instance.secrets).forEach(async ([key, value]) => {
            //     const secretKey = key as keyof typeof KeyVaultHelper.instance.secrets;
            //     try{
            //         const secret = await client.getSecret(secretKey);
            //         KeyVaultHelper.instance.secrets[secretKey] = secret.value!;
            //         KeyVaultHelper.instance.messages.push('aoaicodegpt: [Success] - Fetched ['+secretKey+'] successfully.');
            //     }
            //     catch (e) {
            //         KeyVaultHelper.instance._hasError = true;
            //         KeyVaultHelper.instance._messages.push('aoaicodegpt: [Error]- Fetching ['+secretKey+'] from Key Vault ['+KeyVaultHelper.instance._settings.vaultUri+']. Message: '+(e instanceof Error ? e.message : String(e)));
            //         return KeyVaultHelper.instance;
            //     } 
            // });
        //     await Promise.all(Object.entries(KeyVaultHelper.instance.secrets).map(async ([key, value]) => {
        //         const secretKey = key as keyof typeof KeyVaultHelper.instance.secrets;
        //         try{
        //             const secret = await client.getSecret(secretKey);
        //             KeyVaultHelper.instance.secrets[secretKey] = secret.value!;
        //             KeyVaultHelper.instance.messages.push('aoaicodegpt: [Success] - Fetched ['+secretKey+'] successfully.');
        //         }
        //         catch (e) {
        //             KeyVaultHelper.instance._hasError = true;
        //             KeyVaultHelper.instance._messages.push('aoaicodegpt: [Error]- Fetching ['+secretKey+'] from Key Vault ['+KeyVaultHelper.instance._settings.vaultUri+']. Message: '+(e instanceof Error ? e.message : String(e)));
        //             return KeyVaultHelper.instance;
        //         } 
        //     }));
  
        // KeyVaultHelper.instance._isLoaded = true;
        return true;
    }




}
