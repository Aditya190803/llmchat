'use client';

import { usePageStore } from '@repo/common/store';
import { Page } from '@repo/shared/types';
import {
    Button,
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Popover,
    PopoverContent,
    PopoverTrigger,
    toast,
} from '@repo/ui';
import {
    IconArrowsDiagonal,
    IconArrowsDiagonalMinimize2,
    IconCheck,
    IconChevronDown,
    IconChevronLeft,
    IconCopy,
    IconDots,
    IconDownload,
    IconExternalLink,
    IconLoader2,
    IconPencil,
    IconTrash,
    IconWorld,
    IconX,
} from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
    downloadLabel,
    downloadPage,
    FILE_EXT,
    openHtmlInNewTab,
    PublishError,
    publishedUrl,
    publishPage,
    signInHref,
} from './page-actions';
import { PageTypeIcon, pageTypeLabel } from './page-card';
import { PageViewer } from './page-viewer';

const relativeTime = (date: Date) => {
    const s = Math.round((Date.now() - +new Date(date)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return new Date(date).toLocaleDateString();
};

/** Formats whose source is worth copying; decks and sheets are their file. */
const SOURCE_LABEL: Partial<Record<Page['type'], string>> = {
    html: 'HTML',
    doc: 'Markdown',
};

const copyText = async (text: string, what: string) => {
    try {
        await navigator.clipboard.writeText(text);
        toast({ title: `${what} copied` });
    } catch {
        toast({ title: 'Clipboard unavailable', variant: 'destructive' });
    }
};

/** Keeps the page store in sync with the thread in the URL. */
const useThreadPages = () => {
    const pathname = usePathname();
    const loadPages = usePageStore(s => s.loadPages);
    const threadId = pathname.startsWith('/chat/') ? pathname.split('/')[2] || null : null;
    useEffect(() => {
        loadPages(threadId);
    }, [threadId, loadPages]);
};

const Title = ({ page }: { page: Page }) => {
    const renamePage = usePageStore(s => s.renamePage);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(page.title);

    const commit = () => {
        if (draft.trim() && draft.trim() !== page.title) renamePage(page.id, draft);
        setEditing(false);
    };

    if (editing) {
        return (
            <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') setEditing(false);
                }}
                maxLength={120}
                aria-label="Page title"
                className="border-border bg-background min-w-0 flex-1 rounded-md border px-2 py-1 text-sm font-medium outline-none"
                autoFocus
            />
        );
    }
    return (
        <button
            className="hover:bg-quaternary group flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left"
            title="Rename"
            onClick={() => {
                setDraft(page.title);
                setEditing(true);
            }}
        >
            <span className="truncate text-sm font-medium">{page.title}</span>
            <IconPencil
                size={12}
                strokeWidth={2}
                className="text-muted-foreground shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            />
        </button>
    );
};

const VersionMenu = ({ page }: { page: Page }) => {
    const restoreVersion = usePageStore(s => s.restoreVersion);
    const current = page.versions.find(v => v.id === page.activeVersionId);
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    size="xs"
                    variant="ghost"
                    className="gap-1 px-1.5"
                    tooltip="Version history"
                >
                    {current?.label ?? `v${page.versions.length}`}
                    <IconChevronDown size={12} strokeWidth={2} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 w-60 overflow-y-auto">
                <DropdownMenuLabel>Versions</DropdownMenuLabel>
                {[...page.versions].reverse().map(v => {
                    const active = v.id === page.activeVersionId;
                    return (
                        <DropdownMenuItem
                            key={v.id}
                            onSelect={() => !active && restoreVersion(page.id, v.id)}
                            className="flex items-center gap-2"
                        >
                            <span className="flex w-4 justify-center">
                                {active && <IconCheck size={14} strokeWidth={2.5} />}
                            </span>
                            <span className="font-medium">{v.label}</span>
                            <span className="text-muted-foreground ml-auto text-xs">
                                {relativeTime(v.createdAt)}
                            </span>
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

const PublishButton = ({ page }: { page: Page }) => {
    const markPublished = usePageStore(s => s.markPublished);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<PublishError | null>(null);
    const upToDate = !!page.shareId && page.publishedVersionId === page.activeVersionId;

    const publish = async () => {
        setBusy(true);
        setError(null);
        try {
            const id = await publishPage(page);
            await markPublished(page.id, id);
        } catch (e) {
            setError(
                e instanceof PublishError ? e : new PublishError('Could not publish right now.')
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button size="xs" variant={page.shareId ? 'secondary' : 'default'}>
                    <IconWorld size={14} strokeWidth={2} />
                    {page.shareId ? 'Published' : 'Publish'}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={6} className="w-80 p-4">
                <p className="text-sm font-semibold">
                    {page.shareId ? 'Published to the web' : 'Publish to the web'}
                </p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    Anyone with the link can view this page. It runs sandboxed, apart from your
                    account.
                </p>

                {page.shareId && (
                    <div className="border-border bg-secondary mt-3 flex items-center gap-1 rounded-lg border p-1 pl-2.5">
                        <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                            {publishedUrl(page.shareId).replace(/^https?:\/\//, '')}
                        </span>
                        <Button
                            size="icon-xs"
                            variant="ghost"
                            tooltip="Copy link"
                            aria-label="Copy link"
                            onClick={() => copyText(publishedUrl(page.shareId!), 'Link')}
                        >
                            <IconCopy size={14} strokeWidth={2} />
                        </Button>
                        <Button
                            size="icon-xs"
                            variant="ghost"
                            tooltip="Open"
                            aria-label="Open"
                            asChild
                        >
                            <a href={publishedUrl(page.shareId)} target="_blank" rel="noreferrer">
                                <IconExternalLink size={14} strokeWidth={2} />
                            </a>
                        </Button>
                    </div>
                )}

                {error && (
                    <p className="text-destructive mt-3 text-xs">
                        {error.message}{' '}
                        {error.needsSignIn && (
                            <a
                                href={signInHref(window.location.pathname)}
                                className="font-medium underline"
                            >
                                Sign in
                            </a>
                        )}
                    </p>
                )}

                <div className="mt-3 flex items-center justify-end gap-2">
                    {upToDate ? (
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                            <IconCheck size={14} strokeWidth={2} />
                            Latest version is live
                        </span>
                    ) : (
                        <Button size="sm" onClick={publish} disabled={busy}>
                            {busy && <IconLoader2 size={14} className="animate-spin" />}
                            {page.shareId ? 'Publish changes' : 'Publish'}
                        </Button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
};

const DownloadButton = ({ page }: { page: Page }) => {
    const [busy, setBusy] = useState(false);
    const download = async () => {
        setBusy(true);
        try {
            await downloadPage(page);
        } catch (e) {
            toast({
                title: 'Download failed',
                description: e instanceof Error ? e.message : undefined,
                variant: 'destructive',
            });
        } finally {
            setBusy(false);
        }
    };
    return (
        <Button
            size="xs"
            variant={page.type === 'html' ? 'secondary' : 'default'}
            onClick={download}
            disabled={busy}
        >
            {busy ? (
                <IconLoader2 size={14} className="animate-spin" />
            ) : (
                <IconDownload size={14} strokeWidth={2} />
            )}
            {FILE_EXT[page.type].toUpperCase()}
        </Button>
    );
};

const MoreMenu = ({ page }: { page: Page }) => {
    const deletePage = usePageStore(s => s.deletePage);
    const [confirming, setConfirming] = useState(false);
    return (
        <DropdownMenu onOpenChange={open => !open && setConfirming(false)}>
            <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" tooltip="More" aria-label="More">
                    <IconDots size={16} strokeWidth={2} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
                {page.type === 'html' && (
                    <DropdownMenuItem onSelect={() => openHtmlInNewTab(page)}>
                        <IconExternalLink size={14} strokeWidth={2} />
                        Open in new tab
                    </DropdownMenuItem>
                )}
                {SOURCE_LABEL[page.type] && (
                    <DropdownMenuItem
                        onSelect={() => copyText(page.content, SOURCE_LABEL[page.type]!)}
                    >
                        <IconCopy size={14} strokeWidth={2} />
                        Copy {SOURCE_LABEL[page.type]}
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => downloadPage(page)}>
                    <IconDownload size={14} strokeWidth={2} />
                    {downloadLabel(page)}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onSelect={e => {
                        if (!confirming) {
                            e.preventDefault();
                            setConfirming(true);
                            return;
                        }
                        deletePage(page.id);
                    }}
                    className="text-destructive focus:text-destructive"
                >
                    <IconTrash size={14} strokeWidth={2} />
                    {confirming ? 'Click again to delete' : 'Delete page'}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

const PageList = ({ pages }: { pages: Page[] }) => {
    const openPage = usePageStore(s => s.openPage);
    return (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {pages.map(p => (
                <button
                    key={p.id}
                    onClick={() => openPage(p.id)}
                    className="hover:bg-quaternary flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
                >
                    <span className="bg-tertiary text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                        <PageTypeIcon type={p.type} size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.title}</span>
                        <span className="text-muted-foreground block text-xs">
                            {pageTypeLabel(p.type)} · {relativeTime(p.updatedAt)}
                            {p.shareId && ' · Published'}
                        </span>
                    </span>
                </button>
            ))}
        </div>
    );
};

export function PagesPanel() {
    useThreadPages();
    const live = usePageStore(s => s.live);
    const pages = usePageStore(s => s.pages);
    const activePageId = usePageStore(s => s.activePageId);
    const panelOpen = usePageStore(s => s.panelOpen);
    const expanded = usePageStore(s => s.expanded);
    const setPanelOpen = usePageStore(s => s.setPanelOpen);
    const setExpanded = usePageStore(s => s.setExpanded);
    const showList = usePageStore(s => s.showList);

    // A single page needs no list: open it directly.
    const stored = pages.find(p => p.id === activePageId) ?? (pages.length === 1 ? pages[0] : null);
    // While a page streams it takes over the panel, as a page without history.
    const active: Page | null = live
        ? {
              id: 'live',
              threadId: '',
              title: live.title,
              type: live.type,
              content: live.content,
              versions: [],
              createdAt: new Date(),
              updatedAt: new Date(),
          }
        : stored;

    useEffect(() => {
        if (!panelOpen) return;
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const typing = target?.closest('input, textarea, [contenteditable="true"]');
            if (e.key === 'Escape' && !typing && !document.querySelector('[role="dialog"]')) {
                setPanelOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [panelOpen, setPanelOpen]);

    return (
        <AnimatePresence>
            {panelOpen && (pages.length > 0 || live) && (
                <motion.aside
                    key="pages-panel"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                    aria-label="Pages"
                    className={cn(
                        'bg-background border-border flex flex-col',
                        // z-[45]: above the shell's top fade (z-40), below popovers and menus (z-50).
                        'z-[45]',
                        expanded
                            ? 'absolute inset-0'
                            : 'max-lg:fixed max-lg:inset-0 lg:relative lg:w-[min(55%,780px)] lg:shrink-0 lg:border-l'
                    )}
                >
                    <header className="border-border flex h-12 shrink-0 items-center gap-1 border-b px-2">
                        {active && !live && pages.length > 1 && (
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                tooltip="All pages"
                                aria-label="All pages"
                                onClick={showList}
                            >
                                <IconChevronLeft size={16} strokeWidth={2} />
                            </Button>
                        )}
                        {active ? (
                            <>
                                <span className="text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center">
                                    <PageTypeIcon type={active.type} size={16} />
                                </span>
                                {live ? (
                                    <>
                                        <span className="min-w-0 flex-1 truncate px-1.5 text-sm font-medium">
                                            {live.title}
                                        </span>
                                        <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
                                            <IconLoader2 size={13} className="animate-spin" />
                                            Generating
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <Title key={active.id} page={active} />
                                        <VersionMenu page={active} />
                                        <span className="bg-border mx-1 h-4 w-px shrink-0" />
                                        <DownloadButton page={active} />
                                        {active.type === 'html' && <PublishButton page={active} />}
                                        <MoreMenu page={active} />
                                    </>
                                )}
                            </>
                        ) : (
                            <span className="flex-1 px-2 text-sm font-medium">
                                Pages{' '}
                                <span className="text-muted-foreground font-normal">
                                    {pages.length}
                                </span>
                            </span>
                        )}
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            className="hidden lg:inline-flex"
                            tooltip={expanded ? 'Exit full width' : 'Full width'}
                            aria-label={expanded ? 'Exit full width' : 'Full width'}
                            onClick={() => setExpanded(!expanded)}
                        >
                            {expanded ? (
                                <IconArrowsDiagonalMinimize2 size={16} strokeWidth={2} />
                            ) : (
                                <IconArrowsDiagonal size={16} strokeWidth={2} />
                            )}
                        </Button>
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            tooltip="Close (Esc)"
                            aria-label="Close (Esc)"
                            onClick={() => setPanelOpen(false)}
                        >
                            <IconX size={16} strokeWidth={2} />
                        </Button>
                    </header>

                    {active ? (
                        <div className="min-h-0 flex-1">
                            <PageViewer
                                page={active}
                                streaming={!!live}
                                key={live ? 'live' : `${active.id}:${active.activeVersionId}`}
                            />
                        </div>
                    ) : (
                        <PageList pages={pages} />
                    )}
                </motion.aside>
            )}
        </AnimatePresence>
    );
}

/** Reopens the panel once it has been closed. */
export function PagesToggle() {
    const count = usePageStore(s => s.pages.length);
    const panelOpen = usePageStore(s => s.panelOpen);
    const setPanelOpen = usePageStore(s => s.setPanelOpen);
    if (panelOpen || !count) return null;
    return (
        <Button
            size="xs"
            variant="bordered"
            rounded="full"
            onClick={() => setPanelOpen(true)}
            className="absolute right-4 top-3 z-50 px-3"
        >
            <PageTypeIcon type="html" size={14} />
            Pages
            <span className="text-muted-foreground font-normal">{count}</span>
        </Button>
    );
}
