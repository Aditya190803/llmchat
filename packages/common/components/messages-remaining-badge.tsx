import { useChatStore } from '@repo/common/store';
import { motion } from 'framer-motion';

export function MessagesRemainingBadge() {
    const creditLimit = useChatStore(state => state.creditLimit);

    if (!creditLimit.isFetched || (creditLimit?.remaining ?? 6) > 5) {
        return null;
    }

    return (
        <div className="relative flex w-full items-center justify-center px-3">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="border-border bg-tertiary/70 -mt-2 flex h-10  w-full flex-row items-center gap-2 rounded-b-xl border-x border-b px-3 pt-2 font-medium"
            >
                <div className="text-muted-foreground/50 text-xs">
                    {creditLimit.remaining === 0
                        ? 'You have no credits left today. Resets tomorrow.'
                        : `You have ${creditLimit.remaining} credits left today.`}
                </div>
            </motion.div>
        </div>
    );
}
