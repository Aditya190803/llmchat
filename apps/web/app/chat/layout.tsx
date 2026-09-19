import { ChatInput } from '@repo/common/components';

export default function ChatPageLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative flex h-full w-full flex-col">
            {children}
            <ChatInput />
        </div>
    );
}
