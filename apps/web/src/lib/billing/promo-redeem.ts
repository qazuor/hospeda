/** Pure display and parsing helpers for promo-code redemption. */
import { RedeemPromoCodeResponseSchema } from '@repo/schemas';
import type { z } from 'zod';
import type { OwnSubscriptionStatus } from '@/lib/billing/self-cancel';
import { formatPrice } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';

export type PromoPaymentMethod = 'CARD' | 'MANUAL';
export type RedeemPromoCodeResponse = z.infer<typeof RedeemPromoCodeResponseSchema>;
export type RedeemNoticeLine = {
    readonly key: string;
    readonly params?: Readonly<Record<string, string | number>>;
};

export const PROMO_REDEEM_OFFERED: Record<
    OwnSubscriptionStatus,
    Record<PromoPaymentMethod, boolean>
> = {
    ACTIVE: { CARD: true, MANUAL: false },
    GRACE_PERIOD: { CARD: false, MANUAL: false },
    SUSPENDED: { CARD: false, MANUAL: false },
    CANCEL_SCHEDULED: { CARD: false, MANUAL: false }
};

const PROMO_REDEMPTION_REASONS = [
    'PROMO_CODE_NOT_FOUND',
    'PROMO_CODE_NOT_A_TRIAL_EXTENSION',
    'PROMO_CODE_NOT_FOR_VERTICAL',
    'PROMO_CODE_NOT_AVAILABLE',
    'PROMO_NO_ELIGIBLE_SUBSCRIPTION',
    'PROMO_NOT_OFFERED_TO_MANUAL_PAYER',
    'PROMO_CODE_ALREADY_REDEEMED',
    'PROMO_NOT_COMBINABLE',
    'PROMO_UNSUPPORTED_CURRENCY',
    'PROMO_BELOW_PROVIDER_MINIMUM',
    'PROMO_MUTATION_NOT_APPLIED',
    'NO_TRIAL',
    'TRIAL_ENDED',
    'CEILING_REACHED',
    'REDEMPTION_KEY_CONFLICT'
] as const;

/** Parse a successful redemption response; malformed payloads fail closed. */
export function parseRedeemResult({
    result
}: {
    readonly result: unknown;
}): RedeemPromoCodeResponse | null {
    if (
        !result ||
        typeof result !== 'object' ||
        !('ok' in result) ||
        result.ok !== true ||
        !('data' in result)
    )
        return null;
    const parsed = RedeemPromoCodeResponseSchema.safeParse(result.data);
    return parsed.success ? parsed.data : null;
}

/** Return only a known promo-redemption reason from a failed API result. */
export function readRedeemRejection({
    result
}: {
    readonly result: unknown;
}): (typeof PROMO_REDEMPTION_REASONS)[number] | null {
    if (
        !result ||
        typeof result !== 'object' ||
        !('ok' in result) ||
        result.ok !== false ||
        !('error' in result)
    )
        return null;
    const error = result.error;
    if (!error || typeof error !== 'object' || !('reason' in error)) return null;
    const reason = error.reason;
    return typeof reason === 'string' &&
        (PROMO_REDEMPTION_REASONS as readonly string[]).includes(reason)
        ? (reason as (typeof PROMO_REDEMPTION_REASONS)[number])
        : null;
}

function money(amountMinor: number, currency: string, locale: SupportedLocale): string {
    return formatPrice({ amount: amountMinor / 100, currency, locale, showDecimals: true });
}

/** Build the exhaustive customer-facing success lines for each redemption kind and duration. */
export function resolveRedeemNotice({
    result,
    locale
}: {
    readonly result: RedeemPromoCodeResponse;
    readonly locale: SupportedLocale;
}): readonly RedeemNoticeLine[] {
    switch (result.kind) {
        case 'TRIAL_EXTENSION':
            return [
                {
                    key: 'account.subscription.promoRedeem.trialExtension',
                    params: { count: result.days }
                }
            ];
        case 'DISCOUNT': {
            const discountedAmount = money(result.amountMinor, result.currency, locale);
            const laterAmount = money(result.previousAmountMinor, result.currency, locale);
            switch (result.durationKind) {
                case 'FIRST_CHARGE':
                    return [
                        {
                            key: 'account.subscription.promoRedeem.firstCharge',
                            params: { amount: discountedAmount }
                        },
                        {
                            key: 'account.subscription.promoRedeem.after',
                            params: { amount: laterAmount }
                        },
                        { key: 'account.subscription.promoRedeem.providerEmail' },
                        { key: 'account.subscription.promoRedeem.promoEnds' }
                    ];
                case 'N_CHARGES':
                    return [
                        {
                            key: 'account.subscription.promoRedeem.nCharges',
                            params: {
                                count: result.remainingCharges ?? 0,
                                amount: discountedAmount
                            }
                        },
                        {
                            key: 'account.subscription.promoRedeem.after',
                            params: { amount: laterAmount }
                        },
                        { key: 'account.subscription.promoRedeem.providerEmail' }
                    ];
                case 'FOREVER':
                    return [
                        {
                            key: 'account.subscription.promoRedeem.forever',
                            params: { amount: discountedAmount }
                        }
                    ];
            }
        }
    }
}
