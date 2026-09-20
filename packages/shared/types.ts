import { ChatMode } from './config';

export type Project = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    description: string;
};

export type Thread = {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    pinned: boolean;
    pinnedAt: Date;
    projectId?: string;
};

export type SubStep = {
    data?: any;
    status: ItemStatus;
};

export type ItemStatus = 'QUEUED' | 'PENDING' | 'COMPLETED' | 'ERROR' | 'ABORTED' | 'HUMAN_REVIEW';

export type Step = {
    id: string;
    text?: string;
    steps?: Record<string, SubStep>;
    status: ItemStatus;
};
export type Source = {
    title: string;
    link: string;
    index: number;
    snippet?: string;
};

export type GeneratedImage = {
    data: string;
    mimeType: string;
    alt?: string;
};

export type Answer = {
    text: string;
    finalText?: string;
    images?: GeneratedImage[];
    status?: ItemStatus;
};

export type ToolCall = {
    type: 'tool-call';
    toolCallId: string;
    toolName: string;
    args: any;
};

export type ToolResult = {
    type: 'tool-result';
    toolCallId: string;
    toolName: string;
    args: any;
    result: any;
};

export type ThreadItem = {
    query: string;
    toolCalls?: Record<string, ToolCall>;
    toolResults?: Record<string, ToolResult>;
    steps?: Record<string, Step>;
    answer?: Answer;
    status?: ItemStatus;
    createdAt: Date;
    updatedAt: Date;
    id: string;
    parentId?: string;
    threadId: string;
    metadata?: Record<string, any>;
    mode: ChatMode;
    /** Exact model ID selected in Composer, including live gateway IDs. */
    model?: string;
    error?: string;
    suggestions?: string[];
    persistToDB?: boolean;
    sources?: Source[];
    object?: Record<string, any>;
    imageAttachment?: string;
};

export type MessageGroup = {
    userMessage: ThreadItem;
    assistantMessages: ThreadItem[];
};

/** HTML pages (publishable); the rest download as .pptx/.docx/.xlsx/.md. */
export type PageType = 'html' | 'slides' | 'doc' | 'sheet' | 'md';

export type PageVersion = {
    id: string;
    content: string;
    createdAt: Date;
    label?: string;
};

export type Page = {
    id: string;
    threadId: string;
    /** The answer that produced the current version. */
    threadItemId?: string;
    /** Every answer that produced a version, so each one can link to the page. */
    itemIds?: string[];
    title: string;
    type: PageType;
    /** HTML: full document. Slides/sheets: JSON. Docs and md: markdown. */
    content: string;
    versions: PageVersion[];
    activeVersionId?: string;
    /** Published copy at /pages/:shareId (HTML pages only). */
    shareId?: string;
    /** Version that the published copy currently reflects. */
    publishedVersionId?: string;
    createdAt: Date;
    updatedAt: Date;
};
