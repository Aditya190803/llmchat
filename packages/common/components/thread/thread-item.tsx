import {
    CitationProvider,
    FollowupSuggestions,
    ImageGenerationResult,
    MarkdownContent,
    Message,
    MessageActions,
    QuestionPrompt,
    SourceGrid,
    Steps,
    ThinkingProcess,
} from '@repo/common/components';
import { useAnimatedText } from '@repo/common/hooks';
import { useChatStore } from '@repo/common/store';
import { ChatMode, getChatModeName } from '@repo/shared/config';
import { ThreadItem as ThreadItemType } from '@repo/shared/types';
import { Alert, AlertDescription, cn } from '@repo/ui';
import { DotSpinner } from '@repo/common/components';
import { IconAlertCircle, IconBook, IconSparkles } from '@tabler/icons-react';
import { memo, useEffect, useMemo, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import type { ImageGenerationResultData } from '@repo/common/components';

const THINK_BLOCK_REGEX = /<think>([\s\S]*?)<\/think>/gi;
const THINK_TAG_REGEX = /<\/?think>/gi;

const cloneRegex = (regex: RegExp) => new RegExp(regex.source, regex.flags);
const stripThinkTags = (value: string) => value.replace(cloneRegex(THINK_TAG_REGEX), '');

const extractAnswerAndThinking = (
    rawAnswer?: string,
    explicitThinking?: string
): { answer: string; thinking: string } => {
    const thinkingParts = new Set<string>();

    const normalizedExplicit = explicitThinking?.trim();
    if (normalizedExplicit) {
        thinkingParts.add(normalizedExplicit);
    }

    let sanitizedAnswer = rawAnswer ?? '';

    if (sanitizedAnswer) {
        const blockRegex = cloneRegex(THINK_BLOCK_REGEX);
        let hasBlockMatch = false;

        sanitizedAnswer = sanitizedAnswer.replace(blockRegex, (_match: string, group: string) => {
            hasBlockMatch = true;
            const part = group?.trim();
            if (part) {
                thinkingParts.add(stripThinkTags(part).trim());
            }
            return '';
        });

        if (!hasBlockMatch) {
            const lowerCaseAnswer = sanitizedAnswer.toLowerCase();
            const openIndex = lowerCaseAnswer.indexOf('<think>');
            if (openIndex !== -1) {
                const tail = sanitizedAnswer.slice(openIndex + '<think>'.length);
                const cleanedTail = stripThinkTags(tail).trim();
                if (cleanedTail) {
                    thinkingParts.add(cleanedTail);
                }
                sanitizedAnswer = sanitizedAnswer.slice(0, openIndex);
            }
        }
    }

    sanitizedAnswer = stripThinkTags(sanitizedAnswer).trim();

    const thinking = Array.from(thinkingParts)
        .map(part => part.trim())
        .filter(Boolean)
        .join('\n\n')
        .trim();

    return {
        answer: sanitizedAnswer,
        thinking,
    };
};

export const ThreadItem = memo(
    ({
        threadItem,
        isGenerating,
        isLast,
    }: {
        isAnimated: boolean;
        threadItem: ThreadItemType;
        isGenerating: boolean;
        isLast: boolean;
    }) => {
        const rawAnswerText = useMemo(() => {
            const text = threadItem.answer?.text?.trim();
            if (text && text.length > 0) {
                return threadItem.answer?.text || '';
            }
            return threadItem.answer?.finalText || '';
        }, [threadItem.answer?.text, threadItem.answer?.finalText]);

        const { answer: answerText, thinking: derivedThinkingProcess } = useMemo(
            () => extractAnswerAndThinking(rawAnswerText, threadItem.thinkingProcess),
            [rawAnswerText, threadItem.thinkingProcess]
        );

        const { isAnimationComplete, text: animatedText } = useAnimatedText(
            answerText,
            isLast && isGenerating
        );
        const setCurrentSources = useChatStore(state => state.setCurrentSources);
        const messageRef = useRef<HTMLDivElement>(null);

        const { ref: inViewRef, inView } = useInView({});

        useEffect(() => {
            if (inView && threadItem.id) {
                useChatStore.getState().setActiveThreadItemView(threadItem.id);
            }
        }, [inView, threadItem.id]);

        useEffect(() => {
            const sources =
                Object.values(threadItem.steps || {})
                    ?.filter(
                        step =>
                            step.steps && 'read' in step?.steps && !!step.steps?.read?.data?.length
                    )
                    .flatMap(step => step.steps?.read?.data?.map((result: any) => result.link))
                    .filter((link): link is string => link !== undefined) || [];
            return setCurrentSources(sources);
        }, [threadItem, setCurrentSources]);

        const hasAnswer = useMemo(() => {
            return (answerText?.length || 0) > 0;
        }, [answerText]);

        const hasResponse = useMemo(() => {
            return (
                !!threadItem?.steps ||
                !!answerText ||
                !!threadItem?.object ||
                !!threadItem?.error ||
                threadItem?.status === 'COMPLETED' ||
                threadItem?.status === 'ABORTED' ||
                threadItem?.status === 'ERROR'
            );
        }, [threadItem, answerText]);

        const isFinalStatus = useMemo(
            () => ['COMPLETED', 'ERROR', 'ABORTED'].includes(threadItem?.status ?? ''),
            [threadItem?.status]
        );

        const isAnswerReady = hasAnswer || isFinalStatus;

        const imageGenerationResult =
            threadItem.object?.type === 'image-generation'
                ? (threadItem.object as ImageGenerationResultData)
                : null;

        const sanitizedImageResult =
            imageGenerationResult &&
            (imageGenerationResult.summary === answerText
                ? { ...imageGenerationResult, summary: undefined }
                : imageGenerationResult);

        const requestedMode = threadItem.metadata?.requestedMode as ChatMode | undefined;
        const selectionReason =
            requestedMode === ChatMode.Auto
                ? (threadItem.metadata?.selectionReason as string | undefined)
                : undefined;
        return (
            <CitationProvider sources={threadItem.sources || []}>
                <div className="w-full" ref={inViewRef} id={`thread-item-${threadItem.id}`}>
                    <div className={cn('flex w-full flex-col items-start gap-3 pt-4')}>
                        {threadItem.query && (
                            <Message
                                message={threadItem.query}
                                imageAttachment={threadItem?.imageAttachment}
                                threadItem={threadItem}
                            />
                        )}

                        {selectionReason && (
                            <div className="text-muted-foreground/80 flex flex-row items-center gap-1 text-xs">
                                <IconSparkles size={14} strokeWidth={2} className="text-amber-500" />
                                <span>
                                    Auto selected {getChatModeName(threadItem.mode)} — {selectionReason}
                                </span>
                            </div>
                        )}

                        <div className="text-muted-foreground flex flex-row items-center gap-1.5 text-xs font-medium">
                            <IconBook size={16} strokeWidth={2} />
                            Answer
                        </div>

                        {threadItem.steps && (
                            <Steps
                                steps={Object.values(threadItem?.steps || {})}
                                threadItem={threadItem}
                            />
                        )}

                        {!hasResponse && (
                            <div className="w-full">
                                <div className="border-border/40 bg-background/80 relative overflow-hidden rounded-xl border px-4 py-4 shadow-subtle-sm backdrop-blur-sm dark:border-border/30 dark:bg-background/60">
                                    <div className="bg-primary/5 pointer-events-none absolute inset-0 animate-pulse" aria-hidden />
                                    <div className="relative flex items-center gap-3">
                                        <div className="border-border/50 bg-background/90 flex h-10 w-10 items-center justify-center rounded-full border shadow-inner">
                                            <DotSpinner />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-foreground">
                                                Generating response…
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                The assistant is processing your request and will reply in just a moment.
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Display thinking process only if actual thinking content exists */}
                        {derivedThinkingProcess.length > 0 && (
                            <ThinkingProcess
                                content={derivedThinkingProcess}
                                isGenerating={isGenerating && isLast}
                                isAnswerReady={isAnswerReady}
                            />
                        )}

                        {/* Main Answer Section - Prominently displayed */}
                        <div ref={messageRef} className="w-full space-y-4">
                            {sanitizedImageResult && (
                                <ImageGenerationResult result={sanitizedImageResult} />
                            )}

                            {hasAnswer && (
                                <div className="flex flex-col">
                                    {/* Sources Grid */}
                                    <SourceGrid sources={threadItem.sources || []} />

                                    {/* Main Answer - Prominently displayed with clear contrast from thinking */}
                                    <div className="relative">
                                        <MarkdownContent
                                            content={animatedText || ''}
                                            key={`answer-${threadItem.id}`}
                                            isCompleted={isFinalStatus}
                                            shouldAnimate={
                                                !['COMPLETED', 'ERROR', 'ABORTED'].includes(
                                                    threadItem.status || ''
                                                )
                                            }
                                            isLast={isLast}
                                            className="prose-slate dark:prose-invert max-w-none"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <QuestionPrompt threadItem={threadItem} />
                        {threadItem.error && (
                            <Alert variant="destructive">
                                <AlertDescription>
                                    <IconAlertCircle className="mt-0.5 size-3.5" />
                                    {typeof threadItem.error === 'string'
                                        ? threadItem.error
                                        : 'Something went wrong while processing your request. Please try again.'}
                                </AlertDescription>
                            </Alert>
                        )}

                        {threadItem.status === 'ABORTED' && (
                            <Alert variant="warning">
                                <AlertDescription>
                                    <IconAlertCircle className="mt-0.5 size-3.5" />
                                    {threadItem.error ?? 'Generation stopped'}
                                </AlertDescription>
                            </Alert>
                        )}

                        {isAnimationComplete &&
                            (threadItem.status === 'COMPLETED' ||
                                threadItem.status === 'ABORTED' ||
                                threadItem.status === 'ERROR' ||
                                !isGenerating) && (
                                <MessageActions
                                    threadItem={threadItem}
                                    ref={messageRef}
                                    isLast={isLast}
                                />
                            )}
                        {isAnimationComplete && isLast && (
                            <FollowupSuggestions suggestions={threadItem.suggestions || []} />
                        )}
                    </div>
                </div>
            </CitationProvider>
        );
    },
    (prevProps, nextProps) => {
        return JSON.stringify(prevProps.threadItem) === JSON.stringify(nextProps.threadItem);
    }
);

ThreadItem.displayName = 'ThreadItem';
