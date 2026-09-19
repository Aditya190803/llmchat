import { Page } from '@repo/shared/types';
import { parseWorkbook } from './sheets';
import { parseDeck } from './slides';

/** Scripts run in an opaque origin: no access to the app's cookies or storage. */
export const HTML_SANDBOX = 'allow-scripts allow-popups allow-forms allow-modals';

export const slugify = (title: string) =>
    title
        .replace(/[^\w\- ]+/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase() || 'page';

export const FILE_EXT: Record<Page['type'], string> = {
    html: 'html',
    slides: 'pptx',
    doc: 'docx',
    sheet: 'xlsx',
};

export const downloadLabel = (page: Page) => `Download .${FILE_EXT[page.type]}`;

function saveBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** HTML downloads as-is; the other types render to Office files. */
export async function downloadPage(page: Page) {
    const name = slugify(page.title);
    if (page.type === 'slides') {
        const deck = parseDeck(page.content);
        if (!deck) throw new Error('This deck could not be read. Fix the JSON and try again.');
        const { downloadDeckAsPptx } = await import('./pptx-export');
        await downloadDeckAsPptx(deck, page.title, `${name}.pptx`);
        return;
    }
    if (page.type === 'sheet') {
        const book = parseWorkbook(page.content);
        if (!book) throw new Error('This sheet could not be read. Fix the data and try again.');
        const { downloadWorkbookAsXlsx } = await import('./xlsx-export');
        await downloadWorkbookAsXlsx(book, page.title, `${name}.xlsx`);
        return;
    }
    if (page.type === 'doc') {
        const { downloadMarkdownAsDocx } = await import('./docx-export');
        await downloadMarkdownAsDocx(page.content, page.title, `${name}.docx`);
        return;
    }
    saveBlob(new Blob([page.content], { type: 'text/html;charset=utf-8' }), `${name}.html`);
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * Open an HTML page in a new tab. A blob URL shares the app's origin, so the
 * page runs inside a sandboxed full-viewport iframe instead of directly.
 */
export function openHtmlInNewTab(page: Page) {
    const shell = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeText(page.title)}</title>
<style>html,body,iframe{margin:0;width:100%;height:100%;border:0;display:block}</style></head>
<body><iframe sandbox="${HTML_SANDBOX}" srcdoc="${escapeAttr(page.content)}"></iframe></body></html>`;
    const url = URL.createObjectURL(new Blob([shell], { type: 'text/html;charset=utf-8' }));
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export class PublishError extends Error {
    constructor(
        message: string,
        readonly needsSignIn = false
    ) {
        super(message);
    }
}

export async function publishPage(page: Page): Promise<string> {
    const res = await fetch('/api/pages/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: page.title, content: page.content, shareId: page.shareId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new PublishError('Publishing needs an account.', true);
    if (!res.ok || !data.id) throw new PublishError(data.error || 'Could not publish right now.');
    return data.id as string;
}

export const signInHref = (next: string) => `/admin/login?next=${encodeURIComponent(next)}`;

export const publishedUrl = (shareId: string) => `${window.location.origin}/pages/${shareId}`;
