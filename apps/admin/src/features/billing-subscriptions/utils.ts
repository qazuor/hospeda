import { ALL_PLANS, type PlanDefinition } from '@repo/billing';
import type { TranslationKey } from '@repo/i18n';
import { defaultIntlLocale } from '@repo/i18n';
import type { AdminSubscriptionViewStatus } from '@repo/schemas';
import {
    formatArs as formatArsHelper,
    formatCentsToArs,
    formatShortDate as formatShortDateHelper
} from '@/lib/format-helpers';
import type { Subscription, SubscriptionStatus } from './types';

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
 * omitted them. `courtesy` (HOS-180) was ALSO missing until HOS-1245 — this
 * map is a `Record`, so TypeScript would have caught it here the moment the
 * schema widened, but the schema itself never declared `courtesy` in the
 * first place (the actual HOS-1245 defect, one layer down in
 * `admin-billing-view.shared.ts`'s `assertKnownStatus`, which THROWS on an
 * unmapped status instead of falling through to `undefined`).
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
        comp: 'secondary',
        courtesy: 'secondary'
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
        comp: 'admin-billing.subscriptions.statuses.comp',
        courtesy: 'admin-billing.subscriptions.statuses.courtesy'
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
 * A destination must ALSO be in the same product domain, and that is now a
 * real comparison rather than an allowlist of one (HOS-1233 T-039 / AC-15j).
 *
 * The trap it defends against is the HOS-331 follow-up: `commerce-listing`,
 * `partner-listing`, `partner-silver` and `partner-gold` are all stamped
 * `category: 'owner'` in `plans.config.ts` purely to satisfy the `PlanCategory`
 * type — their REAL discriminator is `product_domain`. A category-only match
 * would offer an operator `owner-basico` as a "same family" destination for a
 * `partner-gold` subscription.
 *
 * This used to read `if (currentProductDomain !== 'accommodation') return []`,
 * which closed that trap by refusing every non-accommodation subscription
 * outright. It worked only because tourist subscriptions were MISFILED as
 * accommodation and slipped through it (spec F-4b) — they passed the gate and
 * were then correctly narrowed to tourist plans by the category filter. Once
 * T-038 reclassifies those rows, that same gate returns **zero** destinations
 * for every tourist subscription: a silent regression, in a surface nobody
 * would think to re-test. Hence the two-sided comparison below.
 *
 * Two independent reads, both required, because they can disagree:
 *
 *   - **The catalog side** (`plan.productDomain === currentPlan.productDomain`)
 *     is what actually closes the trap. Since T-034 every `PlanDefinition`
 *     states its own domain, so `partner-gold` no longer matches an
 *     accommodation destination even if it were resolvable here — no allowlist
 *     needed, and a vertical added later is covered without editing this file.
 *   - **The row side** (`currentProductDomain`, read off the subscription
 *     payload's `plan.productDomain` served by the admin billing view contract)
 *     is defense in depth against the catalog and the live row drifting apart.
 *     When they disagree, this returns nothing — deliberately fail-closed: an
 *     operator moving a subscription between plans on a stale reading of what
 *     it IS is the failure worth preventing here.
 *
 * That fail-closed direction is why this task is ordered AFTER T-038 and not
 * before: an un-migrated tourist row still claiming `accommodation` disagrees
 * with its own tourist plan and would be offered no destinations. The backfill
 * is what makes the two sides agree.
 *
 * A `null`/`undefined` row domain is NOT a disagreement. It is how every
 * subscription predating the column reads, and `subscriptionMatchesDomain`
 * treats it as accommodation for that reason; here the catalog plan's own
 * domain answers instead, which is a real value rather than a bypass.
 */
export function getChangePlanOptions(input: {
    readonly currentPlan: PlanDefinition | undefined;
    readonly currentSlug: string;
    readonly currentProductDomain?: string | null;
    /**
     * The catalog to choose destinations from. Defaults to `ALL_PLANS`;
     * production callers omit it.
     *
     * Injectable because the `isActive` half of this filter can only be tested
     * against a catalog that HAS a retired plan, and `ALL_PLANS` no longer does:
     * HOS-692 removed the `complex-*` tiers and HOS-1224 removed `tourist-plus`,
     * which was the last `isActive: false` entry. Over an all-active catalog
     * every retired-plan assertion passes no matter what this filter does — a
     * vacuous green, and precisely the bug HOS-331 was about. So the test
     * supplies its own retired plan; the filter is not weakened to suit the
     * catalog it happens to have today.
     */
    readonly plans?: readonly PlanDefinition[];
}): PlanDefinition[] {
    const { currentPlan, currentSlug, currentProductDomain, plans = ALL_PLANS } = input;
    if (!currentPlan) return [];

    // A row that states no domain is a legacy row, not a contradicting one —
    // the catalog plan's own domain answers for it. `currentPlan` is non-null
    // here, so this never falls through to "no domain at all".
    const domain = currentProductDomain ?? currentPlan.productDomain;
    if (domain !== currentPlan.productDomain) return [];

    return plans.filter(
        (plan) =>
            plan.productDomain === domain &&
            plan.category === currentPlan.category &&
            plan.slug !== currentSlug &&
            plan.isActive
    );
}

/**
 * Builds the `POST /api/v1/admin/billing/subscriptions/grant-comp` request
 * body from the dialog's confirmed selection (HOS-1314).
 *
 * Extracted as its own pure function specifically so this mapping is
 * directly unit-testable: `subscription.customerId` (a `billing_customers.id`)
 * and `subscription.user?.id` (a Hospeda `users.id`) are both UUIDs sitting
 * on the same row, and confusing the two is exactly the class of bug this
 * whole feature exists to prevent — the grant would silently target the
 * customer's LOGIN identity instead of their BILLING identity, which the
 * `grant-comp` endpoint would 404 on for anyone whose two ids don't happen
 * to collide, or worse, comp the wrong billing customer if they ever did.
 *
 * @param input.subscription - The subscription the dialog was opened from
 *   (used only to resolve the target customer).
 * @param input.planId - The plan UUID chosen in the dialog's selector.
 * @param input.interval - The billing interval chosen in the dialog (audit
 *   only — a comp is never charged either way).
 * @returns The exact body `useGrantCompMutation` sends.
 */
export function buildGrantCompPayload(input: {
    readonly subscription: Subscription;
    readonly planId: string;
    readonly interval: 'monthly' | 'annual';
}): { customerId: string; planId: string; interval: 'monthly' | 'annual' } {
    const { subscription, planId, interval } = input;
    return {
        customerId: subscription.customerId,
        planId,
        interval
    };
}
