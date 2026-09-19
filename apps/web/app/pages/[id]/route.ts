import { prisma } from '@repo/prisma';

export const dynamic = 'force-dynamic';

/*
 * Published pages are served as the raw HTML document, outside the app shell.
 * The CSP sandbox gives the document an opaque origin, so its scripts cannot
 * read this site's cookies or storage, while still running normally.
 */
const HEADERS = {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': 'sandbox allow-scripts allow-popups allow-forms allow-modals',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex',
    'Referrer-Policy': 'no-referrer',
};

const NOT_FOUND = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:15px/1.5 system-ui,sans-serif;color:#52525b;background:#fafafa}h1{font-size:18px;color:#18181b;margin:0 0 4px}</style></head>
<body><div><h1>Page not found</h1>This page was removed or the link is wrong.</div></body></html>`;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const page = /^[0-9a-f-]{36}$/i.test(id)
        ? await prisma.sharedPage.findUnique({ where: { id } }).catch(() => null)
        : null;

    if (!page) return new Response(NOT_FOUND, { status: 404, headers: HEADERS });

    return new Response(page.content, {
        headers: { ...HEADERS, 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    });
}
