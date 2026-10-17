/** Pure contracts and display helpers for the self-service subscription cancellation. */
import {
    OwnSubscriptionsResponseSchema,
    SubscriptionCancellationPreviewResponseSchema
} from '@repo/schemas';
import type { z } from 'zod';
import type { SupportedLocale } from '@/lib/i18n';
import { formatNoticeInstant } from '@/lib/listing/listing-notices';

export type OwnSubscriptionStatus = 'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED' | 'CANCEL_SCHEDULED';
export const CANCELLATION_OFFERED: Record<OwnSubscriptionStatus, boolean> = {
    ACTIVE: true,
    GRACE_PERIOD: true,
    SUSPENDED: true,
    CANCEL_SCHEDULED: false
};
export const END_LINE_KEY: Record<'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED', string> = {
    ACTIVE: 'account.subscription.cancel.activeEnds',
    GRACE_PERIOD: 'account.subscription.cancel.graceEnds',
    SUSPENDED: 'account.subscription.cancel.suspendedEnds'
};
export const ADDON_LINE_KEY: Record<'CHARGE_CUT_TODAY' | 'AT_SERVICE_END' | 'TODAY', string> = {
    CHARGE_CUT_TODAY: 'account.subscription.cancel.addon.CHARGE_CUT_TODAY',
    AT_SERVICE_END: 'account.subscription.cancel.addon.AT_SERVICE_END',
    TODAY: 'account.subscription.cancel.addon.TODAY'
};
export const GRACE_NOTICE: Record<'CARD' | 'MANUAL', boolean> = { CARD: true, MANUAL: false };

/** Parse a successful cancellation preview; every malformed or failed result is closed. */
export function parseCancellationPreview({
    result
}: {
    readonly result: unknown;
}): z.infer<typeof SubscriptionCancellationPreviewResponseSchema> | null {
    if (
        !result ||
        typeof result !== 'object' ||
        !('ok' in result) ||
        result.ok !== true ||
        !('data' in result)
    )
        return null;
    const parsed = SubscriptionCancellationPreviewResponseSchema.safeParse(result.data);
    return parsed.success ? parsed.data : null;
}

/** Parse a successful own-subscriptions response; malformed reads never invent rows. */
export function parseOwnSubscriptions({
    result
}: {
    readonly result: unknown;
}): z.infer<typeof OwnSubscriptionsResponseSchema> | null {
    if (
        !result ||
        typeof result !== 'object' ||
        !('ok' in result) ||
        result.ok !== true ||
        !('data' in result)
    )
        return null;
    const parsed = OwnSubscriptionsResponseSchema.safeParse(result.data);
    return parsed.success ? parsed.data : null;
}

/** Format an API instant in Buenos Aires market time. */
export function formatSelfCancelDate({
    iso,
    locale
}: {
    readonly iso: string;
    readonly locale: SupportedLocale;
}): string | null {
    return formatNoticeInstant({ iso, locale });
}
