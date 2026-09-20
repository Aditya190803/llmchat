import { trimMessageHistoryEstimated } from '@repo/ai/models';
import { createTask } from '@repo/orchestrator';
import { ChatMode, DEFAULT_MODEL_FREE } from '@repo/shared/config';
import { WorkflowContextSchema, WorkflowEventSchema } from '../flow';
import { handleError, sendEvents } from '../utils';
export const modeRoutingTask = createTask<WorkflowEventSchema, WorkflowContextSchema>({
    name: 'router',
    execute: async ({ events, context, redirectTo }) => {
        const mode = context?.get('mode') || DEFAULT_MODEL_FREE;
        const { updateStatus } = sendEvents(events);

        const messageHistory = context?.get('messages') || [];
        const trimmedMessageHistory = trimMessageHistoryEstimated(messageHistory, mode);
        context?.set('messages', trimmedMessageHistory.trimmedMessages ?? []);

        if (!trimmedMessageHistory?.trimmedMessages) {
            throw new Error('Maximum message history reached');
        }

        updateStatus('PENDING');

        if (mode === ChatMode.Deep) {
            redirectTo('refine-query');
        } else {
            redirectTo('completion');
        }
    },
    onError: handleError,
});
