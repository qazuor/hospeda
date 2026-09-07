/**
 * Comp grant orchestration (HOS-1171).
 *
 * `POST /api/v1/admin/billing/subscriptions/grant-comp` calls this and nothing
 * else. It wraps `createCompSubscription` — which only inserts the row — with
 * the part that makes an ADMIN grant different from the checkout grant it
 * replaced.
 *
 * ## Why the checkout never needed any of this
 *
 * A comp used to be redeemed at NEW-SUBSCRIBER checkout, so it arrived BEFORE
 * any preapproval existed. `mp_subscription_id = NULL` was natural and there was
 * nothing to cancel. An admin grant arrives at an arbitrary moment, and the
 * customer may have a preapproval MercadoPago is actively charging. Insert the
 * comp row and walk away, and MercadoPago keeps billing someone we have just
 * declared free.
 *
 * That is the HOS-751 failure mode, which already happened here: a preapproval
 * left `authorized` after a refund charged again. Its answer was
 * `services/billing/preapproval-hard-cancel.ts`, and this module uses it rather
 * than writing a second copy.
 *
 * ## The trap in that helper, and why this is the one caller that avoids it
 *
 * `hardCancelPreapprovalBestEffort` NEVER THROWS. Its `failed` outcome is
 * "MercadoPago refused and we logged it", returned rather than raised. Calling
 * it and continuing — which is right for the two crons and the refund path,
 * whose expensive half has already happened — would here produce exactly the bug
 * this module exists to prevent: the provider says no, nothing throws, and the
 * comp is granted on top of a live preapproval.
 *
 * So this is fail-CLOSED. `cancelled` and `skipped` proceed; `failed` aborts
 * with `PROVIDER_ERROR` and nothing is written. An operator seeing that error
 * still has a customer who pays, which is recoverable; the other direction is a
 * customer being charged for something we told them was free.
 *
 * ## Ordering, and why it is not the other way round
 *
 * Provider first, local writes second — the same order `courtesy-grant.service`
 * uses, for the same reason. There is no transaction spanning MercadoPago and
 * Postgres, so one of the two has to go first, and the recoverable failure is
 * the one where the provider side succeeded and the local side did not: that
 * leaves a cancelled preapproval and a customer who is simply not comped yet,
 * visible to the operator as an error they can retry. The inverse leaves a comp
 * row over a preapproval nobody knows is still live.
 *
 * ## The asymmetry with courtesy is deliberate
 *
 * Courtesy PAUSES the preapproval: reversible, and a cron resumes it at full
 * price when the window closes. Comp DESTROYS it: `mp_subscription_id = NULL`,
 * permanent, nothing to resume. That is why comp needs a hard-cancel and
 * courtesy must never get one.
 *
 * @module services/subscription-comp-grant
 */

import { and, billingSubscriptionEvents, billingSubscriptions, eq, getDb, inArray } from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { BILLING_EVENT_TYPES } from '@repo/service-core';
import { apiLogger } from '../utils/logger.js';
import { hardCancelPreapprovalBestEffort } from './billing/preapproval-hard-cancel.js';
import { sendCompGrantedNotification } from './comp-notifications.service.js';
import { createCompSubscription } from './subscription-comp-create.service.js';
import { reconcileSubscriptionLinkedEntities } from './subscription-linked-entities.service.js';

/** Trigger source recorded on both event rows this grant writes. */
const TRIGGER_SOURCE = 'admin-comp-grant' as const;

/**
 * Statuses whose rows must be retired before a comp is granted.
 *
 * Defined as "everything MercadoPago could still charge", not as a list of the
 * statuses seen in practice. `cancelled`, `expired` and `abandoned` are already
 * terminal; `comp` has no preapproval by construction. Everything else — including
 * `paused` and `courtesy`, which are pauses that a cron is expected to UNDO — can
 * still turn into a charge, so all of them are superseded.
 */
const SUPERSEDABLE_STATUSES: readonly string[] = [
    SubscriptionStatusEnum.ACTIVE,
    SubscriptionStatusEnum.TRIALING,
    SubscriptionStatusEnum.PAST_DUE,
    SubscriptionStatusEnum.PAUSED,
    SubscriptionStatusEnum.PENDING_PROVIDER,
    SubscriptionStatusEnum.COURTESY
];

/** Typed failures a comp grant can report. */
export type GrantCompErrorCode = 'NOT_FOUND' | 'INVALID_PLAN' | 'PROVIDER_ERROR';

/** What a successful grant produces. */
export interface GrantCompResult {
    /** UUID of the newly-created `status='comp'` subscription. */
    readonly subscriptionId: string;
    /** Subscriptions retired to make room for it. */
    readonly supersededSubscriptionIds: readonly string[];
    /**
     * True when at least one live MercadoPago preapproval was hard-cancelled.
     * Carried into the customer's email: someone who was being charged has to be
     * told the charging stopped, and someone who never was must not read a
     * sentence about a card they never gave us.
     */
    readonly hadActiveBilling: boolean;
}

/** Result envelope, matching `courtesy-grant.service`'s shape. */
export type GrantCompOutcome =
    | { readonly success: true; readonly data: GrantCompResult }
    | {
          readonly success: false;
          readonly error: { readonly code: GrantCompErrorCode; readonly message: string };
      };

/**
 * Grants a permanently-complimentary subscription to a customer.
 *
 * @param input.customerId - Billing customer receiving the grant.
 * @param input.planId - Plan (`billing_plans.id`) whose entitlements are granted.
 * @param input.interval - Recorded for audit; a comp is never charged either way.
 * @param input.livemode - Whether the record is in live mode.
 * @param input.actorId - The admin performing the grant, recorded on the event rows.
 * @returns The new subscription id, or a typed error. Nothing is written on error.
 *
 * @example
 * ```ts
 * const outcome = await grantCompSubscription({
 *     customerId, planId, interval: 'monthly', livemode: true, actorId: actor.id
 * });
 * if (!outcome.success) throw new HTTPException(502, { message: outcome.error.message });
 * ```
 */
export async function grantCompSubscription(input: {
    readonly customerId: string;
    readonly planId: string;
    readonly interval: 'monthly' | 'annual';
    readonly livemode: boolean;
    readonly actorId: string;
}): Promise<GrantCompOutcome> {
    const { customerId, planId, interval, livemode, actorId } = input;
    const db = getDb();

    // 1. Everything MercadoPago could still charge this customer for.
    const supersedable = await db
        .select({
            id: billingSubscriptions.id,
            status: billingSubscriptions.status,
            mpSubscriptionId: billingSubscriptions.mpSubscriptionId
        })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.customerId, customerId),
                inArray(billingSubscriptions.status, SUPERSEDABLE_STATUSES)
            )
        );

    // 2. Provider first. The outcome is INSPECTED — see this module's header on
    //    why calling `hardCancelPreapprovalBestEffort` and moving on is the bug
    //    rather than the fix.
    let hadActiveBilling = false;

    for (const row of supersedable) {
        const outcome = await hardCancelPreapprovalBestEffort({
            subscriptionId: row.id,
            mpSubscriptionId: row.mpSubscriptionId,
            source: 'admin-comp-grant'
        });

        if (outcome.kind === 'failed') {
            apiLogger.error(
                {
                    customerId,
                    planId,
                    actorId,
                    subscriptionId: row.id,
                    mpSubscriptionId: row.mpSubscriptionId,
                    error: outcome.error
                },
                'Comp grant aborted: MercadoPago refused the preapproval hard-cancel'
            );
            return {
                success: false,
                error: {
                    code: 'PROVIDER_ERROR',
                    message:
                        `MercadoPago refused to cancel preapproval ${row.mpSubscriptionId} ` +
                        `for subscription ${row.id}; no comp was granted. Cancel it by hand ` +
                        'and retry, otherwise the customer would keep being charged for a ' +
                        'subscription we had declared free.'
                }
            };
        }

        if (outcome.kind === 'cancelled') {
            hadActiveBilling = true;
        }
    }

    // 3. Retire the superseded rows. `mp_subscription_id` is nulled along with
    //    the status: the preapproval is gone at the provider, and a dangling id
    //    would let a later sweep try to act on something that no longer exists.
    for (const row of supersedable) {
        await db
            .update(billingSubscriptions)
            .set({
                status: SubscriptionStatusEnum.CANCELLED,
                mpSubscriptionId: null,
                canceledAt: new Date()
            })
            .where(eq(billingSubscriptions.id, row.id));

        await db.insert(billingSubscriptionEvents).values({
            subscriptionId: row.id,
            eventType: BILLING_EVENT_TYPES.ADMIN_SUBSCRIPTION_CANCELLED,
            previousStatus: row.status,
            newStatus: SubscriptionStatusEnum.CANCELLED,
            triggerSource: TRIGGER_SOURCE,
            metadata: {
                actorId,
                reason: 'superseded-by-comp-grant',
                mpSubscriptionId: row.mpSubscriptionId
            }
        });
    }

    // 4. The comp row itself. Throws on an unknown or non-accommodation plan —
    //    those are caller mistakes and the route maps them to 404/422.
    let created: { localSubscriptionId: string };
    try {
        created = await createCompSubscription({ customerId, planId, interval, livemode });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        apiLogger.error({ customerId, planId, actorId, error: message }, 'Comp grant failed');

        if (message.includes('only accommodation plans can be comped')) {
            return { success: false, error: { code: 'INVALID_PLAN', message } };
        }
        if (message.includes('not found')) {
            return { success: false, error: { code: 'NOT_FOUND', message } };
        }
        throw error;
    }

    await db.insert(billingSubscriptionEvents).values({
        subscriptionId: created.localSubscriptionId,
        eventType: BILLING_EVENT_TYPES.ADMIN_SUBSCRIPTION_COMP_GRANTED,
        newStatus: SubscriptionStatusEnum.COMP,
        triggerSource: TRIGGER_SOURCE,
        metadata: {
            actorId,
            planId,
            interval,
            supersededSubscriptionIds: supersedable.map((r) => r.id),
            hadActiveBilling
        }
    });

    // 5. INV-1: a comp never goes through MercadoPago, so no webhook will ever
    //    fire for it — the one reconciler that every other lifecycle site is
    //    called FROM the webhook has to be called here by hand instead, or the
    //    owner's accommodations keep serving the superseded subscription's
    //    cached status.
    await reconcileSubscriptionLinkedEntities({
        subscriptionId: created.localSubscriptionId,
        subscriptionStatus: SubscriptionStatusEnum.COMP,
        source: TRIGGER_SOURCE
    });

    // 6. Fire-and-forget, and the OPPOSITE criterion from step 2 on purpose: a
    //    mail failure must not undo a grant that MercadoPago and the database
    //    have both already accepted, whereas a provider failure must stop the
    //    grant before either of them does anything.
    await sendCompGrantedNotification({
        subscriptionId: created.localSubscriptionId,
        hadActiveBilling
    }).catch((err) => {
        apiLogger.warn(
            { subscriptionId: created.localSubscriptionId, error: String(err) },
            'Comp granted notification failed'
        );
    });

    apiLogger.info(
        {
            subscriptionId: created.localSubscriptionId,
            customerId,
            planId,
            actorId,
            supersededSubscriptionIds: supersedable.map((r) => r.id),
            hadActiveBilling
        },
        'Comp subscription granted'
    );

    return {
        success: true,
        data: {
            subscriptionId: created.localSubscriptionId,
            supersededSubscriptionIds: supersedable.map((r) => r.id),
            hadActiveBilling
        }
    };
}
