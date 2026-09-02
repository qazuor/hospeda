/**
 * Courtesy Grant Service (HOS-180)
 *
 * Gifts N free billing cycles to a subscriber who is already paying, without
 * cancelling their subscription, without asking for their card again, and
 * without them losing a single entitlement.
 *
 * ## How it works
 *
 * MercadoPago has no concept of "this month is on us", but it does know how to
 * pause a preapproval — and a paused preapproval skips cycles without being
 * destroyed. So a courtesy is a **paused preapproval plus a local window**, and
 * `deriveCourtesyStatus` is what turns MP's `paused` back into `courtesy` on
 * every webhook. When the window closes, a cron resumes the preapproval and the
 * subscription returns to `active` at full price on its own.
 *
 * ## Why not `comp`
 *
 * `comp` is permanent by construction and destroys the preapproval
 * (`mp_subscription_id = NULL`). There is nothing to return to. A gift has to
 * end.
 *
 * ## Ordering, and why it is not negotiable
 *
 * MercadoPago is called BEFORE the local write. If MP refuses, nothing was
 * promised locally. The reverse order can leave a subscriber marked `courtesy` —
 * entitlements and all — with a preapproval that is still charging them every
 * month (spec R-3).
 *
 * @module services/courtesy-grant
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { billingSubscriptions, eq, getDb } from '@repo/db';
import { billingSubscriptionEvents } from '@repo/db/schemas';
import { SubscriptionStatusEnum } from '@repo/schemas';
import {
    BILLING_EVENT_TYPES,
    type CourtesyCadence,
    computeCourtesyWindow,
    readCourtesyFields,
    writeCourtesyFields
} from '@repo/service-core';
import { clearEntitlementCache } from '../middlewares/entitlement.js';
import { apiLogger } from '../utils/logger';
import { recordPauseProviderRefusal } from './billing/pause-refusal-audit.js';
import { sendCourtesyGrantedNotification } from './courtesy-notifications.service.js';

/** Input for {@link grantCourtesyCycles}. */
export interface GrantCourtesyCyclesInput {
    /** The qzpay billing facade. */
    readonly billing: QZPayBilling;
    /** UUID of the subscription to gift. */
    readonly subscriptionId: string;
    /** How many billing cycles to gift. Positive integer, no upper cap. */
    readonly cycles: number;
    /** Acting admin's user id, recorded in the audit event. */
    readonly actorId: string;
    /** Injected clock, so the lead-time rule is testable. */
    readonly now?: Date;
}

/** Typed failure codes, mapped to HTTP status by the route. */
export type GrantCourtesyErrorCode =
    | 'NOT_FOUND'
    | 'NOT_ELIGIBLE'
    | 'ALREADY_COURTESY'
    | 'NOT_ENOUGH_LEAD_TIME'
    | 'INVALID_CYCLES'
    | 'UNKNOWN_BILLING_INTERVAL'
    | 'PROVIDER_ERROR';

/** Result of {@link grantCourtesyCycles}. */
export type GrantCourtesyResult =
    | {
          readonly success: true;
          readonly data: {
              readonly subscriptionId: string;
              readonly courtesyStartsAt: Date;
              readonly courtesyEndsAt: Date;
              readonly courtesyCyclesGranted: number;
          };
      }
    | {
          readonly success: false;
          readonly error: { readonly code: GrantCourtesyErrorCode; readonly message: string };
      };

/**
 * Statuses a courtesy may be granted over.
 *
 * Only `active`. A `trialing` subscriber is not being charged yet, so gifting
 * them cycles is a trial extension — a different mechanism with its own
 * endpoint. Everything else is either already gifted, already leaving, or not
 * live at all.
 */
const GRANTABLE_STATUSES = new Set<string>([SubscriptionStatusEnum.ACTIVE]);

/**
 * Resolves the billing cadence from a subscription's stored metadata.
 *
 * Mirrors how `subscription-pause.ts` reads `metadata.billingInterval`, which is
 * the only place the interval is recorded.
 *
 * Returns `null` when the interval is absent or unrecognised, and the caller
 * refuses the grant (HOS-995). It used to fall back to `'monthly'`, which meant
 * an annual subscriber whose metadata was missing the key silently received a
 * gift of one MONTH where a YEAR was intended — the admin saw a success, the
 * subscriber got a twelfth of the gift, and nothing anywhere said so.
 *
 * Under-gifting rather than over-gifting is not a reason to keep guessing. This
 * value decides whether N cycles means N months or N years; a service that
 * cannot tell must not pick one. All three creation paths record the key
 * (`start-paid.ts`, `trial.ts`, `plan-change.ts`), so an absent value means a
 * corrupt or pre-HOS-171 row, and that is worth surfacing rather than papering
 * over.
 */
function resolveCadence(metadata: unknown): CourtesyCadence | null {
    const interval =
        metadata && typeof metadata === 'object'
            ? (metadata as Record<string, unknown>).billingInterval
            : undefined;
    if (interval === 'annual') {
        return 'annual';
    }
    if (interval === 'monthly') {
        return 'monthly';
    }
    return null;
}

/**
 * Gifts `cycles` free billing cycles to an active subscription.
 *
 * @param input - See {@link GrantCourtesyCyclesInput}.
 * @returns The computed window on success, or a typed error.
 *
 * @example
 * ```ts
 * const result = await grantCourtesyCycles({
 *   billing, subscriptionId, cycles: 1, actorId: actor.id,
 * });
 * if (result.success) console.log('gift ends', result.data.courtesyEndsAt);
 * ```
 */
export async function grantCourtesyCycles(
    input: GrantCourtesyCyclesInput
): Promise<GrantCourtesyResult> {
    const { billing, subscriptionId, cycles, actorId, now = new Date() } = input;

    const db = getDb();
    const [subscription] = await db
        .select()
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, subscriptionId))
        .limit(1);

    if (!subscription) {
        return {
            success: false,
            error: { code: 'NOT_FOUND', message: `Subscription not found: ${subscriptionId}` }
        };
    }

    // Already gifted? Refuse rather than silently extending — stacking gifts is
    // a different decision nobody has made, and overwriting the window would
    // lose the audit trail of the first grant.
    if (readCourtesyFields(subscription).courtesyEndsAt !== null) {
        return {
            success: false,
            error: {
                code: 'ALREADY_COURTESY',
                message: 'This subscription already has a courtesy window'
            }
        };
    }

    if (!GRANTABLE_STATUSES.has(subscription.status)) {
        return {
            success: false,
            error: {
                code: 'NOT_ELIGIBLE',
                message: `A courtesy can only be granted on an active subscription (this one is '${subscription.status}')`
            }
        };
    }

    // A subscription already on its way out must not be gifted: the cancel
    // finalisation cron would flip it to `cancelled` mid-gift, and the expiry
    // cron would then try to resume a preapproval its owner asked to end.
    if (subscription.cancelAtPeriodEnd === true) {
        return {
            success: false,
            error: {
                code: 'NOT_ELIGIBLE',
                message: 'This subscription is scheduled for cancellation and cannot be gifted'
            }
        };
    }

    if (!subscription.mpSubscriptionId) {
        return {
            success: false,
            error: {
                code: 'NOT_ELIGIBLE',
                message:
                    'This subscription has no MercadoPago preapproval to pause, so its cycles cannot be skipped'
            }
        };
    }

    // Refused BEFORE MercadoPago is called, so a subscription whose interval we
    // cannot read is never paused. Pausing first and failing to size the window
    // afterwards would leave a live preapproval suspended with no window to
    // resume it (spec R-3, same ordering rule as the write).
    const cadence = resolveCadence(subscription.metadata);
    if (cadence === null) {
        return {
            success: false,
            error: {
                code: 'UNKNOWN_BILLING_INTERVAL',
                message:
                    'This subscription does not record a billing interval, so a gift of ' +
                    `${cycles} cycle(s) cannot be sized. Fix metadata.billingInterval before granting.`
            }
        };
    }

    const computed = computeCourtesyWindow({
        currentPeriodEnd: subscription.currentPeriodEnd ?? null,
        cycles,
        cadence,
        now
    });

    if (!computed.ok) {
        const { refusal } = computed;
        if (refusal.kind === 'invalid-cycles') {
            return {
                success: false,
                error: {
                    code: 'INVALID_CYCLES',
                    message: `Cycles must be a positive integer (received ${refusal.cycles})`
                }
            };
        }
        if (refusal.kind === 'no-period-end') {
            return {
                success: false,
                error: {
                    code: 'NOT_ELIGIBLE',
                    message:
                        'This subscription has no current period end, so there is no boundary to start a gift from'
                }
            };
        }
        return {
            success: false,
            error: {
                code: 'NOT_ENOUGH_LEAD_TIME',
                message:
                    `The next charge is in ${refusal.daysUntil} day(s) ` +
                    `(${refusal.nextChargeAt.toISOString()}). Pausing this close may not stop it, ` +
                    'and the subscriber would be charged for the very cycle being gifted. ' +
                    'Grant the courtesy earlier in the period.'
            }
        };
    }

    const { window } = computed;

    // MercadoPago FIRST — see the ordering note in this module's header.
    try {
        await billing.subscriptions.pause(subscriptionId);
    } catch (error) {
        // HOS-995: a refused pause is fail-closed — nothing below this line
        // runs, so no subscriber is marked `courtesy` while still being charged.
        // Fail-closed is not the same as detectable, though, and this is the one
        // path where the difference has teeth: gifting a full YEAR means pausing
        // a twelve-month preapproval, and whether MercadoPago accepts that has
        // never been verified against the sandbox (HOS-180 risk R-9). If it
        // refuses, the admin sees an error and nothing else in the system knows
        // — a log line is not queryable weeks later. The seat is, and it carries
        // the interval, which is the variable in question.
        await recordPauseProviderRefusal({
            subscriptionId,
            triggerSource: 'admin-courtesy-grant',
            billingInterval: cadence,
            error
        });
        apiLogger.error(
            {
                subscriptionId,
                cadence,
                cycles,
                actorId,
                error: error instanceof Error ? error.message : String(error)
            },
            'Courtesy grant: MercadoPago pause failed, nothing was written locally'
        );
        return {
            success: false,
            error: {
                code: 'PROVIDER_ERROR',
                message: `MercadoPago refused to pause the ${cadence} preapproval; no gift was recorded`
            }
        };
    }

    // Local write. `pause()` has already flipped the stored status to `paused`,
    // so this both records the window and restores the status the subscriber
    // should actually see. Until the window is written, `deriveCourtesyStatus`
    // has nothing to read and a webhook arriving in between would legitimately
    // settle the row as `paused` — which is why these two land in one update.
    //
    // Written with Drizzle rather than `billing.subscriptions.update`: qzpay's
    // `QZPaySubscriptionStatus` union does not contain `courtesy` and cannot,
    // since the status is Hospeda's local reading of a paused preapproval. This
    // is the same reason `subscription-comp-create.service.ts` inserts `comp`
    // directly instead of going through the facade.
    await db
        .update(billingSubscriptions)
        .set({
            status: SubscriptionStatusEnum.COURTESY,
            ...writeCourtesyFields(window)
        })
        .where(eq(billingSubscriptions.id, subscriptionId));

    await db.insert(billingSubscriptionEvents).values({
        subscriptionId,
        eventType: BILLING_EVENT_TYPES.ADMIN_SUBSCRIPTION_COURTESY_GRANTED,
        newStatus: SubscriptionStatusEnum.COURTESY,
        triggerSource: 'admin-courtesy-grant',
        metadata: {
            actorId,
            cycles: window.courtesyCyclesGranted,
            courtesyStartsAt: window.courtesyStartsAt.toISOString(),
            courtesyEndsAt: window.courtesyEndsAt.toISOString()
        }
    });

    clearEntitlementCache(subscription.customerId);

    // Notification 1 of 3. Fire-and-forget: a mail failure must not undo a gift
    // that MercadoPago and the database have both already accepted.
    await sendCourtesyGrantedNotification({ subscriptionId }).catch((err) => {
        apiLogger.warn(
            { subscriptionId, error: String(err) },
            'Courtesy granted notification failed'
        );
    });

    apiLogger.info(
        {
            subscriptionId,
            actorId,
            cycles: window.courtesyCyclesGranted,
            courtesyStartsAt: window.courtesyStartsAt.toISOString(),
            courtesyEndsAt: window.courtesyEndsAt.toISOString()
        },
        'Courtesy cycles granted'
    );

    return {
        success: true,
        data: {
            subscriptionId,
            courtesyStartsAt: window.courtesyStartsAt,
            courtesyEndsAt: window.courtesyEndsAt,
            courtesyCyclesGranted: window.courtesyCyclesGranted
        }
    };
}
