import { jsonrepair } from 'jsonrepair';

/**
 * Parse JSON written by a model. Models regularly emit almost-valid JSON
 * (an unescaped quote like 12" for inches, trailing commas, a stray code
 * fence), so fall back to repairing it before giving up.
 */
export function parseModelJson(content: string): any | undefined {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start < 0 || end <= start) return undefined;
    const text = content.slice(start, end + 1);
    try {
        return JSON.parse(text);
    } catch {
        try {
            return JSON.parse(jsonrepair(text));
        } catch {
            return undefined;
        }
    }
}
