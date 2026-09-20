import { Geo } from '@vercel/functions';
import { TReaderResult } from './reader';

/*
 * TinyFish Search + Fetch (https://docs.tinyfish.ai). Both are free tiers and
 * need one key, TINYFISH_API_KEY, from agent.tinyfish.ai. Search is the primary
 * web provider; Fetch reads pages better than the local HTML-to-markdown pass
 * because it follows redirects and strips boilerplate server-side.
 */

const SEARCH_URL = process.env.TINYFISH_SEARCH_URL || 'https://api.search.tinyfish.ai';
const FETCH_URL = process.env.TINYFISH_FETCH_URL || 'https://api.fetch.tinyfish.ai';

const SEARCH_TIMEOUT_MS = 15000;
const FETCH_TIMEOUT_MS = 45000;
const MAX_FETCH_URLS = 10;

export const getTinyfishApiKey = () => process.env.TINYFISH_API_KEY?.trim() || '';

export const hasTinyfish = () => !!getTinyfishApiKey();

type TinyfishSearchResult = {
    position?: number;
    site_name?: string;
    title?: string;
    snippet?: string;
    url?: string;
    date?: string;
};

export type WebSearchResult = { title: string; link: string; snippet: string };

const withTimeout = async (ms: number, run: (signal: AbortSignal) => Promise<Response>) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
        return await run(controller.signal);
    } finally {
        clearTimeout(timeout);
    }
};

/** One search per query; results are merged and de-duplicated by URL. */
export const tinyfishSearch = async (
    queries: string[],
    gl?: Geo,
    purpose?: string
): Promise<WebSearchResult[]> => {
    const apiKey = getTinyfishApiKey();
    if (!apiKey) return [];

    const batches = await Promise.all(
        queries.slice(0, 3).map(async query => {
            const url = new URL(SEARCH_URL);
            url.searchParams.set('query', query);
            if (gl?.country) url.searchParams.set('location', gl.country);
            if (purpose) url.searchParams.set('purpose', purpose.slice(0, 2000));

            try {
                const response = await withTimeout(SEARCH_TIMEOUT_MS, signal =>
                    fetch(url, { headers: { 'X-API-Key': apiKey }, signal })
                );
                if (!response.ok) {
                    console.error(
                        'TinyFish search failed',
                        response.status,
                        await response.text().catch(() => '')
                    );
                    return [];
                }
                const data = await response.json();
                return (data?.results || []) as TinyfishSearchResult[];
            } catch (error) {
                console.error('TinyFish search error', error);
                return [];
            }
        })
    );

    const seen = new Set<string>();
    return batches
        .flat()
        .map(result => ({
            title: result.title || result.site_name || result.url || '',
            link: result.url || '',
            snippet: result.snippet || '',
        }))
        .filter(result => {
            if (!result.link || seen.has(result.link)) return false;
            seen.add(result.link);
            return true;
        })
        .slice(0, 10);
};

/** Read pages as markdown. Returns one entry per URL, in the order given. */
export const tinyfishFetch = async (urls: string[], purpose?: string): Promise<TReaderResult[]> => {
    const apiKey = getTinyfishApiKey();
    const wanted = urls.filter(Boolean).slice(0, MAX_FETCH_URLS);
    if (!apiKey || !wanted.length) return [];

    try {
        const response = await withTimeout(FETCH_TIMEOUT_MS, signal =>
            fetch(FETCH_URL, {
                method: 'POST',
                headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    urls: wanted,
                    format: 'markdown',
                    ...(purpose ? { purpose: purpose.slice(0, 2000) } : {}),
                    per_url_timeout_ms: 20000,
                }),
                signal,
            })
        );

        if (!response.ok) {
            console.error(
                'TinyFish fetch failed',
                response.status,
                await response.text().catch(() => '')
            );
            return [];
        }

        const data = await response.json();
        const byUrl = new Map<string, TReaderResult>();
        for (const result of data?.results || []) {
            const markdown = typeof result?.text === 'string' ? result.text : '';
            if (!markdown.trim()) continue;
            byUrl.set(result.url, {
                success: true,
                title: result.title || result.final_url || result.url,
                url: result.final_url || result.url,
                markdown,
            });
        }
        return wanted.map(url => byUrl.get(url) ?? { success: false });
    } catch (error) {
        console.error('TinyFish fetch error', error);
        return [];
    }
};
