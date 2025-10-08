import type { TReaderResult } from '../reader';

type TruncateOptions = {
    maxResults?: number;
    maxCharsPerResult?: number;
    requireSuccess?: boolean;
};

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_MAX_CHARS_PER_RESULT = 3500;

const truncateText = (text: string, maxChars: number): string => {
    if (!text) return '';
    if (text.length <= maxChars) return text;

    const truncated = text.slice(0, maxChars);
    const lastParagraphBreak = truncated.lastIndexOf('\n\n');
    if (lastParagraphBreak > maxChars * 0.6) {
        return `${truncated.slice(0, lastParagraphBreak).trim()}\n\n...`;
    }

    const lastSentenceBreak = Math.max(
        truncated.lastIndexOf('. '),
        truncated.lastIndexOf('! '),
        truncated.lastIndexOf('? ')
    );

    if (lastSentenceBreak > maxChars * 0.5) {
        return `${truncated.slice(0, lastSentenceBreak + 1).trim()}\n\n...`;
    }

    return `${truncated.trim()}...`;
};

export const prepareReaderResults = (
    results: TReaderResult[],
    options: TruncateOptions = {}
): TReaderResult[] => {
    const {
        maxResults = DEFAULT_MAX_RESULTS,
        maxCharsPerResult = DEFAULT_MAX_CHARS_PER_RESULT,
        requireSuccess = true,
    } = options;

    return results
        .filter(result => {
            if (!result) return false;
            if (requireSuccess && result.success === false) return false;
            return !!result.markdown;
        })
        .slice(0, maxResults)
        .map(result => ({
            ...result,
            markdown: truncateText(result.markdown ?? '', maxCharsPerResult),
        }));
};

type ContentItem = {
    title: string;
    link: string;
    content: string;
};

type TruncateContentOptions = {
    maxItems?: number;
    maxCharsPerItem?: number;
};

const DEFAULT_MAX_CONTENT_ITEMS = 6;
const DEFAULT_MAX_CHARS_PER_ITEM = 4000;

export const prepareWebPageContent = (
    items: ContentItem[],
    options: TruncateContentOptions = {}
): ContentItem[] => {
    const { maxItems = DEFAULT_MAX_CONTENT_ITEMS, maxCharsPerItem = DEFAULT_MAX_CHARS_PER_ITEM } = options;

    return items
        .filter(item => !!item?.content?.trim())
        .slice(0, maxItems)
        .map(item => ({
            ...item,
            content: truncateText(item.content, maxCharsPerItem),
        }));
};
