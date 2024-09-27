import { AzureCliCredential,AccessToken } from "@azure/identity";

export class AuthHelper
{
    //get token for current user. This will show an error if the user is not logged in via the Azure CLI
    public static async ensureCliCredential(cliCredential: AzureCliCredential, azuregraphEndpoint:string): Promise<AccessToken> {

        return await cliCredential.getToken(azuregraphEndpoint);

        // let _token;
        
        // try{
        //     _token = await cliCredential.getToken(azuregraphEndpoint);
        // }
        // catch (e:any) {
        //     throw new Error(`Failed to acquire access token: ${e.message}`);
        // }

        // if (!_token) {
        //     throw new Error("Failed to acquire access token");
        // }
        // return _token;
    }
}