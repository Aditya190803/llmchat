'use client';

import { Page, PageType, PageVersion } from '@repo/shared/types';
import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getThreadDb } from './chat.store';

/**
 * Page fences in model output:  ```page:Title:html|slides|doc|sheet|md
 * The closing fence must sit on its own line so inline backticks in HTML
 * don't end the page early.
 */
const PAGE_FENCE_RE =
    /```page:([^:\n]+):(html|slides|doc|sheet|md)[^\n]*\n([\s\S]*?)\n```[ \t]*(?=\n|$)/g;
// A fence still streaming at the end of the text. The header itself may be partial.
const OPEN_FENCE_RE = /```page:([^:\n]*)(?::(html|slides|doc|sheet|md))?[^\n]*(?:\n([\s\S]*))?$/;
// "```p", "```pa", "```pag": a page fence that has only just started streaming.
const PARTIAL_OPENER_RE = /```p(?:a(?:g(?:e)?)?)?$/;

export type ParsedPage = {
    title: string;
    type: PageType;
    content: string;
};

const cleanTitle = (title: string) => title.trim().slice(0, 120) || 'Untitled page';

export function parsePagesFromMarkdown(markdown: string): ParsedPage[] {
    if (!markdown) return [];
    return Array.from(markdown.matchAll(PAGE_FENCE_RE), m => ({
        title: cleanTitle(m[1]),
        type: m[2] as PageType,
        content: m[3].trim(),
    })).filter(p => p.content);
}

/** Remove page fences (complete and still-streaming) from chat text. */
export function stripPageFences(markdown: string): string {
    if (!markdown || !markdown.includes('```p')) return markdown;
    return markdown
        .replace(PAGE_FENCE_RE, '')
        .replace(OPEN_FENCE_RE, '')
        .replace(PARTIAL_OPENER_RE, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export type StreamingPage = { title: string; type: PageType; content: string };

/** A page fence that has started streaming but not closed yet. */
export function getStreamingPage(markdown: string): StreamingPage | null {
    if (!markdown || !markdown.includes('```page:')) return null;
    const m = markdown.replace(PAGE_FENCE_RE, '').match(OPEN_FENCE_RE);
    if (!m) return null;
    return {
        title: cleanTitle(m[1]),
        type: (m[2] as PageType) || 'html',
        content: m[3] || '',
    };
}

const PAGE_TYPES: PageType[] = ['html', 'slides', 'doc', 'sheet', 'md'];
const isPageType = (t: unknown): t is PageType => PAGE_TYPES.includes(t as PageType);

const sortNewestFirst = (pages: Page[]) =>
    [...pages].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

/** The page currently being written, shown live in the panel. */
export type LivePage = StreamingPage & { threadItemId: string };

type PageState = {
    threadId: string | null;
    live: LivePage | null;
    pages: Page[];
    activePageId: string | null;
    panelOpen: boolean;
    expanded: boolean;
};

type PageActions = {
    loadPages: (threadId: string | null) => Promise<void>;
    upsertParsedPages: (args: {
        threadId: string;
        threadItemId: string;
        text: string;
    }) => Promise<void>;
    updatePageContent: (pageId: string, content: string) => Promise<void>;
    renamePage: (pageId: string, title: string) => Promise<void>;
    deletePage: (pageId: string) => Promise<void>;
    restoreVersion: (pageId: string, versionId: string) => Promise<void>;
    markPublished: (pageId: string, shareId: string) => Promise<void>;
    setLivePage: (live: LivePage) => void;
    clearLivePage: (threadItemId?: string) => void;
    openPage: (pageId: string) => void;
    showList: () => void;
    setPanelOpen: (open: boolean) => void;
    setExpanded: (expanded: boolean) => void;
};

export const usePageStore = create<PageState & PageActions>()(
    immer((set, get) => {
        /** Apply a change to a stored page and mirror it into state. */
        const patch = async (pageId: string, change: (page: Page) => Page | null) => {
            const db = getThreadDb();
            const existing = await db.pages.get(pageId);
            if (!existing) return;
            const updated = change(existing);
            if (!updated) return;
            await db.pages.put(updated);
            set(state => {
                const i = state.pages.findIndex(p => p.id === pageId);
                if (i >= 0) state.pages[i] = updated;
            });
        };

        // Labels keep counting up even after old versions are trimmed.
        const newVersion = (content: string, prior: PageVersion[] = []) => ({
            id: nanoid(),
            content,
            createdAt: new Date(),
            label: `v${Math.max(0, ...prior.map(v => parseInt(v.label?.slice(1) ?? '', 10) || 0)) + 1}`,
        });

        return {
            threadId: null,
            live: null,
            pages: [],
            activePageId: null,
            panelOpen: false,
            expanded: false,

            loadPages: async threadId => {
                if (threadId === get().threadId) return;
                set({
                    threadId,
                    pages: [],
                    live: null,
                    activePageId: null,
                    panelOpen: false,
                    expanded: false,
                });
                if (!threadId) return;
                try {
                    const rows = await getThreadDb()
                        .pages.where('threadId')
                        .equals(threadId)
                        .toArray();
                    // Ignore a stale response if the user already switched threads.
                    if (get().threadId !== threadId) return;
                    set({ pages: sortNewestFirst(rows.filter(p => isPageType(p.type))) });
                } catch (e) {
                    console.warn('Failed to load pages', e);
                }
            },

            upsertParsedPages: async ({ threadId, threadItemId, text }) => {
                const parsed = parsePagesFromMarkdown(text);
                if (!parsed.length) return;
                const db = getThreadDb();
                // A regenerated answer reuses its threadItemId: add a version to the
                // existing page instead of creating a duplicate.
                const existing = (await db.pages.where('threadId').equals(threadId).toArray())
                    .filter(p => p.threadItemId === threadItemId)
                    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
                let lastId: string | null = null;
                for (let i = 0; i < parsed.length; i++) {
                    const p = parsed[i];
                    const now = new Date();
                    const prior = existing[i];
                    if (prior && prior.type === p.type) {
                        if (prior.content !== p.content) {
                            const version = newVersion(p.content, prior.versions);
                            await db.pages.put({
                                ...prior,
                                title: p.title,
                                content: p.content,
                                versions: [...prior.versions, version].slice(-20),
                                activeVersionId: version.id,
                                updatedAt: now,
                            });
                        }
                        lastId = prior.id;
                        continue;
                    }
                    const version = newVersion(p.content);
                    const page: Page = {
                        id: nanoid(),
                        threadId,
                        threadItemId,
                        title: p.title,
                        type: p.type,
                        content: p.content,
                        versions: [version],
                        activeVersionId: version.id,
                        createdAt: now,
                        updatedAt: now,
                    };
                    await db.pages.put(page);
                    lastId = page.id;
                }
                // Only surface the panel if the user is still looking at this thread
                // (a new thread's route may not have registered with the store yet).
                const onThread =
                    get().threadId === threadId || window.location.pathname === `/chat/${threadId}`;
                if (!onThread) return;
                const rows = await db.pages.where('threadId').equals(threadId).toArray();
                set({
                    threadId,
                    live: null,
                    pages: sortNewestFirst(rows),
                    activePageId: lastId,
                    panelOpen: true,
                });
            },

            updatePageContent: (pageId, content) =>
                patch(pageId, page => {
                    if (page.content === content) return null;
                    const version = newVersion(content, page.versions);
                    return {
                        ...page,
                        content,
                        versions: [...page.versions, version].slice(-20),
                        activeVersionId: version.id,
                        updatedAt: new Date(),
                    };
                }),

            renamePage: (pageId, title) =>
                patch(pageId, page => ({
                    ...page,
                    title: cleanTitle(title),
                    updatedAt: new Date(),
                })),

            restoreVersion: (pageId, versionId) =>
                patch(pageId, page => {
                    const v = page.versions.find(x => x.id === versionId);
                    return v
                        ? {
                              ...page,
                              content: v.content,
                              activeVersionId: v.id,
                              updatedAt: new Date(),
                          }
                        : null;
                }),

            markPublished: (pageId, shareId) =>
                patch(pageId, page => ({
                    ...page,
                    shareId,
                    publishedVersionId: page.activeVersionId,
                })),

            deletePage: async pageId => {
                await getThreadDb().pages.delete(pageId);
                set(state => {
                    state.pages = state.pages.filter(p => p.id !== pageId);
                    if (state.activePageId === pageId) state.activePageId = null;
                    if (!state.pages.length) state.panelOpen = false;
                });
            },

            // Opens the panel on the first chunk so the page builds in view.
            setLivePage: live =>
                set(state => {
                    // Ignore late chunks for a page that has already been saved.
                    if (state.pages.some(p => p.threadItemId === live.threadItemId)) return;
                    state.live = live;
                    state.panelOpen = true;
                }),
            clearLivePage: threadItemId =>
                set(state => {
                    if (!threadItemId || state.live?.threadItemId === threadItemId) {
                        state.live = null;
                    }
                }),

            openPage: pageId => set({ activePageId: pageId, panelOpen: true }),
            showList: () => set({ activePageId: null }),
            setPanelOpen: open => set({ panelOpen: open }),
            setExpanded: expanded => set({ expanded }),
        };
    })
);
