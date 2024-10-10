/**
 * Represents the options for configuring the Azure OpenAI model.
 *
 * @property {string} [model] - The identifier of the model to use.
 * @property {number} [maxTokens] - The maximum number of tokens to generate.
 * @property {number} [temperature] - The sampling temperature to use, ranging from 0 to 1.
 */
export type AOAIOptions = { model?: string; maxTokens?: number; temperature?: number };

/**
 * Represents the secrets required to access an Azure OpenAI endpoint.
 *
 */
export class AOAIEndpointSecrets {
  /**
   * The endpoint URL for the Azure OpenAI service.
   */
  public aoaiEndpoint: string;

  /**
   * The API key for authenticating with the Azure OpenAI service.
   */
  public aoaiKey: string;

  /**
   * The deployment name or ID for the Azure OpenAI service.
   */
  public aoaiDeployment: string;

  /**
   * The apiVersion for the Azure OpenAI service.
   */
  public aoaiapiVersion: string;

  /**
   * Constructs a new instance of the class and initializes the properties
   * `aoaiEndpoint`, `aoaiKey`, `aoaiDeployment`, and `apiVersion`.
   *
   * @constructor
   */
  constructor() {
    this.aoaiEndpoint = "";
    this.aoaiKey = "";
    this.aoaiDeployment = "";
    this.aoaiapiVersion = "2024-04-01-preview";
  }
}
