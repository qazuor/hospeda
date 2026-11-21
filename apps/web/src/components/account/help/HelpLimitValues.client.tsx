/**
 * @file HelpLimitValues.client.tsx
 * @description Fills the reader's own plan limits into a help article
 * (HOS-2410 `docs/data-model.md` §5.2, `docs/web-ui.md` §4 and §7).
 *
 * The server renders every `{{limit}}` token as
 * `<span data-help-limit="<key>" data-vertical="<v>">el tope de tu plan</span>`,
 * the same HTML for every reader (D-H4). After hydration this island reads the
 * reader's effective set per vertical (`useMyEntitlements`) and replaces each
 * span's text with the number, or "sin tope" for the unlimited sentinel. While
 * loading, on error, and when the reader has no value for the key (no plan in
 * that vertical), the neutral text stays: it is never wrong, a "0" might be.
 *
 * Renders nothing. Hydration: `client:idle`, only on articles with a limit token.
 */

import type { VerticalEnum } from '@repo/schemas';
import { UNLIMITED_LIMIT_VALUE } from '@repo/schemas';
import { useEffect } from 'react';
import { useMyEntitlements } from '@/hooks/useMyEntitlements';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';

/** Props of {@link HelpLimitValues}. */
export interface HelpLimitValuesProps {
    /** Page locale, for number formatting and the "unlimited" text. */
    readonly locale: SupportedLocale;
    /** The verticals the article's limit spans name, one hook each. */
    readonly verticals: readonly `${VerticalEnum}`[];
}

/**
 * The text a limit span shows for a value, or `undefined` to keep the neutral one.
 *
 * @param args.value - The reader's limit (`0` when absent)
 * @param args.locale - The page locale
 * @param args.unlimitedText - What the unlimited sentinel reads as
 * @returns The text, or `undefined`
 */
export function formatHelpLimit({
    value,
    locale,
    unlimitedText
}: {
    readonly value: number;
    readonly locale: SupportedLocale;
    readonly unlimitedText: string;
}): string | undefined {
    if (value === UNLIMITED_LIMIT_VALUE) {
        return unlimitedText;
    }
    if (!Number.isFinite(value) || value <= 0) {
        return undefined;
    }
    return new Intl.NumberFormat(locale).format(value);
}

/** Fills the spans of one vertical. Renders nothing. */
function VerticalLimitFiller({
    locale,
    vertical
}: {
    readonly locale: SupportedLocale;
    readonly vertical: `${VerticalEnum}`;
}) {
    const { limit, isLoading, error } = useMyEntitlements({ vertical });

    useEffect(() => {
        if (isLoading || error !== null) {
            return;
        }
        const { t } = createTranslations(locale);
        const unlimitedText = t('account.help.article.unlimited');
        const spans = document.querySelectorAll<HTMLElement>(
            `[data-help-limit][data-vertical="${vertical}"]`
        );
        for (const span of spans) {
            const key = span.dataset.helpLimit ?? '';
            const text = formatHelpLimit({ value: limit(key), locale, unlimitedText });
            if (text !== undefined) {
                span.textContent = text;
            }
        }
    }, [isLoading, error, limit, locale, vertical]);

    return null;
}

/**
 * Help article limit island. Renders nothing.
 *
 * @param props - See {@link HelpLimitValuesProps}
 * @returns One invisible filler per vertical
 */
export function HelpLimitValues({ locale, verticals }: HelpLimitValuesProps) {
    return (
        <>
            {verticals.map((vertical) => (
                <VerticalLimitFiller
                    key={vertical}
                    locale={locale}
                    vertical={vertical}
                />
            ))}
        </>
    );
}
