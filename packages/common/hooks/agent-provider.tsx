import { useAuth } from '@repo/common/context';
import { useWorkflowWorker } from '@repo/ai/worker';
import {
    ChatMode,
    ChatModeConfig,
    getModelSelectionReason,
    selectGeminiFallback,
    selectModelForQuery,
    selectOpenRouterFallback,
} from '@repo/shared/config';
import { Answer, ThreadItem } from '@repo/shared/types';
import { buildCoreMessagesFromThreadItems, plausible } from '@repo/shared/utils';
import { nanoid } from 'nanoid';
import { useParams, useRouter } from 'next/navigation';
import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from 'react';
import { useApiKeysStore, useAppStore, useChatStore, useMcpToolsStore } from '../store';
import { useTitleGeneration } from './use-title-generation';

export type AgentContextType = {
    runAgent: (body: any) => Promise<void>;
    handleSubmit: (args: {
        formData: FormData;
        newThreadId?: string;
        existingThreadItemId?: string;
        newChatMode?: string;
        messages?: ThreadItem[];
        useWebSearch?: boolean;
        showSuggestions?: boolean;
        branchParentId?: string;
    }) => Promise<void>;
    updateContext: (threadId: string, data: any) => void;
};

const AgentContext = createContext<AgentContextType | undefined>(undefined);

const GEMINI_CHAT_MODES = new Set<ChatMode>([
    ChatMode.GEMINI_2_5_FLASH,
    ChatMode.GEMINI_2_5_PRO,
]);

const OPENROUTER_CHAT_MODES = new Set<ChatMode>([
    ChatMode.GLM_4_5_AIR,
    ChatMode.DEEPSEEK_CHAT_V3_1,
    ChatMode.DEEPSEEK_R1,
    ChatMode.LONGCAT_FLASH_CHAT,
    ChatMode.GPT_OSS_20B,
    ChatMode.DOLPHIN_MISTRAL_24B_VENICE,
]);

export const AgentProvider = ({ children }: { children: ReactNode }) => {
    const { threadId: currentThreadId } = useParams();
    const { isSignedIn, userId } = useAuth();

    const {
        updateThreadItem,
        setIsGenerating,
        setAbortController,
        createThreadItem,
        setCurrentThreadItem,
        setCurrentSources,
        updateThread,
        chatMode,
        customInstructions,
        getConversationThreadItems,
    } = useChatStore(state => ({
        updateThreadItem: state.updateThreadItem,
        setIsGenerating: state.setIsGenerating,
        setAbortController: state.setAbortController,
        createThreadItem: state.createThreadItem,
        setCurrentThreadItem: state.setCurrentThreadItem,
        setCurrentSources: state.setCurrentSources,
        updateThread: state.updateThread,
        chatMode: state.chatMode,
        customInstructions: state.customInstructions,
        getConversationThreadItems: state.getConversationThreadItems,
    }));
    const { push } = useRouter();

    const getSelectedMCP = useMcpToolsStore(state => state.getSelectedMCP);
    const apiKeys = useApiKeysStore(state => state.getAllKeys);
    const hasApiKeyForChatMode = useApiKeysStore(state => state.hasApiKeyForChatMode);
    const { generateAndUpdateTitle } = useTitleGeneration();

    // In-memory store for thread items
    const threadItemMap = useMemo(() => new Map<string, ThreadItem>(), []);
    const pendingTitleStages = useRef<Map<string, Set<'initial' | 'refine'>>>(new Map());

    // Define common event types to reduce repetition
    const EVENT_TYPES = [
        'steps',
        'sources',
        'answer',
        'error',
        'status',
        'suggestions',
        'toolCalls',
        'toolResults',
        'object',
        'metrics',
    ];

    // Helper: Update in-memory and store thread item
    const handleThreadItemUpdate = useCallback(
        (
            threadId: string,
            threadItemId: string,
            eventType: string,
            eventData: any,
            parentThreadItemId?: string,
            shouldPersistToDB: boolean = true
        ) => {
            console.log(
                'handleThreadItemUpdate',
                threadItemId,
                eventType,
                eventData,
                shouldPersistToDB
            );
            const prevItem = threadItemMap.get(threadItemId) || ({} as ThreadItem);
            const incomingAnswer = eventType === 'answer' ? eventData.answer || {} : undefined;
            const incomingMetrics = eventType === 'metrics' ? eventData.metrics || {} : undefined;

            let nextAnswer: Answer | undefined = prevItem.answer;
            let nextThinkingProcess = prevItem.thinkingProcess;

            if (incomingAnswer) {
                const {
                    text: incomingText,
                    finalText: incomingFinalText,
                    fullText: incomingFullText,
                    thinkingProcess: incomingThinkingProcess,
                    status: incomingStatus,
                    ...incomingRest
                } = incomingAnswer as {
                    text?: string;
                    finalText?: string;
                    fullText?: string;
                    thinkingProcess?: string;
                    status?: string;
                    [key: string]: unknown;
                };

                const previousAnswer: Answer = prevItem.answer ?? { text: '' };
                const previousText = previousAnswer.text ?? '';
                const hasFinalText =
                    typeof incomingFinalText === 'string' && incomingFinalText.trim().length > 0;
                const hasFullText =
                    typeof incomingFullText === 'string' && incomingFullText.trim().length > 0;

                const resolvedFinalText = hasFinalText
                    ? incomingFinalText!
                    : hasFullText
                        ? incomingFullText!
                        : typeof previousAnswer.finalText === 'string' && previousAnswer.finalText.length > 0
                            ? previousAnswer.finalText
                            : previousText;

                const resolvedText = hasFinalText
                    ? incomingFinalText!
                    : hasFullText
                        ? incomingFullText!
                        : `${previousText}${incomingText ?? ''}`;

                nextAnswer = {
                    ...previousAnswer,
                    ...incomingRest,
                    status:
                        typeof incomingStatus === 'string' ? incomingStatus : previousAnswer.status,
                    text: resolvedText,
                    finalText: resolvedFinalText,
                } as Answer;

                nextThinkingProcess =
                    typeof incomingThinkingProcess === 'string' && incomingThinkingProcess.trim().length > 0
                        ? incomingThinkingProcess
                        : prevItem.thinkingProcess;
            }

            const nextMetadata: Record<string, any> = prevItem.metadata
                ? { ...prevItem.metadata }
                : {};

            if (eventData?.requestedMode) {
                nextMetadata.requestedMode = eventData.requestedMode;
            }

            if (eventData?.modeSelectionReason) {
                nextMetadata.selectionReason = eventData.modeSelectionReason;
            }

            const metadata =
                Object.keys(nextMetadata).length > 0 ? nextMetadata : prevItem.metadata;

            const updatedItem: ThreadItem = {
                ...prevItem,
                query: eventData?.query || prevItem.query || '',
                mode: eventData?.mode || prevItem.mode,
                threadId,
                parentId: parentThreadItemId || prevItem.parentId,
                id: threadItemId,
                branchRootId:
                    prevItem.branchRootId ||
                    (parentThreadItemId && parentThreadItemId.length > 0
                        ? parentThreadItemId
                        : threadItemId),
                object: eventData?.object || prevItem.object,
                createdAt: prevItem.createdAt || new Date(),
                updatedAt: new Date(),
                metadata,
                ...(eventType === 'answer'
                    ? {
                          answer: nextAnswer,
                          thinkingProcess: nextThinkingProcess,
                      }
                    : eventType === 'metrics'
                        ? {
                              tokensUsed:
                                  typeof incomingMetrics?.totalTokens === 'number'
                                      ? incomingMetrics.totalTokens
                                      : prevItem.tokensUsed,
                              generationDurationMs:
                                  typeof incomingMetrics?.durationMs === 'number'
                                      ? incomingMetrics.durationMs
                                      : prevItem.generationDurationMs,
                          }
                        : { [eventType]: eventData[eventType] }),
            };

            threadItemMap.set(threadItemId, updatedItem);
            updateThreadItem(threadId, { ...updatedItem, persistToDB: true });
        },
        [threadItemMap, updateThreadItem]
    );

    const { startWorkflow, abortWorkflow } = useWorkflowWorker(
        useCallback(
            (data: any) => {
                if (
                    data?.threadId &&
                    data?.threadItemId &&
                    data.event &&
                    EVENT_TYPES.includes(data.event)
                ) {
                    handleThreadItemUpdate(
                        data.threadId,
                        data.threadItemId,
                        data.event,
                        data,
                        data.parentThreadItemId
                    );
                }

                if (data.type === 'done') {
                    setIsGenerating(false);
                    if (data?.threadItemId) {
                        threadItemMap.delete(data.threadItemId);
                    }
                }
            },
            [handleThreadItemUpdate, setIsGenerating, threadItemMap]
        )
    );

    const runAgent = useCallback(
        async (body: any) => {
            const abortController = new AbortController();
            setAbortController(abortController);
            setIsGenerating(true);
            const startTime = performance.now();

            abortController.signal.addEventListener('abort', () => {
                console.info('Abort controller triggered');
                setIsGenerating(false);
                updateThreadItem(body.threadId, {
                    id: body.threadItemId,
                    status: 'ABORTED',
                    persistToDB: true,
                });
            });

            try {
                const response = await fetch('/api/completion', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    credentials: 'include',
                    cache: 'no-store',
                    signal: abortController.signal,
                });

                if (!response.ok) {
                    let errorText = await response.text();

                    if (response.status === 429 && isSignedIn) {
                        errorText =
                            'You have reached the daily limit of requests. Please try again tomorrow or Use your own API key.';
                    }

                    if (response.status === 429 && !isSignedIn) {
                        errorText =
                            'You have reached the daily limit of requests. Please sign in to enjoy more requests.';
                    }

                    setIsGenerating(false);
                    updateThreadItem(body.threadId, {
                        id: body.threadItemId,
                        status: 'ERROR',
                        error: errorText,
                        persistToDB: true,
                    });
                    console.error('Error response:', errorText);
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                if (!response.body) {
                    throw new Error('No response body received');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let lastDbUpdate = Date.now();
                const DB_UPDATE_INTERVAL = 1000;
                let eventCount = 0;
                const streamStartTime = performance.now();

                let buffer = '';

                while (true) {
                    try {
                        const { value, done } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const messages = buffer.split('\n\n');
                        buffer = messages.pop() || '';

                        for (const message of messages) {
                            if (!message.trim()) continue;

                            const eventMatch = message.match(/^event: (.+)$/m);
                            const dataMatch = message.match(/^data: (.+)$/m);

                            if (eventMatch && dataMatch) {
                                const currentEvent = eventMatch[1];
                                eventCount++;

                                try {
                                    const data = JSON.parse(dataMatch[1]);
                                    if (
                                        EVENT_TYPES.includes(currentEvent) &&
                                        data?.threadId &&
                                        data?.threadItemId
                                    ) {
                                        const shouldPersistToDB =
                                            Date.now() - lastDbUpdate >= DB_UPDATE_INTERVAL;
                                        handleThreadItemUpdate(
                                            data.threadId,
                                            data.threadItemId,
                                            currentEvent,
                                            data,
                                            data.parentThreadItemId,
                                            shouldPersistToDB
                                        );
                                        if (shouldPersistToDB) {
                                            lastDbUpdate = Date.now();
                                        }
                                    } else if (currentEvent === 'done' && data.type === 'done') {
                                        setIsGenerating(false);
                                        const streamDuration = performance.now() - streamStartTime;
                                        console.log(
                                            'done event received',
                                            eventCount,
                                            `Stream duration: ${streamDuration.toFixed(2)}ms`
                                        );
                                        if (data.threadItemId) {
                                            threadItemMap.delete(data.threadItemId);
                                        }

                                        if (data.status === 'error') {
                                            console.error('Stream error:', data.error);
                                            if (data.threadId && data.threadItemId) {
                                                updateThreadItem(data.threadId, {
                                                    id: data.threadItemId,
                                                    status: 'ERROR',
                                                    error:
                                                        data.error ||
                                                        'Something went wrong. Please try again.',
                                                    persistToDB: true,
                                                });
                                            }
                                        } else if (data.status === 'aborted') {
                                            if (data.threadId && data.threadItemId) {
                                                updateThreadItem(data.threadId, {
                                                    id: data.threadItemId,
                                                    status: 'ABORTED',
                                                    persistToDB: true,
                                                });
                                            }
                                        } else if (data.status === 'complete') {
                                            if (data.threadId && data.threadItemId) {
                                                updateThreadItem(data.threadId, {
                                                    id: data.threadItemId,
                                                    status: 'COMPLETED',
                                                    persistToDB: true,
                                                });

                                                const chatState = useChatStore.getState();
                                                const threadItems = chatState.threadItems
                                                    .filter(item => item.threadId === data.threadId)
                                                    .sort(
                                                        (a, b) =>
                                                            (a.createdAt?.getTime?.() || 0) -
                                                            (b.createdAt?.getTime?.() || 0)
                                                    );

                                                const conversationTurns = threadItems
                                                    .filter(item => item.query)
                                                    .map(item => ({
                                                        id: item.id,
                                                        user: (item.query || '').trim(),
                                                        assistant: (
                                                            item.answer?.finalText || item.answer?.text || ''
                                                        ).trim(),
                                                    }));

                                                const latestTurn = conversationTurns.find(
                                                    turn => turn.id === data.threadItemId
                                                );
                                                const latestAnswerCandidate =
                                                    (data as any)?.answer?.finalText ||
                                                    (data as any)?.answer?.text ||
                                                    '';
                                                const finalAnswerText =
                                                    typeof latestAnswerCandidate === 'string'
                                                        ? latestAnswerCandidate.trim()
                                                        : '';

                                                if (latestTurn && finalAnswerText.length) {
                                                    latestTurn.assistant = finalAnswerText;
                                                }

                                                const completedTurns = conversationTurns.filter(
                                                    turn => turn.user.length && turn.assistant.length
                                                );

                                                const currentThread = chatState.threads.find(
                                                    thread => thread.id === data.threadId
                                                );
                                                const currentVersion = currentThread?.autoTitleVersion ?? 0;

                                                const requestTitleGeneration = (
                                                    stage: 'initial' | 'refine',
                                                    conversation: { role: 'user' | 'assistant'; content: string }[],
                                                    fallbackTitle?: string
                                                ) => {
                                                    const pending =
                                                        pendingTitleStages.current.get(data.threadId) || new Set();
                                                    if (pending.has(stage)) {
                                                        return;
                                                    }
                                                    pending.add(stage);
                                                    pendingTitleStages.current.set(data.threadId, pending);

                                                    generateAndUpdateTitle({
                                                        threadId: data.threadId,
                                                        stage,
                                                        conversation,
                                                        fallbackTitle,
                                                    })
                                                        .catch(console.error)
                                                        .finally(() => {
                                                            const current = pendingTitleStages.current.get(data.threadId);
                                                            if (!current) return;
                                                            current.delete(stage);
                                                            if (current.size === 0) {
                                                                pendingTitleStages.current.delete(data.threadId);
                                                            }
                                                        });
                                                };

                                                if (currentVersion < 1 && completedTurns.length >= 1) {
                                                    const firstTurn = completedTurns[0];
                                                    console.log('[TitleGeneration] Requesting initial title', {
                                                        threadId: data.threadId,
                                                        user: firstTurn.user.substring(0, 50),
                                                        assistant: firstTurn.assistant.substring(0, 50)
                                                    });
                                                    requestTitleGeneration(
                                                        'initial',
                                                        [
                                                            { role: 'user' as const, content: firstTurn.user },
                                                            {
                                                                role: 'assistant' as const,
                                                                content: firstTurn.assistant,
                                                            },
                                                        ],
                                                        firstTurn.user
                                                    );
                                                } else if (currentVersion < 2 && completedTurns.length >= 3) {
                                                    const refinedTurns = completedTurns.slice(0, 3);
                                                    const messages: { role: 'user' | 'assistant'; content: string }[] =
                                                        refinedTurns.flatMap(turn => [
                                                            { role: 'user' as const, content: turn.user },
                                                            {
                                                                role: 'assistant' as const,
                                                                content: turn.assistant,
                                                            },
                                                        ]);
                                                    requestTitleGeneration('refine', messages, refinedTurns[0].user);
                                                }
                                            }
                                        }
                                    }
                                } catch (jsonError) {
                                    console.warn(
                                        'JSON parse error for data:',
                                        dataMatch[1],
                                        jsonError
                                    );
                                }
                            }
                        }
                    } catch (readError) {
                        console.error('Error reading from stream:', readError);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                }
            } catch (streamError: any) {
                const totalTime = performance.now() - startTime;
                console.error(
                    'Fatal stream error:',
                    streamError,
                    `Total time: ${totalTime.toFixed(2)}ms`
                );
                setIsGenerating(false);
                if (streamError.name === 'AbortError') {
                    updateThreadItem(body.threadId, {
                        id: body.threadItemId,
                        status: 'ABORTED',
                        error: 'Generation aborted',
                    });
                } else if (streamError.message.includes('429')) {
                    updateThreadItem(body.threadId, {
                        id: body.threadItemId,
                        status: 'ERROR',
                        error: 'You have reached the daily limit of requests. Please try again tomorrow or Use your own API key.',
                    });
                } else {
                    updateThreadItem(body.threadId, {
                        id: body.threadItemId,
                        status: 'ERROR',
                        error: 'Something went wrong. Please try again.',
                    });
                }
            } finally {
                setIsGenerating(false);

                const totalTime = performance.now() - startTime;
                console.info(`Stream completed in ${totalTime.toFixed(2)}ms`);
            }
        },
        [
            setAbortController,
            setIsGenerating,
            updateThreadItem,
            handleThreadItemUpdate,
            EVENT_TYPES,
            threadItemMap,
        ]
    );

    const handleSubmit = useCallback(
        async ({
            formData,
            newThreadId,
            existingThreadItemId,
            newChatMode,
            messages,
            useWebSearch,
            showSuggestions,
            branchParentId,
        }: {
            formData: FormData;
            newThreadId?: string;
            existingThreadItemId?: string;
            newChatMode?: string;
            messages?: ThreadItem[];
            useWebSearch?: boolean;
            showSuggestions?: boolean;
            branchParentId?: string;
        }) => {
            const mode = (newChatMode || chatMode) as ChatMode;
            if (
                !isSignedIn &&
                !!ChatModeConfig[mode as keyof typeof ChatModeConfig]?.isAuthRequired
            ) {
                push('/sign-in');

                return;
            }

            const threadId = currentThreadId?.toString() || newThreadId;
            if (!threadId) return;
            const chatState = useChatStore.getState();
            const existingThreadItem = existingThreadItemId
                ? chatState.threadItems.find(item => item.id === existingThreadItemId)
                : undefined;
            const branchSourceItem = branchParentId
                ? chatState.threadItems.find(item => item.id === branchParentId)
                : undefined;

            let parentThreadItemId = existingThreadItem?.parentId ?? '';
            if (branchParentId) {
                parentThreadItemId = branchSourceItem
                    ? branchSourceItem.parentId ?? ''
                    : branchParentId;
            }

            const optimisticAiThreadItemId = branchParentId
                ? nanoid()
                : existingThreadItemId || nanoid();
            const query = (formData.get('query') as string) || '';
            const rawImageAttachment = formData.get('imageAttachment');
            const imageAttachment =
                typeof rawImageAttachment === 'string' && rawImageAttachment.trim().length > 0
                    ? rawImageAttachment
                    : undefined;

            const requestedMode = mode;
            let resolvedMode = requestedMode;
            let modelSelectionReason: string | null = null;
            const userKeysSnapshot = apiKeys();
            const hasUserGeminiKey = !!userKeysSnapshot.GEMINI_API_KEY;
            const hasUserOpenRouterKey = !!userKeysSnapshot.OPENROUTER_API_KEY;

            if (requestedMode === ChatMode.Auto) {
                resolvedMode = selectModelForQuery(query, Boolean(imageAttachment));
                modelSelectionReason = getModelSelectionReason(query, resolvedMode);

                const resolvedUsesGemini = GEMINI_CHAT_MODES.has(resolvedMode);
                const resolvedUsesOpenRouter = OPENROUTER_CHAT_MODES.has(resolvedMode);

                if (resolvedUsesGemini && !hasUserGeminiKey && hasUserOpenRouterKey) {
                    resolvedMode = selectOpenRouterFallback(query);
                    modelSelectionReason = `${getModelSelectionReason(query, resolvedMode)} • Using your OpenRouter API key`;
                } else if (resolvedUsesOpenRouter && !hasUserOpenRouterKey && hasUserGeminiKey) {
                    resolvedMode = selectGeminiFallback(query, Boolean(imageAttachment));
                    modelSelectionReason = `${getModelSelectionReason(query, resolvedMode)} • Using your Gemini API key`;
                }
            }

            const inferredBranchRootId = branchParentId
                ? branchSourceItem?.branchRootId || branchParentId
                : existingThreadItem?.branchRootId || existingThreadItem?.id;

            const branchRootId = inferredBranchRootId || optimisticAiThreadItemId;

            const existingThread = chatState.threads.find(thread => thread.id === threadId);

            if (!existingThread || (existingThread.autoTitleVersion ?? 0) < 1) {
                updateThread({ id: threadId, title: query });
            }

            const historicalMessages = messages || getConversationThreadItems(threadId);

            const aiThreadItem: ThreadItem = {
                id: optimisticAiThreadItemId,
                createdAt: new Date(),
                updatedAt: new Date(),
                status: 'QUEUED',
                threadId,
                parentId: parentThreadItemId || undefined,
                query,
                imageAttachment,
                mode: resolvedMode,
                branchRootId,
                metadata:
                    requestedMode === ChatMode.Auto
                        ? {
                              requestedMode,
                              selectionReason: modelSelectionReason,
                          }
                        : undefined,
            };

            createThreadItem(aiThreadItem);
            setCurrentThreadItem(aiThreadItem);
            setIsGenerating(true);
            setCurrentSources([]);

            plausible.trackEvent('send_message', {
                props: {
                    mode: resolvedMode,
                    requestedMode,
                },
            });

            // Build core messages array
            const coreMessages = buildCoreMessagesFromThreadItems({
                messages: historicalMessages,
                query,
                imageAttachment,
            });

            if (hasApiKeyForChatMode(resolvedMode)) {
                const abortController = new AbortController();
                setAbortController(abortController);
                setIsGenerating(true);

                abortController.signal.addEventListener('abort', () => {
                    console.info('Abort signal received');
                    setIsGenerating(false);
                    abortWorkflow();
                    updateThreadItem(threadId, { id: optimisticAiThreadItemId, status: 'ABORTED' });
                });

                startWorkflow({
                    mode: resolvedMode,
                    question: query,
                    threadId,
                    messages: coreMessages,
                    mcpConfig: getSelectedMCP(),
                    threadItemId: optimisticAiThreadItemId,
                    parentThreadItemId,
                    customInstructions,
                    apiKeys: userKeysSnapshot,
                    userId: userId ?? undefined,
                });
            } else {
                runAgent({
                    mode: resolvedMode,
                    requestedMode,
                    modeSelectionReason: modelSelectionReason ?? undefined,
                    prompt: query,
                    threadId,
                    messages: coreMessages,
                    mcpConfig: getSelectedMCP(),
                    threadItemId: optimisticAiThreadItemId,
                    customInstructions,
                    parentThreadItemId,
                    webSearch: useWebSearch,
                    showSuggestions: showSuggestions ?? true,
                });
            }
        },
        [
            isSignedIn,
            currentThreadId,
            chatMode,
            updateThread,
            createThreadItem,
            setCurrentThreadItem,
            setIsGenerating,
            setCurrentSources,
            abortWorkflow,
            startWorkflow,
            customInstructions,
            getSelectedMCP,
            apiKeys,
            hasApiKeyForChatMode,
            updateThreadItem,
            runAgent,
            getConversationThreadItems,
        ]
    );

    const updateContext = useCallback(
        (threadId: string, data: any) => {
            console.info('Updating context', data);
            updateThreadItem(threadId, {
                id: data.threadItemId,
                parentId: data.parentThreadItemId,
                threadId: data.threadId,
                metadata: data.context,
            });
        },
        [updateThreadItem]
    );

    const contextValue = useMemo(
        () => ({
            runAgent,
            handleSubmit,
            updateContext,
        }),
        [runAgent, handleSubmit, updateContext]
    );

    return <AgentContext.Provider value={contextValue}>{children}</AgentContext.Provider>;
};

export const useAgentStream = (): AgentContextType => {
    const context = useContext(AgentContext);
    if (!context) {
        throw new Error('useAgentStream must be used within an AgentProvider');
    }
    return context;
};
