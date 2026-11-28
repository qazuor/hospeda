import { Img } from '@react-email/components';
import { EMAIL_TINTED_BOX_CLASS, emailPalette } from '@repo/email';
import type { CSSProperties, ReactElement } from 'react';

/** Supported newsletter card locales. */
export type NewsletterCardLocale = 'es' | 'en' | 'pt';

/** Plain-text card fields, structurally compatible with the resolver's DynamicCard. */
export interface NewsletterDynamicCard {
    readonly name: string;
    readonly summary: string;
    readonly imageUrl: string | null;
    readonly url: string;
}

/** Locale variants of a card; Spanish is the fallback. */
export type NewsletterLocalizedCard = Readonly<
    Partial<Record<NewsletterCardLocale, NewsletterDynamicCard>>
>;

/** JSON-safe resolver projection: convert its cards Map with Object.fromEntries. */
export interface NewsletterResolvedBlock {
    readonly blockKey: string;
    readonly hidden: boolean;
    readonly itemIds: readonly string[];
    readonly cards: Readonly<Record<string, NewsletterLocalizedCard>>;
}

/** Frozen block and recipient locale; no user HTML is accepted. */
export interface DynamicBlockCardsProps {
    readonly block: NewsletterResolvedBlock;
    readonly locale: NewsletterCardLocale;
}

const CTA = {
    es: 'Ver alojamiento',
    en: 'View accommodation',
    pt: 'Ver hospedagem'
} as const;

/**
 * Cover width in CSS pixels. The card loader crops Cloudinary covers to 320x240
 * (4:3 at 2x), so the rendered cover is 160x120.
 */
const COVER_WIDTH = 160;

/** Longest summary shown on a card; email clients cannot clamp lines. */
const SUMMARY_MAX_CHARS = 110;

/**
 * Shorten a summary to {@link SUMMARY_MAX_CHARS} at a word boundary.
 *
 * @param input.text - The plain-text summary.
 * @returns The summary, or its prefix followed by an ellipsis.
 */
export function truncateSummary({ text }: { readonly text: string }): string {
    const clean = text.trim().replace(/\s+/g, ' ');
    if (clean.length <= SUMMARY_MAX_CHARS) return clean;
    const cut = clean.slice(0, SUMMARY_MAX_CHARS);
    const lastSpace = cut.lastIndexOf(' ');
    const head = lastSpace > SUMMARY_MAX_CHARS * 0.6 ? cut.slice(0, lastSpace) : cut;
    return `${head.replace(/[\s.,;:!?-]+$/, '')}…`;
}

/** The tinted-box class lets the layout's dark-mode block repaint the fill and border. */
const cardStyle: CSSProperties = {
    border: `1px solid ${emailPalette.border}`,
    borderRadius: '8px',
    backgroundColor: emailPalette.surface
};
const coverCellStyle: CSSProperties = { width: `${COVER_WIDTH}px`, padding: '12px 0 12px 12px' };
const coverStyle: CSSProperties = {
    display: 'block',
    width: `${COVER_WIDTH}px`,
    height: 'auto',
    maxWidth: `${COVER_WIDTH}px`,
    borderRadius: '6px',
    border: 0
};
const textCellStyle: CSSProperties = { padding: '12px 16px', color: emailPalette.text };
const nameStyle: CSSProperties = {
    fontSize: '17px',
    lineHeight: '22px',
    fontWeight: 700,
    margin: '0 0 6px'
};
const summaryStyle: CSSProperties = {
    fontSize: '14px',
    lineHeight: '20px',
    color: emailPalette.mutedText,
    margin: '0 0 10px'
};
const linkStyle: CSSProperties = {
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: 700,
    color: emailPalette.link,
    textDecoration: 'none'
};

function isHttps({ url }: { readonly url: string }): boolean {
    try {
        return new URL(url).protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Render ordered cards as compact horizontal rows: a 4:3 cover on the left and
 * the name, a shortened summary and a text link on the right. Table cells only,
 * so the layout holds in Outlook and on mobile without media queries.
 */
export function DynamicBlockCards({ block, locale }: DynamicBlockCardsProps): ReactElement | null {
    if (block.hidden || block.itemIds.length === 0) return null;

    return (
        <>
            {block.itemIds.map((id) => {
                const variants = Object.hasOwn(block.cards, id) ? block.cards[id] : undefined;
                const card = variants?.[locale] ?? variants?.es;
                if (!card) return null;
                const name = card.name.trim() ? card.name : (variants?.es?.name ?? '');
                const summary = card.summary.trim() ? card.summary : (variants?.es?.summary ?? '');
                const hasCover = card.imageUrl !== null && isHttps({ url: card.imageUrl });
                const hasLink = isHttps({ url: card.url });
                return (
                    <table
                        key={id}
                        role="presentation"
                        width="100%"
                        cellPadding={0}
                        cellSpacing={0}
                        border={0}
                        data-newsletter-card={id}
                        style={{ margin: '0 0 12px' }}
                    >
                        <tbody>
                            <tr>
                                <td
                                    className={EMAIL_TINTED_BOX_CLASS}
                                    style={cardStyle}
                                >
                                    <table
                                        role="presentation"
                                        width="100%"
                                        cellPadding={0}
                                        cellSpacing={0}
                                        border={0}
                                    >
                                        <tbody>
                                            <tr>
                                                {hasCover && card.imageUrl && (
                                                    <td
                                                        width={COVER_WIDTH}
                                                        valign="top"
                                                        style={coverCellStyle}
                                                    >
                                                        {hasLink ? (
                                                            <a
                                                                href={card.url}
                                                                data-utm-content="dynamic-card-image"
                                                            >
                                                                <Img
                                                                    src={card.imageUrl}
                                                                    alt={name}
                                                                    width={COVER_WIDTH}
                                                                    style={coverStyle}
                                                                />
                                                            </a>
                                                        ) : (
                                                            <Img
                                                                src={card.imageUrl}
                                                                alt={name}
                                                                width={COVER_WIDTH}
                                                                style={coverStyle}
                                                            />
                                                        )}
                                                    </td>
                                                )}
                                                <td
                                                    valign="top"
                                                    style={textCellStyle}
                                                >
                                                    <h3 style={nameStyle}>{name}</h3>
                                                    <p style={summaryStyle}>
                                                        {truncateSummary({ text: summary })}
                                                    </p>
                                                    {hasLink && (
                                                        <a
                                                            href={card.url}
                                                            style={linkStyle}
                                                            data-utm-content="dynamic-card"
                                                        >
                                                            {`${CTA[locale]} →`}
                                                        </a>
                                                    )}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                );
            })}
        </>
    );
}
