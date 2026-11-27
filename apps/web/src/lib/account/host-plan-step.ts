/**
 * The «próximo paso» line of the host dashboard's Plan card for a PAID plan
 * (HOS-2664, D13), read from the owner's real subscription rows
 * (`GET /protected/billing-subscription/`). Pure: the clock is injected.
 *
 * @module lib/account/host-plan-step
 */

import type { OwnSubscriptionsResponseSchema } from '@repo/schemas';
import type { z } from 'zod';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';

type Row = z.infer<typeof OwnSubscriptionsResponseSchema>['subscriptions'][number];

const DAY_MS = 86_400_000;

/** Whole days from `now` to `iso` (rounded up), or `null` for a missing or past instant. */
function daysUntil({ iso, now }: { readonly iso: string | null; readonly now: number }) {
    if (!iso) return null;
    const remaining = Date.parse(iso) - now;
    return Number.isFinite(remaining) && remaining >= 0 ? Math.ceil(remaining / DAY_MS) : null;
}

/**
 * Picks the one date-bearing line for the host's subscription: when it ends
 * (scheduled cancellation or grace period) or, when it renews, the next charge.
 * Prefers the accommodation subscription, then any.
 *
 * @param input.rows - The owner's own subscription rows.
 * @param input.locale - Active locale.
 * @param input.now - Injected current time (ms).
 * @returns The localized line, or `null` when no row carries a usable future date.
 */
export function resolveHostPlanDateStep({
    rows,
    locale,
    now
}: {
    readonly rows: readonly Row[];
    readonly locale: SupportedLocale;
    readonly now: number;
}): string | null {
    const { t, tPlural } = createTranslations(locale);
    const ordered = [
        ...rows.filter((row) => row.vertical === 'accommodation'),
        ...rows.filter((row) => row.vertical !== 'accommodation')
    ];
    for (const row of ordered) {
        const endsIso =
            row.status === 'CANCEL_SCHEDULED'
                ? row.serviceEndsAt
                : row.status === 'GRACE_PERIOD'
                  ? row.graceEndsAt
                  : null;
        const ends = daysUntil({ iso: endsIso, now });
        if (ends !== null) {
            return ends === 0
                ? t('host.dashboard.widgets.planEndsToday')
                : tPlural('host.dashboard.widgets.planEnds', ends);
        }
        if (row.status === 'ACTIVE') {
            const charge = daysUntil({ iso: row.nextCharge?.at ?? null, now });
            if (charge !== null) {
                return charge === 0
                    ? t('host.dashboard.widgets.planChargeToday')
                    : tPlural('host.dashboard.widgets.planCharge', charge);
            }
        }
    }
    return null;
}
