import { AccessToken, AzureCliCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { AuthHelper } from "./AuthHelper";

/**
 * A helper class for interacting with the Azure KeyVault service.
 * This class follows the singleton pattern to ensure only one instance is created.
 */
export class KeyVaultHelper {
  private static instance: KeyVaultHelper;

  /**
   * Constructs an instance of KeyVaultHelper.
   *
   * @param cliCredential - The Azure CLI credential to use for authentication.
   * @param vaultUri - The URI of the Key Vault.
   */
  private constructor(public cliCredential: AzureCliCredential, public vaultUri: string) {
    AuthHelper.ensureCliCredential(cliCredential, vaultUri)
      .then((result: AccessToken) => {
        if (!result) {
          throw new Error("Error authenticating.");
        }
      })
      .catch((error: Error) => {
        throw new Error(`Error during authentication: ${error.message}`);
      });
  }

  /**
   * Retrieves an instance of the `KeyVaultHelper` class. If a `cliCredential` and `vaultUri` are provided,
   * it creates a new instance and attempts to connect to KeyVault. If the connection is successful,
   * the new instance is set as the singleton instance. If the connection fails, an error is thrown.
   * If no `cliCredential` or `vaultUri` are provided, the existing singleton instance is returned.
   *
   * @param cliCredential - Optional Azure CLI credential for authentication.
   * @param vaultUri - Optional URI of the Key Vault.
   * @returns The singleton instance of the `KeyVaultHelper` class.
   * @throws Will throw an error if the connection to KeyVault fails.
   */
  public static getInstance(cliCredential?: AzureCliCredential, vaultUri?: string): KeyVaultHelper {
    if (!KeyVaultHelper.instance) {
      if (!cliCredential || !vaultUri) {
        throw new Error("[AzureCliCredential] and [VaultUri] must be provided for the first initialization.");
      }
      KeyVaultHelper.instance = new KeyVaultHelper(cliCredential, vaultUri);
    } else if (cliCredential || vaultUri) {
      KeyVaultHelper.instance = new KeyVaultHelper(cliCredential || KeyVaultHelper.instance.cliCredential, vaultUri ?? KeyVaultHelper.instance.vaultUri);
    }
    return KeyVaultHelper.instance;
  }

  /**
   * Loads a secret from Azure Key Vault.
   *
   * @param name - The name of the secret to load.
   * @returns A promise that resolves to the value of the secret.
   * @throws An error if the secret cannot be loaded from Key Vault.
   */
  public async loadSecret(name: string): Promise<string> {
    const client = new SecretClient(this.vaultUri, this.cliCredential);
    try {
      const { value } = await client.getSecret(name);
      if (!value) {
        throw new Error(`Secret [${name}] has no value.`);
      }
      return value;
    } catch (error: any) {
      throw new Error(`Error loading secret [${name}] from KeyVault [${this.vaultUri}]. Error: ${error.message}`);
    }
  }
}
