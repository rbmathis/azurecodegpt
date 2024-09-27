export type Secrets = {aoaiEndpoint: string, aoaiKey: string, aoaiDeployment: string};
export type AOAIOptions = {model?: string, maxTokens?: number, temperature?: number};

const employee: { [key: string]: string | number } = {};
employee.name = 'Alice';
employee.salary = 50000;
console.log(employee);


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