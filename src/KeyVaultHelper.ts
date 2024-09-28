import { AzureCliCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";	
import { AuthHelper } from "./AuthHelper";


export class KeyVaultHelper
{
    private static instance: KeyVaultHelper;

    
    private constructor(public cliCredential: AzureCliCredential, public vaultUri: string) {

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
        else if ((cliCredential)&&(vaultUri)) {
            KeyVaultHelper.instance = new KeyVaultHelper(cliCredential, vaultUri);
            return KeyVaultHelper.instance;
        }

        //we have only some args, so we need to determine what to do
        else {
            KeyVaultHelper.instance = new KeyVaultHelper(cliCredential ? cliCredential : this.instance.cliCredential, vaultUri ? vaultUri :  this.instance.vaultUri);
            return KeyVaultHelper.instance;
        }
    }
   

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
