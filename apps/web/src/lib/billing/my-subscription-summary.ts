import type { OwnSubscriptionsResponseSchema, VerticalEnum } from '@repo/schemas';
import type { z } from 'zod';
import { formatSelfCancelDate, type OwnSubscriptionStatus } from '@/lib/billing/self-cancel';
import { SIGNUP_CYCLE_LABEL_KEY } from '@/lib/billing/signup-checkout';
import { getPlanName } from '@/lib/billing-i18n';
import { formatPrice } from '@/lib/format-utils';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';

type Row = z.infer<typeof OwnSubscriptionsResponseSchema>['subscriptions'][number];

/** Translation key for each supported business vertical on the subscription page. */
export const MY_SUBSCRIPTION_VERTICAL_LABEL_KEY: Record<VerticalEnum, string> = {
    accommodation: 'account.subscription.mine.vertical.accommodation',
    gastronomy: 'account.subscription.mine.vertical.gastronomy',
    experience: 'account.subscription.mine.vertical.experience',
    tourist: 'account.subscription.mine.vertical.tourist',
    partner: 'account.subscription.mine.vertical.partner'
};

/** Translation key used when an API row contains an unsupported vertical. */
export const MY_SUBSCRIPTION_VERTICAL_UNKNOWN_KEY = 'account.subscription.mine.vertical.unknown';

/** Resolve a subscription vertical to its account-page translation key. */
export function resolveMySubscriptionVerticalLabelKey({
    vertical
}: {
    readonly vertical: string;
}): string {
    return Object.hasOwn(MY_SUBSCRIPTION_VERTICAL_LABEL_KEY, vertical)
        ? MY_SUBSCRIPTION_VERTICAL_LABEL_KEY[vertical as VerticalEnum]
        : MY_SUBSCRIPTION_VERTICAL_UNKNOWN_KEY;
}

/** States whose subscription cards show the anchored list price. */
export const MY_SUBSCRIPTION_PRICE_SHOWN: Record<OwnSubscriptionStatus, boolean> = {
    ACTIVE: true,
    GRACE_PERIOD: true,
    SUSPENDED: false,
    CANCEL_SCHEDULED: false
};

/** Resolve all plan, vertical, price, and next-charge copy for a subscription card. */
export function resolveMySubscriptionSummary({
    row,
    locale,
    t
}: {
    readonly row: Row;
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
}): {
    readonly title: string;
    readonly verticalLabelKey: string;
    readonly priceLine: string | null;
    readonly nextChargeLine: string | null;
} {
    const title = getPlanName({
        plan: { slug: row.plan.slug, name: row.plan.name, description: '' },
        t
    });
    const priceLine = MY_SUBSCRIPTION_PRICE_SHOWN[row.status]
        ? t('account.subscription.mine.price', undefined, {
              amount: formatMinor({ amount: row.plan.amount, currency: row.plan.currency, locale }),
              cycle: t(SIGNUP_CYCLE_LABEL_KEY[row.plan.cycle])
          })
        : null;
    const nextChargeLine = row.nextCharge
        ? t('account.subscription.mine.nextCharge', undefined, {
              date: formatSelfCancelDate({ iso: row.nextCharge.at, locale }),
              amount: formatMinor({
                  amount: row.nextCharge.amount,
                  currency: row.nextCharge.currency,
                  locale
              })
          })
        : null;
    return {
        title,
        verticalLabelKey: resolveMySubscriptionVerticalLabelKey({ vertical: row.vertical }),
        priceLine,
        nextChargeLine
    };
}

function formatMinor({
    amount,
    currency,
    locale
}: {
    readonly amount: number;
    readonly currency: string;
    readonly locale: SupportedLocale;
}): string {
    return formatPrice({
        amount: amount / 100,
        currency,
        locale,
        showDecimals: amount % 100 !== 0
    });
}
