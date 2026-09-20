'use client';
import { TableOfMessages, Thread } from '@repo/common/components';
import { useChatStore } from '@repo/common/store';
import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import { useStickToBottom } from 'use-stick-to-bottom';

const ChatSessionPage = ({ params }: { params: Promise<{ threadId: string }> }) => {
    const { threadId } = use(params);
    const router = useRouter();
    const isGenerating = useChatStore(state => state.isGenerating);
    const [shouldScroll, setShouldScroll] = useState(isGenerating);
    const { scrollRef, contentRef } = useStickToBottom({
        stiffness: 1,
        damping: 0,
    });
    const switchThread = useChatStore(state => state.switchThread);
    const getThread = useChatStore(state => state.getThread);
    const threadItems = useChatStore(state => state.threadItems);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const setRefs = useCallback(
        (node: HTMLDivElement | null) => {
            containerRef.current = node;
            // The library only drives the scroll while a reply streams in.
            (scrollRef as React.MutableRefObject<HTMLElement | null>).current = shouldScroll
                ? node
                : null;
        },
        [shouldScroll, scrollRef]
    );

    useEffect(() => {
        if (isGenerating) {
            setShouldScroll(true);
        } else {
            const timer = setTimeout(() => {
                setShouldScroll(false);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isGenerating]);

    useEffect(() => {
        if (!threadId) return;

        getThread(threadId).then(thread => {
            if (thread?.id) {
                switchThread(thread.id);
            } else {
                router.push('/chat');
            }
        });
    }, [threadId, getThread, switchThread, router]);

    // Opening a thread starts at the newest message. Markdown and images settle
    // after the first paint, so hold the bottom briefly while the height grows.
    const jumpedTo = useRef<string | null>(null);
    useEffect(() => {
        if (!threadId || !threadItems.length || jumpedTo.current === threadId) return;
        jumpedTo.current = threadId;
        let frame = 0;
        const stopAt = Date.now() + 1200;
        const pin = () => {
            const el = containerRef.current;
            if (el) el.scrollTop = el.scrollHeight;
            if (Date.now() < stopAt) frame = requestAnimationFrame(pin);
        };
        frame = requestAnimationFrame(pin);
        return () => cancelAnimationFrame(frame);
    }, [threadId, threadItems.length]);

    return (
        <div
            className="no-scrollbar flex w-full flex-1 flex-col items-center overflow-y-auto px-8"
            ref={setRefs}
        >
            <div className="mx-auto w-full max-w-3xl px-4 pb-[200px] pt-2" ref={contentRef}>
                <Thread />
            </div>

            <TableOfMessages />
        </div>
    );
};

export default ChatSessionPage;
