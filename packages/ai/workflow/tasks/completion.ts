import { createTask } from '@repo/orchestrator';
import { isImageGenerationModel } from '@repo/shared/config';
import { getModelFromChatMode, ModelEnum } from '../../models';
import { z } from 'zod';
import { PAGES_AUTO_INSTRUCTION } from '../pages-prompt';
import { WorkflowContextSchema, WorkflowEventSchema } from '../flow';
import {
    ChunkBuffer,
    generateObject,
    generateGatewayImage,
    generateText,
    getHumanizedDate,
    handleError,
} from '../utils';

const MAX_ALLOWED_CUSTOM_INSTRUCTIONS_LENGTH = 6000;

/**
 * One cheap call that answers: does this need the live web, and if so what
 * should we search for? The query is reused so the search step doesn't repeat
 * the work. Failure means "just answer", never a failed message.
 */
const shouldSearchWeb = async (messages: any[]) => {
    try {
        const decision = await generateObject({
            prompt: `Today is ${getHumanizedDate()}.

Decide whether answering the user's latest message requires searching the web.

Search the web when the answer depends on information you cannot know reliably:
current events and news, prices, weather, sports results, schedules, live status,
laws or policies that change, releases and versions, or anything about a specific
company, product, person or place where being out of date would mislead.

Do not search for general knowledge, explanations, reasoning, maths, translation,
coding help, or writing and editing tasks that use only what the user provided.

If searching, also give the search query you would run.`,
            model: ModelEnum.GATEWAY_FLASH,
            messages,
            schema: z.object({
                needsWeb: z.boolean(),
                query: z.string().optional(),
            }),
        });
        return decision ?? null;
    } catch (error) {
        console.error('Web search decision failed', error);
        return null;
    }
};

export const completionTask = createTask<WorkflowEventSchema, WorkflowContextSchema>({
    name: 'completion',
    execute: async ({ events, context, signal, redirectTo }) => {
        if (!context) {
            throw new Error('Context is required but was not provided');
        }

        const customInstructions = context?.get('customInstructions');
        const mode = context.get('mode');
        const webSearch = context.get('webSearch') || false;

        let messages =
            context
                .get('messages')
                ?.filter(
                    message =>
                        (message.role === 'user' || message.role === 'assistant') &&
                        !!message.content
                ) || [];

        console.log('customInstructions', customInstructions);

        if (
            customInstructions &&
            customInstructions?.length < MAX_ALLOWED_CUSTOM_INSTRUCTIONS_LENGTH
        ) {
            messages = [
                {
                    role: 'system',
                    content: `Today is ${getHumanizedDate()}. and current location is ${context.get('gl')?.city}, ${context.get('gl')?.country}. \n\n ${customInstructions}`,
                },
                ...messages,
            ];
        }

        const model = getModelFromChatMode(mode);

        // Web search is no longer a switch the user flips: a pasted link always
        // goes to the web, and otherwise the model decides for itself.
        if (!isImageGenerationModel(model)) {
            if (webSearch) {
                redirectTo('quickSearch');
                return;
            }

            const decision = await shouldSearchWeb(messages);
            if (decision?.needsWeb) {
                if (decision.query) context.update('searchQuery', () => decision.query);
                redirectTo('quickSearch');
                return;
            }
        }

        if (isImageGenerationModel(model)) {
            const imageResult = await generateGatewayImage({
                model,
                prompt: context.get('question') || '',
                messages,
                signal,
            });
            events?.update('answer', current => ({
                ...current,
                text: imageResult.text || 'Generated image.',
                images: imageResult.images,
                status: 'COMPLETED',
            }));
            return;
        }

        let prompt = `You are a helpful assistant that can answer questions and help with tasks.
        Today is ${getHumanizedDate()}.
        ${PAGES_AUTO_INSTRUCTION}
        `;

        const reasoningBuffer = new ChunkBuffer({
            threshold: 200,
            breakOn: ['\n\n'],
            onFlush: (_chunk: string, fullText: string) => {
                events?.update('steps', prev => ({
                    ...prev,
                    0: {
                        ...prev?.[0],
                        id: 0,
                        status: 'COMPLETED',
                        steps: {
                            ...prev?.[0]?.steps,
                            reasoning: {
                                data: fullText,
                                status: 'COMPLETED',
                            },
                        },
                    },
                }));
            },
        });

        const chunkBuffer = new ChunkBuffer({
            threshold: 200,
            breakOn: ['\n'],
            onFlush: (text: string) => {
                events?.update('answer', current => ({
                    ...current,
                    text,
                    status: 'PENDING' as const,
                }));
            },
        });

        const response = await generateText({
            model,
            messages,
            prompt,
            signal,
            toolChoice: 'auto',
            maxSteps: 2,
            onReasoning: (chunk, fullText) => {
                reasoningBuffer.add(chunk);
            },
            onChunk: (chunk, fullText) => {
                chunkBuffer.add(chunk);
            },
        });

        reasoningBuffer.end();
        chunkBuffer.end();

        events?.update('answer', prev => ({
            ...prev,
            text: '',
            fullText: response,
            status: 'COMPLETED',
        }));

        context.update('answer', _ => response);

        events?.update('status', prev => 'COMPLETED');

        const onFinish = context.get('onFinish');
        if (onFinish) {
            onFinish({
                answer: response,
                threadId: context.get('threadId'),
                threadItemId: context.get('threadItemId'),
            });
        }
        return;
    },
    onError: handleError,
    route: ({ context }) => {
        if (context?.get('showSuggestions') && context.get('answer')) {
            return 'suggestions';
        }
        return 'end';
    },
});
