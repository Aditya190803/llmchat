import { createOpenAI } from '@ai-sdk/openai';
import { LanguageModelV1 } from '@ai-sdk/provider';
import { LanguageModelV1Middleware, wrapLanguageModel } from 'ai';
import { ModelEnum, models } from './models';

export const Providers = {
    GATEWAY: 'gateway',
} as const;

export type ProviderEnumType = (typeof Providers)[keyof typeof Providers];

export const AI_GATEWAY_BASE_URL =
    process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.adityamer.dev/v1';

const getGatewayApiKey = () => {
    const key = process.env.AI_GATEWAY_API_KEY;
    if (!key) {
        throw new Error('AI_GATEWAY_API_KEY is not configured on the server');
    }
    return key;
};

const gateway = createOpenAI({
    baseURL: AI_GATEWAY_BASE_URL,
    apiKey: getGatewayApiKey(),
});

export const getProviderInstance = (_provider: ProviderEnumType = Providers.GATEWAY) => gateway;

export const getLanguageModel = (m: string, middleware?: LanguageModelV1Middleware) => {
    const model = models.find(item => item.id === m);
    const selectedModel = gateway(model?.id || m || ModelEnum.GATEWAY_FLASH);
    if (middleware) {
        return wrapLanguageModel({ model: selectedModel, middleware }) as LanguageModelV1;
    }
    return selectedModel as LanguageModelV1;
};
