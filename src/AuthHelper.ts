import { AzureCliCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";	
import { Settings } from "./Settings";

export class AuthHelper
{
    public static async authenticate(settings:Settings): Promise<AuthInfo | undefined> {
        
        let authInfo: AuthInfo = {} as AuthInfo;
        authInfo.messages = [];
        authInfo.cliCredential = new AzureCliCredential();
    
        //get token for current user. This will show an error if the user is not logged in via the Azure CLI
        try{
            let x = await authInfo.cliCredential.getToken(settings.graphUri);
            authInfo.messages.push('azurecodegpt-auth: [Success] - Granted credential from [az login].');
        }
        catch (e) {
            authInfo.hasError = true;
            authInfo.messages.push("azurecodegpt-auth: [Error]- Fetching token for the current user. Are you sure you've signed in through 'az login' via a terminal prompt?  Message: " + (e instanceof Error ? e.message : String(e)));
            return authInfo;//quick exit if we can't get the token
        }

        //list of the secrets to fetch from KeyVault, we do this so that we can loop and fetch all the secrets, then assign them to the authInfo object in a single call
        const secrets = {aoaiEndpoint: "AOAIEndpoint", aoaiKey: "AOAIKey", aoaiDeployment: "AOAIDeployment"};
    
        //connect to KeyVault and get AOAI settings
        const client = new SecretClient(settings.vaultUri, authInfo.cliCredential);
        try{
            for (const property in secrets) {
                const key = property as keyof typeof secrets;
                secrets[key] = (await client.getSecret(secrets[key])).value!;
                authInfo.messages.push('azurecodegpt-auth: [Success] - Fetched ['+key+'] successfully.');
            }
            authInfo = {...authInfo, ...secrets};//merge the secrets into the authInfo object
        }
        catch (e) {
            authInfo.hasError = true;
            authInfo.messages.push("azurecodegpt-auth: [Error]- Fetching values from Key Vault. Message: " + (e instanceof Error ? e.message : String(e)));
        }   
    
        return authInfo;
    }

}

export type AuthInfo = { 
    aoaiKey?: string; 
    aoaiEndpoint?: string; 
    aoaiDeployment?: string ; 
    messages: string[];
    hasError: boolean;
    cliCredential?: AzureCliCredential;
    appInsightsKey?: string;
};