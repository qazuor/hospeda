/** Pure URL, rejection, vertical, and date helpers for the signup checkout. */
import {
    type BillingCycle,
    SignupNoticeResponseSchema,
    type StartSubscriptionRejectionReason,
    StartSubscriptionRequestSchema,
    type VerticalEnum
} from '@repo/schemas';
import { MARKET_TIMEZONE } from '@repo/utils';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { buildUrlWithParams } from '@/lib/urls';

/** Validate and normalize the payer email using the API request contract. */
export function resolveDeclaredPayerEmail({
    value
}: {
    readonly value: unknown;
}): { readonly ok: true; readonly email: string } | { readonly ok: false } {
    const parsed = StartSubscriptionRequestSchema.shape.payerEmail.safeParse(value);
    return parsed.success ? { ok: true, email: parsed.data } : { ok: false };
}

/** Trial state rendered before an explicit signup confirmation. */
export type SignupTrialNotice =
    | { readonly kind: 'RUNNING'; readonly daysLeft: number; readonly endsAt: string }
    | { readonly kind: 'UNKNOWN' };

/** Tourist VIP return consequence resolved before the signup confirmation. */
export type SignupTouristVipNotice =
    | { readonly kind: 'CANCELLED_ON_RETURN' }
    | { readonly kind: 'UNKNOWN' };

/**
 * The plan, amount and cycle of the selected billing option, shown on the
 * checkout before the redirect to Mercado Pago (HOS-1723, owner decision D-3).
 * Parsed from the signup notice's `plan` (`SignupNoticeResponseSchema`); a
 * notice without it resolves to `null` and the summary is omitted.
 */
export type SignupPlanSummary = {
    /** Display name of the plan. */
    readonly name: string;
    /** Price of the option in minor units (centavos). */
    readonly amount: number;
    /** Only ARS is sold today. */
    readonly currency: 'ARS';
    /** Billing cycle of the option (monthly or annual). */
    readonly cycle: BillingCycle;
};

/** Resolve the selected plan and option amount, failing closed for unreadable notices. */
export function resolveSignupPlanSummary({
    result
}: {
    readonly result: unknown;
}): SignupPlanSummary | null {
    if (
        !result ||
        typeof result !== 'object' ||
        !('ok' in result) ||
        result.ok !== true ||
        !('data' in result)
    )
        return null;
    const plan =
        result.data && typeof result.data === 'object' && 'plan' in result.data
            ? result.data.plan
            : undefined;
    const parsed = SignupNoticeResponseSchema.shape.plan.safeParse(plan);
    return parsed.success ? parsed.data : null;
}

/** Resolve a protected signup notice, failing toward the conditional warning. */
export function resolveSignupTrialNotice({
    result
}: {
    readonly result: unknown;
}): SignupTrialNotice | null {
    if (!result || typeof result !== 'object' || !('ok' in result) || result.ok !== true) {
        return { kind: 'UNKNOWN' };
    }
    if (!('data' in result)) return { kind: 'UNKNOWN' };
    const parsed = SignupNoticeResponseSchema.safeParse(result.data);
    if (!parsed.success) return { kind: 'UNKNOWN' };
    if (parsed.data.trial.status === 'NOT_RUNNING') return null;
    return {
        kind: 'RUNNING',
        daysLeft: parsed.data.trial.daysLeft,
        endsAt: parsed.data.trial.endsAt
    };
}

/** Resolve the Tourist VIP warning, failing toward a visible notice when unreadable. */
export function resolveSignupTouristVipNotice({
    result
}: {
    readonly result: unknown;
}): SignupTouristVipNotice | null {
    if (!result || typeof result !== 'object' || !('ok' in result) || result.ok !== true) {
        return { kind: 'UNKNOWN' };
    }
    if (!('data' in result)) return { kind: 'UNKNOWN' };
    const parsed = SignupNoticeResponseSchema.safeParse(result.data);
    if (!parsed.success) return { kind: 'UNKNOWN' };
    if (parsed.data.touristVip.status === 'NOT_AFFECTED') return null;
    return { kind: 'CANCELLED_ON_RETURN' };
}

/** Query parameter that identifies the billing option selected for signup. */
export const SIGNUP_CHECKOUT_OPTION_PARAM = 'opcion';

/** Resolve an option UUID from a URLSearchParams-like search value. */
export function parseSignupOptionId({ search }: { readonly search: string }): string | null {
    const value = new URLSearchParams(search).get(SIGNUP_CHECKOUT_OPTION_PARAM);
    return value &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
        ? value
        : null;
}

/** Build the localized direct checkout URL used by pricing links. */
export function buildSignupCheckoutHref({
    locale,
    billingOptionId
}: {
    readonly locale: SupportedLocale;
    readonly billingOptionId: string;
}): string {
    return buildUrlWithParams({
        locale,
        path: 'suscriptores/checkout',
        params: { [SIGNUP_CHECKOUT_OPTION_PARAM]: billingOptionId }
    });
}

/** Localized rejection description returned by {@link resolveSignupRejection}. */
export interface SignupRejection {
    readonly reason: StartSubscriptionRejectionReason | 'UNKNOWN';
    readonly messageKey: string;
    readonly retryable: boolean;
    readonly showPlansLink: boolean;
}

const REJECTION_BY_REASON: Record<
    StartSubscriptionRejectionReason,
    Omit<SignupRejection, 'reason'>
> = {
    PLAN_NOT_FOR_SALE: {
        messageKey: 'billing.checkout.signup.rejection.planNotForSale',
        retryable: false,
        showPlansLink: true
    },
    PREVIOUS_ATTEMPT_CLOSING: {
        messageKey: 'billing.checkout.signup.rejection.previousAttemptClosing',
        retryable: true,
        showPlansLink: false
    },
    PREVIOUS_ATTEMPT_IN_PROGRESS: {
        messageKey: 'billing.checkout.signup.rejection.previousAttemptInProgress',
        retryable: true,
        showPlansLink: false
    },
    COMMITMENT_TAKEN: {
        messageKey: 'billing.checkout.signup.rejection.commitmentTaken',
        retryable: false,
        showPlansLink: false
    },
    TOURIST_VIP_INHERITED: {
        messageKey: 'billing.checkout.signup.rejection.touristVipInherited',
        retryable: false,
        showPlansLink: false
    },
    CREATION_NOT_APPLIED: {
        messageKey: 'billing.checkout.signup.rejection.generic',
        retryable: true,
        showPlansLink: false
    }
};

const GENERIC_REJECTION: SignupRejection = {
    reason: 'UNKNOWN',
    messageKey: 'billing.checkout.signup.rejection.generic',
    retryable: true,
    showPlansLink: false
};

function isStartSubscriptionRejectionReason(
    value: unknown
): value is StartSubscriptionRejectionReason {
    return typeof value === 'string' && Object.hasOwn(REJECTION_BY_REASON, value);
}

/** Map only recognized reasons to user-facing keys; API prose never escapes. */
export function resolveSignupRejection({ error }: { readonly error?: unknown }): SignupRejection {
    if (
        !error ||
        typeof error !== 'object' ||
        !('status' in error) ||
        typeof error.status !== 'number' ||
        error.status >= 500 ||
        !('reason' in error) ||
        !isStartSubscriptionRejectionReason(error.reason)
    ) {
        return GENERIC_REJECTION;
    }
    const reason = error.reason;
    return { reason, ...REJECTION_BY_REASON[reason] };
}

/** Translation key for each API vertical, exhaustively mapped. */
export const SIGNUP_VERTICAL_LABEL_KEY: Record<VerticalEnum, string> = {
    accommodation: 'billing.checkout.signup.vertical.accommodation',
    gastronomy: 'billing.checkout.signup.vertical.gastronomy',
    experience: 'billing.checkout.signup.vertical.experience',
    tourist: 'billing.checkout.signup.vertical.tourist',
    partner: 'billing.checkout.signup.vertical.partner'
};

/** Translation key for each supported signup billing cycle. */
export const SIGNUP_CYCLE_LABEL_KEY: Record<BillingCycle, string> = {
    monthly: 'billing.checkout.signup.cycle.monthly',
    quarterly: 'billing.checkout.signup.cycle.quarterly',
    semiannual: 'billing.checkout.signup.cycle.semiannual',
    annual: 'billing.checkout.signup.cycle.annual'
};

/** Return true only for parseable HTTP(S) provider URLs. */
export function isDisplayableCheckoutUrl({
    checkoutUrl
}: {
    readonly checkoutUrl: string;
}): boolean {
    try {
        return ['https:', 'http:'].includes(new URL(checkoutUrl).protocol);
    } catch {
        return false;
    }
}

/** Format the authorization-window end in the market timezone. */
export function formatSignupWindowEnd({
    iso,
    locale
}: {
    readonly iso: string;
    readonly locale: SupportedLocale;
}): string {
    return formatDate({
        date: iso,
        locale,
        options: { dateStyle: 'long', timeStyle: 'short', timeZone: MARKET_TIMEZONE }
    });
}
