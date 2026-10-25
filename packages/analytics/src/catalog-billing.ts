import { z } from 'zod';

const id = z.string().min(1);
const cycle = z.enum(['monthly', 'quarterly', 'semiannual', 'annual']);
const vertical = z.enum(['accommodation', 'gastronomy', 'experience', 'tourist', 'partner']);
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
        path: z.enum(['SERVICE_END', 'DIRECT_FROM_GRACE', 'DIRECT_FROM_SUSPENDED', 'REVOKED']),
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
