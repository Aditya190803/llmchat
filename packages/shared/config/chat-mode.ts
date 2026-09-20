import { getGatewayModelCreditCost, getGatewayModelDisplayName } from './model-catalog';
/**
 * Named modes are workflows, not models. Everything else the user can pick is a
 * gateway model id, passed through as-is.
 */
export enum ChatMode {
    Deep = 'deep',
}

export const ChatModeConfig: Record<
    ChatMode,
    {
        webSearch: boolean;
        imageUpload: boolean;
        retry: boolean;
        isNew?: boolean;
        isAuthRequired?: boolean;
    }
> = {
    [ChatMode.Deep]: {
        webSearch: false,
        imageUpload: false,
        retry: false,
        isAuthRequired: true,
    },
};

export const CHAT_MODE_CREDIT_COSTS: Record<string, number> = {
    [ChatMode.Deep]: 10,
};

/**
 * Credits for a message: a fixed price for a named mode, otherwise priced by
 * model class and the thinking effort it was set to.
 */
export const getCreditCost = (mode: string): number =>
    CHAT_MODE_CREDIT_COSTS[mode] ?? getGatewayModelCreditCost(mode);

export const getChatModeName = (mode: ChatMode | string) =>
    mode === ChatMode.Deep ? 'Deep Research' : getGatewayModelDisplayName(String(mode));
