import { ChatMode } from '@repo/shared/config';
import { CoreMessage } from 'ai';
import { ProviderEnumType } from './providers';

// All models route through the AI Gateway (OpenAI-compatible).
// Wire IDs below must exist on the gateway for the configured key.
// Verified reachable 2026-09-10 via /v1/models.
export enum ModelEnum {
    GATEWAY_FLASH = 'gemini-2.5-flash-lite',
    GATEWAY_FLASH_LITE = 'gemini-2.5-flash-lite',
    GATEWAY_PRO = 'claude-sonnet-4-6',
    GATEWAY_SONNET = 'claude-sonnet-4-6',
    GATEWAY_OPUS_THINKING = 'claude-opus-4-6-thinking',
    GATEWAY_OSS = 'gpt-oss-120b-medium',
}

export type Model = {
    id: ModelEnum;
    name: string;
    provider: ProviderEnumType;
    maxTokens: number;
    contextWindow: number;
};

export const models: Model[] = [
    {
        id: ModelEnum.GATEWAY_FLASH,
        name: 'Gemini 2.5 Flash Lite',
        provider: 'gateway',
        maxTokens: 16384,
        contextWindow: 16384,
    },
    {
        id: ModelEnum.GATEWAY_FLASH_LITE,
        name: 'Gemini 2.5 Flash Lite',
        provider: 'gateway',
        maxTokens: 16384,
        contextWindow: 16384,
    },
    {
        id: ModelEnum.GATEWAY_PRO,
        name: 'Claude Sonnet 4.6',
        provider: 'gateway',
        maxTokens: 16384,
        contextWindow: 16384,
    },
    {
        id: ModelEnum.GATEWAY_SONNET,
        name: 'Claude Sonnet 4.6',
        provider: 'gateway',
        maxTokens: 16384,
        contextWindow: 16384,
    },
    {
        id: ModelEnum.GATEWAY_OPUS_THINKING,
        name: 'Claude Opus 4.6 Thinking',
        provider: 'gateway',
        maxTokens: 16384,
        contextWindow: 16384,
    },
    {
        id: ModelEnum.GATEWAY_OSS,
        name: 'GPT OSS 120B',
        provider: 'gateway',
        maxTokens: 16384,
        contextWindow: 16384,
    },
];

export const getModelFromChatMode = (mode?: string): string => {
    // Deep Research runs on the strongest model; anything else is already a
    // gateway model id chosen in the composer.
    if (mode === ChatMode.Deep) return ModelEnum.GATEWAY_OPUS_THINKING;
    return mode || ModelEnum.GATEWAY_FLASH_LITE;
};

export const getChatModeMaxTokens = (_mode?: ChatMode | string) => 100000;

export const estimateTokensByWordCount = (text: string): number => {
    // Simple word splitting by whitespace
    const words = text?.trim().split(/\s+/);

    // Using a multiplier of 1.35 tokens per word for English text
    const estimatedTokens = Math.ceil(words.length * 1.35);

    return estimatedTokens;
};

export const estimateTokensForMessages = (messages: CoreMessage[]): number => {
    let totalTokens = 0;

    for (const message of messages) {
        if (typeof message.content === 'string') {
            totalTokens += estimateTokensByWordCount(message.content);
        } else if (Array.isArray(message.content)) {
            for (const part of message.content) {
                if (part.type === 'text') {
                    totalTokens += estimateTokensByWordCount(part.text);
                }
            }
        }
    }

    return totalTokens;
};

export const trimMessageHistoryEstimated = (
    messages: CoreMessage[],
    chatMode: ChatMode | string
) => {
    const maxTokens = getChatModeMaxTokens(chatMode);
    let trimmedMessages = [...messages];

    if (trimmedMessages.length <= 1) {
        const tokenCount = estimateTokensForMessages(trimmedMessages);
        return { trimmedMessages, tokenCount };
    }

    const latestMessage = trimmedMessages.pop()!;

    const messageSizes = trimmedMessages.map(msg => {
        const tokens =
            typeof msg.content === 'string'
                ? estimateTokensByWordCount(msg.content)
                : Array.isArray(msg.content)
                  ? msg.content.reduce(
                        (sum, part) =>
                            part.type === 'text' ? sum + estimateTokensByWordCount(part.text) : sum,
                        0
                    )
                  : 0;
        return { message: msg, tokens };
    });

    let totalTokens = messageSizes.reduce((sum, item) => sum + item.tokens, 0);

    // Count tokens for the latest message
    const latestMessageTokens =
        typeof latestMessage.content === 'string'
            ? estimateTokensByWordCount(latestMessage.content)
            : Array.isArray(latestMessage.content)
              ? latestMessage.content.reduce(
                    (sum, part) =>
                        part.type === 'text' ? sum + estimateTokensByWordCount(part.text) : sum,
                    0
                )
              : 0;

    totalTokens += latestMessageTokens;

    while (totalTokens > maxTokens && messageSizes.length > 0) {
        const removed = messageSizes.shift();
        if (removed) {
            totalTokens -= removed.tokens;
        }
    }

    trimmedMessages = messageSizes.map(item => item.message);
    trimmedMessages.push(latestMessage);

    return { trimmedMessages, tokenCount: totalTokens };
};
