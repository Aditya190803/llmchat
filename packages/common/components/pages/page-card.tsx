'use client';

import { usePageStore } from '@repo/common/store';
import { Page, PageType, ThreadItem } from '@repo/shared/types';
import { cn } from '@repo/ui';
import {
    IconArrowUpRight,
    IconBrowser,
    IconFileTypeDocx,
    IconFileTypeXls,
    IconMarkdown,
    IconPresentation,
} from '@tabler/icons-react';
import { memo, useMemo } from 'react';
import { parseWorkbook } from './sheets';
import { parseDeck } from './slides';

const TYPE_META: Record<PageType, { label: string; Icon: typeof IconBrowser; building: string }> = {
    html: { label: 'HTML page', Icon: IconBrowser, building: 'page' },
    slides: { label: 'Slide deck', Icon: IconPresentation, building: 'slides' },
    doc: { label: 'Word document', Icon: IconFileTypeDocx, building: 'document' },
    sheet: { label: 'Excel workbook', Icon: IconFileTypeXls, building: 'spreadsheet' },
    md: { label: 'Markdown file', Icon: IconMarkdown, building: 'markdown' },
};

export const pageTypeLabel = (type: PageType) => TYPE_META[type].label;

export const PageTypeIcon = ({ type, size = 16 }: { type: PageType; size?: number }) => {
    const { Icon } = TYPE_META[type];
    return <Icon size={size} strokeWidth={1.75} />;
};

const describe = (page: Page) => {
    if (page.type === 'slides') {
        const n = parseDeck(page.content)?.slides.length;
        return n ? `${n} slides · PowerPoint` : 'Slide deck';
    }
    if (page.type === 'doc') return 'Word document · .docx';
    if (page.type === 'md') return 'Markdown · .md';
    if (page.type === 'sheet') {
        const book = parseWorkbook(page.content);
        const rows = book?.sheets.reduce((n, s) => n + s.rows.length, 0) ?? 0;
        return book ? `${rows} rows · Excel` : 'Excel workbook';
    }
    return page.shareId ? 'HTML page · Published' : 'HTML page';
};

const CardShell = ({
    type,
    title,
    subtitle,
    busy,
    onClick,
}: {
    type: PageType;
    title: string;
    subtitle: string;
    busy?: boolean;
    onClick?: () => void;
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={cn(
            'border-border bg-background group flex w-full max-w-md items-center gap-3 rounded-xl border p-2.5 pr-4 text-left transition-colors',
            onClick && 'hover:border-hard hover:bg-secondary/50'
        )}
    >
        <span
            className={cn(
                'bg-tertiary text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                busy && 'animate-pulse'
            )}
        >
            <PageTypeIcon type={type} size={20} />
        </span>
        <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{title}</span>
            <span className="text-muted-foreground block truncate text-xs">{subtitle}</span>
        </span>
        {onClick && (
            <IconArrowUpRight
                size={16}
                strokeWidth={2}
                className="text-muted-foreground group-hover:text-foreground shrink-0 transition-colors"
            />
        )}
    </button>
);

/** Shown in place of a page fence while it is still streaming. */
export const PageBuildingCard = ({
    title,
    type,
    size,
}: {
    title: string;
    type: PageType;
    size: number;
}) => (
    <CardShell
        type={type}
        title={title}
        busy
        subtitle={`Building ${TYPE_META[type].building}… ${
            size > 1024 ? `${Math.round(size / 1024)} KB` : ''
        }`}
    />
);

/** Links to the pages this answer created. */
export const PageCards = memo(({ threadItem }: { threadItem: ThreadItem }) => {
    const pages = usePageStore(s => s.pages);
    const openPage = usePageStore(s => s.openPage);
    const mine = useMemo(
        () =>
            pages
                .filter(p => p.threadItemId === threadItem.id)
                .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
        [pages, threadItem.id]
    );
    if (!mine.length) return null;
    return (
        <div className="flex flex-col gap-2">
            {mine.map(p => (
                <CardShell
                    key={p.id}
                    type={p.type}
                    title={p.title}
                    subtitle={describe(p)}
                    onClick={() => openPage(p.id)}
                />
            ))}
        </div>
    );
});
PageCards.displayName = 'PageCards';
