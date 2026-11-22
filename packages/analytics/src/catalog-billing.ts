import { z } from 'zod';

const id = z.string().min(1);
const cycle = z.enum(['monthly', 'quarterly', 'semiannual', 'annual']);
/**
 * Verticals accepted by the billing and trial analytics schemas.
 *
 * The values MUST stay identical to `Object.values(VerticalEnum)` from
 * `@repo/schemas`. `apps/api/test/utils/analytics/catalog-parity.test.ts`
 * pins that parity, so renaming an enum VALUE (HOS-1801, stage B) must update
 * this list in the same pull request.
 */
const vertical = z.enum(['accommodation', 'venue', 'experience', 'tourist', 'partner']);
const actorKind = z.enum(['USER', 'ADMIN', 'SYSTEM']);
const subscriptionClass = z.enum(['PRINCIPAL', 'COMPLEMENTO']);
const currency = z.literal('ARS');
const money = z.number().int().nonnegative();
const common = {
    vertical,
    subscription_class: subscriptionClass,
    actor_kind: actorKind,
    subscription_id: id
};
const trialCommon = { vertical, actor_kind: actorKind };

/**
 * Closed Zod schemas for the billing and trial analytics events.
 *
 * Each entry validates the `properties` payload of the matching catalog event;
 * `AnalyticsEventSchemas` spreads this map into the full analytics catalog.
 */
export const BillingAnalyticsEventSchemas = {
    billing_checkout_started: z.object({
        ...common,
        plan_version_id: id,
        billing_option_id: id,
        cycle,
        amount_minor: money,
        currency,
        is_succession: z.boolean().optional()
    }),
    billing_checkout_abandoned: z.object({
        ...common,
        reason: z.enum(['WINDOW_EXPIRED', 'USER_CANCELLED']),
        seconds_in_pending: z.number().int().nonnegative().optional()
    }),
    billing_subscription_activated: z.object({
        ...common,
        plan_version_id: id,
        billing_option_id: id,
        cycle,
        amount_minor: money,
        currency,
        trial_active_at_activation: z.boolean().optional()
    }),
    billing_plan_changed: z.object({
        ...common,
        from_plan_version_id: id,
        to_plan_version_id: id,
        from_cycle: cycle,
        to_cycle: cycle,
        direction: z.enum(['UPGRADE', 'DOWNGRADE', 'LATERAL']),
        from_amount_minor: money.optional(),
        to_amount_minor: money.optional()
    }),
    billing_charge_succeeded: z.object({
        ...common,
        payment_id: id,
        amount_minor: money,
        currency,
        is_first_charge: z.boolean(),
        cycle,
        plan_version_id: id.optional(),
        promo_applied: z.boolean().optional()
    }),
    billing_charge_declined: z.object({
        ...common,
        payment_id: id,
        amount_minor: money,
        currency,
        is_first_charge: z.boolean(),
        next_state: z.enum(['GRACE_PERIOD', 'CHARGE_DECLINED', 'UNCHANGED']),
        has_retry_window: z.boolean().optional()
    }),
    billing_grace_entered: z.object({
        ...common,
        grace_ends_at: z.string().datetime(),
        days_of_grace: z.number().int().nonnegative().optional()
    }),
    billing_subscription_suspended: z.object({
        ...common,
        trigger: z.enum([
            'GRACE_EXPIRED',
            'PROVIDER_PAUSE_OBSERVED',
            'SUCCESSOR_PROVIDER_CANCELLED'
        ]),
        days_in_grace: z.number().int().nonnegative().optional()
    }),
    billing_subscription_recovered: z.object({
        ...common,
        recovered_from: z.enum(['GRACE_PERIOD', 'SUSPENDED']),
        payment_id: id,
        days_in_state: z.number().int().nonnegative().optional()
    }),
    billing_cancel_scheduled: z.object({
        ...common,
        service_ends_at: z.string().datetime(),
        basis: z.enum(['PAID_PERIOD', 'CREDIT', 'NOW']),
        reason: z
            .enum([
                'TOO_EXPENSIVE',
                'NOT_ENOUGH_RESULTS',
                'MISSING_FEATURES',
                'SEASONAL_PAUSE',
                'CLOSING_BUSINESS',
                'SWITCHING_PLATFORM',
                'TECHNICAL_PROBLEMS',
                'OTHER'
            ])
            .optional()
    }),
    billing_subscription_cancelled: z.object({
        ...common,
        cancelled_by: z.enum(['USER', 'ADMIN', 'SYSTEM']),
        path: z.enum([
            'SERVICE_END',
            'DIRECT_FROM_GRACE',
            'DIRECT_FROM_SUSPENDED',
            'DIRECT_FROM_PAUSED',
            'REVOKED',
            'INHERITED_BY_PLAN'
        ]),
        was_scheduled: z.boolean(),
        lifetime_days: z.number().int().nonnegative().optional(),
        reason: z
            .enum([
                'TOO_EXPENSIVE',
                'NOT_ENOUGH_RESULTS',
                'MISSING_FEATURES',
                'SEASONAL_PAUSE',
                'CLOSING_BUSINESS',
                'SWITCHING_PLATFORM',
                'TECHNICAL_PROBLEMS',
                'OTHER'
            ])
            .optional()
    }),
    trial_started: z.object({
        ...trialCommon,
        activation_event: z.enum(['listing_published', 'start_button_pressed']),
        trial_days: z.number().int().nonnegative().optional()
    }),
    trial_converted: z.object({
        ...trialCommon,
        transition: z.enum(['T2', 'T5', 'T8']),
        trial_state_before: z.enum(['ACTIVE', 'EXPIRED', 'NONE']),
        days_into_trial: z.number().int().nonnegative().optional(),
        days_since_expiry: z.number().int().nonnegative().optional()
    }),
    trial_expired: z.object({
        ...trialCommon,
        trial_days: z.number().int().nonnegative(),
        had_paid_intent: z.boolean().optional()
    })
} as const;

const addonScopeType = z.enum(['LISTING', 'VERTICAL_SUBSCRIPTION', 'USER', 'GLOBAL']);
const addonCommon = {
    addon_instance_id: id,
    addon_id: id,
    addon_version_id: id,
    addon_product_id: id,
    charge_kind: z.enum(['UNA_VEZ', 'PERIODICO']),
    scope_type: addonScopeType,
    actor_kind: actorKind,
    vertical: vertical.optional(),
    subscription_id: id.optional()
};
/**
 * Add-on numbers are bounded below Umami's numeric(19,4) ceiling (1e15, AC-14): a larger value
 * would make Umami answer 400 and lose the whole event.
 */
const UMAMI_MAX_NUMBER = 999_999_999_999_999;
const addonMoney = z.number().int().nonnegative().max(UMAMI_MAX_NUMBER);
const boundedCount = z.number().int().nonnegative().max(UMAMI_MAX_NUMBER);

/**
 * Zod schemas for the add-on analytics events (HOS-1883, O-1: a dedicated `addon_*` family).
 *
 * Closed enums, but plain `z.object` and never `.strict()` (P-11): HOS-2355 will add an optional
 * `reason` to `addon_cancelled` without breaking any consumer. `billing_*` stays PRINCIPAL-only.
 */
export const AddonAnalyticsEventSchemas = {
    addon_checkout_started: z.object({
        ...addonCommon,
        amount_minor: addonMoney,
        currency,
        cycle: cycle.optional()
    }),
    addon_checkout_abandoned: z.object({
        ...addonCommon,
        reason: z.enum(['WINDOW_EXPIRED', 'OWNER_WITHDREW', 'CLOSED_BY_SYSTEM']),
        seconds_in_pending: boundedCount.optional()
    }),
    addon_activated: z.object({
        ...addonCommon,
        amount_minor: addonMoney,
        currency,
        cycle: cycle.optional(),
        seconds_in_pending: boundedCount.optional()
    }),
    addon_charge_succeeded: z.object({
        ...addonCommon,
        payment_id: id,
        amount_minor: addonMoney,
        currency,
        is_first_charge: z.boolean().optional(),
        cycle: cycle.optional(),
        promo_applied: z.boolean().optional()
    }),
    addon_charge_declined: z.object({
        ...addonCommon,
        payment_id: id,
        amount_minor: addonMoney,
        currency,
        is_first_charge: z.boolean(),
        has_retry_window: z.boolean().optional()
    }),
    addon_cancelled: z.object({
        ...addonCommon,
        path: z.enum([
            'OWNER_WITHDREW',
            'SERVICE_END',
            'ORPHANED',
            'GRANT_REVOKED',
            'LISTING_PURGED'
        ]),
        was_scheduled: z.boolean(),
        lifetime_days: boundedCount.optional()
    }),
    addon_granted_free: z.object({
        ...addonCommon,
        source: z.enum(['S20_CONVERSION', 'FREE_CHOICE']),
        previous_amount_minor: addonMoney.optional(),
        previous_cycle: cycle.optional(),
        previous_subscription_id: id.optional()
    })
} as const;
