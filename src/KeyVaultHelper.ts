import { AzureCliCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";	
import { AuthHelper } from "./AuthHelper";

/**
 * A helper class for interacting with the Azure KeyVault service.
 * This class follows the singleton pattern to ensure only one instance is created.
 */
export class KeyVaultHelper
{
    private static instance: KeyVaultHelper;

    
    /**
     * Constructs an instance of KeyVaultHelper.
     * 
     * @param cliCredential - The Azure CLI credential used for authentication.
     * @param vaultUri - The URI of the Azure Key Vault.
     * 
     * @throws {Error} If authentication fails.
     */
    private constructor(public cliCredential: AzureCliCredential, public vaultUri: string) {

        AuthHelper.ensureCliCredential(cliCredential, vaultUri).then((result: any) => {
            if(!result){
                throw new Error("Error authenticating.");
            }
        });
    }


    /**
     * Retrieves the singleton instance of the KeyVaultHelper class.
     * 
     * This method can be called with or without arguments. If called without arguments,
     * it returns the existing instance if it exists, otherwise it throws an error.
     * If called with both `cliCredential` and `vaultUri`, it creates a new instance.
     * If called with only one of the arguments, it uses the provided argument and the
     * existing value of the other argument to create a new instance.
     * 
     * @param cliCredential - Optional. The Azure CLI credential to use for authentication.
     * @param vaultUri - Optional. The URI of the Key Vault.
     * @returns The singleton instance of the KeyVaultHelper class.
     * @throws {Error} If no arguments are provided and the instance has not been initialized yet.
     */
    public static getInstance(cliCredential?: AzureCliCredential, vaultUri?:string): KeyVaultHelper {

        //no args, so just return the existing instance
        if((!cliCredential)&&(!vaultUri)) {
            if(KeyVaultHelper.instance) {
                return KeyVaultHelper.instance;
            }
            else {
                throw new Error("[AzureCliCredential] and [VaultUri] must provided for the first initialization.");
            }
        }

        //new args, so create a new instance
        else {
            try {
                let tmp = new KeyVaultHelper(cliCredential ? cliCredential : this.instance.cliCredential, vaultUri ? vaultUri :  this.instance.vaultUri);
                KeyVaultHelper.instance = tmp;
            }
            catch (e) {
                throw new Error("Error creating new instance of KeyVaultHelper.");
            }
            
            return KeyVaultHelper.instance;
        }
    }
   

    /**
     * Loads a secret from Azure Key Vault.
     *
     * @param name - The name of the secret to load.
     * @returns A promise that resolves to the value of the secret.
     * @throws An error if the secret cannot be loaded from Key Vault.
     */
    public async loadSecret(name:string) : Promise<string> {
        const client = new SecretClient(this.vaultUri, this.cliCredential);
        let secretValue = "";
        try{
            const secret = await client.getSecret(name);
            secretValue = secret.value!;
        }
        catch (e) {
            throw new Error(`Error loading secret[${name}] from KeyVault [${this.vaultUri}]. `);
        }
        return secretValue;
    }

}
