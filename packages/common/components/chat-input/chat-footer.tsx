import { APP_NAME } from '@repo/shared/config';
import { Flex } from '@repo/ui';

export const ChatFooter = () => {
    return (
        <Flex className="w-full p-2" justify="center" gap="xs">
            <p className="text-xs opacity-50">
                {APP_NAME} can be wrong. Check anything that matters.
            </p>
        </Flex>
    );
};
