export type AuthInfo = { apiKey?: string; endpoint?: string; deploymentName?: string ; graphUri: string; vaultUri: string};

export type Settings = {
    selectedInsideCodeblock?: boolean;
    pasteOnClick?: boolean;
    model?: string;
    maxTokens?: number;
    temperature?: number;
};