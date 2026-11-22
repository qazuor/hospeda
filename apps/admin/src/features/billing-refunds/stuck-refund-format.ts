/**
 * @file stuck-refund-format.ts
 * Labels of the stuck-refund list and of the selectors that pick from it (HOS-2560).
 */

import type { TranslationKey } from '@repo/i18n';
import type { StuckRefund } from '@repo/schemas';
import { formatProposedRefundAmount } from './refund-amount';

type Translate = (key: TranslationKey, params?: Record<string, unknown>) => string;

const MINUTE_MS = 60 * 1000;

/**
 * How long ago an instant was, coarse: minutes under an hour, hours under two days, else days.
 *
 * @param input - The ISO instant, the current instant and the translator.
 * @returns For example «hace 30 h».
 */
export function formatStuckRefundAge({
    since,
    now,
    t
}: {
    readonly since: string;
    readonly now: Date;
    readonly t: Translate;
}): string {
    const minutes = Math.max(
        0,
        Math.floor((now.getTime() - new Date(since).getTime()) / MINUTE_MS)
    );
    if (minutes < 60)
        return t('admin-billing.proposedRefunds.stuck.age.minutes', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return t('admin-billing.proposedRefunds.stuck.age.hours', { count: hours });
    return t('admin-billing.proposedRefunds.stuck.age.days', { count: Math.floor(hours / 24) });
}

/**
 * The selector label of a stuck refund: amount · short payment id · age of its oldest unanswered
 * call (of the refund itself when every call has an answer).
 *
 * @param input - The refund, the locale, the current instant and the translator.
 * @returns For example «$ 100,00 · cccccccc · hace 30 h».
 */
export function stuckRefundOptionLabel({
    refund,
    locale,
    now,
    t
}: {
    readonly refund: StuckRefund;
    readonly locale: string;
    readonly now: Date;
    readonly t: Translate;
}): string {
    const amount = formatProposedRefundAmount({
        amountMinor: refund.amountMinor,
        currency: refund.currency,
        locale
    });
    const age = formatStuckRefundAge({
        since: refund.oldestUnansweredAt ?? refund.createdAt,
        now,
        t
    });
    return `${amount} · ${refund.payment.id.slice(0, 8)} · ${age}`;
}
