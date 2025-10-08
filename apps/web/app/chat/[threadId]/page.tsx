'use client';
import { TableOfMessages, Thread } from '@repo/common/components';
import { useChatStore } from '@repo/common/store';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useStickToBottom } from 'use-stick-to-bottom';

const ChatSessionPage = ({ params }: { params: { threadId: string } }) => {
    const router = useRouter();
    const isGenerating = useChatStore(state => state.isGenerating);
    const threadItems = useChatStore(state => state.threadItems);
    const [shouldScroll, setShouldScroll] = useState(isGenerating);
    const { scrollRef, contentRef } = useStickToBottom({
        stiffness: 1,
        damping: 0,
    });
    const switchThread = useChatStore(state => state.switchThread);
    const getThread = useChatStore(state => state.getThread);

    // Handle scroll behavior during generation
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

    // Handle thread loading and auto-scroll to bottom for existing chats
    useEffect(() => {
        const { threadId } = params;
        if (!threadId) {
            return;
        }
        
        getThread(threadId).then(thread => {
            if (thread?.id) {
                switchThread(thread.id);
            } else {
                router.push('/chat');
            }
        });
    }, [params]);

    // Auto-scroll to bottom when thread items are loaded (for all existing chats)
    useEffect(() => {
        const currentThreadId = params.threadId;
        if (currentThreadId && threadItems.length > 0) {
            // Check if the thread items belong to the current thread
            const currentThreadItems = threadItems.filter(item => item.threadId === currentThreadId);
            if (currentThreadItems.length > 0) {
                // Wait a bit for DOM to render, then scroll to bottom
                setTimeout(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTo({
                            top: scrollRef.current.scrollHeight,
                            behavior: 'smooth'
                        });
                    }
                }, 300);
            }
        }
    }, [params.threadId, threadItems.length]);

    return (
        <div
            className="no-scrollbar flex w-full flex-1 flex-col items-center overflow-y-auto px-2 sm:px-4 lg:px-8"
            ref={scrollRef}
        >
            <div className="mx-auto w-full max-w-3xl px-2 sm:px-4 pb-[200px] pt-2" ref={contentRef}>
                <Thread />
            </div>

            <TableOfMessages />
        </div>
    );
};

export default ChatSessionPage;
