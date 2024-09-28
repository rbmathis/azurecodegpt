export type AOAIOptions = {model?: string, maxTokens?: number, temperature?: number};

export class AOAIEndpointSecrets {
    public aoaiEndpoint: string;
    public aoaiKey: string;
    public aoaiDeployment: string;

    constructor()
    {
        this.aoaiEndpoint = "";
        this.aoaiKey = "";
        this.aoaiDeployment = "";
    }
}