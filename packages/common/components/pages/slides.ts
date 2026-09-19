/**
 * Slide deck model shared by the in-panel preview and the .pptx exporter.
 * The model emits deck JSON inside a ```page:Title:slides fence; everything
 * here is tolerant of sloppy output so a slightly-off deck still renders.
 */

import { parseModelJson } from './model-json';

export type DeckThemeName = 'light' | 'dark' | 'warm';

export type DeckTheme = {
    bg: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
};

export const DECK_THEMES: Record<DeckThemeName, DeckTheme> = {
    light: { bg: 'FFFFFF', surface: 'F4F4F5', text: '18181B', muted: '71717A', accent: '4F46E5' },
    dark: { bg: '0F172A', surface: '1E293B', text: 'F8FAFC', muted: '94A3B8', accent: '38BDF8' },
    warm: { bg: 'FBF7F2', surface: 'F1E9DF', text: '292524', muted: '78716C', accent: 'C2410C' },
};

export type Column = { heading?: string; bullets: string[] };
export type Stat = { value: string; label: string };

export type Slide = { notes?: string } & (
    | { layout: 'title'; title: string; subtitle?: string }
    | { layout: 'section'; title: string; subtitle?: string }
    | { layout: 'bullets'; title: string; bullets: string[] }
    | { layout: 'two-column'; title: string; left: Column; right: Column }
    | { layout: 'stats'; title: string; stats: Stat[] }
    | { layout: 'quote'; quote: string; author?: string }
    | { layout: 'table'; title: string; columns: string[]; rows: string[][] }
);

export type Deck = { theme: DeckTheme; slides: Slide[] };

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));
const strList = (v: unknown, max = 8): string[] =>
    (Array.isArray(v) ? v : []).map(str).filter(Boolean).slice(0, max);
const hex = (v: unknown): string | undefined => {
    const m = str(v).replace(/^#/, '');
    return /^[0-9a-fA-F]{6}$/.test(m) ? m.toUpperCase() : undefined;
};

const toColumn = (v: any): Column => ({
    heading: str(v?.heading) || undefined,
    bullets: strList(Array.isArray(v) ? v : v?.bullets),
});

function toSlide(raw: any): Slide | null {
    if (!raw || typeof raw !== 'object') return null;
    const notes = str(raw.notes) || undefined;
    const title = str(raw.title);
    const layout = str(raw.layout || raw.type).toLowerCase();

    switch (layout) {
        case 'title':
        case 'cover':
            return {
                layout: 'title',
                title: title || 'Untitled',
                subtitle: str(raw.subtitle) || undefined,
                notes,
            };
        case 'section':
            return {
                layout: 'section',
                title: title || 'Section',
                subtitle: str(raw.subtitle) || undefined,
                notes,
            };
        case 'two-column':
        case 'columns':
        case 'comparison':
            return {
                layout: 'two-column',
                title,
                left: toColumn(raw.left),
                right: toColumn(raw.right),
                notes,
            };
        case 'stats':
        case 'metrics': {
            const stats = (Array.isArray(raw.stats) ? raw.stats : [])
                .map((s: any) => ({ value: str(s?.value), label: str(s?.label) }))
                .filter((s: Stat) => s.value)
                .slice(0, 4);
            if (stats.length) return { layout: 'stats', title, stats, notes };
            break;
        }
        case 'quote':
            if (str(raw.quote)) {
                return {
                    layout: 'quote',
                    quote: str(raw.quote),
                    author: str(raw.author) || undefined,
                    notes,
                };
            }
            break;
        case 'table': {
            const columns = strList(raw.columns, 6);
            const rows = (Array.isArray(raw.rows) ? raw.rows : [])
                .filter(Array.isArray)
                .slice(0, 10)
                .map((r: unknown[]) => columns.map((_, i) => str(r[i])));
            if (columns.length && rows.length)
                return { layout: 'table', title, columns, rows, notes };
            break;
        }
    }
    const bullets = strList(raw.bullets ?? raw.points ?? raw.content);
    if (!title && !bullets.length) return null;
    return { layout: 'bullets', title, bullets, notes };
}

/** Parse deck JSON. Returns null when nothing usable is found. */
export function parseDeck(content: string): Deck | null {
    const data = parseModelJson(content);
    if (!data) return null;
    const slides = (Array.isArray(data?.slides) ? data.slides : [])
        .map(toSlide)
        .filter(Boolean)
        .slice(0, 30) as Slide[];
    if (!slides.length) return null;
    const base = DECK_THEMES[data.theme as DeckThemeName] ?? DECK_THEMES.light;
    return { theme: { ...base, accent: hex(data.accent) ?? base.accent }, slides };
}
