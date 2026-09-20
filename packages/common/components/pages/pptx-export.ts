import type { Deck, Slide } from './slides';

// LAYOUT_WIDE is 13.333" x 7.5". All positions below are in inches.
const W = 13.333;
const H = 7.5;
const MX = 0.75;
const CW = W - MX * 2;
const FONT = 'Calibri';

/** Build a .pptx from a deck and trigger a browser download. */
export async function downloadDeckAsPptx(deck: Deck, title: string, fileName: string) {
    // pptxgenjs is ~500KB; load it only when someone actually exports.
    const { default: PptxGenJS } = await import('pptxgenjs');
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.title = title;

    const t = deck.theme;
    const total = deck.slides.length;

    deck.slides.forEach((s, i) => {
        const slide = pptx.addSlide();
        const inverted = s.layout === 'section';
        slide.background = { color: inverted ? t.accent : t.bg };

        const heading = (text: string, y = 0.7) => {
            slide.addShape(pptx.ShapeType.rect, {
                x: MX,
                y: y - 0.2,
                w: 0.6,
                h: 0.07,
                fill: { color: t.accent },
                line: { color: t.accent },
            });
            slide.addText(text, {
                x: MX,
                y,
                w: CW,
                h: 0.9,
                fontFace: FONT,
                fontSize: 30,
                bold: true,
                color: t.text,
                valign: 'top',
                fit: 'shrink',
                margin: 0,
            });
        };

        const bulletBox = (
            items: string[],
            x: number,
            y: number,
            w: number,
            h: number,
            size = 24
        ) => {
            if (!items.length) return;
            slide.addText(
                items.map(text => ({
                    text,
                    options: { bullet: { indent: 18 }, paraSpaceAfter: 10 },
                })),
                {
                    x,
                    y,
                    w,
                    h,
                    fontFace: FONT,
                    fontSize: size,
                    color: t.text,
                    valign: 'top',
                    fit: 'shrink',
                    margin: 0,
                }
            );
        };

        const renderSlide = (s: Slide) => {
            switch (s.layout) {
                case 'title':
                    slide.addShape(pptx.ShapeType.rect, {
                        x: MX,
                        y: 2.55,
                        w: 1.1,
                        h: 0.1,
                        fill: { color: t.accent },
                        line: { color: t.accent },
                    });
                    slide.addText(s.title, {
                        x: MX,
                        y: 2.85,
                        w: CW,
                        h: 1.6,
                        fontFace: FONT,
                        fontSize: 44,
                        bold: true,
                        color: t.text,
                        valign: 'top',
                        fit: 'shrink',
                        margin: 0,
                    });
                    if (s.subtitle) {
                        slide.addText(s.subtitle, {
                            x: MX,
                            y: 4.55,
                            w: CW * 0.8,
                            h: 1,
                            fontFace: FONT,
                            fontSize: 24,
                            color: t.muted,
                            valign: 'top',
                            margin: 0,
                        });
                    }
                    return;
                case 'section':
                    slide.addText(s.title, {
                        x: MX,
                        y: 2.8,
                        w: CW,
                        h: 1.3,
                        fontFace: FONT,
                        fontSize: 40,
                        bold: true,
                        color: 'FFFFFF',
                        valign: 'bottom',
                        fit: 'shrink',
                        margin: 0,
                    });
                    if (s.subtitle) {
                        slide.addText(s.subtitle, {
                            x: MX,
                            y: 4.2,
                            w: CW,
                            h: 0.8,
                            fontFace: FONT,
                            fontSize: 18,
                            color: 'FFFFFF',
                            transparency: 20,
                            valign: 'top',
                            margin: 0,
                        });
                    }
                    return;
                case 'bullets':
                    if (s.title) heading(s.title);
                    bulletBox(s.bullets, MX, s.title ? 1.9 : 0.8, CW, H - 2.8);
                    return;
                case 'two-column': {
                    if (s.title) heading(s.title);
                    const colW = (CW - 0.5) / 2;
                    [s.left, s.right].forEach((col, c) => {
                        const x = MX + c * (colW + 0.5);
                        let y = s.title ? 1.9 : 0.8;
                        if (col.heading) {
                            slide.addText(col.heading, {
                                x,
                                y,
                                w: colW,
                                h: 0.5,
                                fontFace: FONT,
                                fontSize: 20,
                                bold: true,
                                color: t.accent,
                                margin: 0,
                            });
                            y += 0.65;
                        }
                        bulletBox(col.bullets, x, y, colW, H - y - 0.9, 20);
                    });
                    return;
                }
                case 'stats': {
                    if (s.title) heading(s.title);
                    const n = s.stats.length;
                    const gap = 0.35;
                    const cardW = (CW - gap * (n - 1)) / n;
                    s.stats.forEach((stat, k) => {
                        const x = MX + k * (cardW + gap);
                        slide.addShape(pptx.ShapeType.roundRect, {
                            x,
                            y: 2.4,
                            w: cardW,
                            h: 2.9,
                            rectRadius: 0.12,
                            fill: { color: t.surface },
                            line: { color: t.surface },
                        });
                        slide.addText(stat.value, {
                            x: x + 0.3,
                            y: 2.8,
                            w: cardW - 0.6,
                            h: 1.2,
                            fontFace: FONT,
                            fontSize: 44,
                            bold: true,
                            color: t.accent,
                            fit: 'shrink',
                            margin: 0,
                        });
                        slide.addText(stat.label, {
                            x: x + 0.3,
                            y: 4.05,
                            w: cardW - 0.6,
                            h: 1,
                            fontFace: FONT,
                            fontSize: 15,
                            color: t.muted,
                            valign: 'top',
                            margin: 0,
                        });
                    });
                    return;
                }
                case 'quote':
                    slide.addText(`“${s.quote}”`, {
                        x: MX + 0.8,
                        y: 1.6,
                        w: CW - 1.6,
                        h: 3.2,
                        fontFace: 'Georgia',
                        fontSize: 30,
                        italic: true,
                        color: t.text,
                        align: 'center',
                        valign: 'middle',
                        fit: 'shrink',
                    });
                    if (s.author) {
                        slide.addText(`— ${s.author}`, {
                            x: MX,
                            y: 5,
                            w: CW,
                            h: 0.5,
                            fontFace: FONT,
                            fontSize: 16,
                            color: t.muted,
                            align: 'center',
                        });
                    }
                    return;
                case 'table': {
                    if (s.title) heading(s.title);
                    const border = { type: 'solid' as const, pt: 0.75, color: t.surface };
                    slide.addTable(
                        [
                            s.columns.map(text => ({
                                text,
                                options: { bold: true, color: 'FFFFFF', fill: { color: t.accent } },
                            })),
                            ...s.rows.map((row, r) =>
                                row.map(text => ({
                                    text,
                                    options: {
                                        color: t.text,
                                        fill: { color: r % 2 ? t.surface : t.bg },
                                    },
                                }))
                            ),
                        ],
                        {
                            x: MX,
                            y: 1.9,
                            w: CW,
                            fontFace: FONT,
                            fontSize: s.rows.length > 6 ? 14 : 16,
                            border,
                            margin: 0.08,
                            autoPage: false,
                        }
                    );
                    return;
                }
            }
        };

        renderSlide(s);

        if (s.layout !== 'title' && !inverted) {
            slide.addText(`${i + 1} / ${total}`, {
                x: W - MX - 1.5,
                y: H - 0.55,
                w: 1.5,
                h: 0.3,
                fontFace: FONT,
                fontSize: 10,
                color: t.muted,
                align: 'right',
                margin: 0,
            });
        }
        if (s.notes) slide.addNotes(s.notes);
    });

    await pptx.writeFile({ fileName, compression: true });
}
