/**
 * Workbook model shared by the in-panel grid and the .xlsx exporter.
 * The model emits workbook JSON in a ```page:Title:sheet fence. Plain CSV is
 * accepted too, so a model that ignores the JSON format still works.
 */

import { parseModelJson } from './model-json';

export type Cell = string | number | boolean | null;

export type Sheet = { name: string; columns: string[]; rows: Cell[][] };

export type Workbook = { sheets: Sheet[] };

const MAX_ROWS = 2000;
const MAX_COLS = 50;

const toCell = (v: unknown): Cell => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    return String(v);
};

// Excel sheet names: max 31 chars, no []:*?/\ and unique within the workbook.
const sheetName = (raw: unknown, i: number, taken: Set<string>) => {
    let name = (
        String(raw ?? '')
            .replace(/[[\]:*?/\\]/g, ' ')
            .trim() || `Sheet${i + 1}`
    ).slice(0, 31);
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${name.slice(0, 28)} ${n}`;
    taken.add(name.toLowerCase());
    return name;
};

function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    const src = text.replace(/\r\n?/g, '\n').trim();
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (quoted) {
            if (c === '"' && src[i + 1] === '"') {
                cell += '"';
                i++;
            } else if (c === '"') quoted = false;
            else cell += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') {
            row.push(cell);
            cell = '';
        } else if (c === '\n') {
            rows.push([...row, cell]);
            row = [];
            cell = '';
        } else cell += c;
    }
    rows.push([...row, cell]);
    return rows.filter(r => r.some(c => c.trim()));
}

// Numeric-looking CSV text becomes a number so Excel can sum and sort it.
const csvCell = (v: string): Cell => {
    const t = v.trim();
    return /^-?\d+(\.\d+)?$/.test(t) && !/^0\d/.test(t) ? Number(t) : t;
};

/** Parse workbook JSON (or CSV). Returns null when nothing usable is found. */
export function parseWorkbook(content: string): Workbook | null {
    const text = content.trim();
    // JSON (possibly slightly malformed) must never fall through to the CSV parser,
    // which would strip its quotes and produce a garbage sheet.
    if (/^(```\w*\s*)?[{[]/.test(text)) return workbookFromJson(parseModelJson(text));

    const rows = parseCsv(text);
    if (rows.length < 1 || rows[0].length < 2) return null;
    return {
        sheets: [
            {
                name: 'Sheet1',
                columns: rows[0].map(c => c.trim()),
                rows: rows.slice(1, MAX_ROWS + 1).map(r => r.map(csvCell)),
            },
        ],
    };
}

function workbookFromJson(data: any): Workbook | null {
    if (!data) return null;
    const rawSheets = Array.isArray(data.sheets) ? data.sheets : [data];
    const taken = new Set<string>();
    const sheets = rawSheets
        .filter((s: any) => Array.isArray(s?.columns) || Array.isArray(s?.rows))
        .slice(0, 10)
        .map((s: any, i: number): Sheet => {
            const columns = (Array.isArray(s.columns) ? s.columns : [])
                .map((c: unknown) => String(c ?? ''))
                .slice(0, MAX_COLS);
            const rows = (Array.isArray(s.rows) ? s.rows : [])
                .filter(Array.isArray)
                .slice(0, MAX_ROWS)
                .map((r: unknown[]) => r.slice(0, MAX_COLS).map(toCell));
            return { name: sheetName(s.name, i, taken), columns, rows };
        })
        .filter((s: Sheet) => s.columns.length || s.rows.length);
    return sheets.length ? { sheets } : null;
}

export const isFormula = (v: Cell): v is string => typeof v === 'string' && v.startsWith('=');
