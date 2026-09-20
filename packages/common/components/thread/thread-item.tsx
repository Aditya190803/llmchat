import {
    CitationProvider,
    FollowupSuggestions,
    MarkdownContent,
    Message,
    MessageActions,
    MotionSkeleton,
    PageBuildingCard,
    PageCards,
    QuestionPrompt,
    SourceGrid,
    Steps,
} from '@repo/common/components';
import { useAnimatedText } from '@repo/common/hooks';
import { getStreamingPage, stripPageFences, useChatStore, usePageStore } from '@repo/common/store';
import { ThreadItem as ThreadItemType } from '@repo/shared/types';
import { Alert, AlertDescription, cn } from '@repo/ui';
import { IconAlertCircle, IconBook } from '@tabler/icons-react';
import { memo, useEffect, useMemo, useRef } from 'react';
import { useInView } from 'react-intersection-observer';

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
        const { isAnimationComplete, text: animatedText } = useAnimatedText(
            threadItem.answer?.text || '',
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
        }, [threadItem]);

        const hasAnswer = useMemo(() => {
            return (
                (threadItem.answer?.text && threadItem.answer.text.length > 0) ||
                (threadItem.answer?.images && threadItem.answer.images.length > 0)
            );
        }, [threadItem.answer]);

        const isDone = ['COMPLETED', 'ERROR', 'ABORTED'].includes(threadItem.status || '');
        const streamingPage = useMemo(
            () => (isDone ? null : getStreamingPage(threadItem.answer?.text || '')),
            [isDone, threadItem.answer?.text]
        );

        // Mirror the page being written into the panel so it builds in view.
        const setLivePage = usePageStore(state => state.setLivePage);
        const clearLivePage = usePageStore(state => state.clearLivePage);
        useEffect(() => {
            if (streamingPage) {
                setLivePage({ ...streamingPage, threadItemId: threadItem.id });
                return;
            }
            if (!isDone) return;
            // The store swaps the live page for the saved one in a single update,
            // so clearing here would blank the panel until that write lands.
            // Only clean up when no page is coming, or if the save never arrives.
            if (threadItem.status === 'ABORTED' || threadItem.status === 'ERROR') {
                clearLivePage(threadItem.id);
                return;
            }
            const timeout = setTimeout(() => clearLivePage(threadItem.id), 10000);
            return () => clearTimeout(timeout);
        }, [streamingPage, isDone, threadItem.status, threadItem.id, setLivePage, clearLivePage]);

        useEffect(() => () => clearLivePage(threadItem.id), [threadItem.id, clearLivePage]);

        const hasResponse = useMemo(() => {
            return (
                !!threadItem?.steps ||
                !!threadItem?.answer?.text ||
                !!threadItem?.answer?.images?.length ||
                !!threadItem?.object ||
                !!threadItem?.error ||
                threadItem?.status === 'COMPLETED' ||
                threadItem?.status === 'ABORTED' ||
                threadItem?.status === 'ERROR'
            );
        }, [threadItem]);
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
                            <div className="flex w-full flex-col items-start gap-2 opacity-10">
                                <MotionSkeleton className="bg-muted-foreground/40 mb-2 h-4 !w-[100px] rounded-sm" />
                                <MotionSkeleton className="w-full bg-gradient-to-r" />
                                <MotionSkeleton className="w-[70%] bg-gradient-to-r" />
                                <MotionSkeleton className="w-[50%] bg-gradient-to-r" />
                            </div>
                        )}

                        <div ref={messageRef} className="w-full">
                            {hasAnswer && threadItem.answer?.text && (
                                <div className="flex flex-col">
                                    <SourceGrid sources={threadItem.sources || []} />

                                    {threadItem.answer?.images?.length ? (
                                        <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
                                            {threadItem.answer.images.map((image, index) => (
                                                <figure key={`${threadItem.id}-image-${index}`}>
                                                    <img
                                                        src={image.data}
                                                        alt={image.alt || 'Generated image'}
                                                        loading="lazy"
                                                        className="h-auto w-full rounded-xl border object-contain shadow-sm"
                                                    />
                                                </figure>
                                            ))}
                                        </div>
                                    ) : null}
                                    {threadItem.answer?.text && (
                                        <MarkdownContent
                                            content={stripPageFences(animatedText || '')}
                                            key={`answer-${threadItem.id}`}
                                            isCompleted={['COMPLETED', 'ERROR', 'ABORTED'].includes(
                                                threadItem.status || ''
                                            )}
                                            shouldAnimate={
                                                !['COMPLETED', 'ERROR', 'ABORTED'].includes(
                                                    threadItem.status || ''
                                                )
                                            }
                                            isLast={isLast}
                                        />
                                    )}
                                </div>
                            )}
                            {streamingPage ? (
                                <div className="mt-3">
                                    <PageBuildingCard
                                        title={streamingPage.title}
                                        type={streamingPage.type}
                                        size={streamingPage.content.length}
                                    />
                                </div>
                            ) : (
                                isAnimationComplete && (
                                    <div className="mt-3 empty:hidden">
                                        <PageCards threadItem={threadItem} />
                                    </div>
                                )
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
