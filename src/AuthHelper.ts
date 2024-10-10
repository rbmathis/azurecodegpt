import { AzureCliCredential, AccessToken } from "@azure/identity";

/**
 * A helper class for authentication-related operations.
 */
export class AuthHelper {
  /**
   * Ensures that a token is obtained for the current user using the Azure CLI credential.
   * This method will throw an error if the user is not logged in via the Azure CLI.
   *
   * @param cliCredential - The Azure CLI credential to use for obtaining the token.
   * @param azuregraphEndpoint - The endpoint for the Azure Graph API.
   * @returns A promise that resolves to an AccessToken for the current user.
   */
  public static async ensureCliCredential(cliCredential: AzureCliCredential, azuregraphEndpoint: string): Promise<AccessToken> {
    return await cliCredential.getToken(azuregraphEndpoint);
  }
}
