/** Shared catalog and result handling for account and pricing plan-change offers. */
import {
    type PricingSituationVertical,
    PublicPlanCatalogResponseSchema,
    SubscriptionPlanChangeResponseSchema
} from '@repo/schemas';
import { apiClient } from '@/lib/api/client';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import type { ApiResult } from '@/lib/api/types';
import { getPlanName } from '@/lib/billing/plan-name';
import { SIGNUP_CYCLE_LABEL_KEY } from '@/lib/billing/signup-checkout';
import { formatPrice } from '@/lib/format-utils';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { formatNoticeInstant } from '@/lib/listing/listing-notices';

/** One purchasable option rendered by the account offer. */
export interface PlanChangeChoice {
    readonly id: string;
    readonly label: string;
}

/** Resolve the owner's active principal row for one pricing vertical. */
export async function findActiveSubscriptionId({
    vertical
}: {
    readonly vertical: PricingSituationVertical;
}): Promise<string | null> {
    const mine = await billingSubscriptionApi.listMine({});
    if (!mine.ok) return null;
    return (
        mine.data.subscriptions.find((row) => row.vertical === vertical && row.status === 'ACTIVE')
            ?.id ?? null
    );
}

/** Read the pricing catalog and the anchored option, omitting only that option. */
export async function loadPlanChangeChoices({
    subscriptionId,
    vertical,
    locale
}: {
    readonly subscriptionId: string;
    readonly vertical: PricingSituationVertical;
    readonly locale: SupportedLocale;
}): Promise<readonly PlanChangeChoice[] | null> {
    const [catalog, current] = await Promise.all([
        apiClient.get<unknown>({ path: '/api/v1/public/plan-catalog', params: { vertical } }),
        billingSubscriptionApi.read({ subscriptionId })
    ]);
    if (!catalog.ok || !current.ok || current.data.status !== 'ACTIVE') return null;
    const parsed = PublicPlanCatalogResponseSchema.safeParse(catalog.data);
    if (!parsed.success || parsed.data.vertical !== vertical) return null;
    const { t } = createTranslations(locale);
    return parsed.data.plans.flatMap((plan) => {
        if (!plan.billingOptions.some((option) => option.cycle === 'monthly')) return [];
        const name = getPlanName({
            plan: { slug: plan.slug, name: plan.name, description: plan.description ?? '' },
            t
        });
        return plan.billingOptions
            .filter(
                (option) =>
                    (option.cycle === 'monthly' || option.cycle === 'annual') &&
                    option.id !== current.data.billingOptionId
            )
            .map((option) => ({
                id: option.id,
                label: t('account.subscription.mine.planChange.choice', undefined, {
                    plan: name,
                    cycle: t(SIGNUP_CYCLE_LABEL_KEY[option.cycle]),
                    price: formatPrice({
                        amount: option.amount / 100,
                        locale,
                        showDecimals: option.amount % 100 !== 0
                    })
                })
            }));
    });
}

/** Localized response after a protected plan-change request. */
export type PlanChangeResult =
    | { readonly kind: 'redirect'; readonly checkoutUrl: string }
    | { readonly kind: 'message'; readonly message: string };

/** Submit a selected option and resolve the server's outcome without inferring direction. */
export async function submitPlanChange({
    subscriptionId,
    billingOptionId,
    locale
}: {
    readonly subscriptionId: string;
    readonly billingOptionId: string;
    readonly locale: SupportedLocale;
}): Promise<PlanChangeResult> {
    const { t } = createTranslations(locale);
    try {
        const response = await billingSubscriptionApi.requestPlanChange({
            subscriptionId,
            billingOptionId
        });
        if (!response.ok)
            return {
                kind: 'message',
                message: planChangeErrorMessage({ result: response, locale })
            };
        const parsed = SubscriptionPlanChangeResponseSchema.safeParse(response.data);
        if (!parsed.success)
            return { kind: 'message', message: t('account.subscription.mine.planChange.error') };
        if (parsed.data.outcome === 'SUCCESSION')
            return { kind: 'redirect', checkoutUrl: parsed.data.checkoutUrl };
        if (parsed.data.outcome === 'REGRET')
            return { kind: 'message', message: t('account.subscription.mine.planChange.regret') };
        const date = formatNoticeInstant({ iso: parsed.data.effectiveAt, locale });
        return {
            kind: 'message',
            message: date
                ? t('account.subscription.mine.planChange.downgrade', undefined, { date })
                : t('account.subscription.mine.planChange.error')
        };
    } catch {
        return { kind: 'message', message: t('account.subscription.mine.planChange.error') };
    }
}

/** Translate a structured conflict or validation reason without exposing server text. */
export function planChangeErrorMessage({
    result,
    locale
}: {
    readonly result: Extract<ApiResult<unknown>, { readonly ok: false }>;
    readonly locale: SupportedLocale;
}): string {
    const { t } = createTranslations(locale);
    if (
        result.error.status === 502 &&
        result.error.code === 'PROVIDER_ERROR' &&
        (result.error.reason === 'CREATION_NOT_APPLIED' ||
            (result.error.details &&
                typeof result.error.details === 'object' &&
                'reason' in result.error.details &&
                result.error.details.reason === 'CREATION_NOT_APPLIED'))
    )
        return t('account.subscription.mine.planChange.reason.providerNotApplied');
    if (result.error.status !== 409 && result.error.status !== 422)
        return t('account.subscription.mine.planChange.error');
    const details = result.error.details;
    const reason =
        details && typeof details === 'object' && 'reason' in details ? details.reason : null;
    if (
        reason === 'CHANGE_WINDOW_TOO_SHORT' &&
        details &&
        typeof details === 'object' &&
        'availableFrom' in details &&
        typeof details.availableFrom === 'string'
    ) {
        const date = formatNoticeInstant({ iso: details.availableFrom, locale });
        if (date)
            return t('account.subscription.mine.planChange.reason.windowDate', undefined, {
                date
            });
    }
    const key =
        reason === 'GRACE_PERIOD'
            ? 'grace'
            : reason === 'CYCLE_END_PENDING'
              ? 'cycleEndPending'
              : reason === 'CHANGE_WINDOW_TOO_SHORT' || reason === 'SUCCESSION_WINDOW_TOO_SHORT'
                ? 'window'
                : reason === 'NO_CHANGE'
                  ? 'same'
                  : reason === 'SCHEDULED_CHANGE_EXISTS' || reason === 'MIGRATION_CHANGE_QUEUED'
                    ? 'scheduled'
                    : 'other';
    return t(`account.subscription.mine.planChange.reason.${key}`);
}
