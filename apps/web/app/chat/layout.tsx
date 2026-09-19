import { ChatInput, PagesPanel, PagesToggle } from '@repo/common/components';

export default function ChatPageLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative flex h-full w-full flex-row">
            <div className="relative flex h-full min-w-0 flex-1 flex-col">
                {children}
                <ChatInput />
                <PagesToggle />
            </div>
            <PagesPanel />
        </div>
    );
}
