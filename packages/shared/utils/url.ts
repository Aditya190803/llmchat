export const getHostname = (url: string) => {
    try {
        const hostname = new URL(url).hostname.split('.')[0];
        if (hostname === 'www') {
            return new URL(url).hostname.split('.')[1];
        }
        return hostname;
    } catch (error) {
        return url;
    }
};

export const getHost = (url: string) => {
    try {
        return new URL(url).hostname;
    } catch (error) {
        return undefined;
    }
};

/** A pasted link means the answer needs the web, whether or not search is on. */
export const URL_IN_TEXT_RE = /https?:\/\/[^\s<>()\[\]"']+/i;

export const containsUrl = (text?: string) => !!text && URL_IN_TEXT_RE.test(text);
