'use client';

import { memo, type CSSProperties, type ReactNode } from 'react';
import type { DeckTheme, Slide } from './slides';

/*
 * HTML rendering of one slide. Geometry mirrors pptx-export.ts: the slide is
 * 13.333in x 7.5in, so inches map to % of width/height and points map to
 * container-query width units (1cqw = 9.6pt).
 */
const x = (inches: number) => `${(inches / 13.333) * 100}%`;
const y = (inches: number) => `${(inches / 7.5) * 100}%`;
const pt = (points: number) => `${points / 9.6}cqw`;

const Box = ({
    top,
    left = 0.75,
    width = 11.833,
    height,
    style,
    children,
}: {
    top: number;
    left?: number;
    width?: number;
    height?: number;
    style?: CSSProperties;
    children?: ReactNode;
}) => (
    <div
        style={{
            position: 'absolute',
            top: y(top),
            left: x(left),
            width: x(width),
            height: height ? y(height) : undefined,
            overflow: 'hidden',
            ...style,
        }}
    >
        {children}
    </div>
);

const Bullets = ({ items, size, theme }: { items: string[]; size: number; theme: DeckTheme }) => (
    <ul
        style={{
            fontSize: pt(size),
            lineHeight: 1.3,
            margin: 0,
            paddingLeft: '1.1em',
            listStyleType: 'disc',
        }}
    >
        {items.map((item, i) => (
            <li key={i} style={{ marginBottom: '0.45em', color: `#${theme.muted}` }}>
                <span style={{ color: `#${theme.text}` }}>{item}</span>
            </li>
        ))}
    </ul>
);

const Heading = ({ text, theme }: { text: string; theme: DeckTheme }) => (
    <>
        <Box top={0.5} width={0.6} height={0.07} style={{ background: `#${theme.accent}` }} />
        <Box top={0.7} height={0.9} style={{ fontSize: pt(30), fontWeight: 700, lineHeight: 1.15 }}>
            {text}
        </Box>
    </>
);

export const SlideView = memo(
    ({
        slide,
        theme,
        index,
        total,
    }: {
        slide: Slide;
        theme: DeckTheme;
        index: number;
        total: number;
    }) => {
        const inverted = slide.layout === 'section';
        const c = (hex: string) => `#${hex}`;

        const body = (() => {
            switch (slide.layout) {
                case 'title':
                    return (
                        <>
                            <Box
                                top={2.55}
                                width={1.1}
                                height={0.1}
                                style={{ background: c(theme.accent) }}
                            />
                            <Box
                                top={2.85}
                                height={1.6}
                                style={{ fontSize: pt(44), fontWeight: 700, lineHeight: 1.1 }}
                            >
                                {slide.title}
                            </Box>
                            {slide.subtitle && (
                                <Box
                                    top={4.55}
                                    width={9.5}
                                    style={{ fontSize: pt(24), color: c(theme.muted) }}
                                >
                                    {slide.subtitle}
                                </Box>
                            )}
                        </>
                    );
                case 'section':
                    return (
                        <>
                            <Box
                                top={2.8}
                                height={1.3}
                                style={{
                                    fontSize: pt(40),
                                    fontWeight: 700,
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    lineHeight: 1.1,
                                }}
                            >
                                {slide.title}
                            </Box>
                            {slide.subtitle && (
                                <Box
                                    top={4.2}
                                    style={{ fontSize: pt(18), color: 'rgba(255,255,255,.8)' }}
                                >
                                    {slide.subtitle}
                                </Box>
                            )}
                        </>
                    );
                case 'bullets':
                    return (
                        <>
                            {slide.title && <Heading text={slide.title} theme={theme} />}
                            <Box top={slide.title ? 1.9 : 0.8} height={4.7}>
                                <Bullets items={slide.bullets} size={24} theme={theme} />
                            </Box>
                        </>
                    );
                case 'two-column': {
                    const colW = (11.833 - 0.5) / 2;
                    return (
                        <>
                            {slide.title && <Heading text={slide.title} theme={theme} />}
                            {[slide.left, slide.right].map((col, i) => (
                                <Box
                                    key={i}
                                    top={slide.title ? 1.9 : 0.8}
                                    left={0.75 + i * (colW + 0.5)}
                                    width={colW}
                                    height={4.7}
                                >
                                    {col.heading && (
                                        <div
                                            style={{
                                                fontSize: pt(20),
                                                fontWeight: 700,
                                                color: c(theme.accent),
                                                marginBottom: '0.6em',
                                            }}
                                        >
                                            {col.heading}
                                        </div>
                                    )}
                                    <Bullets items={col.bullets} size={20} theme={theme} />
                                </Box>
                            ))}
                        </>
                    );
                }
                case 'stats': {
                    const n = slide.stats.length;
                    const cardW = (11.833 - 0.35 * (n - 1)) / n;
                    return (
                        <>
                            {slide.title && <Heading text={slide.title} theme={theme} />}
                            {slide.stats.map((stat, i) => (
                                <Box
                                    key={i}
                                    top={2.4}
                                    left={0.75 + i * (cardW + 0.35)}
                                    width={cardW}
                                    height={2.9}
                                    style={{
                                        background: c(theme.surface),
                                        borderRadius: '1.2cqw',
                                        padding: '4% 6%',
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: pt(44),
                                            fontWeight: 700,
                                            color: c(theme.accent),
                                        }}
                                    >
                                        {stat.value}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: pt(15),
                                            color: c(theme.muted),
                                            marginTop: '0.5em',
                                        }}
                                    >
                                        {stat.label}
                                    </div>
                                </Box>
                            ))}
                        </>
                    );
                }
                case 'quote':
                    return (
                        <>
                            <Box
                                top={1.6}
                                left={1.55}
                                width={10.233}
                                height={3.2}
                                style={{
                                    fontFamily: 'Georgia, serif',
                                    fontStyle: 'italic',
                                    fontSize: pt(30),
                                    lineHeight: 1.3,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    textAlign: 'center',
                                }}
                            >
                                {`“${slide.quote}”`}
                            </Box>
                            {slide.author && (
                                <Box
                                    top={5}
                                    style={{
                                        fontSize: pt(16),
                                        color: c(theme.muted),
                                        textAlign: 'center',
                                    }}
                                >
                                    {`— ${slide.author}`}
                                </Box>
                            )}
                        </>
                    );
                case 'table':
                    return (
                        <>
                            {slide.title && <Heading text={slide.title} theme={theme} />}
                            <Box top={1.9} height={5}>
                                <table
                                    style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        fontSize: pt(slide.rows.length > 6 ? 14 : 16),
                                    }}
                                >
                                    <thead>
                                        <tr>
                                            {slide.columns.map((col, i) => (
                                                <th
                                                    key={i}
                                                    style={{
                                                        background: c(theme.accent),
                                                        color: '#fff',
                                                        textAlign: 'left',
                                                        padding: '0.5em 0.6em',
                                                    }}
                                                >
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {slide.rows.map((row, r) => (
                                            <tr
                                                key={r}
                                                style={{
                                                    background: c(r % 2 ? theme.surface : theme.bg),
                                                }}
                                            >
                                                {row.map((cell, i) => (
                                                    <td key={i} style={{ padding: '0.5em 0.6em' }}>
                                                        {cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </Box>
                        </>
                    );
            }
        })();

        return (
            <div
                className="relative aspect-video w-full select-none overflow-hidden"
                style={{
                    containerType: 'inline-size',
                    background: c(inverted ? theme.accent : theme.bg),
                    color: c(theme.text),
                    fontFamily: 'Calibri, Carlito, "Segoe UI", system-ui, sans-serif',
                }}
            >
                {body}
                {slide.layout !== 'title' && !inverted && (
                    <Box
                        top={6.95}
                        left={10.583}
                        width={2}
                        style={{ fontSize: pt(10), color: c(theme.muted), textAlign: 'right' }}
                    >
                        {`${index + 1} / ${total}`}
                    </Box>
                )}
            </div>
        );
    }
);
SlideView.displayName = 'SlideView';
