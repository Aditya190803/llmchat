import { hasTinyfish, tinyfishFetch } from './tinyfish';
import { parse } from 'node-html-parser';
import TurndownService from 'turndown';

const turndownService = new TurndownService();

export type TReaderResponse = {
    success: boolean;
    title: string;
    url: string;
    markdown: string;
    error?: string;
};

function cleanHtml(html: string): string {
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<header[\s\S]*?>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[\s\S]*?>[\s\S]*?<\/footer>/gi, '')
        .replace(/<nav[\s\S]*?>[\s\S]*?<\/nav>/gi, '')
        .replace(/<aside[\s\S]*?>[\s\S]*?<\/aside>/gi, '')
        .replace(/<form[\s\S]*?>[\s\S]*?<\/form>/gi, '')
        .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
        .replace(
            /<div[^>]*class\s*=\s*["']?(?:ad|advertisement|banner)["']?[^>]*>[\s\S]*?<\/div>/gi,
            ''
        );
}

export type TReaderResult = {
    success: boolean;
    title?: string;
    url?: string;
    markdown?: string;
};

const MIN_CONTENT_LENGTH = 500;

const readURL = async (url: string, minLength = MIN_CONTENT_LENGTH): Promise<TReaderResult> => {
    try {
        const response = await fetch(url);
        const html = await response.text();
        const cleanedHtml = cleanHtml(html);

        // Use node-html-parser instead of JSDOM
        const root = parse(cleanedHtml);

        // Extract title from HTML
        const titleElement = root.querySelector('title');
        const title = titleElement ? titleElement.text : '';

        // Extract main content
        // This is a simplistic approach - you may need to enhance this
        const mainContent = extractMainContent(root);

        if (mainContent) {
            const markdown = turndownService.turndown(mainContent);

            if (markdown.length >= minLength) {
                return {
                    success: true,
                    title: title,
                    url: url,
                    markdown: markdown,
                };
            } else {
                console.log(`Content too short (${markdown.length} chars). Falling back to Jina.`);
            }
        }
        return { success: false };
    } catch (error) {
        console.error('Error in readURL:', error);
        return { success: false };
    }
};

// Extract main content from HTML
function extractMainContent(root: any): string {
    // First try to find common content containers
    const contentSelectors = [
        'article',
        'main',
        '.content',
        '.post',
        '#content',
        '.article-content',
        '.post-content',
    ];

    for (const selector of contentSelectors) {
        const element = root.querySelector(selector);
        if (element && element.innerHTML.length > 500) {
            return element.innerHTML;
        }
    }

    // If no content container found, return the body content
    const body = root.querySelector('body');
    return body ? body.innerHTML : '';
}

export const readWebPagesWithTimeout = async (
    urls: string[],
    timeoutMs = 60000,
    // A link the user pasted is worth reading even when the page is short;
    // search results are held to the higher bar to skip stubs and walls.
    minLength = MIN_CONTENT_LENGTH,
    purpose?: string
): Promise<TReaderResult[]> => {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    try {
        // TinyFish Fetch extracts cleaner text than the local pass; anything it
        // cannot read falls back to fetching the page here.
        const viaTinyfish = hasTinyfish() ? await tinyfishFetch(urls, purpose) : [];

        const readPromises = urls.map((url, index) => {
            const fetched = viaTinyfish[index];
            if (fetched?.success && (fetched.markdown?.length || 0) >= minLength) {
                return Promise.resolve(fetched);
            }
            return readURL(url, minLength).catch(error => {
                console.error(`Error reading ${url}:`, error);
                return fetched?.success ? fetched : { success: false };
            });
        });

        const results = await Promise.allSettled(readPromises);

        return results.map(result => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                return { success: false };
            }
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            console.log('Reading operation timed out, returning partial results');
        } else {
            console.error('Error in readWebPagesWithTimeout:', error);
        }
        return [];
    } finally {
        clearTimeout(timeoutId);
    }
};
