import { ALL_PLANS, type PlanDefinition } from '@repo/billing';
import type { TranslationKey } from '@repo/i18n';
import { defaultIntlLocale } from '@repo/i18n';
import type { AdminSubscriptionViewStatus } from '@repo/schemas';
import {
    formatArs as formatArsHelper,
    formatCentsToArs,
    formatShortDate as formatShortDateHelper
} from '@/lib/format-helpers';
import type { SubscriptionStatus } from './types';

/**
 * Format a date string as short date (DD/MM/YYYY). Returns "—" for
 * `null`/`undefined` — several `AdminSubscriptionView` date fields
 * (`currentPeriodEnd`, `trialEnd`, ...) are nullable.
 * Backward-compatible wrapper around shared format helper.
 */
export function formatDate(
    date: string | null | undefined,
    locale: string = defaultIntlLocale
): string {
    return formatShortDateHelper({ date, locale });
}

/**
 * Format a WHOLE-UNIT ARS amount (e.g. a proration diff already divided down
 * to pesos, or a `PaymentHistory.amount` entry — see its JSDoc in `types.ts`).
 * Backward-compatible wrapper around shared format helper.
 *
 * Do NOT hand this centavos. Use {@link formatArsFromCents} for any field
 * suffixed `InCents` (e.g. `recurringAmountInCents`).
 */
export function formatArs(amount: number, locale: string = defaultIntlLocale): string {
    return formatArsHelper({ value: amount, locale });
}

/**
 * Format an ARS amount given in integer CENTAVOS, e.g.
 * `AdminSubscriptionView.recurringAmountInCents`.
 *
 * Callers MUST check for `null` first and render "—" instead of calling this
 * with `null` — `recurringAmountInCents` is nullable and a fabricated
 * `$ 0,00` for "no plan price on record" was part of the original defect.
 */
export function formatArsFromCents(cents: number, locale: string = defaultIntlLocale): string {
    return formatCentsToArs({ cents, locale });
}

/**
 * Get status badge variant based on subscription status.
 *
 * Covers every member of {@link AdminSubscriptionViewStatus}. `abandoned` and
 * `pending_provider` are real production values that previously fell through
 * to `undefined` (empty badge) because the local `SubscriptionStatus` union
 * omitted them.
 */
export function getStatusVariant(
    status: SubscriptionStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
    const variantMap: Record<
        AdminSubscriptionViewStatus,
        'default' | 'secondary' | 'destructive' | 'outline'
    > = {
        active: 'default',
        trialing: 'secondary',
        cancelled: 'destructive',
        past_due: 'outline',
        expired: 'outline',
        paused: 'secondary',
        pending_provider: 'outline',
        abandoned: 'destructive',
        comp: 'secondary'
    };
    return variantMap[status];
}

/**
 * Get status label using i18n. Covers every member of
 * {@link AdminSubscriptionViewStatus}.
 */
export function getStatusLabel(
    status: SubscriptionStatus,
    t: (key: TranslationKey) => string
): string {
    const labels: Record<AdminSubscriptionViewStatus, TranslationKey> = {
        active: 'admin-billing.subscriptions.statuses.active',
        trialing: 'admin-billing.subscriptions.statuses.trialing',
        cancelled: 'admin-billing.subscriptions.statuses.cancelled',
        past_due: 'admin-billing.subscriptions.statuses.pastDue',
        expired: 'admin-billing.subscriptions.statuses.expired',
        paused: 'admin-billing.subscriptions.statuses.paused',
        pending_provider: 'admin-billing.subscriptions.statuses.pendingProvider',
        abandoned: 'admin-billing.subscriptions.statuses.abandoned',
        comp: 'admin-billing.subscriptions.statuses.comp'
    };
    return t(labels[status]);
}

/**
 * Get plan display details by slug, from the static accommodation-only
 * catalog.
 *
 * CONFIG-FALLBACK(SPEC-192): reads from `ALL_PLANS`, which is deliberately
 * accommodation-only (SPEC-239) — `commerce-listing`, `partner-listing`,
 * `partner-silver`, and `partner-gold` are excluded from it even though they
 * are real, purchasable plans. Used ONLY for resolving a `PlanDefinition`
 * (category, entitlements) to compute change-plan options and proration —
 * NEVER for rendering a subscription's own current plan, which must come
 * from the API payload's nested `plan` ref (`AdminBillingPlanRef`) instead.
 */
export function getPlanBySlug(slug: string): PlanDefinition | undefined {
    return ALL_PLANS.find((plan) => plan.slug === slug);
}

/**
 * The plans an operator may move a subscription TO, given the plan it is on.
 *
 * A destination plan must be (1) in the same category — a tourist subscription
 * cannot become an owner one — (2) different from the current plan, and (3)
 * **active**.
 *
 * `currentProductDomain` is a DEFENSE-IN-DEPTH guard, checked independently
 * of the `ALL_PLANS` category lookup (HOS-331 follow-up trap): `ALL_PLANS`
 * is accommodation-only by design, but `commerce-listing`, `partner-listing`,
 * `partner-silver`, and `partner-gold` are all stamped `category: 'owner'` in
 * `plans.config.ts` purely to satisfy the `PlanCategory` type — their REAL
 * discriminator is `product_domain`. If `currentPlan` is ever resolved from a
 * wider catalog than `ALL_PLANS` (or `ALL_PLANS`'s accommodation-only
 * invariant erodes), a category-only match would offer an operator
 * `owner-basico` as a "same family" destination for a `partner-gold`
 * subscription. `currentProductDomain` is read directly off the subscription
 * payload's `plan.productDomain` (served by the admin billing view contract)
 * and gates BEFORE the `ALL_PLANS` filter runs. A `null`/`undefined` domain
 * (unresolvable plan) is treated as "unknown, do not block" — the `!currentPlan`
 * guard above already covers that case.
 */
export function getChangePlanOptions(input: {
    readonly currentPlan: PlanDefinition | undefined;
    readonly currentSlug: string;
    readonly currentProductDomain?: string | null;
}): PlanDefinition[] {
    const { currentPlan, currentSlug, currentProductDomain } = input;
    if (!currentPlan) return [];
    if (currentProductDomain && currentProductDomain !== 'accommodation') return [];
    return ALL_PLANS.filter(
        (plan) =>
            plan.category === currentPlan.category && plan.slug !== currentSlug && plan.isActive
    );
}
