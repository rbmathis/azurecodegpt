import { AzureCliCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";	
import { Settings } from "./Settings";


/**
 * Helper class for handling authentication and fetching secrets from Azure Key Vault.
 * 
 * @remarks
 * This class is implemented as a singleton to ensure only one instance is used throughout the application.
 * It uses Azure CLI credentials to authenticate and fetch secrets from Azure Key Vault.
 * 
 * @example
 * ```typescript
 * const settings = new Settings();
 * const authHelper = AuthHelper.getInstance(settings);
 * await authHelper.authenticate();
 * if (authHelper.hasError) {
 *     console.error(authHelper.messages);
 * } else {
 *     console.log("Authentication successful!");
 * }
 * ```
 */
export class AuthHelper
{
    private static instance: AuthHelper;
    private _settings: Settings;
    private _messages: string[];
    private _hasError: boolean;
    private _isLoaded: boolean = false;
    private _cliCredential: AzureCliCredential;
    
    //THE SECRETS LISTED HERE MUST MATCH THE SECRETS IN THE KEYVAULT
    readonly secrets = {aoaiEndpoint: "AOAIEndpoint", aoaiKey: "AOAIKey", aoaiDeployment: "AOAIDeployment"};

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

    
    /**
     * HIDDEN :Initializes a new instance of the AuthHelper class.
     * 
     * @param settings - The settings object which cannot be null or undefined.
     * @throws {Error} If the settings parameter is null or undefined.
     */
    private constructor(public settings: Settings) {
        if (!settings) {
            throw new Error("Settings cannot be null or undefined.");
        }
        this._settings = settings;
        this._messages = [];
        this._hasError = false;
        this._isLoaded = false;
        this.secrets = {aoaiEndpoint: "AOAIEndpoint", aoaiKey: "AOAIKey", aoaiDeployment: "AOAIDeployment"};
        this._cliCredential = new AzureCliCredential();
    }




    
    /**
     * Retrieves the singleton instance of `AuthHelper`. If the instance does not exist, it initializes it with the provided settings.
     * If the instance already exists and new settings are provided, it updates the instance with the new settings.
     * Ensures that the instance is authenticated before returning it.
     *
     * @param settings - Optional settings for initializing or updating the `AuthHelper` instance.
     * @returns A promise that resolves to the singleton instance of `AuthHelper`, or `undefined` if initialization fails.
     * @throws Error if settings are not provided during the first initialization.
     */
    public static async getInstance(): Promise<AuthHelper | undefined>;
    public static async getInstance(settings: Settings): Promise<AuthHelper | undefined>;
    public static async getInstance(settings?: Settings): Promise<AuthHelper | undefined> {
        if (!AuthHelper.instance) {
            if (!settings) {
                throw new Error("Settings must be provided for the first initialization.");
            } else {
                AuthHelper.instance = new AuthHelper(settings);
            }
        } else {
            if(settings){
                AuthHelper.instance._messages = [];
                AuthHelper.instance._settings = settings;
                AuthHelper.instance._isLoaded = false;
                AuthHelper.instance._hasError = false;
            }
        }
        if(!AuthHelper.instance.isLoaded) {
            await AuthHelper.authenticate();
        }
        return AuthHelper.instance;
    }
   

    /**
     * Authenticates the user by obtaining a token using Azure CLI credentials and fetching secrets from Azure Key Vault.
     * 
     * @returns {Promise<AuthHelper | undefined>} A promise that resolves to the AuthHelper instance if authentication is successful, or undefined if an error occurs.
     * 
     * @remarks
     * - Ensures that the Azure CLI credential is initialized before attempting to authenticate.
     * - Attempts to get a token for the current user using the Azure CLI credential. If the user is not logged in via the Azure CLI, an error message is logged and the method returns early.
     * - Connects to Azure Key Vault using the Azure CLI credential and loads the specified secrets. If an error occurs while fetching secrets, an error message is logged.
     * 
     * @throws {Error} If there is an issue fetching the token or secrets, an error message is logged and the method returns early.
     */
    private static async authenticate(): Promise<AuthHelper | undefined> {

        //clear historical messages
        AuthHelper.instance._messages = [];

        if(! await AuthHelper.instance.ensureCliCredential())
        {
            //unable to get a token, return early
            AuthHelper.instance._hasError = true;
            AuthHelper.instance._messages.push("aoaicodegpt: [Error]- Unable to get a token. Please ensure you are logged in via 'az login' in a terminal prompt.");
            return AuthHelper.instance;
        }
    
        //connect to KeyVault and load settings
        //this simply uses the list of secrets to fetch and assigns them to the class properties
        const client = new SecretClient(AuthHelper.instance._settings.vaultUri, AuthHelper.instance._cliCredential);
            Object.entries(AuthHelper.instance.secrets).forEach(async ([key, value]) => {
                const secretKey = key as keyof typeof AuthHelper.instance.secrets;
                try{
                    const secret = await client.getSecret(secretKey);
                    AuthHelper.instance.secrets[secretKey] = secret.value!;
                    AuthHelper.instance.messages.push('aoaicodegpt: [Success] - Fetched ['+secretKey+'] successfully.');
                }
                catch (e) {
                    AuthHelper.instance._hasError = true;
                    AuthHelper.instance._messages.push('aoaicodegpt: [Error]- Fetching ['+secretKey+'] from Key Vault ['+AuthHelper.instance._settings.vaultUri+']. Message: '+(e instanceof Error ? e.message : String(e)));
                    return AuthHelper.instance;
                } 
            });
  
        AuthHelper.instance._isLoaded = true;
        return AuthHelper.instance;
    }


    /**
     * Ensures that the Azure CLI Credential is initialized and attempts to fetch a token for the current user.
     * 
     * @returns {Promise<boolean>} - A promise that resolves to `true` if the credential is successfully initialized and a token is fetched, otherwise `false`.
     * 
     * @remarks
     * - If the Azure CLI Credential is not initialized, an error message is logged and the function returns `false`.
     * - If there is an error fetching the token (e.g., the user is not logged in via the Azure CLI), an error message is logged and the function returns `false`.
     * - On successful token retrieval, a success message is logged.
     * 
     * @throws {Error} - If an error occurs while fetching the token, the error message is logged.
     */
    private async ensureCliCredential(): Promise<boolean> {
        //ensure we have a token to use
        if (!this._cliCredential) {
            this._hasError = true;
            this._messages.push("aoaicodegpt: [Error]- Azure CLI Credential is not initialized.");
            return false;
        }
        //get token for current user. This will show an error if the user is not logged in via the Azure CLI
        try{
            let x = await this._cliCredential.getToken(this.settings.graphUri);
            this.messages.push('aoaicodegpt: [Success] - Granted credential from [az login].');
        }
        catch (e) {
            this._hasError = true;
            this._messages.push("aoaicodegpt: [Error]- Fetching token for the current user. Are you sure you've signed in through 'az login' via a terminal prompt?  Error: " + (e instanceof Error ? e.message : String(e)));
            return false;//quick exit if we can't get the token
        }

        return true;
    }

}
