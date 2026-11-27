import { Img } from '@react-email/components';
import { Button, emailPalette } from '@repo/email';
import type { ReactElement } from 'react';

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

function isHttps({ url }: { readonly url: string }): boolean {
    try {
        return new URL(url).protocol === 'https:';
    } catch {
        return false;
    }
}

/** Render ordered cards with escaped text and Outlook-safe table-cell styling. */
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
                return (
                    <table
                        key={id}
                        role="presentation"
                        width="100%"
                        cellPadding={0}
                        cellSpacing={0}
                        border={0}
                        data-newsletter-card={id}
                    >
                        <tbody>
                            <tr>
                                <td style={{ padding: '10px 0' }}>
                                    <table
                                        role="presentation"
                                        width="100%"
                                        cellPadding={0}
                                        cellSpacing={0}
                                        border={0}
                                    >
                                        <tbody>
                                            <tr>
                                                <td
                                                    style={{
                                                        padding: '16px 22px',
                                                        border: `1px solid ${emailPalette.border}`,
                                                        color: emailPalette.text
                                                    }}
                                                >
                                                    {card.imageUrl &&
                                                        isHttps({ url: card.imageUrl }) && (
                                                            <Img
                                                                src={card.imageUrl}
                                                                alt={name}
                                                                width="100%"
                                                                style={{
                                                                    display: 'block',
                                                                    maxWidth: '100%',
                                                                    height: 'auto',
                                                                    border: 0
                                                                }}
                                                            />
                                                        )}
                                                    <h3
                                                        style={{
                                                            fontSize: '18px',
                                                            lineHeight: '24px',
                                                            margin: '12px 0 8px'
                                                        }}
                                                    >
                                                        {name}
                                                    </h3>
                                                    <p
                                                        style={{
                                                            fontSize: '16px',
                                                            lineHeight: '24px',
                                                            margin: '0 0 16px'
                                                        }}
                                                    >
                                                        {summary}
                                                    </p>
                                                    {isHttps({ url: card.url }) && (
                                                        <Button href={card.url}>
                                                            {CTA[locale]}
                                                        </Button>
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
