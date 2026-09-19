import { PostHog } from 'posthog-node';
import { v4 as uuidv4 } from 'uuid';

let client: PostHog | null = null;

const getClient = () => {
    if (client) return client;
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!apiKey) return null;
    client = new PostHog(apiKey, {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    });
    return client;
};

export enum EVENT_TYPES {
    WORKFLOW_SUMMARY = 'workflow_summary',
}

export type PostHogEvent = {
    event: EVENT_TYPES;
    userId: string;
    properties: Record<string, any>;
};

export const posthog = {
    capture: (event: PostHogEvent) => {
        getClient()?.capture({
            distinctId: event?.userId || uuidv4(),
            event: event.event,
            properties: event.properties,
        });
    },
    flush: () => {
        getClient()?.flush();
    },
};
