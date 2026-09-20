'use client';

import { usePageStore } from '@repo/common/store';
import { Page } from '@repo/shared/types';
import { Button, cn } from '@repo/ui';
import {
    IconAlertTriangle,
    IconChevronLeft,
    IconChevronRight,
    IconDeviceDesktop,
    IconDeviceMobile,
    IconLoader2,
    IconPlayerPlay,
    IconRefresh,
    IconX,
} from '@tabler/icons-react';
import {
    Children,
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ComponentProps,
    type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { HTML_SANDBOX } from './page-actions';
import { SlideView } from './slide-view';
import { isFormula, parseWorkbook } from './sheets';
import { parseDeck, type Deck } from './slides';

type Tab = 'preview' | 'source';

type ViewerProps = { page: Page; streaming?: boolean };

const StreamingBadge = () => (
    <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <span className="bg-brand size-1.5 animate-pulse rounded-full" />
        Writing…
    </span>
);

const Segmented = <T extends string>({
    value,
    onChange,
    options,
}: {
    value: T;
    onChange: (v: T) => void;
    options: { value: T; label: ReactNode; title?: string }[];
}) => (
    <div className="bg-tertiary flex items-center rounded-lg p-0.5">
        {options.map(o => (
            <button
                key={o.value}
                type="button"
                title={o.title}
                aria-label={o.title}
                aria-pressed={value === o.value}
                onClick={() => onChange(o.value)}
                className={cn(
                    'flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors',
                    value === o.value
                        ? 'bg-background text-foreground shadow-subtle-xs'
                        : 'text-muted-foreground hover:text-foreground'
                )}
            >
                {o.label}
            </button>
        ))}
    </div>
);

/** Follows the end of the content while a page streams in. */
const useFollowStream = (dep: unknown, streaming?: boolean) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (streaming && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [dep, streaming]);
    return ref;
};

/** Re-renders a live HTML preview at most once per interval. */
const useThrottled = (value: string, streaming: boolean | undefined, ms = 1000) => {
    const [shown, setShown] = useState(value);
    useEffect(() => {
        if (!streaming) {
            setShown(value);
            return;
        }
        const t = setTimeout(() => setShown(value), ms);
        return () => clearTimeout(t);
    }, [value, streaming, ms]);
    return streaming ? shown : value;
};

const BuildingState = ({ label }: { label: string }) => (
    <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-8 text-sm">
        <IconLoader2 size={20} className="animate-spin" />
        {label}
    </div>
);

/** Read-only source while a page streams; editing waits until it is complete. */
const LiveSource = ({
    content,
    scrollRef,
}: {
    content: string;
    scrollRef?: React.RefObject<HTMLDivElement | null>;
}) => (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        <pre className="whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed">{content}</pre>
    </div>
);

const Toolbar = ({ children }: { children: ReactNode }) => (
    <div className="border-border flex h-10 shrink-0 items-center gap-2 border-b px-3">
        {children}
    </div>
);

const SourceEditor = ({
    page,
    language,
    validate,
}: {
    page: Page;
    language: string;
    validate?: (content: string) => string | null;
}) => {
    const updatePageContent = usePageStore(s => s.updatePageContent);
    const [draft, setDraft] = useState(page.content);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        setDraft(page.content);
        setError(null);
    }, [page.content]);

    const dirty = draft !== page.content;
    const save = () => {
        const problem = validate?.(draft) ?? null;
        setError(problem);
        if (!problem) updatePageContent(page.id, draft);
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                        e.preventDefault();
                        if (dirty) save();
                    }
                }}
                spellCheck={false}
                aria-label={`${language} source`}
                className="bg-background min-h-0 flex-1 resize-none p-4 font-mono text-xs leading-relaxed outline-none"
            />
            <div className="border-border flex h-11 shrink-0 items-center gap-2 border-t px-3">
                {error ? (
                    <span className="text-destructive flex min-w-0 items-center gap-1.5 text-xs">
                        <IconAlertTriangle size={14} strokeWidth={2} className="shrink-0" />
                        <span className="truncate">{error}</span>
                    </span>
                ) : (
                    <span className="text-muted-foreground text-xs">
                        {dirty ? 'Unsaved changes' : `${language} · saving creates a new version`}
                    </span>
                )}
                <span className="flex-1" />
                {dirty && (
                    <>
                        <Button size="xs" variant="ghost" onClick={() => setDraft(page.content)}>
                            Discard
                        </Button>
                        <Button size="xs" variant="default" onClick={save}>
                            Save version
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
};

const HtmlViewer = memo(({ page, streaming }: ViewerProps) => {
    // A half-written document renders as a blank page, so follow the code while
    // it streams and switch to the preview once it is complete.
    const [tab, setTab] = useState<Tab>(streaming ? 'source' : 'preview');
    const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
    const [reloadKey, setReloadKey] = useState(0);
    const shown = useThrottled(page.content, streaming);
    const codeRef = useFollowStream(page.content, streaming);
    const wasStreaming = useRef(streaming);
    useEffect(() => {
        if (wasStreaming.current && !streaming) setTab('preview');
        wasStreaming.current = streaming;
    }, [streaming]);

    return (
        <div className="flex h-full flex-col">
            <Toolbar>
                <Segmented
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'preview', label: 'Preview' },
                        { value: 'source', label: streaming ? 'Code (live)' : 'Code' },
                    ]}
                />
                <span className="flex-1" />
                {streaming && <StreamingBadge />}
                {tab === 'preview' && !streaming && (
                    <>
                        <Segmented
                            value={device}
                            onChange={setDevice}
                            options={[
                                {
                                    value: 'desktop',
                                    title: 'Desktop width',
                                    label: <IconDeviceDesktop size={14} strokeWidth={2} />,
                                },
                                {
                                    value: 'mobile',
                                    title: 'Mobile width',
                                    label: <IconDeviceMobile size={14} strokeWidth={2} />,
                                },
                            ]}
                        />
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            tooltip="Reload preview"
                            aria-label="Reload preview"
                            onClick={() => setReloadKey(k => k + 1)}
                        >
                            <IconRefresh size={14} strokeWidth={2} />
                        </Button>
                    </>
                )}
            </Toolbar>
            {tab === 'preview' ? (
                <div
                    className={cn(
                        'min-h-0 flex-1',
                        device === 'mobile' && 'bg-tertiary flex justify-center overflow-auto p-4'
                    )}
                >
                    <iframe
                        key={reloadKey}
                        title={page.title}
                        sandbox={HTML_SANDBOX}
                        srcDoc={shown}
                        className={cn(
                            'h-full border-0 bg-white',
                            device === 'mobile'
                                ? 'border-border w-[390px] shrink-0 rounded-xl border shadow-lg'
                                : 'w-full'
                        )}
                    />
                </div>
            ) : streaming ? (
                <LiveSource content={page.content} scrollRef={codeRef} />
            ) : (
                <SourceEditor page={page} language="HTML" />
            )}
        </div>
    );
});
HtmlViewer.displayName = 'HtmlViewer';

const Presenter = ({
    deck,
    start,
    onClose,
}: {
    deck: Deck;
    start: number;
    onClose: () => void;
}) => {
    const [i, setI] = useState(start);
    const rootRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    const last = deck.slides.length - 1;

    // Real fullscreen when the browser allows it; leaving fullscreen (Esc) exits.
    useEffect(() => {
        const el = rootRef.current;
        el?.requestFullscreen?.().catch(() => undefined);
        const onChange = () => {
            if (!document.fullscreenElement) closeRef.current();
        };
        document.addEventListener('fullscreenchange', onChange);
        return () => {
            document.removeEventListener('fullscreenchange', onChange);
            if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
        };
    }, []);
    const go = useCallback((d: number) => setI(n => Math.min(last, Math.max(0, n + d))), [last]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(e.key)) go(1);
            else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) go(-1);
            else return;
            e.preventDefault();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [go, onClose]);

    // Portal to <body>: the panel is transformed (animation), which would trap a
    // fixed overlay inside it and under the sidebar.
    return createPortal(
        <div
            ref={rootRef}
            className="fixed inset-0 z-[200] flex flex-col bg-black"
            role="dialog"
            aria-label="Presentation"
        >
            <div
                className="flex min-h-0 flex-1 items-center justify-center p-4"
                onClick={() => go(1)}
            >
                <div className="w-full max-w-[calc((100dvh-6rem)*16/9)]">
                    <SlideView
                        slide={deck.slides[i]}
                        theme={deck.theme}
                        index={i}
                        total={deck.slides.length}
                    />
                </div>
            </div>
            <div className="flex h-14 shrink-0 items-center justify-center gap-3 text-white/70">
                <button
                    className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-30"
                    onClick={() => go(-1)}
                    disabled={i === 0}
                    aria-label="Previous slide"
                >
                    <IconChevronLeft size={18} />
                </button>
                <span className="w-16 text-center text-sm tabular-nums">
                    {i + 1} / {deck.slides.length}
                </span>
                <button
                    className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-30"
                    onClick={() => go(1)}
                    disabled={i === last}
                    aria-label="Next slide"
                >
                    <IconChevronRight size={18} />
                </button>
                <button
                    className="absolute right-4 rounded-lg p-2 hover:bg-white/10"
                    onClick={onClose}
                    aria-label="Exit presentation"
                >
                    <IconX size={18} />
                </button>
            </div>
        </div>,
        document.body
    );
};

const validateDeck = (content: string) =>
    parseDeck(content) ? null : 'Not a valid deck: expected JSON with a "slides" array.';

const SlidesViewer = memo(({ page, streaming }: ViewerProps) => {
    const deck = useMemo(() => parseDeck(page.content), [page.content]);
    const [tab, setTab] = useState<Tab>(deck || streaming ? 'preview' : 'source');
    const [presenting, setPresenting] = useState<number | null>(null);
    const listRef = useFollowStream(deck?.slides.length, streaming);

    return (
        <div className="flex h-full flex-col">
            <Toolbar>
                <Segmented
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'preview', label: 'Slides' },
                        { value: 'source', label: 'JSON' },
                    ]}
                />
                {deck && (
                    <span className="text-muted-foreground text-xs">
                        {deck.slides.length} slides
                    </span>
                )}
                <span className="flex-1" />
                {streaming && <StreamingBadge />}
                {deck && tab === 'preview' && !streaming && (
                    <Button size="xs" variant="secondary" onClick={() => setPresenting(0)}>
                        <IconPlayerPlay size={14} strokeWidth={2} />
                        Present
                    </Button>
                )}
            </Toolbar>
            {tab === 'source' ? (
                <SourceEditor page={page} language="Deck JSON" validate={validateDeck} />
            ) : deck ? (
                <div ref={listRef} className="bg-tertiary min-h-0 flex-1 overflow-y-auto">
                    <ol className="mx-auto flex max-w-3xl flex-col gap-5 p-5">
                        {deck.slides.map((slide, i) => (
                            <li key={i} className="group">
                                <div className="text-muted-foreground mb-1.5 flex items-center justify-between text-[11px] font-medium">
                                    <span>Slide {i + 1}</span>
                                    {!streaming && (
                                        <button
                                            className="hover:text-foreground flex items-center gap-1 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                                            onClick={() => setPresenting(i)}
                                        >
                                            <IconPlayerPlay size={12} strokeWidth={2} />
                                            Present from here
                                        </button>
                                    )}
                                </div>
                                <div className="border-border shadow-subtle-xs overflow-hidden rounded-lg border">
                                    <SlideView
                                        slide={slide}
                                        theme={deck.theme}
                                        index={i}
                                        total={deck.slides.length}
                                    />
                                </div>
                                {slide.notes && (
                                    <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                                        <span className="text-foreground font-medium">Notes: </span>
                                        {slide.notes}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ol>
                </div>
            ) : streaming ? (
                <BuildingState label="Laying out the first slide…" />
            ) : (
                <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm">
                    <IconAlertTriangle size={22} strokeWidth={1.5} />
                    <p>This deck couldn&apos;t be read.</p>
                    <Button size="xs" variant="secondary" onClick={() => setTab('source')}>
                        Fix the JSON
                    </Button>
                </div>
            )}
            {deck && presenting !== null && (
                <Presenter deck={deck} start={presenting} onClose={() => setPresenting(null)} />
            )}
        </div>
    );
});
SlidesViewer.displayName = 'SlidesViewer';

// Models often put <br> inside table cells. Markdown renders raw HTML as text,
// so swap it for a marker and turn the marker back into real line breaks.
const BR = '⁣';
const withBreaks = (markdown: string) => markdown.replace(/<br\s*\/?>/gi, BR);
const renderBreaks = (children: ReactNode): ReactNode =>
    Children.map(children, child =>
        typeof child === 'string' && child.includes(BR)
            ? child.split(BR).flatMap((part, i) => (i ? [<br key={i} />, part] : [part]))
            : child
    );
const withBreakSupport =
    (Tag: 'td' | 'th' | 'p' | 'li') =>
    ({ children, node: _node, ...props }: ComponentProps<typeof Tag> & { node?: unknown }) => (
        <Tag {...(props as object)}>{renderBreaks(children)}</Tag>
    );
const docComponents = {
    td: withBreakSupport('td'),
    th: withBreakSupport('th'),
    p: withBreakSupport('p'),
    li: withBreakSupport('li'),
};

const DocViewer = memo(({ page, streaming }: ViewerProps) => {
    const [tab, setTab] = useState<Tab>('preview');
    const pageRef = useFollowStream(page.content, streaming);
    return (
        <div className="flex h-full flex-col">
            <Toolbar>
                <Segmented
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'preview', label: 'Document' },
                        { value: 'source', label: streaming ? 'Markdown (live)' : 'Markdown' },
                    ]}
                />
                <span className="flex-1" />
                {streaming ? (
                    <StreamingBadge />
                ) : (
                    <span className="text-muted-foreground text-xs">Downloads as a Word file</span>
                )}
            </Toolbar>
            {tab === 'source' ? (
                streaming ? (
                    <LiveSource content={page.content} />
                ) : (
                    <SourceEditor page={page} language="Markdown" />
                )
            ) : (
                <div ref={pageRef} className="bg-tertiary min-h-0 flex-1 overflow-y-auto p-6">
                    {/* Letter-width sheet with ~1in margins, like the exported file. */}
                    <article className="bg-background border-border shadow-subtle-xs prose prose-sm prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-lg prose-table:text-sm prose-th:bg-tertiary prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-table:border prose-th:border prose-td:border mx-auto min-h-full max-w-[816px] rounded-md border px-[72px] py-16">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={docComponents}>
                            {withBreaks(page.content)}
                        </ReactMarkdown>
                    </article>
                </div>
            )}
        </div>
    );
});
DocViewer.displayName = 'DocViewer';

const validateWorkbook = (content: string) =>
    parseWorkbook(content) ? null : 'Not a valid sheet: expected JSON with "sheets", or CSV.';

const SheetViewer = memo(({ page, streaming }: ViewerProps) => {
    const book = useMemo(() => parseWorkbook(page.content), [page.content]);
    const [tab, setTab] = useState<Tab>(book || streaming ? 'preview' : 'source');
    const [active, setActive] = useState(0);
    const gridRef = useFollowStream(page.content, streaming);
    const sheet = book?.sheets[Math.min(active, book.sheets.length - 1)];

    return (
        <div className="flex h-full flex-col">
            <Toolbar>
                <Segmented
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'preview', label: 'Sheet' },
                        { value: 'source', label: 'Data' },
                    ]}
                />
                <span className="flex-1" />
                {streaming && <StreamingBadge />}
                {sheet && (
                    <span className="text-muted-foreground text-xs">
                        {sheet.rows.length} rows ×{' '}
                        {Math.max(sheet.columns.length, ...sheet.rows.map(r => r.length))} columns
                    </span>
                )}
            </Toolbar>
            {tab === 'source' ? (
                streaming ? (
                    <LiveSource content={page.content} />
                ) : (
                    <SourceEditor page={page} language="Sheet JSON" validate={validateWorkbook} />
                )
            ) : sheet ? (
                <>
                    <div ref={gridRef} className="min-h-0 flex-1 overflow-auto">
                        <table className="min-w-full border-separate border-spacing-0 text-sm">
                            <thead className="sticky top-0 z-10">
                                <tr>
                                    <th className="bg-tertiary border-border sticky left-0 w-10 border-b border-r" />
                                    {sheet.columns.map((col, c) => (
                                        <th
                                            key={c}
                                            className="bg-tertiary border-border whitespace-nowrap border-b border-r px-3 py-2 text-left text-xs font-semibold"
                                        >
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sheet.rows.map((row, r) => (
                                    <tr key={r} className="hover:bg-secondary/60">
                                        <td className="bg-tertiary text-muted-foreground border-border sticky left-0 border-b border-r px-2 py-1.5 text-center text-[11px] tabular-nums">
                                            {r + 1}
                                        </td>
                                        {Array.from(
                                            { length: Math.max(sheet.columns.length, row.length) },
                                            (_, c) => {
                                                const v = row[c];
                                                return (
                                                    <td
                                                        key={c}
                                                        className={cn(
                                                            'border-border max-w-[320px] border-b border-r px-3 py-1.5 align-top',
                                                            typeof v === 'number' &&
                                                                'text-right tabular-nums',
                                                            isFormula(v ?? null) &&
                                                                'text-muted-foreground font-mono text-xs italic'
                                                        )}
                                                        title={
                                                            isFormula(v ?? null)
                                                                ? 'Formula, calculated in Excel'
                                                                : undefined
                                                        }
                                                    >
                                                        {v === null || v === undefined
                                                            ? ''
                                                            : String(v)}
                                                    </td>
                                                );
                                            }
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {book.sheets.length > 1 && (
                        <div className="border-border bg-tertiary flex shrink-0 gap-0.5 overflow-x-auto border-t px-2 py-1">
                            {book.sheets.map((s, i) => (
                                <button
                                    key={s.name}
                                    onClick={() => setActive(i)}
                                    className={cn(
                                        'rounded-md px-3 py-1 text-xs font-medium',
                                        i === active
                                            ? 'bg-background shadow-subtle-xs text-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>
                    )}
                </>
            ) : streaming ? (
                <BuildingState label="Waiting for the first rows…" />
            ) : (
                <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm">
                    <IconAlertTriangle size={22} strokeWidth={1.5} />
                    <p>This sheet couldn&apos;t be read.</p>
                    <Button size="xs" variant="secondary" onClick={() => setTab('source')}>
                        Fix the data
                    </Button>
                </div>
            )}
        </div>
    );
});
SheetViewer.displayName = 'SheetViewer';

export function PageViewer({ page, streaming }: ViewerProps) {
    if (page.type === 'slides') return <SlidesViewer page={page} streaming={streaming} />;
    if (page.type === 'doc') return <DocViewer page={page} streaming={streaming} />;
    if (page.type === 'sheet') return <SheetViewer page={page} streaming={streaming} />;
    return <HtmlViewer page={page} streaming={streaming} />;
}
