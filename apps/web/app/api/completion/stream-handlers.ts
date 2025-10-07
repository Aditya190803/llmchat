import { getModelFromChatMode, models } from '@repo/ai/models';
import { getProviderApiKey, ProviderEnumType, Providers } from '@repo/ai/providers';
import { runWorkflow } from '@repo/ai/workflow';

import {
    ChatMode,
    getModelSelectionReason,
    selectGeminiFallback,
    selectModelForQuery,
    selectOpenRouterFallback,
} from '@repo/shared/config';
import { logger } from '@repo/shared/logger';
import { Geo } from '@vercel/functions';
import { CompletionRequestType, StreamController } from './types';
import { sanitizePayloadForJSON } from './utils';

type GuardedStreamController = StreamController & {
    __closed?: boolean;
};

export function sendMessage(
    controller: GuardedStreamController,
    encoder: TextEncoder,
    payload: Record<string, any>
) {
    if (controller.__closed) {
        return;
    }

    try {
        if (payload.content && typeof payload.content === 'string') {
            payload.content = normalizeMarkdownContent(payload.content);
        }

        const sanitizedPayload = sanitizePayloadForJSON(payload);
        const message = `event: ${payload.type}\ndata: ${JSON.stringify(sanitizedPayload)}\n\n`;

        controller.enqueue(encoder.encode(message));
        controller.enqueue(new Uint8Array(0));
    } catch (error) {
        const isControllerClosedError =
            error instanceof TypeError && error.message.toLowerCase().includes('invalid state');

        if (isControllerClosedError) {
            controller.__closed = true;
            return;
        }

        // This is critical - we should log errors in message serialization
        logger.error('Error serializing message payload', error, {
            payloadType: payload.type,
            threadId: payload.threadId,
        });

        const errorMessage = `event: done\ndata: ${JSON.stringify({
            type: 'done',
            status: 'error',
            error: 'Failed to serialize payload',
            threadId: payload.threadId,
            threadItemId: payload.threadItemId,
            parentThreadItemId: payload.parentThreadItemId,
        })}\n\n`;

        try {
            controller.enqueue(encoder.encode(errorMessage));
        } catch (fallbackError) {
            if (
                fallbackError instanceof TypeError &&
                fallbackError.message.toLowerCase().includes('invalid state')
            ) {
                controller.__closed = true;
            } else {
                logger.error('Failed to send serialization error payload', fallbackError);
            }
        }
    }
}

export function normalizeMarkdownContent(content: string): string {
    const normalizedContent = content.replace(/\\n/g, '\n');
    return normalizedContent;
}

const getProviderForMode = (mode: ChatMode): ProviderEnumType | null => {
    try {
        const modelId = getModelFromChatMode(mode);
        const modelConfig = models.find(model => model.id === modelId);
        return (modelConfig?.provider as ProviderEnumType) ?? null;
    } catch (error) {
        logger.warn('Unable to resolve provider for mode', { mode, error });
        return null;
    }
};

const ensureProviderAvailability = (
    mode: ChatMode,
    query: string,
    hasImageAttachment: boolean
): { mode: ChatMode; changed: boolean; message?: string } => {
    const provider = getProviderForMode(mode);
    if (!provider) {
        return { mode, changed: false };
    }

    const hasKey = Boolean(getProviderApiKey(provider));
    if (hasKey) {
        return { mode, changed: false };
    }

    if (provider === Providers.GOOGLE) {
        if (hasImageAttachment) {
            throw new Error(
                'Image questions in Auto mode require a configured GEMINI_API_KEY. Please add your Gemini key or remove the image.'
            );
        }

        const fallbackMode = selectOpenRouterFallback(query);
        const fallbackProvider = getProviderForMode(fallbackMode);

        if (!fallbackProvider || !getProviderApiKey(fallbackProvider)) {
            throw new Error(
                'Auto mode needs at least one provider configured. Please set OPENROUTER_API_KEY to enable OpenRouter models or add a personal key in Settings → API Keys.'
            );
        }

        return {
            mode: fallbackMode,
            changed: true,
            message: 'Fallback to OpenRouter because Gemini API key is missing',
        };
    }

    if (provider === Providers.OPENROUTER) {
    const fallbackMode = selectGeminiFallback(query, hasImageAttachment);
        const fallbackProvider = getProviderForMode(fallbackMode);

        if (!fallbackProvider || !getProviderApiKey(fallbackProvider)) {
            throw new Error(
                'Auto mode needs a Gemini API key when OpenRouter is unavailable. Please set GEMINI_API_KEY or provide a personal key in Settings → API Keys.'
            );
        }

        return {
            mode: fallbackMode,
            changed: true,
            message: 'Fallback to Gemini because OpenRouter API key is missing',
        };
    }

    return { mode, changed: false };
};

export async function executeStream({
    controller,
    encoder,
    data,
    abortController,
    gl,
    userId,
    onFinish,
}: {
    controller: GuardedStreamController;
    encoder: TextEncoder;
    data: CompletionRequestType;
    abortController: AbortController;
    userId?: string;
    gl?: Geo;
    onFinish?: () => Promise<void>;
}): Promise<{ success: boolean } | Response> {
    let resolvedMode = data.mode;
    let modeSelectionReason = data.modeSelectionReason;
    const requestedMode = data.requestedMode ?? data.mode;

    try {
        const { signal } = abortController;

        const latestMessage = Array.isArray(data.messages) ? data.messages[data.messages.length - 1] : undefined;
        const hasImageAttachment = Array.isArray(latestMessage?.content)
            ? (latestMessage.content as Array<{ type?: string }>).some(part => part?.type === 'image')
            : false;

        if (requestedMode === ChatMode.Auto || resolvedMode === ChatMode.Auto) {
            resolvedMode = selectModelForQuery(data.prompt || '', hasImageAttachment);
        }

        let fallbackNote: string | undefined;
        if (requestedMode === ChatMode.Auto) {
            const fallback = ensureProviderAvailability(
                resolvedMode,
                data.prompt || '',
                hasImageAttachment
            );
            if (fallback.changed) {
                resolvedMode = fallback.mode;
                fallbackNote = fallback.message;
            }
        }

        if (fallbackNote) {
            const baseReason = getModelSelectionReason(data.prompt || '', resolvedMode);
            modeSelectionReason = `${baseReason} • ${fallbackNote}`;
        } else if (!modeSelectionReason || requestedMode === ChatMode.Auto) {
            modeSelectionReason = getModelSelectionReason(data.prompt || '', resolvedMode);
        }

    const workflow = runWorkflow({
            mode: resolvedMode,
            question: data.prompt,
            threadId: data.threadId,
            threadItemId: data.threadItemId,
            messages: data.messages,
            customInstructions: data.customInstructions,
            webSearch: data.webSearch || false,
            config: {
                maxIterations: data.maxIterations || 3,
                signal,
            },
            gl,
            mcpConfig: data.mcpConfig || {},
            showSuggestions: data.showSuggestions || false,
            onFinish: onFinish,
            userId,
        });

        workflow.onAll((event, payload) => {
            sendMessage(controller, encoder, {
                type: event,
                threadId: data.threadId,
                threadItemId: data.threadItemId,
                parentThreadItemId: data.parentThreadItemId,
                query: data.prompt,
                mode: resolvedMode,
                requestedMode,
                modeSelectionReason,
                webSearch: data.webSearch || false,
                showSuggestions: data.showSuggestions || false,
                [event]: payload,
            });
        });

        if (process.env.NODE_ENV === 'development') {
            logger.debug('Starting workflow', { threadId: data.threadId });
        }

        await workflow.start('router', {
            question: data.prompt,
        });

        if (process.env.NODE_ENV === 'development') {
            logger.debug('Workflow completed', { threadId: data.threadId });
        }

        console.log('[WORKFLOW SUMMARY]', workflow.getTimingSummary());

        sendMessage(controller, encoder, {
            type: 'done',
            status: 'complete',
            threadId: data.threadId,
            threadItemId: data.threadItemId,
            parentThreadItemId: data.parentThreadItemId,
            mode: resolvedMode,
            requestedMode,
            modeSelectionReason,
        });

        return { success: true };
    } catch (error) {
        if (abortController.signal.aborted) {
            // Aborts are normal user actions, not errors
            if (process.env.NODE_ENV === 'development') {
                logger.debug('Workflow aborted', { threadId: data.threadId });
            }

            sendMessage(controller, encoder, {
                type: 'done',
                status: 'aborted',
                threadId: data.threadId,
                threadItemId: data.threadItemId,
                parentThreadItemId: data.parentThreadItemId,
                mode: resolvedMode,
                requestedMode,
                modeSelectionReason,
            });
        } else {
            // Actual errors during workflow execution are important
            logger.error('Workflow execution error', error, {
                userId,
                threadId: data.threadId,
                mode: resolvedMode,
                requestedMode,
            });

            sendMessage(controller, encoder, {
                type: 'done',
                status: 'error',
                error: error instanceof Error ? error.message : String(error),
                threadId: data.threadId,
                threadItemId: data.threadItemId,
                parentThreadItemId: data.parentThreadItemId,
                mode: resolvedMode,
                requestedMode,
                modeSelectionReason,
            });
        }

        return { success: false };
    }
}
