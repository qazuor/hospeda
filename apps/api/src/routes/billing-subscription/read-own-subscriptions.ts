import {
    and,
    asc,
    billingOptions,
    courtesyGrants,
    emailOutbox,
    eq,
    findPendingAttemptById,
    getDb,
    inArray,
    isNotNull,
    isNull,
    plans,
    planVersions,
    SUBSCRIPTION_STATUSES,
    sql,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { BillingCycleSchema, ServiceErrorCode } from '@repo/schemas';
import {
    computeCourtesyBalanceMonths,
    createCutExpectedAmountPolicy,
    PAID_AFTER_CANCELLATION_TEMPLATE,
    readLivePromos,
    readResumableCheckoutUrl,
    ServiceError
} from '@repo/service-core';
import { z } from 'zod';
import { getClock } from '../../utils/clock';

const logger = createLogger('read-own-subscriptions');
const arsCurrencySchema = z.literal('ARS');
const paidAfterCancellationPayloadSchema = z
    .object({
        subscriptionId: z.string().uuid(),
        recurringAddonsCut: z.boolean()
    })
    .passthrough();

/** Read the owner's principal subscriptions that have a self-service cancellation surface. */
export async function readOwnSubscriptions(userId: string) {
    const statuses = SUBSCRIPTION_STATUSES.filter((status) =>
        ['ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCEL_SCHEDULED', 'PAUSED'].includes(status)
    );
    const rows = await getDb()
        .select({
            subscription: subscriptions,
            id: subscriptions.id,
            vertical: subscriptions.vertical,
            status: subscriptions.status,
            paymentMethod: subscriptions.paymentMethod,
            serviceEndsAt: subscriptions.serviceEndsAt,
            graceEndsAt: subscriptions.graceEndsAt,
            createdAt: subscriptions.createdAt,
            planSlug: plans.slug,
            planName: plans.name,
            optionAmount: billingOptions.amount,
            optionCurrency: billingOptions.currency,
            optionCycle: billingOptions.cycle
        })
        .from(subscriptions)
        .innerJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .innerJoin(
            billingOptions,
            and(
                eq(billingOptions.id, subscriptions.billingOptionId),
                eq(billingOptions.planVersionId, subscriptions.planVersionId)
            )
        )
        .where(
            and(
                eq(subscriptions.userId, userId),
                eq(subscriptions.class, 'PRINCIPAL'),
                inArray(subscriptions.status, statuses)
            )
        )
        .orderBy(asc(subscriptions.createdAt), asc(subscriptions.id));
    const ids = rows.map(({ id }) => id);
    const openPauses =
        ids.length === 0
            ? []
            : await getDb()
                  .select({
                      subscriptionId: subscriptionPauses.subscriptionId,
                      reason: subscriptionPauses.reason,
                      expectedEndAt: subscriptionPauses.expectedEndAt
                  })
                  .from(subscriptionPauses)
                  .where(
                      and(
                          inArray(subscriptionPauses.subscriptionId, ids),
                          isNull(subscriptionPauses.actualEndAt)
                      )
                  );
    const pausesById = new Map(openPauses.map((pause) => [pause.subscriptionId, pause]));
    // HOS-2351: an open succession is read from its successor's `succeeds_id`, never from the
    // predecessor's `succeeded_by_id`, which S18 writes only when the succession closes.
    const successors =
        ids.length === 0
            ? []
            : await getDb()
                  .select({
                      id: subscriptions.id,
                      status: subscriptions.status,
                      succeedsId: subscriptions.succeedsId,
                      authorizationWindowEndsAt: subscriptions.authorizationWindowEndsAt
                  })
                  .from(subscriptions)
                  .where(
                      and(
                          inArray(subscriptions.succeedsId, ids),
                          eq(subscriptions.class, 'PRINCIPAL'),
                          // The only live successor state with an open checkout (S1).
                          eq(subscriptions.status, 'PENDING_AUTHORIZATION')
                      )
                  );
    const openSuccessorsByPredecessor = new Map(
        successors.map((successor) => [successor.succeedsId, successor])
    );
    // HOS-2344: the open successor checkout can be resumed from Mi suscripción.
    const successorCheckoutUrls = new Map(
        await Promise.all(
            successors.map(async (successor) => {
                const commitment = await findPendingAttemptById({
                    subscriptionId: successor.id
                });
                return [
                    successor.id,
                    commitment ? readResumableCheckoutUrl({ commitment }) : null
                ] as const;
            })
        )
    );
    const marks =
        ids.length === 0
            ? []
            : await getDb()
                  .select({
                      subscriptionId: sql<string>`${emailOutbox.payload}->>'subscriptionId'`,
                      payload: emailOutbox.payload
                  })
                  .from(emailOutbox)
                  .where(
                      and(
                          eq(emailOutbox.recipientUserId, userId),
                          eq(emailOutbox.template, PAID_AFTER_CANCELLATION_TEMPLATE),
                          inArray(sql<string>`${emailOutbox.payload}->>'subscriptionId'`, ids)
                      )
                  );
    const marksById = new Map<string, { recurringAddonsCut: boolean }>();
    for (const mark of marks) {
        const parsed = paidAfterCancellationPayloadSchema.safeParse(mark.payload);
        if (!parsed.success) {
            logger.error(
                { subscriptionId: mark.subscriptionId },
                'Invalid paid-after-cancellation outbox payload'
            );
            marksById.set(mark.subscriptionId, { recurringAddonsCut: false });
            continue;
        }
        marksById.set(parsed.data.subscriptionId, {
            recurringAddonsCut: parsed.data.recurringAddonsCut
        });
    }
    const liveCourtesy =
        ids.length === 0
            ? []
            : await getDb()
                  .select({
                      subscriptionId: courtesyGrants.subscriptionId,
                      startsAt: courtesyGrants.startsAt,
                      endsAt: courtesyGrants.endsAt
                  })
                  .from(courtesyGrants)
                  .where(
                      and(
                          inArray(courtesyGrants.subscriptionId, ids),
                          isNull(courtesyGrants.balanceMonths),
                          isNull(courtesyGrants.balanceClosedAt)
                      )
                  );
    const now = getClock().clock.now();
    const liveCourtesyBySubscription = new Map<string, number>();
    for (const grant of liveCourtesy) {
        if (grant.startsAt > now || grant.endsAt <= now) continue;
        const { months } = computeCourtesyBalanceMonths({
            startsAt: grant.startsAt,
            endsAt: grant.endsAt,
            now
        });
        liveCourtesyBySubscription.set(
            grant.subscriptionId,
            (liveCourtesyBySubscription.get(grant.subscriptionId) ?? 0) + months
        );
    }
    const expectedAmountPolicy = createCutExpectedAmountPolicy();
    return Promise.all(
        rows.map(async (row) => {
            const cycle = BillingCycleSchema.safeParse(row.optionCycle);
            if (!cycle.success)
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Unknown billing option cycle'
                );
            const planCurrency = arsCurrencySchema.safeParse(row.optionCurrency);
            if (!planCurrency.success)
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Unknown billing option currency'
                );
            let nextCharge: { at: Date; amount: number; currency: 'ARS' } | null = null;
            const openPause = pausesById.get(row.id);
            const livePromos = await readLivePromos({ subscriptionId: row.id, at: now });
            const successor = openSuccessorsByPredecessor.get(row.id);
            if (
                row.subscription.nextChargeAt !== null &&
                isNextChargeShown({
                    status: row.subscription.status,
                    paymentMethod: row.subscription.paymentMethod,
                    nextChargeAt: row.subscription.nextChargeAt,
                    now
                })
            ) {
                const expected = await expectedAmountPolicy.expectedAmount({
                    subscription: row.subscription,
                    purpose: { kind: 'PERIOD', chargeCreatedAt: row.subscription.nextChargeAt }
                });
                if (expected.kind === 'NOT_COMPARABLE') {
                    logger.warn(
                        { subscriptionId: row.id, reason: expected.reason },
                        'Could not calculate the next subscription charge'
                    );
                } else {
                    const chargeCurrency = arsCurrencySchema.safeParse(expected.currency);
                    if (!chargeCurrency.success)
                        throw new ServiceError(
                            ServiceErrorCode.INTERNAL_ERROR,
                            'Unknown next charge currency'
                        );
                    nextCharge = {
                        at: row.subscription.nextChargeAt,
                        amount: expected.amountMinor,
                        currency: chargeCurrency.data
                    };
                }
            }
            return {
                id: row.id,
                predecessorId: row.subscription.succeedsId,
                vertical: row.vertical,
                status: row.status,
                paymentMethod: row.paymentMethod,
                serviceEndsAt: row.serviceEndsAt,
                graceEndsAt: row.graceEndsAt,
                createdAt: row.createdAt,
                plan: {
                    slug: row.planSlug,
                    name: row.planName,
                    amount: row.optionAmount,
                    currency: planCurrency.data,
                    cycle: cycle.data
                },
                nextCharge,
                paidAfterCancellation:
                    row.status === 'CANCEL_SCHEDULED' ? (marksById.get(row.id) ?? null) : null,
                pause:
                    openPause &&
                    (openPause.reason === 'CUSTOMER_REQUEST' || openPause.reason === 'COURTESY')
                        ? {
                              reason: openPause.reason,
                              expectedEndAt: openPause.expectedEndAt?.toISOString() ?? null
                          }
                        : null,
                promo: livePromos.length > 0 ? { endsAt: null } : null,
                liveCourtesyMonths: liveCourtesyBySubscription.get(row.id) ?? 0,
                succession: successor
                    ? {
                          checkoutOpen: true as const,
                          checkoutDeadline:
                              successor.authorizationWindowEndsAt?.toISOString() ?? null,
                          successorId: successor.id,
                          checkoutUrl: successorCheckoutUrls.get(successor.id) ?? null
                      }
                    : null
            };
        })
    );
}

/**
 * Mirrors the renewal eligibility predicate in `renewal-notice.ts` for a
 * principal subscription's stored provider date.
 */
export function isNextChargeShown(input: {
    readonly status: string;
    readonly paymentMethod: string | null;
    readonly nextChargeAt: Date | null;
    readonly now: Date;
}): boolean {
    return (
        input.status === 'ACTIVE' &&
        input.paymentMethod === 'CARD' &&
        input.nextChargeAt !== null &&
        input.nextChargeAt > input.now
    );
}

/** Read deferred courtesy terms belonging to the owner, for display only. */
export async function readOwnDeferredCourtesies(userId: string) {
    return getDb()
        .select({
            courtesyGrantId: courtesyGrants.id,
            vertical: subscriptions.vertical,
            balanceMonths: courtesyGrants.balanceMonths
        })
        .from(courtesyGrants)
        .innerJoin(subscriptions, eq(courtesyGrants.subscriptionId, subscriptions.id))
        .where(
            and(
                eq(courtesyGrants.beneficiaryUserId, userId),
                isNotNull(courtesyGrants.balanceMonths),
                isNull(courtesyGrants.balanceClosedAt)
            )
        )
        .orderBy(asc(courtesyGrants.createdAt), asc(courtesyGrants.id));
}
