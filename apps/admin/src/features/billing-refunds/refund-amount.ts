/**
 * @file refund-amount.ts
 * Display helpers shared by the proposed and the stuck refund lists.
 */

import { formatCurrency } from '@repo/i18n';

/**
 * Formats a refund amount. A manual payment stores no currency, so its amount is shown as a plain
 * number rather than guessing one.
 *
 * @param input - The amount in minor units, its currency if known, and the locale.
 * @returns The amount for display.
 */
export function formatProposedRefundAmount({
    amountMinor,
    currency,
    locale
}: {
    readonly amountMinor: number;
    readonly currency: string | null;
    readonly locale: string;
}): string {
    return currency === null
        ? new Intl.NumberFormat(locale, { minimumFractionDigits: 2 }).format(amountMinor / 100)
        : formatCurrency({ value: amountMinor / 100, currency, locale });
}
