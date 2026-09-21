import {
    AlignmentType,
    BorderStyle,
    Document,
    ExternalHyperlink,
    HeadingLevel,
    LevelFormat,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
    type ParagraphChild,
} from 'docx';
import { marked, type Token, type Tokens } from 'marked';

/*
 * Markdown -> Word. Walks marked's token tree and maps it onto real Word
 * structures (heading styles, list numbering, tables) so the file edits
 * naturally in Word instead of being a pasted blob of text.
 */

const FONT = 'Calibri';
const ACCENT = '1F3A5F';
const HEADINGS = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
];

type RunStyle = { bold?: boolean; italics?: boolean; strike?: boolean; code?: boolean };

const decode = (s: string) =>
    s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

const run = (text: string, style: RunStyle) =>
    new TextRun({
        text: decode(text),
        bold: style.bold,
        italics: style.italics,
        strike: style.strike,
        font: style.code ? 'Consolas' : undefined,
        shading: style.code
            ? { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' }
            : undefined,
    });

function inline(tokens: Token[] = [], style: RunStyle = {}): ParagraphChild[] {
    return tokens.flatMap((t): ParagraphChild[] => {
        switch (t.type) {
            case 'strong':
                return inline((t as Tokens.Strong).tokens, { ...style, bold: true });
            case 'em':
                return inline((t as Tokens.Em).tokens, { ...style, italics: true });
            case 'del':
                return inline((t as Tokens.Del).tokens, { ...style, strike: true });
            case 'codespan':
                return [run((t as Tokens.Codespan).text, { ...style, code: true })];
            case 'br':
                return [new TextRun({ break: 1 })];
            case 'link': {
                const link = t as Tokens.Link;
                return [
                    new ExternalHyperlink({
                        link: link.href,
                        children: [
                            new TextRun({
                                text: decode(link.text),
                                style: 'Hyperlink',
                                bold: style.bold,
                                italics: style.italics,
                            }),
                        ],
                    }),
                ];
            }
            case 'text': {
                const text = t as Tokens.Text;
                return text.tokens?.length ? inline(text.tokens, style) : [run(text.text, style)];
            }
            case 'html':
                // Models often put <br> inside table cells for line breaks.
                return /^<br\s*\/?>$/i.test((t as Tokens.HTML).text.trim())
                    ? [new TextRun({ break: 1 })]
                    : [];
            case 'escape':
                return [run((t as Tokens.Escape).text, style)];
            default:
                return 'text' in t && typeof t.text === 'string' ? [run(t.text, style)] : [];
        }
    });
}

/** Each ordered list gets its own numbering instance so it restarts at 1. */
let listInstance = 0;

function list(token: Tokens.List, level: number): Paragraph[] {
    const instance = ++listInstance;
    return token.items.flatMap(item => {
        const out: Paragraph[] = [];
        const nested: Tokens.List[] = [];
        const children: ParagraphChild[] = [];
        for (const t of item.tokens) {
            if (t.type === 'list') nested.push(t as Tokens.List);
            else if (t.type === 'text' || t.type === 'paragraph') {
                if (children.length) children.push(new TextRun({ break: 1 }));
                children.push(...inline((t as Tokens.Text).tokens ?? [t]));
            }
        }
        if (item.task) children.unshift(new TextRun({ text: item.checked ? '☑ ' : '☐ ' }));
        out.push(
            new Paragraph({
                children,
                spacing: { after: 60 },
                ...(token.ordered
                    ? { numbering: { reference: 'ordered', level: Math.min(level, 2), instance } }
                    : { bullet: { level: Math.min(level, 2) } }),
            })
        );
        nested.forEach(n => out.push(...list(n, level + 1)));
        return out;
    });
}

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'D0D5DD' };

function table(token: Tokens.Table): Table {
    const cell = (tokens: Token[], header: boolean) =>
        new TableCell({
            children: [new Paragraph({ children: inline(tokens, header ? { bold: true } : {}) })],
            shading: header
                ? { type: ShadingType.CLEAR, fill: 'EEF2F6', color: 'auto' }
                : undefined,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder },
        });
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                tableHeader: true,
                children: token.header.map(h => cell(h.tokens, true)),
            }),
            ...token.rows.map(r => new TableRow({ children: r.map(c => cell(c.tokens, false)) })),
        ],
    });
}

function blocks(tokens: Token[]): (Paragraph | Table)[] {
    return tokens.flatMap((t): (Paragraph | Table)[] => {
        switch (t.type) {
            case 'heading': {
                const h = t as Tokens.Heading;
                return [
                    new Paragraph({ heading: HEADINGS[h.depth - 1], children: inline(h.tokens) }),
                ];
            }
            case 'paragraph':
                return [new Paragraph({ children: inline((t as Tokens.Paragraph).tokens) })];
            case 'list':
                return list(t as Tokens.List, 0);
            case 'table':
                return [table(t as Tokens.Table), new Paragraph({})];
            case 'blockquote':
                return (t as Tokens.Blockquote).tokens.flatMap(inner =>
                    inner.type === 'paragraph'
                        ? [
                              new Paragraph({
                                  style: 'Quote',
                                  children: inline((inner as Tokens.Paragraph).tokens),
                              }),
                          ]
                        : blocks([inner])
                );
            case 'code':
                return (t as Tokens.Code).text.split('\n').map(
                    line =>
                        new Paragraph({
                            children: [run(line || ' ', { code: true })],
                            spacing: { after: 0 },
                        })
                );
            case 'hr':
                return [
                    new Paragraph({
                        border: {
                            bottom: {
                                style: BorderStyle.SINGLE,
                                size: 6,
                                color: 'D0D5DD',
                                space: 1,
                            },
                        },
                    }),
                ];
            case 'text':
                return [new Paragraph({ children: inline([t]) })];
            default:
                return [];
        }
    });
}

export async function downloadMarkdownAsDocx(markdown: string, title: string, fileName: string) {
    listInstance = 0;
    const doc = new Document({
        title,
        creator: 'Kiln',
        styles: {
            default: {
                document: {
                    run: { font: FONT, size: 22 },
                    paragraph: { spacing: { after: 140, line: 288 } },
                },
                heading1: {
                    run: { font: FONT, size: 36, bold: true, color: ACCENT },
                    paragraph: { spacing: { before: 240, after: 160 } },
                },
                heading2: {
                    run: { font: FONT, size: 28, bold: true, color: ACCENT },
                    paragraph: { spacing: { before: 280, after: 120 } },
                },
                heading3: {
                    run: { font: FONT, size: 24, bold: true, color: '333333' },
                    paragraph: { spacing: { before: 200, after: 80 } },
                },
            },
            paragraphStyles: [
                {
                    id: 'Quote',
                    name: 'Quote',
                    basedOn: 'Normal',
                    run: { italics: true, color: '555555' },
                    paragraph: {
                        indent: { left: 480 },
                        border: {
                            left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 8 },
                        },
                    },
                },
            ],
        },
        numbering: {
            config: [
                {
                    reference: 'ordered',
                    levels: [0, 1, 2].map(level => ({
                        level,
                        format: [
                            LevelFormat.DECIMAL,
                            LevelFormat.LOWER_LETTER,
                            LevelFormat.LOWER_ROMAN,
                        ][level],
                        text: `%${level + 1}.`,
                        alignment: AlignmentType.START,
                        style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
                    })),
                },
            ],
        },
        sections: [{ children: blocks(marked.lexer(markdown, { gfm: true })) }],
    });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
